// ─────────────────────────────────────────────────────────────────────────────
// supabase/functions/sync-matches/index.ts
//
// CHANGES IN THIS VERSION:
//  + Fetches yesterday (-1) + today + 3 days ahead (fixes "today shows tomorrow")
//  + Force-finishes any 'upcoming' match whose match_date is before today UTC
//  + Stores winner_id and score from API when available on finished matches
//  + Cron: deploy with --schedule "*/30 * * * *" (every 30 minutes)
//  + All other logic unchanged from the working version
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeEvent, resolveTour } from '../_shared/normalize.ts';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

// ── Fetch from tennisapi1 ─────────────────────────────────────────────────────
async function rapidGet(path: string) {
  const url = `https://${RAPIDAPI_HOST}/api/tennis/${path}`;
  console.log('GET', url);
  const res = await fetch(url, {
    headers: {
      'Content-Type':    'application/json',
      'x-rapidapi-key':  RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  const text = await res.text();
  console.log('RESPONSE:', text.slice(0, 600));
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ── Extract events array from any response shape ──────────────────────────────
function extractEvents(data: any): any[] {
  if (Array.isArray(data))            return data;
  if (Array.isArray(data?.events))    return data.events;
  if (Array.isArray(data?.result))    return data.result;
  if (Array.isArray(data?.results))   return data.results;
  if (Array.isArray(data?.matches))   return data.matches;
  console.log('UNKNOWN SHAPE:', JSON.stringify(data).slice(0, 400));
  return [];
}

// ── Generate date range as {day, month, year} tuples ─────────────────────────
// daysBack: how many days before today to include (1 = yesterday for late results)
// daysAhead: how many days after today to include (3 = today + 3 future days)
function dateRange(daysBack: number, daysAhead: number): Array<{ day: number; month: number; year: number }> {
  const result = [];
  for (let i = -daysBack; i <= daysAhead; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    result.push({ day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() });
  }
  return result;
}

// ── Utility: split array into chunks of n ────────────────────────────────────
function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
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

  // Accumulated maps for deduplication across multiple day fetches
  const playersMap  = new Map<string, object>();
  const matchesMap  = new Map<string, object>();

  try {
    // ── 1. Live matches ───────────────────────────────────────────────────────
    try {
      log.push('[LIVE] Fetching live matches...');
      const raw    = await rapidGet('matches/live');
      const events = extractEvents(raw);
      log.push(`[LIVE] Got ${events.length} events`);

      for (const ev of events) {
        const tour = resolveTour(ev);
        if (!tour) continue;

        const result = normalizeEvent(ev, 'live');
        if (!result) continue;

        const { match, p1, p2 } = result;
        matchesMap.set(match.id, match);
        if (!playersMap.has(p1.id)) playersMap.set(p1.id, p1);
        if (!playersMap.has(p2.id)) playersMap.set(p2.id, p2);
      }
      log.push(`[LIVE] Parsed ${matchesMap.size} live matches`);
    } catch (e: unknown) {
      errors.push(`[LIVE] ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 2. Date-range matches: yesterday + today + 3 days ahead ──────────────
    // WHY yesterday: The API may return today's matches under yesterday's
    // date in UTC+0 during early morning hours (e.g. 01:00 CEST = 23:00 UTC prev day).
    // Fetching yesterday ensures we never miss today's matches due to timezone lag.
    const dates = dateRange(1, 3); // -1 day back, +3 days ahead
    for (const { day, month, year } of dates) {
      const label = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      try {
        log.push(`[DATES] Fetching ${label}...`);
        const raw    = await rapidGet(`events/${day}/${month}/${year}`);
        const events = extractEvents(raw);
        log.push(`[DATES] ${label}: ${events.length} events`);

        for (const ev of events) {
          const tour = resolveTour(ev);
          if (!tour) continue;

          // Skip if already captured as live (live data is more accurate)
          if (matchesMap.has(String(ev?.id ?? ''))) continue;

          const result = normalizeEvent(ev);
          if (!result) continue;

          const { match, p1, p2 } = result;

          // For past dates: store finished matches WITH their results
          // For today/future: skip matches that are finished (don't pollute upcoming)
          const isYesterdayDate = label < new Date().toISOString().slice(0, 10);
          if (!isYesterdayDate && result.match.status === 'finished') continue;

          matchesMap.set(match.id, match);
          if (!playersMap.has(p1.id)) playersMap.set(p1.id, p1);
          if (!playersMap.has(p2.id)) playersMap.set(p2.id, p2);
        }
      } catch (e: unknown) {
        errors.push(`[DATES ${label}] ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    log.push(`[SYNC] Total: ${matchesMap.size} matches, ${playersMap.size} players`);

    // ── 3. Upsert players ─────────────────────────────────────────────────────
    if (playersMap.size > 0) {
      const playerChunks = chunk([...playersMap.values()], 50);
      for (const ch of playerChunks) {
        const { error } = await supabase
          .from('players')
          .upsert(ch, { onConflict: 'id', ignoreDuplicates: false });
        if (error) errors.push(`[PLAYERS] ${error.message}`);
      }
      log.push(`[PLAYERS] ✓ Upserted ${playersMap.size} players`);
    }

    // ── 4. Upsert matches ─────────────────────────────────────────────────────
    if (matchesMap.size > 0) {
      const matchChunks = chunk([...matchesMap.values()], 50);
      for (const ch of matchChunks) {
        const { error } = await supabase
          .from('matches')
          .upsert(ch, { onConflict: 'id', ignoreDuplicates: false });
        if (error) errors.push(`[MATCHES] ${error.message}`);
      }
      log.push(`[MATCHES] ✓ Upserted ${matchesMap.size} matches`);
    } else {
      log.push('[MATCHES] No matches to upsert');
    }

    // ── 5. FORCE-FINISH: mark stale 'upcoming' rows as 'finished' ─────────────
    // Any match still marked 'upcoming' but whose match_date is BEFORE today
    // (UTC midnight) is definitively over, regardless of what the API says.
    // This prevents old matches from showing the "Predict Winner" button.
    try {
      // Use yesterday-midnight UTC as the cutoff so matches in UTC+2 timezones
      // (e.g. Croatia evening matches) are never prematurely marked finished.
      // A match at 23:00 CEST = 21:00 UTC — using yesterday midnight UTC (not today)
      // ensures we only force-finish matches from at least 2 full days ago,
      // giving a safe buffer for any timezone offset.
      const yesterdayUTC = new Date();
      yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);
      yesterdayUTC.setUTCHours(0, 0, 0, 0);
      const cutoffISO = yesterdayUTC.toISOString();

      const { data: staleMatches, error: staleErr } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'upcoming')
        .lt('match_date', cutoffISO);

      if (staleErr) {
        errors.push(`[FORCE-FINISH] Query error: ${staleErr.message}`);
      } else if (staleMatches && staleMatches.length > 0) {
        const ids = staleMatches.map(m => m.id);
        const { error: updateErr } = await supabase
          .from('matches')
          .update({ status: 'finished' })
          .in('id', ids);

        if (updateErr) {
          errors.push(`[FORCE-FINISH] Update error: ${updateErr.message}`);
        } else {
          log.push(`[FORCE-FINISH] ✓ Marked ${ids.length} stale 'upcoming' matches as 'finished'`);
        }
      } else {
        log.push('[FORCE-FINISH] No stale upcoming matches found');
      }
    } catch (e: unknown) {
      errors.push(`[FORCE-FINISH] ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 6. BACKFILL: fix existing rows where match_type is wrong ──────────────
    try {
      const { data: existingMatches, error: fetchErr } = await supabase
        .from('matches')
        .select('id, tournament, round, player1_id, player2_id, match_type')
        .in('status', ['live', 'upcoming']);

      if (!fetchErr && existingMatches) {
        const updates: { id: string; match_type: string }[] = [];

        for (const m of existingMatches) {
          const nameLower  = (m.tournament ?? '').toLowerCase();
          const roundLower = (m.round ?? '').toLowerCase();

          const isDoubles = roundLower.includes('double') || nameLower.includes('double');
          const isMixed   = roundLower.includes('mixed')  || nameLower.includes('mixed');
          const isWta     = nameLower.includes('wta');

          let derivedType = m.match_type;

          if (isMixed && isDoubles)       derivedType = 'mixed_doubles';
          else if (isDoubles && isWta)    derivedType = 'wta_doubles';
          else if (isDoubles)             derivedType = 'atp_doubles';
          else if (isWta)                 derivedType = 'wta_singles';

          if (derivedType !== m.match_type) {
            updates.push({ id: m.id, match_type: derivedType });
          }
        }

        if (updates.length > 0) {
          for (const u of updates) {
            await supabase
              .from('matches')
              .update({ match_type: u.match_type })
              .eq('id', u.id);
          }
          log.push(`[BACKFILL] ✓ Corrected match_type on ${updates.length} rows`);
        } else {
          log.push('[BACKFILL] All match_type values look correct');
        }
      }
    } catch (backfillErr: unknown) {
      errors.push(`[BACKFILL] ${backfillErr instanceof Error ? backfillErr.message : String(backfillErr)}`);
    }

  } catch (err: unknown) {
    errors.push(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    {
      status:  errors.length ? 207 : 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});