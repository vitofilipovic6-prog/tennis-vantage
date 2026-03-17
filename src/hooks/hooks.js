// src/hooks/hooks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getMatchesByDate, getPrediction, sendChatMessage,
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
// Two-layer refresh strategy:
//  1. Every 30 seconds  → re-reads live match scores from DB (cheap, no API call)
//  2. Every 30 minutes  → triggers sync-matches Edge Function (fetches fresh data
//     from RapidAPI into DB), then immediately re-reads everything from DB
// Tab visibility aware — pauses all polling when tab is hidden.
// ─────────────────────────────────────────────────────────────────────────────
export function useMatches() {
  const [live, setLive] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false); // true while Edge Fn is running

  const liveIntervalRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // ── Full DB read (both live + upcoming) ──────────────────────────────────
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

  // ── Lightweight live-only DB read ────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const liveData = await getLiveMatches();
      setLive(liveData);
    } catch {
      // silent — don't overwrite existing data on a poll error
    }
  }, []);

  // ── Trigger Edge Function sync then re-read everything ──────────────────
  const triggerSync = useCallback(async () => {
    if (document.hidden) return; // don't waste API quota when tab not visible
    setSyncing(true);
    try {
      const { data: { session } } = await import('../services/supabase')
        .then(m => m.supabase.auth.getSession());

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-matches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: '{}',
        }
      );
    } catch {
      // Edge Function call failed — still re-read DB in case
      // a previous sync already wrote fresh data
    } finally {
      setSyncing(false);
      // Always re-read DB after a sync attempt
      await fetchAll();
    }
  }, [fetchAll]);

  // ── Start / stop polling ─────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    // Live scores: every 30 seconds
    liveIntervalRef.current = setInterval(() => {
      if (!document.hidden) fetchLive();
    }, 30_000);

    // Full sync: every 30 minutes
    syncIntervalRef.current = setInterval(() => {
      if (!document.hidden) triggerSync();
    }, 30 * 60 * 1000);
  }, [fetchLive, triggerSync]);

  const stopPolling = useCallback(() => {
    clearInterval(liveIntervalRef.current);
    clearInterval(syncIntervalRef.current);
  }, []);

  useEffect(() => {
    // Initial load
    fetchAll();
    startPolling();

    // Pause when tab hidden, resume + refresh when visible again
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchAll();        // immediate refresh when user comes back
        startPolling();    // restart timers
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAll, startPolling, stopPolling]);

  return { live, upcoming, loading, error, syncing, refresh: fetchAll };
}

// ── useMatchesByDate ──────────────────────────────────────────────────────────
const matchDateCache = {};

export function useMatchesByDate(dateString) {
  const [matches, setMatches] = useState(matchDateCache[dateString] ?? null);
  const [loading, setLoading] = useState(!matchDateCache[dateString] && !!dateString);
  const [error, setError] = useState(null);

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
      .catch(e => setError(e.message ?? 'Failed to reload'))
      .finally(() => setLoading(false));
  }, [dateString]);

  return { matches: matches ?? [], loading, error, invalidate };
}

// ── useActiveDates ────────────────────────────────────────────────────────────
let activeDatesCache = null;
let activeDatesCacheTime = 0;
const ACTIVE_DATES_TTL = 5 * 60 * 1000;

