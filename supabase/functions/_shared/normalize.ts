// supabase/functions/_shared/normalize.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for ALL TennisApi1 response normalization.
// KEY CHANGE: MatchRow now includes `tour` field ('ATP'|'WTA') so the
// frontend never has to guess from the tournament name string again.
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
  tour: 'ATP' | 'WTA';          // ← NEW: stored directly, never guessed
  score: string | null;
  live_status: string | null;
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
// FLAG MAP — alpha3 primary, alpha2 fallback
// ─────────────────────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  // alpha3
  'ESP': '🇪🇸', 'ITA': '🇮🇹', 'RUS': '🇷🇺', 'DEU': '🇩🇪', 'FRA': '🇫🇷',
  'GBR': '🇬🇧', 'NOR': '🇳🇴', 'DNK': '🇩🇰', 'GRC': '🇬🇷', 'POL': '🇵🇱',
  'BLR': '🇧🇾', 'UKR': '🇺🇦', 'CZE': '🇨🇿', 'SVK': '🇸🇰', 'HRV': '🇭🇷',
  'BGR': '🇧🇬', 'ROU': '🇷🇴', 'HUN': '🇭🇺', 'AUT': '🇦🇹', 'CHE': '🇨🇭',
  'BEL': '🇧🇪', 'NLD': '🇳🇱', 'SWE': '🇸🇪', 'FIN': '🇫🇮', 'PRT': '🇵🇹',
  'EST': '🇪🇪', 'LVA': '🇱🇻', 'LTU': '🇱🇹', 'MNE': '🇲🇪', 'SVN': '🇸🇮',
  'USA': '🇺🇸', 'CAN': '🇨🇦', 'ARG': '🇦🇷', 'BRA': '🇧🇷', 'CHL': '🇨🇱',
  'URY': '🇺🇾', 'COL': '🇨🇴', 'MEX': '🇲🇽', 'AUS': '🇦🇺', 'JPN': '🇯🇵',
  'CHN': '🇨🇳', 'KAZ': '🇰🇿', 'KOR': '🇰🇷', 'TWN': '🇹🇼', 'IND': '🇮🇳',
  'THA': '🇹🇭', 'ZAF': '🇿🇦', 'TUN': '🇹🇳', 'MAR': '🇲🇦', 'LUX': '🇱🇺',
  'GEO': '🇬🇪', 'SRB': '🇷🇸',
  // alpha2 fallbacks
  'ES': '🇪🇸', 'IT': '🇮🇹', 'RU': '🇷🇺', 'DE': '🇩🇪', 'FR': '🇫🇷',
  'GB': '🇬🇧', 'NO': '🇳🇴', 'DK': '🇩🇰', 'GR': '🇬🇷', 'PL': '🇵🇱',
  'BY': '🇧🇾', 'UA': '🇺🇦', 'CZ': '🇨🇿', 'SK': '🇸🇰', 'HR': '🇭🇷',
  'BG': '🇧🇬', 'RO': '🇷🇴', 'HU': '🇭🇺', 'AT': '🇦🇹', 'CH': '🇨🇭',
  'BE': '🇧🇪', 'NL': '🇳🇱', 'SE': '🇸🇪', 'FI': '🇫🇮', 'PT': '🇵🇹',
  'EE': '🇪🇪', 'LV': '🇱🇻', 'LT': '🇱🇹', 'ME': '🇲🇪', 'SI': '🇸🇮',
  'US': '🇺🇸', 'CA': '🇨🇦', 'AR': '🇦🇷', 'BR': '🇧🇷', 'CL': '🇨🇱',
  'UY': '🇺🇾', 'CO': '🇨🇴', 'MX': '🇲🇽', 'AU': '🇦🇺', 'JP': '🇯🇵',
  'CN': '🇨🇳', 'KZ': '🇰🇿', 'KR': '🇰🇷', 'TW': '🇹🇼', 'IN': '🇮🇳',
  'TH': '🇹🇭', 'ZA': '🇿🇦', 'TN': '🇹🇳', 'MA': '🇲🇦', 'LU': '🇱🇺',
  'GE': '🇬🇪', 'RS': '🇷🇸',
};

export function resolveFlag(raw: string): string {
  if (!raw) return '🏳️';
  for (const attempt of [raw, raw.trim(), raw.trim().toUpperCase()]) {
    if (FLAG_MAP[attempt]) return FLAG_MAP[attempt];
  }
  console.warn(`[FLAG] Unresolved: "${raw}"`);
  return '🏳️';
}

export function extractCountry(obj: any): string {
  return String(
    obj?.country?.alpha3 ??
    obj?.country?.alpha2 ??
    obj?.country?.name   ??
    ''
  );
}

export function resolveStatus(statusObj: any): 'live' | 'upcoming' | 'finished' {
  const type = String(statusObj?.type ?? '').toLowerCase();
  const code = Number(statusObj?.code ?? -1);
  if (type === 'inprogress') return 'live';
  if (type === 'finished' || code === 100 || code === 31) return 'finished';
  return 'upcoming';
}

