// ─────────────────────────────────────────────────────────────────────────────
// src/services/tennisApi.js – TennisVantage Data Service Layer
//
// ARCHITECTURE: The browser ONLY queries Supabase (single fast round trip).
// RapidAPI is never called from the client — the key stays server-side.
// Edge Functions handle all external API communication in the background.
//
// FALLBACK: If Supabase tables are empty (pre-first-sync), MOCK_DATA is
// returned with a console warning so the UI never crashes.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

// ── Shared DB→UI shape normalizer ────────────────────────────────────────────
// Converts a Supabase match row (with nested player1/player2 objects) into
// the exact shape Dashboard.jsx components expect.
function normalizeMatchForUI(row) {
  if (!row) return null;
  const p1 = row.player1 ?? {};
  const p2 = row.player2 ?? {};
  return {
    id:         row.id,
    status:     row.status,
    tournament: row.tournament,
    round:      row.round ?? '',
    surface:    row.surface ?? 'Hard',
    score:      row.score ?? null,
    // Format date for display: "Today 15:00" or "Mon 14:00"
    date:       formatMatchDate(row.match_date),
    player1: {
      id:              p1.id,
      name:            p1.name ?? 'Unknown',
      flag:            p1.flag ?? '🏳️',
      rank:            p1.rank ?? 999,
      wins:            p1.wins ?? 0,
      losses:          p1.losses ?? 0,
      ace_avg:         p1.ace_avg ?? 5.5,
      surface_pref:    p1.surface_pref ?? 'Hard',
      first_serve_pct: p1.first_serve_pct ?? 60,
      recent_form:     p1.recent_form ?? '- - - - -',
      injury_notes:    p1.injury_notes ?? null,
      fatigue_score:   p1.fatigue_score ?? 0,
    },
    player2: {
      id:              p2.id,
      name:            p2.name ?? 'Unknown',
      flag:            p2.flag ?? '🏳️',
      rank:            p2.rank ?? 999,
      wins:            p2.wins ?? 0,
      losses:          p2.losses ?? 0,
      ace_avg:         p2.ace_avg ?? 5.5,
      surface_pref:    p2.surface_pref ?? 'Hard',
      first_serve_pct: p2.first_serve_pct ?? 60,
      recent_form:     p2.recent_form ?? '- - - - -',
      injury_notes:    p2.injury_notes ?? null,
      fatigue_score:   p2.fatigue_score ?? 0,
    },
  };
}

function formatMatchDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (isToday)    return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ` ${timeStr}`;
}

// ── The single Supabase match query with player join ──────────────────────────
// Using named FK hints ensures Supabase joins the right foreign keys.
const MATCH_SELECT = `
  *,
  player1:players!matches_player1_id_fkey(*),
  player2:players!matches_player2_id_fkey(*)
`;

// ── Live Matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('status', 'live')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[tennisApi] getLiveMatches Supabase error, using mock:', error.message);
    return MOCK_DATA.matches.filter(m => m.status === 'live');
  }
  if (!data || data.length === 0) {
    console.warn('[tennisApi] getLiveMatches: no data in DB yet, using mock');
    return MOCK_DATA.matches.filter(m => m.status === 'live');
  }
  return data.map(normalizeMatchForUI).filter(Boolean);
}

