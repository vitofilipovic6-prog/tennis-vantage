// supabase/functions/sync-rankings/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Syncs ATP and WTA rankings into Supabase.
//
// ENDPOINTS:
//   GET https://tennisapi1.p.rapidapi.com/api/tennis/ranking/atp
//   GET https://tennisapi1.p.rapidapi.com/api/tennis/ranking/wta
//
// CONFIRMED RESPONSE (from atpRankings screenshot):
//   Root is a flat array — no wrapper key.
//   Carlos Alcaraz: ranking:1, points:13550, previousRanking:1, team.id:275923
//   Jannik Sinner:  ranking:2, team.id confirmed in screenshot
//   WTA: Aryna Sabalenka ranking:1, points:10675, team.id:157754
//        Iga Swiatek ranking:2, team.id confirmed
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractArray, normalizeRankingRow } from '../_shared/normalize.ts';

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

  for (const { tour, path } of TOURS) {
    try {
      log.push(`[${tour}] Fetching ${path}...`);

      const raw = await rapidGet(path);
      if (!raw) {
        errors.push(`[${tour}] No response from API`);
        continue;
      }

      // Rankings come back as a flat array — extractArray handles this
      const list = extractArray(raw);
      log.push(`[${tour}] ${list.length} rows received`);

      if (list.length === 0) {
        errors.push(`[${tour}] Empty — raw: ${JSON.stringify(raw).slice(0, 300)}`);
        continue;
      }

      // Log first row to verify field mapping on real data
      log.push(`[${tour}] Row[0]: ${JSON.stringify(list[0]).slice(0, 500)}`);

      const playerRows:  object[] = [];
      const rankingRows: object[] = [];

      // Take top 100 — API typically returns full list
      for (let i = 0; i < Math.min(list.length, 100); i++) {
        const { player, ranking } = normalizeRankingRow(list[i], tour, i);

        // Log first 5 to verify country/flag resolution
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
        continue; // Don't attempt rankings if players failed
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
      status:  errors.length ? 207 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});