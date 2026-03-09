import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')!;
const RAPIDAPI_HOST = 'tennis-api-atp-wta-itf.p.rapidapi.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

function detectSurface(name: string): string {
    const s = (name ?? '').toLowerCase();
    if (s.includes('clay') || s.includes('roland') || s.includes('monte') ||
        s.includes('madrid') || s.includes('rome') || s.includes('barcelona') ||
        s.includes('hamburg') || s.includes('estoril'))
        return 'Clay';
    if (s.includes('grass') || s.includes('wimbledon') || s.includes('halle') ||
        s.includes('queen') || s.includes('eastbourne'))
        return 'Grass';
    return 'Hard';
}

function fmt(d: Date): string {
    return d.toISOString().split('T')[0];
}

async function rapidGet(path: string) {
    const url = `https://${RAPIDAPI_HOST}/tennis/v2/${path}`;
    console.log('GET', url);
    const res = await fetch(url, {
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_HOST,
        },
    });
    const text = await res.text();
    console.log('RESPONSE:', text.slice(0, 800));
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

function extractArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.fixtures)) return data.fixtures;
    if (Array.isArray(data?.matches)) return data.matches;
    console.log('UNKNOWN SHAPE:', JSON.stringify(data).slice(0, 500));
    return [];
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization' },
        });
    }

    const log: string[] = [];
    const errors: string[] = [];

    try {
        const today = new Date();
        const future = new Date(today);
        future.setDate(today.getDate() + 3);
        const start = fmt(today);
        const end = fmt(future);

        // URL pattern: /tennis/v2/{tour}/fixtures/{start}/{end}
        for (const tour of ['atp', 'wta'] as const) {
            log.push(`[${tour.toUpperCase()}] Fetching fixtures ${start} to ${end}...`);

            const raw = await rapidGet(`${tour}/fixtures/${start}/${end}`);
            const fixtures = extractArray(raw);

            log.push(`[${tour.toUpperCase()}] Got ${fixtures.length} fixtures`);
            if (fixtures.length > 0) {
                log.push(`[${tour.toUpperCase()}] Sample: ${JSON.stringify(fixtures[0]).slice(0, 300)}`);
            }

            const playersMap = new Map<string, object>();
            const matchRows: object[] = [];

            for (const r of fixtures) {
                const matchId = String(r.id ?? r.fixture_id ?? r.match_id ?? '');
                const p1Name = String(r.player1?.name ?? r.homeTeam?.name ?? '');
                const p2Name = String(r.player2?.name ?? r.awayTeam?.name ?? '');
                const p1Id = String(r.player1Id ?? r.player1?.id ?? p1Name.replace(/\s+/g, '-').toLowerCase());
                const p2Id = String(r.player2Id ?? r.player2?.id ?? p2Name.replace(/\s+/g, '-').toLowerCase());

                if (!matchId || !p1Name || !p2Name) continue;

                const statusRaw = String(
                    r.status?.short ?? r.status?.name ?? r.status ?? r.state ?? ''
                ).toLowerCase();
                let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
                if (['1p', '2p', 'live', 'in_play', 'inprogress', 'playing']
                    .some(s => statusRaw.includes(s))) status = 'live';
                if (['fin', 'ft', 'finished', 'complete', 'ended', 'aet', 'retired']
                    .some(s => statusRaw.includes(s))) status = 'finished';

                if (status === 'finished') continue;

                const tournament = String(
                    r.tournament?.name ?? r.league?.name ??
                    r.competition?.name ?? r.tournamentName ?? 'Unknown Tournament'
                );
                const round = String(r.round?.name ?? r.round ?? r.stage ?? '');
                const surface = detectSurface(tournament);
                const score = (r.scores?.home != null && r.scores?.away != null)
                    ? `${r.scores.home}-${r.scores.away}` : r.score ?? null;

                const rawDate = String(r.date ?? r.startTime ?? r.fixture_date ?? r.match_date ?? '');
                const match_date = rawDate
                    ? new Date(rawDate).toISOString()
                    : new Date().toISOString();

                matchRows.push({
                    id: matchId, status, tournament, round,
                    surface, score, match_date,
                    player1_id: p1Id, player2_id: p2Id,
                });

                if (!playersMap.has(p1Id)) {
                    playersMap.set(p1Id, {
                        id: p1Id, name: p1Name,
                        country: String(r.player1?.countryAcr ?? ''),
                        flag: '🏳️', rank: 999, wins: 0, losses: 0,
                        ace_avg: 5.5, surface_pref: detectSurface(String(r.tournament?.name ?? '')),
                        first_serve_pct: 60, recent_form: '- - - - -',
                        injury_notes: null, fatigue_score: 0,
                    });
                }
                if (!playersMap.has(p2Id)) {
                    playersMap.set(p2Id, {
                        id: p2Id, name: p2Name,
                        country: String(r.player2?.countryAcr ?? ''),
                        flag: '🏳️', rank: 999, wins: 0, losses: 0,
                        ace_avg: 5.5, surface_pref: detectSurface(String(r.tournament?.name ?? '')),
                        first_serve_pct: 60, recent_form: '- - - - -',
                        injury_notes: null, fatigue_score: 0,
                    });
                }
            }

            // Upsert players first (FK safety)
            if (playersMap.size > 0) {
                const { error } = await supabase
                    .from('players')
                    .upsert([...playersMap.values()], { onConflict: 'id', ignoreDuplicates: true });
                if (error) errors.push(`[${tour.toUpperCase()}] Players: ${error.message}`);
                else log.push(`[${tour.toUpperCase()}] ✓ Upserted ${playersMap.size} players`);
            }

            // Upsert matches
            if (matchRows.length > 0) {
                const { error } = await supabase
                    .from('matches')
                    .upsert(matchRows, { onConflict: 'id', ignoreDuplicates: false });
                if (error) errors.push(`[${tour.toUpperCase()}] Matches: ${error.message}`);
                else log.push(`[${tour.toUpperCase()}] ✓ Upserted ${matchRows.length} matches`);
            } else {
                log.push(`[${tour.toUpperCase()}] No upcoming matches found`);
            }
        }

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`FATAL: ${msg}`);
    }

    return new Response(
        JSON.stringify({ ok: errors.length === 0, log, errors }),
        { status: errors.length ? 207 : 200, headers: { 'Content-Type': 'application/json' } }
    );
});