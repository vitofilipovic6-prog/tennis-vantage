// src/hooks/useAutoResolveDoublesFlags.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES:
//   1. On mount, loads already-resolved doubles flags from Supabase DB
//      (players where country has "/" format like "ESP/ARG")
//   2. Scans current matches for any doubles players still missing flags
//   3. Fires the resolve-doubles-nationalities Edge Function to fix them via
//      RapidAPI tennis search (real nationality data from SofaScore)
//   4. Saves permanently to DB — subsequent loads skip all API calls
//   5. Returns enrichPlayer() for components to use inline
//
// NOTE: The Edge Function uses RapidAPI (which you already pay for) to search
// each player by last name — it gets real nationality unlike Gemini guessing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { resolveFlag } from '../services/tennisApi';

// ── Module-level cache — survives React re-renders and StrictMode ─────────────
const resolvedCache = new Map();  // playerId → "C1/C2" country string
const handledIds    = new Set();  // ids already queued for resolution
let   dbPrefetched  = false;      // only run the initial DB query once
let   edgeFnRunning = false;      // prevent concurrent edge function calls

// ── Check if a doubles player truly needs resolution ─────────────────────────
function isUnresolved(player) {
  if (!player?.id)                  return false;
  if (!player.name?.includes('/'))  return false;  // not doubles
  if (handledIds.has(player.id))    return false;  // already queued
  if (resolvedCache.has(player.id)) return false;  // already in memory cache

  const c = (player.country ?? '').trim();

  // Clearly empty or unknown
  if (!c || c === 'UNK' || c === 'UNK/UNK') return true;

  if (c.includes('/')) {
    const parts = c.split('/').map(s => s.trim());
    const c1 = parts[0] ?? '';
    const c2 = parts[1] ?? '';
    if (c1 === c2) return true;                        // duplicated = only had one code
    if (!c1 || !c2 || c1 === 'UNK' || c2 === 'UNK') return true; // partial
    return false;                                       // both halves valid ✓
  }

  // Single code for a doubles pair = unresolved
  return true;
}

// ── Load already-resolved players from DB (runs once on first mount) ──────────
async function prefetchFromDB() {
  if (dbPrefetched) return 0;
  dbPrefetched = true;

  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, country')
      .ilike('name', '%/%')
      .not('country', 'is', null)
      .limit(1000);

    if (error || !data?.length) return 0;

    let count = 0;
    for (const p of data) {
      const c = (p.country ?? '').trim();
      if (!c || !c.includes('/')) continue;
      const [c1, c2] = c.split('/').map(s => s.trim());
      // Only cache entries where both halves are real, different codes
      if (c1 && c2 && c1 !== 'UNK' && c2 !== 'UNK' && c1 !== c2) {
        resolvedCache.set(p.id, c);
        handledIds.add(p.id);
        count++;
      }
    }

    console.log(`[doubles-flags] Prefetched ${count} already-resolved players from DB`);
    return count;
  } catch (e) {
    console.warn('[doubles-flags] DB prefetch error:', e.message);
    return 0;
  }
}

// ── Re-fetch from DB after edge function saves new data ───────────────────────
async function refreshFromDB() {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, country')
      .ilike('name', '%/%')
      .not('country', 'is', null)
      .not('flag_resolved_at', 'is', null)
      .limit(1000);

    if (error || !data?.length) return 0;

    let newCount = 0;
    for (const p of data) {
      const c = (p.country ?? '').trim();
      if (!c || !c.includes('/')) continue;
      const [c1, c2] = c.split('/').map(s => s.trim());
      if (c1 && c2 && c1 !== 'UNK' && c2 !== 'UNK') {
        if (!resolvedCache.has(p.id)) newCount++;
        resolvedCache.set(p.id, c);
        handledIds.add(p.id);
      }
    }

    if (newCount > 0) {
      console.log(`[doubles-flags] Refreshed ${newCount} newly-resolved flags from DB`);
    }
    return newCount;
  } catch (e) {
    console.warn('[doubles-flags] DB refresh error:', e.message);
    return 0;
  }
}

// ── Call the Supabase Edge Function that does the actual RapidAPI lookups ─────
async function triggerResolutionEdgeFunction() {
  if (edgeFnRunning) return 0;
  edgeFnRunning = true;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.warn('[doubles-flags] Missing Supabase env vars');
    edgeFnRunning = false;
    return 0;
  }

  try {
    console.log('[doubles-flags] Triggering resolve-doubles-nationalities...');

    const res = await fetch(
      `${supabaseUrl}/functions/v1/resolve-doubles-nationalities`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
      }
    );

    if (!res.ok) {
      console.warn('[doubles-flags] Edge function returned', res.status);
      return 0;
    }

    const data = await res.json();

    if (data.errors?.length) {
      console.warn('[doubles-flags] Edge function errors:', data.errors.slice(0, 3));
    }

    console.log(`[doubles-flags] Resolution complete: resolved=${data.resolved ?? 0}, failed=${data.failed ?? 0}`);
    return data.resolved ?? 0;

  } catch (e) {
    console.warn('[doubles-flags] Edge function call failed:', e.message);
    return 0;
  } finally {
    edgeFnRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useAutoResolveDoublesFlags(matches = []) {
  // tick increments trigger re-renders in consuming components after new flags arrive
  const [tick, setTick]     = useState(0);
  const timerRef            = useRef(null);
  const mountedRef          = useRef(true);

  // ── Step 1: Prefetch from DB on first mount ────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    prefetchFromDB().then(count => {
      if (count > 0 && mountedRef.current) setTick(t => t + 1);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  // ── Step 2: Watch for unresolved players in matches ────────────────────────
  useEffect(() => {
    if (!matches.length) return;

    // Find players that still need resolution
    const unresolved = [];
    for (const m of matches) {
      for (const player of [m.player1, m.player2]) {
        if (isUnresolved(player)) {
          unresolved.push(player);
          handledIds.add(player.id); // mark now to prevent re-queuing on next render
        }
      }
    }

    if (unresolved.length === 0) return;

    console.log(`[doubles-flags] ${unresolved.length} players still need resolution — scheduling...`);

    // Debounce 2s so match list stabilises first
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      // Trigger the edge function (which does RapidAPI search + DB save)
      const resolvedCount = await triggerResolutionEdgeFunction();

      if (resolvedCount > 0 && mountedRef.current) {
        // Reload the newly saved data from DB into our cache
        const newCount = await refreshFromDB();
        if (newCount > 0 && mountedRef.current) {
          setTick(t => t + 1); // trigger re-render in all consuming components
        }
      }
    }, 2000);

    return () => clearTimeout(timerRef.current);
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── enrichPlayer: called by MatchCard, MatchPickerRow, PredictionCard ──────
  // Returns player with resolved country/flag, or original if not yet resolved
  const enrichPlayer = useCallback((player) => {
    if (!player?.name?.includes('/')) return player;

    const cached = resolvedCache.get(player.id);
    if (cached) {
      const firstCode = (cached.split('/')[0] ?? '').trim();
      return {
        ...player,
        country: cached,
        flag:    resolveFlag(firstCode),
      };
    }

    return player;
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    enrichPlayer,
    resolvedCount: resolvedCache.size,
  };
}