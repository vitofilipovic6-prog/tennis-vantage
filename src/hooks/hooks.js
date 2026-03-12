// src/hooks/hooks.js
// KEY CHANGE: detectTour now reads match.tour directly from the DB field.
// The old name-string heuristic is kept only as a last-resort fallback.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getMatchesByDate, getPrediction, sendChatMessage, MOCK_DATA,
} from '../services/tennisApi';
import { supabase } from '../services/supabase';

export const CHAT_MAX_CHARS = 500;

// ── Tour detection ────────────────────────────────────────────────────────────
// PRIMARY: read the `tour` field that sync-matches stores in the DB.
// FALLBACK: name heuristic for any rows that predate the migration.
export function detectTour(tournamentNameOrMatch) {
  // If called with a full match object, prefer the DB field
  if (tournamentNameOrMatch && typeof tournamentNameOrMatch === 'object') {
    if (tournamentNameOrMatch.tour === 'WTA') return 'WTA';
    if (tournamentNameOrMatch.tour === 'ATP') return 'ATP';
    // Fall through to name heuristic using the tournament string
    return detectTour(tournamentNameOrMatch.tournament ?? '');
  }

  // String fallback (legacy / defensive)
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
let activeDatesCache = null;
let activeDatesCacheTime = 0;
const ACTIVE_DATES_TTL = 5 * 60 * 1000; // 5 minutes

export function useActiveDates(startDate, endDate) {
  const isStale = Date.now() - activeDatesCacheTime > ACTIVE_DATES_TTL;

  const [activeDates, setActiveDates] = useState(
    (activeDatesCache && !isStale) ? activeDatesCache : new Set()
  );
  const [loading, setLoading] = useState(!activeDatesCache || isStale);

  useEffect(() => {
    const now = Date.now();
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

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const lower      = query.toLowerCase();
    const allPlayers = [
      ...(MOCK_DATA.players ?? []),
      ...(MOCK_DATA.wtaPlayers ?? []),
    ];
    setResults(allPlayers.filter(p => p.name.toLowerCase().includes(lower)));
  }, [query]);

  return { query, setQuery, results };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
export function useAiChat(contextMatch = null) {
  const GREETING = "Hi! I'm your AI tennis analyst. Ask me anything about match predictions, player stats, or tournament strategies.";

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
        ? `You are a professional tennis analyst. Context: ${contextMatch.player1.name} vs ${contextMatch.player2.name} on ${contextMatch.surface} at ${contextMatch.tournament}, ${contextMatch.round}.`
        : 'You are a professional tennis analyst. Provide insightful, data-driven analysis.';

      const history  = [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(history, systemContext);
      const aiText   = response?.content?.[0]?.text ?? "Sorry, I couldn't process that.";
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