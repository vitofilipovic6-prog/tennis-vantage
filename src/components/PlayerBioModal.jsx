// src/components/PlayerBioModal.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
const CACHE_TTL_DAYS = 7;

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
    extract: data.extract ?? null,
    description: data.description ?? null,
    thumbnail: data.thumbnail?.source ?? null,
    wikiUrl: data.content_urls?.desktop?.page ?? null,
    birthDate: extractBirthDate(data.extract ?? ''),
  };
}

function extractBirthDate(text) {
  const m = text.match(/born\s+([A-Z][a-z]+ \d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i);
  return m ? m[1].replace(',', '') : null;
}

// ── Check Supabase cache ──────────────────────────────────────────────────────
async function getCachedAiStats(playerId) {
  try {
    const { data, error } = await supabase
      .from('player_ai_cache')
      .select('ai_data, cached_at')
      .eq('player_id', playerId)
      .single();

    if (error || !data) return null;

    // Check if cache is expired
    const cachedAt = new Date(data.cached_at);
    const ageMs = Date.now() - cachedAt.getTime();
    const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) return null;

    return data.ai_data;
  } catch {
    return null;
  }
}

// ── Save to Supabase cache ────────────────────────────────────────────────────
async function saveAiStatsToCache(playerId, playerName, aiData) {
  try {
    await supabase
      .from('player_ai_cache')
      .upsert({
        player_id: playerId,
        player_name: playerName,
        ai_data: aiData,
        cached_at: new Date().toISOString(),
      }, { onConflict: 'player_id' });
  } catch (e) {
    console.warn('[PlayerBioModal] cache save failed:', e.message);
  }
}

