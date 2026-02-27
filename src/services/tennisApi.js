// ─────────────────────────────────────────────────────────────────────────────
// tennisApi.js  –  TennisVantage API service layer
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  RECOMMENDED API: "API-Tennis" on RapidAPI                             │
// │  URL: https://rapidapi.com/api-sports/api/api-tennis                   │
// │  Data: live scores, player stats, H2H, odds, rankings, tournaments     │
// │  Free tier: 100 req/day  |  Pro: $10/mo                                │
// │                                                                         │
// │  TO ACTIVATE:                                                           │
// │  1. Subscribe at the link above, grab your RapidAPI key                │
// │  2. Add to your .env:  VITE_RAPIDAPI_KEY=your_key_here                 │
// │  3. Remove the mock return in each function, uncomment the fetch call  │
// └─────────────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL  = 'https://api-tennis.p.rapidapi.com';
const API_KEY   = import.meta.env?.VITE_RAPIDAPI_KEY ?? '';
const HEADERS   = { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': 'api-tennis.p.rapidapi.com' };

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) throw new Error(`API_ERROR:${res.status}`);
  return res.json();
}

// ── Live matches ─────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  // return apiFetch('/matches', { status: 'live', timezone: 'Europe/Zagreb' });
  return MOCK_DATA.matches.filter(m => m.status === 'live');
}

// ── Upcoming matches ─────────────────────────────────────────────────────────
export async function getUpcomingMatches() {
  // return apiFetch('/matches', { status: 'scheduled', timezone: 'Europe/Zagreb' });
  return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
}

// ── Rankings ─────────────────────────────────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  // return apiFetch('/rankings', { tour });
  return MOCK_DATA.rankings;
}

// ── Player stats ─────────────────────────────────────────────────────────────
export async function getPlayerStats(playerId) {
  // return apiFetch('/player/statistics', { player_id: playerId });
  return MOCK_DATA.players.find(p => p.id === playerId) ?? null;
}

// ── Head to head ─────────────────────────────────────────────────────────────
export async function getHeadToHead(p1Id, p2Id) {
  // return apiFetch('/head2head', { player1_id: p1Id, player2_id: p2Id });
  return MOCK_DATA.h2h;
}

// ── Prediction engine ────────────────────────────────────────────────────────
// Swap this entire function body for your ML model API call.
// Output shape is the contract the rest of the UI depends on.
export async function getPrediction(match) {
  // Real call example:
  // return fetch('/api/predict', {
  //   method: 'POST', headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(match),
  // }).then(r => r.json());

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
// Replace body with your real AI endpoint (Anthropic / OpenAI / Gemini)
export async function sendChatMessage(messages) {
  // const res = await fetch('https://api.anthropic.com/v1/messages', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'x-api-key': YOUR_KEY },
  //   body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 512, messages }),
  // });
  // return res.json();

  await new Promise(r => setTimeout(r, 900)); // simulate latency
  const last = messages[messages.length - 1]?.content ?? '';
  return {
    content: [{ text: `[AI stub] You asked: "${last}". Connect your AI model in tennisApi.js → sendChatMessage() to get real answers!` }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOCK DATA  (remove once real API is wired)
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
