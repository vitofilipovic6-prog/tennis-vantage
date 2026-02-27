// ─────────────────────────────────────────────────────────────────────────────
// LandingPage.jsx  –  TennisVantage hero landing
// Aesthetic: Dark court noir. Lime electric accents. Cinematic entry.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Logo, Btn, CourtSVG, Badge } from '../components/ui';

const STATS = [
  { val: '94%',   label: 'Prediction Accuracy' },
  { val: '2,400+',label: 'Matches Analysed'    },
  { val: 'Live',  label: 'Real-Time Scores'    },
  { val: 'ATP',   label: 'Tour Coverage'        },
];

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Live Match Data',
    desc:  'Real-time scores, set-by-set breakdowns and momentum shifts from every ATP & WTA tournament.',
    accent: '#9fef66',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'AI-Powered Predictions',
    desc:  'Our model analyses surface type, H2H records, fatigue index and serve stats to generate match-win probabilities.',
    accent: '#f97316',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Player Deep Dives',
    desc:  'Career stats, surface win-rates, recent form indexes and head-to-head breakdowns for every ranked player.',
    accent: '#60a5fa',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'AI Tennis Analyst',
    desc:  'Chat with our AI assistant about any match, player or prediction — your personal tennis analyst, 24/7.',
    accent: '#a78bfa',
  },
];

