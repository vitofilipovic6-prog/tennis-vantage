// ─────────────────────────────────────────────────────────────────────────────
// LandingPage.jsx  –  TennisVantage  (complete rewrite, drop-in replacement)
// Preserves: Logo · Btn · CourtSVG · Badge from ../components/ui
//            nav() prop pattern   |   all CSS variables from index.css
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { Logo, Btn, CourtSVG, Badge } from '../components/ui';

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { val: '94%',     label: 'Prediction Accuracy' },
  { val: '2,400+',  label: 'Matches Analysed'    },
  { val: 'Live',    label: 'Real-Time Scores'    },
  { val: 'ATP/WTA', label: 'Tour Coverage'        },
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Live Match Data',
    desc:  'Real-time scores, set-by-set breakdowns and momentum shifts from every ATP & WTA tournament worldwide.',
    accent: '#9fef66',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'AI-Powered Predictions',
    desc:  'Our model analyses surface type, H2H records, fatigue index and serve stats to generate accurate win probabilities.',
    accent: '#f97316',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'AI Tennis Analyst',
    desc:  'Chat with our AI assistant about any match, player or prediction — your personal tennis expert, available 24/7.',
    accent: '#a78bfa',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'World Rankings',
    desc:  'Up-to-date ATP & WTA rankings with surface preferences and career trajectory charts for every professional.',
    accent: '#fb7185',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    title: 'Tournament Tracker',
    desc:  'Full draw views, bracket predictions and live upsets tracker for every Grand Slam and Masters event.',
    accent: '#34d399',
  },
];

const STEPS = [
  { n: '01', title: 'Create your account',   desc: 'Sign up free in seconds with email or Google — no credit card required.' },
  { n: '02', title: 'Browse live matches',   desc: 'Explore ATP & WTA fixtures, live scores and upcoming match schedules.' },
  { n: '03', title: 'Get your prediction',   desc: 'Select any match for an AI win-probability card with key factor breakdowns.' },
  { n: '04', title: 'Ask the analyst',       desc: 'Still curious? Our AI chat gives you expert-level context on demand.' },
];

