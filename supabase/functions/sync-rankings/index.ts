// supabase/functions/sync-rankings/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAPIDAPI_KEY     = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST    = 'tennis-api-atp-wta-itf.p.rapidapi.com';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

// ── Covers full names, 3-letter ISO, 2-letter ISO, and tennis-specific codes ──
const FLAG_MAP: Record<string, string> = {
  // ── Full country names ──────────────────────────────────────────────────────
  'Serbia':          '🇷🇸', 'Spain':           '🇪🇸', 'Italy':           '🇮🇹',
  'Russia':          '🇷🇺', 'Germany':         '🇩🇪', 'France':          '🇫🇷',
  'Great Britain':   '🇬🇧', 'United Kingdom':  '🇬🇧', 'England':         '🇬🇧',
  'Norway':          '🇳🇴', 'Denmark':         '🇩🇰', 'Greece':          '🇬🇷',
  'Poland':          '🇵🇱', 'Belarus':         '🇧🇾', 'Ukraine':         '🇺🇦',
  'Czech Republic':  '🇨🇿', 'Czechia':         '🇨🇿', 'Slovakia':        '🇸🇰',
  'Croatia':         '🇭🇷', 'Bulgaria':        '🇧🇬', 'Romania':         '🇷🇴',
  'Hungary':         '🇭🇺', 'Austria':         '🇦🇹', 'Switzerland':     '🇨🇭',
  'Belgium':         '🇧🇪', 'Netherlands':     '🇳🇱', 'Sweden':          '🇸🇪',
  'Finland':         '🇫🇮', 'Portugal':        '🇵🇹', 'Estonia':         '🇪🇪',
  'Latvia':          '🇱🇻', 'Lithuania':       '🇱🇹', 'Montenegro':      '🇲🇪',
  'Slovenia':        '🇸🇮', 'United States':   '🇺🇸', 'USA':             '🇺🇸',
  'Canada':          '🇨🇦', 'Argentina':       '🇦🇷', 'Brazil':          '🇧🇷',
  'Chile':           '🇨🇱', 'Uruguay':         '🇺🇾', 'Colombia':        '🇨🇴',
  'Mexico':          '🇲🇽', 'Australia':       '🇦🇺', 'Japan':           '🇯🇵',
  'China':           '🇨🇳', 'Kazakhstan':      '🇰🇿', 'South Korea':     '🇰🇷',
  'Korea':           '🇰🇷', 'Taiwan':          '🇹🇼', 'India':           '🇮🇳',
  'Thailand':        '🇹🇭', 'South Africa':    '🇿🇦', 'Tunisia':         '🇹🇳',
  'Morocco':         '🇲🇦', 'Egypt':           '🇪🇬', 'Monaco':          '🇲🇨',
  // ── 3-letter ISO (most common RapidAPI format) ──────────────────────────────
  'SRB': '🇷🇸', 'ESP': '🇪🇸', 'ITA': '🇮🇹', 'RUS': '🇷🇺', 'GER': '🇩🇪',
  'DEU': '🇩🇪', 'FRA': '🇫🇷', 'GBR': '🇬🇧', 'ENG': '🇬🇧', 'NOR': '🇳🇴',
  'DEN': '🇩🇰', 'DNK': '🇩🇰', 'GRE': '🇬🇷', 'GRC': '🇬🇷', 'POL': '🇵🇱',
  'BLR': '🇧🇾', 'UKR': '🇺🇦', 'CZE': '🇨🇿', 'SVK': '🇸🇰', 'CRO': '🇭🇷',
  'HRV': '🇭🇷', 'BUL': '🇧🇬', 'BGR': '🇧🇬', 'ROU': '🇷🇴', 'HUN': '🇭🇺',
  'AUT': '🇦🇹', 'SUI': '🇨🇭', 'CHE': '🇨🇭', 'BEL': '🇧🇪', 'NED': '🇳🇱',
  'NLD': '🇳🇱', 'SWE': '🇸🇪', 'FIN': '🇫🇮', 'POR': '🇵🇹', 'EST': '🇪🇪',
  'LAT': '🇱🇻', 'LTU': '🇱🇹', 'MNE': '🇲🇪', 'SLO': '🇸🇮', 'SVN': '🇸🇮',
  'USA': '🇺🇸', 'CAN': '🇨🇦', 'ARG': '🇦🇷', 'BRA': '🇧🇷', 'CHI': '🇨🇱',
  'CHL': '🇨🇱', 'URU': '🇺🇾', 'COL': '🇨🇴', 'MEX': '🇲🇽', 'AUS': '🇦🇺',
  'JPN': '🇯🇵', 'CHN': '🇨🇳', 'KAZ': '🇰🇿', 'KOR': '🇰🇷', 'TPE': '🇹🇼',
  'IND': '🇮🇳', 'THA': '🇹🇭', 'RSA': '🇿🇦', 'TUN': '🇹🇳', 'MAR': '🇲🇦',
  'EGY': '🇪🇬', 'MON': '🇲🇨',
  // ── 2-letter ISO (fallback) ──────────────────────────────────────────────────
  'RS': '🇷🇸', 'ES': '🇪🇸', 'IT': '🇮🇹', 'RU': '🇷🇺', 'DE': '🇩🇪',
  'FR': '🇫🇷', 'GB': '🇬🇧', 'NO': '🇳🇴', 'DK': '🇩🇰', 'GR': '🇬🇷',
  'PL': '🇵🇱', 'BY': '🇧🇾', 'UA': '🇺🇦', 'CZ': '🇨🇿', 'SK': '🇸🇰',
  'HR': '🇭🇷', 'BG': '🇧🇬', 'RO': '🇷🇴', 'HU': '🇭🇺', 'AT': '🇦🇹',
  'CH': '🇨🇭', 'BE': '🇧🇪', 'NL': '🇳🇱', 'SE': '🇸🇪', 'FI': '🇫🇮',
  'PT': '🇵🇹', 'EE': '🇪🇪', 'LV': '🇱🇻', 'LT': '🇱🇹', 'ME': '🇲🇪',
  'SI': '🇸🇮', 'US': '🇺🇸', 'CA': '🇨🇦', 'AR': '🇦🇷', 'BR': '🇧🇷',
  'CL': '🇨🇱', 'UY': '🇺🇾', 'CO': '🇨🇴', 'MX': '🇲🇽', 'AU': '🇦🇺',
  'JP': '🇯🇵', 'CN': '🇨🇳', 'KZ': '🇰🇿', 'KR': '🇰🇷', 'TW': '🇹🇼',
  'IN': '🇮🇳', 'TH': '🇹🇭', 'ZA': '🇿🇦', 'TN': '🇹🇳', 'MA': '🇲🇦',
};

