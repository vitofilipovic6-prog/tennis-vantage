// src/hooks/hooks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import {
  getLiveMatches,
  getUpcomingMatches,
  getMatchesByDate,
  getRankings,
  getPrediction,
  sendChatMessage,
  MOCK_DATA,
} from '../services/tennisApi';

// ── Module-level cache — survives tab switches, cleared on page refresh ────────
const CACHE = {
  live:     { data: null, ts: 0 },
  upcoming: { data: null, ts: 0 },
  byDate:   new Map(),
  rankings: { ATP: null, WTA: null, ts: { ATP: 0, WTA: 0 } },
};
const STALE = {
  live:     30  * 1000,      // 30 seconds
  upcoming: 5   * 60 * 1000, // 5 minutes
  rankings: 5   * 60 * 1000, // 5 minutes
  byDate:   2   * 60 * 1000, // 2 minutes
};

// ── useMatches ────────────────────────────────────────────────────────────────
export function useMatches() {
  const [live,     setLive]     = useState(CACHE.live.data     ?? []);
  const [upcoming, setUpcoming] = useState(CACHE.upcoming.data ?? []);
  const [loading,  setLoading]  = useState(!CACHE.live.data && !CACHE.upcoming.data);
  const [error,    setError]    = useState(null);

  const fetchAll = useCallback(async (force = false) => {
    const now           = Date.now();
    const liveStale     = now - CACHE.live.ts     > STALE.live;
    const upcomingStale = now - CACHE.upcoming.ts > STALE.upcoming;

    if (!force && !liveStale && !upcomingStale) return;

    setLoading(true);
    try {
      // Both fire simultaneously — no waterfall
      const [liveData, upcomingData] = await Promise.all([
        liveStale     ? getLiveMatches()     : Promise.resolve(CACHE.live.data),
        upcomingStale ? getUpcomingMatches() : Promise.resolve(CACHE.upcoming.data),
      ]);

      if (liveStale)     CACHE.live     = { data: liveData,     ts: now };
      if (upcomingStale) CACHE.upcoming = { data: upcomingData, ts: now };

      setLive(liveData     ?? []);
      setUpcoming(upcomingData ?? []);
      setError(null);
    } catch (e) {
      setError(e.message ?? 'Failed to load matches');
      // Keep showing stale data on error — don't blank the screen
      if (CACHE.live.data)     setLive(CACHE.live.data);
      if (CACHE.upcoming.data) setUpcoming(CACHE.upcoming.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    // Supabase Realtime — pushes live score changes instantly
    const channel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        CACHE.live.ts     = 0;
        CACHE.upcoming.ts = 0;
        fetchAll(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { live, upcoming, loading, error, refresh: () => fetchAll(true) };
}

// ── useMatchesByDate ──────────────────────────────────────────────────────────
export function useMatchesByDate(dateString) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!dateString) { setMatches([]); return; }

    const cached = CACHE.byDate.get(dateString);
    if (cached && Date.now() - cached.ts < STALE.byDate) {
      setMatches(cached.data);
      return;
    }

    setLoading(true);
    getMatchesByDate(dateString)
      .then(data => {
        CACHE.byDate.set(dateString, { data, ts: Date.now() });
        setMatches(data);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [dateString]);

  return { matches, loading, error };
}

// ── useRankings ───────────────────────────────────────────────────────────────
export function useRankings(tour = 'ATP') {
  const cached = CACHE.rankings[tour];
  const [rankings, setRankings] = useState(cached ?? []);
  const [loading,  setLoading]  = useState(!cached);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const now       = Date.now();
    const lastFetch = CACHE.rankings.ts[tour] ?? 0;

    if (cached && (now - lastFetch) < STALE.rankings) {
      setRankings(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    getRankings(tour)
      .then(data => {
        CACHE.rankings[tour]    = data;
        CACHE.rankings.ts[tour] = Date.now();
        setRankings(data);
        setError(null);
      })
      .catch(e => setError(e.message ?? 'Failed to load rankings'))
      .finally(() => setLoading(false));
  }, [tour]);

  return { rankings, loading, error };
}

// ── usePrediction ─────────────────────────────────────────────────────────────
const predictionCache = new Map();

export function usePrediction(match) {
  const [prediction, setPrediction] = useState(predictionCache.get(match?.id) ?? null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!match?.id) { setPrediction(null); return; }
    if (predictionCache.has(match.id)) {
      setPrediction(predictionCache.get(match.id));
      return;
    }
    setLoading(true);
    getPrediction(match)
      .then(data => {
        predictionCache.set(match.id, data);
        setPrediction(data);
        setError(null);
      })
      .catch(e => setError(e.message ?? 'Prediction failed'))
      .finally(() => setLoading(false));
  }, [match?.id]);

  return { prediction, loading, error };
}

// ── usePlayerSearch ───────────────────────────────────────────────────────────
export function usePlayerSearch() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, country, flag, rank')
        .ilike('name', `%${query}%`)
        .limit(8);
      if (data?.length > 0) {
        setResults(data);
      } else {
        const lower = query.toLowerCase();
        setResults(MOCK_DATA.players.filter(p => p.name.toLowerCase().includes(lower)));
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return { query, setQuery, results };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
export function useAiChat(contextMatch = null) {
  const [messages, setMessages] = useState([{
    role:    'assistant',
    content: "I'm your AI tennis analyst. Ask me about today's matches, player form, predictions — or anything about the game.",
  }]);
  const [typing,  setTyping]  = useState(false);
  const bottomRef             = useRef(null);

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
        ? `Active match context: ${contextMatch.player1?.name ?? '?'} vs ${contextMatch.player2?.name ?? '?'} — ${contextMatch.surface} at ${contextMatch.tournament} (${contextMatch.round}).`
        : 'No specific match selected. General tennis analysis mode.';

      const history = [...messages, userMsg].map(m => ({
        role:    m.role,
        content: m.content,
      }));

      const response = await sendChatMessage(history, systemContext);
      const aiText   =
        response?.content?.[0]?.text ??
        response?.text ??
        "Sorry, I couldn't process that. Please try again.";

      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Connection issue — please try again in a moment.',
      }]);
    } finally {
      setTyping(false);
    }
  }, [messages, contextMatch]);

  const reset = useCallback(() => {
    setMessages([{
      role:    'assistant',
      content: 'Fresh session. What would you like to analyse?',
    }]);
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

  const dismiss = useCallback(
    (id) => setToasts(prev => prev.filter(t => t.id !== id)),
    []
  );

  return { toasts, show, dismiss };
}