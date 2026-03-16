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

// ─────────────────────────────────────────────────────────────────────────────
// deriveMatchType — CLIENT-SIDE safety net
// Priority order:
//  1. Slash in player name  → doubles branch
//  2. wtaPlayerIds Set      → WTA (most reliable for combined events)
//  3. Tournament name       → WTA keyword check
//  4. stored match_type     → trust the DB as final fallback
// ─────────────────────────────────────────────────────────────────────────────
export function deriveMatchType(m, wtaPlayerIds = new Set()) {
  const p1Name     = m.player1?.name ?? '';
  const p2Name     = m.player2?.name ?? '';
  const tournament = (m.tournament ?? '').toLowerCase();
  const stored     = m.match_type ?? 'atp_singles';

  const isDoubles = p1Name.includes('/') || p2Name.includes('/');

  const p1IsWta         = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player1?.id);
  const p2IsWta         = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player2?.id);
  const isWtaByRankings = p1IsWta || p2IsWta;

  const isWtaByTournament =
    tournament.includes('wta') ||
    tournament.includes('women') ||
    tournament.includes('ladies');

  const isWtaByStored   = stored === 'wta_singles' || stored === 'wta_doubles';
  const isMixedByStored = stored === 'mixed_doubles';
  const isWta           = isWtaByRankings || isWtaByTournament || isWtaByStored;

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
// Fetches:
//  - All 'upcoming' matches from NOW onwards (future + today's unstarted)
//  - All 'live' matches (belt-and-suspenders; live hook also gets these)
// This is used for the Predictions tab match picker.
export async function getUpcomingMatches(wtaPlayerIds = new Set()) {
  try {
    const nowISO = new Date().toISOString();

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .in('status', ['upcoming', 'live'])
      .gte('match_date', nowISO)          // only future/current matches
      .order('match_date', { ascending: true })
      .limit(60);

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getUpcomingMatches]', e.message);
    return [];
  }
}

// ── Matches by date (for calendar view) ───────────────────────────────────────
// Uses local_date column (Europe/Paris timezone) stored at sync time.
// A match starting 22:00 CEST has local_date = that same day, even if
// match_date UTC is the next calendar day. No client-side timezone math needed.
export async function getMatchesByDate(dateString, wtaPlayerIds = new Set()) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('local_date', dateString)
      .order('match_date', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
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
export async function sendChatMessage(messages) {
  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.reply ?? data.content ?? '';
}

// ── Mock data fallback (minimal — only used if ALL queries fail) ──────────────
export const MOCK_DATA = {
  matches:  [],
  players:  [],
  rankings: [],
};