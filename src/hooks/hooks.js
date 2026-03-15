// src/hooks/hooks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getMatchesByDate, getPrediction, sendChatMessage, MOCK_DATA,
} from '../services/tennisApi';
import { supabase } from '../services/supabase';

export const CHAT_MAX_CHARS = 500;

// ── Tour detection ────────────────────────────────────────────────────────────
export function detectTour(tournamentNameOrMatch) {
  if (tournamentNameOrMatch && typeof tournamentNameOrMatch === 'object') {
    if (tournamentNameOrMatch.tour === 'WTA') return 'WTA';
    if (tournamentNameOrMatch.tour === 'ATP') return 'ATP';
    return detectTour(tournamentNameOrMatch.tournament ?? '');
  }
  const s = String(tournamentNameOrMatch ?? '').toLowerCase();
  if (s.includes('wta') || s.includes('women') || s.includes('ladies')) return 'WTA';
  if (s.includes('itf')) return 'ITF';
  return 'ATP';
}

// ── useMatches ────────────────────────────────────────────────────────────────
// Returns:
//  live     — all currently live matches
//  upcoming — upcoming + live matches from now onwards (for Predictions tab)
//  loading, error, refresh
export function useMatches() {
  const [live, setLive]         = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const intervalRef             = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [liveData, upcomingData] = await Promise.all([
        getLiveMatches(),
        getUpcomingMatches(),
      ]);
      setLive(liveData);
      setUpcoming(upcomingData);
      setError(null);
    } catch (e) {
      setError(e.message ?? 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    function startPoll() {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) getLiveMatches().then(setLive).catch(() => {});
      }, 30_000);
    }

    function handleVisibility() {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        getLiveMatches().then(setLive).catch(() => {});
        startPoll();
      }
    }

    startPoll();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAll]);

  return { live, upcoming, loading, error, refresh: fetchAll };
}

// ── useMatchesByDate ──────────────────────────────────────────────────────────
const matchDateCache = {};

export function useMatchesByDate(dateString) {
  const [matches, setMatches] = useState(matchDateCache[dateString] ?? null);
  const [loading, setLoading] = useState(!matchDateCache[dateString] && !!dateString);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!dateString) return;

    if (matchDateCache[dateString]) {
      setMatches(matchDateCache[dateString]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMatchesByDate(dateString)
      .then(data => {
        if (!cancelled) {
          matchDateCache[dateString] = data;
          setMatches(data);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e.message ?? 'Failed to load matches for this date');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateString]);

  const invalidate = useCallback(() => {
    delete matchDateCache[dateString];
    setMatches(null);
    setLoading(true);
    setError(null);
    getMatchesByDate(dateString)
      .then(data => { matchDateCache[dateString] = data; setMatches(data); })
      .catch(e  => setError(e.message ?? 'Failed to reload'))
      .finally(() => setLoading(false));
  }, [dateString]);

  return { matches: matches ?? [], loading, error, invalidate };
}

// ── useActiveDates ────────────────────────────────────────────────────────────
let activeDatesCache     = null;
let activeDatesCacheTime = 0;
const ACTIVE_DATES_TTL   = 5 * 60 * 1000;

export function useActiveDates(startDate, endDate) {
  const isStale = Date.now() - activeDatesCacheTime > ACTIVE_DATES_TTL;

  const [activeDates, setActiveDates] = useState(
    (activeDatesCache && !isStale) ? activeDatesCache : new Set()
  );
  const [loading, setLoading] = useState(!activeDatesCache || isStale);

  useEffect(() => {
    const now   = Date.now();
    const stale = now - activeDatesCacheTime > ACTIVE_DATES_TTL;

    if (activeDatesCache && !stale) {
      setActiveDates(activeDatesCache);
      setLoading(false);
      return;
    }

    const start = startDate instanceof Date
      ? startDate.toISOString().split('T')[0]
      : startDate;
    const end = endDate instanceof Date
      ? endDate.toISOString().split('T')[0]
      : endDate;

    supabase
      .from('matches')
      .select('match_date')
      .gte('match_date', `${start}T00:00:00.000Z`)
      .lte('match_date', `${end}T23:59:59.999Z`)
      .then(({ data }) => {
        const set = new Set((data ?? []).map(r => r.match_date.slice(0, 10)));
        activeDatesCache     = set;
        activeDatesCacheTime = Date.now();
        setActiveDates(set);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [startDate, endDate]);

  return { activeDates, loading };
}

// ── useRankings ───────────────────────────────────────────────────────────────
const rankingsCache = {};

export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState(rankingsCache[tour] ?? []);
  const [loading, setLoading]   = useState(!rankingsCache[tour]);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (rankingsCache[tour]) {
      setRankings(rankingsCache[tour]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setRankings([]);
    getRankings(tour)
      .then(data => {
        if (!cancelled) {
          rankingsCache[tour] = data;
          setRankings(data);
          setError(null);
        }
      })
      .catch(e  => { if (!cancelled) setError(e.message ?? 'Failed to load rankings'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tour]);

  return { rankings, loading, error };
}

// ── usePrediction ─────────────────────────────────────────────────────────────
export function usePrediction(match) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const matchId = match?.id ?? null;

  useEffect(() => {
    if (!match) { setPrediction(null); setError(null); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPrediction(null);

    getPrediction(match)
      .then(data => { if (!cancelled) setPrediction(data); })
      .catch(e   => { if (!cancelled) setError(e.message ?? 'Prediction failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return { prediction, loading, error };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
export function useAiChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const send = useCallback(async (text) => {
    if (!text.trim()) return;

    const userMsg = { role: 'user', content: text };
    const next    = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setError(null);

    try {
      const reply = await sendChatMessage(next);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message ?? 'Chat failed');
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, send, reset };
}