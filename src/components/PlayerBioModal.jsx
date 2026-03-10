// ─────────────────────────────────────────────────────────────────────────────
// src/components/PlayerBioModal.jsx
// Gemini generates a fresh bio for ANY player clicked — no hardcoded data.
// Works automatically for new top-20 entrants too.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';

// ── Fetch bio from Gemini via the existing /api/chat endpoint ─────────────────
async function fetchPlayerBio(player, tour) {
  const prompt = `Generate a tennis player profile for ${player.name}, currently ranked #${player.rank} in the ${tour}.
Return ONLY a valid JSON object with NO markdown, NO backticks, NO extra text. Use exactly this structure:
{
  "bio": "2-3 sentence biography covering their background, career journey, and major achievements",
  "playingStyle": "one sentence describing their playing style and court game",
  "achievements": "key career titles and records in one sentence",
  "advantages": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "disadvantages": ["specific weakness 1", "specific weakness 2", "specific weakness 3"]
}`;

  const res = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      systemContext: 'You are a professional tennis analyst and writer. You provide accurate, insightful player profiles based on real career data. Always respond with valid JSON only — no markdown, no backticks, no preamble.',
    }),
  });

  if (!res.ok) throw new Error('Failed to fetch player bio');

  const data  = await res.json();
  const text  = data?.content?.[0]?.text ?? '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function PlayerBioModal({ player, tour, onClose }) {
  const [bio,     setBio]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Fetch whenever the player changes
  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBio(null);

    fetchPlayerBio(player, tour)
      .then(b  => { if (!cancelled) setBio(b); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [player?.id, tour]);

  // Close on Escape key
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!player) return null;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 200,
          animation: 'tv-fade-in 0.2s ease',
        }}
      />

      {/* ── Modal panel ──────────────────────────────────────────────────── */}
      <div style={{
        position:   'fixed',
        top:        '50%',
        left:       '50%',
        transform:  'translate(-50%, -50%)',
        width:      'min(640px, 94vw)',
        maxHeight:  '88vh',
        background: 'var(--bg-card)',
        border:     '1px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)',
        zIndex:     201,
        overflow:   'hidden',
        display:    'flex',
        flexDirection: 'column',
        boxShadow:  '0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)',
        animation:  'tv-pop 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          padding:    '26px 28px 22px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, var(--bg-card-alt) 0%, var(--bg-card) 100%)',
          flexShrink: 0,
          position:   'relative',
          overflow:   'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(159,239,102,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              {/* Flag */}
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--bg-glass-md)',
                border: '2px solid var(--border-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '36px', lineHeight: 1, flexShrink: 0,
              }}>
                {player.flag}
              </div>

              <div>
                <h2 style={{
                  fontFamily:    'var(--font-display)',
                  fontWeight:    700,
                  fontSize:      'clamp(18px,3vw,26px)',
                  letterSpacing: '-0.02em',
                  color:         'var(--text)',
                  margin:        0,
                }}>
                  {player.name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
                  {player.country}
                  <span style={{ color: 'var(--border-md)', margin: '0 8px' }}>·</span>
                  {tour} #{player.rank}
                  {player.surface_pref && (
                    <>
                      <span style={{ color: 'var(--border-md)', margin: '0 8px' }}>·</span>
                      {player.surface_pref} specialist
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background:   'var(--bg-glass-md)',
                border:       '1px solid var(--border)',
                borderRadius: '50%',
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor:  'pointer',
                color:   'var(--text-muted)',
                flexShrink: 0,
                transition: 'var(--t)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-glass-md)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Quick stat pills */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Points',     val: player.points?.toLocaleString() ?? '—' },
              { label: 'W / L',      val: `${player.wins ?? 0} / ${player.losses ?? 0}` },
              { label: '1st Serve',  val: player.first_serve_pct ? `${player.first_serve_pct}%` : '—' },
              { label: 'Ace Avg',    val: player.ace_avg ?? '—' },
            ].map(s => (
              <div key={s.label} style={{
                background:   'var(--bg-glass)',
                border:       '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding:      '8px 14px',
              }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--lime)', margin: 0 }}>{s.val}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-faint)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div style={{ overflowY: 'auto', padding: '26px 28px', flex: 1 }}>
          {loading ? (
            <BioSkeleton />
          ) : error ? (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              color: 'var(--text-muted)', fontSize: '14px',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
              Could not load player profile. Please try again.
            </div>
          ) : bio ? (
            <BioContent bio={bio} recentForm={player.recent_form} />
          ) : null}
        </div>
      </div>
    </>
  );
}

// ── Bio content ───────────────────────────────────────────────────────────────
function BioContent({ bio, recentForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Biography */}
      <section>
        <FieldLabel>Biography</FieldLabel>
        <p style={{ fontSize: '14.5px', color: 'var(--text-muted)', lineHeight: 1.75, margin: 0 }}>
          {bio.bio}
        </p>
      </section>

      {/* Playing style */}
      {bio.playingStyle && (
        <section>
          <FieldLabel>Playing Style</FieldLabel>
          <div style={{
            padding:      '14px 18px',
            background:   'rgba(159,239,102,0.04)',
            border:       '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-sm)',
            borderLeft:   '3px solid var(--lime)',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
              "{bio.playingStyle}"
            </p>
          </div>
        </section>
      )}

      {/* Achievements */}
      {bio.achievements && (
        <section>
          <FieldLabel>Career Highlights</FieldLabel>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
            {bio.achievements}
          </p>
        </section>
      )}

      {/* Strengths + Weaknesses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '16px' }}>
        <section>
          <FieldLabel color="var(--green)">Strengths</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(bio.advantages ?? []).map((a, i) => (
              <div key={i} style={{
                display:      'flex',
                gap:          '10px',
                alignItems:   'flex-start',
                padding:      '10px 12px',
                background:   'rgba(74,222,128,0.05)',
                border:       '1px solid rgba(74,222,128,0.15)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" style={{ marginTop: 2, flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{a}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <FieldLabel color="var(--red)">Weaknesses</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(bio.disadvantages ?? []).map((d, i) => (
              <div key={i} style={{
                display:      'flex',
                gap:          '10px',
                alignItems:   'flex-start',
                padding:      '10px 12px',
                background:   'rgba(248,113,113,0.05)',
                border:       '1px solid rgba(248,113,113,0.15)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" style={{ marginTop: 2, flexShrink: 0 }}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{d}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent form */}
      {recentForm && (
        <section>
          <FieldLabel>Recent Form</FieldLabel>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {recentForm.split(' ').filter(Boolean).map((r, i) => (
              <span key={i} style={{
                fontFamily:  'var(--font-mono)',
                fontWeight:  700,
                fontSize:    '15px',
                padding:     '7px 16px',
                borderRadius: '8px',
                background: r === 'W' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                border:     `1px solid ${r === 'W' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color:       r === 'W' ? 'var(--green)' : 'var(--red)',
              }}>{r}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FieldLabel({ children, color = 'var(--text-faint)' }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color, marginBottom: '10px', marginTop: 0,
    }}>
      {children}
    </p>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function BioSkeleton() {
  const shimmer = {
    background:         'linear-gradient(90deg, var(--bg-glass) 25%, var(--bg-glass-md) 50%, var(--bg-glass) 75%)',
    backgroundSize:     '200% 100%',
    animation:          'tv-shimmer 1.4s ease infinite',
    borderRadius:       '6px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ ...shimmer, height: 11, width: 80, marginBottom: 12 }} />
        <div style={{ ...shimmer, height: 14, width: '100%', marginBottom: 8 }} />
        <div style={{ ...shimmer, height: 14, width: '88%',  marginBottom: 8 }} />
        <div style={{ ...shimmer, height: 14, width: '72%' }} />
      </div>
      <div>
        <div style={{ ...shimmer, height: 11, width: 100, marginBottom: 12 }} />
        <div style={{ ...shimmer, height: 64, width: '100%' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[0, 1].map(col => (
          <div key={col}>
            <div style={{ ...shimmer, height: 11, width: 70, marginBottom: 12 }} />
            {[0, 1, 2].map(row => (
              <div key={row} style={{ ...shimmer, height: 38, marginBottom: 8 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}