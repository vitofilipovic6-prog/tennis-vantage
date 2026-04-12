// supabase/functions/resolve-doubles-nationalities/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES:
//   Finds doubles players in the DB whose country is missing or duplicated
//   (e.g. "ESP/ESP" meaning "we only had one code for the pair"), then looks
//   each individual player up by name via the RapidAPI tennis player search
//   endpoint to get their REAL nationality from SofaScore's own database.
//   Saves permanently to `players` table. Designed to run during the nightly
//   sync — or triggered manually via POST.
//
// WHY NOT GEMINI:
//   Gemini doesn't know most ITF/challenger doubles players reliably.
//   The RapidAPI tennis search uses SofaScore data which has real nationality
//   for virtually every professional tennis player.
//
// ENDPOINT: POST /functions/v1/resolve-doubles-nationalities
// AUTH: Supabase anon key or service role key in Authorization header
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resolveFlag } from '../_shared/normalize.ts';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

// ── RapidAPI call with rate-limit handling ────────────────────────────────────
async function rapidSearch(query: string): Promise<any | null> {
  const url = `https://${RAPIDAPI_HOST}/api/tennis/search/${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type':    'application/json',
        'x-rapidapi-key':  RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    if (res.status === 429) {
      console.warn(`[search] Rate limited for query: ${query}`);
      await sleep(2000);
      return null;
    }

    if (!res.ok) {
      console.warn(`[search] ${res.status} for query: ${query}`);
      return null;
    }

    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    console.warn(`[search] Network error for "${query}":`, e.message);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Extract country from SofaScore search results ─────────────────────────────
// SofaScore search returns a mix of teams, players, tournaments.
// We want type "player" or "team" that matches a tennis player name.
function extractCountryFromSearch(data: any, playerName: string): string | null {
  if (!data) return null;

  // SofaScore search response structure varies — try multiple paths
  const results: any[] = (
    data?.results ??
    data?.players ??
    data?.data ??
    (Array.isArray(data) ? data : [])
  );

  if (!results.length) return null;

  const nameLower = playerName.toLowerCase().replace(/\./g, '').trim();

  for (const item of results) {
    // Only look at player/team entries (not tournaments)
    const type = String(item?.type ?? item?.entityType ?? '').toLowerCase();
    if (type !== 'player' && type !== 'team' && type !== '') continue;

    const entity = item?.entity ?? item?.team ?? item?.player ?? item;
    const entityName = String(
      entity?.name ?? entity?.shortName ?? entity?.fullName ?? ''
    ).toLowerCase().replace(/\./g, '').trim();

    // Fuzzy name match: check if last name matches or full name is close
    const nameParts = nameLower.split(' ');
    const lastName  = nameParts[nameParts.length - 1];

    const entityParts = entityName.split(' ');
    const entityLast  = entityParts[entityParts.length - 1];

    if (entityLast !== lastName && !entityName.includes(lastName)) continue;

    // Extract country
    const country =
      entity?.country?.alpha3 ??
      entity?.country?.alpha2 ??
      entity?.team?.country?.alpha3 ??
      entity?.team?.country?.alpha2 ??
      item?.country?.alpha3 ??
      item?.country?.alpha2 ??
      null;

    if (country && country.length >= 2) {
      return country.toUpperCase();
    }
  }

  return null;
}

// ── Parse a doubles player name into two individual names ─────────────────────
// "N. Koolhof / W. Skupski" → ["N. Koolhof", "W. Skupski"]
function splitDoublesName(name: string): [string, string] | null {
  const parts = name.split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

// ── Clean name for search: "N. Koolhof" → "Koolhof" (last name only) ─────────
// Last name searches are more reliable in SofaScore than initials
function getSearchName(playerName: string): string {
  const trimmed = playerName.trim();
  const parts   = trimmed.split(/\s+/);

  if (parts.length === 1) return trimmed;

  // If first part looks like an initial (single letter + optional dot), use last name
  if (/^[A-Z]\.?$/.test(parts[0])) {
    return parts.slice(1).join(' ');
  }

  // Otherwise use full name
  return trimmed;
}

// ── Check if a doubles player needs resolution ────────────────────────────────
function needsResolution(country: string | null, name: string): boolean {
  if (!country || country.trim() === '') return true;

  const c = country.trim();

  // "UNK" means unknown
  if (c === 'UNK' || c === 'UNK/UNK') return true;

  // Single code (not a doubles pair string) — needs resolution for both players
  if (!c.includes('/')) return true;

  // "ESP/ESP" — same code duplicated, means we only had one player's code
  const parts = c.split('/');
  if (parts[0]?.trim() === parts[1]?.trim()) return true;

  // Either half is missing or UNK
  if (parts.some(p => !p.trim() || p.trim() === 'UNK')) return true;

  return false;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  // Auth check
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const log:    string[] = [];
  const errors: string[] = [];
  let resolved = 0;
  let skipped  = 0;
  let failed   = 0;

  try {
    // ── 1. Fetch all doubles players that need resolution ──────────────────
    log.push('[FETCH] Querying doubles players with missing/incomplete country data...');

    const { data: players, error: fetchErr } = await supabase
      .from('players')
      .select('id, name, country, flag_resolved_at')
      .ilike('name', '%/%')         // doubles players have '/' in name
      .limit(500);                  // process up to 500 per run

    if (fetchErr) {
      errors.push(`[FETCH] ${fetchErr.message}`);
      return buildResponse({ ok: false, log, errors, resolved, skipped, failed });
    }

    const toResolve = (players ?? []).filter(p =>
      needsResolution(p.country, p.name) && p.name.includes('/')
    );

    log.push(`[FETCH] Found ${players?.length ?? 0} doubles players total, ${toResolve.length} need resolution`);

    if (toResolve.length === 0) {
      log.push('[DONE] All doubles players already have correct nationality data!');
      return buildResponse({ ok: true, log, errors, resolved, skipped, failed });
    }

    // ── 2. Resolve each player via RapidAPI search ─────────────────────────
    // Rate limit: ~2 req/s on free tier, 1 req/s to be safe
    // With 500 players × 2 names each = 1000 searches max
    // At 1/s that's ~16 min — too slow. We'll do one search per PAIR
    // using the second player's last name (more unique) and verify both.
    const DELAY_MS = 600; // 600ms between requests ≈ 1.6 req/s — safe for free tier

    for (const player of toResolve) {
      const halves = splitDoublesName(player.name);
      if (!halves) {
        skipped++;
        continue;
      }

      const [name1, name2] = halves;
      let c1: string | null = null;
      let c2: string | null = null;

      // Check if we already have one half from the DB
      const existingCountry = (player.country ?? '').trim();
      if (existingCountry && !existingCountry.includes('/') && existingCountry !== 'UNK') {
        // We have one code — figure out which player it belongs to
        // We'll search for both and see which matches
        c1 = existingCountry;
      }

      // Search for player 1
      if (!c1) {
        const search1 = getSearchName(name1);
        const result1 = await rapidSearch(search1);
        c1 = extractCountryFromSearch(result1, name1);
        if (c1) log.push(`[SEARCH] "${name1}" → ${c1}`);
        await sleep(DELAY_MS);
      }

      // Search for player 2
      const search2 = getSearchName(name2);
      const result2 = await rapidSearch(search2);
      c2 = extractCountryFromSearch(result2, name2);
      if (c2) log.push(`[SEARCH] "${name2}" → ${c2}`);
      await sleep(DELAY_MS);

      // Build the resolved country string
      const rc1 = c1 && c1 !== 'UNK' ? c1 : null;
      const rc2 = c2 && c2 !== 'UNK' ? c2 : null;

      if (!rc1 && !rc2) {
        log.push(`[SKIP] "${player.name}" — both players unknown in search`);
        failed++;
        continue;
      }

      // If only one half resolved, use it for both (better than blank)
      const finalC1 = rc1 ?? rc2 ?? 'UNK';
      const finalC2 = rc2 ?? rc1 ?? 'UNK';
      const countryStr = `${finalC1}/${finalC2}`;

      // Save to DB
      const { error: updateErr } = await supabase
        .from('players')
        .update({
          country:          countryStr,
          flag:             resolveFlag(finalC1),
          flag_resolved_at: new Date().toISOString(),
        })
        .eq('id', player.id);

      if (updateErr) {
        errors.push(`[UPDATE] "${player.name}": ${updateErr.message}`);
        failed++;
      } else {
        log.push(`[SAVED] "${player.name}" → ${countryStr}`);
        resolved++;
      }
    }

  } catch (e: unknown) {
    errors.push(`[FATAL] ${e instanceof Error ? e.message : String(e)}`);
  }

  log.push(`[DONE] resolved=${resolved}, skipped=${skipped}, failed=${failed}`);

  return buildResponse({ ok: errors.length === 0, log, errors, resolved, skipped, failed });
});

function buildResponse(body: object) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}