const TESTIMONIALS = [
  {
    stars: 5,
    quote: 'The surface breakdown is what got me. Seeing exactly why a player is +20% on clay versus hard court finally made sense of results I never understood before.',
    name: 'Marko D.',
    role: 'Amateur player · Zagreb',
  },
  {
    stars: 5,
    quote: "I used TennisVantage to follow Roland Garros this year. The prediction card for every QF match was eerily accurate and the AI chat filled in all the context.",
    name: 'Sarah L.',
    role: 'Tennis coach · London',
  },
  {
    stars: 4,
    quote: 'Clean interface, fast data. The win-probability bar updating live mid-set is genuinely addictive to watch. Favourite sports app right now.',
    name: 'Filip R.',
    role: 'Sports analyst · Split',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true once the referenced element enters the viewport. */
function useInView(ref, threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function LandingPage({ nav }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <style>{CSS}</style>

      <div className="lp-root">

        {/* ════════════ NAVBAR ════════════════════════════════════════════════ */}
        <nav className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}>
          <Logo size="sm" />

          <div className="lp-nav__links hide-sm">
            {['Features', 'How it Works', 'Community'].map(label => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/ /g, '-')}`}
                className="lp-nav__link"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="lp-nav__actions">
            <Btn variant="ghost"   size="sm" onClick={() => nav('login')}>Sign In</Btn>
            <Btn variant="primary" size="sm" onClick={() => nav('signup')}>Get Started</Btn>
          </div>
        </nav>

        {/* ════════════ HERO ══════════════════════════════════════════════════ */}
        <section className="lp-hero">
          <div className="lp-hero__grid-bg"  aria-hidden="true" />
          <div className="lp-hero__orb lp-hero__orb--lime" aria-hidden="true" />
          <div className="lp-hero__orb lp-hero__orb--clay" aria-hidden="true" />
          <div className="lp-hero__court" aria-hidden="true"><CourtSVG opacity={0.045} /></div>

          <div className="lp-hero__inner">

            {/* Copy */}
            <div className="lp-hero__copy">
              <div className="lp-fade-1">
                <Badge color="var(--lime)">
                  <span className="lp-live-dot" aria-hidden="true" />
                  Live ATP / WTA coverage
                </Badge>
              </div>

              <h1 className="lp-hero__h1 lp-fade-2">
                Predict Every<br />
                <span className="lp-hero__h1-gradient">Match Winner.</span>
              </h1>

              <p className="lp-hero__sub lp-fade-3">
                TennisVantage combines live tour data with AI analysis to deliver
                win probabilities, surface breakdowns and player deep-dives —
                before the first serve.
              </p>

              <div className="lp-hero__cta lp-fade-4">
                <Btn variant="primary" size="lg" onClick={() => nav('signup')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
                  </svg>
                  Start Predicting Free
                </Btn>
                <Btn variant="secondary" size="lg" onClick={() => nav('login')}>Sign In</Btn>
              </div>

              <div className="lp-stats lp-fade-5">
                {STATS.map(s => (
                  <div key={s.label} className="lp-stats__item">
                    <span className="lp-stats__val">{s.val}</span>
                    <span className="lp-stats__label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero card */}
            <div className="lp-hero__card-wrap lp-fade-3 hide-sm">
              <HeroMatchCard />
            </div>
          </div>
        </section>

        {/* ════════════ TOURNAMENT STRIP ══════════════════════════════════════ */}
        <div className="lp-strip">
          <span className="lp-strip__label">Covering</span>
          {['Roland Garros', 'Wimbledon', 'US Open', 'Australian Open', 'ATP Masters', 'WTA Finals'].map(t => (
            <span key={t} className="lp-strip__pill">{t}</span>
          ))}
        </div>

        {/* ════════════ FEATURES ══════════════════════════════════════════════ */}
        <section id="features" className="lp-section">
          <SectionHeader
            tag="Everything you need"
            title={<>Built for serious<br className="hide-sm" /> tennis fans.</>}
            sub="From live scores to AI predictions — every tool you need to watch, understand and predict professional tennis."
          />
          <div className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} delay={i} />
            ))}
          </div>
        </section>

        {/* ════════════ HOW IT WORKS ══════════════════════════════════════════ */}
        <section id="how-it-works" className="lp-section lp-section--alt">
          <SectionHeader
            tag="Simple as a tiebreak"
            title="Up and running in minutes."
            sub="No complex setup. Sign up free and get your first AI prediction in under two minutes."
            centered
          />
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <StepCard key={s.n} step={s} index={i} isLast={i === STEPS.length - 1} />
            ))}
          </div>
        </section>

        {/* ════════════ PREDICTION PREVIEW ════════════════════════════════════ */}
        <section className="lp-section">
          <div className="lp-preview-row">
            <div className="lp-preview-copy">
              <span className="lp-section-tag">// Match prediction</span>
              <h2 className="lp-section-title">Probabilities that actually make sense.</h2>
              <p className="lp-section-sub">
                Every prediction card shows you the <em>why</em> — surface advantage,
                head-to-head record, serve %, fatigue index — not just a number.
              </p>
              <ul className="lp-checklist">
                {[
                  'Confidence level per prediction',
                  'Surface-adjusted win probability',
                  'Top 3 decisive factors highlighted',
                  'Live in-match re-calculation',
                ].map(c => (
                  <li key={c} className="lp-checklist__item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {c}
                  </li>
                ))}
              </ul>
              <Btn variant="primary" size="md" onClick={() => nav('signup')}>Try it free →</Btn>
            </div>
            <div className="lp-preview-card">
              <HeroMatchCard />
            </div>
          </div>
        </section>

        {/* ════════════ TESTIMONIALS ══════════════════════════════════════════ */}
        <section id="community" className="lp-section lp-section--alt">
          <SectionHeader
            tag="Community"
            title="Trusted by tennis fans."
            sub="What players, coaches and analysts are saying."
            centered
          />
          <div className="lp-testim-grid">
            {TESTIMONIALS.map(t => (
              <TestimCard key={t.name} t={t} />
            ))}
          </div>
        </section>

        {/* ════════════ CTA BANNER ════════════════════════════════════════════ */}
        <section className="lp-section">
          <div className="lp-cta-banner">
            <div className="lp-cta-banner__court" aria-hidden="true"><CourtSVG opacity={0.04} /></div>
            <div className="lp-cta-banner__glow"  aria-hidden="true" />
            <span className="lp-section-tag" style={{ display: 'block', marginBottom: '1rem' }}>// Free to start</span>
            <h2 className="lp-cta-banner__title">Your edge starts here.</h2>
            <p className="lp-cta-banner__sub">
              Join thousands of tennis fans using AI-powered predictions to watch smarter,
              understand the game deeper, and never miss a big upset again.
            </p>
            <div className="lp-cta-banner__actions">
              <Btn variant="primary" size="xl" onClick={() => nav('signup')}>Create Free Account →</Btn>
              <Btn variant="ghost"   size="lg" onClick={() => nav('login')}>Already have an account</Btn>
            </div>
          </div>
        </section>

        {/* ════════════ FOOTER ════════════════════════════════════════════════ */}
        <footer className="lp-footer">
          <Logo size="sm" />
          <p className="lp-footer__copy">© {new Date().getFullYear()} TennisVantage · Built for university project</p>
          <div className="lp-footer__links">
            {['Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" className="lp-footer__link">{l}</a>
            ))}
          </div>
        </footer>

      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ tag, title, sub, centered = false }) {
  const ref = useRef(null);
  const vis = useInView(ref);
  return (
    <div
      ref={ref}
      className={[
        'lp-section-header',
        centered && 'lp-section-header--centered',
        vis && 'lp-in-view',
      ].filter(Boolean).join(' ')}
    >
      <span className="lp-section-tag">{tag}</span>
      <h2 className="lp-section-title">{title}</h2>
      <p className="lp-section-sub">{sub}</p>
    </div>
  );
}

function FeatureCard({ feature: f, delay }) {
  const [hov, setHov] = useState(false);
  const ref  = useRef(null);
  const vis  = useInView(ref);
  return (
    <div
      ref={ref}
      className={['lp-feat-card', vis && 'lp-in-view'].filter(Boolean).join(' ')}
      style={{
        '--accent': f.accent,
        '--delay':  `${delay * 0.07}s`,
        ...(hov && {
          borderColor: `${f.accent}35`,
          background:  'var(--bg-card-alt, #161e2e)',
          transform:   'translateY(-5px)',
          boxShadow:   `0 24px 60px rgba(0,0,0,.45), 0 0 30px ${f.accent}12`,
        }),
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className="lp-feat-card__icon"
        style={{
          background:  `${f.accent}15`,
          border:      `1px solid ${f.accent}28`,
          color:        f.accent,
          boxShadow:   hov ? `0 0 22px ${f.accent}22` : 'none',
        }}
      >
        {f.icon}
      </div>
      <h3 className="lp-feat-card__title" style={hov ? { color: f.accent } : {}}>
        {f.title}
      </h3>
      <p className="lp-feat-card__desc">{f.desc}</p>
    </div>
  );
}

function StepCard({ step: s, index, isLast }) {
  const ref = useRef(null);
  const vis = useInView(ref);
  return (
    <div
      ref={ref}
      className={['lp-step', vis && 'lp-in-view'].filter(Boolean).join(' ')}
      style={{ '--delay': `${index * 0.12}s` }}
    >
      <div className="lp-step__num">{s.n}</div>
      {!isLast && <div className="lp-step__connector" aria-hidden="true" />}
      <h3 className="lp-step__title">{s.title}</h3>
      <p className="lp-step__desc">{s.desc}</p>
    </div>
  );
}

function TestimCard({ t }) {
  const ref = useRef(null);
  const vis = useInView(ref);
  return (
    <div
      ref={ref}
      className={['lp-testim', vis && 'lp-in-view'].filter(Boolean).join(' ')}
    >
      <div className="lp-testim__stars">
        {Array.from({ length: 5 }, (_, i) => (
          <svg key={i} width="13" height="13" viewBox="0 0 24 24"
            fill={i < t.stars ? '#9fef66' : '#1e293b'}
            stroke={i < t.stars ? '#9fef66' : '#334155'}
            strokeWidth="1.5"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ))}
      </div>
      <p className="lp-testim__quote">"{t.quote}"</p>
      <div className="lp-testim__author">
        <div className="lp-testim__avatar">
          {t.name.split(' ').map(w => w[0]).join('')}
        </div>
        <div>
          <div className="lp-testim__name">{t.name}</div>
          <div className="lp-testim__role">{t.role}</div>
        </div>
      </div>
    </div>
  );
}

function HeroMatchCard() {
  return (
    <div className="lp-match-card">
      {/* Header */}
      <div className="lp-match-card__header">
        <span className="lp-match-card__event">Roland Garros · QF</span>
        <span className="lp-match-card__live-badge">
          <span className="lp-live-dot" aria-hidden="true" /> LIVE
        </span>
      </div>

      {/* Players */}
      {[
        { name: 'N. Djokovic', flag: '🇷🇸', score: '6-4, 3', rank: 'ATP #2', serving: true  },
        { name: 'C. Alcaraz',  flag: '🇪🇸', score: '2-6, 2', rank: 'ATP #3', serving: false },
      ].map((p, i) => (
        <div key={i} className={`lp-match-card__player${p.serving ? ' lp-match-card__player--serving' : ''}`}>
          <div className="lp-match-card__player-left">
            <span className="lp-match-card__flag">{p.flag}</span>
            <div>
              <span className="lp-match-card__name">{p.name}</span>
              <span className="lp-match-card__rank">{p.rank}</span>
            </div>
            {p.serving && <span className="lp-serve-dot" aria-label="serving" />}
          </div>
          <span className={`lp-match-card__score${p.serving ? ' lp-match-card__score--lime' : ''}`}>
            {p.score}
          </span>
        </div>
      ))}

      {/* Win probability */}
      <div className="lp-match-card__prob-section">
        <div className="lp-match-card__prob-header">
          <span className="lp-match-card__prob-label">Win Probability</span>
          <span className="lp-match-card__prob-confidence">AI · High confidence</span>
        </div>
        <div className="lp-match-card__prob-row">
          <span className="lp-match-card__pct lp-match-card__pct--lime">63%</span>
          <div className="lp-match-card__bar">
            <div className="lp-match-card__bar-fill lp-match-card__bar-fill--lime" style={{ width: '63%' }} />
          </div>
          <span className="lp-match-card__pct lp-match-card__pct--muted">37%</span>
        </div>
      </div>

      {/* Key factors */}
      <div className="lp-match-card__factors">
        <p className="lp-match-card__factors-label">Key Factors</p>
        {['Clay surface advantage', 'H2H: 7–5 Djokovic', 'Serve %: 65 vs 62'].map(f => (
          <div key={f} className="lp-match-card__factor">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{f}</span>
          </div>
        ))}
      </div>

      {/* Stat chips */}
      <div className="lp-match-card__chips">
        {[
          { label: 'Surface', val: 'Clay',          accent: '#f97316' },
          { label: 'Set',     val: '2nd',            accent: '#9fef66' },
          { label: 'Court',   val: 'Ph. Chatrier',   accent: '#60a5fa' },
        ].map(c => (
          <div key={c.label} className="lp-chip" style={{ '--chip-accent': c.accent }}>
            <span className="lp-chip__val">{c.val}</span>
            <span className="lp-chip__label">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── All scoped CSS ────────────────────────────────────────────────────────────
const CSS = `
/* ── Reset ──────────────────────────────────────────────────────────────────── */
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing:border-box; margin:0; padding:0; }
.lp-root a { text-decoration:none; }
.lp-root { min-height:100vh; background:var(--bg); color:var(--text); overflow-x:hidden; }

/* ── Keyframes ──────────────────────────────────────────────────────────────── */
@keyframes lp-fade-up    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
@keyframes lp-live-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes lp-pulse-glow {
  0%,100%{ box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 40px rgba(159,239,102,.07); }
  50%    { box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 60px rgba(159,239,102,.16); }
}
@keyframes lp-orb-drift  {
  0%,100%{ transform:translate(0,0) scale(1); }
  33%    { transform:translate(32px,-22px) scale(1.04); }
  66%    { transform:translate(-22px,16px) scale(.97); }
}

/* ── Scroll-reveal (IntersectionObserver-driven) ────────────────────────────── */
.lp-section-header, .lp-feat-card, .lp-step, .lp-testim {
  opacity:0; transform:translateY(24px);
  transition:opacity .55s ease, transform .55s ease;
  transition-delay:var(--delay, 0s);
}
.lp-in-view { opacity:1 !important; transform:translateY(0) !important; }

/* ── Navbar ─────────────────────────────────────────────────────────────────── */
.lp-nav {
  position:fixed; top:0; left:0; right:0; z-index:100;
  height:68px; display:flex; align-items:center; justify-content:space-between;
  padding:0 clamp(20px,5vw,64px);
  background:transparent; border-bottom:1px solid transparent;
  transition:background .3s ease, border-color .3s ease, backdrop-filter .3s ease;
}
.lp-nav--scrolled {
  background:rgba(7,11,20,.88);
  backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
  border-bottom-color:var(--border, rgba(255,255,255,.07));
}
.lp-nav__links  { display:flex; gap:32px; align-items:center; }
.lp-nav__link   { font-size:14px; font-weight:500; color:var(--text-muted); transition:color .2s; }
.lp-nav__link:hover { color:var(--text); }
.lp-nav__actions{ display:flex; gap:10px; align-items:center; }

/* ── Hero ───────────────────────────────────────────────────────────────────── */
.lp-hero {
  position:relative; min-height:100vh;
  display:flex; align-items:center; justify-content:center;
  padding:clamp(100px,14vh,160px) clamp(20px,5vw,80px) clamp(60px,8vh,100px);
  overflow:hidden;
}
.lp-hero__grid-bg {
  position:absolute; inset:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(159,239,102,.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(159,239,102,.04) 1px, transparent 1px);
  background-size:64px 64px;
}
.lp-hero__court { position:absolute; inset:0; pointer-events:none; }
.lp-hero__orb {
  position:absolute; pointer-events:none; border-radius:50%;
  animation:lp-orb-drift 18s ease-in-out infinite;
}
.lp-hero__orb--lime {
  top:10%; right:-5%;
  width:clamp(300px,45vw,600px); height:clamp(300px,45vw,600px);
  background:radial-gradient(circle, rgba(159,239,102,.11) 0%, transparent 65%);
}
.lp-hero__orb--clay {
  bottom:5%; left:-10%;
  width:clamp(250px,38vw,500px); height:clamp(250px,38vw,500px);
  background:radial-gradient(circle, rgba(249,115,22,.08) 0%, transparent 65%);
  animation-delay:-6s; animation-duration:22s;
}
.lp-hero__inner {
  max-width:1100px; width:100%; margin:0 auto; position:relative;
  display:grid;
  grid-template-columns:clamp(280px,55%,600px) 1fr;
  gap:clamp(40px,6vw,80px);
  align-items:center;
}
.lp-hero__copy { display:flex; flex-direction:column; }
.lp-hero__h1 {
  font-family:var(--font-display,'Syne',sans-serif); font-weight:800;
  font-size:clamp(36px,5.5vw,78px);
  line-height:1.04; letter-spacing:-.03em; color:var(--text);
  margin:20px 0;
}
.lp-hero__h1-gradient {
  background:linear-gradient(135deg,#9fef66 0%,#6bc940 45%,#f97316 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.lp-hero__sub {
  font-size:clamp(15px,1.8vw,18px); color:var(--text-muted);
  line-height:1.72; max-width:500px; margin-bottom:32px;
}
.lp-hero__cta { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:48px; }
.lp-hero__card-wrap { position:relative; display:flex; justify-content:center; }

/* ── Hero stagger animations ────────────────────────────────────────────────── */
.lp-fade-1{ animation:lp-fade-up .55s ease both .05s; }
.lp-fade-2{ animation:lp-fade-up .55s ease both .18s; }
.lp-fade-3{ animation:lp-fade-up .55s ease both .32s; }
.lp-fade-4{ animation:lp-fade-up .55s ease both .46s; }
.lp-fade-5{ animation:lp-fade-up .55s ease both .60s; }

/* ── Stats row ──────────────────────────────────────────────────────────────── */
.lp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; max-width:460px; }
.lp-stats__item { text-align:center; padding:10px 4px; }
.lp-stats__val  {
  display:block;
  font-family:var(--font-display,'Syne',sans-serif); font-weight:800;
  font-size:clamp(16px,2vw,24px); color:var(--lime); letter-spacing:-.02em;
}
.lp-stats__label{ display:block; font-size:11px; color:var(--text-faint); margin-top:3px; }

/* ── Tournament strip ───────────────────────────────────────────────────────── */
.lp-strip {
  display:flex; align-items:center; flex-wrap:wrap; gap:10px;
  padding:18px clamp(20px,5vw,80px);
  border-top:1px solid var(--border,rgba(255,255,255,.06));
  border-bottom:1px solid var(--border,rgba(255,255,255,.06));
  background:rgba(255,255,255,.018);
}
.lp-strip__label{ font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.08em; flex-shrink:0; }
.lp-strip__pill {
  font-size:12px; font-weight:600; color:var(--text-muted);
  background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
  border-radius:999px; padding:4px 12px; transition:border-color .2s, color .2s;
}
.lp-strip__pill:hover { border-color:rgba(159,239,102,.35); color:var(--lime); }

/* ── Sections ───────────────────────────────────────────────────────────────── */
.lp-section {
  padding:clamp(64px,10vh,120px) clamp(20px,5vw,80px);
  max-width:1100px; margin:0 auto;
}
.lp-section--alt {
  max-width:100%;
  background:rgba(255,255,255,.018);
  border-top:1px solid var(--border,rgba(255,255,255,.06));
  border-bottom:1px solid var(--border,rgba(255,255,255,.06));
  padding-left:clamp(20px,5vw,80px); padding-right:clamp(20px,5vw,80px);
}
.lp-section--alt > * { max-width:1100px; margin-left:auto; margin-right:auto; }

.lp-section-header           { margin-bottom:clamp(40px,6vh,72px); }
.lp-section-header--centered { text-align:center; }
.lp-section-header--centered .lp-section-sub { margin:0 auto; }

.lp-section-tag {
  display:inline-block;
  font-family:var(--font-mono,'JetBrains Mono',monospace);
  font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--lime); font-weight:600; margin-bottom:12px;
}
.lp-section-title {
  font-family:var(--font-display,'Syne',sans-serif); font-weight:800;
  font-size:clamp(26px,4vw,50px); letter-spacing:-.025em;
  line-height:1.1; color:var(--text); margin-bottom:16px;
}
.lp-section-sub {
  font-size:clamp(14px,1.7vw,17px); color:var(--text-muted);
  line-height:1.72; max-width:540px;
}

/* ── Features grid ──────────────────────────────────────────────────────────── */
.lp-features-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:18px;
}
.lp-feat-card {
  background:var(--bg-card); border:1px solid var(--border,rgba(255,255,255,.07));
  border-radius:var(--radius,12px); padding:28px;
  transition:background .22s, border-color .22s, transform .22s, box-shadow .22s;
  cursor:default;
}
.lp-feat-card__icon {
  width:46px; height:46px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  margin-bottom:18px; transition:box-shadow .22s;
}
.lp-feat-card__title {
  font-family:var(--font-display,'Syne',sans-serif); font-weight:700;
  font-size:17px; color:var(--text); margin-bottom:10px; transition:color .22s;
}
.lp-feat-card__desc { font-size:14px; color:var(--text-muted); line-height:1.72; }

