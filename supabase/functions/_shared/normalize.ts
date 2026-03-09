// ─────────────────────────────────────────────────────────────────────────────
// supabase/functions/_shared/normalize.ts
// Converts raw api-tennis.p.rapidapi.com responses → clean DB row shapes.
// If your API subscription returns different field names, only edit here.
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
  SRB: '🇷🇸', ESP: '🇪🇸', ITA: '🇮🇹', RUS: '🇷🇺', DEN: '🇩🇰', NOR: '🇳🇴',
  GRE: '🇬🇷', GER: '🇩🇪', USA: '🇺🇸', GBR: '🇬🇧', FRA: '🇫🇷', ARG: '🇦🇷',
  AUS: '🇦🇺', CAN: '🇨🇦', BUL: '🇧🇬', POL: '🇵🇱', CRO: '🇭🇷', SUI: '🇨🇭',
  AUT: '🇦🇹', BEL: '🇧🇪', KAZ: '🇰🇿', CZE: '🇨🇿', JPN: '🇯🇵', KOR: '🇰🇷',
  CHN: '🇨🇳', BRA: '🇧🇷', URU: '🇺🇾', TUN: '🇹🇳', MAR: '🇲🇦', RSA: '🇿🇦',
  NED: '🇳🇱', HUN: '🇭🇺', SVK: '🇸🇰', UKR: '🇺🇦', CHI: '🇨🇱', COL: '🇨🇴',
  ROU: '🇷🇴', POR: '🇵🇹', SWE: '🇸🇪', FIN: '🇫🇮', EST: '🇪🇪', LAT: '🇱🇻',
};

// ── Detect surface from tournament name (fallback heuristic) ──────────────────
export function detectSurface(tournamentName: string, courtType?: string): string {
  const str = `${tournamentName} ${courtType ?? ''}`.toLowerCase();
  if (str.includes('clay') || str.includes('roland') || str.includes('monte') ||
      str.includes('madrid') || str.includes('rome') || str.includes('barcelona') ||
      str.includes('hamburg') || str.includes('munich') || str.includes('estoril'))
    return 'Clay';
  if (str.includes('grass') || str.includes('wimbledon') || str.includes("queen") ||
      str.includes('halle') || str.includes('eastbourne') || str.includes('hertogenbosch'))
    return 'Grass';
  return 'Hard';
}

// ── Slugify a player name into a stable ID if RapidAPI doesn't provide one ───
function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Normalize a raw match object from api-tennis ──────────────────────────────
// The API returns different field names for live vs fixture endpoints.
// We cover both with null-coalescing fallbacks.
export function normalizeMatch(
  raw: Record<string, unknown>,
  statusOverride?: 'live' | 'upcoming' | 'finished'
): MatchRow | null {
  // ── Player names (required) ──────────────────────────────────────────────
  const p1Name = String(
    raw.match_hometeam_name ?? raw.home_player_name ?? raw.player1_name ?? ''
  );
  const p2Name = String(
    raw.match_awayteam_name ?? raw.away_player_name ?? raw.player2_name ?? ''
  );
  const matchId = String(raw.match_id ?? raw.id ?? '');

  if (!matchId || !p1Name || !p2Name) return null; // skip malformed rows

  // ── Player IDs ────────────────────────────────────────────────────────────
  const p1Id = String(
    raw.match_hometeam_id ?? raw.home_player_id ?? raw.player1_id ?? slugify(p1Name)
  );
  const p2Id = String(
    raw.match_awayteam_id ?? raw.away_player_id ?? raw.player2_id ?? slugify(p2Name)
  );

  // ── Status ────────────────────────────────────────────────────────────────
  let status: 'live' | 'upcoming' | 'finished' = statusOverride ?? 'upcoming';
  if (!statusOverride) {
    const s = String(raw.match_status ?? raw.status ?? '').toLowerCase();
    if (['1h', '2h', 'in_play', 'inprogress', 'live'].some(k => s.includes(k))) status = 'live';
    else if (['ft', 'aet', 'finished', 'complete'].some(k => s.includes(k)))    status = 'finished';
  }

  const tournament = String(raw.league_name ?? raw.tournament ?? raw.event_name ?? 'Unknown Tournament');
  const round      = String(raw.match_round ?? raw.round ?? raw.stage ?? '');
  const surface    = detectSurface(tournament, String(raw.surface ?? raw.court_type ?? ''));

  // ── Score: build "6-4, 3-2" format ───────────────────────────────────────
  let score: string | null = null;
  const h = raw.match_hometeam_score ?? raw.home_score;
  const a = raw.match_awayteam_score ?? raw.away_score;
  if (h != null && a != null) score = `${h} - ${a}`;

  // ── Date ──────────────────────────────────────────────────────────────────
  const rawDate = String(raw.match_date ?? raw.date ?? '');
  const rawTime = String(raw.match_time ?? raw.time ?? '00:00:00');
  const match_date = rawDate
    ? new Date(`${rawDate}T${rawTime}`).toISOString()
    : new Date().toISOString();

  return { id: matchId, status, tournament, round, surface, score, match_date, player1_id: p1Id, player2_id: p2Id };
}

