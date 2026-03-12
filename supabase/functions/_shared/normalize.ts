// supabase/functions/_shared/normalize.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for ALL TennisApi1 response normalization.
//
// CONFIRMED SHAPES (from live API screenshots):
//
// tennisEventsByDate + liveTennisMatches — identical event shape:
//   { id, startTimestamp, winnerCode, firstToServe, homeTeamSeed, awayTeamSeed,
//     tournament: { name, slug, category: { name:"ATP"|"WTA", slug:"atp"|"wta" },
//                   uniqueTournament: { name, groundType? } },
//     season: { name, year, id },
//     roundInfo: { round, name, slug, cupRoundType },
//     status: { code, description, type: "notstarted"|"inprogress"|"finished" },
//     homeTeam: { id, name, slug, shortName, nameCode, gender,
//                 country: { alpha2, alpha3, name, slug } },
//     awayTeam: { id, name, slug, shortName, nameCode, gender,
//                 country: { alpha2, alpha3, name, slug } },
//     homeScore: { current, display, period1, period2, period3,
//                  period1TieBreak, period2TieBreak, period3TieBreak,
//                  point, normaltime },
//     awayScore: { ...same },
//     groundType: "Hardcourt outdoor"|"Clay"|"Grass" (present on live matches) }
//
// atpRankings / wtaRankings — flat array, each item:
//   { ranking, points, previousRanking, previousPoints, bestRanking,
//     id, rowName, rankingClass:"team",
//     country: { alpha2, alpha3, name, slug },   ← root-level country
//     team: { id, name, slug, shortName, nameCode, gender, ranking,
//             userCount, disabled, national, type,
//             country: { alpha2, alpha3, name, slug },   ← also on team
//             teamColors, fieldTranslations } }
//
// tennisPlayerDetails — { team: { ...21 keys,
//   playerTeamInfo: { birthplace, height, plays, turnedPro, prizeCurrent,
//                     prizeTotal, id, birthDateTimestamp,
//                     prizeCurrentRaw, prizeTotalRaw },
//   currentRanking, ranking, nameCode,
//   category: { name:"WTA"|"ATP", slug },
//   country: { alpha2, alpha3, name, slug } } }
//
// tennisPlayersAndTournaments — { results: [{ entity: { id, name, nameCode,
//   slug, national, sport, userCount, teamColors, type, gender, score,
//   country: { alpha2, name, slug },
//   playerTeamInfo: { ... } } }] }
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerRow {
  id: string;
  name: string;
  country: string;
  flag: string;
  rank: number;
  wins: number;
  losses: number;
  ace_avg: number;
  surface_pref: string;
  first_serve_pct: number;
  recent_form: string;
  injury_notes: string | null;
  fatigue_score: number;
}

export interface MatchRow {
  id: string;
  status: 'live' | 'upcoming' | 'finished';
  tournament: string;
  round: string;
  surface: string;
  score: string | null;
  match_date: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
}