/* ── How it works ───────────────────────────────────────────────────────────── */
.lp-steps {
  display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
}
.lp-step { position:relative; text-align:center; padding:0 24px 48px; }
.lp-step__num {
  display:inline-flex; align-items:center; justify-content:center;
  width:52px; height:52px; border-radius:50%;
  background:rgba(159,239,102,.1); border:1px solid rgba(159,239,102,.28);
  font-family:var(--font-mono,'JetBrains Mono',monospace);
  font-size:1rem; font-weight:700; color:var(--lime);
  margin-bottom:16px; position:relative; z-index:1;
}
.lp-step__connector {
  position:absolute; top:26px; left:calc(50% + 26px);
  width:calc(100% - 52px); height:1px;
  background:linear-gradient(90deg,rgba(159,239,102,.3),rgba(159,239,102,.04));
}
.lp-step__title {
  font-family:var(--font-display,'Syne',sans-serif); font-weight:700;
  font-size:15px; color:var(--text); margin-bottom:8px;
}
.lp-step__desc { font-size:13.5px; color:var(--text-muted); line-height:1.68; }

/* ── Prediction preview row ─────────────────────────────────────────────────── */
.lp-preview-row {
  display:grid; grid-template-columns:1fr 1fr;
  gap:clamp(40px,6vw,80px); align-items:center;
}
.lp-preview-copy .lp-section-sub { margin-bottom:24px; }
.lp-checklist { list-style:none; display:flex; flex-direction:column; gap:10px; margin-bottom:32px; }
.lp-checklist__item { display:flex; align-items:center; gap:9px; font-size:14px; color:var(--text-muted); }
.lp-preview-card { display:flex; justify-content:center; }

