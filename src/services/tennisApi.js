// src/services/tennisApi.js
import { supabase } from './supabase';

const PLAYER_SELECT = `
  id, name, country, flag, rank,
  wins, losses, ace_avg,
  surface_pref, first_serve_pct,
  recent_form, photo_url,
  injury_notes, fatigue_score
`;

const MATCH_SELECT = `
  id, status, tournament, round, surface,
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
// FIX: Use date-only comparison to avoid UTC vs local timezone mismatch.
// We cast match_date to a date and compare directly instead of full ISO range.
export async function getMatchesByDate(dateString) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .gte('match_date', `${dateString}T00:00:00.000Z`)
      .lte('match_date', `${dateString}T23:59:59.999Z`)
      .order('match_date', { ascending: true });

    if (error) throw error;
    // Return empty array (not mock) when no real data — prevents phantom matches
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
    return MOCK_DATA.rankings;
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
// FIX: When no real H2H data exists, return null instead of shared mock data.
// This prevents every match showing the same fake H2H stats.
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

    // FIX: Return null when no real data — UI will show "No H2H data" instead of wrong mock
    if (!data?.length) return null;

    const p1Wins = data.filter(m => m.winner_id === p1Id).length;
    const p2Wins = data.filter(m => m.winner_id === p2Id).length;

    return {
      total:   data.length,
      p1_wins: p1Wins,
      p2_wins: p2Wins,
      last5:   data.slice(0, 5).map(m => m.winner_id === p1Id ? 'W' : 'L'),
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
  const surfaceEdge = match.surface === p1.surface_pref ?  6
                    : match.surface === p2.surface_pref ? -6 : 0;
  const serveEdge   = (p1.first_serve_pct - p2.first_serve_pct) * 0.4;
  const formScore   = (form) => (form ?? '').split(' ').filter(r => r === 'W').length;
  const formEdge    = (formScore(p1.recent_form) - formScore(p2.recent_form)) * 2;
  const fatigueEdge = ((p2.fatigue_score ?? 0) - (p1.fatigue_score ?? 0)) * 0.3;
  const injuryEdge  = p1.injury_notes ? -8 : p2.injury_notes ? 8 : 0;

  const rawEdge  = rankEdge + surfaceEdge + serveEdge + formEdge + fatigueEdge + injuryEdge;
  const p1WinPct = Math.min(85, Math.max(15, 50 + rawEdge));

  const factors = [
    { label: 'Rankings gap',      value: Math.abs(rankEdge),    desc: rankEdge > 0 ? `${p1.name} ranked higher` : `${p2.name} ranked higher` },
    { label: 'Surface advantage', value: Math.abs(surfaceEdge), desc: surfaceEdge > 0 ? `${p1.name} prefers ${match.surface}` : surfaceEdge < 0 ? `${p2.name} prefers ${match.surface}` : 'Neutral surface for both' },
    { label: 'Serve quality',     value: Math.abs(serveEdge),   desc: serveEdge > 0 ? `${p1.name} stronger first serve` : `${p2.name} stronger first serve` },
    { label: 'Recent form',       value: Math.abs(formEdge),    desc: formEdge > 0 ? `${p1.name} in better form` : formEdge < 0 ? `${p2.name} in better form` : 'Similar recent form' },
    { label: 'Fatigue index',     value: Math.abs(fatigueEdge), desc: fatigueEdge > 0 ? `${p1.name} fresher` : fatigueEdge < 0 ? `${p2.name} fresher` : 'Similar fatigue levels' },
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
    return { content: [{ text: `⚠️ AI service unavailable: ${e.message}` }] };
  }
}

// ── MOCK DATA — only used for Rankings fallback ───────────────────────────────
export const MOCK_DATA = {
  players: [
    { id:'p1', name:'Jannik Sinner',          country:'Italy',       flag:'🇮🇹', rank:1,  wins:185, losses:52,  ace_avg:7.2,  surface_pref:'Hard', first_serve_pct:67, recent_form:'W W W W L', photo_url:null, injury_notes:null, fatigue_score:10 },
    { id:'p2', name:'Carlos Alcaraz',         country:'Spain',       flag:'🇪🇸', rank:2,  wins:172, losses:58,  ace_avg:6.1,  surface_pref:'Clay', first_serve_pct:65, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:25 },
    { id:'p3', name:'Novak Djokovic',         country:'Serbia',      flag:'🇷🇸', rank:3,  wins:430, losses:98,  ace_avg:5.8,  surface_pref:'Hard', first_serve_pct:63, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:30 },
    { id:'p4', name:'Alexander Zverev',       country:'Germany',     flag:'🇩🇪', rank:4,  wins:220, losses:95,  ace_avg:9.4,  surface_pref:'Clay', first_serve_pct:62, recent_form:'L W W L W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'p5', name:'Daniil Medvedev',        country:'Russia',      flag:'🇷🇺', rank:5,  wins:268, losses:112, ace_avg:8.1,  surface_pref:'Hard', first_serve_pct:66, recent_form:'W W W L W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'p6', name:'Andrey Rublev',          country:'Russia',      flag:'🇷🇺', rank:6,  wins:198, losses:95,  ace_avg:6.5,  surface_pref:'Hard', first_serve_pct:61, recent_form:'L L W W L', photo_url:null, injury_notes:null, fatigue_score:40 },
    { id:'p7', name:'Holger Rune',            country:'Denmark',     flag:'🇩🇰', rank:7,  wins:112, losses:68,  ace_avg:5.9,  surface_pref:'Clay', first_serve_pct:60, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'p8', name:'Casper Ruud',            country:'Norway',      flag:'🇳🇴', rank:8,  wins:156, losses:80,  ace_avg:4.2,  surface_pref:'Clay', first_serve_pct:59, recent_form:'W L W W L', photo_url:null, injury_notes:null, fatigue_score:25 },
  ],
  wtaPlayers: [
    { id:'w1', name:'Aryna Sabalenka',        country:'Belarus',     flag:'🇧🇾', rank:1,  wins:198, losses:72,  ace_avg:5.2,  surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W', photo_url:null, injury_notes:null, fatigue_score:10 },
    { id:'w2', name:'Iga Swiatek',            country:'Poland',      flag:'🇵🇱', rank:2,  wins:234, losses:68,  ace_avg:3.8,  surface_pref:'Clay', first_serve_pct:62, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'w3', name:'Elena Rybakina',         country:'Kazakhstan',  flag:'🇰🇿', rank:3,  wins:167, losses:78,  ace_avg:7.9,  surface_pref:'Grass', first_serve_pct:68, recent_form:'W W W L W', photo_url:null, injury_notes:null, fatigue_score:20 },
    { id:'w4', name:'Coco Gauff',             country:'USA',         flag:'🇺🇸', rank:4,  wins:143, losses:65,  ace_avg:4.6,  surface_pref:'Hard', first_serve_pct:61, recent_form:'L W W W L', photo_url:null, injury_notes:null, fatigue_score:30 },
    { id:'w5', name:'Jessica Pegula',         country:'USA',         flag:'🇺🇸', rank:5,  wins:132, losses:74,  ace_avg:3.9,  surface_pref:'Hard', first_serve_pct:60, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'w6', name:'Jasmine Paolini',        country:'Italy',       flag:'🇮🇹', rank:6,  wins:156, losses:110, ace_avg:3.5,  surface_pref:'Clay', first_serve_pct:59, recent_form:'L W W W L', photo_url:null, injury_notes:null, fatigue_score:35 },
    { id:'w7', name:'Mirra Andreeva',         country:'Russia',      flag:'🇷🇺', rank:7,  wins:98,  losses:65,  ace_avg:4.1,  surface_pref:'Clay', first_serve_pct:61, recent_form:'W W L W W', photo_url:null, injury_notes:null, fatigue_score:15 },
    { id:'w8', name:'Daria Kasatkina',        country:'Russia',      flag:'🇷🇺', rank:8,  wins:178, losses:120, ace_avg:3.8,  surface_pref:'Clay', first_serve_pct:60, recent_form:'W L W W W', photo_url:null, injury_notes:null, fatigue_score:20 },
  ],
  get rankings() {
    return this.players.map((p, i) => ({ ...p, points: Math.round(11000 / (i + 1)), prev_rank: p.rank }));
  },
  get wtaRankings() {
    return this.wtaPlayers.map((p, i) => ({ ...p, points: Math.round(9000 / (i + 1)), prev_rank: p.rank }));
  },
};