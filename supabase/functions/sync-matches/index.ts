import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeEvent, resolveTour } from '../_shared/normalize.ts';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

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

function extractEvents(data: any): any[] {
  if (Array.isArray(data))            return data;
  if (Array.isArray(data?.events))    return data.events;
  if (Array.isArray(data?.result))    return data.result;
  if (Array.isArray(data?.results))   return data.results;
  if (Array.isArray(data?.matches))   return data.matches;
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

async function upsertPlayersPreservingRank(
  players: any[],
  log: string[],
  errors: string[]
): Promise<void> {
  if (players.length === 0) return;

  const CHUNK_SIZE = 100;
  let successCount = 0;

  for (let i = 0; i < players.length; i += CHUNK_SIZE) {
    const batch    = players.slice(i, i + CHUNK_SIZE);
    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;

    const payload = batch.map(p => ({
      id:              String(p.id),
      name:            String(p.name),
      country:         String(p.country ?? ''),
      flag:            String(p.flag ?? '🏳️'),
      rank:            Number(p.rank ?? 999),
      wins:            Number(p.wins ?? 0),
      losses:          Number(p.losses ?? 0),
      ace_avg:         Number(p.ace_avg ?? 5.5),
      surface_pref:    String(p.surface_pref ?? 'Hard'),
      first_serve_pct: Number(p.first_serve_pct ?? 60),
      recent_form:     String(p.recent_form ?? '- - - - -'),
      injury_notes:    p.injury_notes ?? null,
      fatigue_score:   Number(p.fatigue_score ?? 0),
    }));

    // Pass as JSON string so Supabase casts to jsonb correctly
    const { error } = await supabase.rpc('upsert_players_bulk', {
      p_players: JSON.stringify(payload),
    });

    if (error) {
      log.push(`[PLAYERS] Bulk failed batch ${batchNum}, falling back: ${error.message}`);
      for (const p of batch) {
        const { error: rpcErr } = await supabase.rpc('upsert_player_preserve_rank', {
          p_id:           String(p.id),
          p_name:         String(p.name),
          p_country:      String(p.country ?? ''),
          p_flag:         String(p.flag ?? '🏳️'),
          p_rank:         Number(p.rank ?? 999),
          p_wins:         Number(p.wins ?? 0),
          p_losses:       Number(p.losses ?? 0),
          p_ace_avg:      Number(p.ace_avg ?? 5.5),
          p_surface_pref: String(p.surface_pref ?? 'Hard'),
          p_first_serve:  Number(p.first_serve_pct ?? 60),
          p_recent_form:  String(p.recent_form ?? '- - - - -'),
          p_injury_notes: p.injury_notes ?? null,
          p_fatigue:      Number(p.fatigue_score ?? 0),
        });
        if (rpcErr) errors.push(`[PLAYERS/RPC] ${p.name}: ${rpcErr.message}`);
        else successCount++;
      }
    } else {
      successCount += batch.length;
      log.push(`[PLAYERS] ✓ Bulk batch ${batchNum} (${batch.length} players)`);
    }
  }

  log.push(`[PLAYERS] ✓ Total upserted: ${successCount}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
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

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // Supabase's gateway validates the JWT signature before the request reaches
  // us, so we can safely trust the decoded payload role claim.
  // Cron sends service_role, manual triggers send anon — both are accepted.
  const rawAuth = req.headers.get('Authorization') ?? '';
  const token   = rawAuth.replace(/^Bearer\s+/i, '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payloadBase64 = token.split('.')[1];
    const payload       = JSON.parse(atob(payloadBase64));
    const role          = payload?.role ?? '';

    console.log('[AUTH] JWT role:', role);

    if (role !== 'service_role' && role !== 'anon') {
      // Also accept raw SYNC_SECRET for external cron services
      const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';
      if (!SYNC_SECRET || token !== SYNC_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized', role }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('[AUTH] Authorized as:', payload?.role ?? 'sync_secret');
  } catch (_) {
    // Token is not a JWT — check if it matches SYNC_SECRET
    const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';
    if (!SYNC_SECRET || token !== SYNC_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log('[AUTH] Authorized via SYNC_SECRET');
  }

  const log:    string[] = [];
  const errors: string[] = [];

  const playersMap = new Map<string, any>();
  const matchesMap = new Map<string, object>();

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

    // ── 2. Date-range matches ─────────────────────────────────────────────────
    const sleep    = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const dates    = dateRange(0, 0);
    const todayUTC = new Date().toISOString().slice(0, 10);

    for (const [i, { day, month, year }] of dates.entries()) {
      if (i > 0) await sleep(1100);

      const label = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      try {
        log.push(`[DATES] Fetching ${label}...`);
        const raw    = await rapidGet(`events/${day}/${month}/${year}`);
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

    // ── 5. Force-finish stale matches ─────────────────────────────────────────
    try {
      const todayLocalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());

      for (const stalledStatus of ['upcoming', 'live'] as const) {
        const { data: staleMatches, error: staleErr } = await supabase
          .from('matches')
          .select('id, local_date, match_date')
          .eq('status', stalledStatus)
          .not('local_date', 'is', null)
          .lt('local_date', todayLocalDate);

        if (staleErr) {
          errors.push(`[FORCE-FINISH/${stalledStatus}] ${staleErr.message}`);
          continue;
        }

        if (staleMatches && staleMatches.length > 0) {
          const ids = staleMatches.map((m: any) => m.id);
          log.push(`[FORCE-FINISH] Finishing ${ids.length} stale '${stalledStatus}' matches`);
          const { error: updateErr } = await supabase
            .from('matches').update({ status: 'finished' }).in('id', ids);
          if (updateErr) errors.push(`[FORCE-FINISH/${stalledStatus}] ${updateErr.message}`);
          else log.push(`[FORCE-FINISH] ✓ Marked ${ids.length} as finished`);
        } else {
          log.push(`[FORCE-FINISH/${stalledStatus}] No stale matches found`);
        }
      }

      // Null local_date safety net
      const { data: nullDateMatches } = await supabase
        .from('matches')
        .select('id, match_date')
        .in('status', ['upcoming', 'live'])
        .is('local_date', null)
        .lt('match_date', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());

      if (nullDateMatches && nullDateMatches.length > 0) {
        const ids = nullDateMatches.map((m: any) => m.id);
        await supabase.from('matches').update({ status: 'finished' }).in('id', ids);
        log.push(`[FORCE-FINISH] ✓ Finished ${ids.length} null-local_date orphans`);
      }
    } catch (e: unknown) {
      errors.push(`[FORCE-FINISH] ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 6. Backfill match_type ────────────────────────────────────────────────
    try {
      const { data: existingMatches, error: fetchErr } = await supabase
        .from('matches')
        .select('id, tournament, round, match_type')
        .in('status', ['live', 'upcoming']);

      if (!fetchErr && existingMatches) {
        const updates: { id: string; match_type: string }[] = [];

        for (const m of existingMatches) {
          const nameLower  = (m.tournament ?? '').toLowerCase();
          const roundLower = (m.round ?? '').toLowerCase();
          const isDoubles  = roundLower.includes('double') || nameLower.includes('double');
          const isMixed    = roundLower.includes('mixed')  || nameLower.includes('mixed');
          const isWta      = nameLower.includes('wta');

          let derivedType = m.match_type;
          if (isMixed && isDoubles)    derivedType = 'mixed_doubles';
          else if (isDoubles && isWta) derivedType = 'wta_doubles';
          else if (isDoubles)          derivedType = 'atp_doubles';
          else if (isWta)              derivedType = 'wta_singles';

          if (derivedType !== m.match_type) updates.push({ id: m.id, match_type: derivedType });
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
    } catch (e: unknown) {
      errors.push(`[BACKFILL] ${e instanceof Error ? e.message : String(e)}`);
    }

  } catch (err: unknown) {
    errors.push(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    {
      status: errors.length ? 207 : 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});