/* ── Testimonials ───────────────────────────────────────────────────────────── */
.lp-testim-grid {
  display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:18px;
}
.lp-testim {
  background:var(--bg-card); border:1px solid var(--border,rgba(255,255,255,.07));
  border-radius:var(--radius,12px); padding:28px;
}
.lp-testim__stars  { display:flex; gap:3px; margin-bottom:14px; }
.lp-testim__quote  {
  font-size:14px; color:var(--text-muted); line-height:1.75;
  font-style:italic; margin-bottom:20px;
}
.lp-testim__author { display:flex; align-items:center; gap:12px; }
.lp-testim__avatar {
  width:38px; height:38px; border-radius:50%; flex-shrink:0;
  background:linear-gradient(135deg,#9fef66,#f97316);
  display:flex; align-items:center; justify-content:center;
  font-weight:700; font-size:12px; color:#070B14;
}
.lp-testim__name { font-family:var(--font-display,'Syne',sans-serif); font-weight:700; font-size:14px; color:var(--text); }
.lp-testim__role { font-size:12px; color:var(--text-faint); margin-top:2px; }

/* ── CTA banner ─────────────────────────────────────────────────────────────── */
.lp-cta-banner {
  position:relative; overflow:hidden; text-align:center;
  background:linear-gradient(135deg,rgba(159,239,102,.08) 0%,rgba(249,115,22,.05) 100%);
  border:1px solid rgba(159,239,102,.18);
  border-radius:var(--radius-xl,20px);
  padding:clamp(40px,6vw,80px);
}
.lp-cta-banner__court { position:absolute; inset:0; pointer-events:none; }
.lp-cta-banner__glow  {
  position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(159,239,102,.07),transparent 70%);
}
.lp-cta-banner__title {
  font-family:var(--font-display,'Syne',sans-serif); font-weight:800;
  font-size:clamp(26px,4.5vw,52px); letter-spacing:-.025em;
  color:var(--text); margin-bottom:18px; position:relative;
}
.lp-cta-banner__sub {
  font-size:clamp(14px,1.8vw,17px); color:var(--text-muted);
  max-width:500px; margin:0 auto 36px; line-height:1.72; position:relative;
}
.lp-cta-banner__actions {
  display:flex; justify-content:center; gap:14px; flex-wrap:wrap; position:relative;
}

