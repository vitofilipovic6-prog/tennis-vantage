// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx – TennisVantage  (redesigned, drop-in replacement)
// Hooks/auth API unchanged: { user, profile, firstName, logout } from useAuth
//   useMatches  → { live, upcoming, loading, error, refresh }
//   useRankings → { rankings, loading, error }
//   usePrediction(match) → { prediction, loading, error }
//   useAiChat(match) → { messages, typing, sendMessage, reset, bottomRef }
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat } from '../hooks/hooks';
import { Logo, Btn, Badge, Card, Spinner } from '../components/ui';

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'matches',     label: 'Live & Upcoming', icon: '🎾' },
  { id: 'predictions', label: 'Predictions',     icon: '🔮' },
  { id: 'rankings',    label: 'Rankings',        icon: '🏆' },
  { id: 'chat',        label: 'AI Analyst',      icon: '🤖' },
];

// ─── LAYOUT SHELL ─────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, profile, firstName, logout } = useAuth();
  const [activeTab,     setActiveTab]     = useState('matches');
  const [mobileMenu,    setMobileMenu]    = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  async function handleLogout() {
    await logout();
    showToast?.('Signed out successfully', 'info');
  }

  function goToPredict(match) {
    setSelectedMatch(match);
    setActiveTab('predictions');
    setMobileMenu(false);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <style>{CSS}</style>
      <div className="db-root">

        {/* ══ TOP NAVBAR ════════════════════════════════════════════════════ */}
        <nav className="db-nav">
          <Logo size="sm" />

          {/* Desktop tabs */}
          <div className="db-nav__tabs hide-sm">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`db-nav__tab${activeTab === t.id ? ' db-nav__tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* User area */}
          <div className="db-nav__user">
            <div className="db-user-pill hide-sm">
              <div className="db-user-pill__avatar">
                {(firstName?.[0] ?? 'P').toUpperCase()}
              </div>
              <span className="db-user-pill__name">{firstName}</span>
            </div>
            <Btn variant="ghost" size="sm" onClick={handleLogout} style={{ flexShrink: 0 }}>
              Sign Out
            </Btn>
            {/* Mobile hamburger */}
            <button
              className="db-hamburger show-sm"
              aria-label="Toggle menu"
              onClick={() => setMobileMenu(v => !v)}
            >
              <span className={`db-hamburger__icon${mobileMenu ? ' db-hamburger__icon--open' : ''}`}>
                <span /><span /><span />
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile drawer */}
        {mobileMenu && (
          <div className="db-mobile-drawer show-sm">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`db-mobile-drawer__item${activeTab === t.id ? ' db-mobile-drawer__item--active' : ''}`}
                onClick={() => { setActiveTab(t.id); setMobileMenu(false); }}
              >
                <span className="db-mobile-drawer__icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
            <div className="db-mobile-drawer__divider" />
            <button className="db-mobile-drawer__item db-mobile-drawer__item--danger" onClick={handleLogout}>
              <span className="db-mobile-drawer__icon">🚪</span> Sign Out
            </button>
          </div>
        )}

        {/* ══ MAIN CONTENT ══════════════════════════════════════════════════ */}
        <main className="db-main">

          {/* Greeting */}
          <div className="db-greeting tv-fade-up">
            <div className="db-greeting__left">
              <h1 className="db-greeting__title">
                {greeting}, <span className="db-greeting__name">{firstName}</span> 👋
              </h1>
              <p className="db-greeting__sub">
                {user?.email} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            {/* Active tab pill on desktop */}
            <div className="db-greeting__tab-badge hide-sm">
              <span>{TABS.find(t => t.id === activeTab)?.icon}</span>
              {TABS.find(t => t.id === activeTab)?.label}
            </div>
          </div>

          {/* Tab content */}
          <div className="db-content">
            {activeTab === 'matches'     && <MatchesTab     onSelectMatch={goToPredict} />}
            {activeTab === 'predictions' && <PredictionsTab selectedMatch={selectedMatch} onSelectMatch={setSelectedMatch} />}
            {activeTab === 'rankings'    && <RankingsTab />}
            {activeTab === 'chat'        && <AiChatTab contextMatch={selectedMatch} />}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="db-bottom-nav show-sm">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`db-bottom-nav__item${activeTab === t.id ? ' db-bottom-nav__item--active' : ''}`}
              onClick={() => { setActiveTab(t.id); setMobileMenu(false); }}
            >
              <span className="db-bottom-nav__icon">{t.icon}</span>
              <span className="db-bottom-nav__label">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>

      </div>
    </>
  );
}

// ─── MATCHES TAB ──────────────────────────────────────────────────────────────
function MatchesTab({ onSelectMatch }) {
  const { live, upcoming, loading, error, refresh } = useMatches();

  if (loading) return <LoadingGrid />;
  if (error)   return <ErrorMessage msg={error} onRetry={refresh} />;

  return (
    <div className="tv-fade-up">
      {live.length > 0 && (
        <section className="db-section">
          <SectionHeading label="Live Now" dot accent="var(--green)" />
          <div className="db-matches-grid">
            {live.map(m => <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />)}
          </div>
        </section>
      )}
      <section className="db-section">
        <SectionHeading label="Upcoming Matches" />
        {upcoming.length === 0
          ? <EmptyState icon="🎾" title="No upcoming matches" desc="Check back soon — fixtures are updated daily." />
          : (
            <div className="db-matches-grid">
              {upcoming.map((m, i) => (
                <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                  <MatchCard match={m} onPredict={() => onSelectMatch(m)} />
                </div>
              ))}
            </div>
          )
        }
      </section>
    </div>
  );
}

function MatchCard({ match: m, onPredict }) {
  const [hov, setHov] = useState(false);
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const sc = surfaceColors[m.surface] ?? 'var(--text-muted)';

  return (
    <div
      className={`db-match-card${hov ? ' db-match-card--hov' : ''}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Header */}
      <div className="db-match-card__header">
        <div>
          <p className="db-match-card__tournament">{m.tournament} · {m.round}</p>
          <div className="db-match-card__badges">
            <span className="db-surface-badge" style={{ '--sc': sc }}>
              {m.surface}
            </span>
            {m.date && <span className="db-match-card__date">{m.date}</span>}
          </div>
        </div>
        {m.status === 'live' && (
          <span className="db-live-badge">
            <span className="live-dot" /> LIVE
          </span>
        )}
      </div>

      {/* Players */}
      {[m.player1, m.player2].map((p, i) => (
        <div key={p.id ?? i} className="db-match-card__player">
          <div className="db-match-card__player-info">
            <span className="db-match-card__flag">{p.flag}</span>
            <div>
              <p className="db-match-card__player-name">{p.name}</p>
              <p className="db-match-card__player-rank">#{p.rank} ATP</p>
            </div>
          </div>
          {m.score && (
            <span className="db-match-card__score">
              {m.score.split(', ')[i] ?? ''}
            </span>
          )}
        </div>
      ))}

      {/* CTA */}
      <button className="db-match-card__btn" onClick={onPredict}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Predict this match
      </button>
    </div>
  );
}

