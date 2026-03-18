// supabase/functions/sync-matches/index.ts
//
// RANK FIX: Players are now upserted via the upsert_player_preserve_rank()
// SQL function which uses a conditional ON CONFLICT DO UPDATE:
//   - Rank is ONLY overwritten when incoming < 999 OR stored >= 999
//   - Real ATP/WTA ranks from sync-rankings are never replaced with 999
//   - name/country/flag are always updated to stay fresh
//   - wins/losses use GREATEST() so we never lose historical data
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeEvent, resolveTour } from '../_shared/normalize.ts';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

async function rapidGet(path: string) {
  const url = `https://${RAPIDAPI_HOST}/api/tennis/${path}`;
  console.log('GET', url);
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  const text = await res.text();
  console.log('RESPONSE:', text.slice(0, 600));
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function extractEvents(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.matches)) return data.matches;
  return [];
}

function dateRange(daysBack: number, daysAhead: number) {
  const result = [];
  for (let i = -daysBack; i <= daysAhead; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    result.push({ day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() });
  }
  return result;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── Rank-safe player upsert ───────────────────────────────────────────────────
// Calls the Postgres function created by the SQL migration.
// This is the only correct way to upsert match-API players without nuking ranks.
async function upsertPlayersPreservingRank(
  players: any[],
  log: string[],
  errors: string[]
): Promise<void> {
  if (players.length === 0) return;

  let successCount = 0;
  let errorCount = 0;

  for (const p of players) {
    const { error } = await supabase.rpc('upsert_player_preserve_rank', {
      p_id: String(p.id),
      p_name: String(p.name),
      p_country: String(p.country ?? ''),
      p_flag: String(p.flag ?? '🏳️'),
      p_rank: Number(p.rank ?? 999),
      p_wins: Number(p.wins ?? 0),
      p_losses: Number(p.losses ?? 0),
      p_ace_avg: Number(p.ace_avg ?? 5.5),
      p_surface_pref: String(p.surface_pref ?? 'Hard'),
      p_first_serve: Number(p.first_serve_pct ?? 60),
      p_recent_form: String(p.recent_form ?? '- - - - -'),
      p_injury_notes: p.injury_notes ?? null,
      p_fatigue: Number(p.fatigue_score ?? 0),
    });

    if (error) {
      errorCount++;
      if (errorCount <= 3) errors.push(`[PLAYERS/RPC] ${p.name}: ${error.message}`);
    } else {
      successCount++;
    }
  }

  log.push(`[PLAYERS] ✓ rank-safe upsert: ${successCount} ok, ${errorCount} errors`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  // Accepts either:
  //   1. A known SYNC_SECRET token (from cron jobs / server calls)
  //   2. The Supabase anon key (from the frontend triggerSync call)
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const isAuthorized = token === SYNC_SECRET || token === ANON_KEY;

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const log: string[] = [];
  const errors: string[] = [];

  const playersMap = new Map<string, any>();
  const matchesMap = new Map<string, object>();

  try {
    // ── 1. Live matches ───────────────────────────────────────────────────────
    try {
      log.push('[LIVE] Fetching live matches...');
      const raw = await rapidGet('matches/live');
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

    // ── 2. Date-range matches ─────────────────────────────────────────────────
    // ── 2. Date-range matches ─────────────────────────────────────────────────
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const dates = dateRange(2, 3);
    const todayUTC = new Date().toISOString().slice(0, 10);

    for (const [i, { day, month, year }] of dates.entries()) {
      // ⏱ Throttle: BASIC plan = 1 req/sec. Live call already used 1 slot,
      // so wait 1.1s before each date request to stay safely under the limit.
      if (i > 0) await sleep(1100);

      const label = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      try {
        log.push(`[DATES] Fetching ${label}...`);
        const raw = await rapidGet(`events/${day}/${month}/${year}`);
        const events = extractEvents(raw);
        log.push(`[DATES] ${label}: ${events.length} events`);

        for (const ev of events) {
          const tour = resolveTour(ev);
          if (!tour) continue;
          if (matchesMap.has(String(ev?.id ?? ''))) continue;

          const result = normalizeEvent(ev);
          if (!result) continue;

          const { match, p1, p2 } = result;
          const isFutureDate = label > todayUTC;
          if (isFutureDate && result.match.status === 'finished') continue;

          matchesMap.set(match.id, match);
          if (!playersMap.has(p1.id)) playersMap.set(p1.id, p1);
          if (!playersMap.has(p2.id)) playersMap.set(p2.id, p2);
        }
      } catch (e: unknown) {
        errors.push(`[DATES ${label}] ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    log.push(`[SYNC] Total: ${matchesMap.size} matches, ${playersMap.size} players`);

    // ── 3. Rank-safe player upsert ────────────────────────────────────────────
    // Uses the upsert_player_preserve_rank() Postgres function.
    // Never overwrites a real rank (< 999) with the match-API placeholder (999).
    if (playersMap.size > 0) {
      await upsertPlayersPreservingRank([...playersMap.values()], log, errors);
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

    // ── 5. FORCE-FINISH stale matches ─────────────────────────────────────────────
    // Uses local_date (Europe/Paris timezone) NOT match_date (UTC) to avoid
    // killing matches that are still live in their local timezone.
    try {
      const todayLocalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()); // e.g. "2026-03-17"

      for (const stalledStatus of ['upcoming', 'live'] as const) {
        const { data: staleMatches, error: staleErr } = await supabase
          .from('matches')
          .select('id, local_date, match_date')
          .eq('status', stalledStatus)
          .not('local_date', 'is', null)
          .lt('local_date', todayLocalDate); // ← KEY: compare date strings, not timestamps

        if (staleErr) {
          errors.push(`[FORCE-FINISH/${stalledStatus}] ${staleErr.message}`);
          continue;
        }

        if (staleMatches && staleMatches.length > 0) {
          const ids = staleMatches.map((m: any) => m.id);
          log.push(`[FORCE-FINISH] Finishing ${ids.length} stale '${stalledStatus}' matches with local_date < ${todayLocalDate}`);

          const { error: updateErr } = await supabase
            .from('matches')
            .update({ status: 'finished' })
            .in('id', ids);

          if (updateErr) {
            errors.push(`[FORCE-FINISH/${stalledStatus}] update error: ${updateErr.message}`);
          } else {
            log.push(`[FORCE-FINISH] ✓ Marked ${ids.length} '${stalledStatus}' as finished`);
          }
        } else {
          log.push(`[FORCE-FINISH/${stalledStatus}] No stale matches found`);
        }
      }

      // Also handle matches with NULL local_date as a safety net —
      // fall back to UTC date comparison for these orphaned rows only
      const { data: nullDateMatches } = await supabase
        .from('matches')
        .select('id, match_date')
        .in('status', ['upcoming', 'live'])
        .is('local_date', null)
        .lt('match_date', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());

      if (nullDateMatches && nullDateMatches.length > 0) {
        const ids = nullDateMatches.map((m: any) => m.id);
        await supabase.from('matches').update({ status: 'finished' }).in('id', ids);
        log.push(`[FORCE-FINISH] ✓ Finished ${ids.length} null-local_date orphan matches`);
      }

    } catch (e: unknown) {
      errors.push(`[FORCE-FINISH] ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 6. BACKFILL match_type ────────────────────────────────────────────────
    try {
      const { data: existingMatches, error: fetchErr } = await supabase
        .from('matches')
        .select('id, tournament, round, match_type')
        .in('status', ['live', 'upcoming']);

      if (!fetchErr && existingMatches) {
        const updates: { id: string; match_type: string }[] = [];

        for (const m of existingMatches) {
          const nameLower = (m.tournament ?? '').toLowerCase();
          const roundLower = (m.round ?? '').toLowerCase();
          const isDoubles = roundLower.includes('double') || nameLower.includes('double');
          const isMixed = roundLower.includes('mixed') || nameLower.includes('mixed');
          const isWta = nameLower.includes('wta');

          let derivedType = m.match_type;
          if (isMixed && isDoubles) derivedType = 'mixed_doubles';
          else if (isDoubles && isWta) derivedType = 'wta_doubles';
          else if (isDoubles) derivedType = 'atp_doubles';
          else if (isWta) derivedType = 'wta_singles';

          if (derivedType !== m.match_type) {
            updates.push({ id: m.id, match_type: derivedType });
          }
        }

        if (updates.length > 0) {
          for (const u of updates) {
            await supabase.from('matches').update({ match_type: u.match_type }).eq('id', u.id);
          }
          log.push(`[BACKFILL] ✓ Fixed match_type on ${updates.length} rows`);
        } else {
          log.push('[BACKFILL] All match_type values correct');
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
      status: errors.length ? 207 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});