// src/components/PlayerBioModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES IN THIS VERSION:
//  [AI-STATS]  When modal opens, calls /api/chat to generate rich player stats:
//              surface breakdown, grand slam record, playing style, current form,
//              career highlights, rivalry info. Displayed in dedicated AI section.
//  [WIKI]      Wikipedia bio + photo preserved as before.
//  [DB-STATS]  DB fields (rank, wins, losses, serve%, ace avg) shown if present.
//  [SKELETON]  Each section has its own skeleton so content appears progressively.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';

const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };

// ── Wikipedia fetch ───────────────────────────────────────────────────────────
async function fetchWikiBio(playerName) {
  const encoded = encodeURIComponent(playerName.trim().replace(/\s+/g, '_'));
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data = await res.json();
  if (data.type === 'disambiguation') throw new Error('Disambiguation page');
  return {
    extract:     data.extract ?? null,
    description: data.description ?? null,
    thumbnail:   data.thumbnail?.source ?? null,
    wikiUrl:     data.content_urls?.desktop?.page ?? null,
    birthDate:   extractBirthDate(data.extract ?? ''),
  };
}

function extractBirthDate(text) {
  const m = text.match(
    /born\s+([A-Z][a-z]+ \d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i
  );
  return m ? m[1].replace(',', '') : null;
}

// ── AI stats fetch via /api/chat ──────────────────────────────────────────────
// Asks Gemini to return structured JSON with rich player intelligence.
async function fetchAiPlayerStats(player) {
  const prompt = `You are a professional tennis analyst. Generate comprehensive stats and analysis for this tennis player. Respond ONLY with valid JSON, no markdown, no extra text.

Player: ${player.name}
Country: ${player.country ?? 'Unknown'}
Current Rank: ${player.rank && player.rank < 999 ? `#${player.rank}` : 'Unknown'}
Known surface preference: ${player.surface_pref ?? 'Unknown'}

Return this exact JSON structure (fill ALL fields with real data you know, use null only if truly unknown):
{
  "full_name": "string",
  "turned_pro": "year as string, e.g. '2015'",
  "plays": "Right-handed or Left-handed",
  "height": "e.g. '185 cm'",
  "coach": "current coach name or null",
  "playing_style": "2-3 sentence description of playing style and strengths",
  "surface_stats": {
    "hard": { "win_pct": number_0_to_100, "titles": number },
    "clay": { "win_pct": number_0_to_100, "titles": number },
    "grass": { "win_pct": number_0_to_100, "titles": number }
  },
  "grand_slams": {
    "australian_open": "best result e.g. 'Winner (2024)' or 'QF' or 'R32'",
    "french_open": "best result",
    "wimbledon": "best result",
    "us_open": "best result",
    "total_titles": number
  },
  "career_titles": number,
  "career_win_pct": number_0_to_100,
  "peak_rank": number,
  "peak_rank_year": "year string",
  "current_season": {
    "wins": number,
    "losses": number,
    "titles": number,
    "form": "W W L W W format, last 5 matches"
  },
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string"],
  "career_highlights": ["string", "string", "string"],
  "rival": "name of biggest rival",
  "rival_h2h": "e.g. '14-12 in favor of X'"
}`;

  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messages:      [{ role: 'user', content: prompt }],
      systemContext: 'You are a tennis statistics database. Always respond with valid JSON only. No markdown fences. No explanations. Just the JSON object.',
    }),
  });

  if (!res.ok) throw new Error(`AI fetch failed: ${res.status}`);
  const data = await res.json();
  const raw  = data?.content?.[0]?.text ?? data?.reply ?? '';
  const clean = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PlayerBioModal({ player: p, onClose, onChat }) {
  const [wiki,       setWiki]       = useState(null);
  const [wikiLoading,setWikiLoading]= useState(true);
  const [imgError,   setImgError]   = useState(false);

  const [aiStats,       setAiStats]       = useState(null);
  const [aiLoading,     setAiLoading]     = useState(true);
  const [aiError,       setAiError]       = useState(null);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ESC to close
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Fetch Wikipedia bio
  useEffect(() => {
    if (!p?.name) return;
    let cancelled = false;
    setWikiLoading(true);
    setWiki(null);
    setImgError(false);
    fetchWikiBio(p.name)
      .then(d  => { if (!cancelled) setWiki(d); })
      .catch(() => { if (!cancelled) setWiki(null); })
      .finally(()=> { if (!cancelled) setWikiLoading(false); });
    return () => { cancelled = true; };
  }, [p?.name]);

  // Fetch AI stats
  useEffect(() => {
    if (!p?.name) return;
    let cancelled = false;
    setAiLoading(true);
    setAiError(null);
    setAiStats(null);
    fetchAiPlayerStats(p)
      .then(d  => { if (!cancelled) { setAiStats(d); setAiError(null); } })
      .catch(e => { if (!cancelled) setAiError(e.message); })
      .finally(()=> { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, [p?.name]);

  if (!p) return null;

  // Use AI data where DB data is absent/stale
  const displayRank    = (p.rank && p.rank < 999) ? p.rank : aiStats?.peak_rank ?? null;
  const displayWins    = p.wins  || aiStats?.current_season?.wins;
  const displayLosses  = p.losses || aiStats?.current_season?.losses;
  const winRate        = displayWins && displayLosses
    ? Math.round((displayWins / (displayWins + displayLosses)) * 100)
    : aiStats?.career_win_pct ?? null;
  const surfaceColor   = surfaceColors[p.surface_pref ?? aiStats?.surface_stats ? 'Hard' : 'Hard'] ?? '#94a3b8';
  const formStr        = aiStats?.current_season?.form ?? p.recent_form ?? '';
  const formLetters    = formStr.trim().split(/[\s,]+/).filter(l => l === 'W' || l === 'L');

  const bioText = wiki?.extract
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 4).join(' ')
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(7,11,20,0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'tv-fade-in 0.15s ease',
        }}
      />

      {/* Modal */}
      <div
        className="tv-bio-modal"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 201,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          border: '1px solid var(--border-md)',
          borderBottom: 'none',
          maxHeight: '92dvh',
          overflowY: 'auto',
          animation: 'tv-slide-up 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 -24px 80px rgba(0,0,0,0.6)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-md)' }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 16, zIndex: 10,
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
            color: 'var(--text-faint)', fontSize: 18, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'var(--t)',
          }}
          aria-label="Close"
        >
          ×
        </button>

        <div style={{ padding: '4px 20px 0', maxWidth: 800, margin: '0 auto', width: '100%' }}>

          {/* ── HERO HEADER ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
            {/* Photo */}
            <div style={{
              width: 90, height: 110, borderRadius: 12, flexShrink: 0,
              background: 'var(--bg-glass-md)', overflow: 'hidden',
              border: '2px solid var(--border-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {wikiLoading ? (
                <div className="tv-skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
              ) : wiki?.thumbnail && !imgError ? (
                <img
                  src={wiki.thumbnail}
                  alt={p.name}
                  onError={() => setImgError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                />
              ) : (
                <span style={{ fontSize: 40 }}>{p.flag ?? '🎾'}</span>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'clamp(18px,4vw,24px)', color: 'var(--text)',
                margin: '0 0 4px', lineHeight: 1.2, paddingRight: 40,
              }}>
                {p.name}
              </h2>

              {wikiLoading ? (
                <div className="tv-skeleton" style={{ height: 12, width: 160, borderRadius: 4, marginBottom: 8 }} />
              ) : wiki?.description ? (
                <p style={{ fontSize: 12, color: 'var(--lime)', marginBottom: 8, fontWeight: 500 }}>
                  {wiki.description}
                </p>
              ) : null}

              {/* Meta chips row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <Chip icon={p.flag ?? '🌍'} label={p.country ?? '—'} />
                {wiki?.birthDate && <Chip icon="🎂" label={wiki.birthDate} />}
                {aiLoading ? (
                  <div className="tv-skeleton" style={{ height: 24, width: 80, borderRadius: 12 }} />
                ) : aiStats?.plays ? (
                  <Chip icon="🎾" label={aiStats.plays} />
                ) : null}
                {aiLoading ? (
                  <div className="tv-skeleton" style={{ height: 24, width: 70, borderRadius: 12 }} />
                ) : aiStats?.height ? (
                  <Chip icon="📏" label={aiStats.height} />
                ) : null}
                {aiLoading ? null : aiStats?.coach ? (
                  <Chip icon="👨‍🏫" label={`Coach: ${aiStats.coach}`} />
                ) : null}
              </div>

              {/* Key stats row */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatBadge
                  label="Rank"
                  value={p.rank && p.rank < 999 ? `#${p.rank}` : (aiStats?.peak_rank ? `Peak #${aiStats.peak_rank}` : '—')}
                  color="var(--lime)"
                />
                {winRate !== null && (
                  <StatBadge label="Win Rate" value={`${winRate}%`} color="var(--green)" />
                )}
                {aiLoading ? (
                  <div className="tv-skeleton" style={{ width: 60, height: 52, borderRadius: 8 }} />
                ) : aiStats?.career_titles != null ? (
                  <StatBadge label="Titles" value={aiStats.career_titles} color="var(--yellow)" />
                ) : null}
                {aiLoading ? (
                  <div className="tv-skeleton" style={{ width: 60, height: 52, borderRadius: 8 }} />
                ) : aiStats?.grand_slams?.total_titles != null ? (
                  <StatBadge label="Slams" value={aiStats.grand_slams.total_titles} color="var(--clay)" />
                ) : null}
              </div>
            </div>
          </div>

          <Divider />

          {/* ── PLAYING STYLE (AI) ──────────────────────────────────────── */}
          <Section label="Playing Style">
            {aiLoading ? (
              <TextSkeleton lines={3} />
            ) : aiStats?.playing_style ? (
              <p style={{
                fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7,
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 16px', margin: 0,
              }}>
                {aiStats.playing_style}
              </p>
            ) : (
              <EmptySection text="Style analysis unavailable" />
            )}
          </Section>

          <Divider />

          {/* ── SURFACE BREAKDOWN (AI) ──────────────────────────────────── */}
          <Section label="Surface Breakdown">
            {aiLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[0,1,2].map(i => <div key={i} className="tv-skeleton" style={{ height: 88, borderRadius: 10 }} />)}
              </div>
            ) : aiStats?.surface_stats ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { key: 'hard',  label: 'Hard',  color: '#60a5fa', icon: '🏟️' },
                  { key: 'clay',  label: 'Clay',  color: '#f97316', icon: '🧱' },
                  { key: 'grass', label: 'Grass', color: '#4ade80', icon: '🌿' },
                ].map(({ key, label, color, icon }) => {
                  const s = aiStats.surface_stats[key];
                  return (
                    <div key={key} style={{
                      padding: '12px 14px', borderRadius: 10, textAlign: 'center',
                      background: `${color}0f`, border: `1px solid ${color}30`,
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                      <p style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        {label}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 20, color, marginBottom: 2 }}>
                        {s?.win_pct != null ? `${s.win_pct}%` : '—'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                        {s?.titles != null ? `${s.titles} title${s.titles !== 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptySection text="Surface data unavailable" />
            )}
          </Section>

          <Divider />

          {/* ── GRAND SLAM RECORD (AI) ──────────────────────────────────── */}
          <Section label="Grand Slam Record">
            {aiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2,3].map(i => <div key={i} className="tv-skeleton" style={{ height: 36, borderRadius: 8 }} />)}
              </div>
            ) : aiStats?.grand_slams ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: 'australian_open', label: 'Australian Open', surface: '#60a5fa' },
                  { key: 'french_open',     label: 'French Open',     surface: '#f97316' },
                  { key: 'wimbledon',       label: 'Wimbledon',       surface: '#4ade80' },
                  { key: 'us_open',         label: 'US Open',         surface: '#60a5fa' },
                ].map(({ key, label, surface }) => {
                  const result = aiStats.grand_slams[key];
                  const isWinner = result?.toLowerCase().includes('winner') || result?.toLowerCase().includes('champion');
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8,
                      background: isWinner ? 'rgba(159,239,102,0.06)' : 'var(--bg-glass)',
                      border: `1px solid ${isWinner ? 'rgba(159,239,102,0.25)' : 'var(--border)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 20, borderRadius: 2, background: surface }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: isWinner ? 'var(--lime)' : 'var(--text-faint)',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {isWinner ? '🏆 ' : ''}{result ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptySection text="Grand slam data unavailable" />
            )}
          </Section>

          <Divider />

          {/* ── CURRENT SEASON / RECENT FORM ────────────────────────────── */}
          <Section label="Current Season">
            {aiLoading ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[0,1,2].map(i => <div key={i} className="tv-skeleton" style={{ width: 70, height: 60, borderRadius: 8 }} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Season record */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {displayWins != null && (
                    <StatBadge label="Wins" value={displayWins} color="var(--green)" />
                  )}
                  {displayLosses != null && (
                    <StatBadge label="Losses" value={displayLosses} color="var(--clay)" />
                  )}
                  {aiStats?.current_season?.titles != null && (
                    <StatBadge label="Titles" value={aiStats.current_season.titles} color="var(--yellow)" />
                  )}
                  {p.first_serve_pct ? (
                    <StatBadge label="1st Srv%" value={`${p.first_serve_pct}%`} color="var(--blue)" />
                  ) : null}
                  {p.ace_avg ? (
                    <StatBadge label="Aces/M" value={p.ace_avg} color="#a78bfa" />
                  ) : null}
                </div>

                {/* Form dots */}
                {formLetters.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      Last {formLetters.length} Matches
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {formLetters.map((r, i) => (
                        <div key={i} style={{
                          width: 38, height: 38, borderRadius: 8,
                          background: r === 'W' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                          border: `1px solid ${r === 'W' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.3)'}`,
                          color: r === 'W' ? 'var(--green)' : 'var(--red)',
                          fontWeight: 800, fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Divider />

          {/* ── STRENGTHS & WEAKNESSES (AI) ─────────────────────────────── */}
          <Section label="Strengths & Weaknesses">
            {aiLoading ? (
              <TextSkeleton lines={4} />
            ) : aiStats?.strengths?.length || aiStats?.weaknesses?.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Strengths */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    ✓ Strengths
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(aiStats.strengths ?? []).map((s, i) => (
                      <div key={i} style={{
                        padding: '8px 10px', borderRadius: 7,
                        background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)',
                        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4,
                      }}>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Weaknesses */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--clay)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    ✗ Weaknesses
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(aiStats.weaknesses ?? []).map((w, i) => (
                      <div key={i} style={{
                        padding: '8px 10px', borderRadius: 7,
                        background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
                        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4,
                      }}>
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptySection text="Strengths/weaknesses unavailable" />
            )}
          </Section>

          <Divider />

          {/* ── BIOGRAPHY ───────────────────────────────────────────────── */}
          <Section label="Biography">
            {wikiLoading ? (
              <TextSkeleton lines={5} />
            ) : bioText ? (
              <div style={{
                fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8,
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                {bioText}
                {wiki?.wikiUrl && (
                  <a
                    href={wiki.wikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      marginLeft: 8, fontSize: 12, color: 'var(--lime)',
                      textDecoration: 'none', fontWeight: 600,
                    }}
                  >
                    Read more ↗
                  </a>
                )}
              </div>
            ) : (
              <EmptySection text="No biography found on Wikipedia." />
            )}
          </Section>

          <Divider />

          {/* ── CAREER HIGHLIGHTS (AI) ──────────────────────────────────── */}
          <Section label="Career Highlights">
            {aiLoading ? (
              <TextSkeleton lines={3} />
            ) : aiStats?.career_highlights?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {aiStats.career_highlights.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  }}>
                    <span style={{ color: 'var(--lime)', fontWeight: 700, flexShrink: 0, fontSize: 14 }}>★</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{h}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection text="Career highlights unavailable" />
            )}
          </Section>

          {/* ── BIGGEST RIVAL (AI) ──────────────────────────────────────── */}
          {!aiLoading && aiStats?.rival && (
            <>
              <Divider />
              <Section label="Biggest Rivalry">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.25)',
                }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>⚔️</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: '0 0 4px' }}>
                      vs {aiStats.rival}
                    </p>
                    {aiStats.rival_h2h && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                        H2H: {aiStats.rival_h2h}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* ── AI error notice ──────────────────────────────────────────── */}
          {aiError && !aiLoading && (
            <div style={{
              margin: '0 0 16px',
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)',
              fontSize: 12, color: 'var(--clay)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ AI stats unavailable — showing available data only.
            </div>
          )}

          {/* ── Chat CTA ─────────────────────────────────────────────────── */}
          {onChat && (
            <div style={{ padding: '0 0 20px' }}>
              <button
                onClick={() => { onChat(p); onClose(); }}
                style={{
                  width: '100%', padding: '13px 20px', borderRadius: 10,
                  background: 'var(--lime)', border: 'none',
                  color: '#070B14', fontFamily: 'var(--font-body)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                🤖 Ask AI about {p.name?.split(' ').pop()}
              </button>
            </div>
          )}

          {/* Safe area spacer */}
          <div style={{ height: 'max(env(safe-area-inset-bottom), 20px)' }} />
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ padding: '18px 0' }}>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
        textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)' }} />;
}

function Chip({ icon, label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: 'var(--bg-glass-md)',
      border: `1px solid ${color ? `${color}30` : 'var(--border)'}`,
      fontSize: 12, color: color ?? 'var(--text-muted)', fontWeight: 500,
    }}>
      {icon} {label}
    </span>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8, textAlign: 'center',
      background: `${color}0f`, border: `1px solid ${color}25`,
      minWidth: 56,
    }}>
      <p style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color, margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function TextSkeleton({ lines = 4 }) {
  const widths = [100, 95, 88, 92, 60, 75, 85];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="tv-skeleton" style={{ height: 13, borderRadius: 4, width: `${widths[i % widths.length]}%` }} />
      ))}
    </div>
  );
}

function EmptySection({ text }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic', margin: 0 }}>{text}</p>
  );
}