// Tries every reasonable format the API might return
function resolveFlag(raw: string): string {
  if (!raw) return '🏳️';
  const attempts = [
    raw,
    raw.trim(),
    raw.trim().toUpperCase(),
    raw.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
  ];
  for (const a of attempts) {
    if (FLAG_MAP[a]) return FLAG_MAP[a];
  }
  console.warn(`[FLAG] No match for country value: "${raw}"`);
  return '🏳️';
}

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
  if (Array.isArray(data))           return data;
  if (Array.isArray(data?.result))   return data.result;
  if (Array.isArray(data?.results))  return data.results;
  if (Array.isArray(data?.data))     return data.data;
  if (Array.isArray(data?.rankings)) return data.rankings;
  if (Array.isArray(data?.players))  return data.players;
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

      // Log first full row so we can see exactly what fields the API returns
      log.push(`[${tour.toUpperCase()}] Sample row: ${JSON.stringify(list[0]).slice(0, 400)}`);

      const top10 = list.slice(0, 10);

      const playerRows = top10.map((r: any, i: number) => {
        const name = String(r.player?.name ?? 'Unknown');
        const id   = String(r.player?.id   ?? `${tour}-${i}`);
        const rank = Number(r.position     ?? i + 1);
        const pts  = Number(r.point        ?? 0);

        // Try every field where the API might put the country value
        const countryRaw = String(
          r.player?.country?.name    ??
          r.player?.country?.acronym ??
          r.player?.country?.code    ??
          r.player?.countryAcr       ??
          r.player?.nationality      ??
          r.country                  ?? ''
        );

        const flag    = resolveFlag(countryRaw);
        const country = countryRaw;

        // Log every player's country resolution on first sync to debug
        log.push(`[${tour.toUpperCase()}] #${rank} ${name} — country:"${country}" flag:"${flag}"`);

        return {
          id, name, country, flag, rank,
          wins:            0,
          losses:          0,
          ace_avg:         5.5,
          surface_pref:    'Hard',
          first_serve_pct: 60,
          recent_form:     '- - - - -',
          injury_notes:    null,
          fatigue_score:   0,
          _pts:            pts,
        };
      });

      const rankingRows = playerRows.map(p => ({
        player_id:  p.id,
        tour:       tour.toUpperCase() as 'ATP' | 'WTA',
        rank:       p.rank,
        points:     p._pts,
        prev_rank:  p.rank,
        updated_at: new Date().toISOString(),
      }));

      const cleanPlayers = playerRows.map(({ _pts, ...rest }) => rest);

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
      errors.push(`[${tour.toUpperCase()}] FATAL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, log, errors }),
    { status: errors.length ? 207 : 200, headers: { 'Content-Type': 'application/json' } },
  );
});