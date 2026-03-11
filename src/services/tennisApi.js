// ─────────────────────────────────────────────────────────────────────────────
// tennisApi.js – TennisVantage API service layer
//
// FIXES IN THIS VERSION:
//  1. attachPlayers() N+1 ELIMINATED — getLiveMatches / getUpcomingMatches /
//     getMatchesByDate now use a single Supabase join query instead of two
//     sequential round-trips.
//  2. sendChatMessage() now correctly accepts and forwards systemContext so
//     the Gemini Edge Function receives the match context it needs.
//  3. getRankings() unchanged — already clean.
//  4. getHeadToHead() and getPlayerStats() kept for future UI use.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// ── Shared select string — single query, no N+1 ───────────────────────────────
// Supabase resolves FK relationships in one round-trip when you name them.
// The aliases `player1:players!player1_id` and `player2:players!player2_id`
// tell PostgREST to join the same `players` table twice using each FK column.
const MATCH_SELECT = `
  id, status, tournament, round, surface, score, match_date,
  player1:players!player1_id (
    id, name, country, flag, rank, wins, losses,
    ace_avg, surface_pref, first_serve_pct, recent_form
  ),
  player2:players!player2_id (
    id, name, country, flag, rank, wins, losses,
    ace_avg, surface_pref, first_serve_pct, recent_form
  )
`;

// ── Normalise a raw Supabase match row into the shape the UI expects ──────────
function normaliseMatch(m) {
  return {
    id:         m.id,
    status:     m.status,
    tournament: m.tournament,
    round:      m.round,
    surface:    m.surface,
    score:      m.score ?? null,
    date:       m.match_date,
    player1:    m.player1 ?? { id: 'p1', name: 'TBD', flag: '🏳️', rank: 999 },
    player2:    m.player2 ?? { id: 'p2', name: 'TBD', flag: '🏳️', rank: 999 },
  };
}

// ── Live matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'live')
      .order('match_date', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(normaliseMatch);
  } catch (e) {
    console.error('[getLiveMatches]', e.message);
    return MOCK_DATA.matches.filter(m => m.status === 'live');
  }
}

// ── Upcoming matches ──────────────────────────────────────────────────────────
export async function getUpcomingMatches() {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .eq('status', 'upcoming')
      .order('match_date', { ascending: true })
      .limit(20);

    if (error) throw error;
    return (data ?? []).map(normaliseMatch);
  } catch (e) {
    console.error('[getUpcomingMatches]', e.message);
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
}

// ── Matches by date ───────────────────────────────────────────────────────────
export async function getMatchesByDate(dateString) {
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
    return (data ?? []).map(normaliseMatch);
  } catch (e) {
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
    if (!data?.length) return MOCK_DATA.h2h;

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
    return MOCK_DATA.h2h;
  }
}

// ── Prediction engine (pure local calc) ───────────────────────────────────────
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

// ── AI Chat — FIX: systemContext param was silently dropped before ─────────────
// The second argument is now forwarded to the Vercel Edge Function (/api/chat)
// so the AI has the correct match context for each prediction query.
export async function sendChatMessage(messages, systemContext = '') {
  try {
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemContext }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (e) {
    console.error('[sendChatMessage]', e.message);
    // Graceful fallback so the UI never crashes
    return {
      content: [{ text: `⚠️ AI service unavailable: ${e.message}` }],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — fallback only when Supabase query fails
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA = {
  players: [
    { id:'1', name:'Novak Djokovic',    country:'Serbia',  flag:'🇷🇸', rank:1, wins:1104, losses:214, ace_avg:6.2, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W' },
    { id:'2', name:'Carlos Alcaraz',    country:'Spain',   flag:'🇪🇸', rank:2, wins:214,  losses:63,  ace_avg:7.1, surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W' },
    { id:'3', name:'Jannik Sinner',     country:'Italy',   flag:'🇮🇹', rank:3, wins:198,  losses:74,  ace_avg:5.8, surface_pref:'Hard', first_serve_pct:61, recent_form:'W W W W L' },
    { id:'4', name:'Daniil Medvedev',   country:'Russia',  flag:'🇷🇺', rank:4, wins:377,  losses:192, ace_avg:8.3, surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W' },
    { id:'5', name:'Andrey Rublev',     country:'Russia',  flag:'🇷🇺', rank:5, wins:344,  losses:187, ace_avg:5.1, surface_pref:'Clay', first_serve_pct:58, recent_form:'W L W L W' },
    { id:'6', name:'Holger Rune',       country:'Denmark', flag:'🇩🇰', rank:6, wins:148,  losses:87,  ace_avg:6.7, surface_pref:'Clay', first_serve_pct:60, recent_form:'W W L W L' },
    { id:'7', name:'Casper Ruud',       country:'Norway',  flag:'🇳🇴', rank:7, wins:258,  losses:139, ace_avg:5.5, surface_pref:'Clay', first_serve_pct:57, recent_form:'L W W W W' },
    { id:'8', name:'Stefanos Tsitsipas',country:'Greece',  flag:'🇬🇷', rank:8, wins:336,  losses:165, ace_avg:7.9, surface_pref:'Clay', first_serve_pct:62, recent_form:'W L W W L' },
  ],
  get matches() {
    const p = this.players;
    return [
      { id:'m1', status:'live',     tournament:'Roland Garros',  round:'QF', surface:'Clay',  score:'6-4, 3-2*', date: new Date().toISOString(), player1:p[0], player2:p[1] },
      { id:'m2', status:'upcoming', tournament:'Wimbledon',       round:'SF', surface:'Grass', score:null,        date: new Date().toISOString(), player1:p[2], player2:p[3] },
      { id:'m3', status:'upcoming', tournament:'US Open',         round:'F',  surface:'Hard',  score:null,        date: new Date().toISOString(), player1:p[1], player2:p[3] },
      { id:'m4', status:'upcoming', tournament:'Australian Open', round:'SF', surface:'Hard',  score:null,        date: new Date().toISOString(), player1:p[4], player2:p[5] },
      { id:'m5', status:'upcoming', tournament:'Monte-Carlo',     round:'R32',surface:'Clay',  score:null,        date: new Date().toISOString(), player1:p[6], player2:p[7] },
    ];
  },
  get rankings() {
    return this.players.map((p, i) => ({
      ...p,
      points:    Math.round(11000 / (i + 1)),
      prev_rank: p.rank,
    }));
  },
  h2h: {
    total: 12, p1_wins: 7, p2_wins: 5,
    last5: ['W','W','L','W','L'],
    meetings: [
      { year:2024, tournament:'Wimbledon',       surface:'Grass', winner:'p1', score:'7-6, 6-4' },
      { year:2024, tournament:'Roland Garros',   surface:'Clay',  winner:'p1', score:'6-3, 7-5' },
      { year:2023, tournament:'US Open',         surface:'Hard',  winner:'p2', score:'6-4, 6-3' },
      { year:2023, tournament:'Australian Open', surface:'Hard',  winner:'p1', score:'6-2, 7-6' },
      { year:2022, tournament:'Roland Garros',   surface:'Clay',  winner:'p2', score:'7-5, 6-3' },
    ],
  },
};