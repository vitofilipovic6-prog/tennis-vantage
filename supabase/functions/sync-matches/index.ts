// supabase/functions/sync-matches/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Syncs live, upcoming, AND recent past matches into Supabase.
//
// CHANGE vs old version:
//   - Now fetches 2 days BEFORE today in addition to today + 3 days ahead
//     (so the calendar's past dates have real data, not stale old-API records)
//   - Adds a "stale cleanup" step: deletes upcoming/live rows older than 2 days
//     (these are leftover from the old API and will never transition to finished)
//
// ENDPOINTS USED:
//   GET /api/tennis/matches/live           — all live matches
//   GET /api/tennis/events/{d}/{m}/{y}     — all events on a given date
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeEvent,
  extractArray,
  resolveTour,
} from '../_shared/normalize.ts';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

async function rapidGet(path: string): Promise<any | null> {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  console.log('[GET]', url);

  const res = await fetch(url, {
    headers: {
      'Content-Type':    'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key':  RAPIDAPI_KEY,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    console.warn(`[SKIP ${res.status}] ${url} — ${text.slice(0, 150)}`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`[PARSE ERROR] ${url}`);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'Authorization',
      },
    });
  }

  const log: string[]    = [];
  const errors: string[] = [];

  // ── 0. STALE CLEANUP ──────────────────────────────────────────────────────
  // Delete any rows stuck as "upcoming" or "live" from 3+ days ago.
  // These are guaranteed to be old-API ghosts — real matches either
  // finished (status='finished') or got re-synced with correct IDs.
  try {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 3);
    const cutoffISO = cutoff.toISOString();

    const { count, error: delErr } = await supabase
      .from('matches')
      .delete({ count: 'exact' })
      .in('status', ['upcoming', 'live'])
      .lt('match_date', cutoffISO);

    if (delErr) {
      errors.push(`[CLEANUP] ${delErr.message}`);
    } else {
      log.push(`[CLEANUP] Deleted ${count ?? 0} stale upcoming/live rows older than ${cutoffISO}`);
    }
  } catch (err: unknown) {
    errors.push(`[CLEANUP] ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Collect all raw events — deduplicated by ID ────────────────────────────
  const rawEventsMap = new Map<string, any>();

  // ── 1. Live matches ────────────────────────────────────────────────────────
  try {
    log.push('[LIVE] Fetching /api/tennis/matches/live ...');
    const liveRaw    = await rapidGet('/api/tennis/matches/live');
    const liveEvents = extractArray(liveRaw);
    log.push(`[LIVE] ${liveEvents.length} events`);
    liveEvents.forEach((e: any) => {
      if (e?.id) rawEventsMap.set(String(e.id), e);
    });
  } catch (err: unknown) {
    errors.push(`[LIVE] ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Events by date: 2 days ago → today + 3 days ahead (6 calls total) ──
  // CHANGED: offsets now start at -2 so past calendar dates have real data
  const today = new Date();
  const dateParams = Array.from({ length: 6 }, (_, i) => {
    const offset = i - 2; // -2, -1, 0, +1, +2, +3
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + offset);
    return {
      day:    d.getUTCDate(),
      month:  d.getUTCMonth() + 1,
      year:   d.getUTCFullYear(),
      offset, // keep for logging
    };
  });

  const dateFetches = dateParams.map(({ day, month, year, offset }) =>
    rapidGet(`/api/tennis/events/${day}/${month}/${year}`)
      .then(raw => ({ raw, label: `${day}/${month}/${year} (offset ${offset > 0 ? '+' : ''}${offset})` }))
  );

  const dateResults = await Promise.allSettled(dateFetches);

  for (const result of dateResults) {
    if (result.status !== 'fulfilled' || !result.value.raw) continue;
    const { raw, label } = result.value;
    const events = extractArray(raw);
    log.push(`[DATE ${label}] ${events.length} events`);
    events.forEach((e: any) => {
      if (e?.id) rawEventsMap.set(String(e.id), e);
    });
  }

  log.push(`[DEDUP] ${rawEventsMap.size} unique events total`);

  // ── 3. Normalize + separate live/upcoming from finished ────────────────────
  const playersMap              = new Map<string, object>();
  const liveAndUpcomingRows:    object[] = [];
  const finishedRows:           object[] = [];
  let   skippedNonATPWTA        = 0;
  let   skippedMissingFields    = 0;

  for (const rawEvent of rawEventsMap.values()) {
    const tour = resolveTour(rawEvent);
    if (!tour) {
      skippedNonATPWTA++;
      continue;
    }

    const normalized = normalizeEvent(rawEvent);
    if (!normalized) {
      skippedMissingFields++;
      continue;
    }

    const { match, player1, player2 } = normalized;

    if (match.status === 'finished') {
      finishedRows.push(match);
    } else {
      liveAndUpcomingRows.push(match);
    }

    if (!playersMap.has(player1.id)) playersMap.set(player1.id, player1);
    if (!playersMap.has(player2.id)) playersMap.set(player2.id, player2);
  }

  log.push(
    `[NORMALIZE] live+upcoming: ${liveAndUpcomingRows.length} | ` +
    `finished: ${finishedRows.length} | ` +
    `skipped (non-ATP/WTA): ${skippedNonATPWTA} | ` +
    `skipped (bad data): ${skippedMissingFields}`
  );

  // ── 4. Upsert players FIRST (FK safety) ───────────────────────────────────
  if (playersMap.size > 0) {
    const { error } = await supabase
      .from('players')
      .upsert([...playersMap.values()], { onConflict: 'id', ignoreDuplicates: true });
    if (error) errors.push(`[DB] players: ${error.message}`);
    else log.push(`[DB] ✓ Upserted ${playersMap.size} players`);
  }

  // ── 5. Upsert live + upcoming matches ─────────────────────────────────────
  if (liveAndUpcomingRows.length > 0) {
    const { error } = await supabase
      .from('matches')
      .upsert(liveAndUpcomingRows, { onConflict: 'id', ignoreDuplicates: false });
    if (error) errors.push(`[DB] live/upcoming matches: ${error.message}`);
    else log.push(`[DB] ✓ Upserted ${liveAndUpcomingRows.length} live/upcoming matches`);
  }

  // ── 6. Upsert finished matches (H2H history) ──────────────────────────────
  // ignoreDuplicates: false — allow score/winner updates if re-synced
  if (finishedRows.length > 0) {
    const { error } = await supabase
      .from('matches')
      .upsert(finishedRows, { onConflict: 'id', ignoreDuplicates: false });
    if (error) errors.push(`[DB] finished matches: ${error.message}`);
    else log.push(`[DB] ✓ Upserted ${finishedRows.length} finished matches`);
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    {
      status:  errors.length ? 207 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});