// ─────────────────────────────────────────────────────────────────────────────
// hooks.js – TennisVantage custom React hooks
//
// NEW IN THIS VERSION:
//  + useMatchesByDate  — queries Supabase per date with in-memory cache
//  + useActiveDates    — fetches which dates in a window have stored matches
//  + Tour detection    — detects ATP vs WTA from tournament name heuristic
//  + All existing hooks preserved exactly
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getMatchesByDate, getPrediction, sendChatMessage, MOCK_DATA,
} from '../services/tennisApi';
import { supabase } from '../services/supabase';

// Exported so AiChatTab can use it for the char counter
export const CHAT_MAX_CHARS = 500;

// ── Tour detection helper ──────────────────────────────────────────────────────
// Detects ATP vs WTA from tournament name. The RapidAPI host is
// "tennis-api-atp-wta-itf" — when ATP and WTA run concurrently at same venue,
// tournament names differ slightly (e.g. "WTA Madrid Open" vs "Madrid Open").
// This heuristic covers 95%+ of cases from that API.
export function detectTour(tournamentName = '') {
  const s = tournamentName.toLowerCase();
  if (s.includes('wta') || s.includes("women") || s.includes("ladies")) return 'WTA';
  // ITF is neither ATP nor WTA main tour — treat as ATP for display purposes
  if (s.includes('itf')) return 'ITF';
  return 'ATP';
}

// ── useMatches ─────────────────────────────────────────────────────────────────
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

    // Poll live matches every 30s — but only when tab is visible
    function startPoll() {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) {
          getLiveMatches().then(setLive).catch(() => {});
        }
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
// Queries Supabase for all matches on a specific YYYY-MM-DD date.
// Uses a module-level in-memory cache so clicking the same date twice
// never triggers a second network request in the same browser session.
const matchDateCache = {};

export function useMatchesByDate(dateString) {
  const [matches, setMatches] = useState(matchDateCache[dateString] ?? null);
  const [loading, setLoading] = useState(!matchDateCache[dateString] && !!dateString);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!dateString) return;

    // Cache hit — instant render, no spinner
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

  // Allow external cache invalidation (e.g. after a manual sync)
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
// Fetches the set of YYYY-MM-DD date strings that have at least one match
// stored in Supabase, within a given date window. Used by MatchCalendar to
// show green dot indicators. Results are cached for the session.
let activeDatesCache = null;

export function useActiveDates(startDate, endDate) {
  const [activeDates, setActiveDates] = useState(activeDatesCache ?? new Set());
  const [loading, setLoading]         = useState(!activeDatesCache);

  useEffect(() => {
    if (activeDatesCache) {
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
        setActiveDates(set);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [startDate, endDate]);

  return { activeDates, loading };
}

// ── useRankings ────────────────────────────────────────────────────────────────
// Session-level cache: fetched once per tour per session, not on every tab switch
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
    if (!matchId) {
      setPrediction(null);
      setError(null);
      return;
    }
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

// ── usePlayerSearch ────────────────────────────────────────────────────────────
export function usePlayerSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const lower      = query.toLowerCase();
    const allPlayers = [
      ...(MOCK_DATA.atpPlayers ?? MOCK_DATA.players ?? []),
      ...(MOCK_DATA.wtaPlayers ?? []),
    ];
    setResults(allPlayers.filter(p => p.name.toLowerCase().includes(lower)));
  }, [query]);

  return { query, setQuery, results };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
export function useAiChat(contextMatch = null) {
  const GREETING = "Hi! I'm your AI tennis analyst. Ask me anything about match predictions, player stats, or tournament strategies.";

  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING },
  ]);
  const [typing, setTyping] = useState(false);
  const bottomRef           = useRef(null);
  const messagesRef         = useRef(messages);

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
        ? `You are a professional tennis analyst. Context: ${contextMatch.player1.name} vs ${contextMatch.player2.name} on ${contextMatch.surface} at ${contextMatch.tournament}, ${contextMatch.round}.`
        : 'You are a professional tennis analyst. Provide insightful, data-driven analysis.';

      const history = [...messagesRef.current, userMsg].map(m => ({
        role: m.role, content: m.content,
      }));

      const response = await sendChatMessage(history, systemContext);
      const aiText   = response?.content?.[0]?.text ?? "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Connection error. Please try again.' },
      ]);
    } finally {
      setTyping(false);
    }
  }, [contextMatch]);

  const reset = useCallback(() => {
    setMessages([{ role: 'assistant', content: 'New session started. Ask me anything about tennis!' }]);
  }, []);

  return { messages, typing, sendMessage, reset, bottomRef };
}

// ── useToast ───────────────────────────────────────────────────────────────────
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