// ── AI stats fetch via /api/chat ──────────────────────────────────────────────
async function fetchAiPlayerStats(player) {
  const res = await fetch('/api/player-bio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player }),
  });

  if (!res.ok) throw new Error(`Player bio fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data?.data) throw new Error('Invalid response from player-bio API');
  return data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PlayerBioModal({ player: p, onClose, onChat }) {
  const [wiki, setWiki] = useState(null);
  const [wikiLoading, setWikiLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  // Lock scroll
  useEffect(() => {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');
  return () => {
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    document.documentElement.style.removeProperty('--scrollbar-width');
  };
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
      .then(d => { if (!cancelled) setWiki(d); })
      .catch(() => { if (!cancelled) setWiki(null); })
      .finally(() => { if (!cancelled) setWikiLoading(false); });
    return () => { cancelled = true; };
  }, [p?.name]);

  // Fetch AI stats — check cache first, then AI
  useEffect(() => {
    if (!p?.id || !p?.name) return;
    let cancelled = false;

    setAiLoading(true);
    setAiError(null);
    setAiStats(null);
    setFromCache(false);

    async function load() {
      // 1. Try cache first
      const cached = await getCachedAiStats(p.id);
      if (cached && !cancelled) {
        setAiStats(cached);
        setFromCache(true);
        setAiLoading(false);
        return;
      }

      // 2. No cache — fetch from AI
      try {
        const fresh = await fetchAiPlayerStats(p);
        if (!cancelled) {
          setAiStats(fresh);
          setAiError(null);
          // 3. Save to cache in background — don't await
          saveAiStatsToCache(p.id, p.name, fresh);
        }
      } catch (e) {
        if (!cancelled) setAiError(e.message);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [p?.id, p?.name]);

  if (!p) return null;

  const displayRank = (p.rank && p.rank < 999) ? p.rank : aiStats?.peak_rank ?? null;
  const displayWins = p.wins || aiStats?.current_season?.wins;
  const displayLosses = p.losses || aiStats?.current_season?.losses;
  const winRate = displayWins && displayLosses
    ? Math.round((displayWins / (displayWins + displayLosses)) * 100)
    : aiStats?.career_win_pct ?? null;
  const formStr = aiStats?.current_season?.form ?? p.recent_form ?? '';
  const formLetters = formStr.trim().split(/[\s,]+/).filter(l => l === 'W' || l === 'L');
  const bioText = wiki?.extract
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 4).join(' ')
    : null;
  const surfaceColor = surfaceColors[p.surface_pref] ?? '#94a3b8';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 401,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 560,
            maxHeight: '92dvh', overflowY: 'auto',
            background: 'var(--bg-card)',
            borderRadius: '20px 20px 0 0',
            border: '1px solid var(--border-md)',
            borderBottom: 'none',
            pointerEvents: 'all',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Flag + name */}
              <span style={{ fontSize: 28 }}>{p.flag ?? '🏳️'}</span>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 'clamp(16px,3vw,20px)', margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  {aiStats?.full_name ?? p.name}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 0' }}>
                  {p.country ?? '—'}
                  {aiStats?.turned_pro && ` · Pro since ${aiStats.turned_pro}`}
                  {aiStats?.plays && ` · ${aiStats.plays}`}
                  {aiStats?.height && ` · ${aiStats.height}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}
            >✕</button>
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div style={{ padding: '0 20px' }}>

            {/* ── STATS ROW ──────────────────────────────────────────────── */}
            <div style={{ padding: '16px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {displayRank && (
                <StatBadge
                  label="Rank"
                  value={`#${displayRank}`}
                  color="var(--lime)"
                />
              )}
              {winRate !== null && (
                <StatBadge label="Win %" value={`${winRate}%`} color="var(--green)" />
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
              {aiLoading ? (
                <div className="tv-skeleton" style={{ width: 60, height: 52, borderRadius: 8 }} />
              ) : aiStats?.peak_rank != null ? (
                <StatBadge label="Peak" value={`#${aiStats.peak_rank}`} color="#a78bfa" />
              ) : null}
              {/* Cache indicator */}
              {!aiLoading && (
                <div style={{
                  marginLeft: 'auto', fontSize: 10,
                  color: fromCache ? 'var(--green)' : 'var(--lime)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  alignSelf: 'center',
                }}>
                  <span>{fromCache ? '⚡ Cached' : '🤖 AI Generated'}</span>
                </div>
              )}
            </div>

            <Divider />

            {/* ── GRAND SLAM BREAKDOWN ───────────────────────────────────── */}
            {(aiLoading || aiStats?.grand_slams) && (
              <>
                <Section label="Grand Slams">
                  {aiLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="tv-skeleton" style={{ height: 64, borderRadius: 8 }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      {[
                        { label: 'AO', key: 'australian_open', color: '#60a5fa' },
                        { label: 'RG', key: 'french_open', color: '#f97316' },
                        { label: 'WIM', key: 'wimbledon', color: '#4ade80' },
                        { label: 'USO', key: 'us_open', color: '#facc15' },
                      ].map(({ label, key, color }) => (
                        <div key={key} style={{
                          padding: '10px 8px', borderRadius: 8, textAlign: 'center',
                          background: `${color}0f`, border: `1px solid ${color}25`,
                        }}>
                          <p style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {label}
                          </p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 20, color, margin: 0 }}>
                            {aiStats.grand_slams?.[key] ?? 0}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
                <Divider />
              </>
            )}

            {/* ── SURFACE BREAKDOWN ──────────────────────────────────────── */}
            <Section label="Surface Breakdown">
              {aiLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="tv-skeleton" style={{ height: 80, borderRadius: 10 }} />
                  ))}
                </div>
              ) : aiStats?.surface_stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { key: 'clay', label: 'Clay', color: '#f97316' },
                    { key: 'hard', label: 'Hard', color: '#60a5fa' },
                    { key: 'grass', label: 'Grass', color: '#4ade80' },
                  ].map(({ key, label, color }) => {
                    const s = aiStats.surface_stats[key];
                    return (
                      <div key={key} style={{
                        padding: '12px 10px', borderRadius: 10, textAlign: 'center',
                        background: `${color}0d`, border: `1px solid ${color}25`,
                      }}>
                        <p style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {label}
                        </p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, color: 'var(--text)', margin: '0 0 2px' }}>
                          {s?.win_pct != null ? `${s.win_pct}%` : '—'}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--text-faint)', margin: 0 }}>
                          {s?.titles != null ? `${s.titles} titles` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptySection text="Surface stats unavailable" />
              )}
            </Section>

            <Divider />

            {/* ── PLAYING STYLE ──────────────────────────────────────────── */}
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

            {/* ── STRENGTHS & WEAKNESSES ─────────────────────────────────── */}
            <Section label="Strengths & Weaknesses">
              {aiLoading ? (
                <TextSkeleton lines={4} />
              ) : (aiStats?.strengths?.length || aiStats?.weaknesses?.length) ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--clay)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      ✗ Weaknesses
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(aiStats.weaknesses ?? []).map((w, i) => (
                        <div key={i} style={{
                          padding: '8px 10px', borderRadius: 7,
                          background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)',
                          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4,
                        }}>
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptySection text="Analysis unavailable" />
              )}
            </Section>

            <Divider />

            {/* ── CURRENT FORM ───────────────────────────────────────────── */}
            <Section label="Recent Form">
              {aiLoading ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="tv-skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
                  ))}
                </div>
              ) : formLetters.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {formLetters.slice(-5).map((r, i) => (
                      <div key={i} style={{
                        width: 32, height: 32, borderRadius: 6,
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
                  {aiStats?.current_season && (
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
                      {aiStats.current_season.wins ?? 0}W – {aiStats.current_season.losses ?? 0}L this season
                      {aiStats.current_season.titles ? ` · ${aiStats.current_season.titles} title${aiStats.current_season.titles !== 1 ? 's' : ''}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <EmptySection text="Form data unavailable" />
              )}
            </Section>

            <Divider />

            {/* ── KEY RIVALS ─────────────────────────────────────────────── */}
            {(aiLoading || aiStats?.best_rivals?.length) && (
              <>
                <Section label="Key Rivals">
                  {aiLoading ? (
                    <TextSkeleton lines={3} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(aiStats.best_rivals ?? []).slice(0, 3).map((r, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: 8,
                          background: 'var(--bg-glass)', border: '1px solid var(--border)',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {r.name}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                            {r.h2h}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
                <Divider />
              </>
            )}

            {/* ── BIO ────────────────────────────────────────────────────── */}
            <Section label="Biography">
              {wikiLoading ? (
                <TextSkeleton lines={4} />
              ) : bioText ? (
                <div>
                  {wiki?.thumbnail && !imgError && (
                    <img
                      src={wiki.thumbnail}
                      alt={p.name}
                      onError={() => setImgError(true)}
                      style={{
                        float: 'right', marginLeft: 12, marginBottom: 8,
                        width: 80, height: 80, borderRadius: 10, objectFit: 'cover',
                        border: '1px solid var(--border)',
                      }}
                    />
                  )}
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
                    {bioText}
                  </p>
                  {wiki?.wikiUrl && (

                    <a href={wiki.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: 'var(--lime)', display: 'inline-block', marginTop: 8 }}
                    >
                      Read more on Wikipedia →
                    </a>
                  )}
                </div>
              ) : (
                <EmptySection text="No biography available" />
              )}
            </Section>

            {/* ── Career highlight ───────────────────────────────────────── */}
            {!aiLoading && aiStats?.career_highlight && (
              <>
                <Divider />
                <Section label="Career Highlight">
                  <div style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(159,239,102,0.06)',
                    border: '1px solid rgba(159,239,102,0.2)',
                    fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
                    fontStyle: 'italic',
                  }}>
                    🏆 {aiStats.career_highlight}
                  </div>
                </Section>
              </>
            )}

            {/* ── AI error fallback ──────────────────────────────────────── */}
            {!aiLoading && aiError && (
              <>
                <Divider />
                <div style={{
                  padding: '12px 16px', borderRadius: 8, marginBottom: 16,
                  background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)',
                  fontSize: 12, color: 'var(--red)',
                }}>
                  Could not load AI stats — showing available data only.
                </div>
              </>
            )}
            <div style={{ height: 'max(env(safe-area-inset-bottom), 20px)' }} />
          </div>
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
    <p style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic', margin: 0 }}>
      {text}
    </p>
  );
}