import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennis-api-atp-wta-itf.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

const FLAG_MAP: Record<string, string> = {
  Serbia: '🇷🇸', Spain: '🇪🇸', Italy: '🇮🇹', Russia: '🇷🇺', Denmark: '🇩🇰',
  Norway: '🇳🇴', Greece: '🇬🇷', Germany: '🇩🇪', 'United States': '🇺🇸',
  'Great Britain': '🇬🇧', France: '🇫🇷', Argentina: '🇦🇷', Australia: '🇦🇺',
  Canada: '🇨🇦', Croatia: '🇭🇷', Switzerland: '🇨🇭', Austria: '🇦🇹',
  Belgium: '🇧🇪', Kazakhstan: '🇰🇿', Japan: '🇯🇵', China: '🇨🇳',
  Brazil: '🇧🇷', Chile: '🇨🇱', Romania: '🇷🇴', Netherlands: '🇳🇱',
  Ukraine: '🇺🇦', Belarus: '🇧🇾', Poland: '🇵🇱', Bulgaria: '🇧🇬',
  'Czech Republic': '🇨🇿', Slovakia: '🇸🇰', Sweden: '🇸🇪', Portugal: '🇵🇹',
  Hungary: '🇭🇺', Finland: '🇫🇮', Tunisia: '🇹🇳', Morocco: '🇲🇦',
  'South Africa': '🇿🇦', Montenegro: '🇲🇪', Uruguay: '🇺🇾',
};

async function rapidFetch(endpoint: string) {
  const url = `https://${RAPIDAPI_HOST}/tennis/v2/${endpoint}`;
  console.log('GET', url);
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key':  RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  const text = await res.text();
  console.log('RESPONSE:', text.slice(0, 600));
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function extractArray(data: any): any[] {
  if (Array.isArray(data))             return data;
  if (Array.isArray(data?.result))     return data.result;
  if (Array.isArray(data?.results))    return data.results;
  if (Array.isArray(data?.data))       return data.data;
  if (Array.isArray(data?.rankings))   return data.rankings;
  if (Array.isArray(data?.players))    return data.players;
  if (Array.isArray(data?.ranking))    return data.ranking;
  // Log the full shape so we can debug if still empty
  console.log('UNKNOWN SHAPE:', JSON.stringify(data).slice(0, 400));
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization',
      },
    });
  }

  const log: string[]    = [];
  const errors: string[] = [];

  // ATP and WTA use the same singlesRanking endpoint with a type param
  const tours = [
    { tour: 'ATP' as const, endpoint: 'singlesRanking?type=atp' },
    { tour: 'WTA' as const, endpoint: 'singlesRanking?type=wta' },
  ];

  for (const { tour, endpoint } of tours) {
    try {
      log.push(`[${tour}] Fetching ${endpoint}...`);
      const raw  = await rapidFetch(endpoint);
      const list = extractArray(raw);

      log.push(`[${tour}] Got ${list.length} rows`);

      if (list.length === 0) {
        errors.push(`[${tour}] Empty — check logs for API shape`);
        continue;
      }

      // Log first row so we can verify field names
      log.push(`[${tour}] First row: ${JSON.stringify(list[0]).slice(0, 250)}`);

      const top20 = list.slice(0, 20);

      const playerRows = top20.map((r: any, i: number) => {
        // Flexible field extraction — covers all common shapes
        const name = String(
          r.player?.name     ?? r.playerName ??
          r.full_name        ?? r.name       ??
          r.player           ?? 'Unknown'
        );
        const id = String(
          r.player?.id       ?? r.playerId   ??
          r.player_id        ?? r.id         ??
          name.replace(/\s+/g, '-').toLowerCase()
        );
        const country = String(
          r.player?.country  ?? r.player?.nationality ??
          r.country          ?? r.nationality         ?? ''
        );
        const rank = Number(
          r.ranking          ?? r.rank       ??
          r.position         ?? r.place      ?? i + 1
        );
        const points = Number(
          r.points           ?? r.rankingPoints ??
          r.ranking_points   ?? 0
        );

        return {
          id, name, country,
          flag:            FLAG_MAP[country] ?? '🏳️',
          rank,
          wins:            Number(r.wins ?? r.player?.wins ?? 0),
          losses:          Number(r.losses ?? r.player?.losses ?? 0),
          ace_avg:         5.5,
          surface_pref:    'Hard',
          first_serve_pct: 60,
          recent_form:     '- - - - -',
          injury_notes:    null,
          fatigue_score:   0,
          _points:         points,
        };
      });

      const rankingRows = playerRows.map(p => ({
        player_id:  p.id,
        tour,
        rank:       p.rank,
        points:     p._points,
        prev_rank:  p.rank,
        updated_at: new Date().toISOString(),
      }));

      // Strip internal fields before DB insert
      const cleanPlayers = playerRows.map(({ _points, ...rest }) => rest);

      // Upsert players first (FK safety)
      const { error: pErr } = await supabase
        .from('players')
        .upsert(cleanPlayers, { onConflict: 'id', ignoreDuplicates: false });
      if (pErr) {
        errors.push(`[${tour}] players upsert: ${pErr.message}`);
        continue;
      }
      log.push(`[${tour}] Players upserted ✓`);

      // Upsert rankings
      const { error: rErr } = await supabase
        .from('rankings')
        .upsert(rankingRows, { onConflict: 'player_id,tour', ignoreDuplicates: false });
      if (rErr) errors.push(`[${tour}] rankings upsert: ${rErr.message}`);
      else      log.push(`[${tour}] Rankings upserted ✓ (${rankingRows.length} rows)`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${tour}] FATAL: ${msg}`);
      console.error(`[${tour}] FATAL:`, msg);
    }
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    { status: errors.length ? 207 : 200, headers: { 'Content-Type': 'application/json' } }
  );
});