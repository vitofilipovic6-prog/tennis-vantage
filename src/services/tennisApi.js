// ─────────────────────────────────────────────────────────────────────────────
// src/services/tennisApi.js – TennisVantage API service layer
//
// CHANGES IN THIS VERSION (on top of actual GitHub repo):
//  + deriveMatchType() — client-side safety net that re-derives match_type
//    from actual player names + tournament, overriding any DB mistakes.
//    Slash in name = doubles. WTA player id in wtaPlayerIds set = WTA.
//  + normaliseMatch() — calls deriveMatchType so every match leaving this
//    file has the correct type regardless of what the DB stored.
//  + getLiveMatches — AbortError guard + [STALE-LIVE FIX]: .gte('match_date')
//    filter so only matches from the last 6 hours are returned as "live".
//    This prevents yesterday's matches staying live due to Supabase sync lag.
//  + getUpcomingMatches — AbortError guard added
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

// ── Shared select string — single query, no N+1 ───────────────────────────────
const MATCH_SELECT = `
  id, status, tournament, round, surface, score, match_date, match_type,
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
//
// Runs on every match that comes out of Supabase. Uses real player name data
// (slash = doubles) and an optional Set of WTA player IDs from rankings to
// correctly classify any match the DB got wrong.
//
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

  // ── Doubles detection (slash in name is 100% reliable) ────────────────────
  const isDoubles = p1Name.includes('/') || p2Name.includes('/');

  // ── WTA detection ──────────────────────────────────────────────────────────
  const p1IsWta = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player1?.id);
  const p2IsWta = wtaPlayerIds.size > 0 && wtaPlayerIds.has(m.player2?.id);
  const isWtaByRankings = p1IsWta || p2IsWta;

  const isWtaByTournament =
    tournament.includes('wta') ||
    tournament.includes('women') ||
    tournament.includes('ladies');

  const isWtaByStored =
    stored === 'wta_singles' || stored === 'wta_doubles';

  const isMixedByStored = stored === 'mixed_doubles';

  const isWta = isWtaByRankings || isWtaByTournament || isWtaByStored;

  // ── Resolve final type ─────────────────────────────────────────────────────
  if (isDoubles) {
    if (isMixedByStored) return 'mixed_doubles';
    if (isWta)           return 'wta_doubles';
    return 'atp_doubles';
  }

  if (isWta) return 'wta_singles';
  return stored; // trust DB for ATP singles / mixed that aren't doubles
}

// ── Normalise a raw Supabase match row into the shape the UI expects ──────────
function normaliseMatch(m, wtaPlayerIds = new Set()) {
  const base = {
    id:         m.id,
    status:     m.status,
    tournament: m.tournament,
    round:      m.round,
    surface:    m.surface,
    score:      m.score ?? null,
    date:       m.match_date,
    match_type: m.match_type ?? 'atp_singles',
    winner_id:  m.winner_id ?? null,
    player1:    m.player1 ?? { id: 'p1', name: 'TBD', flag: '🏳️', rank: 999 },
    player2:    m.player2 ?? { id: 'p2', name: 'TBD', flag: '🏳️', rank: 999 },
  };

  // Re-derive match_type as a safety net over whatever the DB stored
  base.match_type = deriveMatchType(base, wtaPlayerIds);
  return base;
}

// ── Live matches ──────────────────────────────────────────────────────────────
// [STALE-LIVE FIX] .gte('match_date', sixHoursAgo) ensures only matches
// started in the last 6 hours are returned. Prevents yesterday's "live"
// rows from reappearing after a Supabase sync lag.
export async function getLiveMatches(wtaPlayerIds = new Set()) {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'live')
      .gte('match_date', sixHoursAgo)
      .order('match_date', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getLiveMatches]', e.message);
    return MOCK_DATA.matches.filter(m => m.status === 'live');
  }
}

// ── Upcoming matches ──────────────────────────────────────────────────────────
export async function getUpcomingMatches(wtaPlayerIds = new Set()) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'upcoming')
      .order('match_date', { ascending: true })
      .limit(50);

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getUpcomingMatches]', e.message);
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
}

// ── Matches by date ───────────────────────────────────────────────────────────
export async function getMatchesByDate(dateString, wtaPlayerIds = new Set()) {
  try {
    const start = `${dateString}T00:00:00.000Z`;
    const end   = `${dateString}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .gte('match_date', start)
      .lte('match_date', end)
      .order('match_date', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(m => normaliseMatch(m, wtaPlayerIds));
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    console.error('[getMatchesByDate]', e.message);
    return MOCK_DATA.matches;
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
    return MOCK_DATA.rankings;
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
    return MOCK_DATA.players.find(p => p.id === playerId) ?? null;
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
      `Surface advantage: ${match.surface === p1.surface_pref ? p1.name : match.surface === p2.surface_pref ? p2.name : 'Neutral'}`,
      `Recent form: ${p1.recent_form ?? '---'} vs ${p2.recent_form ?? '---'}`,
    ],
  };
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
export async function sendChatMessage(messages, systemContext = '') {
  const response = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages, systemContext }),
  });
  if (!response.ok) throw new Error(`Chat API error: ${response.status}`);
  return response.json();
}

