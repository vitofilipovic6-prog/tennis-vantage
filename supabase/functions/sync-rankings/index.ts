// supabase/functions/sync-rankings/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES:
//  - FLAG_MAP expanded to cover all ATP/WTA top-20 nationalities
//  - Fetch limit kept at top 20 per tour
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAPIDAPI_KEY   = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST  = 'tennis-api-atp-wta-itf.p.rapidapi.com';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

// ── Expanded flag map — covers every current ATP/WTA top-20 nationality ───────
const FLAG_MAP: Record<string, string> = {
  // Europe
  'Serbia':         '🇷🇸',
  'Spain':          '🇪🇸',
  'Italy':          '🇮🇹',
  'Germany':        '🇩🇪',
  'France':         '🇫🇷',
  'Great Britain':  '🇬🇧',
  'United Kingdom': '🇬🇧',
  'Norway':         '🇳🇴',
  'Denmark':        '🇩🇰',
  'Greece':         '🇬🇷',
  'Poland':         '🇵🇱',
  'Russia':         '🇷🇺',
  'Belarus':        '🇧🇾',
  'Ukraine':        '🇺🇦',
  'Czech Republic': '🇨🇿',
  'Czechia':        '🇨🇿',
  'Slovakia':       '🇸🇰',
  'Croatia':        '🇭🇷',
  'Bulgaria':       '🇧🇬',
  'Romania':        '🇷🇴',
  'Hungary':        '🇭🇺',
  'Austria':        '🇦🇹',
  'Switzerland':    '🇨🇭',
  'Belgium':        '🇧🇪',
  'Netherlands':    '🇳🇱',
  'Sweden':         '🇸🇪',
  'Finland':        '🇫🇮',
  'Portugal':       '🇵🇹',
  'Estonia':        '🇪🇪',
  'Latvia':         '🇱🇻',
  'Lithuania':      '🇱🇹',
  'Montenegro':     '🇲🇪',
  'Slovenia':       '🇸🇮',
  // Americas
  'United States':  '🇺🇸',
  'USA':            '🇺🇸',
  'Canada':         '🇨🇦',
  'Argentina':      '🇦🇷',
  'Brazil':         '🇧🇷',
  'Chile':          '🇨🇱',
  'Uruguay':        '🇺🇾',
  'Colombia':       '🇨🇴',
  'Mexico':         '🇲🇽',
  // Asia-Pacific
  'Australia':      '🇦🇺',
  'Japan':          '🇯🇵',
  'China':          '🇨🇳',
  'Kazakhstan':     '🇰🇿',
  'South Korea':    '🇰🇷',
  'Korea':          '🇰🇷',
  'Taiwan':         '🇹🇼',
  'India':          '🇮🇳',
  'Thailand':       '🇹🇭',
  // Africa & Middle East
  'South Africa':   '🇿🇦',
  'Tunisia':        '🇹🇳',
  'Morocco':        '🇲🇦',
  'Egypt':          '🇪🇬',
};

async function rapidGet(path: string) {
  const url = `https://${RAPIDAPI_HOST}/tennis/v2/${path}`;
  console.log('GET', url);
  const res  = await fetch(url, {
    headers: {
      'x-rapidapi-key':  RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  const text = await res.text();
  console.log('RESPONSE:', text.slice(0, 800));
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function extractArray(data: any): any[] {
  if (Array.isArray(data))             return data;
  if (Array.isArray(data?.result))     return data.result;
  if (Array.isArray(data?.results))    return data.results;
  if (Array.isArray(data?.data))       return data.data;
  if (Array.isArray(data?.rankings))   return data.rankings;
  if (Array.isArray(data?.players))    return data.players;
  console.log('UNKNOWN SHAPE:', JSON.stringify(data).slice(0, 500));
  return [];
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

  for (const tour of ['atp', 'wta'] as const) {
    try {
      log.push(`[${tour.toUpperCase()}] Fetching rankings...`);
      const raw  = await rapidGet(`${tour}/ranking/singles/`);
      const list = extractArray(raw);

      log.push(`[${tour.toUpperCase()}] Got ${list.length} rows`);
      if (list.length === 0) {
        errors.push(`[${tour.toUpperCase()}] Empty response: ${JSON.stringify(raw).slice(0, 300)}`);
        continue;
      }

      log.push(`[${tour.toUpperCase()}] First row: ${JSON.stringify(list[0]).slice(0, 250)}`);

      const top20 = list.slice(0, 20);

      const playerRows = top20.map((r: any, i: number) => {
        const name    = String(r.player?.name ?? 'Unknown');
        const id      = String(r.player?.id ?? i);
        const country = String(r.player?.country?.name ?? r.player?.countryAcr ?? '');
        const rank    = Number(r.position ?? i + 1);
        const points  = Number(r.point ?? 0);

        return {
          id, name, country,
          // Use emoji flag if country is in our map, otherwise show the country
          // abbreviation so it's still readable (never '🏳️')
          flag:            FLAG_MAP[country] ?? country.slice(0, 2).toUpperCase() ?? '🏳️',
          rank,
          wins:            0,
          losses:          0,
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
        tour:       tour.toUpperCase() as 'ATP' | 'WTA',
        rank:       p.rank,
        points:     p._points,
        prev_rank:  p.rank,
        updated_at: new Date().toISOString(),
      }));

      const cleanPlayers = playerRows.map(({ _points, ...rest }) => rest);

      const { error: pErr } = await supabase
        .from('players')
        .upsert(cleanPlayers, { onConflict: 'id', ignoreDuplicates: false });
      if (pErr) { errors.push(`[${tour.toUpperCase()}] players: ${pErr.message}`); continue; }

      const { error: rErr } = await supabase
        .from('rankings')
        .upsert(rankingRows, { onConflict: 'player_id,tour', ignoreDuplicates: false });
      if (rErr) errors.push(`[${tour.toUpperCase()}] rankings: ${rErr.message}`);
      else      log.push(`[${tour.toUpperCase()}] ✓ Upserted ${rankingRows.length} rankings`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${tour.toUpperCase()}] FATAL: ${msg}`);
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