// ─── PREDICTIONS TAB ──────────────────────────────────────────────────────────
function PredictionsTab({ selectedMatch, onSelectMatch }) {
  const { live, upcoming } = useMatches();
  const allMatches = [...(live ?? []), ...(upcoming ?? [])];
  const { prediction, loading } = usePrediction(selectedMatch);

  return (
    <div className="tv-fade-up db-predictions-layout">
      {/* Sidebar: match picker */}
      <div className="db-predictions-sidebar">
        <SectionHeading label="Select a Match" />
        <div className="db-picker-list">
          {allMatches.length === 0
            ? <p className="db-picker-empty">No matches available</p>
            : allMatches.map(m => (
              <MatchPickerRow
                key={m.id} match={m}
                selected={selectedMatch?.id === m.id}
                onSelect={() => onSelectMatch(m)}
              />
            ))
          }
        </div>
      </div>

      {/* Main panel */}
      <div className="db-predictions-main">
        <SectionHeading label="Match Analysis" />
        {!selectedMatch ? (
          <EmptyState
            icon="🔮"
            title="Select a match to analyse"
            desc="Choose any upcoming or live match on the left to see the full AI prediction breakdown."
          />
        ) : loading ? (
          <LoadingGrid cols={1} rows={3} />
        ) : (
          <PredictionPanel match={selectedMatch} prediction={prediction} />
        )}
      </div>
    </div>
  );
}