/* ── Footer ─────────────────────────────────────────────────────────────────── */
.lp-footer {
  padding:clamp(28px,4vh,52px) clamp(20px,5vw,80px);
  border-top:1px solid var(--border,rgba(255,255,255,.06));
  display:flex; justify-content:space-between; align-items:center;
  flex-wrap:wrap; gap:16px;
}
.lp-footer__copy  { font-size:13px; color:var(--text-faint); }
.lp-footer__links { display:flex; gap:20px; }
.lp-footer__link  { font-size:13px; color:var(--text-faint); transition:color .2s; }
.lp-footer__link:hover { color:var(--lime); }

/* ── Match card ─────────────────────────────────────────────────────────────── */
.lp-match-card {
  background:var(--bg-card); border:1px solid var(--border-md,rgba(255,255,255,.1));
  border-radius:var(--radius-lg,16px); padding:26px;
  width:100%; max-width:360px;
  animation:lp-pulse-glow 4s ease infinite;
}
.lp-match-card__header {
  display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
}
.lp-match-card__event { font-size:12px; color:var(--text-faint); font-weight:500; }
.lp-match-card__live-badge {
  display:flex; align-items:center; gap:6px;
  font-size:11px; font-weight:700; color:#4ade80;
  background:rgba(74,222,128,.1); border:1px solid rgba(74,222,128,.25);
  padding:3px 10px; border-radius:999px;
}
.lp-match-card__player {
  display:flex; justify-content:space-between; align-items:center;
  padding:12px 14px; margin-bottom:8px;
  background:rgba(255,255,255,.02); border:1px solid var(--border,rgba(255,255,255,.07));
  border-radius:var(--radius-sm,8px); transition:background .2s, border-color .2s;
}
.lp-match-card__player--serving {
  background:rgba(159,239,102,.06); border-color:rgba(159,239,102,.22);
}
.lp-match-card__player-left { display:flex; align-items:center; gap:10px; }
.lp-match-card__flag { font-size:18px; }
.lp-match-card__name { display:block; font-weight:600; font-size:14px; color:var(--text); }
.lp-match-card__rank { display:block; font-size:11px; color:var(--text-faint); margin-top:1px; }
.lp-match-card__score {
  font-family:var(--font-mono,'JetBrains Mono',monospace);
  font-weight:600; font-size:14px; color:var(--text-muted);
}
.lp-match-card__score--lime { color:var(--lime); }
.lp-match-card__prob-section { margin-top:18px; }
.lp-match-card__prob-header  { display:flex; justify-content:space-between; margin-bottom:8px; }
.lp-match-card__prob-label   {
  font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.06em;
}
.lp-match-card__prob-confidence { font-size:11px; color:var(--lime); font-weight:600; }
.lp-match-card__prob-row { display:flex; gap:8px; align-items:center; }
.lp-match-card__pct {
  font-family:var(--font-mono,'JetBrains Mono',monospace);
  font-size:13px; font-weight:700; width:36px; flex-shrink:0;
}
.lp-match-card__pct--lime  { color:var(--lime); }
.lp-match-card__pct--muted { color:var(--text-muted); text-align:right; }
.lp-match-card__bar {
  flex:1; height:8px; background:rgba(255,255,255,.08); border-radius:99px; overflow:hidden;
}
.lp-match-card__bar-fill { height:100%; border-radius:99px; }
.lp-match-card__bar-fill--lime {
  background:linear-gradient(90deg,#9fef66,#6bc940);
  box-shadow:0 0 12px rgba(159,239,102,.45);
}
.lp-match-card__factors { margin-top:18px; padding-top:16px; border-top:1px solid var(--border,rgba(255,255,255,.07)); }
.lp-match-card__factors-label {
  font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px;
}
.lp-match-card__factor { display:flex; align-items:center; gap:7px; margin-bottom:6px; font-size:12.5px; color:var(--text-muted); }
.lp-match-card__chips  { display:flex; gap:8px; margin-top:16px; flex-wrap:wrap; }

.lp-chip {
  flex:1; min-width:80px; text-align:center;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
  border-radius:8px; padding:8px 10px; transition:border-color .2s;
}
.lp-chip__val   { display:block; font-family:var(--font-mono,'JetBrains Mono',monospace); font-size:13px; font-weight:700; color:var(--chip-accent); }
.lp-chip__label { display:block; font-size:10px; color:var(--text-faint); margin-top:2px; }

/* ── Utility dots ───────────────────────────────────────────────────────────── */
.lp-live-dot {
  display:inline-block; width:6px; height:6px; border-radius:50%;
  background:var(--lime); animation:lp-live-blink 1.3s ease-in-out infinite; flex-shrink:0;
}
.lp-serve-dot {
  display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--lime);
}

/* ── Responsive ─────────────────────────────────────────────────────────────── */
@media (max-width:860px) {
  .lp-hero__inner  { grid-template-columns:1fr; }
  .lp-preview-row  { grid-template-columns:1fr; }
  .lp-preview-card { order:-1; }
  .lp-steps        { grid-template-columns:1fr 1fr; }
  .lp-step__connector { display:none; }
  .lp-stats { grid-template-columns:repeat(2,1fr); max-width:none; }
}
@media (max-width:540px) {
  .lp-steps      { grid-template-columns:1fr; }
  .lp-footer     { flex-direction:column; align-items:flex-start; gap:12px; }
  .lp-hero__cta  { flex-direction:column; }
  .lp-cta-banner__actions { flex-direction:column; align-items:center; }
  .hide-sm       { display:none !important; }
}
`;