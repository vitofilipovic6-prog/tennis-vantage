// ─────────────────────────────────────────────────────────────────────────────
// PlayerBioModal.jsx – Slide-up player profile modal with Wikipedia bio
//
// HOW THE WIKI FETCH WORKS:
//  1. On mount, calls Wikipedia REST API: /page/summary/{player name}
//     No API key needed. Free, CORS-enabled endpoint.
//  2. Extracts: extract (bio paragraph), thumbnail (photo), description,
//     and birth date from the opening paragraph text.
//  3. Shows skeleton while loading, graceful empty state if not found.
//  4. All existing stat tiles / form badges preserved below the bio.
//
// Props:
//   player  — object (from Rankings or SearchModal)
//   onClose — fn
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };

// ── Wikipedia fetch helper ────────────────────────────────────────────────────
async function fetchWikiBio(playerName) {
  const encoded = encodeURIComponent(playerName.trim().replace(/\s+/g, '_'));
  const url     = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);

  const data = await res.json();
  if (data.type === 'disambiguation') throw new Error('Disambiguation page');

  return {
    extract:     data.extract     ?? null,
    description: data.description ?? null,
    thumbnail:   data.thumbnail?.source ?? null,
    wikiUrl:     data.content_urls?.desktop?.page ?? null,
    birthDate:   extractBirthDate(data.extract ?? ''),
  };
}

