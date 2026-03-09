// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/hooks.js – TennisVantage Custom React Hooks
//
// Key upgrades vs original:
//  • useMatches: Supabase Realtime WebSocket replaces setInterval polling.
//    Live score updates push instantly to the UI with zero wasted requests.
//  • useRankings: Added tour toggle + staleTime (5 min) to prevent redundant
//    re-fetches when switching tabs.
//  • usePrediction: Feeds the upgraded multi-factor engine in tennisApi.js.
//  • useAiChat: Fully wired to the Supabase Edge Function proxy (Task 4 ready).
// ─────────────────────────────────────────────────────────────────────────────
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

// ── useMatches ────────────────────────────────────────────────────────────────
// Fetches live + upcoming on mount. Live matches stay fresh via Supabase
// Realtime — any DB row change pushes immediately through the WebSocket.
// No polling interval needed.
export function useMatches() {
  const [live,     setLive]     = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Initial fetch (both live + upcoming in parallel — eliminates waterfall)
  const fetchAll = useCallback(async () => {
    setLoading(true);
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

    // ── Supabase Realtime: subscribe to ALL changes on matches table ──────
    // When sync-matches Edge Function upserts a row, the browser gets pushed
    // the update instantly — no 30s polling lag.
    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        async (payload) => {
          // A match changed — re-fetch both lists to stay consistent.
          // We avoid surgical state patching here because the match row
          // doesn't embed player objects (they come via JOIN on SELECT).
          try {
            const [liveData, upcomingData] = await Promise.all([
              getLiveMatches(),
              getUpcomingMatches(),
            ]);
            setLive(liveData);
            setUpcoming(upcomingData);
          } catch {
            // Silently ignore realtime refresh errors — initial data still shows
          }
        }
      )
      .subscribe();

    // Cleanup: unsubscribe when component unmounts
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { live, upcoming, loading, error, refresh: fetchAll };
}

// ── useMatchesByDate (for Prediction Calendar — Task 3) ───────────────────────
// Returns matches for a specific calendar date.
export function useMatchesByDate(dateString) {
  const [matches,  setMatches]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!dateString) { setMatches([]); return; }
    setLoading(true);
    getMatchesByDate(dateString)
      .then(data => { setMatches(data); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [dateString]);

  return { matches, loading, error };
}

// ── useRankings ───────────────────────────────────────────────────────────────
// staleTime: 5 minutes — data fetched within that window is reused,
// preventing unnecessary Supabase reads when the user switches tabs quickly.
const rankingsCache = { ATP: null, WTA: null, fetchedAt: {} };

export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000; // 5 minutes
    const now      = Date.now();
    const lastFetch = rankingsCache.fetchedAt[tour] ?? 0;

    // Return cached data if fresh enough
    if (rankingsCache[tour] && (now - lastFetch) < STALE_MS) {
      setRankings(rankingsCache[tour]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getRankings(tour)
      .then(data => {
        rankingsCache[tour] = data;
        rankingsCache.fetchedAt[tour] = Date.now();
        setRankings(data);
        setError(null);
      })
      .catch(e => setError(e.message ?? 'Failed to load rankings'))
      .finally(() => setLoading(false));
  }, [tour]);

  return { rankings, loading, error };
}

// ── usePrediction ─────────────────────────────────────────────────────────────
// Calls the upgraded multi-factor engine. Results are memoized by match.id
// so switching back to an already-computed match is instant.
const predictionCache = new Map();

export function usePrediction(match) {
  const [prediction, setPrediction] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!match?.id) { setPrediction(null); return; }

    // Return cached prediction if available
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
// Searches the players table in Supabase. Falls back to MOCK_DATA.
export function usePlayerSearch() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }

    // Debounce 300ms to avoid spamming Supabase on every keystroke
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, country, flag, rank')
        .ilike('name', `%${query}%`)
        .limit(8);

      if (data && data.length > 0) {
        setResults(data);
      } else {
        // Fallback to mock while DB is empty
        const lower = query.toLowerCase();
        setResults(MOCK_DATA.players.filter(p => p.name.toLowerCase().includes(lower)));
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return { query, setQuery, results };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
// Sends message history + match context to the Supabase Edge Function /chat.
// The Edge Function builds the Anthropic system prompt with live DB context.
export function useAiChat(contextMatch = null) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "I'm your AI tennis analyst. Ask me about today's matches, player form, predictions — or anything about the game.",
    },
  ]);
  const [typing,    setTyping]   = useState(false);
  const bottomRef                = useRef(null);

  // Auto-scroll to latest message
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

      // Include full history so the AI has conversation context
      const history = [...messages, userMsg].map(m => ({
        role:    m.role,
        content: m.content,
      }));

      const response = await sendChatMessage(history, systemContext);

      // Handle both streaming and non-streaming response shapes
      const aiText =
        response?.content?.[0]?.text ??
        response?.text ??
        "Sorry, I couldn't process that. Please try again.";

      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (err) {
      console.error('[useAiChat] sendMessage error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection issue — please try again in a moment.' },
      ]);
    } finally {
      setTyping(false);
    }
  }, [messages, contextMatch]);

  const reset = useCallback(() => {
    setMessages([{
      role: 'assistant',
      content: "Fresh session. What would you like to analyse?",
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