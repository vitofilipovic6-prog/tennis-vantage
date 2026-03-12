// src/services/tennisApi.js
// KEY CHANGE: MATCH_SELECT now includes `tour` column.
// normaliseMatch reads m.tour directly — no more name-string guessing.
// getRankings WTA fallback now returns correct mock set.
import { supabase } from './supabase';

const PLAYER_SELECT = `
  id, name, country, flag, rank,
  wins, losses, ace_avg,
  surface_pref, first_serve_pct,
  recent_form, photo_url,
  injury_notes, fatigue_score
`;

// tour is now selected from the DB directly
const MATCH_SELECT = `
  id, status, tournament, round, surface, tour,
  score, live_status, match_date, winner_id,
  player1:players!player1_id ( ${PLAYER_SELECT} ),
  player2:players!player2_id ( ${PLAYER_SELECT} )
`;

function normaliseMatch(m) {
  return {
    id:          m.id,
    status:      m.status,
    tournament:  m.tournament,
    round:       m.round,
    surface:     m.surface,
    tour:        m.tour ?? 'ATP',   // ← read directly from DB, never guessed
    score:       m.score      ?? null,
    liveStatus:  m.live_status ?? null,
    winnerId:    m.winner_id  ?? null,
    date:        m.match_date,
    player1:     normalisePlayer(m.player1),
    player2:     normalisePlayer(m.player2),
  };
}

function normalisePlayer(p) {
  if (!p) return { id: 'tbd', name: 'TBD', flag: '🏳️', rank: 999 };
  return {
    id:              p.id,
    name:            p.name,
    country:         p.country         ?? '',
    flag:            p.flag            ?? '🏳️',
    rank:            p.rank            ?? 999,
    wins:            p.wins            ?? 0,
    losses:          p.losses          ?? 0,
    ace_avg:         p.ace_avg         ?? 5.5,
    surface_pref:    p.surface_pref    ?? 'Hard',
    first_serve_pct: p.first_serve_pct ?? 60,
    recent_form:     p.recent_form     ?? '- - - - -',
    photo_url:       p.photo_url       ?? null,
    injury_notes:    p.injury_notes    ?? null,
    fatigue_score:   p.fatigue_score   ?? 0,
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
    return [];
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
      .limit(50);

    if (error) throw error;
    return (data ?? []).map(normaliseMatch);
  } catch (e) {
    console.error('[getUpcomingMatches]', e.message);
    return [];
  }
}

// ── Matches by calendar date ──────────────────────────────────────────────────
export async function getMatchesByDate(dateString) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .gte('match_date', `${dateString}T00:00:00.000Z`)
      .lte('match_date', `${dateString}T23:59:59.999Z`)
      .order('match_date', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(normaliseMatch);
  } catch (e) {
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
    // FIXED: return the correct mock tour, not always ATP
    return tour === 'WTA' ? MOCK_DATA.wtaRankings : MOCK_DATA.rankings;
  }
}

