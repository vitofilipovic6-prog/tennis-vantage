// ─────────────────────────────────────────────────────────────────────────────
// tennisApi.js – TennisVantage
// Real API: api-tennis.p.rapidapi.com  (VITE_RAPIDAPI_KEY)
// Fallback: rich MOCK_DATA — app never breaks without a key
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY  = import.meta.env.VITE_RAPIDAPI_KEY;
const API_HOST = import.meta.env.VITE_RAPIDAPI_HOST || 'api-tennis.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;
const HEADERS  = { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': API_HOST };

const USE_MOCK = !API_KEY || API_KEY === 'your_key_here';

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) throw new Error(`API_ERROR:${res.status}`);
  const json = await res.json();
  return json?.result ?? json;
}

// ── Date helper ───────────────────────────────────────────────────────────────
function toDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

// ── Country flag emoji from 3-letter ISO ─────────────────────────────────────
function countryFlag(iso) {
  if (!iso || iso.length < 2) return '🎾';
  const map = {
    SRB:'🇷🇸', ESP:'🇪🇸', ITA:'🇮🇹', RUS:'🇷🇺', DEN:'🇩🇰',
    NOR:'🇳🇴', GRE:'🇬🇷', GER:'🇩🇪', GBR:'🇬🇧', USA:'🇺🇸',
    ARG:'🇦🇷', CAN:'🇨🇦', AUS:'🇦🇺', FRA:'🇫🇷', BEL:'🇧🇪',
    BUL:'🇧🇬', POL:'🇵🇱', CRO:'🇭🇷', HUN:'🇭🇺', CZE:'🇨🇿',
    BLR:'🇧🇾', KAZ:'🇰🇿', CHN:'🇨🇳', ROU:'🇷🇴', UKR:'🇺🇦',
    SVK:'🇸🇰', JPN:'🇯🇵', LAT:'🇱🇻', TUN:'🇹🇳', BAH:'🇧🇸',
  };
  return map[iso.toUpperCase()] ?? '🎾';
}

