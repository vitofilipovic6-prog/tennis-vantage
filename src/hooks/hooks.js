// src/hooks/hooks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getPrediction, sendChatMessage, MOCK_DATA,
} from '../services/tennisApi';

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
    intervalRef.current = setInterval(() => {
      getLiveMatches().then(setLive).catch(() => {});
    }, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  return { live, upcoming, loading, error, refresh: fetchAll };
}

// ── useRankings ───────────────────────────────────────────────────────────────
export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRankings([]);
    getRankings(tour)
      .then(data  => { if (!cancelled) { setRankings(data); setError(null); } })
      .catch(e    => { if (!cancelled) setError(e.message ?? 'Failed to load rankings'); })
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
// FIX: was referencing MOCK_DATA.atpPlayers / MOCK_DATA.wtaPlayers
//      which don't exist → always returned empty results.
//      Correct property names are MOCK_DATA.rankings and MOCK_DATA.rankingsWTA.
export function usePlayerSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const lower     = query.toLowerCase();
    const allPlayers = [
      ...(MOCK_DATA.rankings    ?? []),   // ← fixed: was MOCK_DATA.atpPlayers
      ...(MOCK_DATA.rankingsWTA ?? []),   // ← fixed: was MOCK_DATA.wtaPlayers
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