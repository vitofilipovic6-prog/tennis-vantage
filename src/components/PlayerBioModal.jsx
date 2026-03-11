// ─────────────────────────────────────────────────────────────────────────────
// PlayerBioModal.jsx – Slide-up player profile modal
// Props: player (object) | onClose (fn)
// Used by: RankingsTab (click any row) + PlayerSearchModal
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };

export default function PlayerBioModal({ player: p, onClose }) {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!p) return null;

  const winRate = p.wins && p.losses
    ? Math.round((p.wins / (p.wins + p.losses)) * 100)
    : null;

  const formLetters = p.recent_form
    ? p.recent_form.trim().split(/\s+/)
    : [];

  const surfaceColor = surfaceColors[p.surface_pref] ?? '#94a3b8';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(7,11,20,0.8)',
          backdropFilter: 'blur(8px)',
          animation: 'tv-fade-in 0.2s ease',
        }}
      />

      {/* Slide-up panel */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 201,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-md)',
          borderRadius: '24px 24px 0 0',
          padding: '28px 28px 48px',
          pointerEvents: 'all',
          animation: 'tv-slide-up 0.3s cubic-bezier(0.4,0,0.2,1)',
          maxHeight: '88dvh',
          overflowY: 'auto',
        }}>

          {/* Drag handle */}
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'var(--border-md)',
            margin: '0 auto 24px',
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--bg-card-alt), var(--bg-2))',
                border: '2px solid var(--border-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, flexShrink: 0,
              }}>
                {p.flag}
              </div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 'clamp(18px,4vw,22px)', color: 'var(--text)', margin: 0,
                }}>
                  {p.name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
                  {p.country ?? '—'} · {p.surface_pref} specialist
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Key stat badges */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatBadge label="World Rank"  value={`#${p.rank}`}             color="var(--lime)" />
            {p.points   && <StatBadge label="Points"     value={p.points?.toLocaleString()} color="var(--yellow)" />}
            {winRate !== null && <StatBadge label="Win Rate" value={`${winRate}%`}           color="var(--green)" />}
            <StatBadge label="Surface"    value={p.surface_pref ?? '—'}    color={surfaceColor} />
          </div>

          {/* Recent form */}
          {formLetters.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionLabel>Recent Form</SectionLabel>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {formLetters.map((r, i) => (
                  <div key={i} style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: r === 'W' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                    border: `1px solid ${r === 'W' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.3)'}`,
                    color: r === 'W' ? 'var(--green)' : 'var(--red)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
                  }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Career stats grid */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Career Stats</SectionLabel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10,
            }}>
              <StatTile label="Career Wins"   value={p.wins    ?? '—'} />
              <StatTile label="Career Losses" value={p.losses  ?? '—'} />
              <StatTile label="1st Serve %"   value={p.first_serve_pct ? `${p.first_serve_pct}%` : '—'} />
              <StatTile label="Ace Average"   value={p.ace_avg ?? '—'} />
            </div>
          </div>

          {/* Ranking movement */}
          {p.prev_rank && p.prev_rank !== p.rank && (
            <div style={{ marginBottom: 24 }}>
              <SectionLabel>Ranking Movement</SectionLabel>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Previous: <strong style={{ color: 'var(--text)' }}>#{p.prev_rank}</strong>
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: p.rank < p.prev_rank ? 'var(--green)' : 'var(--red)',
                }}>
                  {p.rank < p.prev_rank
                    ? `▲ +${p.prev_rank - p.rank} positions`
                    : `▼ ${p.rank - p.prev_rank} positions`}
                </span>
              </div>
            </div>
          )}

          {/* Injury note */}
          {p.injury_notes && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13, color: 'var(--clay)',
            }}>
              ⚠️ {p.injury_notes}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--text-faint)',
      marginBottom: 10,
    }}>
      {children}
    </p>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 14px',
      background: 'var(--bg-glass)',
      border: `1px solid ${color}30`,
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color }}>{value}</p>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>{label}</p>
      <p style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: 18, color: 'var(--text)',
      }}>
        {value}
      </p>
    </div>
  );
}