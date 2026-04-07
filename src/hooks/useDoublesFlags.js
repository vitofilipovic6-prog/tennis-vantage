// src/hooks/useDoublesFlags.js
// ─────────────────────────────────────────────────────────────────────────────
// Collects doubles players whose country is empty/unknown and resolves
// their flags via /api/resolve-flags (Gemini). Results are cached in memory
// for the session lifetime to avoid redundant API calls.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';

// Session-level cache: playerName → country string "C1/C2"
const flagCache = new Map();

export function useDoublesFlags(matches = []) {
  const [resolvedFlags, setResolvedFlags] = useState(() => new Map(flagCache));
  const pendingRef = useRef(new Set());
  const timerRef   = useRef(null);

  const resolve = useCallback(async (doublesPlayers) => {
    if (!doublesPlayers.length) return;

    // Batch into groups of 20 to stay within token limits
    const BATCH = 20;
    for (let i = 0; i < doublesPlayers.length; i += BATCH) {
      const batch = doublesPlayers.slice(i, i + BATCH);
      try {
        const res = await fetch('/api/resolve-flags', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ players: batch }),
        });
        if (!res.ok) continue;

        const data = await res.json();
        if (!data?.flagMap) continue;

        // Store results in cache and update state
        for (const [id, info] of Object.entries(data.flagMap)) {
          if (info.country) {
            flagCache.set(id, info.country);
          }
        }
        setResolvedFlags(new Map(flagCache));
      } catch (e) {
        console.warn('[useDoublesFlags] resolve error:', e.message);
      }
    }
  }, []);

  useEffect(() => {
    // Collect doubles players with missing/empty countries
    const toResolve = [];

    for (const m of matches) {
      for (const player of [m.player1, m.player2]) {
        if (!player?.name?.includes('/')) continue; // singles only
        if (pendingRef.current.has(player.id)) continue; // already queued
        if (flagCache.has(player.id)) continue; // already resolved

        const country = player.country ?? '';
        // Check if either half is missing
        const halves = country.split('/');
        const missing = halves.some(c => !c.trim() || c.trim() === 'UNK');

        if (missing || !country) {
          toResolve.push({ id: player.id, name: player.name });
          pendingRef.current.add(player.id);
        }
      }
    }

    if (!toResolve.length) return;

    // Debounce: wait 800ms after last match list change before firing
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => resolve(toResolve), 800);

    return () => clearTimeout(timerRef.current);
  }, [matches, resolve]);

  /**
   * Enrich a player object with resolved country/flag if available
   */
  const enrichPlayer = useCallback((player) => {
    if (!player?.name?.includes('/')) return player;
    const resolved = resolvedFlags.get(player.id);
    if (!resolved) return player;
    return { ...player, country: resolved };
  }, [resolvedFlags]);

  return { enrichPlayer, resolvedFlags };
}