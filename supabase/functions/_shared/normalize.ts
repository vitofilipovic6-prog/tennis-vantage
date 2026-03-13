// ─────────────────────────────────────────────────────────────────────────────
// supabase/functions/_shared/normalize.ts
//
// CHANGES IN THIS VERSION:
//  + MatchRow interface now includes match_type and winner_id fields
//  + resolveMatchType() — detects ATP/WTA/Mixed Doubles from player gender + name slash
//  + resolveTour()      — fixed: uses homeTeam.gender first, so WTA Grand Slams are
//                         not miscategorised as ATP (category.slug = "atp" for both)
//  + normalizeEvent()   — new primary entry point for tennisapi1 response shape
//  All prior helpers preserved: detectSurface, slugify, normalizeMatch (legacy),
//  normalizePlayerFromMatch, normalizeRanking
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
  match_date: string; // ISO string
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  match_type: 'atp_singles' | 'wta_singles' | 'atp_doubles' | 'wta_doubles' | 'mixed_doubles';
}

export interface RankingRow {
  player_id: string;
  tour: 'ATP' | 'WTA';
  rank: number;
  points: number;
  prev_rank: number | null;
}

// ── Country ISO → Flag emoji lookup ──────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  // Full country names
  'Serbia': '🇷🇸', 'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Russia': '🇷🇺',
  'Germany': '🇩🇪', 'France': '🇫🇷', 'Great Britain': '🇬🇧', 'United Kingdom': '🇬🇧',
  'England': '🇬🇧', 'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Greece': '🇬🇷',
  'Poland': '🇵🇱', 'Belarus': '🇧🇾', 'Ukraine': '🇺🇦', 'Czech Republic': '🇨🇿',
  'Czechia': '🇨🇿', 'Slovakia': '🇸🇰', 'Croatia': '🇭🇷', 'Bulgaria': '🇧🇬',
  'Romania': '🇷🇴', 'Hungary': '🇭🇺', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  'Belgium': '🇧🇪', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Finland': '🇫🇮',
  'Portugal': '🇵🇹', 'Estonia': '🇪🇪', 'Latvia': '🇱🇻', 'Lithuania': '🇱🇹',
  'Montenegro': '🇲🇪', 'Slovenia': '🇸🇮', 'United States': '🇺🇸', 'USA': '🇺🇸',
  'Canada': '🇨🇦', 'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Chile': '🇨🇱',
  'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Mexico': '🇲🇽', 'Australia': '🇦🇺',
  'Japan': '🇯🇵', 'China': '🇨🇳', 'Kazakhstan': '🇰🇿', 'South Korea': '🇰🇷',
  'Korea': '🇰🇷', 'Taiwan': '🇹🇼', 'India': '🇮🇳', 'Thailand': '🇹🇭',
  'South Africa': '🇿🇦', 'Tunisia': '🇹🇳', 'Morocco': '🇲🇦', 'Egypt': '🇪🇬',
  'Monaco': '🇲🇨',
  // 3-letter ISO
  'SRB': '🇷🇸', 'ESP': '🇪🇸', 'ITA': '🇮🇹', 'RUS': '🇷🇺', 'GER': '🇩🇪',
  'DEU': '🇩🇪', 'FRA': '🇫🇷', 'GBR': '🇬🇧', 'NOR': '🇳🇴', 'DEN': '🇩🇰',
  'DNK': '🇩🇰', 'GRE': '🇬🇷', 'GRC': '🇬🇷', 'POL': '🇵🇱', 'BLR': '🇧🇾',
  'UKR': '🇺🇦', 'CZE': '🇨🇿', 'SVK': '🇸🇰', 'CRO': '🇭🇷', 'HRV': '🇭🇷',
  'BUL': '🇧🇬', 'BGR': '🇧🇬', 'ROU': '🇷🇴', 'HUN': '🇭🇺', 'AUT': '🇦🇹',
  'SUI': '🇨🇭', 'CHE': '🇨🇭', 'BEL': '🇧🇪', 'NED': '🇳🇱', 'NLD': '🇳🇱',
  'SWE': '🇸🇪', 'FIN': '🇫🇮', 'POR': '🇵🇹', 'EST': '🇪🇪', 'LAT': '🇱🇻',
  'LTU': '🇱🇹', 'MNE': '🇲🇪', 'SVN': '🇸🇮', 'USA': '🇺🇸', 'CAN': '🇨🇦',
  'ARG': '🇦🇷', 'BRA': '🇧🇷', 'CHI': '🇨🇱', 'CHL': '🇨🇱', 'URU': '🇺🇾',
  'COL': '🇨🇴', 'MEX': '🇲🇽', 'AUS': '🇦🇺', 'JPN': '🇯🇵', 'CHN': '🇨🇳',
  'KAZ': '🇰🇿', 'KOR': '🇰🇷', 'TWN': '🇹🇼', 'IND': '🇮🇳', 'THA': '🇹🇭',
  'RSA': '🇿🇦', 'ZAF': '🇿🇦', 'TUN': '🇹🇳', 'MAR': '🇲🇦', 'EGY': '🇪🇬',
  'MCO': '🇲🇨',
  // 2-letter ISO
  'RS': '🇷🇸', 'ES': '🇪🇸', 'IT': '🇮🇹', 'RU': '🇷🇺', 'DE': '🇩🇪',
  'FR': '🇫🇷', 'GB': '🇬🇧', 'NO': '🇳🇴', 'DK': '🇩🇰', 'GR': '🇬🇷',
  'PL': '🇵🇱', 'BY': '🇧🇾', 'UA': '🇺🇦', 'CZ': '🇨🇿', 'SK': '🇸🇰',
  'HR': '🇭🇷', 'BG': '🇧🇬', 'RO': '🇷🇴', 'HU': '🇭🇺', 'AT': '🇦🇹',
  'CH': '🇨🇭', 'BE': '🇧🇪', 'NL': '🇳🇱', 'SE': '🇸🇪', 'FI': '🇫🇮',
  'PT': '🇵🇹', 'EE': '🇪🇪', 'LV': '🇱🇻', 'LT': '🇱🇹', 'ME': '🇲🇪',
  'SI': '🇸🇮', 'US': '🇺🇸', 'CA': '🇨🇦', 'AR': '🇦🇷', 'BR': '🇧🇷',
  'CL': '🇨🇱', 'UY': '🇺🇾', 'CO': '🇨🇴', 'MX': '🇲🇽', 'AU': '🇦🇺',
  'JP': '🇯🇵', 'CN': '🇨🇳', 'KZ': '🇰🇿', 'KR': '🇰🇷', 'TW': '🇹🇼',
  'IN': '🇮🇳', 'TH': '🇹🇭', 'ZA': '🇿🇦', 'TN': '🇹🇳', 'MA': '🇲🇦',
  'EG': '🇪🇬', 'MC': '🇲🇨',
};

