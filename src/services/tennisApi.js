// ─────────────────────────────────────────────────────────────────────────────
// tennisApi.js – TennisVantage API service layer
// Reads from Supabase tables populated by sync-matches + sync-rankings Edge Fns
//
// FIXES APPLIED:
//  1. Removed duplicate `createClient` call — now imports the singleton from
//     supabase.js. Two instances caused auth-session desync issues.
//  2. sendChatMessage() now accepts + forwards `systemContext` to the
//     Supabase Edge Function `ai-chat`. The second argument was silently
//     dropped before, so the AI had zero context about the match.
//  3. MOCK_DATA was missing `matches` and `rankings` arrays. getLiveMatches(),
//     getUpcomingMatches(), and getRankings() all called `.filter()` /
//     direct access on `undefined`, causing runtime crashes when Supabase
//     was unreachable. Both arrays are now fully defined.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';   // FIX 1: use the singleton

// ── Helper: join player data onto a match row ─────────────────────────────────
async function attachPlayers(matches) {
  if (!matches.length) return [];

  const ids = [...new Set(matches.flatMap(m => [m.player1_id, m.player2_id]))];
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .in('id', ids);

  const map = Object.fromEntries((players ?? []).map(p => [p.id, p]));

  return matches.map(m => ({
    id:         m.id,
    status:     m.status,
    tournament: m.tournament,
    round:      m.round,
    surface:    m.surface,
    score:      m.score ?? null,
    date:       m.match_date,
    player1:    map[m.player1_id] ?? { id: m.player1_id, name: 'TBD', flag: '🏳️', rank: 999 },
    player2:    map[m.player2_id] ?? { id: m.player2_id, name: 'TBD', flag: '🏳️', rank: 999 },
  }));
}

// ── Live matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'live')
      .order('match_date', { ascending: true });

    if (error) throw error;
    return attachPlayers(data ?? []);
  } catch (e) {
    console.error('[getLiveMatches]', e.message);
    // FIX 3: MOCK_DATA.matches is now always defined — no more crash on .filter()
    return MOCK_DATA.matches.filter(m => m.status === 'live');
  }
}

// ── Upcoming matches ──────────────────────────────────────────────────────────
export async function getUpcomingMatches() {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'upcoming')
      .order('match_date', { ascending: true })
      .limit(20);

    if (error) throw error;
    return attachPlayers(data ?? []);
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
      .select('*')
      .gte('match_date', start)
      .lte('match_date', end)
      .order('match_date', { ascending: true });

    if (error) throw error;
    return attachPlayers(data ?? []);
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
    // FIX 3: MOCK_DATA.rankings is now always defined
    return tour === 'WTA' ? MOCK_DATA.rankingsWTA : MOCK_DATA.rankings;
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

// ── Prediction engine (pure local calc — no external API needed) ──────────────
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;
  const rankEdge    = (p2.rank - p1.rank) * 1.2;
  const surfaceEdge = match.surface === p1.surface_pref ?  6
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
  };
}

