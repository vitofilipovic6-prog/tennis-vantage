// src/services/tennisApi.js
// ─────────────────────────────────────────────────────────────────────────────
// FULL-POWER version — uses all real DB columns populated by the three
// sync edge functions (sync-rankings, sync-matches, sync-h2h).
//
// New fields now available in every match/player object:
//   match.live_status  — e.g. "Set 2 · 3-2" (live only)
//   player.photo_url   — player headshot from api-tennis
//   player.recent_form — e.g. "W W L W W" derived from real results
//   player.surface_pref — derived from actual win history
//   match.winner_id    — populated for finished (H2H) matches
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

// ── Shared player select fragment ─────────────────────────────────────────────
const PLAYER_SELECT = `
  id, name, country, flag, rank,
  wins, losses, ace_avg,
  surface_pref, first_serve_pct,
  recent_form, photo_url,
  injury_notes, fatigue_score
`;

// ── Shared match select — single query, no N+1 ───────────────────────────────
const MATCH_SELECT = `
  id, status, tournament, round, surface,
  score, live_status, match_date, winner_id,
  player1:players!player1_id ( ${PLAYER_SELECT} ),
  player2:players!player2_id ( ${PLAYER_SELECT} )
`;

// ── Normalise a raw Supabase match row into the shape the UI expects ──────────
function normaliseMatch(m) {
  return {
    id:          m.id,
    status:      m.status,
    tournament:  m.tournament,
    round:       m.round,
    surface:     m.surface,
    score:       m.score      ?? null,
    liveStatus:  m.live_status ?? null,  // ← new: "Set 2 · 3-2"
    winnerId:    m.winner_id  ?? null,   // ← new: for H2H display
    date:        m.match_date,
    player1:     normalisePlayer(m.player1),
    player2:     normalisePlayer(m.player2),
  };
}