// ── Detect surface from tournament name / court type string ───────────────────
export function detectSurface(tournamentName: string, courtType?: string): string {
  const str = `${tournamentName} ${courtType ?? ''}`.toLowerCase();
  if (str.includes('clay') || str.includes('roland') || str.includes('monte') ||
      str.includes('madrid') || str.includes('rome') || str.includes('barcelona') ||
      str.includes('hamburg') || str.includes('munich') || str.includes('estoril') ||
      str.includes('bucharest') || str.includes('bastad') || str.includes('gstaad'))
    return 'Clay';
  if (str.includes('grass') || str.includes('wimbledon') || str.includes('queen') ||
      str.includes('halle') || str.includes('eastbourne') || str.includes('hertogenbosch') ||
      str.includes('newport') || str.includes('s-hertogenbosch'))
    return 'Grass';
  return 'Hard';
}

// ── Resolve flag emoji from any country string format ────────────────────────
export function resolveFlag(raw: string): string {
  if (!raw) return '🏳️';
  return FLAG_MAP[raw] ?? FLAG_MAP[raw.toUpperCase()] ?? '🏳️';
}

// ── Slugify a player name into a stable ID ────────────────────────────────────
function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveTour — determines ATP or WTA from a tennisapi1 event object
// CRITICAL: Grand Slams have category.slug = "atp" even for WTA matches.
// We MUST check homeTeam.gender / awayTeam.gender first.
// "M" = male = ATP, "F" = female = WTA
// ─────────────────────────────────────────────────────────────────────────────
export function resolveTour(event: any): 'ATP' | 'WTA' | null {
  // 1. Player gender (most reliable — works even for Grand Slams)
  const homeGender = String(event?.homeTeam?.gender ?? '').toUpperCase();
  const awayGender = String(event?.awayTeam?.gender ?? '').toUpperCase();
  if (homeGender === 'F' || awayGender === 'F') return 'WTA';
  if (homeGender === 'M' || awayGender === 'M') return 'ATP';

  // 2. Category slug / name fallback
  const catSlug = String(event?.tournament?.category?.slug ?? '').toLowerCase();
  const catName = String(event?.tournament?.category?.name ?? '').toLowerCase();
  if (catSlug === 'wta' || catName === 'wta') return 'WTA';
  if (catSlug === 'atp' || catName === 'atp') return 'ATP';

  return null; // ITF, Challenger, etc. — caller decides whether to skip
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveMatchType — determines exact match type for filter pills
//
// ROBUST multi-signal detection. The tennisapi1 API is inconsistent:
// - Some events have homeTeam.gender, some don't
// - Tournament name / category is the most reliable fallback
// - Player names with "/" = doubles
// ─────────────────────────────────────────────────────────────────────────────
export function resolveMatchType(
  event: any
): 'atp_singles' | 'wta_singles' | 'atp_doubles' | 'wta_doubles' | 'mixed_doubles' {
  const homeName = String(event?.homeTeam?.name ?? '');
  const awayName = String(event?.awayTeam?.name ?? '');
  const isDoubles = homeName.includes('/') || awayName.includes('/');

  const homeGender = String(event?.homeTeam?.gender ?? '').toUpperCase();
  const awayGender = String(event?.awayTeam?.gender ?? '').toUpperCase();

  // ── Signal 2: category slug / name ──────────────────────────────────────
  const catSlug = String(
    event?.tournament?.category?.slug ??
    event?.tournament?.uniqueTournament?.category?.slug ?? ''
  ).toLowerCase();
  const catName = String(
    event?.tournament?.category?.name ??
    event?.tournament?.uniqueTournament?.category?.name ?? ''
  ).toLowerCase();
  const tournamentName = String(
    event?.tournament?.uniqueTournament?.name ??
    event?.tournament?.name ?? ''
  ).toLowerCase();

  const isWtaByCategory =
    catSlug === 'wta' ||
    catName === 'wta' ||
    catName.includes('wta') ||
    tournamentName.includes('wta');

  const isAtpByCategory =
    catSlug === 'atp' ||
    catName === 'atp' ||
    catName.includes('atp');

  // ── Signal 3: "mixed" in tournament name ────────────────────────────────
  const isMixedByName =
    tournamentName.includes('mixed') ||
    String(event?.tournament?.name ?? '').toLowerCase().includes('mixed');

  // ── Doubles branch ───────────────────────────────────────────────────────
  if (isDoubles) {
    // Mixed: explicit gender mismatch OR "mixed" in name
    if (isMixedByName) return 'mixed_doubles';
    if (homeGender !== '' && awayGender !== '' && homeGender !== awayGender) {
      return 'mixed_doubles';
    }
    // WTA doubles
    if (homeGender === 'F' || awayGender === 'F' || isWtaByCategory) {
      return 'wta_doubles';
    }
    // ATP doubles (male or unknown)
    return 'atp_doubles';
  }

  // ── Singles branch ───────────────────────────────────────────────────────
  // Gender field is most reliable
  if (homeGender === 'F' || awayGender === 'F') return 'wta_singles';
  if (homeGender === 'M' || awayGender === 'M') return 'atp_singles';

  // Fallback: category/tournament name
  if (isWtaByCategory) return 'wta_singles';
  if (isAtpByCategory) return 'atp_singles';

  // Last resort: default to atp_singles
  return 'atp_singles';
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEvent — PRIMARY entry point for tennisapi1.p.rapidapi.com events
// Handles both /events/{day}/{month}/{year} and /matches/live shapes
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeEvent(
  raw: any,
  statusOverride?: 'live' | 'upcoming' | 'finished'
): { match: MatchRow; p1: PlayerRow; p2: PlayerRow } | null {
  const matchId  = String(raw?.id ?? '');
  const p1Name   = String(raw?.homeTeam?.name ?? '');
  const p2Name   = String(raw?.awayTeam?.name ?? '');
  const p1Id     = String(raw?.homeTeam?.id ?? slugify(p1Name));
  const p2Id     = String(raw?.awayTeam?.id ?? slugify(p2Name));

  if (!matchId || !p1Name || !p2Name) return null;

  // ── Status ────────────────────────────────────────────────────────────────
  let status: 'live' | 'upcoming' | 'finished' = statusOverride ?? 'upcoming';
  if (!statusOverride) {
    const type = String(raw?.status?.type ?? '').toLowerCase();
    const code = Number(raw?.status?.code ?? 0);
    if (type === 'inprogress')                           status = 'live';
    else if (type === 'finished' || code === 100)        status = 'finished';
    else if (code === 31)                                status = 'finished'; // retired
    else if (type === 'notstarted')                      status = 'upcoming';
  }

  // ── Tournament / Round ───────────────────────────────────────────────────
  const tournamentName = String(
    raw?.tournament?.uniqueTournament?.name ??
    raw?.tournament?.name ??
    'Unknown Tournament'
  );
  const round = String(raw?.roundInfo?.name ?? raw?.roundInfo?.round ?? '');

  // ── Surface ───────────────────────────────────────────────────────────────
  const groundType = String(
    raw?.tournament?.uniqueTournament?.groundType ??
    raw?.groundType ??
    ''
  );
  const surface = detectSurface(tournamentName, groundType);

  // ── Score ─────────────────────────────────────────────────────────────────
  let score: string | null = null;
  if (raw?.homeScore != null && raw?.awayScore != null) {
    const sets: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const hSet = raw.homeScore[`period${i}`];
      const aSet = raw.awayScore[`period${i}`];
      if (hSet == null && aSet == null) break;
      const hTb = raw.homeScore[`period${i}TieBreak`];
      const aTb = raw.awayScore[`period${i}TieBreak`];
      // Show tiebreak score next to the loser's set score
      if (hTb != null) {
        sets.push(`${hSet}(${hTb})-${aSet}`);
      } else if (aTb != null) {
        sets.push(`${hSet}-${aSet}(${aTb})`);
      } else {
        sets.push(`${hSet}-${aSet}`);
      }
    }
    if (sets.length > 0) score = sets.join(', ');
    else if (raw.homeScore.current != null) {
      score = `${raw.homeScore.current}-${raw.awayScore.current}`;
    }
  }

  // ── Match date ────────────────────────────────────────────────────────────
  const ts = Number(raw?.startTimestamp ?? 0);
  const match_date = ts > 0
    ? new Date(ts * 1000).toISOString()
    : new Date().toISOString();

  // ── Winner ────────────────────────────────────────────────────────────────
  let winner_id: string | null = null;
  if (status === 'finished' && raw?.winnerCode != null) {
    winner_id = raw.winnerCode === 1 ? p1Id : raw.winnerCode === 2 ? p2Id : null;
  }

  // ── Match type ────────────────────────────────────────────────────────────
  const match_type = resolveMatchType(raw);

  // ── Build player rows ─────────────────────────────────────────────────────
  const buildPlayer = (team: any, id: string, name: string): PlayerRow => {
    const countryRaw = String(
      team?.country?.alpha3 ??
      team?.country?.alpha2 ??
      team?.country?.name   ??
      team?.country?.slug   ??
      ''
    );
    return {
      id,
      name,
      country:         countryRaw,
      flag:            resolveFlag(countryRaw),
      rank:            Number(team?.ranking ?? team?.currentRanking ?? 999),
      wins:            0,
      losses:          0,
      ace_avg:         5.5,
      surface_pref:    surface,
      first_serve_pct: 60,
      recent_form:     '- - - - -',
      injury_notes:    null,
      fatigue_score:   0,
    };
  };

  const match: MatchRow = {
    id:         matchId,
    status,
    tournament: tournamentName,
    round,
    surface,
    score,
    match_date,
    player1_id: p1Id,
    player2_id: p2Id,
    winner_id,
    match_type,
  };

  return {
    match,
    p1: buildPlayer(raw?.homeTeam, p1Id, p1Name),
    p2: buildPlayer(raw?.awayTeam, p2Id, p2Name),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeMatch — LEGACY entry point (kept for backward compat with old API)
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeMatch(
  raw: Record<string, unknown>,
  statusOverride?: 'live' | 'upcoming' | 'finished'
): MatchRow | null {
  const p1Name  = String(raw.match_hometeam_name ?? raw.home_player_name ?? raw.player1_name ?? '');
  const p2Name  = String(raw.match_awayteam_name ?? raw.away_player_name ?? raw.player2_name ?? '');
  const matchId = String(raw.match_id ?? raw.id ?? '');

  if (!matchId || !p1Name || !p2Name) return null;

  const p1Id = String(raw.match_hometeam_id ?? raw.home_player_id ?? raw.player1_id ?? slugify(p1Name));
  const p2Id = String(raw.match_awayteam_id ?? raw.away_player_id ?? raw.player2_id ?? slugify(p2Name));

  let status: 'live' | 'upcoming' | 'finished' = statusOverride ?? 'upcoming';
  if (!statusOverride) {
    const s = String(raw.match_status ?? raw.status ?? '').toLowerCase();
    if (['1h', '2h', 'in_play', 'inprogress', 'live'].some(k => s.includes(k))) status = 'live';
    else if (['ft', 'aet', 'finished', 'complete'].some(k => s.includes(k)))    status = 'finished';
  }

  const tournament = String(raw.league_name ?? raw.tournament ?? raw.event_name ?? 'Unknown Tournament');
  const round      = String(raw.match_round ?? raw.round ?? raw.stage ?? '');
  const surface    = detectSurface(tournament, String(raw.surface ?? raw.court_type ?? ''));

  let score: string | null = null;
  const h = raw.match_hometeam_score ?? raw.home_score;
  const a = raw.match_awayteam_score ?? raw.away_score;
  if (h != null && a != null) score = `${h} - ${a}`;

  const rawDate  = String(raw.match_date ?? raw.date ?? '');
  const rawTime  = String(raw.match_time ?? raw.time ?? '00:00:00');
  const match_date = rawDate
    ? new Date(`${rawDate}T${rawTime}`).toISOString()
    : new Date().toISOString();

  return {
    id: matchId, status, tournament, round, surface, score, match_date,
    player1_id: p1Id, player2_id: p2Id,
    winner_id: null,
    match_type: 'atp_singles',
  };
}

// ── Normalize a player from match-level data ──────────────────────────────────
export function normalizePlayerFromMatch(
  raw: Record<string, unknown>,
  playerId: string,
  playerName: string,
  side: 'home' | 'away'
): PlayerRow {
  const pfx     = side === 'home' ? 'match_hometeam_' : 'match_awayteam_';
  const country = String(raw[`${pfx}country`] ?? raw.player_country ?? raw.country ?? '').toUpperCase().slice(0, 3);

  return {
    id: playerId,
    name: playerName,
    country,
    flag: resolveFlag(country),
    rank: Number(raw[`${pfx}rank`] ?? raw.player_rank ?? raw.rank ?? 999),
    wins: Number(raw[`${pfx}wins`] ?? raw.player_wins ?? 0),
    losses: Number(raw[`${pfx}losses`] ?? raw.player_losses ?? 0),
    ace_avg: Number(raw.ace_avg ?? 5.5),
    surface_pref: String(raw.surface_pref ?? 'Hard'),
    first_serve_pct: Number(raw.first_serve_pct ?? 60),
    recent_form: String(raw.recent_form ?? '- - - - -'),
    injury_notes: raw.injury_notes ? String(raw.injury_notes) : null,
    fatigue_score: 0,
  };
}

// ── Normalize a ranking row ───────────────────────────────────────────────────
export function normalizeRanking(
  raw: any,
  tour: 'ATP' | 'WTA',
  position: number
): { ranking: RankingRow; player: PlayerRow } {
  const rank     = Number(raw.ranking ?? raw.standing_place ?? raw.rank ?? position);
  const playerId = String(raw.team?.id ?? raw.player_id ?? raw.id ?? slugify(String(raw.team?.name ?? raw.name ?? '')));
  const name     = String(raw.team?.name ?? raw.player_name ?? raw.name ?? 'Unknown');

  const countryRaw = String(
    raw.team?.country?.alpha3 ??
    raw.team?.country?.alpha2 ??
    raw.team?.country?.name   ??
    raw.player?.country?.name ??
    raw.country               ?? ''
  );

  const player: PlayerRow = {
    id: playerId,
    name,
    country: countryRaw,
    flag: resolveFlag(countryRaw),
    rank,
    wins: Number(raw.wins ?? 0),
    losses: Number(raw.losses ?? 0),
    ace_avg: 5.5,
    surface_pref: 'Hard',
    first_serve_pct: 60,
    recent_form: '- - - - -',
    injury_notes: null,
    fatigue_score: 0,
  };

  const ranking: RankingRow = {
    player_id: playerId,
    tour,
    rank,
    points: Number(raw.points ?? raw.standing_points ?? raw.point ?? 0),
    prev_rank: raw.previousRanking ? Number(raw.previousRanking) : null,
  };

  return { ranking, player };
}