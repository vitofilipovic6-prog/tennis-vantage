// src/hooks/useAutoResolveDoublesFlags.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES:
//   On app load, silently finds doubles players with missing/blank country codes,
//   calls /api/resolve-doubles-flags (Gemini), and saves results permanently
//   to the Supabase `players` table.
//
// KEY DESIGN DECISIONS:
//   1. "Fire once per session" — uses a module-level Set so even if this hook
//      mounts multiple times (e.g. React StrictMode double-invoke), it never
//      triggers the API twice for the same player.
//
//   2. "DB-first" — players that already have a country AND flag_resolved_at
//      are skipped entirely. Gemini is only called for genuinely missing data.
//
//   3. "Non-blocking" — the hook returns immediately. Resolution happens in the
//      background. The frontend updates reactively via the `enrichPlayer` function.
//
//   4. "Permanent" — once saved to Supabase, the data is there forever. Future
//      app loads will find the country already populated and skip resolution.
//
//   5. "Graceful" — any error (Gemini quota, network, DB) is silently swallowed.
//      The user never sees an error. Worst case: flags stay blank until next load.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { resolveFlag } from '../services/tennisApi';

// ── Module-level state — persists across React re-renders and StrictMode ──────
// Players already submitted to the API this session (prevents double-calls)
const resolvedThisSession = new Set();
// In-memory cache of resolved country codes { playerId → countryString }
const resolvedCountryCache = new Map();
// Whether the initial DB fetch has completed (don't re-fetch on every render)
let dbFetchCompleted = false;
// Whether a resolution request is currently in-flight
let resolutionInProgress = false;

// ── Helper: check if a doubles player needs resolution ────────────────────────
function needsResolution(player) {
  if (!player?.name?.includes('/')) return false; // not a doubles player
  if (resolvedThisSession.has(player.id)) return false; // already handled
  if (resolvedCountryCache.has(player.id)) return false; // already resolved in memory

  const country = (player.country ?? '').trim();

  // Has both halves populated and neither is UNK → already good
  if (country.includes('/')) {
    const parts = country.split('/');
    const c1 = parts[0]?.trim() ?? '';
    const c2 = parts[1]?.trim() ?? '';
    if (c1 && c2 && c1 !== 'UNK' && c2 !== 'UNK') return false;
  }

  // Has a single valid country code (not UNK, not empty) → already good enough
  if (country && country !== 'UNK' && country.length >= 2 && !country.includes('/')) {
    // Single code is fine — we'll duplicate it in Flag.jsx
    // But we still want to resolve the REAL per-player codes if possible
    // Only skip if it looks like we've already resolved it (flag_resolved_at set)
    // We can't check flag_resolved_at here without a DB call, so we skip
    // if the country looks fully populated already
    return false;
  }

  // Empty, UNK, or partial → needs resolution
  return true;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useAutoResolveDoublesFlags(matches = []) {
  // resolvedFlags: Map of playerId → country string
  // This triggers re-renders in consuming components when new flags arrive
  const [resolvedFlags, setResolvedFlags] = useState(() => new Map(resolvedCountryCache));

  const timerRef   = useRef(null);
  const mountedRef = useRef(true);

  // ── Step 1: On first load, fetch already-resolved players from DB ──────────
  useEffect(() => {
    if (dbFetchCompleted) return; // only run once per session
    dbFetchCompleted = true;

    supabase
      .from('players')
      .select('id, name, country')
      .ilike('name', '%/%')            // doubles players have '/' in name
      .not('country', 'is', null)
      .not('country', 'eq', '')
      .not('flag_resolved_at', 'is', null) // only pre-resolved ones
      .limit(500)
      .then(({ data, error }) => {
        if (error || !data?.length) return;

        let updated = false;
        for (const p of data) {
          if (!p.country || p.country === 'UNK') continue;
          if (!resolvedCountryCache.has(p.id)) {
            resolvedCountryCache.set(p.id, p.country);
            resolvedThisSession.add(p.id); // mark as done — no need to re-resolve
            updated = true;
          }
        }

        if (updated && mountedRef.current) {
          setResolvedFlags(new Map(resolvedCountryCache));
        }
      })
      .catch(e => console.warn('[useAutoResolveDoublesFlags] DB prefetch error:', e.message));

    return () => { mountedRef.current = false; };
  }, []); // runs once

  // ── Step 2: When matches change, find players needing resolution ───────────
  useEffect(() => {
    if (!matches.length) return;

    // Collect players that genuinely need resolution
    const toResolve = [];
    for (const m of matches) {
      for (const player of [m.player1, m.player2]) {
        if (!player?.id || !player.name?.includes('/')) continue;
        if (needsResolution(player)) {
          toResolve.push({ id: player.id, name: player.name });
          resolvedThisSession.add(player.id); // mark immediately to prevent duplicates
        }
      }
    }

    if (toResolve.length === 0 || resolutionInProgress) return;

    // Debounce 1.5s — wait for matches to stabilise before firing API call
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current || resolutionInProgress) return;
      if (toResolve.length === 0) return;

      console.log(`[useAutoResolveDoublesFlags] Resolving ${toResolve.length} doubles players via Gemini…`);
      resolutionInProgress = true;

      try {
        const res = await fetch('/api/resolve-doubles-flags', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ players: toResolve }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          console.warn('[useAutoResolveDoublesFlags] API error:', res.status, errJson.error);
          return;
        }

        const data = await res.json();

        if (!data?.resolved || !Object.keys(data.resolved).length) {
          console.log('[useAutoResolveDoublesFlags] No new flags resolved');
          return;
        }

        // Update in-memory cache
        let anyNew = false;
        for (const [id, info] of Object.entries(data.resolved)) {
          if (info?.country) {
            resolvedCountryCache.set(id, info.country);
            anyNew = true;
          }
        }

        if (anyNew && mountedRef.current) {
          console.log(`[useAutoResolveDoublesFlags] ✓ ${Object.keys(data.resolved).length} flags resolved and saved to DB`);
          setResolvedFlags(new Map(resolvedCountryCache));
        }

      } catch (e) {
        console.warn('[useAutoResolveDoublesFlags] Resolution failed:', e.message);
        // Silent fail — worst case flags stay blank
      } finally {
        resolutionInProgress = false;
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timerRef.current);
  }, [matches]);

  // ── enrichPlayer: used by components to get the resolved country ──────────
  // Returns the player object with the resolved country (or original if not found)
  const enrichPlayer = useCallback((player) => {
    if (!player?.name?.includes('/')) return player; // not doubles

    // Check in-memory cache first
    const cachedCountry = resolvedCountryCache.get(player.id);
    if (cachedCountry) {
      return {
        ...player,
        country: cachedCountry,
        flag:    resolveFlag((cachedCountry.split('/')[0] ?? '').trim()),
      };
    }

    // If the player already has a good country, return as-is
    const country = (player.country ?? '').trim();
    if (country && country !== 'UNK') return player;

    // Still pending — return original (blank flag shows placeholder)
    return player;
  }, [resolvedFlags]); // eslint-disable-line react-hooks/exhaustive-deps

  return { enrichPlayer, resolvedFlags, resolvedCount: resolvedCountryCache.size };
}