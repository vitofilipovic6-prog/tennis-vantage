// ─────────────────────────────────────────────────────────────────────────────
// tennisApi.js  –  TennisVantage API service layer
// ─────────────────────────────────────────────────────────────────────────────

// 1. Define these FIRST so they can be used below without crashing
const API_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
const API_HOST = import.meta.env.VITE_RAPIDAPI_HOST || 'api-tennis.p.rapidapi.com';

const BASE_URL  = 'https://api-tennis.p.rapidapi.com';
const HEADERS   = { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': API_HOST };

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) throw new Error(`API_ERROR:${res.status}`);
  return res.json();
}

// ── Live matches ─────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  return MOCK_DATA.matches.filter(m => m.status === 'live');
}

// ── Upcoming matches ─────────────────────────────────────────────────────────
export async function getUpcomingMatches() {
  return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
}

// ── Matches by Date (FIXING YOUR DASHBOARD ERROR) ────────────────────────────
export async function getMatchesByDate(dateString) {
  console.log(`Mock fetch for matches on: ${dateString}`);
  return MOCK_DATA.matches;
}

// ── Rankings ─────────────────────────────────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  return MOCK_DATA.rankings;
}

// ── Player stats ─────────────────────────────────────────────────────────────
export async function getPlayerStats(playerId) {
  return MOCK_DATA.players.find(p => p.id === playerId) ?? null;
}

// ── Head to head ─────────────────────────────────────────────────────────────
export async function getHeadToHead(p1Id, p2Id) {
  return MOCK_DATA.h2h;
}

// ── Prediction engine ────────────────────────────────────────────────────────
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;
  const rankEdge     = (p2.rank - p1.rank) * 1.2;
  const surfaceEdge  = match.surface === p1.surface_pref ? 6 : match.surface === p2.surface_pref ? -6 : 0;
  const raw          = 50 + rankEdge + surfaceEdge;
  const p1WinPct     = Math.min(88, Math.max(12, Math.round(raw)));

  return {
    player1_win_pct: p1WinPct,
    player2_win_pct: 100 - p1WinPct,
    confidence: Math.abs(p1WinPct - 50) > 20 ? 'High' : Math.abs(p1WinPct - 50) > 10 ? 'Medium' : 'Low',
    key_factors: [
      `Ranking: #${p1.rank} vs #${p2.rank}`,
      `Surface advantage: ${match.surface === p1.surface_pref ? p1.name : match.surface === p2.surface_pref ? p2.name : 'Neutral'}`,
      `Recent form: ${p1.recent_form ?? '---'} vs ${p2.recent_form ?? '---'}`,
    ],
  };
}

// ── AI Chat stub ─────────────────────────────────────────────────────────────
export async function sendChatMessage(messages) {
  await new Promise(r => setTimeout(r, 900)); 
  const last = messages[messages.length - 1]?.content ?? '';
  return {
    content: [{ text: `[AI stub] You asked: "${last}". Connect your AI model in tennisApi.js → sendChatMessage() to get real answers!` }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOCK DATA 
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA = {
  players: [
    { id:1, name:'Novak Djokovic',     country:'SRB', flag:'🇷🇸', rank:1,  wins:1104, losses:214, ace_avg:6.2, surface_pref:'Hard',  first_serve_pct:63, recent_form:'W W W L W' },
    { id:2, name:'Carlos Alcaraz',     country:'ESP', flag:'🇪🇸', rank:2,  wins:214,  losses:63,  ace_avg:7.1, surface_pref:'Clay',  first_serve_pct:66, recent_form:'W W L W W' },
    { id:3, name:'Jannik Sinner',      country:'ITA', flag:'🇮🇹', rank:3,  wins:198,  losses:74,  ace_avg:5.8, surface_pref:'Hard',  first_serve_pct:61, recent_form:'W W W W L' },
    { id:4, name:'Daniil Medvedev',    country:'RUS', flag:'🇷🇺', rank:4,  wins:377,  losses:192, ace_avg:8.3, surface_pref:'Hard',  first_serve_pct:59, recent_form:'L W W W W' },
    { id:5, name:'Andrey Rublev',      country:'RUS', flag:'🇷🇺', rank:5,  wins:344,  losses:187, ace_avg:5.1, surface_pref:'Clay',  first_serve_pct:58, recent_form:'W L W L W' },
    { id:6, name:'Holger Rune',        country:'DEN', flag:'🇩🇰', rank:6,  wins:148,  losses:87,  ace_avg:6.7, surface_pref:'Clay',  first_serve_pct:60, recent_form:'W W L W L' },
    { id:7, name:'Casper Ruud',        country:'NOR', flag:'🇳🇴', rank:7,  wins:258,  losses:139, ace_avg:5.5, surface_pref:'Clay',  first_serve_pct:57, recent_form:'L W W W W' },
    { id:8, name:'Stefanos Tsitsipas', country:'GRE', flag:'🇬🇷', rank:8,  wins:336,  losses:165, ace_avg:7.9, surface_pref:'Clay',  first_serve_pct:62, recent_form:'W L W W L' },
  ],

  get matches() {
    const p = this.players;
    return [
      { id:'m1', status:'live',     tournament:'Roland Garros',   round:'QF',  surface:'Clay',  score:'6-4, 3-2*', player1:p[0], player2:p[1] },
      { id:'m2', status:'upcoming', tournament:'Wimbledon',        round:'SF',  surface:'Grass', score:null, date:'Today 15:00',    player1:p[2], player2:p[3] },
      { id:'m3', status:'upcoming', tournament:'US Open',          round:'F',   surface:'Hard',  score:null, date:'Tomorrow 20:00', player1:p[1], player2:p[3] },
      { id:'m4', status:'upcoming', tournament:'Australian Open',  round:'SF',  surface:'Hard',  score:null, date:'Fri 09:00',      player1:p[4], player2:p[5] },
      { id:'m5', status:'upcoming', tournament:'Monte-Carlo',      round:'R32', surface:'Clay',  score:null, date:'Sat 14:00',      player1:p[6], player2:p[7] },
    ];
  },

  get rankings() {
    return this.players.map((p, i) => ({
      ...p,
      points: Math.round(11000 / (i + 1)),
      prev_rank: i === 0 ? 1 : i + 1 + (Math.random() > 0.5 ? 1 : -1),
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