// ── Normalize a player from match-level data ──────────────────────────────────
// RapidAPI often embeds player info inside match objects.
// This builds a player row from whatever's available.
export function normalizePlayerFromMatch(
  raw: Record<string, unknown>,
  playerId: string,
  playerName: string,
  side: 'home' | 'away'
): PlayerRow {
  // Some API tiers embed nested player objects; others put stats at top-level
  const pfx = side === 'home' ? 'match_hometeam_' : 'match_awayteam_';
  const country = String(raw[`${pfx}country`] ?? raw.player_country ?? raw.country ?? '').toUpperCase().slice(0, 3);

  return {
    id: playerId,
    name: playerName,
    country,
    flag: FLAG_MAP[country] ?? '🏳️',
    rank: Number(raw[`${pfx}rank`] ?? raw.player_rank ?? raw.rank ?? 999),
    wins: Number(raw[`${pfx}wins`] ?? raw.player_wins ?? 0),
    losses: Number(raw[`${pfx}losses`] ?? raw.player_losses ?? 0),
    ace_avg: Number(raw.ace_avg ?? 5.5),
    surface_pref: String(raw.surface_pref ?? detectSurface('hard')),
    first_serve_pct: Number(raw.first_serve_pct ?? 60),
    recent_form: String(raw.recent_form ?? '- - - - -'),
    injury_notes: raw.injury_notes ? String(raw.injury_notes) : null,
    fatigue_score: 0, // computed separately in sync-matches
  };
}

// ── Normalize a ranking row from get_standings ────────────────────────────────
// api-tennis standings use standing_place, standing_points, team_name, team_id
export function normalizeRanking(
  raw: Record<string, unknown>,
  tour: 'ATP' | 'WTA',
  position: number // fallback if API doesn't provide rank explicitly
): { ranking: RankingRow; player: PlayerRow } {
  const rank     = Number(raw.standing_place ?? raw.rank ?? raw.player_rank ?? position);
  const playerId = String(raw.team_id ?? raw.player_id ?? raw.id ?? slugify(String(raw.team_name ?? raw.player_name ?? '')));
  const name     = String(raw.team_name ?? raw.player_name ?? raw.name ?? 'Unknown');
  const country  = String(raw.player_country ?? raw.country ?? raw.team_country ?? '').toUpperCase().slice(0, 3);

  const player: PlayerRow = {
    id: playerId,
    name,
    country,
    flag: FLAG_MAP[country] ?? '🏳️',
    rank,
    wins: Number(raw.wins ?? raw.player_wins ?? 0),
    losses: Number(raw.losses ?? raw.player_losses ?? 0),
    ace_avg: Number(raw.ace_avg ?? 5.5),
    surface_pref: String(raw.surface_pref ?? 'Hard'),
    first_serve_pct: Number(raw.first_serve_pct ?? 60),
    recent_form: String(raw.recent_form ?? '- - - - -'),
    injury_notes: null,
    fatigue_score: 0,
  };

  const ranking: RankingRow = {
    player_id: playerId,
    tour,
    rank,
    points: Number(raw.standing_points ?? raw.points ?? raw.player_points ?? 0),
    prev_rank: raw.prev_rank ? Number(raw.prev_rank) : null,
  };

  return { ranking, player };
}