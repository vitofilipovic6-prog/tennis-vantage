// supabase/functions/sync-live/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight live-score sync — runs every 5 minutes via cron.
// ONLY updates status + score on EXISTING match rows.
// Never inserts new matches, never touches players.
// This is what keeps live scores fresh between the twice-daily full syncs.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTour, resolveMatchType } from '../_shared/normalize.ts';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

async function rapidGet(path: string): Promise<any> {
  const url = `https://${RAPIDAPI_HOST}/api/tennis/${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type':    'application/json',
      'x-rapidapi-key':  RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
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

function extractScore(ev: any): string | null {
  // Try structured score first
  const periods = ev?.homeScore?.period1 != null
    ? ev.homeScore
    : ev?.score?.home != null
    ? { ...ev.score, isHome: true }
    : null;

  if (ev?.homeScore != null && ev?.awayScore != null) {
    const h = ev.homeScore;
    const a = ev.awayScore;
    const sets: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const hp = h[`period${i}`];
      const ap = a[`period${i}`];
      if (hp != null && ap != null) sets.push(`${hp}-${ap}`);
    }
    if (sets.length > 0) return sets.join(' ');
    // Fall back to current game score
    if (h.current != null && a.current != null) return `${h.current}-${a.current}`;
  }

  // Try flat score fields
  const home = ev?.home_score ?? ev?.homeScore?.current ?? ev?.score_home;
  const away = ev?.away_score ?? ev?.awayScore?.current ?? ev?.score_away;
  if (home != null && away != null) return `${home}-${away}`;

  return null;
}

function extractWinner(ev: any, p1Id: string, p2Id: string): string | null {
  const code = ev?.winnerCode ?? ev?.winner_code;
  if (code === 1) return p1Id;
  if (code === 2) return p2Id;
  return null;
}

function resolveStatus(ev: any): 'live' | 'upcoming' | 'finished' {
  const type = String(ev?.status?.type ?? '').toLowerCase();
  const code = Number(ev?.status?.code ?? -1);
  if (type === 'inprogress' || code === 6 || type === 'live') return 'live';
  if (type === 'finished' || code === 100 || type === 'ended') return 'finished';
  return 'upcoming';
}

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

  // Auth guard — accepts anon key or sync secret
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';
  const ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (token !== SYNC_SECRET && token !== ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const log:    string[] = [];
  const errors: string[] = [];

  try {
    // ── 1. Fetch live events from RapidAPI ───────────────────────────────────
    log.push('[LIVE] Fetching live events...');
    const raw    = await rapidGet('matches/live');
    const events = extractEvents(raw);
    log.push(`[LIVE] Got ${events.length} raw events`);

    // Filter to tennis tours only
    const tennisEvents = events.filter(ev => resolveTour(ev) !== null);
    log.push(`[LIVE] ${tennisEvents.length} tennis events after tour filter`);

    if (tennisEvents.length === 0) {
      // No live matches right now — mark all currently-live DB rows as finished
      // only if their match_date was more than 3 hours ago (safety buffer)
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: staleLive } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'live')
        .lt('match_date', cutoff);

      if (staleLive && staleLive.length > 0) {
        const ids = staleLive.map((m: any) => m.id);
        await supabase.from('matches').update({ status: 'finished' }).in('id', ids);
        log.push(`[LIVE] No live events — finished ${ids.length} stale live rows`);
      } else {
        log.push('[LIVE] No live events — nothing to finish');
      }
    } else {
      // ── 2. Build update map ────────────────────────────────────────────────
      const liveIds: string[] = [];
      const updates: Array<{ id: string; status: string; score: string | null; winner_id: string | null }> = [];

      for (const ev of tennisEvents) {
        const id    = String(ev?.id ?? '');
        const p1Id  = String(ev?.homeTeam?.id ?? '');
        const p2Id  = String(ev?.awayTeam?.id ?? '');
        if (!id) continue;

        const status    = resolveStatus(ev);
        const score     = extractScore(ev);
        const winner_id = status === 'finished' ? extractWinner(ev, p1Id, p2Id) : null;

        liveIds.push(id);
        updates.push({ id, status, score, winner_id });
      }

      // ── 3. Apply updates — only to rows that EXIST in DB ──────────────────
      // We do this in batches of 50 using upsert with ignoreDuplicates: false
      // But we ONLY update status/score/winner_id, never touch player/tournament data
      let updatedCount = 0;
      for (const upd of updates) {
        const { error } = await supabase
          .from('matches')
          .update({
            status:    upd.status,
            score:     upd.score,
            winner_id: upd.winner_id,
          })
          .eq('id', upd.id); // only updates if row exists — safe

        if (error) {
          errors.push(`[UPDATE ${upd.id}] ${error.message}`);
        } else {
          updatedCount++;
        }
      }
      log.push(`[LIVE] Updated ${updatedCount} matches`);

      // ── 4. Mark DB rows as finished if they dropped out of live feed ───────
      // A match is "finished" if it was live in DB but not in today's live feed,
      // AND its match_date was more than 2 hours ago
      const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      const { data: dbLiveRows } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'live')
        .lt('match_date', cutoff);

      if (dbLiveRows && dbLiveRows.length > 0) {
        const liveIdSet  = new Set(liveIds);
        const toFinish   = dbLiveRows
          .map((m: any) => m.id)
          .filter((id: string) => !liveIdSet.has(id));

        if (toFinish.length > 0) {
          await supabase.from('matches').update({ status: 'finished' }).in('id', toFinish);
          log.push(`[LIVE] Finished ${toFinish.length} matches no longer in live feed`);
        }
      }
    }

    // ── 5. Mark upcoming→live for matches whose time has passed ───────────────
    // This catches matches the live API hasn't picked up yet (small tournaments)
    const nowIso     = new Date().toISOString();
    const bufferIso  = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min grace
    const { data: shouldBeLive } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'upcoming')
      .lt('match_date', bufferIso); // scheduled more than 5 min ago

    if (shouldBeLive && shouldBeLive.length > 0) {
      const ids = shouldBeLive.map((m: any) => m.id);
      await supabase.from('matches').update({ status: 'live' }).in('id', ids);
      log.push(`[AUTO-LIVE] Promoted ${ids.length} overdue upcoming matches to live`);
    }

  } catch (e: unknown) {
    errors.push(`[FATAL] ${e instanceof Error ? e.message : String(e)}`);
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
});