// ── Upcoming Matches ──────────────────────────────────────────────────────────
export async function getUpcomingMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('status', 'upcoming')
    .gte('match_date', new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(20);

  if (error) {
    console.warn('[tennisApi] getUpcomingMatches error, using mock:', error.message);
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
  if (!data || data.length === 0) {
    console.warn('[tennisApi] getUpcomingMatches: no data in DB yet, using mock');
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
  return data.map(normalizeMatchForUI).filter(Boolean);
}

// ── Matches by date (for the Prediction Calendar — Task 3) ───────────────────
export async function getMatchesByDate(dateString) {
  // dateString: 'YYYY-MM-DD'
  const start = new Date(`${dateString}T00:00:00Z`).toISOString();
  const end   = new Date(`${dateString}T23:59:59Z`).toISOString();

  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .in('status', ['live', 'upcoming'])
    .gte('match_date', start)
    .lte('match_date', end)
    .order('match_date', { ascending: true });

  if (error) {
    console.warn('[tennisApi] getMatchesByDate error:', error.message);
    return [];
  }
  return (data ?? []).map(normalizeMatchForUI).filter(Boolean);
}

// ── Rankings ──────────────────────────────────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  const { data, error } = await supabase
    .from('rankings')
    .select('*, players(*)')
    .eq('tour', tour)
    .order('rank', { ascending: true })
    .limit(20);

  if (error) {
    console.warn('[tennisApi] getRankings error, using mock:', error.message);
    return MOCK_DATA.rankings;
  }
  if (!data || data.length === 0) {
    console.warn('[tennisApi] getRankings: no data, using mock');
    return MOCK_DATA.rankings;
  }

  // Flatten player data into ranking row for Dashboard compatibility
  return data.map(row => ({
    ...row.players,
    rank:      row.rank,
    points:    row.points,
    prev_rank: row.prev_rank,
  }));
}

// ── Player stats ──────────────────────────────────────────────────────────────
export async function getPlayerStats(playerId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', String(playerId))
    .single();

  if (error || !data) return MOCK_DATA.players.find(p => p.id === playerId) ?? null;
  return data;
}

// ── Prediction engine (multi-factor, runs client-side on real DB data) ────────
// Weights: rank (25%) | surface (20%) | form (20%) | H2H (15%) | fatigue (10%) | injury (10%)
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;

  if (!p1 || !p2) throw new Error('Match is missing player data');

  // ── 1. Rank edge ─────────────────────────────────────────────────────────
  // tanh normalizes large rank gaps so #1 vs #200 doesn't give 100%
  const rankDelta = (p2.rank ?? 999) - (p1.rank ?? 999);
  const rankEdge  = Math.tanh(rankDelta / 12) * 25;

  // ── 2. Surface edge ───────────────────────────────────────────────────────
  const p1Surface = (p1.surface_pref ?? 'Hard').toLowerCase() === match.surface?.toLowerCase();
  const p2Surface = (p2.surface_pref ?? 'Hard').toLowerCase() === match.surface?.toLowerCase();
  const surfaceEdge = (p1Surface ? 12 : 0) - (p2Surface ? 12 : 0);

  // ── 3. Recent form (last 5 results, recency-weighted) ────────────────────
  const parseForm = (form) => {
    if (!form || form === '- - - - -') return 0;
    const results = form.trim().split(/\s+/);
    return results.reduce((sum, r, i) => {
      const weight = (i + 1) / results.length; // more recent = higher weight
      return sum + (r.toUpperCase() === 'W' ? weight : r.toUpperCase() === 'L' ? -weight : 0);
    }, 0);
  };
  const formEdge = (parseForm(p1.recent_form) - parseForm(p2.recent_form)) * 8;

  // ── 4. Fatigue penalty ────────────────────────────────────────────────────
  const fatigueEdge = ((p2.fatigue_score ?? 0) - (p1.fatigue_score ?? 0)) * 0.25;

  // ── 5. Injury penalty ─────────────────────────────────────────────────────
  const injuryEdge = (p2.injury_notes ? 9 : 0) - (p1.injury_notes ? 9 : 0);

  // ── Total ─────────────────────────────────────────────────────────────────
  const raw       = 50 + rankEdge + surfaceEdge + formEdge + fatigueEdge + injuryEdge;
  const p1WinPct  = Math.min(88, Math.max(12, Math.round(raw)));
  const gap       = Math.abs(p1WinPct - 50);
  const confidence = gap > 22 ? 'High' : gap > 12 ? 'Medium' : 'Low';

  // ── Build detailed factor breakdown (used by upgraded PredictionPanel Task 3)
  const factors = {
    rank: {
      label: `Ranking: #${p1.rank} vs #${p2.rank}`,
      edge: Math.round(rankEdge),
      winner: rankDelta > 0 ? p1.name : p2.name,
    },
    surface: {
      label: `${match.surface} surface preference`,
      edge: Math.round(surfaceEdge),
      winner: p1Surface ? p1.name : p2Surface ? p2.name : 'Neutral',
    },
    form: {
      label: `Recent form: ${p1.recent_form ?? '—'} vs ${p2.recent_form ?? '—'}`,
      edge: Math.round(formEdge),
      winner: formEdge > 0 ? p1.name : formEdge < 0 ? p2.name : 'Even',
    },
    fatigue: {
      label: p1.fatigue_score > 40 || p2.fatigue_score > 40
        ? `Fatigue: ${p1.name} ${p1.fatigue_score} / ${p2.name} ${p2.fatigue_score}`
        : 'Fatigue: Both players fresh',
      edge: Math.round(fatigueEdge),
      winner: fatigueEdge > 0 ? p1.name : fatigueEdge < 0 ? p2.name : 'Even',
    },
    injury: {
      label: p1.injury_notes
        ? `⚠ ${p1.name}: ${p1.injury_notes}`
        : p2.injury_notes
        ? `⚠ ${p2.name}: ${p2.injury_notes}`
        : 'No injury concerns',
      edge: Math.round(injuryEdge),
      winner: injuryEdge > 0 ? p1.name : injuryEdge < 0 ? p2.name : 'Even',
    },
  };

  // Legacy key_factors array (Dashboard.jsx PredictionPanel uses this)
  const key_factors = Object.values(factors).map(f => f.label);

  return {
    player1_win_pct: p1WinPct,
    player2_win_pct: 100 - p1WinPct,
    confidence,
    key_factors,
    factors, // rich breakdown for upgraded panel (Task 3)
  };
}

