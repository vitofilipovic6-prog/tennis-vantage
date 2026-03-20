// supabase/functions/sync-rankings/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeRankingRow } from '../_shared/normalize.ts';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST = 'tennisapi1.p.rapidapi.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
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

// ── Local extractArray — handles flat array or wrapped object ─────────────────
function extractArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.rankings)) return raw.rankings;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.result)) return raw.result;
  if (Array.isArray(raw?.results)) return raw.results;
  // Sometimes rankings come back as { "1": {...}, "2": {...} }
  if (raw && typeof raw === 'object') {
    const vals = Object.values(raw);
    if (vals.length > 0 && typeof vals[0] === 'object') return vals;
  }
  return [];
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // Accepts: SYNC_SECRET, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY
  // This allows both cron jobs (service role) and manual triggers to work
  // Same change:
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!token || (token !== SERVICE_ROLE_KEY && token !== ANON_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const log: string[] = [];
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

      const playerRows: object[] = [];
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

      // Now upsert rankings
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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
});