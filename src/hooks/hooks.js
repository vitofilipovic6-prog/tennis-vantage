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
// Now supports: ATP, WTA, ITF_MEN, ITF_WOMEN, UTR_MEN, UTR_WOMEN
// ITF/UTR pull from the players table joined via matches (match_type filter).
// ATP/WTA pull from the rankings table as before.
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

    const fetchFn = ['ITF_MEN', 'ITF_WOMEN', 'UTR_MEN', 'UTR_WOMEN'].includes(tour)
      ? fetchAltRankings(tour)
      : getRankings(tour);

    fetchFn
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

  // Allow cache-busting from outside
  const refresh = useCallback(() => {
    delete rankingsCache[tour];
    setLoading(true);
    setRankings([]);
    const fetchFn = ['ITF_MEN', 'ITF_WOMEN', 'UTR_MEN', 'UTR_WOMEN'].includes(tour)
      ? fetchAltRankings(tour)
      : getRankings(tour);
    fetchFn
      .then(data => { rankingsCache[tour] = data; setRankings(data); setError(null); })
      .catch(e => setError(e.message ?? 'Failed'))
      .finally(() => setLoading(false));
  }, [tour]);

  return { rankings, loading, error, refresh };
}

// Fetch ITF/UTR "rankings" — derives a pseudo-ranking from players
// who appear in matches of the corresponding match_type.
// Since ITF/UTR don't have a real rankings table, we pull distinct players
// from those matches and sort by win count descending.
async function fetchAltRankings(tour) {
  const typeMap = {
    ITF_MEN:   ['itf_men_singles', 'itf_men_doubles'],
    ITF_WOMEN: ['itf_women_singles', 'itf_women_doubles'],
    UTR_MEN:   ['utr_men_singles'],
    UTR_WOMEN: ['utr_women_singles'],
  };
  const types = typeMap[tour] ?? [];

  try {
    // Pull all finished matches of this type, with player info
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

    if (error) throw error;

    // Build win-count map keyed by player id
    const playerMap = new Map();
    const winCount  = new Map();

    for (const m of (data ?? [])) {
      for (const p of [m.player1, m.player2]) {
        if (!p?.id || p.name?.includes('/')) continue; // skip doubles pairs
        if (!playerMap.has(p.id)) {
          playerMap.set(p.id, p);
          winCount.set(p.id, 0);
        }
      }
      if (m.winner_id) {
        winCount.set(m.winner_id, (winCount.get(m.winner_id) ?? 0) + 1);
      }
    }

    // Sort by wins desc, assign pseudo-rank
    return [...playerMap.values()]
      .sort((a, b) => (winCount.get(b.id) ?? 0) - (winCount.get(a.id) ?? 0))
      .map((p, i) => ({
        ...p,
        rank:   i + 1,
        points: winCount.get(p.id) ?? 0, // "points" = match wins in ITF/UTR context
        prev_rank: null,
      }));
  } catch (e) {
    console.error(`[fetchAltRankings:${tour}]`, e.message);
    return [];
  }
}

// ── useAllPlayers ─────────────────────────────────────────────────────────────
// Fetches ALL players from the DB (not just those in today's matches).
// This feeds PlayerSearchModal so users can find Alcaraz, Sinner etc.
let allPlayersCache     = null;
let allPlayersCacheTime = 0;
const ALL_PLAYERS_TTL   = 10 * 60 * 1000; // 10 min

export function useAllPlayers() {
  const isStale = Date.now() - allPlayersCacheTime > ALL_PLAYERS_TTL;
  const [players, setPlayers] = useState(allPlayersCache && !isStale ? allPlayersCache : []);
  const [loading, setLoading] = useState(!allPlayersCache || isStale);

  useEffect(() => {
    const stale = Date.now() - allPlayersCacheTime > ALL_PLAYERS_TTL;
    if (allPlayersCache && !stale) {
      setPlayers(allPlayersCache);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Fetch top 500 ranked players — covers all ATP/WTA stars + ITF/UTR players
    supabase
      .from('players')
      .select('id, name, country, flag, rank, wins, losses, surface_pref, first_serve_pct, recent_form')
      .not('name', 'is', null)
      .order('rank', { ascending: true, nullsLast: true })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setLoading(false); return; }
        const sorted = (data ?? []).filter(p => p.name && !p.name.includes('/'));
        allPlayersCache     = sorted;
        allPlayersCacheTime = Date.now();
        setPlayers(sorted);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { players, loading };
}

// ── usePrediction ─────────────────────────────────────────────────────────────
export function usePrediction(match) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const matchId = match?.id ?? null;

  useEffect(() => {
    if (!matchId) { setPrediction(null); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPrediction(match)
      .then(data => { if (!cancelled) { setPrediction(data); setError(null); } })
      .catch(e   => { if (!cancelled) setError(e.message ?? 'Prediction failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return { prediction, loading, error };
}

// ── usePlayerSearch ───────────────────────────────────────────────────────────
export function usePlayerSearch() {
  const [query, setQuery]     = useState('');
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
  const [typing, setTyping]     = useState(false);
  const bottomRef               = useRef(null);
  const messagesRef             = useRef(messages);

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

      const history  = [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(history, systemContext);
      const aiText   = response?.content?.[0]?.text ?? response?.reply ?? "Sorry, I couldn't process that.";
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
  const idRef               = useRef(0);

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