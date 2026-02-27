// ─────────────────────────────────────────────────────────────────────────────
// hooks.js  –  TennisVantage custom React hooks
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getPrediction, sendChatMessage, MOCK_DATA,
} from '../services/tennisApi';

// ── useMatches: fetches live + upcoming, auto-polls live every 30s ────────────
export function useMatches() {
  const [live,     setLive]     = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const intervalRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [liveData, upcomingData] = await Promise.all([getLiveMatches(), getUpcomingMatches()]);
      setLive(liveData);
      setUpcoming(upcomingData);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Poll live matches every 30 seconds
    intervalRef.current = setInterval(() => {
      getLiveMatches().then(setLive).catch(() => {});
    }, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  return { live, upcoming, loading, error, refresh: fetchAll };
}

// ── useRankings ────────────────────────────────────────────────────────────────
export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    setLoading(true);
    getRankings(tour)
      .then(data => { setRankings(data); setError(null); })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false));
  }, [tour]);

  return { rankings, loading, error };
}

// ── usePrediction ─────────────────────────────────────────────────────────────
export function usePrediction(match) {
  const [prediction, setPrediction] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!match) { setPrediction(null); return; }
    setLoading(true);
    getPrediction(match)
      .then(data => { setPrediction(data); setError(null); })
      .catch(e   => setError(e.message))
      .finally(() => setLoading(false));
  }, [match?.id]);

  return { prediction, loading, error };
}

// ── usePlayerSearch ────────────────────────────────────────────────────────────
export function usePlayerSearch() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const lower = query.toLowerCase();
    setResults(MOCK_DATA.players.filter(p => p.name.toLowerCase().includes(lower)));
  }, [query]);

  return { query, setQuery, results };
}

// ── useAiChat ─────────────────────────────────────────────────────────────────
// AI Integration Prep — swap sendChatMessage in tennisApi.js for a real model
export function useAiChat(contextMatch = null) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your AI tennis analyst. Ask me anything about match predictions, player stats, or tournament strategies.' },
  ]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      // Build context-enriched message history
      const systemContext = contextMatch
        ? `Context: ${contextMatch.player1.name} vs ${contextMatch.player2.name} on ${contextMatch.surface} at ${contextMatch.tournament}.`
        : 'Context: General tennis analysis assistant.';

      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(history, systemContext);
      const aiText = response?.content?.[0]?.text ?? 'Sorry, I couldn\'t process that.';
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setTyping(false);
    }
  }, [messages, contextMatch]);

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

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return { toasts, show, dismiss };
}
