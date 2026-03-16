// src/services/tennisApi.js
import { supabase } from './supabase';

const MATCH_SELECT = `
  id, status, tournament, round, surface, score, match_date, local_date, match_type, winner_id,
  player1:players!player1_id (
    id, name, country, flag, rank, wins, losses,
    ace_avg, surface_pref, first_serve_pct, recent_form
  ),
  player2:players!player2_id (
    id, name, country, flag, rank, wins, losses,
    ace_avg, surface_pref, first_serve_pct, recent_form
  )
`;

export function deriveMatchType(m, wtaPlayerIds = new Set()) {
  const p1Name     = m.player1?.name ?? '';
  const p2Name     = m.player2?.name ?? '';
  const tournament = (m.tournament ?? '').toLowerCase();
  const stored     = m.match_type ?? 'atp_singles';

  const isDoubles = p1Name.includes('/') || p2Name.includes('/');

  // Trust stored value for ITF and UTR — it was set correctly at sync time
  if (stored.startsWith('itf_') || stored.startsWith('utr_')) return stored;

  // UTR by name (fallback for old rows)
  if (tournament.includes('utr')) {
    const isWomen = tournament.includes('women');
    return isWomen ? 'utr_women_singles' : 'utr_men_singles';
  }

  // ITF by name (fallback for old rows)
  const isItfByName = tournament.includes('itf') ||
    /\bw\d{2}\b/.test(tournament) ||
    /\bm\d{2}\b/.test(tournament);

  if (isItfByName) {
    const isWomen = tournament.includes('women') || /\bw\d{2}\b/.test(tournament);
    if (isDoubles) return isWomen ? 'itf_women_doubles' : 'itf_men_doubles';
    return isWomen ? 'itf_women_singles' : 'itf_men_singles';
  }

  const p1IsWta         = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player1?.id);
  const p2IsWta         = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player2?.id);
  const isWtaByRankings = p1IsWta || p2IsWta;
  const isWtaByTournament = tournament.includes('wta') ||
    tournament.includes('women') || tournament.includes('ladies');
  const isWtaByStored   = stored === 'wta_singles' || stored === 'wta_doubles';
  const isMixedByStored = stored === 'mixed_doubles';
  const isWta = isWtaByRankings || isWtaByTournament || isWtaByStored;

  if (isDoubles) {
    if (isMixedByStored) return 'mixed_doubles';
    if (isWta)           return 'wta_doubles';
    return 'atp_doubles';
  }

  if (isWta) return 'wta_singles';
  return stored;
}

function normaliseMatch(m, wtaPlayerIds = new Set()) {
  const base = {
    id:         m.id,
    status:     m.status,
    tournament: m.tournament,
    round:      m.round,
    surface:    m.surface,
    score:      m.score ?? null,
    date:       m.match_date,
    local_date: m.local_date ?? null,   // ← ADD THIS
    match_type: m.match_type ?? 'atp_singles',
    winner_id:  m.winner_id ?? null,
    player1:    m.player1 ?? { id: 'p1', name: 'TBD', flag: '🏳️', rank: 999 },
    player2:    m.player2 ?? { id: 'p2', name: 'TBD', flag: '🏳️', rank: 999 },
  };
  base.match_type = deriveMatchType(base, wtaPlayerIds);
  return base;
}

// ── Helper: get today's date boundaries in ISO (UTC) ─────────────────────────
// We use a ±12h window to safely capture matches stored with any UTC offset.
// This means a match at 23:00 CEST (21:00 UTC) is ALWAYS in "today".
function getTodayWindow() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  // Use local calendar date string for start/end
  return {
    start: `${year}-${month}-${day}T00:00:00.000Z`,
    end:   `${year}-${month}-${day}T23:59:59.999Z`,
  };
}

// ── Live matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches(wtaPlayerIds = new Set()) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'live')
      .order('match_date', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getLiveMatches]', e.message);
    return [];
  }
}

// ── Upcoming matches ──────────────────────────────────────────────────────────
// FIX: use start-of-today (local) instead of NOW as the cutoff.
// Previously used new Date().toISOString() which cut off matches that started
// earlier today but are still status='upcoming' in the DB (e.g. a 17:00 UTC
// match checked at 20:00 UTC = already past the filter, hidden from UI).
// Now we show all of today's upcoming matches regardless of start time.
export async function getUpcomingMatches(wtaPlayerIds = new Set()) {
  try {
    // Start of today in UTC — keeps all today's matches visible all day
    const now   = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startISO = start.toISOString();

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .in('status', ['upcoming', 'live'])
      .gte('match_date', startISO)
      .order('match_date', { ascending: true })
      .limit(500);

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getUpcomingMatches]', e.message);
    return [];
  }
}

