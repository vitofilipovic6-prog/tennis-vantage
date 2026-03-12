// supabase/functions/sync-matches/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Syncs live and upcoming tennis matches into Supabase.
//
// ENDPOINTS USED:
//
// 1. liveTennisMatches
//    GET https://tennisapi1.p.rapidapi.com/api/tennis/matches/live
//    No params. Returns { events: [...] } — 28 items confirmed from screenshot.
//    status.type = "inprogress", groundType present (e.g. "Hardcourt outdoor")
//
// 2. tennisEventsByDate
//    GET https://tennisapi1.p.rapidapi.com/api/tennis/events/{day}/{month}/{year}
//    Confirmed URL: /api/tennis/events/22/7/2025
//    Returns { events: [...] } — 827 items on a busy day.
//    Covers ALL tours (ATP, WTA, ITF, Challenger) — we filter to ATP+WTA only.
//
// STRATEGY:
//   - Fetch live matches (1 call)
//   - Fetch today + next 3 days by date (4 calls, parallel)
//   - Deduplicate by event ID (live matches also appear in date results)
//   - Filter ATP + WTA only (skip ITF/Challenger to save DB space)
//   - Upsert players first, then matches (FK constraint order)
//   - Store finished matches from today for H2H history (winner_id confirmed)
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
    // Non-fatal — log and return null so other fetches continue
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

  // ── Collect all raw events — deduplicated by ID ────────────────────────────
  const rawEventsMap = new Map<string, any>();

  // ── 1. Live matches (single call, all tours) ───────────────────────────────
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

  // ── 2. Events by date: today + next 3 days (parallel) ─────────────────────
  // Confirmed URL pattern: /api/tennis/events/{day}/{month}/{year}
  // day/month are plain numbers (not zero-padded) — confirmed from screenshot:
  // https://tennisapi1.p.rapidapi.com/api/tennis/events/22/7/2025
  const today = new Date();
  const dateParams = Array.from({ length: 4 }, (_, offset) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + offset);
    return {
      day:   d.getUTCDate(),       // plain number, NOT zero-padded
      month: d.getUTCMonth() + 1,  // 1-12
      year:  d.getUTCFullYear(),
    };
  });

  const dateFetches = dateParams.map(({ day, month, year }) =>
    rapidGet(`/api/tennis/events/${day}/${month}/${year}`)
      .then(raw => ({ raw, label: `${day}/${month}/${year}` }))
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
  const finishedTodayRows:      object[] = [];
  let   skippedNonATPWTA        = 0;
  let   skippedMissingFields    = 0;

  for (const rawEvent of rawEventsMap.values()) {
    // Filter: ATP and WTA only — skip ITF, Challenger, etc.
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

    // Separate finished (for H2H history) from active
    if (match.status === 'finished') {
      finishedTodayRows.push(match);
    } else {
      liveAndUpcomingRows.push(match);
    }

    // Collect unique players
    if (!playersMap.has(player1.id)) playersMap.set(player1.id, player1);
    if (!playersMap.has(player2.id)) playersMap.set(player2.id, player2);
  }

  log.push(
    `[NORMALIZE] live+upcoming: ${liveAndUpcomingRows.length} | ` +
    `finished: ${finishedTodayRows.length} | ` +
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

  // ── 6. Upsert finished matches from today (H2H history, don't overwrite) ──
  if (finishedTodayRows.length > 0) {
    const { error } = await supabase
      .from('matches')
      .upsert(finishedTodayRows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) errors.push(`[DB] finished matches: ${error.message}`);
    else log.push(`[DB] ✓ Upserted ${finishedTodayRows.length} finished matches`);
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    {
      status:  errors.length ? 207 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});