// ── Normalise a raw match object from the API ─────────────────────────────────
function normaliseMatch(m) {
  return {
    id:         m.match_id ?? m.id,
    status:     m.match_status === 'live' ? 'live' : 'upcoming',
    tournament: m.tournament_name ?? m.tournament,
    round:      m.round_name ?? m.round,
    surface:    m.tournament_surface ?? m.surface ?? 'Hard',
    date:       m.match_time ?? m.date,
    score:      m.score ?? null,
    player1: {
      id:           m.home_id ?? m.player1?.id,
      name:         m.home_name ?? m.player1?.name,
      flag:         countryFlag(m.home_country ?? m.player1?.country),
      rank:         m.home_rank ?? m.player1?.rank ?? 99,
      surface_pref: m.player1?.surface_pref ?? 'Hard',
      recent_form:  m.player1?.recent_form,
    },
    player2: {
      id:           m.away_id ?? m.player2?.id,
      name:         m.away_name ?? m.player2?.name,
      flag:         countryFlag(m.away_country ?? m.player2?.country),
      rank:         m.away_rank ?? m.player2?.rank ?? 99,
      surface_pref: m.player2?.surface_pref ?? 'Hard',
      recent_form:  m.player2?.recent_form,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── Live matches ──────────────────────────────────────────────────────────────
export async function getLiveMatches() {
  if (USE_MOCK) return MOCK_DATA.matches.filter(m => m.status === 'live');
  try {
    const data = await apiFetch('/matches', { type: 'ATP', status: 'live' });
    return (data ?? []).map(normaliseMatch);
  } catch {
    return MOCK_DATA.matches.filter(m => m.status === 'live');
  }
}

// ── Upcoming matches ──────────────────────────────────────────────────────────
export async function getUpcomingMatches() {
  if (USE_MOCK) return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  try {
    const today = toDateString(new Date());
    const data  = await apiFetch('/matches', { type: 'ATP', status: 'NS', date_start: today });
    return (data ?? []).map(normaliseMatch);
  } catch {
    return MOCK_DATA.matches.filter(m => m.status === 'upcoming');
  }
}

// ── Matches by specific calendar date ────────────────────────────────────────
export async function getMatchesByDate(date) {
  const dateStr = toDateString(date);
  if (USE_MOCK) return MOCK_DATA.getMatchesForDate(dateStr);
  try {
    const data = await apiFetch('/matches', { type: 'ATP', date_start: dateStr, date_stop: dateStr });
    return (data ?? []).map(normaliseMatch);
  } catch {
    return MOCK_DATA.getMatchesForDate(dateStr);
  }
}

// ── Rankings — ATP or WTA, returns top 20 ────────────────────────────────────
export async function getRankings(tour = 'ATP') {
  if (USE_MOCK) return MOCK_DATA.rankings[tour] ?? MOCK_DATA.rankings.ATP;
  try {
    const data = await apiFetch('/rankings', { type: tour });
    if (!data?.length) throw new Error('empty');
    return data.slice(0, 20).map((p, i) => ({
      id:           p.player_id ?? i,
      rank:         p.ranking ?? i + 1,
      name:         p.player_name,
      country:      p.player_country,
      flag:         countryFlag(p.player_country),
      points:       p.ranking_points,
      wins:         p.wins ?? '—',
      losses:       p.losses ?? '—',
      surface_pref: p.best_surface ?? 'Hard',
      prev_rank:    p.ranking_previous ?? p.ranking ?? i + 1,
      tour,
    }));
  } catch {
    return MOCK_DATA.rankings[tour] ?? MOCK_DATA.rankings.ATP;
  }
}

// ── Player profile + last-5 matches with serve stats ─────────────────────────
export async function getPlayerProfile(playerId, tour = 'ATP') {
  if (USE_MOCK) return MOCK_DATA.playerProfiles[playerId] ?? null;
  try {
    const matchType = tour === 'WTA' ? 'WTA' : 'ATP';
    const [profileArr, matches] = await Promise.all([
      apiFetch('/player', { player_id: playerId }),
      apiFetch('/matches', { type: matchType, player_id: playerId, status: 'FT', limit: 5 }),
    ]);
    const p = Array.isArray(profileArr) ? profileArr[0] : profileArr;
    const last5 = (matches ?? []).slice(0, 5).map(m => ({
      tournament:    m.tournament_name,
      surface:       m.tournament_surface,
      opponent:      m.away_name === p.player_name ? m.home_name : m.away_name,
      result:        m.match_winner === p.player_name ? 'W' : 'L',
      score:         m.score,
      first_serve:   m.stat_first_serve_percentage  ?? '—',
      second_serve:  m.stat_second_serve_percentage ?? '—',
      aces:          m.stat_aces                    ?? '—',
      double_faults: m.stat_double_faults           ?? '—',
    }));
    return {
      id:            p.player_id,
      name:          p.player_name,
      country:       p.player_country,
      flag:          countryFlag(p.player_country),
      born:          p.player_birth_date ?? '—',
      height:        p.player_height ? `${p.player_height} cm` : '—',
      turned_pro:    p.player_turned_pro ?? '—',
      hand:          p.player_hand ?? '—',
      bio:           p.player_description ?? `${p.player_name} is a professional ${tour} tennis player known for their competitive game and dedication to the sport.`,
      rank:          p.ranking ?? '—',
      career_wins:   p.wins ?? '—',
      career_losses: p.losses ?? '—',
      grand_slams:   p.grand_slams_titles ?? 0,
      surface_pref:  p.best_surface ?? 'Hard',
      tour,
      last5,
    };
  } catch {
    return MOCK_DATA.playerProfiles[playerId] ?? null;
  }
}

// ── Win probability prediction ────────────────────────────────────────────────
export async function getPrediction(match) {
  const p1 = match.player1;
  const p2 = match.player2;
  const rankEdge    = (p2.rank - p1.rank) * 1.2;
  const surfaceEdge = match.surface === p1.surface_pref ? 6 : match.surface === p2.surface_pref ? -6 : 0;
  const raw         = 50 + rankEdge + surfaceEdge;
  const p1WinPct    = Math.min(88, Math.max(12, Math.round(raw)));
  return {
    player1_win_pct: p1WinPct,
    player2_win_pct: 100 - p1WinPct,
    confidence: Math.abs(p1WinPct - 50) > 20 ? 'High' : Math.abs(p1WinPct - 50) > 10 ? 'Medium' : 'Low',
    key_factors: [
      `Ranking edge: #${p1.rank} vs #${p2.rank}`,
      `Surface: ${match.surface === p1.surface_pref ? p1.name : match.surface === p2.surface_pref ? p2.name : 'Neutral'} advantage`,
      `Recent form: ${p1.recent_form ?? '—'} vs ${p2.recent_form ?? '—'}`,
    ],
  };
}

// ── AI Chat — Anthropic API, covers both ATP and WTA ─────────────────────────
export async function sendChatMessage(messages, systemContext = '') {
  const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY;

  const systemPrompt = `You are TennisVantage AI — a professional tennis analyst with deep expertise in both the ATP (men's) and WTA (women's) tours.

YOUR EXPERTISE COVERS:
- ATP Men's Tennis: all players, rankings, tournaments, Grand Slams, Masters 1000s, stats, tactics, history
- WTA Women's Tennis: all players, rankings, tournaments, Grand Slams, WTA 1000s, stats, tactics, history
- Tennis strategy, surface analysis (clay/hard/grass), serve statistics, head-to-head records
- Tournament draws, match predictions, player form analysis

RULES:
1. You ONLY discuss professional tennis — ATP and WTA. If asked about other sports, politics, coding, or anything completely unrelated to tennis, politely decline and redirect to tennis.
2. Be insightful, precise, and speak with the authority of a professional tennis analyst.
3. Reference real players, real tournaments, real statistics.
4. Keep responses focused and clear — 2–4 paragraphs maximum.
5. When discussing rankings or players, mention whether you are referring to ATP or WTA to avoid confusion.

${systemContext ? `MATCH CONTEXT: ${systemContext}` : ''}`;

  // No key → smart mock response
  if (!ANTHROPIC_KEY || ANTHROPIC_KEY === 'your_key_here') {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
    const last = messages[messages.length - 1]?.content?.toLowerCase() ?? '';
    return { content: [{ text: generateMockAIResponse(last) }] };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!response.ok) throw new Error('AI_ERROR');
  return response.json();
}

function generateMockAIResponse(query) {
  if (query.includes('swiatek') || query.includes('świątek'))
    return "Iga Świątek has been the dominant force on the WTA tour. Her forehand-heavy game and relentless baseline consistency make her almost unplayable on clay — she's won Roland Garros multiple times. Her mental resilience and ability to raise her level in big moments set her apart from the field.";
  if (query.includes('sabalenka'))
    return "Aryna Sabalenka is arguably the most powerful player on the WTA tour right now. Her aggressive serving — among the fastest on tour — combined with her improved consistency has earned her multiple Grand Slam titles. On hard courts especially, she is the player everyone has to beat.";
  if (query.includes('gauff') || query.includes('coco'))
    return "Coco Gauff's US Open title announced her arrival as a genuine Grand Slam contender. At her age, her all-court game and mental composure are exceptional. Her serve has improved significantly, and her return game is among the best on the WTA tour.";
  if (query.includes('wta') || query.includes('women'))
    return "The WTA tour is in a fascinating period right now. Świątek has dominated clay and hard courts, while Sabalenka brings the power game. The next generation — Gauff, Andreeva, Paolini — are closing the gap rapidly. Grand Slam results have been more unpredictable than in years past, which makes for compelling tennis.";
  if (query.includes('djokovic'))
    return "Novak Djokovic remains one of the most dominant forces in ATP history. With 24 Grand Slam titles, his mental resilience and return game are unmatched. His performance on hard courts — particularly at the Australian Open and US Open — sets the benchmark for the modern era.";
  if (query.includes('alcaraz'))
    return "Carlos Alcaraz has established himself as the defining talent of the next generation. His ability to dictate play from the baseline combined with exceptional net skills make him a threat on all surfaces. His rivalry with Djokovic is one of the most compelling storylines in the ATP today.";
  if (query.includes('sinner'))
    return "Jannik Sinner's rise to world #1 on the ATP tour has been built on an exceptional baseline game and one of the cleanest ball-striking techniques in modern tennis. His hard-court record is outstanding, and his mental strength in deciding sets has improved dramatically over the past two years.";
  if (query.includes('clay'))
    return "Clay court tennis rewards heavy topspin, physicality, and patience. On the ATP side, Alcaraz and Ruud are the standout specialists. On the WTA, Świątek is in a class of her own on clay — her movement and topspin forehand are almost perfectly suited to the surface. Roland Garros remains the ultimate clay test for both tours.";
  if (query.includes('wimbledon') || query.includes('grass'))
    return "Grass court tennis is the most unique surface in the game — fast, low-bouncing, and reward big serves and net approaches. Djokovic and Alcaraz have dominated recent Wimbledons on the ATP side. On the WTA, Rybakina's powerful serve-and-forehand game translates extremely well to grass. The two weeks at SW19 always produce surprises.";
  if (query.includes('serve') || query.includes('first serve'))
    return "First serve percentage is one of the most critical stats in tennis. Elite ATP players target 60–68%, while top WTA players typically range from 58–67%. Players like Sabalenka and Isner/Opelka rely heavily on their serve as a weapon, while players like Djokovic and Świątek build points through precision and consistency rather than raw power.";
  if (query.includes('prediction') || query.includes('who will win'))
    return "For a detailed prediction, I factor in surface win rates, head-to-head records, recent form, serve percentages, and fatigue levels. Select a specific match from the Predictions tab for a full AI-powered breakdown with confidence ratings. Who are you most curious about — ATP or WTA?";
  return "Great tennis question! I cover both the ATP and WTA tours in depth — from match predictions and player form to surface analysis and tournament history. What would you like to explore? You can ask me about specific players, upcoming matches, rankings, or any tactical question.";
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const ATP_PLAYERS = [
  { id:1,  name:'Jannik Sinner',      country:'ITA', flag:'🇮🇹', rank:1,  wins:232,losses:72,  ace_avg:5.8, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W W L', grand_slams:3,  height:'188 cm', hand:'Right', turned_pro:2018, born:'Aug 16, 2001', tour:'ATP' },
  { id:2,  name:'Alexander Zverev',   country:'GER', flag:'🇩🇪', rank:2,  wins:388,losses:193, ace_avg:8.1, surface_pref:'Clay', first_serve_pct:62, recent_form:'W L W W W', grand_slams:0,  height:'198 cm', hand:'Right', turned_pro:2013, born:'Apr 20, 1997', tour:'ATP' },
  { id:3,  name:'Carlos Alcaraz',     country:'ESP', flag:'🇪🇸', rank:3,  wins:236,losses:71,  ace_avg:7.1, surface_pref:'Clay', first_serve_pct:66, recent_form:'W W L W W', grand_slams:4,  height:'185 cm', hand:'Right', turned_pro:2018, born:'May 5, 2003',  tour:'ATP' },
  { id:4,  name:'Novak Djokovic',     country:'SRB', flag:'🇷🇸', rank:4,  wins:1104,losses:215,ace_avg:6.2, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W L W W', grand_slams:24, height:'188 cm', hand:'Right', turned_pro:2003, born:'May 22, 1987', tour:'ATP' },
  { id:5,  name:'Daniil Medvedev',    country:'RUS', flag:'🇷🇺', rank:5,  wins:390,losses:196, ace_avg:8.3, surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W', grand_slams:1,  height:'198 cm', hand:'Right', turned_pro:2014, born:'Feb 11, 1996', tour:'ATP' },
  { id:6,  name:'Taylor Fritz',       country:'USA', flag:'🇺🇸', rank:6,  wins:302,losses:186, ace_avg:9.1, surface_pref:'Hard', first_serve_pct:64, recent_form:'W W W L W', grand_slams:0,  height:'193 cm', hand:'Right', turned_pro:2015, born:'Oct 28, 1997', tour:'ATP' },
  { id:7,  name:'Casper Ruud',        country:'NOR', flag:'🇳🇴', rank:7,  wins:267,losses:143, ace_avg:5.5, surface_pref:'Clay', first_serve_pct:57, recent_form:'L W W W W', grand_slams:0,  height:'183 cm', hand:'Right', turned_pro:2015, born:'Dec 22, 1998', tour:'ATP' },
  { id:8,  name:'Andrey Rublev',      country:'RUS', flag:'🇷🇺', rank:8,  wins:350,losses:191, ace_avg:5.1, surface_pref:'Clay', first_serve_pct:58, recent_form:'W L W L W', grand_slams:0,  height:'188 cm', hand:'Right', turned_pro:2014, born:'Oct 20, 1997', tour:'ATP' },
  { id:9,  name:'Holger Rune',        country:'DEN', flag:'🇩🇰', rank:9,  wins:162,losses:91,  ace_avg:6.7, surface_pref:'Clay', first_serve_pct:60, recent_form:'W W L W L', grand_slams:0,  height:'188 cm', hand:'Right', turned_pro:2019, born:'Apr 29, 2003', tour:'ATP' },
  { id:10, name:'Stefanos Tsitsipas', country:'GRE', flag:'🇬🇷', rank:10, wins:345,losses:171, ace_avg:7.9, surface_pref:'Clay', first_serve_pct:62, recent_form:'W L W W L', grand_slams:0,  height:'193 cm', hand:'Right', turned_pro:2016, born:'Aug 12, 1998', tour:'ATP' },
  { id:11, name:'Alex de Minaur',     country:'AUS', flag:'🇦🇺', rank:11, wins:278,losses:178, ace_avg:4.8, surface_pref:'Hard', first_serve_pct:60, recent_form:'L W W W L', grand_slams:0,  height:'183 cm', hand:'Right', turned_pro:2015, born:'Feb 17, 1999', tour:'ATP' },
  { id:12, name:'Grigor Dimitrov',    country:'BUL', flag:'🇧🇬', rank:12, wins:439,losses:271, ace_avg:6.8, surface_pref:'Hard', first_serve_pct:61, recent_form:'W W L W W', grand_slams:0,  height:'191 cm', hand:'Right', turned_pro:2008, born:'May 16, 1991', tour:'ATP' },
  { id:13, name:'Tommy Paul',         country:'USA', flag:'🇺🇸', rank:13, wins:244,losses:178, ace_avg:6.2, surface_pref:'Hard', first_serve_pct:62, recent_form:'W L W W W', grand_slams:0,  height:'185 cm', hand:'Right', turned_pro:2016, born:'May 17, 1997', tour:'ATP' },
  { id:14, name:'Ben Shelton',        country:'USA', flag:'🇺🇸', rank:14, wins:149,losses:102, ace_avg:11.2,surface_pref:'Hard', first_serve_pct:65, recent_form:'L W W L W', grand_slams:0,  height:'193 cm', hand:'Left',  turned_pro:2022, born:'Oct 9, 2002',  tour:'ATP' },
  { id:15, name:'Hubert Hurkacz',     country:'POL', flag:'🇵🇱', rank:15, wins:288,losses:162, ace_avg:10.5,surface_pref:'Hard', first_serve_pct:66, recent_form:'W W W L W', grand_slams:0,  height:'196 cm', hand:'Right', turned_pro:2016, born:'Feb 11, 1997', tour:'ATP' },
  { id:16, name:'Ugo Humbert',        country:'FRA', flag:'🇫🇷', rank:16, wins:271,losses:191, ace_avg:7.3, surface_pref:'Hard', first_serve_pct:61, recent_form:'L W W W L', grand_slams:0,  height:'188 cm', hand:'Left',  turned_pro:2017, born:'Jun 26, 1998', tour:'ATP' },
  { id:17, name:'Sebastian Korda',    country:'USA', flag:'🇺🇸', rank:17, wins:198,losses:151, ace_avg:7.8, surface_pref:'Hard', first_serve_pct:61, recent_form:'W W L W W', grand_slams:0,  height:'193 cm', hand:'Right', turned_pro:2020, born:'Jul 5, 2000',  tour:'ATP' },
  { id:18, name:'Francisco Cerundolo',country:'ARG', flag:'🇦🇷', rank:18, wins:178,losses:132, ace_avg:5.9, surface_pref:'Clay', first_serve_pct:59, recent_form:'W L W W L', grand_slams:0,  height:'183 cm', hand:'Right', turned_pro:2019, born:'Aug 6, 1998',  tour:'ATP' },
  { id:19, name:'Karen Khachanov',    country:'RUS', flag:'🇷🇺', rank:19, wins:318,losses:208, ace_avg:7.1, surface_pref:'Hard', first_serve_pct:60, recent_form:'L W L W W', grand_slams:0,  height:'198 cm', hand:'Right', turned_pro:2013, born:'May 21, 1996', tour:'ATP' },
  { id:20, name:'Félix Auger-Aliassime',country:'CAN',flag:'🇨🇦',rank:20, wins:242,losses:168, ace_avg:8.8, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W W L L', grand_slams:0,  height:'193 cm', hand:'Right', turned_pro:2017, born:'Aug 8, 2000',  tour:'ATP' },
];

const WTA_PLAYERS = [
  { id:101, name:'Aryna Sabalenka',    country:'BLR', flag:'🇧🇾', rank:1,  wins:352,losses:141, ace_avg:5.2, surface_pref:'Hard', first_serve_pct:64, recent_form:'W W W W L', grand_slams:3,  height:'182 cm', hand:'Right', turned_pro:2015, born:'May 5, 1998',   tour:'WTA' },
  { id:102, name:'Iga Świątek',        country:'POL', flag:'🇵🇱', rank:2,  wins:424,losses:112, ace_avg:3.1, surface_pref:'Clay', first_serve_pct:67, recent_form:'W L W W W', grand_slams:5,  height:'175 cm', hand:'Right', turned_pro:2016, born:'May 31, 2001',  tour:'WTA' },
  { id:103, name:'Coco Gauff',         country:'USA', flag:'🇺🇸', rank:3,  wins:246,losses:111, ace_avg:4.7, surface_pref:'Hard', first_serve_pct:62, recent_form:'W W L W W', grand_slams:1,  height:'183 cm', hand:'Right', turned_pro:2019, born:'Mar 13, 2004',  tour:'WTA' },
  { id:104, name:'Elena Rybakina',     country:'KAZ', flag:'🇰🇿', rank:4,  wins:261,losses:122, ace_avg:6.8, surface_pref:'Grass',first_serve_pct:61, recent_form:'L W W W L', grand_slams:1,  height:'184 cm', hand:'Right', turned_pro:2014, born:'Jun 17, 1999',  tour:'WTA' },
  { id:105, name:'Jessica Pegula',     country:'USA', flag:'🇺🇸', rank:5,  wins:211,losses:129, ace_avg:3.9, surface_pref:'Hard', first_serve_pct:60, recent_form:'W W W L W', grand_slams:0,  height:'170 cm', hand:'Right', turned_pro:2010, born:'Feb 24, 1994',  tour:'WTA' },
  { id:106, name:'Jasmine Paolini',    country:'ITA', flag:'🇮🇹', rank:6,  wins:201,losses:122, ace_avg:2.8, surface_pref:'Clay', first_serve_pct:58, recent_form:'W L W W W', grand_slams:0,  height:'163 cm', hand:'Right', turned_pro:2013, born:'Jan 4, 1996',   tour:'WTA' },
  { id:107, name:'Mirra Andreeva',     country:'RUS', flag:'🇷🇺', rank:7,  wins:124,losses:86,  ace_avg:3.4, surface_pref:'Hard', first_serve_pct:59, recent_form:'L W W W W', grand_slams:0,  height:'175 cm', hand:'Right', turned_pro:2022, born:'Apr 29, 2007',  tour:'WTA' },
  { id:108, name:'Danielle Collins',   country:'USA', flag:'🇺🇸', rank:8,  wins:297,losses:179, ace_avg:5.1, surface_pref:'Hard', first_serve_pct:63, recent_form:'W W L W W', grand_slams:0,  height:'175 cm', hand:'Right', turned_pro:2016, born:'Dec 13, 1993',  tour:'WTA' },
  { id:109, name:'Daria Kasatkina',    country:'RUS', flag:'🇷🇺', rank:9,  wins:312,losses:221, ace_avg:3.2, surface_pref:'Clay', first_serve_pct:58, recent_form:'W W W L W', grand_slams:0,  height:'170 cm', hand:'Right', turned_pro:2014, born:'May 7, 1997',   tour:'WTA' },
  { id:110, name:'Beatriz Haddad Maia',country:'BRA', flag:'🇧🇷', rank:10, wins:278,losses:196, ace_avg:4.9, surface_pref:'Clay', first_serve_pct:60, recent_form:'L W W W W', grand_slams:0,  height:'175 cm', hand:'Left',  turned_pro:2012, born:'May 30, 1996',  tour:'WTA' },
  { id:111, name:'Caroline Wozniacki', country:'DEN', flag:'🇩🇰', rank:11, wins:620,losses:273, ace_avg:2.8, surface_pref:'Hard', first_serve_pct:61, recent_form:'W L W W L', grand_slams:1,  height:'176 cm', hand:'Right', turned_pro:2005, born:'Jul 11, 1990',  tour:'WTA' },
  { id:112, name:'Maria Sakkari',      country:'GRE', flag:'🇬🇷', rank:12, wins:321,losses:248, ace_avg:3.7, surface_pref:'Hard', first_serve_pct:59, recent_form:'L W L W W', grand_slams:0,  height:'180 cm', hand:'Right', turned_pro:2013, born:'Jul 26, 1995',  tour:'WTA' },
  { id:113, name:'Barbora Krejčíková', country:'CZE', flag:'🇨🇿', rank:13, wins:296,losses:186, ace_avg:3.1, surface_pref:'Clay', first_serve_pct:57, recent_form:'W W L W W', grand_slams:2,  height:'178 cm', hand:'Right', turned_pro:2013, born:'Dec 18, 1995',  tour:'WTA' },
  { id:114, name:'Liudmila Samsonova', country:'RUS', flag:'🇷🇺', rank:14, wins:241,losses:171, ace_avg:4.8, surface_pref:'Hard', first_serve_pct:62, recent_form:'W W W W L', grand_slams:0,  height:'182 cm', hand:'Right', turned_pro:2016, born:'Jul 1, 2000',   tour:'WTA' },
  { id:115, name:'Anna Kalinskaya',    country:'RUS', flag:'🇷🇺', rank:15, wins:198,losses:158, ace_avg:4.2, surface_pref:'Hard', first_serve_pct:60, recent_form:'L W W L W', grand_slams:0,  height:'181 cm', hand:'Right', turned_pro:2016, born:'Sep 25, 1998',  tour:'WTA' },
  { id:116, name:'Emma Navarro',       country:'USA', flag:'🇺🇸', rank:16, wins:167,losses:119, ace_avg:3.8, surface_pref:'Hard', first_serve_pct:61, recent_form:'W W L W W', grand_slams:0,  height:'173 cm', hand:'Right', turned_pro:2022, born:'Feb 8, 2001',   tour:'WTA' },
  { id:117, name:'Elina Svitolina',    country:'UKR', flag:'🇺🇦', rank:17, wins:462,losses:268, ace_avg:3.5, surface_pref:'Hard', first_serve_pct:59, recent_form:'W L W W L', grand_slams:0,  height:'176 cm', hand:'Right', turned_pro:2010, born:'Sep 12, 1994',  tour:'WTA' },
  { id:118, name:'Veronika Kudermetova',country:'RUS',flag:'🇷🇺', rank:18, wins:278,losses:201, ace_avg:3.9, surface_pref:'Hard', first_serve_pct:60, recent_form:'L W W W W', grand_slams:0,  height:'172 cm', hand:'Right', turned_pro:2014, born:'Apr 24, 1997',  tour:'WTA' },
  { id:119, name:'Ekaterina Alexandrova',country:'RUS',flag:'🇷🇺',rank:19, wins:259,losses:198, ace_avg:4.1, surface_pref:'Hard', first_serve_pct:62, recent_form:'W W L L W', grand_slams:0,  height:'182 cm', hand:'Right', turned_pro:2014, born:'Nov 15, 1994',  tour:'WTA' },
  { id:120, name:'Magdalena Frech',    country:'POL', flag:'🇵🇱', rank:20, wins:184,losses:152, ace_avg:3.6, surface_pref:'Clay', first_serve_pct:58, recent_form:'W L W W W', grand_slams:0,  height:'168 cm', hand:'Right', turned_pro:2016, born:'Jul 12, 1998',  tour:'WTA' },
];

// ── Last 5 matches with serve stats (detailed for top players) ────────────────
const LAST5 = {
  1: [ // Sinner
    { tournament:'Australian Open', surface:'Hard', opponent:'Zverev',     result:'W', score:'6-3, 7-6, 6-3',  first_serve:64, second_serve:57, aces:6,  double_faults:1 },
    { tournament:'Miami Open',      surface:'Hard', opponent:'Alcaraz',    result:'L', score:'4-6, 6-7',         first_serve:58, second_serve:52, aces:3,  double_faults:3 },
    { tournament:'Monte-Carlo',     surface:'Clay', opponent:'Rune',       result:'W', score:'6-4, 6-2',         first_serve:63, second_serve:55, aces:4,  double_faults:2 },
    { tournament:'Indian Wells',    surface:'Hard', opponent:'Medvedev',   result:'W', score:'6-3, 6-4',         first_serve:67, second_serve:60, aces:7,  double_faults:0 },
    { tournament:'Vienna',          surface:'Hard', opponent:'Rublev',     result:'W', score:'6-2, 7-6',         first_serve:69, second_serve:61, aces:5,  double_faults:1 },
  ],
  3: [ // Alcaraz
    { tournament:'Roland Garros',   surface:'Clay', opponent:'Sinner',     result:'W', score:'6-3, 6-2',         first_serve:68, second_serve:60, aces:7,  double_faults:2 },
    { tournament:'Wimbledon',       surface:'Grass',opponent:'Djokovic',   result:'W', score:'6-4, 6-4',         first_serve:72, second_serve:62, aces:9,  double_faults:1 },
    { tournament:'US Open',         surface:'Hard', opponent:'Fritz',      result:'L', score:'6-7, 4-6',         first_serve:61, second_serve:53, aces:4,  double_faults:4 },
    { tournament:'Miami Open',      surface:'Hard', opponent:'Medvedev',   result:'W', score:'7-5, 6-3',         first_serve:70, second_serve:63, aces:11, double_faults:0 },
    { tournament:'Monte-Carlo',     surface:'Clay', opponent:'Ruud',       result:'W', score:'6-2, 6-3',         first_serve:66, second_serve:58, aces:6,  double_faults:2 },
  ],
  4: [ // Djokovic
    { tournament:'Australian Open', surface:'Hard', opponent:'Sinner',     result:'L', score:'6-3, 6-4',         first_serve:62, second_serve:54, aces:5,  double_faults:2 },
    { tournament:'Monte-Carlo',     surface:'Clay', opponent:'Rublev',     result:'W', score:'7-5, 6-3',         first_serve:67, second_serve:58, aces:3,  double_faults:1 },
    { tournament:'Indian Wells',    surface:'Hard', opponent:'Medvedev',   result:'W', score:'6-4, 6-2',         first_serve:71, second_serve:61, aces:8,  double_faults:0 },
    { tournament:'Miami Open',      surface:'Hard', opponent:'Alcaraz',    result:'W', score:'3-6, 6-3, 7-6',   first_serve:59, second_serve:55, aces:4,  double_faults:3 },
    { tournament:'Roland Garros',   surface:'Clay', opponent:'Tsitsipas',  result:'W', score:'6-3, 7-5',         first_serve:64, second_serve:56, aces:6,  double_faults:1 },
  ],
  101: [ // Sabalenka
    { tournament:'Australian Open', surface:'Hard', opponent:'Gauff',      result:'W', score:'6-3, 7-5',         first_serve:66, second_serve:58, aces:8,  double_faults:2 },
    { tournament:'Miami Open',      surface:'Hard', opponent:'Rybakina',   result:'W', score:'6-4, 7-6',         first_serve:64, second_serve:57, aces:6,  double_faults:1 },
    { tournament:'Roland Garros',   surface:'Clay', opponent:'Świątek',    result:'L', score:'3-6, 4-6',         first_serve:59, second_serve:52, aces:3,  double_faults:4 },
    { tournament:'US Open',         surface:'Hard', opponent:'Pegula',     result:'W', score:'6-3, 6-2',         first_serve:68, second_serve:60, aces:9,  double_faults:1 },
    { tournament:'Cincinnati',      surface:'Hard', opponent:'Collins',    result:'W', score:'6-4, 6-3',         first_serve:65, second_serve:59, aces:7,  double_faults:2 },
  ],
  102: [ // Świątek
    { tournament:'Roland Garros',   surface:'Clay', opponent:'Paolini',    result:'W', score:'6-2, 6-1',         first_serve:70, second_serve:62, aces:2,  double_faults:1 },
    { tournament:'Australian Open', surface:'Hard', opponent:'Sabalenka',  result:'L', score:'5-7, 4-6',         first_serve:61, second_serve:55, aces:1,  double_faults:3 },
    { tournament:'Miami Open',      surface:'Hard', opponent:'Gauff',      result:'W', score:'6-3, 6-4',         first_serve:67, second_serve:60, aces:3,  double_faults:2 },
    { tournament:'Doha',            surface:'Hard', opponent:'Krejčíková', result:'W', score:'6-1, 6-0',         first_serve:72, second_serve:65, aces:2,  double_faults:0 },
    { tournament:'Indian Wells',    surface:'Hard', opponent:'Pegula',     result:'W', score:'6-3, 6-2',         first_serve:68, second_serve:61, aces:3,  double_faults:1 },
  ],
  103: [ // Gauff
    { tournament:'US Open',         surface:'Hard', opponent:'Sabalenka',  result:'W', score:'6-3, 7-5',         first_serve:63, second_serve:57, aces:5,  double_faults:2 },
    { tournament:'Australian Open', surface:'Hard', opponent:'Svitolina',  result:'W', score:'6-4, 6-2',         first_serve:62, second_serve:56, aces:4,  double_faults:1 },
    { tournament:'Roland Garros',   surface:'Clay', opponent:'Świątek',    result:'L', score:'2-6, 3-6',         first_serve:58, second_serve:51, aces:2,  double_faults:4 },
    { tournament:'Miami Open',      surface:'Hard', opponent:'Collins',    result:'W', score:'6-4, 7-5',         first_serve:64, second_serve:58, aces:6,  double_faults:1 },
    { tournament:'Cincinnati',      surface:'Hard', opponent:'Rybakina',   result:'L', score:'4-6, 6-7',         first_serve:60, second_serve:54, aces:3,  double_faults:3 },
  ],
};

// Auto-generate last5 for players without specific data
function genLast5(player) {
  const isWTA = player.tour === 'WTA';
  const atpTournaments = ['Monte-Carlo','Indian Wells','Miami Open','Roland Garros','Wimbledon'];
  const wtaTournaments = ['Doha','Indian Wells','Miami Open','Roland Garros','Wimbledon'];
  const surfaces = ['Clay','Hard','Hard','Clay','Grass'];
  const atpOpponents = ['Djokovic','Alcaraz','Medvedev','Sinner','Rublev'];
  const wtaOpponents = ['Sabalenka','Świątek','Gauff','Rybakina','Pegula'];
  const tournaments = isWTA ? wtaTournaments : atpTournaments;
  const opponents   = isWTA ? wtaOpponents   : atpOpponents;
  const form = (player.recent_form ?? 'W W L W W').split(' ');
  return tournaments.map((t, i) => ({
    tournament:    t,
    surface:       surfaces[i],
    opponent:      opponents[i],
    result:        form[i] ?? 'W',
    score:         form[i] === 'W' ? '6-4, 6-3' : '4-6, 3-6',
    first_serve:   player.first_serve_pct + Math.floor(Math.random() * 8 - 4),
    second_serve:  Math.round(player.first_serve_pct * 0.87),
    aces:          Math.floor(player.ace_avg + Math.random() * 4 - 2),
    double_faults: Math.floor(Math.random() * 4),
  }));
}

// Build all player profiles
const playerProfiles = {};
[...ATP_PLAYERS, ...WTA_PLAYERS].forEach(p => {
  playerProfiles[p.id] = {
    ...p,
    bio: `${p.name} is a professional ${p.tour} tennis player from ${p.country}. Known for ${p.surface_pref.toLowerCase()} court dominance and a career spanning from ${p.turned_pro}, they have accumulated ${p.wins} career wins and ${p.grand_slams} Grand Slam title${p.grand_slams !== 1 ? 's' : ''}. Standing ${p.height} tall, ${p.name.split(' ')[0]} plays with their ${p.hand.toLowerCase()} hand and is considered one of the top players of their generation.`,
    career_wins:   p.wins,
    career_losses: p.losses,
    last5: LAST5[p.id] ?? genLast5(p),
  };
});

// Match calendar spread
function getMatchesForDate(dateStr) {
  const today    = new Date();
  const target   = new Date(dateStr);
  const diffDays = Math.round((target - today) / 86400000);
  const allData  = [
    { id:'m1', status:'upcoming', tournament:'Roland Garros',  round:'QF', surface:'Clay',  date:dateStr, player1:ATP_PLAYERS[0], player2:ATP_PLAYERS[2] },
    { id:'m2', status:'upcoming', tournament:'Wimbledon',      round:'SF', surface:'Grass', date:dateStr, player1:ATP_PLAYERS[2], player2:ATP_PLAYERS[4] },
    { id:'m3', status:'upcoming', tournament:'US Open',        round:'F',  surface:'Hard',  date:dateStr, player1:ATP_PLAYERS[1], player2:ATP_PLAYERS[3] },
    { id:'m4', status:'upcoming', tournament:'Australian Open',round:'SF', surface:'Hard',  date:dateStr, player1:ATP_PLAYERS[4], player2:ATP_PLAYERS[5] },
    { id:'m5', status:'upcoming', tournament:'Monte-Carlo',    round:'R32',surface:'Clay',  date:dateStr, player1:ATP_PLAYERS[6], player2:ATP_PLAYERS[7] },
  ];
  if (diffDays < 0)  { const n = Math.abs(diffDays) % 3; return allData.slice(0, n + 1).map(m => ({ ...m, status:'finished' })); }
  if (diffDays === 0) { return [{ ...allData[0], status:'live' }, allData[1]]; }
  const spread = [2, 0, 1, 3, 0, 2, 1];
  return allData.slice(0, spread[Math.min(diffDays - 1, 6)] ?? 0);
}

export const MOCK_DATA = {
  matches: [
    { id:'m1', status:'live',     tournament:'Roland Garros',  round:'QF', surface:'Clay',  score:'6-4, 3-2*', date:'Live',           player1:ATP_PLAYERS[0], player2:ATP_PLAYERS[2] },
    { id:'m2', status:'upcoming', tournament:'Wimbledon',      round:'SF', surface:'Grass', score:null,         date:'Today 15:00',    player1:ATP_PLAYERS[2], player2:ATP_PLAYERS[4] },
    { id:'m3', status:'upcoming', tournament:'US Open',        round:'F',  surface:'Hard',  score:null,         date:'Tomorrow 20:00', player1:ATP_PLAYERS[1], player2:ATP_PLAYERS[3] },
    { id:'m4', status:'upcoming', tournament:'Australian Open',round:'SF', surface:'Hard',  score:null,         date:'Fri 09:00',      player1:ATP_PLAYERS[4], player2:ATP_PLAYERS[5] },
    { id:'m5', status:'upcoming', tournament:'Monte-Carlo',    round:'R32',surface:'Clay',  score:null,         date:'Sat 14:00',      player1:ATP_PLAYERS[6], player2:ATP_PLAYERS[7] },
  ],
  rankings: {
    ATP: ATP_PLAYERS.map((p, i) => ({ ...p, points: Math.round(12000 / (i + 1)), prev_rank: i + 1 })),
    WTA: WTA_PLAYERS.map((p, i) => ({ ...p, points: Math.round(11000 / (i + 1)), prev_rank: i + 1 })),
  },
  playerProfiles,
  getMatchesForDate,
  players: [...ATP_PLAYERS, ...WTA_PLAYERS],
  h2h: {
    total:9, p1_wins:7, p2_wins:2,
    last5:['W','W','L','W','W'],
    meetings:[
      { year:2024, tournament:'Wimbledon',       surface:'Grass', winner:'p1', score:'7-6, 6-4' },
      { year:2024, tournament:'Roland Garros',   surface:'Clay',  winner:'p1', score:'6-3, 7-5' },
      { year:2023, tournament:'US Open',         surface:'Hard',  winner:'p2', score:'6-4, 6-3' },
      { year:2023, tournament:'Australian Open', surface:'Hard',  winner:'p1', score:'6-2, 7-6' },
      { year:2022, tournament:'Roland Garros',   surface:'Clay',  winner:'p1', score:'7-5, 6-3' },
    ],
  },
};