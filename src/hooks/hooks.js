// src/hooks/hooks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLiveMatches, getUpcomingMatches, getRankings,
  getMatchesByDate, getPrediction, sendChatMessage, buildSinglesLookup
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
// Strategy: pure DB reads only — no Edge Function calls from client.
// sync-matches cron (0:00 + 12:00) keeps schedule fresh.
// sync-live cron (every 5 min) keeps status/scores fresh.
// Frontend polls DB every 60s to pick up those changes.
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_MATCHES_KEY = 'tv_matches_cache';
const SESSION_MATCHES_TTL = 5 * 60 * 1000;

function readSessionMatches() {
  try {
    const raw = sessionStorage.getItem(SESSION_MATCHES_KEY);
    if (!raw) return null;
    const { live, upcoming, ts } = JSON.parse(raw);
    if (Date.now() - ts > SESSION_MATCHES_TTL) return null;
    return { live: live ?? [], upcoming: upcoming ?? [] };
  } catch {
    return null;
  }
}

function writeSessionMatches(live, upcoming) {
  try {
    sessionStorage.setItem(SESSION_MATCHES_KEY, JSON.stringify({
      live, upcoming, ts: Date.now(),
    }));
  } catch { }
}

// ── Deduplication helper ──────────────────────────────────────────────────────
// getUpcomingMatches() now queries ['upcoming','live'] so any match already
// promoted to live in Supabase appears in BOTH arrays.
// This removes those duplicates — live always wins over upcoming.
function deduplicateMatches(liveData, upcomingData) {
  const liveIds = new Set(liveData.map(m => m.id));
  const dedupedUpcoming = upcomingData.filter(m => !liveIds.has(m.id));
  return { liveData, dedupedUpcoming };
}

// src/hooks/hooks.js
// Replace the useMatches hook entirely