function MatchPickerRow({ match: m, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`db-picker-row${selected ? ' db-picker-row--selected' : ''}`}
    >
      <div className="db-picker-row__top">
        <span className="db-picker-row__tournament">{m.tournament}</span>
        {m.status === 'live' && (
          <span className="db-picker-row__live">
            <span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE
          </span>
        )}
      </div>
      <span className="db-picker-row__players">
        {m.player1.name} <span className="db-picker-row__vs">vs</span> {m.player2.name}
      </span>
    </button>
  );
}

function PredictionPanel({ match: m, prediction: pred }) {
  if (!pred) return <ErrorMessage msg="Could not compute prediction for this match." />;
  const { player1_win_pct: p1, player2_win_pct: p2, confidence, key_factors } = pred;
  const confColors = { High: 'var(--green)', Medium: 'var(--yellow)', Low: 'var(--clay)' };

  return (
    <div className="db-pred-panels">
      {/* Win probability */}
      <div className="db-panel">
        <div className="db-panel__header">
          <div>
            <p className="db-panel__eyebrow">Win Probability</p>
            <h2 className="db-panel__title">{m.player1.name} vs {m.player2.name}</h2>
            <p className="db-panel__sub">{m.tournament} · {m.round} · {m.surface}</p>
          </div>
          <Badge color={confColors[confidence] ?? 'var(--lime)'}>{confidence} confidence</Badge>
        </div>

        {[
          { name: m.player1.name, flag: m.player1.flag, pct: p1, color: 'var(--lime)' },
          { name: m.player2.name, flag: m.player2.flag, pct: p2, color: 'var(--clay)' },
        ].map(row => (
          <div key={row.name} className="db-prob-row">
            <div className="db-prob-row__player">
              <span>{row.flag}</span>
              <span className="db-prob-row__name">{row.name}</span>
            </div>
            <div className="db-prob-row__bar-wrap">
              <div className="db-prob-row__bar">
                <div
                  className="db-prob-row__fill"
                  style={{ width: `${row.pct}%`, '--fill-color': row.color }}
                />
              </div>
              <span className="db-prob-row__pct" style={{ color: row.color }}>{row.pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Key factors */}
      <div className="db-panel">
        <p className="db-panel__eyebrow" style={{ marginBottom: 14 }}>Key Prediction Factors</p>
        <div className="db-factors-list">
          {key_factors.map(f => (
            <div key={f} className="db-factor-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Player stat comparison */}
      <div className="db-panel">
        <p className="db-panel__eyebrow" style={{ marginBottom: 14 }}>Head-to-Head Stats</p>
        <div className="db-stats-header">
          <span className="db-stats-p1">{m.player1.flag} {m.player1.name}</span>
          <span className="db-stats-label-center" />
          <span className="db-stats-p2">{m.player2.flag} {m.player2.name}</span>
        </div>
        {[
          { label: 'ATP Rank',     v1: `#${m.player1.rank}`,                  v2: `#${m.player2.rank}` },
          { label: 'Career Wins',  v1: m.player1.wins,                         v2: m.player2.wins },
          { label: '1st Serve %',  v1: `${m.player1.first_serve_pct}%`,        v2: `${m.player2.first_serve_pct}%` },
          { label: 'Ace Avg',      v1: m.player1.ace_avg,                      v2: m.player2.ace_avg },
          { label: 'Surface Pref', v1: m.player1.surface_pref,                 v2: m.player2.surface_pref },
        ].map(s => <StatRow key={s.label} {...s} />)}
      </div>
    </div>
  );
}

function StatRow({ label, v1, v2 }) {
  return (
    <div className="db-stat-row">
      <span className="db-stat-row__v1">{v1}</span>
      <span className="db-stat-row__label">{label}</span>
      <span className="db-stat-row__v2">{v2}</span>
    </div>
  );
}

// ─── RANKINGS TAB ─────────────────────────────────────────────────────────────
function RankingsTab() {
  const [tour, setTour]     = useState('ATP');
  const { rankings, loading, error } = useRankings(tour);
  const [hovRow, setHovRow] = useState(null);

  if (loading) return <LoadingGrid cols={1} rows={10} />;
  if (error)   return <ErrorMessage msg={error} />;

  return (
    <div className="tv-fade-up">
      {/* Tour switcher */}
      <div className="db-tour-switcher">
        {['ATP', 'WTA'].map(t => (
          <button
            key={t}
            className={`db-tour-btn${tour === t ? ' db-tour-btn--active' : ''}`}
            onClick={() => setTour(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <SectionHeading label={`${tour} Live Rankings`} />

      <div className="db-rankings-card">
        {/* Table header */}
        <div className="db-rankings-head">
          {['#', 'Player', 'Points', 'W/L'].map(h => (
            <span key={h} className="db-rankings-head__cell">{h}</span>
          ))}
        </div>

        {rankings.map((p, i) => (
          <div
            key={p.id}
            className={`db-rankings-row${hovRow === p.id ? ' db-rankings-row--hov' : ''}`}
            onMouseEnter={() => setHovRow(p.id)}
            onMouseLeave={() => setHovRow(null)}
          >
            <span className="db-rankings-row__rank" data-pos={i}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
            </span>
            <div className="db-rankings-row__player">
              <span className="db-rankings-row__flag">{p.flag}</span>
              <div>
                <p className="db-rankings-row__name">{p.name}</p>
                <p className="db-rankings-row__meta">{p.country} · {p.surface_pref}</p>
              </div>
            </div>
            <span className={`db-rankings-row__pts${hovRow === p.id ? ' db-rankings-row__pts--hov' : ''}`}>
              {p.points?.toLocaleString()}
            </span>
            <span className="db-rankings-row__wl">
              <span className="db-rankings-row__wins">{p.wins}</span>
              <span className="db-rankings-row__losses">/{p.losses}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI CHAT TAB ──────────────────────────────────────────────────────────────
function AiChatTab({ contextMatch }) {
  const { messages, typing, sendMessage, reset, bottomRef } = useAiChat(contextMatch);
  const [input, setInput] = useState('');

  const SUGGESTIONS = [
    "Who is favoured to win today?",
    "Explain clay vs hard court play",
    "What does first serve % mean?",
    "Compare Djokovic and Alcaraz form",
  ];

  function submit(e) {
    e?.preventDefault();
    if (!input.trim() || typing) return;
    sendMessage(input);
    setInput('');
  }

  return (
    <div className={`tv-fade-up db-chat-layout${contextMatch ? ' db-chat-layout--with-context' : ''}`}>

      {/* Chat panel */}
      <div className="db-chat-panel">
        {/* Header */}
        <div className="db-chat-header">
          <div className="db-chat-header__left">
            <div className="db-chat-avatar">🤖</div>
            <div>
              <p className="db-chat-header__title">AI Tennis Analyst</p>
              <p className="db-chat-header__status">
                <span className="db-chat-header__dot" /> Online
              </p>
            </div>
          </div>
          <Btn variant="ghost" size="sm" onClick={reset}>Clear</Btn>
        </div>

        {/* Messages */}
        <div className="db-chat-messages">
          {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions (only when just the welcome message) */}
        {messages.length === 1 && (
          <div className="db-chat-suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="db-chat-suggestion" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="db-chat-input-row" onSubmit={submit}>
          <input
            className="db-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about any match, player, or prediction…"
          />
          <button
            type="submit"
            className={`db-chat-send${(!input.trim() || typing) ? ' db-chat-send--disabled' : ''}`}
            disabled={!input.trim() || typing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>

      {/* Context match card */}
      {contextMatch && (
        <div className="db-chat-context">
          <SectionHeading label="Analysing Match" />
          <div className="db-panel">
            <p className="db-panel__eyebrow">{contextMatch.tournament} · {contextMatch.round}</p>
            <p className="db-chat-context__p1">{contextMatch.player1.name}</p>
            <p className="db-chat-context__vs">vs</p>
            <p className="db-chat-context__p2">{contextMatch.player2.name}</p>
            <div style={{ marginTop: 14 }}>
              <Badge color={
                contextMatch.surface === 'Clay' ? 'var(--clay)' :
                contextMatch.surface === 'Grass' ? 'var(--green)' : 'var(--blue)'
              }>
                {contextMatch.surface}
              </Badge>
            </div>
          </div>
          <p className="db-chat-context__hint">
            The AI analyst has context about this match. Ask specific questions for tailored predictions.
          </p>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ msg }) {
  const isAI = msg.role === 'assistant';
  return (
    <div className={`db-bubble-wrap${isAI ? '' : ' db-bubble-wrap--user'}`}>
      {isAI && <div className="db-chat-avatar db-chat-avatar--sm">🤖</div>}
      <div className={`db-bubble${isAI ? ' db-bubble--ai' : ' db-bubble--user'}`}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="db-bubble-wrap">
      <div className="db-chat-avatar db-chat-avatar--sm">🤖</div>
      <div className="db-bubble db-bubble--ai db-bubble--typing">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ─── SHARED HELPERS ────────────────────────────────────────────────────────────
function SectionHeading({ label, accent = 'var(--lime)', dot }) {
  return (
    <h2 className="db-section-heading">
      {dot && <span className="live-dot" />}
      <span style={{ color: accent }}>{label}</span>
      <span className="db-section-heading__line" />
    </h2>
  );
}

function LoadingGrid({ cols = 2, rows = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 180, borderRadius: 'var(--radius)' }} />
      ))}
    </div>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div className="db-error">
      <p className="db-error__msg">⚠ {msg}</p>
      {onRetry && <Btn variant="danger" size="sm" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="db-empty">
      <div className="db-empty__icon">{icon}</div>
      <h3 className="db-empty__title">{title}</h3>
      <p className="db-empty__desc">{desc}</p>
    </div>
  );
}

// ─── ALL SCOPED CSS ───────────────────────────────────────────────────────────
const CSS = `
/* ── Root ── */
.db-root{min-height:100dvh;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow-x:hidden}
.db-root *{box-sizing:border-box}
.db-root button{-webkit-tap-highlight-color:transparent;font-family:var(--font-body)}

/* ── Navbar ── */
.db-nav{
  position:sticky;top:0;z-index:100;
  height:62px;display:flex;align-items:center;justify-content:space-between;
  padding:0 clamp(14px,3vw,40px);
  background:rgba(7,11,20,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  gap:12px;
}
.db-nav__tabs{display:flex;gap:3px;flex:1;justify-content:center}
.db-nav__tab{
  display:flex;align-items:center;gap:7px;
  padding:8px 16px;border:none;border-radius:8px;
  background:transparent;color:var(--text-muted);
  font-size:14px;font-weight:500;cursor:pointer;
  transition:var(--t);white-space:nowrap;
}
.db-nav__tab:hover{background:rgba(255,255,255,.05);color:var(--text)}
.db-nav__tab--active{background:rgba(159,239,102,.12)!important;color:var(--lime)!important;font-weight:600}
.db-nav__user{display:flex;align-items:center;gap:10px;flex-shrink:0}

/* ── User pill ── */
.db-user-pill{display:flex;align-items:center;gap:9px;padding:5px 13px 5px 5px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:999px}
.db-user-pill__avatar{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#9fef66,#6bc940);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#070B14;flex-shrink:0}
.db-user-pill__name{font-size:13px;font-weight:500;color:var(--text)}

/* ── Hamburger ── */
.db-hamburger{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid var(--border);cursor:pointer;transition:var(--t)}
.db-hamburger:hover{background:rgba(255,255,255,.09);border-color:rgba(159,239,102,.3)}
.db-hamburger__icon{display:flex;flex-direction:column;gap:5px;width:17px}
.db-hamburger__icon span{display:block;height:2px;background:var(--text-muted);border-radius:2px;transition:all .25s ease;transform-origin:center}
.db-hamburger__icon--open span:nth-child(1){transform:translateY(7px) rotate(45deg);background:var(--lime)}
.db-hamburger__icon--open span:nth-child(2){opacity:0;transform:scaleX(0)}
.db-hamburger__icon--open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);background:var(--lime)}

/* ── Mobile drawer ── */
.db-mobile-drawer{position:fixed;top:62px;left:0;right:0;z-index:99;background:rgba(11,17,28,.97);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:8px 0 16px;animation:db-drop .22s ease both}
@keyframes db-drop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.db-mobile-drawer__item{display:flex;align-items:center;gap:12px;width:100%;padding:13px clamp(16px,4vw,32px);border:none;background:transparent;color:var(--text-muted);font-size:15px;font-weight:500;cursor:pointer;transition:var(--t);text-align:left}
.db-mobile-drawer__item:hover,.db-mobile-drawer__item:active{background:rgba(159,239,102,.05);color:var(--lime)}
.db-mobile-drawer__item--active{color:var(--lime)}
.db-mobile-drawer__item--danger{color:var(--red)!important}
.db-mobile-drawer__item--danger:hover{background:rgba(248,113,113,.06)!important}
.db-mobile-drawer__icon{font-size:18px;width:24px;text-align:center;flex-shrink:0}
.db-mobile-drawer__divider{height:1px;background:var(--border);margin:8px clamp(16px,4vw,32px)}

/* ── Main ── */
.db-main{flex:1;max-width:1200px;width:100%;margin:0 auto;padding:clamp(20px,3vh,40px) clamp(14px,3vw,40px);padding-bottom:80px}
.db-content{margin-top:0}
.db-section{margin-bottom:40px}

/* ── Greeting ── */
.db-greeting{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:clamp(20px,4vh,36px);gap:16px;flex-wrap:wrap}
.db-greeting__title{font-family:var(--font-display);font-weight:700;font-size:clamp(18px,3vw,26px);letter-spacing:-.02em;line-height:1.2}
.db-greeting__name{color:var(--lime)}
.db-greeting__sub{color:var(--text-muted);font-size:13px;margin-top:4px}
.db-greeting__tab-badge{display:flex;align-items:center;gap:7px;padding:8px 16px;background:rgba(159,239,102,.08);border:1px solid rgba(159,239,102,.2);border-radius:999px;font-size:13px;font-weight:600;color:var(--lime);white-space:nowrap}

/* ── Section heading ── */
.db-section-heading{font-family:var(--font-display);font-weight:700;font-size:clamp(13px,2vw,16px);letter-spacing:-.01em;margin-bottom:14px;display:flex;align-items:center;gap:9px;color:var(--text)}
.db-section-heading__line{flex:1;height:1px;background:var(--border);display:block}

/* ── Match card ── */
.db-matches-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(260px,30vw,340px),1fr));gap:16px}
.db-match-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:var(--t-md);display:flex;flex-direction:column;gap:0}
.db-match-card--hov{border-color:rgba(159,239,102,.28);transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.5),0 0 30px rgba(159,239,102,.06)}
.db-match-card__header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:8px}
.db-match-card__tournament{font-size:12px;color:var(--text-faint);font-weight:500;margin-bottom:5px}
.db-match-card__badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.db-surface-badge{font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--sc) 15%,transparent);color:var(--sc);border:1px solid color-mix(in srgb,var(--sc) 30%,transparent);text-transform:uppercase}
.db-match-card__date{font-size:11px;color:var(--text-faint)}
.db-live-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--green);background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);padding:4px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.db-match-card__player{display:flex;justify-content:space-between;align-items:center;padding:10px 13px;margin-bottom:7px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:var(--radius-sm)}
.db-match-card__player:last-of-type{margin-bottom:0}
.db-match-card__player-info{display:flex;align-items:center;gap:9px}
.db-match-card__flag{font-size:17px}
.db-match-card__player-name{font-weight:600;font-size:14px;color:var(--text)}
.db-match-card__player-rank{font-size:11px;color:var(--text-faint);margin-top:1px}
.db-match-card__score{font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--lime)}
.db-match-card__btn{width:100%;margin-top:14px;padding:10px;border:1px solid rgba(159,239,102,.25);border-radius:var(--radius-sm);background:rgba(159,239,102,.07);color:var(--lime);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:var(--t)}
.db-match-card__btn:hover{background:rgba(159,239,102,.14);border-color:rgba(159,239,102,.4)}

/* ── Predictions layout ── */
.db-predictions-layout{display:grid;grid-template-columns:clamp(220px,30%,340px) 1fr;gap:20px;align-items:start}
.db-predictions-sidebar{}
.db-predictions-main{}

/* ── Match picker ── */
.db-picker-list{display:flex;flex-direction:column;gap:7px}
.db-picker-empty{font-size:13px;color:var(--text-faint);padding:16px 0}
.db-picker-row{display:flex;flex-direction:column;gap:5px;padding:13px 15px;width:100%;text-align:left;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;transition:var(--t)}
.db-picker-row:hover{border-color:rgba(159,239,102,.25);background:var(--bg-card-alt)}
.db-picker-row--selected{background:rgba(159,239,102,.08)!important;border-color:rgba(159,239,102,.35)!important}
.db-picker-row__top{display:flex;justify-content:space-between;align-items:center}
.db-picker-row__tournament{font-size:11px;color:var(--text-faint)}
.db-picker-row__live{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--green);font-weight:700}
.db-picker-row__players{font-size:13.5px;font-weight:600;color:var(--text)}
.db-picker-row__vs{color:var(--text-faint);font-weight:400}

/* ── Prediction panels ── */
.db-pred-panels{display:flex;flex-direction:column;gap:14px}
.db-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.db-panel__header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.db-panel__eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-faint)}
.db-panel__title{font-family:var(--font-display);font-size:18px;font-weight:700;margin-top:5px}
.db-panel__sub{font-size:13px;color:var(--text-muted);margin-top:3px}

/* Prob bars */
.db-prob-row{margin-bottom:16px}
.db-prob-row:last-child{margin-bottom:0}
.db-prob-row__player{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.db-prob-row__name{font-size:14px;font-weight:600}
.db-prob-row__bar-wrap{display:flex;align-items:center;gap:10px}
.db-prob-row__bar{flex:1;height:10px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden}
.db-prob-row__fill{height:100%;border-radius:99px;background:var(--fill-color);box-shadow:0 0 12px color-mix(in srgb,var(--fill-color) 50%,transparent);transition:width .8s cubic-bezier(.4,0,.2,1)}
.db-prob-row__pct{font-family:var(--font-mono);font-size:15px;font-weight:700;width:42px;flex-shrink:0;text-align:right}

/* Factors */
.db-factors-list{display:flex;flex-direction:column;gap:8px}
.db-factor-item{display:flex;gap:9px;align-items:flex-start;padding:10px 13px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;color:var(--text-muted)}

/* Stats comparison */
.db-stats-header{display:grid;grid-template-columns:1fr 1fr 1fr;margin-bottom:12px;font-size:12px;font-weight:600;color:var(--text-muted)}
.db-stats-p1{color:var(--lime);text-align:right}
.db-stats-p2{color:var(--clay)}
.db-stat-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);gap:10px}
.db-stat-row:last-child{border-bottom:none}
.db-stat-row__v1{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--lime);text-align:right}
.db-stat-row__label{font-size:11.5px;color:var(--text-faint);text-align:center;white-space:nowrap}
.db-stat-row__v2{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--clay)}

/* ── Rankings ── */
.db-tour-switcher{display:flex;gap:6px;margin-bottom:18px}
.db-tour-btn{padding:8px 22px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-muted);font-size:14px;font-weight:600;cursor:pointer;transition:var(--t)}
.db-tour-btn:hover{border-color:rgba(159,239,102,.3);color:var(--lime)}
.db-tour-btn--active{background:rgba(159,239,102,.12);border-color:rgba(159,239,102,.35);color:var(--lime)}

.db-rankings-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.db-rankings-head{display:grid;grid-template-columns:52px 1fr 110px 80px;padding:11px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}
.db-rankings-head__cell{font-size:11px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em}
.db-rankings-row{display:grid;grid-template-columns:52px 1fr 110px 80px;padding:13px 20px;align-items:center;border-bottom:1px solid var(--border);transition:var(--t);cursor:default}
.db-rankings-row:last-child{border-bottom:none}
.db-rankings-row--hov{background:rgba(159,239,102,.04)}
.db-rankings-row__rank{font-family:var(--font-mono);font-weight:700;font-size:14px;color:var(--text-faint)}
.db-rankings-row__rank[data-pos="0"]{font-size:17px}
.db-rankings-row__rank[data-pos="1"]{font-size:17px}
.db-rankings-row__rank[data-pos="2"]{font-size:17px}
.db-rankings-row__player{display:flex;align-items:center;gap:11px}
.db-rankings-row__flag{font-size:20px}
.db-rankings-row__name{font-weight:600;font-size:14px}
.db-rankings-row__meta{font-size:11px;color:var(--text-faint);margin-top:1px}
.db-rankings-row__pts{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--text);transition:var(--t)}
.db-rankings-row__pts--hov{color:var(--lime)}
.db-rankings-row__wl{font-size:13px}
.db-rankings-row__wins{color:var(--green);font-weight:600}
.db-rankings-row__losses{color:var(--text-faint)}

/* ── AI Chat ── */
.db-chat-layout{display:grid;grid-template-columns:1fr;gap:20px;align-items:start}
.db-chat-layout--with-context{grid-template-columns:1fr clamp(200px,26%,280px)}
.db-chat-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;height:clamp(480px,70vh,720px);overflow:hidden}
.db-chat-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02);flex-shrink:0}
.db-chat-header__left{display:flex;align-items:center;gap:10px}
.db-chat-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.db-chat-avatar--sm{width:28px;height:28px;font-size:13px}
.db-chat-header__title{font-weight:600;font-size:14px}
.db-chat-header__status{font-size:11px;color:var(--green);display:flex;align-items:center;gap:4px;margin-top:2px}
.db-chat-header__dot{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block}
.db-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.db-bubble-wrap{display:flex;gap:8px;align-items:flex-end}
.db-bubble-wrap--user{flex-direction:row-reverse}
.db-bubble{max-width:82%;padding:11px 15px;font-size:14px;line-height:1.6}
.db-bubble--ai{background:var(--bg-card-alt,#161e2e);border:1px solid var(--border);border-radius:14px 14px 14px 2px}
.db-bubble--user{background:rgba(159,239,102,.1);border:1px solid rgba(159,239,102,.22);border-radius:14px 14px 2px 14px}
.db-bubble--typing{display:flex;gap:5px;align-items:center;padding:12px 16px}
.db-bubble--typing span{width:7px;height:7px;border-radius:50%;background:var(--text-faint);animation:tv-live-dot 1s ease infinite}
.db-bubble--typing span:nth-child(2){animation-delay:.18s}
.db-bubble--typing span:nth-child(3){animation-delay:.36s}
.db-chat-suggestions{padding:0 14px 10px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}
.db-chat-suggestion{padding:6px 12px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:999px;color:var(--text-muted);font-size:12px;cursor:pointer;transition:var(--t)}
.db-chat-suggestion:hover{border-color:rgba(159,239,102,.35);color:var(--lime)}
.db-chat-input-row{padding:11px 14px;border-top:1px solid var(--border);display:flex;gap:9px;flex-shrink:0}
.db-chat-input{flex:1;padding:10px 16px;background:rgba(255,255,255,.04);border:1px solid var(--border-md);border-radius:999px;color:var(--text);font-size:14px;outline:none;transition:var(--t)}
.db-chat-input:focus{border-color:rgba(159,239,102,.4);background:rgba(159,239,102,.03)}
.db-chat-send{width:38px;height:38px;border-radius:50%;background:var(--lime);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#070B14;flex-shrink:0;transition:var(--t)}
.db-chat-send:hover{background:#b5f07a;transform:scale(1.05)}
.db-chat-send--disabled{background:var(--border)!important;color:var(--text-faint)!important;cursor:not-allowed!important;transform:none!important}
.db-chat-context__p1{font-weight:700;font-size:15px;margin-top:10px}
.db-chat-context__vs{color:var(--text-faint);font-size:13px;margin:5px 0}
.db-chat-context__p2{font-weight:700;font-size:15px}
.db-chat-context__hint{font-size:12px;color:var(--text-faint);margin-top:12px;line-height:1.6}

/* ── Error / Empty ── */
.db-error{padding:28px;text-align:center;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.2);border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;gap:12px}
.db-error__msg{color:var(--red);font-size:14px}
.db-empty{padding:48px 24px;text-align:center}
.db-empty__icon{font-size:44px;margin-bottom:14px;opacity:.7}
.db-empty__title{font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:8px}
.db-empty__desc{color:var(--text-muted);font-size:14px;max-width:300px;margin:0 auto;line-height:1.7}

/* ── Mobile bottom nav ── */
.db-bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:100;display:flex;background:rgba(11,17,28,.97);border-top:1px solid var(--border);backdrop-filter:blur(20px);padding-bottom:env(safe-area-inset-bottom)}
.db-bottom-nav__item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;transition:var(--t)}
.db-bottom-nav__item--active{color:var(--lime)}
.db-bottom-nav__icon{font-size:20px;line-height:1}
.db-bottom-nav__label{font-size:9px;font-weight:600;letter-spacing:.03em;text-transform:uppercase}

/* ── Responsive ── */
@media(max-width:900px){
  .db-predictions-layout{grid-template-columns:1fr}
  .db-chat-layout--with-context{grid-template-columns:1fr}
  .db-chat-context{display:none}
  .db-rankings-head,.db-rankings-row{grid-template-columns:44px 1fr 90px}
  .db-rankings-head__cell:last-child,.db-rankings-row__wl{display:none}
  .db-main{padding-bottom:90px}
}
@media(max-width:640px){
  .db-matches-grid{grid-template-columns:1fr}
  .db-rankings-head,.db-rankings-row{grid-template-columns:40px 1fr 80px}
  .db-rankings-row__meta{display:none}
}
@media(max-width:400px){
  .db-nav{padding:0 10px}
}
/* hide/show helpers (from index.css globals) */
@media(max-width:640px){.hide-sm{display:none!important}}
@media(min-width:641px){.show-sm{display:none!important}}
`;