// ── Mock data (fallback when Supabase is unavailable) ─────────────────────────
export const MOCK_DATA = {
  get players() {
    return [
      { id:'p1', name:'Carlos Alcaraz',    flag:'🇪🇸', country:'ESP', rank:1,  wins:45, losses:8,  ace_avg:6.2, surface_pref:'Clay', first_serve_pct:68, recent_form:'W W W L W' },
      { id:'p2', name:'Novak Djokovic',    flag:'🇷🇸', country:'SRB', rank:2,  wins:42, losses:9,  ace_avg:5.8, surface_pref:'Hard', first_serve_pct:65, recent_form:'W L W W W' },
      { id:'p3', name:'Jannik Sinner',     flag:'🇮🇹', country:'ITA', rank:3,  wins:48, losses:7,  ace_avg:5.1, surface_pref:'Hard', first_serve_pct:67, recent_form:'W W W W L' },
      { id:'p4', name:'Alexander Zverev',  flag:'🇩🇪', country:'GER', rank:4,  wins:38, losses:12, ace_avg:7.4, surface_pref:'Clay', first_serve_pct:62, recent_form:'L W W L W' },
      { id:'p5', name:'Daniil Medvedev',   flag:'🇷🇺', country:'RUS', rank:5,  wins:36, losses:13, ace_avg:4.9, surface_pref:'Hard', first_serve_pct:64, recent_form:'W W L W W' },
      { id:'p6', name:'Andrey Rublev',     flag:'🇷🇺', country:'RUS', rank:6,  wins:32, losses:14, ace_avg:4.5, surface_pref:'Hard', first_serve_pct:61, recent_form:'L L W W W' },
      { id:'p7', name:'Holger Rune',       flag:'🇩🇰', country:'DEN', rank:7,  wins:29, losses:15, ace_avg:5.6, surface_pref:'Clay', first_serve_pct:63, recent_form:'W L W W L' },
      { id:'p8', name:'Stefanos Tsitsipas',flag:'🇬🇷', country:'GRE', rank:8,  wins:31, losses:16, ace_avg:5.3, surface_pref:'Clay', first_serve_pct:63, recent_form:'W W L W L' },
    ];
  },
  get matches() {
    const p = this.players;
    return [
      { id:'m1', status:'live',     match_type:'atp_singles', tournament:'Indian Wells', round:'QF', surface:'Hard', score:'6-4, 3-2', winner_id:null, date:new Date().toISOString(),                    player1:p[0], player2:p[2] },
      { id:'m2', status:'live',     match_type:'atp_singles', tournament:'Indian Wells', round:'QF', surface:'Hard', score:'7-6, 2-1', winner_id:null, date:new Date().toISOString(),                    player1:p[1], player2:p[3] },
      { id:'m3', status:'upcoming', match_type:'atp_singles', tournament:'Miami Open',   round:'R2', surface:'Hard', score:null,        winner_id:null, date:new Date(Date.now()+86400000).toISOString(), player1:p[1], player2:p[3] },
      { id:'m4', status:'upcoming', match_type:'atp_singles', tournament:'Miami Open',   round:'SF', surface:'Hard', score:null,        winner_id:null, date:new Date(Date.now()+86400000).toISOString(), player1:p[4], player2:p[5] },
      { id:'m5', status:'upcoming', match_type:'atp_singles', tournament:'Monte-Carlo',  round:'R32',surface:'Clay', score:null,        winner_id:null, date:new Date(Date.now()+172800000).toISOString(), player1:p[6], player2:p[7] },
    ];
  },
  get rankings() {
    return this.players.map((p, i) => ({
      ...p,
      points:    Math.round(11000 / (i + 1)),
      prev_rank: p.rank,
    }));
  },
};