// Parse "born 3 June 1997" or "(born June 3, 1997)" from wiki extract
function extractBirthDate(text) {
  const m = text.match(
    /born\s+([A-Z][a-z]+ \d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i
  );
  return m ? m[1].replace(',', '') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PlayerBioModal({ player: p, onClose }) {
  const [wiki,        setWiki]        = useState(null);
  const [wikiLoading, setWikiLoading] = useState(true);
  const [wikiError,   setWikiError]   = useState(null);
  const [imgError,    setImgError]    = useState(false);

  // Lock body scroll
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
    setWikiError(null);
    setWiki(null);
    setImgError(false);

    fetchWikiBio(p.name)
      .then(data => { if (!cancelled) setWiki(data); })
      .catch(err => { if (!cancelled) setWikiError(err.message); })
      .finally(() => { if (!cancelled) setWikiLoading(false); });

    return () => { cancelled = true; };
  }, [p?.name]);

  if (!p) return null;

  const winRate      = p.wins && p.losses
    ? Math.round((p.wins / (p.wins + p.losses)) * 100) : null;
  const formLetters  = p.recent_form ? p.recent_form.trim().split(/\s+/) : [];
  const surfaceColor = surfaceColors[p.surface_pref] ?? '#94a3b8';

  // First 4 sentences from bio, avoid walls of text
  const bioText = wiki?.extract
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 4).join(' ')
    : null;

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(7,11,20,0.88)',
          backdropFilter: 'blur(10px)',
          animation: 'tv-fade-in 0.2s ease',
        }}
      />

      {/* ── Slide-up panel ────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 201,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 600,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-md)',
          borderTop: '1px solid rgba(159,239,102,0.15)',
          borderRadius: '24px 24px 0 0',
          pointerEvents: 'all',
          animation: 'tv-slide-up 0.32s cubic-bezier(0.4,0,0.2,1)',
          maxHeight: '92dvh',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--text-faint) transparent',
        }}>

          {/* Drag handle */}
          <div style={{
            width: 44, height: 4, borderRadius: 2,
            background: 'var(--border-md)',
            margin: '16px auto 0',
          }} />

          {/* ── HERO ─────────────────────────────────────────────────── */}
          <div style={{ position: 'relative', padding: '20px 24px 0' }}>

            {/* Close × */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 20, right: 24, zIndex: 2,
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>

            {/* Photo + Name row */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 18 }}>

              {/* Photo / flag fallback */}
              <div style={{
                width: 90, height: 90, borderRadius: 16, flexShrink: 0,
                background: 'linear-gradient(135deg,var(--bg-card-alt),var(--bg-2))',
                border: '2px solid var(--border-md)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {wikiLoading ? (
                  <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
                ) : wiki?.thumbnail && !imgError ? (
                  <img
                    src={wiki.thumbnail}
                    alt={p.name}
                    onError={() => setImgError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                  />
                ) : (
                  <span style={{ fontSize: 46 }}>{p.flag ?? '🎾'}</span>
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0, paddingRight: 44 }}>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 'clamp(20px,4vw,26px)', color: 'var(--text)',
                  margin: 0, lineHeight: 1.15,
                }}>
                  {p.name}
                </h2>

                {/* Wikipedia short description */}
                {wikiLoading ? (
                  <div className="skeleton" style={{ height: 13, width: 180, borderRadius: 4, marginTop: 8 }} />
                ) : wiki?.description ? (
                  <p style={{ fontSize: 13, color: 'var(--lime)', marginTop: 6, fontWeight: 500 }}>
                    {wiki.description}
                  </p>
                ) : null}

                {/* Meta chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                  <MetaChip icon="🌍" label={p.country ?? '—'} />
                  {wiki?.birthDate && <MetaChip icon="🎂" label={wiki.birthDate} />}
                  <MetaChip
                    icon="🎾"
                    label={`${p.surface_pref ?? '—'} specialist`}
                    color={surfaceColor}
                  />
                </div>
              </div>
            </div>

            {/* Stat badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <StatBadge label="World Rank"  value={`#${p.rank}`}                        color="var(--lime)"   />
              {p.points      && <StatBadge label="Points"    value={p.points?.toLocaleString()}  color="var(--yellow)" />}
              {winRate !== null && <StatBadge label="Win Rate" value={`${winRate}%`}             color="var(--green)"  />}
              {p.ace_avg     && <StatBadge label="Ace Avg"   value={p.ace_avg}                   color="var(--blue)"   />}
            </div>
          </div>

          {/* ── BIOGRAPHY ───────────────────────────────────────────────── */}
          <Section label="Biography">
            {wikiLoading ? (
              <BioSkeleton />
            ) : !bioText ? (
              <EmptyBio />
            ) : (
              <div style={{
                fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8,
                background: 'var(--bg-glass)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 16,
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
            )}
          </Section>

          <Divider />

          {/* ── CAREER STATS ────────────────────────────────────────────── */}
          <Section label="Career Stats">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 10,
            }}>
              <StatTile label="Career Wins"   value={p.wins              ?? '—'} />
              <StatTile label="Career Losses" value={p.losses            ?? '—'} />
              <StatTile label="1st Serve %"   value={p.first_serve_pct ? `${p.first_serve_pct}%` : '—'} />
              <StatTile label="Ace Average"   value={p.ace_avg           ?? '—'} />
            </div>
          </Section>

          {/* ── RECENT FORM ─────────────────────────────────────────────── */}
          {formLetters.length > 0 && (
            <>
              <Divider />
              <Section label="Recent Form">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {formLetters.map((r, i) => (
                    <div key={i} style={{
                      width: 42, height: 42, borderRadius: 9,
                      background: r === 'W' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                      border: `1px solid ${r === 'W' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.3)'}`,
                      color: r === 'W' ? 'var(--green)' : 'var(--red)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
                    }}>
                      {r}
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ── RANKING MOVEMENT ────────────────────────────────────────── */}
          {p.prev_rank && p.prev_rank !== p.rank && (
            <>
              <Divider />
              <Section label="Ranking Movement">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
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
              </Section>
            </>
          )}

          {/* ── INJURY NOTE ─────────────────────────────────────────────── */}
          {p.injury_notes && (
            <div style={{ padding: '0 24px 20px' }}>
              <div style={{
                padding: '12px 16px',
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13, color: 'var(--clay)',
              }}>
                ⚠️ {p.injury_notes}
              </div>
            </div>
          )}

          {/* iOS safe area + breathing room */}
          <div style={{ height: 'max(env(safe-area-inset-bottom), 24px)' }} />
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ padding: '20px 24px' }}>
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
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 24px' }} />;
}

// ── Skeleton for bio text ─────────────────────────────────────────────────────
function BioSkeleton() {
  return (
    <div style={{
      padding: 16, background: 'var(--bg-glass)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      {[100, 95, 88, 92, 55].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 13, borderRadius: 4, width: `${w}%` }} />
      ))}
    </div>
  );
}

function EmptyBio() {
  return (
    <div style={{
      padding: 16, background: 'var(--bg-glass)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic',
    }}>
      No biography found on Wikipedia for this player.
    </div>
  );
}

// ── Micro-components ──────────────────────────────────────────────────────────
function MetaChip({ icon, label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px',
      background: 'var(--bg-glass-md)',
      border: `1px solid ${color ? `${color}30` : 'var(--border)'}`,
      borderRadius: 999,
      fontSize: 12, color: color ?? 'var(--text-muted)', fontWeight: 500,
    }}>
      {icon} {label}
    </span>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{
      padding: '9px 13px', flex: '1 1 76px',
      background: 'var(--bg-glass)',
      border: `1px solid ${color}22`,
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: 10, color: 'var(--text-faint)',
        marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 17, color }}>
        {value}
      </p>
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
      <p style={{
        fontSize: 10, color: 'var(--text-faint)',
        marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}