export function resolveSurface(event: any): string {
  const groundType = String(
    event?.groundType ??
    event?.tournament?.uniqueTournament?.groundType ??
    ''
  ).toLowerCase();

  if (groundType.includes('clay'))  return 'Clay';
  if (groundType.includes('grass')) return 'Grass';
  if (groundType.includes('hard'))  return 'Hard';

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

// ─────────────────────────────────────────────────────────────────────────────
// resolveTour — reads category.slug/name from the API event object.
// This is the AUTHORITATIVE source. Returns null for ITF/Challenger (skip those).
// ─────────────────────────────────────────────────────────────────────────────
export function resolveTour(event: any): 'ATP' | 'WTA' | null {
  const slug = String(event?.tournament?.category?.slug ?? '').toLowerCase();
  if (slug === 'atp') return 'ATP';
  if (slug === 'wta') return 'WTA';

  const name = String(event?.tournament?.category?.name ?? '').toUpperCase();
  if (name === 'ATP') return 'ATP';
  if (name === 'WTA') return 'WTA';

  return null; // ITF, Challenger, doubles — skip
}

export function buildScore(homeScore: any, awayScore: any): string | null {
  if (!homeScore || !awayScore) return null;

  const sets: string[] = [];
  for (const p of ['period1', 'period2', 'period3'] as const) {
    const h = homeScore[p];
    const a = awayScore[p];
    if (h == null || a == null) continue;

    const hTb = homeScore[`${p}TieBreak` as keyof typeof homeScore];
    const aTb = awayScore[`${p}TieBreak` as keyof typeof awayScore];

    if (hTb != null && aTb != null && (Number(h) === 7 || Number(a) === 7)) {
      const loser = Math.min(Number(hTb), Number(aTb));
      sets.push(`${h}-${a}(${loser})`);
    } else {
      sets.push(`${h}-${a}`);
    }
  }

  if (sets.length === 0) {
    const h = homeScore.current ?? homeScore.display;
    const a = awayScore.current ?? awayScore.display;
    if (h != null && a != null) return `${h}-${a}*`;
    return null;
  }

  return sets.join(', ');
}

export function extractArray(data: any): any[] {
  if (Array.isArray(data))            return data;
  if (Array.isArray(data?.events))    return data.events;
  if (Array.isArray(data?.results))   return data.results;
  if (Array.isArray(data?.rankings))  return data.rankings;
  if (Array.isArray(data?.data))      return data.data;
  console.warn('[extractArray] Unknown shape:', JSON.stringify(data).slice(0, 200));
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEvent — builds MatchRow with `tour` field embedded
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeEvent(raw: any, tour: 'ATP' | 'WTA'): {
  match: MatchRow;
  player1: PlayerRow;
  player2: PlayerRow;
} | null {
  const id = String(raw?.id ?? '');
  if (!id) return null;

  const home = raw.homeTeam ?? {};
  const away = raw.awayTeam ?? {};

  const p1Name = String(home?.name ?? home?.shortName ?? '');
  const p2Name = String(away?.name ?? away?.shortName ?? '');
  if (!p1Name || !p2Name) return null;

  const p1Id = String(home?.id ?? '');
  const p2Id = String(away?.id ?? '');
  if (!p1Id || !p2Id) return null;

  const status  = resolveStatus(raw.status);
  const surface = resolveSurface(raw);

  const tournamentName = String(
    raw?.tournament?.uniqueTournament?.name ??
    raw?.tournament?.name ??
    'Unknown Tournament'
  );

  const roundName = String(
    raw?.roundInfo?.name ??
    (raw?.roundInfo?.round != null ? `Round ${raw.roundInfo.round}` : 'Unknown Round')
  );

  const startTs = Number(raw?.startTimestamp ?? 0);
  const matchDate = startTs > 0
    ? new Date(startTs * 1000).toISOString()
    : new Date().toISOString();

  const score = (status === 'live' || status === 'finished')
    ? buildScore(raw.homeScore, raw.awayScore)
    : null;

  const winnerCode = raw?.winnerCode;
  const winnerId = winnerCode === 1 ? p1Id : winnerCode === 2 ? p2Id : null;

  const liveStatus = status === 'live'
    ? (raw?.status?.description ?? null)
    : null;

  const p1Country = extractCountry(home);
  const p2Country = extractCountry(away);

  const match: MatchRow = {
    id,
    status,
    tournament: tournamentName,
    round:      roundName,
    surface,
    tour,                         // ← stored directly from API category
    score,
    live_status: liveStatus,
    match_date:  matchDate,
    player1_id:  p1Id,
    player2_id:  p2Id,
    winner_id:   winnerId,
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
// normalizeRankingRow
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeRankingRow(
  raw: any,
  tour: 'ATP' | 'WTA',
  index: number
): { player: PlayerRow; ranking: RankingRow } {
  const team = raw.team ?? {};

  const id       = String(team?.id ?? raw?.id ?? `${tour.toLowerCase()}-${index}`);
  const name     = String(team?.name ?? raw?.rowName ?? 'Unknown');
  const rank     = Number(raw.ranking         ?? index + 1);
  const points   = Number(raw.points          ?? 0);
  const prevRank = Number(raw.previousRanking ?? rank);

  const countryObj = team?.country ?? {};
  const country = String(
    countryObj?.alpha3 ??
    countryObj?.alpha2 ??
    countryObj?.name   ??
    raw?.country?.alpha3 ??
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