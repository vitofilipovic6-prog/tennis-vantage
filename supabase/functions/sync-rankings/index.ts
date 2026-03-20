import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeRankingRow } from '../_shared/normalize.ts';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

const TOURS = [
  { tour: 'ATP' as const, path: '/api/tennis/rankings/atp' },
  { tour: 'WTA' as const, path: '/api/tennis/rankings/wta' },
] as const;

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
    console.error(`[${res.status}] ${url} — ${text.slice(0, 200)}`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`[PARSE] ${url} — ${text.slice(0, 200)}`);
    return null;
  }
}

function extractArray(raw: any): any[] {
  if (Array.isArray(raw))              return raw;
  if (Array.isArray(raw?.rankings))    return raw.rankings;
  if (Array.isArray(raw?.data))        return raw.data;
  if (Array.isArray(raw?.result))      return raw.result;
  if (Array.isArray(raw?.results))     return raw.results;
  if (raw && typeof raw === 'object') {
    const vals = Object.values(raw);
    if (vals.length > 0 && typeof vals[0] === 'object') return vals;
  }
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
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

  for (const { tour, path } of TOURS) {
    try {
      log.push(`[${tour}] Fetching ${path}...`);

      const raw = await rapidGet(path);
      if (!raw) {
        errors.push(`[${tour}] No response from API`);
        continue;
      }

      const list = extractArray(raw);
      log.push(`[${tour}] ${list.length} rows received`);

      if (list.length === 0) {
        errors.push(`[${tour}] Empty — raw: ${JSON.stringify(raw).slice(0, 300)}`);
        continue;
      }

      log.push(`[${tour}] Row[0]: ${JSON.stringify(list[0]).slice(0, 500)}`);

      const playerRows:  object[] = [];
      const rankingRows: object[] = [];

      for (let i = 0; i < Math.min(list.length, 100); i++) {
        const { player, ranking } = normalizeRankingRow(list[i], tour, i);

        if (i < 5) {
          log.push(`[${tour}] #${player.rank} ${player.name} | country:${player.country} flag:${player.flag} | pts:${ranking.points}`);
        }

        playerRows.push(player);
        rankingRows.push({
          ...ranking,
          updated_at: new Date().toISOString(),
        });
      }

      // Upsert players FIRST — rankings has FK on players.id
      const { error: pErr } = await supabase
        .from('players')
        .upsert(playerRows, { onConflict: 'id', ignoreDuplicates: false });

      if (pErr) {
        errors.push(`[${tour}] players upsert failed: ${pErr.message}`);
        continue;
      }
      log.push(`[${tour}] ✓ Upserted ${playerRows.length} players`);

      const { error: rErr } = await supabase
        .from('rankings')
        .upsert(rankingRows, { onConflict: 'player_id,tour', ignoreDuplicates: false });

      if (rErr) {
        errors.push(`[${tour}] rankings upsert failed: ${rErr.message}`);
      } else {
        log.push(`[${tour}] ✓ Upserted ${rankingRows.length} rankings`);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${tour}] FATAL: ${msg}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    {
      status: errors.length ? 207 : 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
});