// ── AI Chat — calls the Supabase Edge Function ────────────────────────────────
// FIX 2: Now accepts systemContext as the second argument and forwards it to
//        the `ai-chat` Edge Function, which uses ANTHROPIC_API_KEY from
//        Supabase Secrets (the key is NEVER sent to the browser).
export async function sendChatMessage(messages, systemContext = '') {
  const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ messages, systemContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? `AI service error (${res.status})`);
  }

  return res.json();  // { content: [{ text: "..." }] }  — same shape as before
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — FIX 3: `matches` and `rankings` arrays were completely missing.
// Every fallback path in the functions above referenced these, so a Supabase
// connection failure would cause an instant "Cannot read properties of
// undefined (reading 'filter')" crash. Now the app gracefully shows real-
// looking demo data when the database is unreachable.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA = {

  // ── ATP Players ─────────────────────────────────────────────────────────────
  players: [
    { id:'1', name:'Jannik Sinner',     country:'Italy',         flag:'🇮🇹', rank:1,  wins:216,  losses:58,  ace_avg:5.8, surface_pref:'Hard', first_serve_pct:62, recent_form:'W W W W L' },
    { id:'2', name:'Carlos Alcaraz',    country:'Spain',         flag:'🇪🇸', rank:2,  wins:220,  losses:66,  ace_avg:7.1, surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W' },
    { id:'3', name:'Novak Djokovic',    country:'Serbia',        flag:'🇷🇸', rank:3,  wins:1104, losses:214, ace_avg:6.2, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W' },
    { id:'4', name:'Alexander Zverev',  country:'Germany',       flag:'🇩🇪', rank:4,  wins:405,  losses:184, ace_avg:9.1, surface_pref:'Clay', first_serve_pct:61, recent_form:'W L W W W' },
    { id:'5', name:'Daniil Medvedev',   country:'Russia',        flag:'🇷🇺', rank:5,  wins:377,  losses:192, ace_avg:8.3, surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W' },
    { id:'6', name:'Andrey Rublev',     country:'Russia',        flag:'🇷🇺', rank:6,  wins:344,  losses:187, ace_avg:6.8, surface_pref:'Hard', first_serve_pct:58, recent_form:'W W L W L' },
    { id:'7', name:'Casper Ruud',       country:'Norway',        flag:'🇳🇴', rank:7,  wins:248,  losses:130, ace_avg:4.2, surface_pref:'Clay', first_serve_pct:60, recent_form:'L W W L W' },
    { id:'8', name:'Hubert Hurkacz',    country:'Poland',        flag:'🇵🇱', rank:8,  wins:280,  losses:165, ace_avg:11.2, surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W' },
    // WTA
    { id:'w1', name:'Aryna Sabalenka',  country:'Belarus',       flag:'🇧🇾', rank:1,  wins:318,  losses:120, ace_avg:4.8, surface_pref:'Hard', first_serve_pct:64, recent_form:'W W W W W' },
    { id:'w2', name:'Iga Świątek',      country:'Poland',        flag:'🇵🇱', rank:2,  wins:410,  losses:96,  ace_avg:3.1, surface_pref:'Clay', first_serve_pct:68, recent_form:'W W L W W' },
    { id:'w3', name:'Coco Gauff',       country:'United States', flag:'🇺🇸', rank:3,  wins:218,  losses:95,  ace_avg:5.6, surface_pref:'Hard', first_serve_pct:62, recent_form:'W L W W W' },
    { id:'w4', name:'Elena Rybakina',   country:'Kazakhstan',    flag:'🇰🇿', rank:4,  wins:290,  losses:112, ace_avg:9.2, surface_pref:'Grass', first_serve_pct:67, recent_form:'W W W L W' },
  ],

  // ── Matches (used as fallback when Supabase is unreachable) ─────────────────
  matches: [
    {
      id: 'm1', status: 'live',
      tournament: 'Miami Open', round: 'QF', surface: 'Hard',
      score: '6-4 3-2', date: 'Today',
      player1: { id:'1', name:'Jannik Sinner',   flag:'🇮🇹', rank:1, wins:216, losses:58,  ace_avg:5.8, surface_pref:'Hard', first_serve_pct:62, recent_form:'W W W W L' },
      player2: { id:'2', name:'Carlos Alcaraz',  flag:'🇪🇸', rank:2, wins:220, losses:66,  ace_avg:7.1, surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W' },
    },
    {
      id: 'm2', status: 'live',
      tournament: 'Miami Open', round: 'QF', surface: 'Hard',
      score: '7-5 2-4', date: 'Today',
      player1: { id:'3', name:'Novak Djokovic',  flag:'🇷🇸', rank:3, wins:1104, losses:214, ace_avg:6.2, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W' },
      player2: { id:'5', name:'Daniil Medvedev', flag:'🇷🇺', rank:5, wins:377,  losses:192, ace_avg:8.3, surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W' },
    },
    {
      id: 'm3', status: 'upcoming',
      tournament: 'Miami Open', round: 'SF', surface: 'Hard',
      score: null, date: 'Tomorrow',
      player1: { id:'4', name:'Alexander Zverev', flag:'🇩🇪', rank:4, wins:405, losses:184, ace_avg:9.1, surface_pref:'Clay', first_serve_pct:61, recent_form:'W L W W W' },
      player2: { id:'8', name:'Hubert Hurkacz',   flag:'🇵🇱', rank:8, wins:280, losses:165, ace_avg:11.2, surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W' },
    },
    {
      id: 'm4', status: 'upcoming',
      tournament: 'Madrid Open', round: 'R64', surface: 'Clay',
      score: null, date: 'Tomorrow',
      player1: { id:'2', name:'Carlos Alcaraz',  flag:'🇪🇸', rank:2, wins:220, losses:66,  ace_avg:7.1, surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W' },
      player2: { id:'6', name:'Andrey Rublev',   flag:'🇷🇺', rank:6, wins:344, losses:187, ace_avg:6.8, surface_pref:'Hard', first_serve_pct:58, recent_form:'W W L W L' },
    },
    {
      id: 'm5', status: 'upcoming',
      tournament: 'Wimbledon', round: 'R128', surface: 'Grass',
      score: null, date: 'Next week',
      player1: { id:'1', name:'Jannik Sinner',  flag:'🇮🇹', rank:1, wins:216, losses:58,  ace_avg:5.8, surface_pref:'Hard', first_serve_pct:62, recent_form:'W W W W L' },
      player2: { id:'7', name:'Casper Ruud',    flag:'🇳🇴', rank:7, wins:248, losses:130, ace_avg:4.2, surface_pref:'Clay', first_serve_pct:60, recent_form:'L W W L W' },
    },
  ],

  // ── ATP Rankings fallback ────────────────────────────────────────────────────
  rankings: [
    { id:'1',  name:'Jannik Sinner',     country:'Italy',   flag:'🇮🇹', rank:1, points:11330, prev_rank:1, wins:216, losses:58,  ace_avg:5.8,  surface_pref:'Hard', first_serve_pct:62, recent_form:'W W W W L' },
    { id:'2',  name:'Carlos Alcaraz',    country:'Spain',   flag:'🇪🇸', rank:2, points:9255,  prev_rank:2, wins:220, losses:66,  ace_avg:7.1,  surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W' },
    { id:'3',  name:'Novak Djokovic',    country:'Serbia',  flag:'🇷🇸', rank:3, points:8310,  prev_rank:3, wins:1104,losses:214, ace_avg:6.2,  surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W' },
    { id:'4',  name:'Alexander Zverev', country:'Germany',  flag:'🇩🇪', rank:4, points:7145,  prev_rank:4, wins:405, losses:184, ace_avg:9.1,  surface_pref:'Clay', first_serve_pct:61, recent_form:'W L W W W' },
    { id:'5',  name:'Daniil Medvedev',   country:'Russia',  flag:'🇷🇺', rank:5, points:6820,  prev_rank:5, wins:377, losses:192, ace_avg:8.3,  surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W' },
    { id:'6',  name:'Andrey Rublev',     country:'Russia',  flag:'🇷🇺', rank:6, points:4325,  prev_rank:7, wins:344, losses:187, ace_avg:6.8,  surface_pref:'Hard', first_serve_pct:58, recent_form:'W W L W L' },
    { id:'7',  name:'Casper Ruud',       country:'Norway',  flag:'🇳🇴', rank:7, points:4175,  prev_rank:6, wins:248, losses:130, ace_avg:4.2,  surface_pref:'Clay', first_serve_pct:60, recent_form:'L W W L W' },
    { id:'8',  name:'Hubert Hurkacz',    country:'Poland',  flag:'🇵🇱', rank:8, points:3965,  prev_rank:8, wins:280, losses:165, ace_avg:11.2, surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W' },
    { id:'9',  name:'Taylor Fritz',  country:'United States', flag:'🇺🇸', rank:9, points:3750, prev_rank:10, wins:246, losses:148, ace_avg:8.8, surface_pref:'Hard', first_serve_pct:64, recent_form:'W W L W W' },
    { id:'10', name:'Tommy Paul',    country:'United States', flag:'🇺🇸', rank:10, points:3180, prev_rank:9, wins:212, losses:128, ace_avg:7.4, surface_pref:'Hard', first_serve_pct:62, recent_form:'W L W L W' },
  ],

  // ── WTA Rankings fallback ────────────────────────────────────────────────────
  rankingsWTA: [
    { id:'w1', name:'Aryna Sabalenka',  country:'Belarus',       flag:'🇧🇾', rank:1, points:10940, prev_rank:1, wins:318, losses:120, ace_avg:4.8, surface_pref:'Hard', first_serve_pct:64, recent_form:'W W W W W' },
    { id:'w2', name:'Iga Świątek',      country:'Poland',        flag:'🇵🇱', rank:2, points:9545,  prev_rank:2, wins:410, losses:96,  ace_avg:3.1, surface_pref:'Clay', first_serve_pct:68, recent_form:'W W L W W' },
    { id:'w3', name:'Coco Gauff',       country:'United States', flag:'🇺🇸', rank:3, points:7290,  prev_rank:3, wins:218, losses:95,  ace_avg:5.6, surface_pref:'Hard', first_serve_pct:62, recent_form:'W L W W W' },
    { id:'w4', name:'Elena Rybakina',   country:'Kazakhstan',    flag:'🇰🇿', rank:4, points:6880,  prev_rank:4, wins:290, losses:112, ace_avg:9.2, surface_pref:'Grass', first_serve_pct:67, recent_form:'W W W L W' },
    { id:'w5', name:'Jessica Pegula',   country:'United States', flag:'🇺🇸', rank:5, points:5880,  prev_rank:6, wins:225, losses:115, ace_avg:4.5, surface_pref:'Hard', first_serve_pct:61, recent_form:'L W W W L' },
    { id:'w6', name:'Qinwen Zheng',     country:'China',         flag:'🇨🇳', rank:6, points:5240,  prev_rank:5, wins:188, losses:96,  ace_avg:6.2, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W' },
    { id:'w7', name:'Mirra Andreeva',   country:'Russia',        flag:'🇷🇺', rank:7, points:4090,  prev_rank:9, wins:148, losses:78,  ace_avg:4.8, surface_pref:'Clay', first_serve_pct:60, recent_form:'W W L W W' },
    { id:'w8', name:'Daria Kasatkina',  country:'Russia',        flag:'🇷🇺', rank:8, points:3870,  prev_rank:7, wins:296, losses:170, ace_avg:3.9, surface_pref:'Clay', first_serve_pct:59, recent_form:'W L W W L' },
    { id:'w9', name:'Emma Navarro',     country:'United States', flag:'🇺🇸', rank:9, points:3210,  prev_rank:10, wins:162, losses:88, ace_avg:5.1, surface_pref:'Hard', first_serve_pct:61, recent_form:'W W W W L' },
    { id:'w10', name:'Barbora Krejčíková', country:'Czech Republic', flag:'🇨🇿', rank:10, points:2990, prev_rank:8, wins:285, losses:148, ace_avg:4.4, surface_pref:'Clay', first_serve_pct:62, recent_form:'L W L W W' },
  ],

  // ── H2H fallback ─────────────────────────────────────────────────────────────
  h2h: {
    total: 0, p1_wins: 0, p2_wins: 0,
    last5: [], meetings: [],
  },
};