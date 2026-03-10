// src/services/tennisApi.js
import { supabase } from './supabase';

// ── Live matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, status, tournament, round, surface, score, match_date,
        player1:players!matches_player1_id_fkey (id, name, country, flag, rank, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form),
        player2:players!matches_player2_id_fkey (id, name, country, flag, rank, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form)
      `)
      .eq('status', 'live')
      .order('match_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
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
      .select(`
        id, status, tournament, round, surface, score, match_date,
        player1:players!matches_player1_id_fkey (id, name, country, flag, rank, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form),
        player2:players!matches_player2_id_fkey (id, name, country, flag, rank, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form)
      `)
      .eq('status', 'upcoming')
      .order('match_date', { ascending: true })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.error('[getUpcomingMatches]', e.message);
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
}

// ── Matches by date ───────────────────────────────────────────────────────────
export async function getMatchesByDate(dateStr) {
  try {
    const start = `${dateStr}T00:00:00Z`;
    const end   = `${dateStr}T23:59:59Z`;
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, status, tournament, round, surface, score, match_date,
        player1:players!matches_player1_id_fkey (id, name, country, flag, rank, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form),
        player2:players!matches_player2_id_fkey (id, name, country, flag, rank, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form)
      `)
      .gte('match_date', start)
      .lte('match_date', end)
      .order('match_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.error('[getMatchesByDate]', e.message);
    return MOCK_DATA.matches;
  }
}