export default function LandingPage({ nav }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 clamp(20px, 4vw, 60px)',
        height: '68px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(7,11,20,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'var(--t-md)',
      }}>
        <Logo onClick={() => {}} size="sm" />

        {/* Desktop nav */}
        <div className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {['Features', 'Rankings', 'About'].map(item => (
            <a key={item} href="#" style={{
              fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)',
              transition: 'var(--t)',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >{item}</a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Btn variant="ghost" size="sm" onClick={() => nav('login')}>Sign In</Btn>
          <Btn variant="primary" size="sm" onClick={() => nav('signup')}>Get Started</Btn>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(100px,14vh,160px) clamp(20px,5vw,80px) clamp(60px,8vh,100px)',
        overflow: 'hidden',
      }}>
        {/* Background layers */}
        <div className="court-grid-bg" />
        <CourtSVG opacity={0.055} />

        {/* Gradient orbs */}
        <div style={{
          position: 'absolute', top: '15%', right: '-5%',
          width: 'clamp(280px, 45vw, 600px)', height: 'clamp(280px, 45vw, 600px)',
          background: 'radial-gradient(circle, rgba(159,239,102,0.1) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '5%', left: '-10%',
          width: 'clamp(250px, 40vw, 500px)', height: 'clamp(250px, 40vw, 500px)',
          background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: '1100px', width: '100%', margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'clamp(280px,55%,620px) 1fr',
          gap: 'clamp(40px,6vw,80px)',
          alignItems: 'center',
        }}>
          {/* Left: text */}
          <div>
            <div className="tv-fade-up" style={{ marginBottom: '24px' }}>
              <Badge color="var(--lime)">
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--lime)', animation: 'tv-live-dot 1.2s infinite' }} />
                Live ATP / WTA coverage
              </Badge>
            </div>

            <h1 className="tv-fade-up d1" style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(38px, 6vw, 80px)',
              lineHeight: 1.05, letterSpacing: '-0.03em',
              color: 'var(--text)',
              marginBottom: '24px',
            }}>
              Predict Every<br />
              <span style={{
                background: 'linear-gradient(135deg, #9fef66 0%, #6bc940 50%, #f97316 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Match Winner</span>
            </h1>

            <p className="tv-fade-up d2" style={{
              fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text-muted)',
              lineHeight: 1.7, maxWidth: '500px', marginBottom: '36px',
            }}>
              TennisVantage combines live ATP/WTA data with AI analysis to give you
              real-time win probabilities, surface breakdowns and player deep-dives
              — before the first serve.
            </p>

            <div className="tv-fade-up d3" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '52px' }}>
              <Btn variant="primary" size="lg" onClick={() => nav('signup')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                Start Predicting Free
              </Btn>
              <Btn variant="secondary" size="lg" onClick={() => nav('login')}>
                Sign In
              </Btn>
            </div>

            {/* Stats row */}
            <div className="tv-fade-up d4" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
              gap: '4px', maxWidth: '460px',
            }}>
              {STATS.map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 'clamp(17px,2vw,24px)', color: 'var(--lime)',
                    letterSpacing: '-0.02em',
                  }}>{s.val}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: floating match card preview */}
          <div className="tv-fade-up d3 hide-sm" style={{ position: 'relative' }}>
            <HeroMatchCard />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(60px,10vh,120px) clamp(20px,5vw,80px)',
        maxWidth: '1100px', margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(40px,6vh,70px)' }}>
          <p className="tv-fade-up" style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--lime)', fontWeight: 600, marginBottom: '12px' }}>
            Everything you need
          </p>
          <h2 className="tv-fade-up d1" style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,50px)',
            fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text)',
          }}>
            Built for serious tennis fans
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px',
        }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} delay={i} />
          ))}
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(40px,8vh,100px) clamp(20px,5vw,80px)' }}>
        <div style={{
          maxWidth: '860px', margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(159,239,102,0.08) 0%, rgba(249,115,22,0.05) 100%)',
          border: '1px solid rgba(159,239,102,0.18)',
          borderRadius: 'var(--radius-xl)',
          padding: 'clamp(36px,6vw,72px)',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <CourtSVG opacity={0.04} />
          <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lime)', fontWeight: 600, marginBottom: '14px' }}>
            Free to start
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,4vw,48px)',
            fontWeight: 800, letterSpacing: '-0.025em', marginBottom: '18px',
          }}>
            Your edge starts here
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(14px,1.8vw,17px)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.7 }}>
            Join thousands of tennis fans using AI-powered predictions to watch smarter, bet wiser, and understand the game deeper.
          </p>
          <Btn variant="primary" size="xl" onClick={() => nav('signup')}>
            Create Free Account →
          </Btn>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        padding: 'clamp(24px,4vh,48px) clamp(20px,5vw,80px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <Logo size="sm" />
        <p style={{ fontSize: '13px', color: 'var(--text-faint)' }}>
          © 2025 TennisVantage · Built for university project
        </p>
        <div style={{ display: 'flex', gap: '20px' }}>
          {['Privacy', 'Terms', 'Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize: '13px', color: 'var(--text-faint)', transition: 'var(--t)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--lime)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
            >{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function HeroMatchCard() {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-md)',
      borderRadius: 'var(--radius-lg)',
      padding: '28px',
      boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 50px rgba(159,239,102,0.08)',
      animation: 'tv-pulse-glow 4s ease infinite',
      maxWidth: '360px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500 }}>Roland Garros · QF</span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 700, color: 'var(--green)',
          background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
          padding: '3px 10px', borderRadius: '999px',
        }}>
          <span className="live-dot" /> LIVE
        </span>
      </div>

      {/* Players */}
      {[
        { name: 'N. Djokovic', flag: '🇷🇸', score: '6-4, 3', serving: true  },
        { name: 'C. Alcaraz',  flag: '🇪🇸', score: '2-6, 2', serving: false },
      ].map((p, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', marginBottom: 8,
          background: p.serving ? 'rgba(159,239,102,0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${p.serving ? 'rgba(159,239,102,0.2)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{p.flag}</span>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>{p.name}</span>
            {p.serving && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }} />}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '15px',
            color: p.serving ? 'var(--lime)' : 'var(--text-muted)',
          }}>{p.score}</span>
        </div>
      ))}

      {/* Prediction bar */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Probability</span>
          <span style={{ fontSize: '11px', color: 'var(--lime)', fontWeight: 600 }}>AI · High confidence</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--lime)', width: '36px' }}>63%</span>
          <div style={{ flex: 1, height: '8px', background: 'var(--border-md)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: '63%',
              background: 'linear-gradient(90deg, #9fef66, #6bc940)',
              borderRadius: '99px',
              boxShadow: '0 0 12px rgba(159,239,102,0.5)',
            }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', width: '36px', textAlign: 'right' }}>37%</span>
        </div>
      </div>

      {/* Key factors */}
      <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Key Factors</p>
        {['Clay surface advantage', 'H2H: 7–5 Djokovic', 'Serve %: 65 vs 62'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ feature: f, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className={`tv-fade-up d${delay + 1}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--bg-card-alt)' : 'var(--bg-card)',
        border: `1px solid ${hov ? f.accent + '30' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '28px',
        transition: 'var(--t-md)',
        transform: hov ? 'translateY(-4px)' : 'none',
        boxShadow: hov ? `0 20px 50px rgba(0,0,0,0.4), 0 0 30px ${f.accent}15` : 'var(--shadow-card)',
      }}
    >
      <div style={{
        width: '46px', height: '46px', borderRadius: 'var(--radius-sm)',
        background: `${f.accent}15`, border: `1px solid ${f.accent}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: f.accent, marginBottom: '18px',
        transition: 'var(--t)',
        boxShadow: hov ? `0 0 20px ${f.accent}20` : 'none',
      }}>{f.icon}</div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: '17px', marginBottom: '10px',
        color: hov ? f.accent : 'var(--text)',
        transition: 'var(--t)',
      }}>{f.title}</h3>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>{f.desc}</p>
    </div>
  );
}