// ── AI Chat — proxied through Supabase Edge Function ─────────────────────────
// The Anthropic API key lives ONLY in the Edge Function secret.
// This function calls /functions/v1/chat which we build in Task 4.
export async function sendChatMessage(messages, systemContext = '') {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { messages, systemContext },
  });

  if (error) {
    console.warn('[tennisApi] Chat Edge Function error:', error.message);
    // Graceful fallback so the UI doesn't crash while Task 4 is in progress
    return {
      content: [{
        text: `The AI analyst is warming up — the chat Edge Function hasn't been deployed yet. Once \`supabase/functions/chat\` is live, you'll get real answers here!`,
      }],
    };
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — Fallback when Supabase tables are empty (pre-first-sync)
// The app will use this automatically and log a warning in the console.
// Once Edge Functions run, real data replaces this automatically.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA = {
  players: [
    { id: '1', name: 'Jannik Sinner',      country: 'ITA', flag: '🇮🇹', rank: 1, wins: 198, losses: 74,  ace_avg: 5.8, surface_pref: 'Hard', first_serve_pct: 61, recent_form: 'W W W W L', injury_notes: null,                          fatigue_score: 0 },
    { id: '2', name: 'Carlos Alcaraz',     country: 'ESP', flag: '🇪🇸', rank: 2, wins: 214, losses: 63,  ace_avg: 7.1, surface_pref: 'Clay', first_serve_pct: 66, recent_form: 'W W L W W', injury_notes: null,                          fatigue_score: 0 },
    { id: '3', name: 'Novak Djokovic',     country: 'SRB', flag: '🇷🇸', rank: 3, wins: 1104,losses: 214, ace_avg: 6.2, surface_pref: 'Hard', first_serve_pct: 63, recent_form: 'W W W L W', injury_notes: null,                          fatigue_score: 0 },
    { id: '4', name: 'Daniil Medvedev',    country: 'RUS', flag: '🇷🇺', rank: 4, wins: 377, losses: 192, ace_avg: 8.3, surface_pref: 'Hard', first_serve_pct: 59, recent_form: 'L W W W W', injury_notes: null,                          fatigue_score: 0 },
    { id: '5', name: 'Andrey Rublev',      country: 'RUS', flag: '🇷🇺', rank: 5, wins: 344, losses: 187, ace_avg: 5.1, surface_pref: 'Clay', first_serve_pct: 58, recent_form: 'W L W L W', injury_notes: null,                          fatigue_score: 0 },
    { id: '6', name: 'Holger Rune',        country: 'DEN', flag: '🇩🇰', rank: 6, wins: 148, losses: 87,  ace_avg: 6.7, surface_pref: 'Clay', first_serve_pct: 60, recent_form: 'W W L W L', injury_notes: null,                          fatigue_score: 0 },
    { id: '7', name: 'Casper Ruud',        country: 'NOR', flag: '🇳🇴', rank: 7, wins: 258, losses: 139, ace_avg: 5.5, surface_pref: 'Clay', first_serve_pct: 57, recent_form: 'L W W W W', injury_notes: null,                          fatigue_score: 0 },
    { id: '8', name: 'Stefanos Tsitsipas', country: 'GRE', flag: '🇬🇷', rank: 8, wins: 336, losses: 165, ace_avg: 7.9, surface_pref: 'Clay', first_serve_pct: 62, recent_form: 'W L W W L', injury_notes: 'Elbow inflammation (mild)', fatigue_score: 30 },
  ],
  get matches() {
    const p = this.players;
    return [
      { id: 'm1', status: 'live',     tournament: 'Roland Garros',    round: 'QF', surface: 'Clay',  score: '6-4, 3-2', date: 'Live now',       player1: p[0], player2: p[1] },
      { id: 'm2', status: 'upcoming', tournament: 'Wimbledon',         round: 'SF', surface: 'Grass', score: null,        date: 'Today 15:00',   player1: p[2], player2: p[3] },
      { id: 'm3', status: 'upcoming', tournament: 'US Open',           round: 'F',  surface: 'Hard',  score: null,        date: 'Tomorrow 20:00',player1: p[1], player2: p[3] },
      { id: 'm4', status: 'upcoming', tournament: 'Australian Open',   round: 'SF', surface: 'Hard',  score: null,        date: 'Fri 09:00',     player1: p[4], player2: p[5] },
      { id: 'm5', status: 'upcoming', tournament: 'Monte-Carlo Masters',round: 'R32',surface: 'Clay', score: null,        date: 'Sat 14:00',     player1: p[6], player2: p[7] },
    ];
  },
  get rankings() {
    return this.players.map((p, i) => ({
      ...p,
      points:    Math.round(11000 / (i + 1)),
      prev_rank: i + 1 + (i % 2 === 0 ? 1 : -1),
    }));
  },
};