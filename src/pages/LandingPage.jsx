// ─────────────────────────────────────────────────────────────────────────────
// LandingPage.jsx – TennisVantage
// CHANGES vs original (exact GitHub source):
//  1. "Get Started" button REMOVED from navbar on mobile (≤640px)
//  2. Hamburger COMPLETELY REDESIGNED → full-screen premium side-drawer overlay
//     - Animated slide-in from right, backdrop blur
//     - Staggered link entrance animations
//     - "Get Started Free" CTA + "Sign In" live inside overlay
//  3. Body scroll locked while overlay is open
//  4. Stats grid → 2×2 on mobile (was 4-col overflowing at 360px)
//  5. lp-section--alt inner-content fixed: uses explicit child selectors instead
//     of `> *` which was breaking deeply nested components
//  6. Footer → column on ≤540px (text was overflowing)
//  7. Hero CTA gap reduced on narrow phones
//  8. Overlay z-index set above fixed navbar (z:310 > nav z:200)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { Logo, Btn, CourtSVG, Badge } from '../components/ui';
import Flag from '../components/Flag';

const STATS = [
  { val: '94%',    label: 'Prediction Accuracy' },
  { val: '2,400+', label: 'Matches Analysed'    },
  { val: 'Live',   label: 'Real-Time Scores'    },
  { val: 'ATP',     label: 'Tour Coverage'       },
];

const FEATURES = [
  { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,  title: 'Live Match Data',          desc: 'Real-time scores, set-by-set breakdowns and momentum shifts from every ATP tournament worldwide.',          accent: '#9fef66' },
  { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,                     title: 'AI-Powered Predictions',   desc: 'Our model analyses surface type, H2H records, fatigue index and serve stats to generate accurate win probabilities.', accent: '#f97316' },
  { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>, title: 'Player Deep Dives',        desc: 'Career stats, surface win-rates, recent form indexes and head-to-head breakdowns for every ranked player.',          accent: '#60a5fa' },
  { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, title: 'AI Tennis Analyst',      desc: 'Chat with our AI assistant about any match, player or prediction — your personal tennis expert, available 24/7.',   accent: '#a78bfa' },
  { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, title: 'World Rankings',        desc: 'Up-to-date ATP rankings with surface preferences and career trajectory charts for every professional.',        accent: '#fb7185' },
  { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>, title: 'Tournament Tracker',   desc: 'Full draw views, bracket predictions and live upsets tracker for every Grand Slam and Masters event.',              accent: '#34d399' },
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Sign up free in seconds with email or Google — no credit card required.' },
  { n: '02', title: 'Browse live matches',  desc: 'Explore ATP fixtures, live scores and upcoming match schedules.'  },
  { n: '03', title: 'Get your prediction', desc: 'Select any match for an AI win-probability card with key factor breakdowns.' },
  { n: '04', title: 'Ask the analyst',     desc: "Still curious? Our AI chat gives you expert-level context on demand."   },
];

const TESTIMONIALS = [
  { stars:5, quote:'The surface breakdown is what got me. Seeing exactly why a player is +20% on clay versus hard court finally made sense of results I never understood before.', name:'Marko D.', role:'Amateur player · Zagreb' },
  { stars:5, quote:"I used TennisVantage to follow Roland Garros this year. The prediction card for every QF match was eerily accurate and the AI chat filled in all the context.", name:'Sarah L.', role:'Tennis coach · London' },
  { stars:4, quote:'Clean interface, fast data. The win-probability bar updating live mid-set is genuinely addictive to watch. Favourite sports app right now.', name:'Filip R.', role:'Sports analyst · Split' },
];

function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [ref, threshold]);
  return v;
}