export function useMatches() {
  const cached = readSessionMatches();

  const [live, setLive] = useState(() => cached?.live ?? []);
  const [upcoming, setUpcoming] = useState(() => {
    if (!cached) return [];
    const liveIds = new Set((cached.live ?? []).map(m => m.id));
    return (cached.upcoming ?? []).filter(m => !liveIds.has(m.id));
  });

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Build singles lookup from DB players for doubles flag enrichment
  // This runs once and is stable — no re-fetching
  const [singlesLookup, setSinglesLookup] = useState(null);

  useEffect(() => {
    supabase
      .from('players')
      .select('id, name, country, flag, rank')
      .not('name', 'is', null)
      .not('name', 'like', '%/%')
      .order('rank', { ascending: true, nullsLast: true })
      .limit(1000)
      .then(({ data }) => {
        if (data?.length) {
          setSinglesLookup(buildSinglesLookup(data));
        }
      })
      .catch(e => console.warn('[useMatches] singles lookup failed:', e.message));
  }, []);

  const fetchAll = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const [liveData, upcomingData] = await Promise.all([
        getLiveMatches(new Set(), singlesLookup),
        getUpcomingMatches(new Set(), singlesLookup),
      ]);

      const { dedupedUpcoming } = deduplicateMatches(liveData, upcomingData);

      setLive(liveData);
      setUpcoming(dedupedUpcoming);
      setError(null);
      writeSessionMatches(liveData, dedupedUpcoming);
    } catch (e) {
      if (!background) setError(e.message ?? 'Failed to load matches');
    } finally {
      if (!background) setLoading(false);
    }
  }, [singlesLookup]);

  // Re-enrich match flags once singlesLookup becomes available
  useEffect(() => {
    if (!singlesLookup) return;
    fetchAll(true);
  }, [singlesLookup]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = useCallback(() => {
    pollRef.current = setInterval(() => {
      if (!document.hidden) fetchAll(true);
    }, 60_000);
  }, [fetchAll]);

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    const cached = readSessionMatches();

    if (cached) {
      const t = setTimeout(() => fetchAll(true), 1000);
      startPolling();
      const handleVisibility = () => {
        if (document.hidden) { stopPolling(); }
        else { fetchAll(true); startPolling(); }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        clearTimeout(t);
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    } else {
      fetchAll(false);
      startPolling();
      const handleVisibility = () => {
        if (document.hidden) { stopPolling(); }
        else { fetchAll(true); startPolling(); }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [fetchAll, startPolling, stopPolling]);

  return { live, upcoming, loading, error, syncing: false, refresh: () => fetchAll(false), singlesLookup, };
}

// ── useMatchesByDate ──────────────────────────────────────────────────────────
const matchDateCache = {};
const MATCH_DATE_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

function getMatchDateCache(dateString) {
  const entry = matchDateCache[dateString];
  if (!entry) return null;
  if (Date.now() - entry.ts > MATCH_DATE_CACHE_TTL) {
    delete matchDateCache[dateString];
    return null;
  }
  return entry.data;
}

function setMatchDateCache(dateString, data) {
  matchDateCache[dateString] = { data, ts: Date.now() };
}

export function useMatchesByDate(dateString) {
  const cached = getMatchDateCache(dateString);
  const [matches, setMatches] = useState(cached ?? null);
  const [loading, setLoading] = useState(!cached && !!dateString);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dateString) return;

    const cached = getMatchDateCache(dateString);
    if (cached) {
      setMatches(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMatchesByDate(dateString)
      .then(data => {
        if (!cancelled) {
          setMatchDateCache(dateString, data);
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
      .then(data => { setMatchDateCache(dateString, data); setMatches(data); })
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

    const toParisDate = (d) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

    const start = startDate instanceof Date ? toParisDate(startDate) : startDate;
    const end = endDate instanceof Date ? toParisDate(endDate) : endDate;

    supabase
      .from('matches')
      .select('local_date')
      .gte('local_date', start)
      .lte('local_date', end)
      .not('local_date', 'is', null)
      .then(({ data }) => {
        const set = new Set((data ?? []).map(r => r.local_date));
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
const rankingsCache = {};

export function useRankings(tour = 'ATP') {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
    ITF_MEN: ['itf_men_singles', 'itf_men_doubles'],
    ITF_WOMEN: ['itf_women_singles', 'itf_women_doubles'],
    UTR_MEN: ['utr_men_singles'],
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

    if (error) {
      console.warn(`[fetchAltRankings:${tour}] query error:`, error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    const playerMap = new Map();
    const winCount = new Map();

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
        rank: i + 1,
        points: winCount.get(p.id) ?? 0,
        prev_rank: null,
      }));

  } catch (e) {
    console.warn(`[fetchAltRankings:${tour}] unexpected error:`, e.message);
    return [];
  }
}

// ── useAllPlayers ─────────────────────────────────────────────────────────────
// Fetches all players from DB for the search modal.
// Cached for 10 minutes — busted on manual refresh.
let allPlayersCache = null;
let allPlayersCacheTime = 0;
const ALL_PLAYERS_TTL = 10 * 60 * 1000;

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
        allPlayersCache = sorted;
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
  const GREETING = "Hi! I'm your AI tennis analyst. Ask me anything about match predictions, player stats, head-to-head records, or surface analysis.";

  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef(messages);
  const lastSentRef = useRef(0);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim()) return;

    // Rate-limit guard: prevent sending more than once every 3 seconds
    const now = Date.now();
    if (now - lastSentRef.current < 3000) return;
    lastSentRef.current = now;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      const systemContext = contextMatch
        ? `Match: ${contextMatch.player1?.name ?? 'Player 1'} (Rank #${contextMatch.player1?.rank ?? '?'}) vs ${contextMatch.player2?.name ?? 'Player 2'} (Rank #${contextMatch.player2?.rank ?? '?'}) on ${contextMatch.surface ?? 'Hard'} at ${contextMatch.tournament ?? 'Unknown'}, ${contextMatch.round ?? ''}. P1 form: ${contextMatch.player1?.recent_form ?? 'N/A'}. P2 form: ${contextMatch.player2?.recent_form ?? 'N/A'}.`
        : '';

      // Cap history to last 10 messages to prevent token bloat
      const history = [...messagesRef.current, userMsg]
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

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
    lastSentRef.current = 0;
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

// ── useEarliestMatchDate ──────────────────────────────────────────────────────
// Fetches the earliest local_date that has matches in the DB
export function useEarliestMatchDate() {
  const [earliestDate, setEarliestDate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('matches')
      .select('local_date')
      .not('local_date', 'is', null)
      .order('local_date', { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data?.[0]?.local_date) {
          const [year, month, day] = data[0].local_date.split('-').map(Number);
          const d = new Date(year, month - 1, day);
          d.setHours(0, 0, 0, 0);
          setEarliestDate(d);
        } else {
          const fallback = new Date();
          fallback.setDate(fallback.getDate() - 30);
          fallback.setHours(0, 0, 0, 0);
          setEarliestDate(fallback);
        }
        setLoading(false);
      })
      .catch(() => {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() - 30);
        fallback.setHours(0, 0, 0, 0);
        setEarliestDate(fallback);
        setLoading(false);
      });
  }, []);

  return { earliestDate, loading };
}