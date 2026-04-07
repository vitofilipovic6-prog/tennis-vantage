// src/hooks/useTournamentFilter.js
// ─────────────────────────────────────────────────────────────────────────────
// Extracts unique tournaments from the current match pool and provides
// a dynamic filter. Only shows tournaments that actually have matches
// on the currently selected day (including finished, live, upcoming).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';

/**
 * @param {Array}  matches     - full match array for the current date (all statuses)
 * @param {string} activeType  - current match-type filter (e.g. 'atp_singles')
 * @param {Function} deriveMatchType - function to get type from match
 * @param {Set}    wtaPlayerIds
 * @returns {{ tournaments: string[], counts: Record<string,number> }}
 */
export function useTournamentFilter(matches, activeType, deriveMatchType, wtaPlayerIds) {
  return useMemo(() => {
    // Only look at matches of the active type
    const typeMatches = matches.filter(
      m => deriveMatchType(m, wtaPlayerIds) === activeType
    );

    const countMap = {};
    for (const m of typeMatches) {
      const t = m.tournament ?? 'Unknown';
      countMap[t] = (countMap[t] ?? 0) + 1;
    }

    // Sort by count descending, then alphabetically
    const tournaments = Object.keys(countMap).sort(
      (a, b) => countMap[b] - countMap[a] || a.localeCompare(b)
    );

    return { tournaments, counts: countMap };
  }, [matches, activeType, wtaPlayerIds]);
}