// ── Player stats ──────────────────────────────────────────────────────────────
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
export async function getHeadToHead(p1Id, p2Id) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, tournament, surface, score, match_date, winner_id, tour,
        player1:players!player1_id ( id, name ),
        player2:players!player2_id ( id, name )
      `)
      .eq('status', 'finished')
      .or(`and(player1_id.eq.${p1Id},player2_id.eq.${p2Id}),and(player1_id.eq.${p2Id},player2_id.eq.${p1Id})`)
      .order('match_date', { ascending: false })
      .limit(10);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const meetings = data.map(m => ({
      year:       new Date(m.match_date).getFullYear(),
      tournament: m.tournament,
      surface:    m.surface,
      score:      m.score,
      winner:     m.winner_id === p1Id ? 'p1' : m.winner_id === p2Id ? 'p2' : null,
    }));

    const p1Wins = meetings.filter(m => m.winner === 'p1').length;
    const p2Wins = meetings.filter(m => m.winner === 'p2').length;

    return { p1Wins, p2Wins, meetings };
  } catch (e) {
    console.error('[getHeadToHead]', e.message);
    return null;
  }
}

// ── Prediction engine ─────────────────────────────────────────────────────────
export async function getPrediction(match) {
  if (!match?.player1 || !match?.player2) return null;

  const p1 = match.player1;
  const p2 = match.player2;

  function formScore(form) {
    if (!form || form === '- - - - -') return 0;
    return form.split(' ').reduce((acc, r) => acc + (r === 'W' ? 1 : r === 'L' ? -1 : 0), 0);
  }

  const rankEdge    = Math.min(Math.max((p2.rank - p1.rank) / 10, -10), 10);
  const surfaceEdge = p1.surface_pref === match.surface ? 3 : p2.surface_pref === match.surface ? -3 : 0;
  const serveEdge   = (p1.first_serve_pct - p2.first_serve_pct) / 5;
  const formEdge    = formScore(p1.recent_form) - formScore(p2.recent_form);
  const fatigueEdge = (p2.fatigue_score - p1.fatigue_score) / 10;
  const injuryEdge  = p1.injury_notes && !p2.injury_notes ? -5 : !p1.injury_notes && p2.injury_notes ? 5 : 0;

  const rawEdge  = rankEdge + surfaceEdge + serveEdge + formEdge + fatigueEdge + injuryEdge;
  const p1WinPct = Math.min(Math.max(50 + rawEdge * 3, 10), 90);

  const factors = [
    { label: 'Ranking edge',     value: Math.abs(rankEdge),    desc: rankEdge > 0 ? `${p1.name} ranked higher` : `${p2.name} ranked higher` },
    { label: 'Surface advantage',value: Math.abs(surfaceEdge), desc: surfaceEdge > 0 ? `${p1.name} prefers ${match.surface}` : surfaceEdge < 0 ? `${p2.name} prefers ${match.surface}` : 'Neutral surface for both' },
    { label: 'Serve quality',    value: Math.abs(serveEdge),   desc: serveEdge > 0 ? `${p1.name} stronger first serve` : `${p2.name} stronger first serve` },
    { label: 'Recent form',      value: Math.abs(formEdge),    desc: formEdge > 0 ? `${p1.name} in better form` : formEdge < 0 ? `${p2.name} in better form` : 'Similar recent form' },
    { label: 'Fatigue index',    value: Math.abs(fatigueEdge), desc: fatigueEdge > 0 ? `${p1.name} fresher` : fatigueEdge < 0 ? `${p2.name} fresher` : 'Similar fatigue levels' },
    ...(injuryEdge !== 0 ? [{ label: 'Injury concern', value: Math.abs(injuryEdge), desc: p1.injury_notes ?? p2.injury_notes ?? '' }] : []),
  ].sort((a, b) => b.value - a.value).slice(0, 3);

  const confidence = Math.round(Math.abs(rawEdge) * 1.5 + 40);
  const confLabel  = confidence > 70 ? 'High' : confidence > 50 ? 'Medium' : 'Low';

  return {
    player1_win_pct: Math.round(p1WinPct),
    player2_win_pct: Math.round(100 - p1WinPct),
    confidence:      confLabel,
    key_factors:     factors.map(f => `${f.label}: ${f.desc}`),
    p1WinPct:   Math.round(p1WinPct),
    p2WinPct:   Math.round(100 - p1WinPct),
    factors,
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
    throw e;
  }
}

// ── Mock data (fallback only) ─────────────────────────────────────────────────
export const MOCK_DATA = {
  players: [
    { id:'p1', name:'Jannik Sinner',          country:'ITA', flag:'🇮🇹', rank:1,  wins:210, losses:65,  ace_avg:6.2,  surface_pref:'Hard', first_serve_pct:64, recent_form:'W W W W W', photo_url:null, injury_notes:null, fatigue_score:10 },
    { id:'p2', name:'Carlos Alcaraz',         country:'ESP', flag:'🇪🇸', rank:2,  wins:195, losses:60,  ace_avg:5.8,  surface_pref:'Clay', first_serve_pct:63, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:25 },
    { id:'p3', name:'Novak Djokovic',         country:'SRB', flag:'🇷🇸', rank:3,  wins:1080,losses:215, ace_avg:4.5,  surface_pref:'Hard', first_serve_pct:62, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:30 },
    { id:'p4', name:'Alexander Zverev',       country:'DEU', flag:'🇩🇪', rank:4,  wins:380, losses:175, ace_avg:7.2,  surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W L W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'p5', name:'Daniil Medvedev',        country:'RUS', flag:'🇷🇺', rank:5,  wins:390, losses:170, ace_avg:5.5,  surface_pref:'Hard', first_serve_pct:63, recent_form:'L W W W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'p6', name:'Andrey Rublev',          country:'RUS', flag:'🇷🇺', rank:6,  wins:198, losses:95,  ace_avg:6.5,  surface_pref:'Hard', first_serve_pct:61, recent_form:'L L W W L', photo_url:null, injury_notes:null, fatigue_score:40 },
    { id:'p7', name:'Holger Rune',            country:'DNK', flag:'🇩🇰', rank:7,  wins:112, losses:68,  ace_avg:5.9,  surface_pref:'Clay', first_serve_pct:60, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'p8', name:'Casper Ruud',            country:'NOR', flag:'🇳🇴', rank:8,  wins:156, losses:80,  ace_avg:4.2,  surface_pref:'Clay', first_serve_pct:59, recent_form:'W L W W L', photo_url:null, injury_notes:null, fatigue_score:25 },
  ],
  wtaPlayers: [
    { id:'w1', name:'Aryna Sabalenka',        country:'BLR', flag:'🇧🇾', rank:1,  wins:198, losses:72,  ace_avg:5.2,  surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W', photo_url:null, injury_notes:null, fatigue_score:10 },
    { id:'w2', name:'Iga Swiatek',            country:'POL', flag:'🇵🇱', rank:2,  wins:234, losses:68,  ace_avg:3.8,  surface_pref:'Clay', first_serve_pct:62, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'w3', name:'Elena Rybakina',         country:'KAZ', flag:'🇰🇿', rank:3,  wins:167, losses:78,  ace_avg:7.9,  surface_pref:'Grass',first_serve_pct:68, recent_form:'W W W L W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'w4', name:'Coco Gauff',             country:'USA', flag:'🇺🇸', rank:4,  wins:143, losses:65,  ace_avg:4.6,  surface_pref:'Hard', first_serve_pct:61, recent_form:'L W W W L', photo_url:null, injury_notes:null, fatigue_score:30 },
    { id:'w5', name:'Jessica Pegula',         country:'USA', flag:'🇺🇸', rank:5,  wins:132, losses:74,  ace_avg:3.9,  surface_pref:'Hard', first_serve_pct:60, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'w6', name:'Jasmine Paolini',        country:'ITA', flag:'🇮🇹', rank:6,  wins:156, losses:110, ace_avg:3.5,  surface_pref:'Clay', first_serve_pct:59, recent_form:'L W W W L', photo_url:null, injury_notes:null, fatigue_score:35 },
    { id:'w7', name:'Mirra Andreeva',         country:'RUS', flag:'🇷🇺', rank:7,  wins:98,  losses:65,  ace_avg:4.1,  surface_pref:'Clay', first_serve_pct:61, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'w8', name:'Daria Kasatkina',        country:'RUS', flag:'🇷🇺', rank:8,  wins:178, losses:120, ace_avg:3.8,  surface_pref:'Clay', first_serve_pct:60, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:20 },
  ],
  get rankings() {
    return this.players.map((p, i) => ({ ...p, points: Math.round(11000 / (i + 1)), prev_rank: p.rank }));
  },
  get wtaRankings() {
    return this.wtaPlayers.map((p, i) => ({ ...p, points: Math.round(9000 / (i + 1)), prev_rank: p.rank }));
  },
};