function normalisePlayer(p) {
  if (!p) return { id: 'tbd', name: 'TBD', flag: '🏳️', rank: 999 };
  return {
    id:             p.id,
    name:           p.name,
    country:        p.country        ?? '',
    flag:           p.flag           ?? '🏳️',
    rank:           p.rank           ?? 999,
    wins:           p.wins           ?? 0,
    losses:         p.losses         ?? 0,
    ace_avg:        p.ace_avg        ?? 5.5,
    surface_pref:   p.surface_pref   ?? 'Hard',
    first_serve_pct: p.first_serve_pct ?? 60,
    recent_form:    p.recent_form    ?? '- - - - -',
    photo_url:      p.photo_url      ?? null,  // ← new: player headshot
    injury_notes:   p.injury_notes   ?? null,  // ← new: injury info
    fatigue_score:  p.fatigue_score  ?? 0,     // ← new: fatigue index
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
      .limit(30);

    if (error) throw error;
    return (data ?? []).map(normaliseMatch);
  } catch (e) {
    console.error('[getUpcomingMatches]', e.message);
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
}

// ── Matches by calendar date ───────────────────────────────────────────────────
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
        rank, points, prev_rank,
        players ( ${PLAYER_SELECT} )
      `)
      .eq('tour', tour)
      .order('rank', { ascending: true })
      .limit(50);

    if (error) throw error;

    return (data ?? []).map(r => ({
      ...normalisePlayer(r.players),
      rank:      r.rank,
      points:    r.points,
      prev_rank: r.prev_rank,
    }));
  } catch (e) {
    console.error('[getRankings]', e.message);
    return MOCK_DATA.rankings;
  }
}

// ── Player stats (full profile) ───────────────────────────────────────────────
export async function getPlayerStats(playerId) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select(PLAYER_SELECT)
      .eq('id', playerId)
      .single();

    if (error) throw error;
    return normalisePlayer(data);
  } catch (e) {
    console.error('[getPlayerStats]', e.message);
    return MOCK_DATA.players.find(p => p.id === playerId) ?? null;
  }
}

// ── Head to Head ──────────────────────────────────────────────────────────────
// Now uses real finished matches stored by sync-h2h
export async function getHeadToHead(p1Id, p2Id) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('id, match_date, tournament, surface, score, winner_id, player1_id, player2_id')
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

// ── Prediction engine ─────────────────────────────────────────────────────────
// Now enhanced with injury_notes and fatigue_score from real data
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;

  // Core rank edge (higher rank = lower number = better)
  const rankEdge    = (p2.rank - p1.rank) * 1.2;

  // Surface advantage
  const surfaceEdge = match.surface === p1.surface_pref ?  6
                    : match.surface === p2.surface_pref ? -6 : 0;

  // Serve quality
  const serveEdge   = (p1.first_serve_pct - p2.first_serve_pct) * 0.4;

  // Recent form: count W's in last 5
  const formScore = (form) => (form ?? '').split(' ').filter(r => r === 'W').length;
  const formEdge  = (formScore(p1.recent_form) - formScore(p2.recent_form)) * 2;

  // Fatigue penalty (0–100 scale from sync)
  const fatigueEdge = ((p2.fatigue_score ?? 0) - (p1.fatigue_score ?? 0)) * 0.3;

  // Injury penalty
  const injuryEdge = p1.injury_notes ? -8 : p2.injury_notes ? 8 : 0;

  // Combine
  const rawEdge  = rankEdge + surfaceEdge + serveEdge + formEdge + fatigueEdge + injuryEdge;
  const p1WinPct = Math.min(85, Math.max(15, 50 + rawEdge));

  // Determine top 3 decisive factors
  const factors = [
    { label: 'Rankings gap',      value: Math.abs(rankEdge),    desc: rankEdge > 0 ? `${p1.name} ranked higher` : `${p2.name} ranked higher` },
    { label: 'Surface advantage', value: Math.abs(surfaceEdge), desc: surfaceEdge > 0 ? `${p1.name} prefers ${match.surface}` : surfaceEdge < 0 ? `${p2.name} prefers ${match.surface}` : 'Neutral surface for both' },
    { label: 'Serve quality',     value: Math.abs(serveEdge),   desc: serveEdge > 0 ? `${p1.name} stronger first serve` : `${p2.name} stronger first serve` },
    { label: 'Recent form',       value: Math.abs(formEdge),    desc: formEdge > 0 ? `${p1.name} in better form` : formEdge < 0 ? `${p2.name} in better form` : 'Similar recent form' },
    { label: 'Fatigue index',     value: Math.abs(fatigueEdge), desc: fatigueEdge > 0 ? `${p1.name} fresher` : fatigueEdge < 0 ? `${p2.name} fresher` : 'Similar fatigue levels' },
    ...(injuryEdge !== 0 ? [{ label: 'Injury concern', value: Math.abs(injuryEdge), desc: p1.injury_notes ?? p2.injury_notes ?? '' }] : []),
  ].sort((a, b) => b.value - a.value).slice(0, 3);

  const confidence = Math.round(Math.abs(rawEdge) * 1.5 + 40);

  return {
    p1WinPct:   Math.round(p1WinPct),
    p2WinPct:   Math.round(100 - p1WinPct),
    confidence: Math.min(95, confidence),
    factors,
    // Expose raw inputs so AI chat can explain them
    raw: { rankEdge, surfaceEdge, serveEdge, formEdge, fatigueEdge, injuryEdge },
  };
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
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
    return { content: [{ text: `⚠️ AI service unavailable: ${e.message}` }] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — fallback when Supabase is empty (e.g. before first sync runs)
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA = {
  players: [
    { id:'1', name:'Jannik Sinner',      country:'Italy',     flag:'🇮🇹', rank:1,  wins:198,  losses:74,  ace_avg:5.8,  surface_pref:'Hard', first_serve_pct:61, recent_form:'W W W W L', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'2', name:'Carlos Alcaraz',     country:'Spain',     flag:'🇪🇸', rank:2,  wins:214,  losses:63,  ace_avg:7.1,  surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:35 },
    { id:'3', name:'Alexander Zverev',   country:'Germany',   flag:'🇩🇪', rank:3,  wins:370,  losses:192, ace_avg:9.1,  surface_pref:'Hard', first_serve_pct:64, recent_form:'L W W W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'4', name:'Daniil Medvedev',    country:'Russia',    flag:'🇷🇺', rank:4,  wins:377,  losses:192, ace_avg:8.3,  surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W', photo_url:null, injury_notes:null, fatigue_score:25 },
    { id:'5', name:'Novak Djokovic',     country:'Serbia',    flag:'🇷🇸', rank:5,  wins:1104, losses:214, ace_avg:6.2,  surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W', photo_url:null, injury_notes:'Knee', fatigue_score:45 },
    { id:'6', name:'Taylor Fritz',       country:'USA',       flag:'🇺🇸', rank:6,  wins:265,  losses:162, ace_avg:10.2, surface_pref:'Hard', first_serve_pct:67, recent_form:'W W L W L', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'7', name:'Casper Ruud',        country:'Norway',    flag:'🇳🇴', rank:7,  wins:258,  losses:139, ace_avg:5.5,  surface_pref:'Clay', first_serve_pct:57, recent_form:'L W W W W', photo_url:null, injury_notes:null, fatigue_score:30 },
    { id:'8', name:'Holger Rune',        country:'Denmark',   flag:'🇩🇰', rank:8,  wins:148,  losses:87,  ace_avg:6.7,  surface_pref:'Clay', first_serve_pct:60, recent_form:'W W L W L', photo_url:null, injury_notes:null, fatigue_score:10 },
  ],
  wtaPlayers: [
    { id:'w1', name:'Aryna Sabalenka',  country:'Belarus',   flag:'🇧🇾', rank:1,  wins:298,  losses:102, ace_avg:6.8,  surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'w2', name:'Iga Świątek',      country:'Poland',    flag:'🇵🇱', rank:2,  wins:350,  losses:89,  ace_avg:4.2,  surface_pref:'Clay', first_serve_pct:72, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'w3', name:'Coco Gauff',       country:'USA',       flag:'🇺🇸', rank:3,  wins:198,  losses:88,  ace_avg:5.3,  surface_pref:'Hard', first_serve_pct:63, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:25 },
    { id:'w4', name:'Jessica Pegula',   country:'USA',       flag:'🇺🇸', rank:4,  wins:187,  losses:112, ace_avg:3.1,  surface_pref:'Hard', first_serve_pct:61, recent_form:'L W W L W', photo_url:null, injury_notes:null, fatigue_score:30 },
    { id:'w5', name:'Elena Rybakina',   country:'Kazakhstan',flag:'🇰🇿', rank:5,  wins:210,  losses:95,  ace_avg:7.9,  surface_pref:'Grass',first_serve_pct:68, recent_form:'W W W L W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'w6', name:'Jasmine Paolini',  country:'Italy',     flag:'🇮🇹', rank:6,  wins:156,  losses:110, ace_avg:3.5,  surface_pref:'Clay', first_serve_pct:59, recent_form:'L W W W L', photo_url:null, injury_notes:null, fatigue_score:35 },
    { id:'w7', name:'Mirra Andreeva',   country:'Russia',    flag:'🇷🇺', rank:7,  wins:98,   losses:65,  ace_avg:4.1,  surface_pref:'Clay', first_serve_pct:61, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'w8', name:'Daria Kasatkina',  country:'Russia',    flag:'🇷🇺', rank:8,  wins:178,  losses:120, ace_avg:3.8,  surface_pref:'Clay', first_serve_pct:60, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:20 },
  ],
  get matches() {
    const p = this.players;
    return [
      { id:'m1', status:'live',     tournament:'Miami Open',      round:'SF',  surface:'Hard',  score:'6-4, 3-2*', liveStatus:'Set 2 · 3-2', date:new Date().toISOString(), player1:p[0], player2:p[1], winnerId:null },
      { id:'m2', status:'upcoming', tournament:'Madrid Open',      round:'QF',  surface:'Clay',  score:null,        liveStatus:null,           date:new Date(Date.now()+86400000).toISOString(), player1:p[2], player2:p[3], winnerId:null },
      { id:'m3', status:'upcoming', tournament:'Rome Masters',     round:'R32', surface:'Clay',  score:null,        liveStatus:null,           date:new Date(Date.now()+172800000).toISOString(), player1:p[1], player2:p[3], winnerId:null },
      { id:'m4', status:'upcoming', tournament:'Wimbledon',        round:'SF',  surface:'Grass', score:null,        liveStatus:null,           date:new Date(Date.now()+259200000).toISOString(), player1:p[4], player2:p[5], winnerId:null },
      { id:'m5', status:'upcoming', tournament:'French Open',      round:'QF',  surface:'Clay',  score:null,        liveStatus:null,           date:new Date(Date.now()+345600000).toISOString(), player1:p[6], player2:p[7], winnerId:null },
    ];
  },
  get rankings() {
    return this.players.map((p, i) => ({
      ...p,
      points:    Math.round(11000 / (i + 1)),
      prev_rank: p.rank,
    }));
  },
  get wtaRankings() {
    return this.wtaPlayers.map((p, i) => ({
      ...p,
      points:    Math.round(9000 / (i + 1)),
      prev_rank: p.rank,
    }));
  },
  h2h: {
    total: 12, p1_wins: 7, p2_wins: 5,
    last5: ['W','W','L','W','L'],
    meetings: [
      { year:2025, tournament:'Australian Open', surface:'Hard',  winner:'p1', score:'7-6, 6-4' },
      { year:2024, tournament:'Wimbledon',        surface:'Grass', winner:'p1', score:'6-3, 7-5' },
      { year:2024, tournament:'Roland Garros',    surface:'Clay',  winner:'p2', score:'6-4, 6-3' },
      { year:2023, tournament:'US Open',          surface:'Hard',  winner:'p1', score:'6-2, 7-6' },
      { year:2023, tournament:'Roland Garros',    surface:'Clay',  winner:'p2', score:'7-5, 6-3' },
    ],
  },
};