// ── Rankings (top 10) ─────────────────────────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select(`
        rank, points, prev_rank,
        players (id, name, country, flag, wins, losses, ace_avg, surface_pref, first_serve_pct, recent_form)
      `)
      .eq('tour', tour)
      .order('rank', { ascending: true })
      .limit(10);

    if (error) throw error;

    const rows = (data ?? []).map(r => ({
      ...r.players,
      rank:      r.rank,
      points:    r.points,
      prev_rank: r.prev_rank,
      // If the DB stored a code like "SRB" as the flag, resolve it to an emoji here
      flag:      resolveFlag(r.players?.flag ?? r.players?.country ?? ''),
    }));

    return rows;
  } catch (e) {
    console.error('[getRankings]', e.message);
    return tour === 'WTA' ? MOCK_DATA.rankingsWTA : MOCK_DATA.rankings;
  }
}

// ── Client-side flag resolver (catches any codes that slipped through sync) ───
const FLAG_MAP: Record<string, string> = {
  // Full names
  'Serbia':'🇷🇸','Spain':'🇪🇸','Italy':'🇮🇹','Russia':'🇷🇺','Germany':'🇩🇪',
  'France':'🇫🇷','Great Britain':'🇬🇧','United Kingdom':'🇬🇧','England':'🇬🇧',
  'Norway':'🇳🇴','Denmark':'🇩🇰','Greece':'🇬🇷','Poland':'🇵🇱','Belarus':'🇧🇾',
  'Ukraine':'🇺🇦','Czech Republic':'🇨🇿','Czechia':'🇨🇿','Slovakia':'🇸🇰',
  'Croatia':'🇭🇷','Bulgaria':'🇧🇬','Romania':'🇷🇴','Hungary':'🇭🇺','Austria':'🇦🇹',
  'Switzerland':'🇨🇭','Belgium':'🇧🇪','Netherlands':'🇳🇱','Sweden':'🇸🇪',
  'Finland':'🇫🇮','Portugal':'🇵🇹','Estonia':'🇪🇪','Latvia':'🇱🇻',
  'Lithuania':'🇱🇹','Montenegro':'🇲🇪','Slovenia':'🇸🇮','United States':'🇺🇸',
  'USA':'🇺🇸','Canada':'🇨🇦','Argentina':'🇦🇷','Brazil':'🇧🇷','Chile':'🇨🇱',
  'Uruguay':'🇺🇾','Colombia':'🇨🇴','Mexico':'🇲🇽','Australia':'🇦🇺','Japan':'🇯🇵',
  'China':'🇨🇳','Kazakhstan':'🇰🇿','South Korea':'🇰🇷','Korea':'🇰🇷',
  'Taiwan':'🇹🇼','India':'🇮🇳','Thailand':'🇹🇭','South Africa':'🇿🇦',
  'Tunisia':'🇹🇳','Morocco':'🇲🇦','Egypt':'🇪🇬','Monaco':'🇲🇨',
  // 3-letter ISO
  'SRB':'🇷🇸','ESP':'🇪🇸','ITA':'🇮🇹','RUS':'🇷🇺','GER':'🇩🇪','DEU':'🇩🇪',
  'FRA':'🇫🇷','GBR':'🇬🇧','ENG':'🇬🇧','NOR':'🇳🇴','DEN':'🇩🇰','DNK':'🇩🇰',
  'GRE':'🇬🇷','GRC':'🇬🇷','POL':'🇵🇱','BLR':'🇧🇾','UKR':'🇺🇦','CZE':'🇨🇿',
  'SVK':'🇸🇰','CRO':'🇭🇷','HRV':'🇭🇷','BUL':'🇧🇬','BGR':'🇧🇬','ROU':'🇷🇴',
  'HUN':'🇭🇺','AUT':'🇦🇹','SUI':'🇨🇭','CHE':'🇨🇭','BEL':'🇧🇪','NED':'🇳🇱',
  'NLD':'🇳🇱','SWE':'🇸🇪','FIN':'🇫🇮','POR':'🇵🇹','EST':'🇪🇪','LAT':'🇱🇻',
  'LTU':'🇱🇹','MNE':'🇲🇪','SLO':'🇸🇮','SVN':'🇸🇮','USA':'🇺🇸','CAN':'🇨🇦',
  'ARG':'🇦🇷','BRA':'🇧🇷','CHI':'🇨🇱','CHL':'🇨🇱','URU':'🇺🇾','COL':'🇨🇴',
  'MEX':'🇲🇽','AUS':'🇦🇺','JPN':'🇯🇵','CHN':'🇨🇳','KAZ':'🇰🇿','KOR':'🇰🇷',
  'TPE':'🇹🇼','IND':'🇮🇳','THA':'🇹🇭','RSA':'🇿🇦','TUN':'🇹🇳','MAR':'🇲🇦',
  'EGY':'🇪🇬','MON':'🇲🇨',
  // 2-letter ISO
  'RS':'🇷🇸','ES':'🇪🇸','IT':'🇮🇹','RU':'🇷🇺','DE':'🇩🇪','FR':'🇫🇷',
  'GB':'🇬🇧','NO':'🇳🇴','DK':'🇩🇰','GR':'🇬🇷','PL':'🇵🇱','BY':'🇧🇾',
  'UA':'🇺🇦','CZ':'🇨🇿','SK':'🇸🇰','HR':'🇭🇷','BG':'🇧🇬','RO':'🇷🇴',
  'HU':'🇭🇺','AT':'🇦🇹','CH':'🇨🇭','BE':'🇧🇪','NL':'🇳🇱','SE':'🇸🇪',
  'FI':'🇫🇮','PT':'🇵🇹','EE':'🇪🇪','LV':'🇱🇻','LT':'🇱🇹','ME':'🇲🇪',
  'SI':'🇸🇮','US':'🇺🇸','CA':'🇨🇦','AR':'🇦🇷','BR':'🇧🇷','CL':'🇨🇱',
  'UY':'🇺🇾','CO':'🇨🇴','MX':'🇲🇽','AU':'🇦🇺','JP':'🇯🇵','CN':'🇨🇳',
  'KZ':'🇰🇿','KR':'🇰🇷','TW':'🇹🇼','IN':'🇮🇳','TH':'🇹🇭','ZA':'🇿🇦',
  'TN':'🇹🇳','MA':'🇲🇦',
};

function resolveFlag(raw: string): string {
  if (!raw) return '🏳️';
  // If it's already an emoji flag (starts with a regional indicator), return as-is
  if (raw.codePointAt(0)! >= 0x1F1E0) return raw;
  const attempts = [raw, raw.trim(), raw.trim().toUpperCase(), raw.trim().replace(/\b\w/g, c => c.toUpperCase())];
  for (const a of attempts) {
    if (FLAG_MAP[a]) return FLAG_MAP[a];
  }
  return '🏳️';
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
    return { ...data, flag: resolveFlag(data?.flag ?? data?.country ?? '') };
  } catch (e) {
    console.error('[getPlayerStats]', e.message);
    return [...MOCK_DATA.rankings, ...MOCK_DATA.rankingsWTA].find(p => p.id === playerId) ?? null;
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

// ── AI Chat — calls Vercel /api/chat (Gemini) ─────────────────────────────────
export async function sendChatMessage(messages, systemContext = '') {
  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? `AI service error (${res.status})`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — shown when Supabase is unreachable. Top 10 only.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA = {

  // ── ATP Top 10 ──────────────────────────────────────────────────────────────
  rankings: [
    { id:'1',  name:'Jannik Sinner',    country:'Italy',         flag:'🇮🇹', rank:1,  points:11330, prev_rank:1,  wins:218,  losses:59,  ace_avg:5.8,  surface_pref:'Hard', first_serve_pct:62, recent_form:'W W W W L' },
    { id:'2',  name:'Carlos Alcaraz',   country:'Spain',         flag:'🇪🇸', rank:2,  points:9255,  prev_rank:2,  wins:222,  losses:67,  ace_avg:7.1,  surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W' },
    { id:'3',  name:'Novak Djokovic',   country:'Serbia',        flag:'🇷🇸', rank:3,  points:8310,  prev_rank:3,  wins:1104, losses:214, ace_avg:6.2,  surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L W' },
    { id:'4',  name:'Alexander Zverev', country:'Germany',       flag:'🇩🇪', rank:4,  points:7145,  prev_rank:4,  wins:407,  losses:185, ace_avg:9.1,  surface_pref:'Clay', first_serve_pct:61, recent_form:'W L W W W' },
    { id:'5',  name:'Daniil Medvedev',  country:'Russia',        flag:'🇷🇺', rank:5,  points:6820,  prev_rank:5,  wins:380,  losses:193, ace_avg:8.3,  surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W' },
    { id:'6',  name:'Andrey Rublev',    country:'Russia',        flag:'🇷🇺', rank:6,  points:4325,  prev_rank:7,  wins:346,  losses:188, ace_avg:6.8,  surface_pref:'Hard', first_serve_pct:58, recent_form:'W W L W L' },
    { id:'7',  name:'Casper Ruud',      country:'Norway',        flag:'🇳🇴', rank:7,  points:4175,  prev_rank:6,  wins:250,  losses:131, ace_avg:4.2,  surface_pref:'Clay', first_serve_pct:60, recent_form:'L W W L W' },
    { id:'8',  name:'Hubert Hurkacz',   country:'Poland',        flag:'🇵🇱', rank:8,  points:3965,  prev_rank:8,  wins:282,  losses:166, ace_avg:11.2, surface_pref:'Hard', first_serve_pct:65, recent_form:'W W W W W' },
    { id:'9',  name:'Taylor Fritz',     country:'United States', flag:'🇺🇸', rank:9,  points:3750,  prev_rank:10, wins:248,  losses:149, ace_avg:8.8,  surface_pref:'Hard', first_serve_pct:64, recent_form:'W W L W W' },
    { id:'10', name:'Tommy Paul',       country:'United States', flag:'🇺🇸', rank:10, points:3180,  prev_rank:9,  wins:214,  losses:129, ace_avg:7.4,  surface_pref:'Hard', first_serve_pct:62, recent_form:'W L W L W' },
  ],

  // ── WTA Top 10 ──────────────────────────────────────────────────────────────
  rankingsWTA: [
    { id:'w1',  name:'Aryna Sabalenka',   country:'Belarus',       flag:'🇧🇾', rank:1,  points:10940, prev_rank:1,  wins:320, losses:121, ace_avg:4.8, surface_pref:'Hard',  first_serve_pct:64, recent_form:'W W W W W' },
    { id:'w2',  name:'Iga Świątek',       country:'Poland',        flag:'🇵🇱', rank:2,  points:9545,  prev_rank:2,  wins:412, losses:97,  ace_avg:3.1, surface_pref:'Clay',  first_serve_pct:68, recent_form:'W W L W W' },
    { id:'w3',  name:'Coco Gauff',        country:'United States', flag:'🇺🇸', rank:3,  points:7290,  prev_rank:3,  wins:220, losses:96,  ace_avg:5.6, surface_pref:'Hard',  first_serve_pct:62, recent_form:'W L W W W' },
    { id:'w4',  name:'Elena Rybakina',    country:'Kazakhstan',    flag:'🇰🇿', rank:4,  points:6880,  prev_rank:4,  wins:292, losses:113, ace_avg:9.2, surface_pref:'Grass', first_serve_pct:67, recent_form:'W W W L W' },
    { id:'w5',  name:'Jessica Pegula',    country:'United States', flag:'🇺🇸', rank:5,  points:5880,  prev_rank:6,  wins:226, losses:116, ace_avg:4.5, surface_pref:'Hard',  first_serve_pct:61, recent_form:'L W W W L' },
    { id:'w6',  name:'Qinwen Zheng',      country:'China',         flag:'🇨🇳', rank:6,  points:5240,  prev_rank:5,  wins:190, losses:97,  ace_avg:6.2, surface_pref:'Hard',  first_serve_pct:63, recent_form:'W W W L W' },
    { id:'w7',  name:'Mirra Andreeva',    country:'Russia',        flag:'🇷🇺', rank:7,  points:4090,  prev_rank:9,  wins:150, losses:79,  ace_avg:4.8, surface_pref:'Clay',  first_serve_pct:60, recent_form:'W W L W W' },
    { id:'w8',  name:'Daria Kasatkina',   country:'Russia',        flag:'🇷🇺', rank:8,  points:3870,  prev_rank:7,  wins:298, losses:171, ace_avg:3.9, surface_pref:'Clay',  first_serve_pct:59, recent_form:'W L W W L' },
    { id:'w9',  name:'Emma Navarro',      country:'United States', flag:'🇺🇸', rank:9,  points:3210,  prev_rank:10, wins:164, losses:89,  ace_avg:5.1, surface_pref:'Hard',  first_serve_pct:61, recent_form:'W W W W L' },
    { id:'w10', name:'Barbora Krejčíková',country:'Czech Republic',flag:'🇨🇿', rank:10, points:2990,  prev_rank:8,  wins:286, losses:149, ace_avg:4.4, surface_pref:'Clay',  first_serve_pct:62, recent_form:'L W L W W' },
  ],

  // ── Players (combined for match lookups) ─────────────────────────────────────
  get players() {
    return [...this.rankings, ...this.rankingsWTA];
  },

  // ── Matches ──────────────────────────────────────────────────────────────────
  get matches() {
    const a = this.rankings;
    const w = this.rankingsWTA;
    return [
      { id:'m1', status:'live',     tournament:'Miami Open',     round:'QF',  surface:'Hard', score:'6-4 3-2', date: new Date().toISOString(), player1:a[0], player2:a[1] },
      { id:'m2', status:'live',     tournament:'Miami Open',     round:'QF',  surface:'Hard', score:'7-5 2-4', date: new Date().toISOString(), player1:a[2], player2:a[4] },
      { id:'m3', status:'upcoming', tournament:'Miami Open',     round:'SF',  surface:'Hard', score:null,      date: new Date().toISOString(), player1:a[3], player2:a[7] },
      { id:'m4', status:'upcoming', tournament:'Madrid Open',    round:'R64', surface:'Clay', score:null,      date: new Date().toISOString(), player1:a[1], player2:a[6] },
      { id:'m5', status:'upcoming', tournament:'WTA Miami Open', round:'QF',  surface:'Hard', score:null,      date: new Date().toISOString(), player1:w[0], player2:w[2] },
    ];
  },

  // ── H2H ──────────────────────────────────────────────────────────────────────
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