export interface RankingRow {
  player_id: string;
  tour: 'ATP' | 'WTA';
  rank: number;
  points: number;
  prev_rank: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLAG MAP
// Covers alpha3 (primary — confirmed from screenshots), alpha2 (fallback),
// full name (fallback). All three formats confirmed in real responses.
// ─────────────────────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  // Full names (confirmed: "Spain", "Belarus", "Switzerland", "Russia")
  'Serbia': '🇷🇸', 'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Russia': '🇷🇺',
  'Germany': '🇩🇪', 'France': '🇫🇷', 'Great Britain': '🇬🇧',
  'United Kingdom': '🇬🇧', 'Norway': '🇳🇴', 'Denmark': '🇩🇰',
  'Greece': '🇬🇷', 'Poland': '🇵🇱', 'Belarus': '🇧🇾', 'Ukraine': '🇺🇦',
  'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿', 'Slovakia': '🇸🇰',
  'Croatia': '🇭🇷', 'Bulgaria': '🇧🇬', 'Romania': '🇷🇴',
  'Hungary': '🇭🇺', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  'Belgium': '🇧🇪', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪',
  'Finland': '🇫🇮', 'Portugal': '🇵🇹', 'Estonia': '🇪🇪',
  'Latvia': '🇱🇻', 'Lithuania': '🇱🇹', 'Montenegro': '🇲🇪',
  'Slovenia': '🇸🇮', 'United States': '🇺🇸', 'USA': '🇺🇸',
  'Canada': '🇨🇦', 'Argentina': '🇦🇷', 'Brazil': '🇧🇷',
  'Chile': '🇨🇱', 'Uruguay': '🇺🇾', 'Colombia': '🇨🇴',
  'Mexico': '🇲🇽', 'Australia': '🇦🇺', 'Japan': '🇯🇵',
  'China': '🇨🇳', 'Kazakhstan': '🇰🇿', 'South Korea': '🇰🇷',
  'Korea': '🇰🇷', 'Taiwan': '🇹🇼', 'India': '🇮🇳',
  'Thailand': '🇹🇭', 'South Africa': '🇿🇦', 'Tunisia': '🇹🇳',
  'Morocco': '🇲🇦', 'Egypt': '🇪🇬', 'Monaco': '🇲🇨',
  'Slovakia': '🇸🇰', 'Luxembourg': '🇱🇺', 'Georgia': '🇬🇪',
  'Armenia': '🇦🇲', 'Bosnia': '🇧🇦',
  // Alpha-3 (confirmed: "ESP", "BLR", "CHE", "RUS")
  'SRB': '🇷🇸', 'ESP': '🇪🇸', 'ITA': '🇮🇹', 'RUS': '🇷🇺',
  'GER': '🇩🇪', 'DEU': '🇩🇪', 'FRA': '🇫🇷', 'GBR': '🇬🇧',
  'ENG': '🇬🇧', 'NOR': '🇳🇴', 'DEN': '🇩🇰', 'DNK': '🇩🇰',
  'GRE': '🇬🇷', 'GRC': '🇬🇷', 'POL': '🇵🇱', 'BLR': '🇧🇾',
  'UKR': '🇺🇦', 'CZE': '🇨🇿', 'SVK': '🇸🇰', 'CRO': '🇭🇷',
  'HRV': '🇭🇷', 'BUL': '🇧🇬', 'BGR': '🇧🇬', 'ROU': '🇷🇴',
  'HUN': '🇭🇺', 'AUT': '🇦🇹', 'SUI': '🇨🇭', 'CHE': '🇨🇭',
  'BEL': '🇧🇪', 'NED': '🇳🇱', 'NLD': '🇳🇱', 'SWE': '🇸🇪',
  'FIN': '🇫🇮', 'POR': '🇵🇹', 'EST': '🇪🇪', 'LAT': '🇱🇻',
  'LTU': '🇱🇹', 'MNE': '🇲🇪', 'SLO': '🇸🇮', 'SVN': '🇸🇮',
  'USA': '🇺🇸', 'CAN': '🇨🇦', 'ARG': '🇦🇷', 'BRA': '🇧🇷',
  'CHI': '🇨🇱', 'CHL': '🇨🇱', 'URU': '🇺🇾', 'COL': '🇨🇴',
  'MEX': '🇲🇽', 'AUS': '🇦🇺', 'JPN': '🇯🇵', 'CHN': '🇨🇳',
  'KAZ': '🇰🇿', 'KOR': '🇰🇷', 'TPE': '🇹🇼', 'IND': '🇮🇳',
  'THA': '🇹🇭', 'RSA': '🇿🇦', 'TUN': '🇹🇳', 'MAR': '🇲🇦',
  'EGY': '🇪🇬', 'MON': '🇲🇨', 'LUX': '🇱🇺', 'GEO': '🇬🇪',
  'ARM': '🇦🇲', 'BIH': '🇧🇦',
  // Alpha-2 (confirmed: "ES", "BY", "CH", "RU")
  'RS': '🇷🇸', 'ES': '🇪🇸', 'IT': '🇮🇹', 'RU': '🇷🇺',
  'DE': '🇩🇪', 'FR': '🇫🇷', 'GB': '🇬🇧', 'NO': '🇳🇴',
  'DK': '🇩🇰', 'GR': '🇬🇷', 'PL': '🇵🇱', 'BY': '🇧🇾',
  'UA': '🇺🇦', 'CZ': '🇨🇿', 'SK': '🇸🇰', 'HR': '🇭🇷',
  'BG': '🇧🇬', 'RO': '🇷🇴', 'HU': '🇭🇺', 'AT': '🇦🇹',
  'CH': '🇨🇭', 'BE': '🇧🇪', 'NL': '🇳🇱', 'SE': '🇸🇪',
  'FI': '🇫🇮', 'PT': '🇵🇹', 'EE': '🇪🇪', 'LV': '🇱🇻',
  'LT': '🇱🇹', 'ME': '🇲🇪', 'SI': '🇸🇮', 'US': '🇺🇸',
  'CA': '🇨🇦', 'AR': '🇦🇷', 'BR': '🇧🇷', 'CL': '🇨🇱',
  'UY': '🇺🇾', 'CO': '🇨🇴', 'MX': '🇲🇽', 'AU': '🇦🇺',
  'JP': '🇯🇵', 'CN': '🇨🇳', 'KZ': '🇰🇿', 'KR': '🇰🇷',
  'TW': '🇹🇼', 'IN': '🇮🇳', 'TH': '🇹🇭', 'ZA': '🇿🇦',
  'TN': '🇹🇳', 'MA': '🇲🇦', 'LU': '🇱🇺', 'GE': '🇬🇪',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function resolveFlag(raw: string): string {
  if (!raw) return '🏳️';
  for (const attempt of [raw, raw.trim(), raw.trim().toUpperCase()]) {
    if (FLAG_MAP[attempt]) return FLAG_MAP[attempt];
  }
  console.warn(`[FLAG] Unresolved: "${raw}"`);
  return '🏳️';
}

// Extracts country string from a player/team object.
// Confirmed shape: country: { alpha2, alpha3, name, slug }
// We prefer alpha3 as it's most consistently present.
export function extractCountry(obj: any): string {
  return String(
    obj?.country?.alpha3 ??
    obj?.country?.alpha2 ??
    obj?.country?.name   ??
    ''
  );
}

// Maps TennisApi1 status.type → our internal status
// Confirmed values from screenshots:
//   type: "notstarted"  → upcoming
//   type: "inprogress"  → live  (code: 8, description: "1st set")
//   type: "finished"    → finished (code: 100, description: "Ended")
export function resolveStatus(statusObj: any): 'live' | 'upcoming' | 'finished' {
  const type = String(statusObj?.type ?? '').toLowerCase();
  const code = Number(statusObj?.code ?? -1);
  if (type === 'inprogress') return 'live';
  if (type === 'finished' || code === 100 || code === 31) return 'finished';
  return 'upcoming';
}

// Resolves surface using groundType first (confirmed present on live matches),
// then falls back to tournament/season name heuristic.
// Confirmed groundType values: "Hardcourt outdoor", "Clay", "Grass"
export function resolveSurface(event: any): string {
  const groundType = String(
    event?.groundType ??
    event?.tournament?.uniqueTournament?.groundType ??
    ''
  ).toLowerCase();

  if (groundType.includes('clay'))  return 'Clay';
  if (groundType.includes('grass')) return 'Grass';
  if (groundType.includes('hard'))  return 'Hard';

  // Fallback: parse tournament + season name
  const str = [
    event?.tournament?.uniqueTournament?.name ?? '',
    event?.tournament?.name ?? '',
    event?.season?.name ?? '',
  ].join(' ').toLowerCase();

  if (str.includes('clay') || str.includes('roland') || str.includes('monte') ||
      str.includes('madrid') || str.includes('rome') || str.includes('barcelona') ||
      str.includes('hamburg') || str.includes('munich') || str.includes('estoril') ||
      str.includes('bucharest') || str.includes('bastad') || str.includes('gstaad') ||
      str.includes('lyon') || str.includes('geneva') || str.includes('marrakech') ||
      str.includes('istanbul') || str.includes('houston') || str.includes('bogota'))
    return 'Clay';

  if (str.includes('grass') || str.includes('wimbledon') || str.includes("queen") ||
      str.includes('halle') || str.includes('eastbourne') || str.includes('hertogenbosch') ||
      str.includes('newport') || str.includes('mallorca') || str.includes("s-hertogenbosch"))
    return 'Grass';

  return 'Hard';
}

// Determines ATP or WTA from the event's tournament category.
// Confirmed: tournament.category.name = "ATP", slug = "atp" / "wta"
export function resolveTour(event: any): 'ATP' | 'WTA' | null {
  const slug = String(
    event?.tournament?.category?.slug ?? ''
  ).toLowerCase();
  if (slug === 'atp') return 'ATP';
  if (slug === 'wta') return 'WTA';
  const name = String(
    event?.tournament?.category?.name ?? ''
  ).toUpperCase();
  if (name === 'ATP') return 'ATP';
  if (name === 'WTA') return 'WTA';
  return null; // ITF, Challenger, etc. — we skip these
}

// Builds a human-readable score string from confirmed homeScore/awayScore shape:
// { current, display, period1, period2, period3,
//   period1TieBreak, period2TieBreak, period3TieBreak, point, normaltime }
export function buildScore(homeScore: any, awayScore: any): string | null {
  if (!homeScore || !awayScore) return null;

  const sets: string[] = [];
  for (const p of ['period1', 'period2', 'period3'] as const) {
    const h = homeScore[p];
    const a = awayScore[p];
    if (h == null || a == null) continue;

    const hTb = homeScore[`${p}TieBreak` as keyof typeof homeScore];
    const aTb = awayScore[`${p}TieBreak` as keyof typeof awayScore];

    // Show tiebreak score if one player won 7 and there's a tiebreak value
    if (hTb != null && aTb != null && (Number(h) === 7 || Number(a) === 7)) {
      const loser = Math.min(Number(hTb), Number(aTb));
      sets.push(`${h}-${a}(${loser})`);
    } else {
      sets.push(`${h}-${a}`);
    }
  }

  // In-progress: show current game score with asterisk
  if (sets.length === 0) {
    const h = homeScore.current ?? homeScore.display;
    const a = awayScore.current ?? awayScore.display;
    if (h != null && a != null) return `${h}-${a}*`;
    return null;
  }

  return sets.join(', ');
}

// Generic array extractor — handles all TennisApi1 root shapes
// Confirmed: "events" for match endpoints, flat array for rankings
export function extractArray(data: any): any[] {
  if (Array.isArray(data))            return data;
  if (Array.isArray(data?.events))    return data.events;    // confirmed
  if (Array.isArray(data?.results))   return data.results;   // search endpoint
  if (Array.isArray(data?.rankings))  return data.rankings;
  if (Array.isArray(data?.data))      return data.data;
  console.warn('[extractArray] Unknown shape:', JSON.stringify(data).slice(0, 200));
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE EVENT
// Works for both tennisEventsByDate and liveTennisMatches (identical shape).
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeEvent(raw: any): {
  match: MatchRow;
  player1: PlayerRow;
  player2: PlayerRow;
} | null {
  const id = String(raw?.id ?? '');
  if (!id) return null;

  // Players confirmed as homeTeam / awayTeam
  const home = raw.homeTeam ?? {};
  const away = raw.awayTeam ?? {};

  const p1Name = String(home?.name ?? home?.shortName ?? '');
  const p2Name = String(away?.name ?? away?.shortName ?? '');
  if (!p1Name || !p2Name) return null;

  // IDs are numeric integers in the API — stringify for DB
  const p1Id = String(home?.id ?? '');
  const p2Id = String(away?.id ?? '');
  if (!p1Id || !p2Id) return null;

  const status   = resolveStatus(raw.status);
  const surface  = resolveSurface(raw);

  // Tournament name: prefer uniqueTournament (cleaner, e.g. "Indian Wells")
  // over tournament.name (e.g. "Indian Wells, USA")
  const tournamentName = String(
    raw.tournament?.uniqueTournament?.name ??
    raw.tournament?.name ??
    'Unknown'
  );

  // Round: confirmed roundInfo.name = "Quarterfinals", "Round of 16", etc.
  const round = String(raw.roundInfo?.name ?? raw.roundInfo?.round ?? '');

  // Score from confirmed period structure
  const score = buildScore(raw.homeScore, raw.awayScore);

  // Date: confirmed startTimestamp is UNIX seconds
  const match_date = raw.startTimestamp
    ? new Date(Number(raw.startTimestamp) * 1000).toISOString()
    : new Date().toISOString();

  // Winner: confirmed winnerCode 1 = homeTeam, 2 = awayTeam
  let winner_id: string | null = null;
  if (raw.winnerCode === 1) winner_id = p1Id;
  else if (raw.winnerCode === 2) winner_id = p2Id;

  const p1Country = extractCountry(home);
  const p2Country = extractCountry(away);

  const match: MatchRow = {
    id, status, tournament: tournamentName, round,
    surface, score, match_date,
    player1_id: p1Id,
    player2_id: p2Id,
    winner_id,
  };

  const player1: PlayerRow = {
    id: p1Id, name: p1Name,
    country: p1Country,
    flag: resolveFlag(p1Country),
    rank: Number(home?.ranking ?? 999),
    wins: 0, losses: 0, ace_avg: 5.5,
    surface_pref: surface,
    first_serve_pct: 60,
    recent_form: '- - - - -',
    injury_notes: null, fatigue_score: 0,
  };

  const player2: PlayerRow = {
    id: p2Id, name: p2Name,
    country: p2Country,
    flag: resolveFlag(p2Country),
    rank: Number(away?.ranking ?? 999),
    wins: 0, losses: 0, ace_avg: 5.5,
    surface_pref: surface,
    first_serve_pct: 60,
    recent_form: '- - - - -',
    injury_notes: null, fatigue_score: 0,
  };

  return { match, player1, player2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE RANKING ROW
// Confirmed shape (both ATP and WTA identical structure):
//   { ranking, points, previousRanking, previousPoints, bestRanking,
//     id, rowName, rankingClass: "team",
//     country: { alpha2, alpha3, name, slug },   ← root level
//     team: { id, name, slug, shortName, nameCode, gender, ranking,
//             country: { alpha2, alpha3, name, slug } } }
//
// IMPORTANT: player ID = team.id (NOT the root id field)
// Root id (e.g. 701) is the ranking-row ID, NOT the player ID.
// team.id (e.g. 275923) is the stable player/team ID used everywhere else.
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeRankingRow(
  raw: any,
  tour: 'ATP' | 'WTA',
  index: number
): { player: PlayerRow; ranking: RankingRow } {
  const team = raw.team ?? {};

  // Use team.id as the stable player ID
  const id   = String(team?.id ?? raw?.id ?? `${tour.toLowerCase()}-${index}`);
  const name = String(team?.name ?? raw?.rowName ?? 'Unknown');

  // Ranking fields confirmed at root level
  const rank     = Number(raw.ranking         ?? index + 1);
  const points   = Number(raw.points          ?? 0);
  const prevRank = Number(raw.previousRanking ?? rank);

  // Country: team.country has alpha2/alpha3/name — confirmed
  const countryObj = team?.country ?? {};
  const country = String(
    countryObj?.alpha3 ??
    countryObj?.alpha2 ??
    countryObj?.name   ??
    raw?.country?.alpha3 ??  // fallback to root-level country
    raw?.country?.alpha2 ??
    raw?.country?.name   ??
    ''
  );
  const flag = resolveFlag(country);

  const player: PlayerRow = {
    id, name, country, flag, rank,
    wins: 0, losses: 0,
    ace_avg: 5.5,
    surface_pref: 'Hard',
    first_serve_pct: 60,
    recent_form: '- - - - -',
    injury_notes: null,
    fatigue_score: 0,
  };

  const ranking: RankingRow = {
    player_id: id,
    tour,
    rank,
    points,
    prev_rank: prevRank,
  };

  return { player, ranking };
}