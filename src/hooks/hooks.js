// ─────────────────────────────────────────────────────────────────────────────
// hooks.js – TennisVantage custom React hooks
//
// FIXES IN THIS VERSION:
//  1. useRankings() — rankings are now cached by tour so switching ATP ↔ WTA
//     never re-fetches data already loaded this session.
//  2. useMatches() — live-match poll pauses automatically when the tab/window
//     is not visible (Page Visibility API), saving unnecessary API calls.
//  3. useAiChat() — input is locked while the AI is typing (prevents spam),
//     and messages are capped at 500 chars.
//  4. usePlayerSearch() — MOCK_DATA key fixed from .atpPlayers → .players.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getPrediction, sendChatMessage, MOCK_DATA,
} from '../services/tennisApi';

// ── useMatches ────────────────────────────────────────────────────────────────
// FIX: poll pauses when the browser tab is hidden via Page Visibility API.
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

    // Only poll live scores — don't refetch all upcoming matches on interval
    function startPoll() {
      intervalRef.current = setInterval(() => {
        // Skip poll if user has navigated away from the tab
        if (document.visibilityState === 'hidden') return;
        getLiveMatches()
          .then(setLive)
          .catch(() => {});
      }, 30_000);
    }

    startPoll();

    // Pause/resume poll on tab visibility change
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        // User returned — refresh immediately then restart poll
        getLiveMatches().then(setLive).catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAll]);

  return { live, upcoming, loading, error, refresh: fetchAll };
}

// ── useRankings ───────────────────────────────────────────────────────────────
// FIX: In-memory cache keyed by tour. Once ATP rankings load they are NOT
// re-fetched when the user toggles to WTA and back. Cache lives for the
// lifetime of the session (component unmount doesn't clear it).
const rankingsCache = {};

export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState(rankingsCache[tour] ?? []);
  const [loading, setLoading]   = useState(!rankingsCache[tour]);
  const [error, setError]       = useState(null);

  useEffect(() => {
    // Already cached — render immediately, no fetch needed
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
        if (cancelled) return;
        rankingsCache[tour] = data;   // cache for subsequent visits
        setRankings(data);
        setError(null);
      })
      .catch(e => {
        if (!cancelled) setError(e.message ?? 'Failed to load rankings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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

// ── usePlayerSearch ───────────────────────────────────────────────────────────
// FIX: MOCK_DATA key corrected (.atpPlayers didn't exist → .players)
export function usePlayerSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const lower = query.toLowerCase();
    // MOCK_DATA.players contains all players (ATP + WTA combined in mock)
    const allPlayers = MOCK_DATA.players ?? [];
    setResults(allPlayers.filter(p => p.name.toLowerCase().includes(lower)));
  }, [query]);

  return { query, setQuery, results };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
// FIX: Input locked while typing=true to prevent message spam.
// FIX: Messages capped at MAX_CHARS characters with counter feedback.
export const CHAT_MAX_CHARS = 500;

export function useAiChat(contextMatch = null) {
  const GREETING = "Hi! I'm your AI tennis analyst. Ask me anything about match predictions, player stats, or tournament strategies.";

  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING },
  ]);
  const [typing, setTyping]   = useState(false);
  const bottomRef             = useRef(null);
  const messagesRef           = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim().slice(0, CHAT_MAX_CHARS);
    if (!trimmed) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      const systemContext = contextMatch
        ? `You are a professional tennis analyst. The user is asking about the match: ${contextMatch.player1.name} vs ${contextMatch.player2.name} on ${contextMatch.surface} at ${contextMatch.tournament}, ${contextMatch.round}. Provide specific, data-driven insight about this matchup.`
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
    setMessages([{ role: 'assistant', content: GREETING }]);
  }, []);

  return { messages, typing, sendMessage, reset, bottomRef };
}

// ── useToast ──────────────────────────────────────────────────────────────────
export function useToast(duration = 4000) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const show = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, [duration]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}