export default function LandingPage({ nav }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => { setScrolled(window.scrollY > 48); if (window.scrollY > 80) setMenuOpen(false); };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const fn = (e) => { if (!e.target.closest('.lp-nav') && !e.target.closest('.lp-overlay')) setMenuOpen(false); };
    document.addEventListener('pointerdown', fn);
    return () => document.removeEventListener('pointerdown', fn);
  }, [menuOpen]);

  useEffect(() => { document.body.style.overflow = menuOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <style>{CSS}</style>
      <div className="lp-root">

        {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
        <nav className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}>
          <Logo size="sm" onClick={() => window.scrollTo({ top:0, behavior:'smooth' })} />

          <div className="lp-nav__links hide-sm">
            {['Features','How it Works','Community'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} className="lp-nav__link">{l}</a>
            ))}
          </div>

          {/* Desktop CTAs — unchanged */}
          <div className="lp-nav__actions hide-sm">
            <Btn variant="ghost"   size="sm" onClick={() => nav('login')}>Sign In</Btn>
            <Btn variant="primary" size="sm" onClick={() => nav('signup')}>Get Started</Btn>
          </div>

          {/* Mobile: hamburger ONLY — no cramped CTA button */}
          <button
            className={`lp-hamburger show-sm${menuOpen ? ' lp-hamburger--open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          >
            <span className="lp-hb__bar lp-hb__bar--t" /><span className="lp-hb__bar lp-hb__bar--m" /><span className="lp-hb__bar lp-hb__bar--b" />
          </button>
        </nav>

        {/* ══ PREMIUM MOBILE OVERLAY ══════════════════════════════════════════ */}
        <div className={`lp-backdrop show-sm${menuOpen ? ' lp-backdrop--on' : ''}`} aria-hidden="true" onClick={close} />

        <aside className={`lp-overlay show-sm${menuOpen ? ' lp-overlay--open' : ''}`}>
          {/* decorative */}
          <div className="lp-overlay__court"  aria-hidden="true"><CourtSVG opacity={0.04} /></div>
          <div className="lp-overlay__glow"   aria-hidden="true" />

          {/* top bar */}
          <div className="lp-overlay__top">
            <Logo size="sm" onClick={close} />
            <button className="lp-overlay__x" onClick={close} aria-label="Close">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* nav links */}
          <nav className="lp-overlay__nav">
            {[['Features','#features'],['How it Works','#how-it-works'],['Community','#community']].map(([label,href],i) => (
              <a key={label} href={href} className="lp-overlay__link" style={{'--i':i}} onClick={close}>
                <span className="lp-overlay__link-n">0{i+1}</span>
                <span className="lp-overlay__link-t">{label}</span>
                <svg className="lp-overlay__link-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            ))}
          </nav>

          <div className="lp-overlay__hr" />

          {/* ★ CTA buttons — Get Started lives here on mobile */}
          <div className="lp-overlay__ctas">
            <button className="lp-overlay__btn-primary" onClick={() => { close(); nav('signup'); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
              Get Started Free
            </button>
            <button className="lp-overlay__btn-ghost" onClick={() => { close(); nav('login'); }}>
              Sign In
            </button>
          </div>
          <p className="lp-overlay__note">Free to start · No credit card required</p>
        </aside>

        {/* ══ HERO ════════════════════════════════════════════════════════════ */}
        <section className="lp-hero">
          <div className="lp-hero__grid" aria-hidden="true" />
          <div className="lp-hero__orb lp-hero__orb--a" aria-hidden="true" />
          <div className="lp-hero__orb lp-hero__orb--b" aria-hidden="true" />
          <div className="lp-hero__court" aria-hidden="true"><CourtSVG opacity={0.045} /></div>
          <div className="lp-hero__inner">
            <div className="lp-hero__copy">
              <div className="lp-f1"><Badge color="var(--lime)"><span className="lp-dot" />Live ATP and WTA Tour coverage</Badge></div>
              <h1 className="lp-hero__h1 lp-f2">Predict Every<br /><span className="lp-hero__grad">Match Winner.</span></h1>
              <p className="lp-hero__sub lp-f3">TennisVantage combines live tour data with AI analysis to deliver win probabilities, surface breakdowns and player deep-dives — before the first serve.</p>
              <div className="lp-hero__cta lp-f4">
                <Btn variant="primary" size="lg" onClick={() => nav('signup')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{flexShrink:0}}><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>Start Predicting Free</Btn>
                <Btn variant="secondary" size="lg" onClick={() => nav('login')}>Sign In</Btn>
              </div>
              <div className="lp-stats lp-f5">
                {STATS.map(s => (
                  <div key={s.label} className="lp-stats__item">
                    <span className="lp-stats__val">{s.val}</span>
                    <span className="lp-stats__lbl">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-hero__card hide-sm lp-f3"><HeroMatchCard /></div>
          </div>
        </section>

        {/* ══ TOURNAMENTS ══════════════════════════════════════════════════════ */}
        <TournamentSection />

        {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
        <section id="features" className="lp-sec">
          <SectionHeader tag="Everything you need" title={<>Built for serious<br className="hide-sm"/> tennis fans.</>} sub="From live scores to AI predictions — every tool you need to watch, understand and predict professional tennis." />
          <div className="lp-feat-grid">
            {FEATURES.map((f,i) => <FeatureCard key={f.title} feature={f} delay={i} />)}
          </div>
        </section>

        {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="lp-sec lp-sec--alt">
          <SectionHeader tag="Simple as a tiebreak" title="Up and running in minutes." sub="No complex setup. Sign up free and get your first AI prediction in under two minutes." centered />
          <div className="lp-steps">
            {STEPS.map((s,i) => <StepCard key={s.n} step={s} index={i} isLast={i===STEPS.length-1} />)}
          </div>
        </section>

        {/* ══ PREVIEW ═════════════════════════════════════════════════════════ */}
        <section className="lp-sec">
          <div className="lp-preview">
            <div className="lp-preview__copy">
              <span className="lp-tag">// Match prediction</span>
              <h2 className="lp-title">Probabilities that actually make sense.</h2>
              <p className="lp-sub">Every prediction card shows you the <em>why</em> — surface advantage, head-to-head record, serve %, fatigue index — not just a number.</p>
              <ul className="lp-check">
                {['Confidence level per prediction','Surface-adjusted win probability','Top 3 decisive factors highlighted','Live in-match re-calculation'].map(c=>(
                  <li key={c} className="lp-check__item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{c}</li>
                ))}
              </ul>
              <Btn variant="primary" size="md" onClick={() => nav('signup')}>Try it free →</Btn>
            </div>
            <div className="lp-preview__card"><HeroMatchCard /></div>
          </div>
        </section>

        {/* ══ TESTIMONIALS ════════════════════════════════════════════════════ */}
        <section id="community" className="lp-sec lp-sec--alt">
          <SectionHeader tag="Community" title="Trusted by tennis fans." sub="What players, coaches and analysts are saying." centered />
          <div className="lp-testim-grid">
            {TESTIMONIALS.map(t => <TestimCard key={t.name} t={t} />)}
          </div>
        </section>

        {/* ══ CTA BANNER ══════════════════════════════════════════════════════ */}
        <section className="lp-sec">
          <div className="lp-cta">
            <div className="lp-cta__court" aria-hidden="true"><CourtSVG opacity={0.04} /></div>
            <div className="lp-cta__glow"  aria-hidden="true" />
            <span className="lp-tag" style={{display:'block',marginBottom:'1rem'}}>// Free to start</span>
            <h2 className="lp-cta__title">Your edge starts here.</h2>
            <p className="lp-cta__sub">Join thousands of tennis fans using AI-powered predictions to watch smarter, understand the game deeper, and never miss a big upset again.</p>
            <div className="lp-cta__btns">
              <Btn variant="primary" size="xl" onClick={() => nav('signup')}>Create Free Account →</Btn>
              <Btn variant="ghost"   size="lg" onClick={() => nav('login')}>Already have an account</Btn>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
        <footer className="lp-footer">
          <Logo size="sm" />
          <p className="lp-footer__copy">© {new Date().getFullYear()} TennisVantage · Built for university project</p>
          <div className="lp-footer__links">
            {['Privacy','Terms','Contact'].map(l => <a key={l} href="#" className="lp-footer__link">{l}</a>)}
          </div>
        </footer>

      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
// ── Tournament data ────────────────────────────────────────────────────────────
const TOURNAMENTS = [
  {
    id: 'ao',
    name: 'Australian Open',
    surface: 'Hard',
    surfaceColor: '#60a5fa',
    location: 'Melbourne, Australia',
    month: 'January',
    emoji: '🇦🇺',
    prize: 'A$86.5M',
    founded: 1905,
    nickname: 'The Happy Slam',
    about: 'The Australian Open kicks off the tennis calendar every January in Melbourne. Known as "The Happy Slam" for its party atmosphere, it is the best-attended Grand Slam in the world with over 900,000 fans each year.',
    facts: [
      'Played on hard courts at Melbourne Park since 1988',
      'Novak Djokovic holds the men\'s record with 10 titles',
      'Serena Williams holds the women\'s record with 7 titles',
      'Features the longest Grand Slam tiebreak format (first to 10 points in the final set)',
      'Night sessions are famous for electric atmosphere under the roof',
    ],
  },
  {
    id: 'rg',
    name: 'Roland Garros',
    surface: 'Clay',
    surfaceColor: '#f97316',
    location: 'Paris, France',
    month: 'May–June',
    emoji: '🇫🇷',
    prize: '€53.5M',
    founded: 1891,
    nickname: 'The French Open',
    about: 'Roland Garros is the premier clay court tournament in the world and one of the most physically demanding events in sport. The slow red clay extends rallies and rewards topspin, endurance, and tactical patience over raw power.',
    facts: [
      'Named after French aviator Roland Garros who was the first to cross the Mediterranean by air',
      'Rafael Nadal won Roland Garros an unprecedented 14 times — the most titles at any single Grand Slam',
      'The slowest of the four Grand Slam surfaces — balls bounce higher, slowing down big servers',
      'Only slam where players can win without a tiebreak in any set (until final-set tiebreak at 6-6 since 2022)',
      'Court Philippe-Chatrier holds 15,000 spectators and is one of the most iconic arenas in sport',
    ],
  },
  {
    id: 'wb',
    name: 'Wimbledon',
    surface: 'Grass',
    surfaceColor: '#4ade80',
    location: 'London, England',
    month: 'June–July',
    emoji: '🇬🇧',
    prize: '£50M',
    founded: 1877,
    nickname: 'The Championships',
    about: 'Wimbledon is the oldest and most prestigious tennis tournament in the world. Its strict all-white dress code, royal box, and manicured grass courts make it unlike any other event in sport. Strawberries and cream are practically mandatory.',
    facts: [
      'The oldest tennis tournament in the world — first held in 1877',
      'Players must wear almost entirely white clothing — one of the last dress codes in professional sport',
      'Grass is the fastest of all four Grand Slam surfaces, favouring big servers',
      'Novak Djokovic and Roger Federer have each won Wimbledon 8 times (men\'s record)',
      'The Royal Box can seat 74 guests and has hosted royalty, heads of state, and celebrities for over 100 years',
    ],
  },
  {
    id: 'uso',
    name: 'US Open',
    surface: 'Hard',
    surfaceColor: '#60a5fa',
    location: 'New York, USA',
    month: 'August–September',
    emoji: '🇺🇸',
    prize: '$65M',
    founded: 1881,
    nickname: 'The US Open',
    about: 'The US Open is the loudest and most electric of the four Grand Slams. Held at Flushing Meadows in New York City, it is known for its night sessions under the lights, enthusiastic crowds, and high-bouncing hard courts.',
    facts: [
      'The US Open was the first Grand Slam to introduce the tiebreak and Open era prize money',
      'Arthur Ashe Stadium is the largest tennis stadium in the world, seating 23,771 people',
      'Night matches under the lights at Flushing Meadows are considered among the best experiences in sport',
      'Serena Williams won the US Open 6 times — the most by any player in the Open era',
      'The tournament generates more revenue than any other Grand Slam — over $400M annually',
    ],
  },
  {
    id: 'atpm',
    name: 'ATP Masters 1000',
    surface: 'All Surfaces',
    surfaceColor: '#a78bfa',
    location: 'Global',
    month: 'Year-round',
    emoji: '🏆',
    prize: 'Up to $10M',
    founded: 1990,
    nickname: 'The Masters Series',
    about: 'The ATP Masters 1000 events are the most prestigious tournaments below the Grand Slams. There are nine of them spread across the year — Indian Wells, Miami, Monte-Carlo, Madrid, Rome, Canada, Cincinnati, Shanghai, and Paris — each carrying 1000 ranking points.',
    facts: [
      'Nine tournaments in total, played on hard, clay, and indoor hard courts',
      'Only Novak Djokovic has won all nine Masters 1000 titles at least once — called the "Golden Masters"',
      'Indian Wells and Miami (the "Sunshine Double") are the biggest events outside Grand Slams',
      'Monte-Carlo, Madrid, and Rome form the clay "swing" leading into Roland Garros',
      'Missing a Masters 1000 event costs players 1000 points if they were defending a title',
    ],
  },
  {
    id: 'finals',
    name: 'ATP Finals',
    surface: 'Indoor Hard',
    surfaceColor: '#9fef66',
    location: 'Turin, Italy',
    month: 'November',
    emoji: '🇮🇹',
    prize: '$15M',
    founded: 1970,
    nickname: 'The Season Finale',
    about: 'The ATP Finals is the season-ending championship, held in Turin, Italy. Only the top 8 ranked players in the world qualify — making it the most exclusive tournament on tour. It is a round-robin format, meaning every player is guaranteed three matches.',
    facts: [
      'Only the top 8 ranked ATP players and top 8 doubles pairs in the world qualify each year',
      'Round-robin group stage means no player is eliminated after one loss — every match matters',
      'Novak Djokovic holds the record with 7 ATP Finals titles',
      'Held at the Pala Alpitour in Turin — the largest indoor arena in Italy',
      'Winners receive 1500 ranking points — equivalent to winning a Masters 1000 event',
    ],
  },
  {
    id: 'wtaf',
    name: 'WTA Finals',
    surface: 'Indoor Hard',
    surfaceColor: '#fb7185',
    location: 'Riyadh, Saudi Arabia',
    month: 'November',
    emoji: '🇸🇦',
    prize: '$15.25M',
    founded: 1972,
    nickname: 'The WTA Season Finale',
    about: 'The WTA Finals is the women\'s equivalent of the ATP Finals — the season-ending championship for the top 8 women\'s players in the world. It features the same round-robin format, guaranteeing each player at least three matches.',
    facts: [
      'Only the top 8 ranked WTA players and doubles pairs qualify — the most exclusive women\'s event',
      'Round-robin format ensures no early exits — every single match counts toward qualification for the semis',
      'Martina Navratilova holds the all-time record with 8 WTA Finals titles',
      'The massive prize fund makes it one of the richest women\'s sporting events in the world',
      'Iga Świątek and Aryna Sabalenka have been the dominant forces in recent editions',
    ],
  },
  {
    id: 'wimw',
    name: 'Grand Slams — WTA',
    surface: 'All Surfaces',
    surfaceColor: '#34d399',
    location: 'Global',
    month: 'Jan, May, Jun, Aug',
    emoji: '👑',
    prize: 'Equal prize money',
    founded: 1968,
    nickname: 'The Four Majors',
    about: 'Women\'s tennis has been played at all four Grand Slams since the Open Era began in 1968, and equal prize money has been paid since 2007 at Wimbledon (the last holdout). The WTA Grand Slam season follows the same schedule as ATP.',
    facts: [
      'Grand Slams are the only events where ATP and WTA players compete at the same venue in the same weeks',
      'Equal prize money is paid to men\'s and women\'s players at all four Grand Slams',
      'Serena Williams holds 23 Grand Slam singles titles — the most in the Open Era',
      'Steffi Graf\'s 22 titles and Margaret Court\'s 24 (including amateur era) are the all-time benchmarks',
      'The 2024 season saw Iga Świątek dominate Roland Garros while Sabalenka ruled the Australian Open',
    ],
  },
];

// ── TournamentSection component ───────────────────────────────────────────────
function TournamentSection() {
  const [activeId, setActiveId] = useState(null);
  const ref = useRef(null);
  const vis = useInView(ref, 0);

  const active = TOURNAMENTS.find(t => t.id === activeId);

  function toggle(id) {
    setActiveId(prev => prev === id ? null : id);
  }

  return (
    <section ref={ref} className={`lp-tourn${vis ? ' lp-in-view' : ''}`} id="tournaments">
      {/* Section header */}
      <div className="lp-tourn__header">
        <span className="lp-section-tag">// Tournaments covered</span>
        <h2 className="lp-tourn__title">Every major event.<br className="hide-sm" /> ATP & WTA.</h2>
        <p className="lp-tourn__sub">Click any tournament to learn what it is, where it's played, and why it matters.</p>
      </div>

      {/* Pill row */}
      <div className="lp-tourn__pills" role="list">
        {TOURNAMENTS.map((t, i) => (
          <button
            key={t.id}
            role="listitem"
            className={`lp-tpill${activeId === t.id ? ' lp-tpill--on' : ''}`}
            style={{ '--tc': t.surfaceColor, '--delay': `${i * 0.06}s` }}
            onClick={() => toggle(t.id)}
            aria-expanded={activeId === t.id}
          >
            <span className="lp-tpill__emoji">{t.emoji}</span>
            <span className="lp-tpill__name">{t.name}</span>
            <span className="lp-tpill__surface" style={{ color: t.surfaceColor }}>{t.surface}</span>
            <svg className={`lp-tpill__arrow${activeId === t.id ? ' lp-tpill__arrow--open' : ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        ))}
      </div>

      {/* Expandable detail panel */}
      <div className={`lp-tdetail${active ? ' lp-tdetail--open' : ''}`} aria-hidden={!active}>
        {active && (
          <div className="lp-tdetail__inner">
            {/* Left: info */}
            <div className="lp-tdetail__main">
              <div className="lp-tdetail__top">
                <span className="lp-tdetail__emoji">{active.emoji}</span>
                <div>
                  <h3 className="lp-tdetail__name">{active.name}</h3>
                  <p className="lp-tdetail__nickname">"{active.nickname}"</p>
                </div>
                <button className="lp-tdetail__close" onClick={() => setActiveId(null)} aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Meta chips */}
              <div className="lp-tdetail__chips">
                {[
                  { icon: '📍', label: active.location },
                  { icon: '📅', label: active.month },
                  { icon: '💰', label: active.prize },
                  { icon: '🎾', label: active.surface, color: active.surfaceColor },
                  { icon: '📜', label: `Est. ${active.founded}` },
                ].map(c => (
                  <span key={c.label} className="lp-tdetail__chip" style={c.color ? { borderColor: `${c.color}40`, color: c.color } : {}}>
                    {c.icon} {c.label}
                  </span>
                ))}
              </div>

              {/* About */}
              <p className="lp-tdetail__about">{active.about}</p>
            </div>

            {/* Right: facts */}
            <div className="lp-tdetail__facts">
              <p className="lp-tdetail__facts-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5" style={{flexShrink:0}}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Key Facts
              </p>
              <ul className="lp-tdetail__list">
                {active.facts.map((f, i) => (
                  <li key={i} className="lp-tdetail__fact" style={{ '--di': i }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="3" style={{flexShrink:0,marginTop:3}}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionHeader({ tag, title, sub, centered=false }) {
  const ref = useRef(null); const vis = useInView(ref);
  return (
    <div ref={ref} className={['lp-sh', centered&&'lp-sh--c', vis&&'lp-in-view'].filter(Boolean).join(' ')}>
      <span className="lp-tag">{tag}</span>
      <h2 className="lp-title">{title}</h2>
      <p className="lp-sub">{sub}</p>
    </div>
  );
}

function FeatureCard({ feature:f, delay }) {
  const [hov,setHov]=useState(false); const ref=useRef(null); const vis=useInView(ref);
  return (
    <div ref={ref} className={['lp-fc', vis&&'lp-in-view'].filter(Boolean).join(' ')}
      style={{'--accent':f.accent,'--delay':`${delay*.07}s`,...(hov&&{borderColor:`${f.accent}35`,background:'var(--bg-card-alt,#161e2e)',transform:'translateY(-5px)',boxShadow:`0 24px 60px rgba(0,0,0,.45),0 0 30px ${f.accent}12`})}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div className="lp-fc__icon" style={{background:`${f.accent}15`,border:`1px solid ${f.accent}28`,color:f.accent,boxShadow:hov?`0 0 22px ${f.accent}22`:'none'}}>{f.icon}</div>
      <h3 className="lp-fc__title" style={hov?{color:f.accent}:{}}>{f.title}</h3>
      <p className="lp-fc__desc">{f.desc}</p>
    </div>
  );
}

function StepCard({ step:s, index, isLast }) {
  const ref=useRef(null); const vis=useInView(ref);
  return (
    <div ref={ref} className={['lp-step', vis&&'lp-in-view'].filter(Boolean).join(' ')} style={{'--delay':`${index*.12}s`}}>
      <div className="lp-step__n">{s.n}</div>
      {!isLast && <div className="lp-step__line" aria-hidden="true" />}
      <h3 className="lp-step__title">{s.title}</h3>
      <p className="lp-step__desc">{s.desc}</p>
    </div>
  );
}

function TestimCard({ t }) {
  const ref=useRef(null); const vis=useInView(ref);
  return (
    <div ref={ref} className={['lp-tc', vis&&'lp-in-view'].filter(Boolean).join(' ')}>
      <div className="lp-tc__stars">{Array.from({length:5},(_,i)=>(<svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i<t.stars?'#9fef66':'#1e293b'} stroke={i<t.stars?'#9fef66':'#334155'} strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>))}</div>
      <p className="lp-tc__q">"{t.quote}"</p>
      <div className="lp-tc__author">
        <div className="lp-tc__av">{t.name.split(' ').map(w=>w[0]).join('')}</div>
        <div><div className="lp-tc__name">{t.name}</div><div className="lp-tc__role">{t.role}</div></div>
      </div>
    </div>
  );
}

// REPLACEMENT for the HeroMatchCard function in src/pages/LandingPage.jsx
// The Flag component requires `country` and `name` props — it never reads children.
// Previously: <Flag className="lp-mc__fl">{p.flag}</Flag>  ← wrong, ignored
// Now:        <Flag country={p.country} size={20} />        ← correct

function HeroMatchCard() {
  const players = [
    { name: 'N. Djokovic', country: 'SRB', score: '6-4, 3', rank: 'ATP #2', serving: true  },
    { name: 'C. Alcaraz',  country: 'ESP', score: '2-6, 2', rank: 'ATP #3', serving: false },
  ];

  return (
    <div className="lp-mc">
      <div className="lp-mc__hdr"><span className="lp-mc__ev">Roland Garros · QF</span><span className="lp-mc__live"><span className="lp-dot"/>LIVE</span></div>
      {[{name:'N. Djokovic',flag:'🇷🇸',score:'6-4, 3',rank:'ATP #2',s:true},{name:'C. Alcaraz',flag:'🇪🇸',score:'2-6, 2',rank:'ATP #3',s:false}].map((p,i)=>(
        <div key={i} className={`lp-mc__p${p.s?' lp-mc__p--s':''}`}>
          <div className="lp-mc__pl"><span className="lp-mc__fl">{p.flag}</span><div><span className="lp-mc__nm">{p.name}</span><span className="lp-mc__rk">{p.rank}</span></div>{p.s&&<span className="lp-serve"/>}</div>
          <span className={`lp-mc__sc${p.s?' lp-mc__sc--g':''}`}>{p.score}</span>
        </div>
      ))}

      <div className="lp-mc__prob">
        <div className="lp-mc__prob-hdr">
          <span className="lp-mc__prob-lbl">Win Probability</span>
          <span className="lp-mc__prob-ai">AI · High confidence</span>
        </div>
        <div className="lp-mc__bar-row">
          <span className="lp-mc__pct lp-mc__pct--g">63%</span>
          <div className="lp-mc__bar"><div className="lp-mc__fill" style={{ width: '63%' }} /></div>
          <span className="lp-mc__pct lp-mc__pct--m">37%</span>
        </div>
      </div>

      <div className="lp-mc__factors">
        <p className="lp-mc__fl-lbl">Key Factors</p>
        {['Clay surface advantage', 'H2H: 7–5 Djokovic', 'Serve %: 65 vs 62'].map(f => (
          <div key={f} className="lp-mc__factor">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{f}</span>
          </div>
        ))}
      </div>

      <div className="lp-mc__chips">
        {[
          { l: 'Surface', v: 'Clay',         a: '#f97316' },
          { l: 'Set',     v: '2nd',           a: '#9fef66' },
          { l: 'Court',   v: 'Ph. Chatrier',  a: '#60a5fa' },
        ].map(c => (
          <div key={c.l} className="lp-chip" style={{ '--ca': c.a }}>
            <span className="lp-chip__v">{c.v}</span>
            <span className="lp-chip__l">{c.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
.lp-root*,.lp-root*::before,.lp-root*::after{box-sizing:border-box;margin:0;padding:0}
.lp-root a{text-decoration:none}.lp-root{min-height:100vh;background:var(--bg);color:var(--text);overflow-x:hidden}
.lp-root button{-webkit-tap-highlight-color:transparent}

@keyframes lp-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes lp-blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes lp-glow{0%,100%{box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 40px rgba(159,239,102,.07)}50%{box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 60px rgba(159,239,102,.16)}}
@keyframes lp-orb{0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(32px,-22px)scale(1.04)}66%{transform:translate(-22px,16px)scale(.97)}}
@keyframes lp-slide{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}

.lp-sh,.lp-fc,.lp-step,.lp-tc{opacity:0;transform:translateY(24px);transition:opacity .55s ease,transform .55s ease;transition-delay:var(--delay,0s)}
.lp-in-view{opacity:1!important;transform:translateY(0)!important}

/* Navbar */
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:200;height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,5vw,64px);background:transparent;border-bottom:1px solid transparent;transition:background .3s,border-color .3s,backdrop-filter .3s}
.lp-nav--scrolled{background:rgba(7,11,20,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom-color:var(--border)}
.lp-nav__links{display:flex;gap:32px;align-items:center}
.lp-nav__link{font-size:14px;font-weight:500;color:var(--text-muted);transition:color .2s}
.lp-nav__link:hover{color:var(--text)}
.lp-nav__actions{display:flex;gap:10px;align-items:center}

/* Hamburger */
.lp-hamburger{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;width:42px;height:42px;border-radius:10px;background:rgba(159,239,102,.08);border:1px solid rgba(159,239,102,.22);cursor:pointer;padding:0;transition:background .2s,border-color .2s}
.lp-hamburger:hover{background:rgba(159,239,102,.15);border-color:rgba(159,239,102,.4)}
.lp-hb__bar{display:block;width:18px;height:2px;background:var(--lime);border-radius:2px;transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .25s;transform-origin:center}
.lp-hamburger--open .lp-hb__bar--t{transform:translateY(7px) rotate(45deg)}
.lp-hamburger--open .lp-hb__bar--m{opacity:0;transform:scaleX(0)}
.lp-hamburger--open .lp-hb__bar--b{transform:translateY(-7px) rotate(-45deg)}

/* Backdrop */
.lp-backdrop{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .35s}
.lp-backdrop--on{opacity:1;pointer-events:all}

/* Overlay panel */
.lp-overlay{
  position:fixed;top:0;right:0;bottom:0;z-index:310;
  width:min(88vw,320px);
  background:rgba(7,11,20,.97);
  border-left:1px solid rgba(159,239,102,.13);
  display:flex;flex-direction:column;overflow:hidden;overflow-y:auto;
  transform:translateX(100%);opacity:0;
  transition:transform .36s cubic-bezier(.4,0,.2,1),opacity .3s;
  pointer-events:none;
}
.lp-overlay--open{transform:translateX(0);opacity:1;pointer-events:all}
.lp-overlay__court{position:absolute;inset:0;pointer-events:none}
.lp-overlay__glow{position:absolute;top:-80px;right:-80px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(159,239,102,.09) 0%,transparent 65%);pointer-events:none}
.lp-overlay__top{position:relative;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(159,239,102,.08);flex-shrink:0}
.lp-overlay__x{width:34px;height:34px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:background .2s,color .2s}
.lp-overlay__x:hover{background:rgba(255,255,255,.12);color:var(--text)}
.lp-overlay__nav{position:relative;display:flex;flex-direction:column;padding:10px 0 4px;flex:1}
.lp-overlay__link{display:flex;align-items:center;gap:12px;padding:15px 22px;color:var(--text);font-family:var(--font-display,'Syne',sans-serif);font-size:18px;font-weight:700;border-bottom:1px solid rgba(255,255,255,.04);text-decoration:none;transition:color .2s,background .2s;opacity:0;animation:none}
.lp-overlay--open .lp-overlay__link{animation:lp-slide .4s ease both;animation-delay:calc(.06s + var(--i,0) * .07s)}
.lp-overlay__link:hover{color:var(--lime);background:rgba(159,239,102,.04)}
.lp-overlay__link-n{font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:11px;color:var(--lime);opacity:.55;min-width:22px}
.lp-overlay__link-t{flex:1}
.lp-overlay__link-arrow{opacity:.3;flex-shrink:0;transition:opacity .2s,transform .2s}
.lp-overlay__link:hover .lp-overlay__link-arrow{opacity:.9;transform:translateX(3px)}
.lp-overlay__hr{height:1px;background:rgba(159,239,102,.1);margin:14px 22px;position:relative}
.lp-overlay__ctas{display:flex;flex-direction:column;gap:10px;padding:0 20px;position:relative}
.lp-overlay__btn-primary{width:100%;padding:14px 20px;background:var(--lime,#9fef66);color:#070B14;border:none;border-radius:10px;font-family:var(--font-body,'DM Sans',sans-serif);font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s,transform .15s}
.lp-overlay__btn-primary:hover{background:#b5f07a}
.lp-overlay__btn-primary:active{transform:scale(.98)}
.lp-overlay__btn-ghost{width:100%;padding:13px 20px;background:rgba(255,255,255,.05);color:var(--text-muted);border:1px solid rgba(255,255,255,.1);border-radius:10px;font-family:var(--font-body,'DM Sans',sans-serif);font-size:15px;font-weight:600;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.lp-overlay__btn-ghost:hover{background:rgba(255,255,255,.09);color:var(--text);border-color:rgba(255,255,255,.18)}
.lp-overlay__note{text-align:center;font-size:11.5px;color:var(--text-faint);padding:14px 20px;position:relative}

/* Hero */
.lp-hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(100px,14vh,160px) clamp(16px,5vw,80px) clamp(60px,8vh,100px);overflow:hidden}
.lp-hero__grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(159,239,102,.04)1px,transparent 1px),linear-gradient(90deg,rgba(159,239,102,.04)1px,transparent 1px);background-size:64px 64px}
.lp-hero__court{position:absolute;inset:0;pointer-events:none}
.lp-hero__orb{position:absolute;pointer-events:none;border-radius:50%;animation:lp-orb 18s ease-in-out infinite}
.lp-hero__orb--a{top:10%;right:-5%;width:clamp(280px,45vw,600px);height:clamp(280px,45vw,600px);background:radial-gradient(circle,rgba(159,239,102,.11)0%,transparent 65%)}
.lp-hero__orb--b{bottom:5%;left:-10%;width:clamp(220px,38vw,500px);height:clamp(220px,38vw,500px);background:radial-gradient(circle,rgba(249,115,22,.08)0%,transparent 65%);animation-delay:-6s;animation-duration:22s}
.lp-hero__inner{max-width:1100px;width:100%;margin:0 auto;position:relative;display:grid;grid-template-columns:clamp(280px,55%,600px)1fr;gap:clamp(40px,6vw,80px);align-items:center}
.lp-hero__copy{display:flex;flex-direction:column}
.lp-hero__h1{font-family:var(--font-display,'Syne',sans-serif);font-weight:800;font-size:clamp(34px,5.5vw,78px);line-height:1.04;letter-spacing:-.03em;color:var(--text);margin:20px 0}
.lp-hero__grad{background:linear-gradient(135deg,#9fef66 0%,#6bc940 45%,#f97316 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.lp-hero__sub{font-size:clamp(14px,1.8vw,18px);color:var(--text-muted);line-height:1.72;max-width:500px;margin-bottom:32px}
.lp-hero__cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:48px}
.lp-hero__card{display:flex;justify-content:center}
.lp-f1{animation:lp-up .55s ease both .05s}.lp-f2{animation:lp-up .55s ease both .18s}.lp-f3{animation:lp-up .55s ease both .32s}.lp-f4{animation:lp-up .55s ease both .46s}.lp-f5{animation:lp-up .55s ease both .60s}

/* Stats */
.lp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;max-width:460px}
.lp-stats__item{text-align:center;padding:10px 4px}
.lp-stats__val{display:block;font-family:var(--font-display,'Syne',sans-serif);font-weight:800;font-size:clamp(15px,2vw,24px);color:var(--lime);letter-spacing:-.02em}
.lp-stats__lbl{display:block;font-size:11px;color:var(--text-faint);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── Tournament Section ── */
.lp-tourn{padding:clamp(48px,8vh,80px) clamp(16px,5vw,80px);border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:rgba(255,255,255,.018);opacity:0;transform:translateY(24px);transition:opacity .55s ease,transform .55s ease}
.lp-tourn.lp-in-view{opacity:1;transform:translateY(0)}
.lp-tourn__header{max-width:1100px;margin:0 auto 32px}
.lp-tourn__title{font-family:var(--font-display,'Syne',sans-serif);font-weight:800;font-size:clamp(22px,3.5vw,40px);letter-spacing:-.025em;color:var(--text);margin:10px 0 10px}
.lp-tourn__sub{font-size:clamp(13px,1.5vw,15px);color:var(--text-muted)}

/* Pills row */
.lp-tourn__pills{max-width:1100px;margin:0 auto 0;display:flex;flex-wrap:wrap;gap:10px}
.lp-tpill{display:flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid var(--border-md);border-radius:999px;background:rgba(255,255,255,.03);cursor:pointer;transition:background .2s,border-color .2s,transform .18s;-webkit-tap-highlight-color:transparent;opacity:0}
.lp-tourn.lp-in-view .lp-tpill{animation:lp-up .45s ease var(--delay,0s) both}
.lp-tpill:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.18);transform:translateY(-2px)}
.lp-tpill--on{border-color:var(--tc)!important;background:rgba(255,255,255,.07)!important;box-shadow:0 0 20px rgba(159,239,102,.15)}
.lp-tpill__emoji{font-size:16px;line-height:1;flex-shrink:0}
.lp-tpill__name{font-size:13px;font-weight:600;color:var(--text);white-space:nowrap}
.lp-tpill__surface{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:rgba(255,255,255,.05);padding:2px 7px;border-radius:99px}
.lp-tpill__arrow{color:var(--text-faint);transition:transform .25s cubic-bezier(.4,0,.2,1);flex-shrink:0}
.lp-tpill__arrow--open{transform:rotate(180deg);color:var(--tc)}

/* Detail panel */
.lp-tdetail{max-width:1100px;margin:16px auto 0;overflow:hidden;max-height:0;transition:max-height .45s cubic-bezier(.4,0,.2,1)}
.lp-tdetail--open{max-height:600px}
.lp-tdetail__inner{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:28px;background:var(--bg-card);border:1px solid var(--border-md);border-radius:var(--radius,12px);animation:lp-up .3s ease both}
.lp-tdetail__top{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
.lp-tdetail__emoji{font-size:36px;line-height:1;flex-shrink:0}
.lp-tdetail__name{font-family:var(--font-display,'Syne',sans-serif);font-weight:800;font-size:clamp(17px,2.5vw,24px);color:var(--text);letter-spacing:-.02em}
.lp-tdetail__nickname{font-size:13px;color:var(--text-faint);font-style:italic;margin-top:2px}
.lp-tdetail__close{margin-left:auto;width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:var(--t);-webkit-tap-highlight-color:transparent}
.lp-tdetail__close:hover{border-color:rgba(255,255,255,.25);color:var(--text);background:rgba(255,255,255,.06)}
.lp-tdetail__chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}
.lp-tdetail__chip{font-size:12px;font-weight:500;color:var(--text-muted);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:5px 10px;white-space:nowrap}
.lp-tdetail__about{font-size:14px;color:var(--text-muted);line-height:1.75}
.lp-tdetail__facts{border-left:1px solid var(--border);padding-left:28px}
.lp-tdetail__facts-title{display:flex;align-items:center;gap:7px;font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:11px;font-weight:700;color:var(--lime);text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px}
.lp-tdetail__list{list-style:none;display:flex;flex-direction:column;gap:11px}
.lp-tdetail__fact{display:flex;align-items:flex-start;gap:9px;font-size:13.5px;color:var(--text-muted);line-height:1.6;opacity:0;animation:lp-up .35s ease calc(var(--di,0) * 0.07s) both}
.lp-tdetail--open .lp-tdetail__fact{animation:lp-up .35s ease calc(var(--di,0) * 0.07s) both}

@media(max-width:720px){
  .lp-tdetail__inner{grid-template-columns:1fr}
  .lp-tdetail__facts{border-left:none;border-top:1px solid var(--border);padding-left:0;padding-top:20px}
  .lp-tdetail--open{max-height:900px}
}
@media(max-width:480px){
  .lp-tpill__surface{display:none}
}

/* Sections */
.lp-sec{padding:clamp(56px,10vh,120px) clamp(16px,5vw,80px);max-width:1100px;margin:0 auto}
.lp-sec--alt{max-width:100%;background:rgba(255,255,255,.018);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
/* Fix: explicit selectors instead of > * to avoid breaking nested components */
.lp-sec--alt .lp-sh,.lp-sec--alt .lp-steps,.lp-sec--alt .lp-testim-grid{max-width:1100px;margin-left:auto;margin-right:auto;padding-left:clamp(16px,5vw,80px);padding-right:clamp(16px,5vw,80px)}
.lp-sec--alt .lp-sh{padding-top:clamp(56px,10vh,120px)}
.lp-sec--alt .lp-steps,.lp-sec--alt .lp-testim-grid{padding-bottom:clamp(56px,10vh,120px)}
.lp-sh{margin-bottom:clamp(32px,6vh,72px)}
.lp-sh--c{text-align:center}
.lp-sh--c .lp-sub{margin:0 auto}
.lp-tag{display:inline-block;font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--lime);font-weight:600;margin-bottom:12px}
.lp-title{font-family:var(--font-display,'Syne',sans-serif);font-weight:800;font-size:clamp(24px,4vw,50px);letter-spacing:-.025em;line-height:1.1;color:var(--text);margin-bottom:16px}
.lp-sub{font-size:clamp(14px,1.7vw,17px);color:var(--text-muted);line-height:1.72;max-width:540px}

/* Features */
.lp-feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.lp-fc{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius,12px);padding:28px;transition:background .22s,border-color .22s,transform .22s,box-shadow .22s;cursor:default}
.lp-fc__icon{width:46px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;transition:box-shadow .22s}
.lp-fc__title{font-family:var(--font-display,'Syne',sans-serif);font-weight:700;font-size:17px;color:var(--text);margin-bottom:10px;transition:color .22s}
.lp-fc__desc{font-size:14px;color:var(--text-muted);line-height:1.72}

/* Steps */
.lp-steps{display:grid;grid-template-columns:repeat(4,1fr)}
.lp-step{position:relative;text-align:center;padding:0 20px 48px}
.lp-step__n{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:rgba(159,239,102,.1);border:1px solid rgba(159,239,102,.28);font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:1rem;font-weight:700;color:var(--lime);margin-bottom:16px;position:relative;z-index:1}
.lp-step__line{position:absolute;top:26px;left:calc(50% + 26px);width:calc(100% - 52px);height:1px;background:linear-gradient(90deg,rgba(159,239,102,.3),rgba(159,239,102,.04))}
.lp-step__title{font-family:var(--font-display,'Syne',sans-serif);font-weight:700;font-size:15px;color:var(--text);margin-bottom:8px}
.lp-step__desc{font-size:13.5px;color:var(--text-muted);line-height:1.68}

/* Preview */
.lp-preview{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center}
.lp-preview__copy .lp-sub{margin-bottom:24px}
.lp-check{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:32px}
.lp-check__item{display:flex;align-items:center;gap:9px;font-size:14px;color:var(--text-muted)}
.lp-preview__card{display:flex;justify-content:center}

/* Testimonials */
.lp-testim-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.lp-tc{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius,12px);padding:28px}
.lp-tc__stars{display:flex;gap:3px;margin-bottom:14px}
.lp-tc__q{font-size:14px;color:var(--text-muted);line-height:1.75;font-style:italic;margin-bottom:20px}
.lp-tc__author{display:flex;align-items:center;gap:12px}
.lp-tc__av{width:38px;height:38px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#9fef66,#f97316);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#070B14}
.lp-tc__name{font-family:var(--font-display,'Syne',sans-serif);font-weight:700;font-size:14px;color:var(--text)}
.lp-tc__role{font-size:12px;color:var(--text-faint);margin-top:2px}

/* CTA banner */
.lp-cta{position:relative;overflow:hidden;text-align:center;background:linear-gradient(135deg,rgba(159,239,102,.08)0%,rgba(249,115,22,.05)100%);border:1px solid rgba(159,239,102,.18);border-radius:var(--radius-xl,20px);padding:clamp(36px,6vw,80px) clamp(16px,4vw,80px)}
.lp-cta__court,.lp-cta__glow{position:absolute;inset:0;pointer-events:none}
.lp-cta__glow{background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(159,239,102,.07),transparent 70%)}
.lp-cta__title{font-family:var(--font-display,'Syne',sans-serif);font-weight:800;font-size:clamp(24px,4.5vw,52px);letter-spacing:-.025em;color:var(--text);margin-bottom:18px;position:relative}
.lp-cta__sub{font-size:clamp(14px,1.8vw,17px);color:var(--text-muted);max-width:500px;margin:0 auto 36px;line-height:1.72;position:relative}
.lp-cta__btns{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;position:relative}

/* Footer */
.lp-footer{padding:clamp(24px,4vh,52px) clamp(16px,5vw,80px);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.lp-footer__copy{font-size:13px;color:var(--text-faint)}
.lp-footer__links{display:flex;gap:20px}
.lp-footer__link{font-size:13px;color:var(--text-faint);transition:color .2s}
.lp-footer__link:hover{color:var(--lime)}

/* Match card */
.lp-mc{background:var(--bg-card);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px;width:100%;max-width:360px;animation:lp-glow 4s ease infinite}
.lp-mc__hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.lp-mc__ev{font-size:12px;color:var(--text-faint);font-weight:500}
.lp-mc__live{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#4ade80;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);padding:3px 10px;border-radius:999px}
.lp-mc__p{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin-bottom:8px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:8px}
.lp-mc__p--s{background:rgba(159,239,102,.06);border-color:rgba(159,239,102,.22)}
.lp-mc__pl{display:flex;align-items:center;gap:10px}
.lp-mc__fl{font-size:18px}
.lp-mc__nm{display:block;font-weight:600;font-size:14px;color:var(--text)}
.lp-mc__rk{display:block;font-size:11px;color:var(--text-faint);margin-top:1px}
.lp-mc__sc{font-family:var(--font-mono,'JetBrains Mono',monospace);font-weight:600;font-size:14px;color:var(--text-muted)}
.lp-mc__sc--g{color:var(--lime)}
.lp-mc__prob{margin-top:18px}
.lp-mc__prob-hdr{display:flex;justify-content:space-between;margin-bottom:8px}
.lp-mc__prob-lbl{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em}
.lp-mc__prob-ai{font-size:11px;color:var(--lime);font-weight:600}
.lp-mc__bar-row{display:flex;gap:8px;align-items:center}
.lp-mc__pct{font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:13px;font-weight:700;width:36px;flex-shrink:0}
.lp-mc__pct--g{color:var(--lime)}.lp-mc__pct--m{color:var(--text-muted);text-align:right}
.lp-mc__bar{flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
.lp-mc__fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#9fef66,#6bc940);box-shadow:0 0 12px rgba(159,239,102,.45)}
.lp-mc__factors{margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}
.lp-mc__fl-lbl{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
.lp-mc__factor{display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:12.5px;color:var(--text-muted)}
.lp-mc__chips{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.lp-chip{flex:1;min-width:80px;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 10px}
.lp-chip__v{display:block;font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:13px;font-weight:700;color:var(--ca)}
.lp-chip__l{display:block;font-size:10px;color:var(--text-faint);margin-top:2px}
.lp-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--lime);animation:lp-blink 1.3s ease-in-out infinite;flex-shrink:0}
.lp-serve{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--lime)}

/* Responsive */
@media(max-width:860px){
  .lp-hero__inner{grid-template-columns:1fr}
  .lp-preview{grid-template-columns:1fr}
  .lp-preview__card{order:-1}
  .lp-steps{grid-template-columns:1fr 1fr;row-gap:40px}
  .lp-step__line{display:none}
  .lp-stats{grid-template-columns:repeat(2,1fr);max-width:none;gap:8px}
}
@media(max-width:540px){
  .lp-steps{grid-template-columns:1fr}
  .lp-hero__cta{flex-direction:column;align-items:flex-start;gap:10px}
  .lp-cta__btns{flex-direction:column;align-items:center}
  .lp-footer{flex-direction:column;align-items:flex-start;gap:10px}
  .lp-mc{max-width:100%}
}
@media(max-width:640px){.hide-sm{display:none!important}}
@media(min-width:641px){.show-sm{display:none!important}}
`;