// ── Matches by date (for calendar view) ──────────────────────────────────────
// Uses local_date column if available (set by sync from Europe/Paris TZ).
// Falls back to a ±1 day UTC window + client-side local date filter for any
// rows that predate the local_date migration.
export async function getMatchesByDate(dateString, wtaPlayerIds = new Set()) {
  try {
    // Primary: use local_date column
    const { data: byLocalDate, error: e1 } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('local_date', dateString)
      .order('match_date', { ascending: true });

    if (!e1 && byLocalDate && byLocalDate.length > 0) {
      return byLocalDate.map(m => normaliseMatch(m, wtaPlayerIds));
    }

    // Fallback: ±1 day UTC window + client-side filter
    const d    = new Date(`${dateString}T12:00:00.000Z`);
    const prev = new Date(d); prev.setUTCDate(d.getUTCDate() - 1);
    const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1);

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .gte('match_date', `${prev.toISOString().slice(0, 10)}T00:00:00.000Z`)
      .lte('match_date', `${next.toISOString().slice(0, 10)}T23:59:59.999Z`)
      .order('match_date', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds)).filter(m => {
      if (!m.date) return false;
      if (m.local_date) return m.local_date === dateString;
      return new Date(m.date).toLocaleDateString('en-CA') === dateString;
    });
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getMatchesByDate]', e.message);
    return [];
  }
}

// ── Rankings ──────────────────────────────────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select(`
        rank,
        points,
        prev_rank,
        players (
          id, name, country, flag,
          wins, losses, ace_avg,
          surface_pref, first_serve_pct, recent_form
        )
      `)
      .eq('tour', tour)
      .order('rank', { ascending: true })
      .limit(50);

    if (error) throw error;

    return (data ?? []).map(r => ({
      ...r.players,
      rank:      r.rank,
      points:    r.points,
      prev_rank: r.prev_rank,
    }));
  } catch (e) {
    console.error('[getRankings]', e.message);
    return [];
  }
}

// ── Player stats ──────────────────────────────────────────────────────────────
export async function getPlayerStats(playerId) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('[getPlayerStats]', e.message);
    return null;
  }
}

// ── Head to head ──────────────────────────────────────────────────────────────
export async function getHeadToHead(p1Id, p2Id) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'finished')
      .or(`and(player1_id.eq.${p1Id},player2_id.eq.${p2Id}),and(player1_id.eq.${p2Id},player2_id.eq.${p1Id})`)
      .order('match_date', { ascending: false })
      .limit(10);

    if (error) throw error;
    if (!data?.length) return null;

    const p1Wins = data.filter(m => m.winner_id === p1Id).length;
    const p2Wins = data.filter(m => m.winner_id === p2Id).length;

    return {
      total:    data.length,
      p1_wins:  p1Wins,
      p2_wins:  p2Wins,
      last5:    data.slice(0, 5).map(m => m.winner_id === p1Id ? 'W' : 'L'),
      meetings: data.map(m => ({
        year:       new Date(m.match_date).getFullYear(),
        tournament: m.tournament,
        surface:    m.surface,
        winner:     m.winner_id === p1Id ? 'p1' : 'p2',
        score:      m.score ?? '',
      })),
    };
  } catch (e) {
    console.error('[getHeadToHead]', e.message);
    return null;
  }
}

// ── Prediction engine ─────────────────────────────────────────────────────────
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;
  const rankEdge    = (p2.rank - p1.rank) * 1.2;
  const surfaceEdge = match.surface === p1.surface_pref ? 6
                    : match.surface === p2.surface_pref ? -6 : 0;
  const raw      = 50 + rankEdge + surfaceEdge;
  const p1WinPct = Math.min(88, Math.max(12, Math.round(raw)));

  return {
    player1_win_pct: p1WinPct,
    player2_win_pct: 100 - p1WinPct,
    confidence: Math.abs(p1WinPct - 50) > 20 ? 'High'
              : Math.abs(p1WinPct - 50) > 10 ? 'Medium' : 'Low',
    key_factors: [
      `Ranking: #${p1.rank} vs #${p2.rank}`,
      `Surface advantage: ${
        match.surface === p1.surface_pref ? p1.name
        : match.surface === p2.surface_pref ? p2.name
        : 'Neutral'
      }`,
      `Recent form: ${p1.recent_form ?? '---'} vs ${p2.recent_form ?? '---'}`,
    ],
    predicted_winner: p1WinPct >= 50 ? p1.name : p2.name,
  };
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
// ── AI Chat ───────────────────────────────────────────────────────────────────
export async function sendChatMessage(messages, systemContext = '') {
  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages, systemContext }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat error ${res.status}: ${text.slice(0, 200)}`);
  }
  // Return the full response object so hooks.js can extract content correctly.
  // api/chat.js returns { content: [{ text: "..." }] }
  // hooks.js reads: response?.content?.[0]?.text
  return res.json();
}

// ── Mock data fallback (minimal — only used if ALL queries fail) ──────────────
export const MOCK_DATA = {
  matches:  [],
  players:  [],
  rankings: [],
};