export function useActiveDates(startDate, endDate) {
  const isStale = Date.now() - activeDatesCacheTime > ACTIVE_DATES_TTL;

  const [activeDates, setActiveDates] = useState(
    (activeDatesCache && !isStale) ? activeDatesCache : new Set()
  );
  const [loading, setLoading] = useState(!activeDatesCache || isStale);

  useEffect(() => {
    const stale = Date.now() - activeDatesCacheTime > ACTIVE_DATES_TTL;

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
        activeDatesCache = set;
        activeDatesCacheTime = Date.now();
        setActiveDates(set);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [startDate, endDate]);

  return { activeDates, loading };
}

// ── useRankings ───────────────────────────────────────────────────────────────
// Now supports: ATP, WTA, ITF_MEN, ITF_WOMEN, UTR_MEN, UTR_WOMEN
// ITF/UTR pull from the players table joined via matches (match_type filter).
// ATP/WTA pull from the rankings table as before.
// ── useRankings ───────────────────────────────────────────────────────────────
const rankingsCache = {};

export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    // Check cache — but only use it if it has actual data
    const cached = rankingsCache[tour];
    if (cached && cached.length > 0) {
      setRankings(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRankings([]);

    const isAlt = ['ITF_MEN', 'ITF_WOMEN', 'UTR_MEN', 'UTR_WOMEN'].includes(tour);
    const fetchPromise = isAlt ? fetchAltRankings(tour) : getRankings(tour);

    fetchPromise
      .then(data => {
        if (cancelled) return;
        const capped = (data ?? []).slice(0, 50);
        // Only cache if we got real data — don't cache empty results
        if (capped.length > 0) rankingsCache[tour] = capped;
        setRankings(capped);
        setError(null);
      })
      .catch(e => {
        if (cancelled) return;
        console.error(`[useRankings:${tour}]`, e.message);
        setError(e.message ?? 'Failed to load rankings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tour]);

  const refresh = useCallback(() => {
    delete rankingsCache[tour];
    setLoading(true);
    setError(null);
    setRankings([]);

    const isAlt = ['ITF_MEN', 'ITF_WOMEN', 'UTR_MEN', 'UTR_WOMEN'].includes(tour);
    const fetchPromise = isAlt ? fetchAltRankings(tour) : getRankings(tour);

    fetchPromise
      .then(data => {
        const capped = (data ?? []).slice(0, 50);
        if (capped.length > 0) rankingsCache[tour] = capped;
        setRankings(capped);
        setError(null);
      })
      .catch(e => setError(e.message ?? 'Failed to reload rankings'))
      .finally(() => setLoading(false));
  }, [tour]);

  return { rankings, loading, error, refresh };
}

// ── fetchAltRankings ──────────────────────────────────────────────────────────
// Derives ITF/UTR pseudo-rankings from match wins in the DB.
// Returns empty array (never throws) so the UI shows EmptyState, not an error.
async function fetchAltRankings(tour) {
  const typeMap = {
    ITF_MEN:   ['itf_men_singles', 'itf_men_doubles'],
    ITF_WOMEN: ['itf_women_singles', 'itf_women_doubles'],
    UTR_MEN:   ['utr_men_singles'],
    UTR_WOMEN: ['utr_women_singles'],
  };
  const types = typeMap[tour] ?? [];
  if (types.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        winner_id,
        player1:players!player1_id(id, name, country, flag, rank, wins, losses, surface_pref, recent_form),
        player2:players!player2_id(id, name, country, flag, rank, wins, losses, surface_pref, recent_form)
      `)
      .in('match_type', types)
      .order('match_date', { ascending: false })
      .limit(500);

    // If the query errored OR returned nothing, just return empty — don't throw
    if (error) {
      console.warn(`[fetchAltRankings:${tour}] query error:`, error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    const playerMap = new Map();
    const winCount  = new Map();

    for (const m of data) {
      for (const p of [m.player1, m.player2]) {
        if (!p?.id || !p.name || p.name.includes('/')) continue;
        if (!playerMap.has(p.id)) {
          playerMap.set(p.id, p);
          winCount.set(p.id, 0);
        }
      }
      if (m.winner_id && winCount.has(m.winner_id)) {
        winCount.set(m.winner_id, winCount.get(m.winner_id) + 1);
      }
    }

    if (playerMap.size === 0) return [];

    return [...playerMap.values()]
      .sort((a, b) => (winCount.get(b.id) ?? 0) - (winCount.get(a.id) ?? 0))
      .map((p, i) => ({
        ...p,
        rank:      i + 1,
        points:    winCount.get(p.id) ?? 0,
        prev_rank: null,
      }));

  } catch (e) {
    // Never let this crash the rankings tab
    console.warn(`[fetchAltRankings:${tour}] unexpected error:`, e.message);
    return [];
  }
}

// ── usePrediction ─────────────────────────────────────────────────────────────
export function usePrediction(match) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const matchId = match?.id ?? null;

  useEffect(() => {
    if (!matchId) { setPrediction(null); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPrediction(match)
      .then(data => { if (!cancelled) { setPrediction(data); setError(null); } })
      .catch(e => { if (!cancelled) setError(e.message ?? 'Prediction failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return { prediction, loading, error };
}

// ── usePlayerSearch ───────────────────────────────────────────────────────────
export function usePlayerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('players')
      .select('id, name, country, flag, rank, surface_pref, recent_form')
      .ilike('name', `%${query}%`)
      .not('name', 'is', null)
      .order('rank', { ascending: true, nullsLast: true })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setResults((data ?? []).filter(p => p.name && !p.name.includes('/')));
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [query]);

  return { query, setQuery, results, loading };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
export function useAiChat(contextMatch = null) {
  const GREETING = "Hi! I'm your AI tennis analyst powered by Gemini. Ask me anything about match predictions, player stats, head-to-head records, surface analysis, or tournament strategies.";

  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      const systemContext = contextMatch
        ? `You are a professional tennis analyst for TennisVantage. Current match context: ${contextMatch.player1?.name ?? 'Player 1'} (Rank #${contextMatch.player1?.rank ?? '?'}, ${contextMatch.player1?.country ?? ''}) vs ${contextMatch.player2?.name ?? 'Player 2'} (Rank #${contextMatch.player2?.rank ?? '?'}, ${contextMatch.player2?.country ?? ''}) on ${contextMatch.surface ?? 'Hard'} at ${contextMatch.tournament ?? 'Unknown tournament'}, ${contextMatch.round ?? ''}. P1 recent form: ${contextMatch.player1?.recent_form ?? 'N/A'}. P2 recent form: ${contextMatch.player2?.recent_form ?? 'N/A'}. Give concise, expert analysis.`
        : `You are a professional tennis analyst for TennisVantage, an ATP/WTA analytics app. Provide insightful, data-driven analysis. Cover ATP, WTA, ITF and UTR tennis. Be concise and expert. Use stats, surface analysis, head-to-head records, and current form to inform your answers.`;

      const history = [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(history, systemContext);
      const aiText = response?.content?.[0]?.text ?? response?.reply ?? "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error. Please try again.' }]);
    } finally {
      setTyping(false);
    }
  }, [contextMatch]);

  const reset = useCallback(() => {
    setMessages([{ role: 'assistant', content: 'New session started. Ask me anything about tennis!' }]);
  }, []);

  return { messages, typing, sendMessage, reset, bottomRef };
}

// ── useToast ──────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}