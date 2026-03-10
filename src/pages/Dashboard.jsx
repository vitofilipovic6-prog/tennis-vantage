// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx  –  TennisVantage  (complete rewrite)
//
// What changed vs old version:
//  • Profile pill in navbar → navigates to ProfilePage via onGoToProfile prop
//  • Avatar image shown in navbar if user has one uploaded
//  • Skeleton loaders on EVERY tab (not just matches)
//  • Proper empty states with icons + helpful copy on every section
//  • RankingsTab: rank change indicator (▲▼) + surface badge chips
//  • PredictionPanel: key factors rendered as visual stat rows, not plain text
//  • AiChatTab: full height layout, better message bubbles, clear context card
//  • MatchCard: live score blink animation, surface color badge
//  • Mobile: hamburger drawer includes Profile link
//  • All sub-components are pure — no internal hook calls except what they need
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAuth }   from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat } from '../hooks/hooks';
import { Logo, Btn, Badge, Card, Spinner } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SURFACE_COLOR = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
const CONF_COLOR    = { High: '#4ade80', Medium: '#fbbf24', Low: '#f97316' };

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(260px, 30vw, 360px), 1fr))',
  gap: '16px',
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast, onGoToProfile }) {
  const { user, firstName, profile, logout } = useAuth();

  const [activeTab,     setActiveTab]     = useState('matches');
  const [mobileMenu,    setMobileMenu]    = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();
  const allMatches = useMemo(() => [...live, ...upcoming], [live, upcoming]);

  const tabs = [
    { id: 'matches',     label: 'Live & Upcoming', icon: '🎾' },
    { id: 'predictions', label: 'Predictions',     icon: '🔮' },
    { id: 'rankings',    label: 'Rankings',         icon: '🏆' },
    { id: 'chat',        label: 'AI Analyst',       icon: '🤖' },
  ];

  async function handleLogout() {
    await logout();
    showToast('Signed out successfully', 'info');
  }

  function handleSelectMatch(match) {
    setSelectedMatch(match);
    setActiveTab('predictions');
  }

  const initials = (firstName?.[0] ?? 'P').toUpperCase();
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAVBAR ───────────────────────────────────────────────────────── */}
      <nav style={{
        background: 'rgba(7,11,20,0.92)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)', height: '62px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Logo size="sm" />

        {/* Desktop tab strip */}
        <div className="hide-sm" style={{ display: 'flex', gap: '2px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', border: 'none', borderRadius: '8px',
                background: activeTab === t.id ? 'rgba(159,239,102,0.12)' : 'transparent',
                color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500,
                cursor: 'pointer', transition: 'var(--t)',
                borderBottom: activeTab === t.id ? '2px solid var(--lime)' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (activeTab !== t.id) e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { if (activeTab !== t.id) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <span style={{ fontSize: '15px' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right: profile pill + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="hide-sm"
            onClick={onGoToProfile}
            title="View profile"
            style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '5px 12px 5px 5px',
              background: 'var(--bg-glass-md)',
              border: '1px solid var(--border)',
              borderRadius: '999px', cursor: 'pointer', transition: 'var(--t)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(159,239,102,0.35)';
              e.currentTarget.style.background = 'rgba(159,239,102,0.07)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-glass-md)';
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg,#9fef66,#6bc940)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#070B14', fontWeight: 700,
              overflow: 'hidden', flexShrink: 0,
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              {firstName}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>

          <Btn variant="ghost" size="sm" onClick={handleLogout} style={{ whiteSpace: 'nowrap' }}>
            Sign Out
          </Btn>

          {/* Mobile hamburger */}
          <button
            className="show-sm"
            onClick={() => setMobileMenu(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '6px', cursor: 'pointer' }}
          >
            {mobileMenu
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileMenu && (
        <div className="tv-fade-in show-sm" style={{
          position: 'fixed', top: '62px', left: 0, right: 0,
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          zIndex: 99, padding: '12px',
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setMobileMenu(false); }} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', padding: '13px 16px', border: 'none', borderRadius: '10px',
              marginBottom: '4px',
              background: activeTab === t.id ? 'rgba(159,239,102,0.1)' : 'transparent',
              color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 500,
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
          <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
          <button onClick={() => { onGoToProfile?.(); setMobileMenu(false); }} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            width: '100%', padding: '13px 16px', border: 'none', borderRadius: '10px',
            marginBottom: '4px', background: 'transparent',
            color: 'var(--lime)', fontFamily: 'var(--font-body)',
            fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
          }}>
            <span>👤</span> My Profile
          </button>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            width: '100%', padding: '13px 16px', border: 'none', borderRadius: '10px',
            background: 'transparent', color: 'var(--red)',
            fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 500,
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto',
        padding: 'clamp(20px,3vh,40px) clamp(16px,3vw,40px)',
      }}>
        {/* Greeting */}
        <div className="tv-fade-up" style={{ marginBottom: 'clamp(24px,4vh,40px)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(20px,3vw,28px)', letterSpacing: '-0.02em', margin: 0,
          }}>
            Good game, <span style={{ color: 'var(--lime)' }}>{firstName}</span> 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Tab content */}
        {activeTab === 'matches'     && <MatchesTab live={live} upcoming={upcoming} loading={matchesLoading} error={matchesError} refresh={refresh} onSelectMatch={handleSelectMatch} />}
        {activeTab === 'predictions' && <PredictionsTab allMatches={allMatches} matchesLoading={matchesLoading} selectedMatch={selectedMatch} onSelectMatch={setSelectedMatch} />}
        {activeTab === 'rankings'    && <RankingsTab />}
        {activeTab === 'chat'        && <AiChatTab contextMatch={selectedMatch} />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES TAB
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, upcoming, loading, error, refresh, onSelectMatch }) {
  const [calendarDate, setCalendarDate] = useState(null);

  if (loading) return <MatchesSkeleton />;
  if (error)   return <ErrorMessage msg={error} onRetry={refresh} />;

  const filteredUpcoming = calendarDate
    ? upcoming.filter(m => {
        const today    = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const isToday    = calendarDate.toDateString() === today.toDateString();
        const isTomorrow = calendarDate.toDateString() === tomorrow.toDateString();
        const label = (m.date ?? '').toLowerCase();
        if (isToday)    return label.includes('today');
        if (isTomorrow) return label.includes('tomorrow');
        return true;
      })
    : upcoming;

  return (
    <div className="tv-fade-up">
      <MatchCalendar onSelectDate={setCalendarDate} />

      {/* Live section */}
      {live.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading label="Live Now" dot />
          <div style={gridStyle}>
            {live.map(m => <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />)}
          </div>
        </section>
      )}

      {/* Upcoming section */}
      <section>
        <SectionHeading label={
          calendarDate
            ? `Matches on ${calendarDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`
            : 'Upcoming Matches'
        } />
        {filteredUpcoming.length === 0
          ? <EmptyState icon="📅" title="No matches on this day" desc="Try another date on the calendar, or check back later for new fixtures." />
          : (
            <div style={gridStyle}>
              {filteredUpcoming.map((m, i) => (
                <div key={m.id} style={{ animation: `tv-fade-up 0.3s ease ${i * 0.05}s both` }}>
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

function MatchesSkeleton() {
  return (
    <div className="tv-fade-up">
      {/* Calendar strip skeleton */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', overflow: 'hidden' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: 60, height: 72, borderRadius: 10, flexShrink: 0 }} />
        ))}
      </div>
      <SectionHeading label="Live Now" dot />
      <div style={{ ...gridStyle, marginBottom: 40 }}>
        {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 14 }} />)}
      </div>
      <SectionHeading label="Upcoming Matches" />
      <div style={gridStyle}>
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 14 }} />)}
      </div>
    </div>
  );
}

function MatchCard({ match: m, onPredict }) {
  const surfaceColor = SURFACE_COLOR[m.surface] ?? 'var(--text-muted)';
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hov ? 'rgba(159,239,102,0.25)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '20px',
        transition: 'var(--t-md)',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? '0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(159,239,102,0.08)' : 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500, marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.tournament} · {m.round}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase',
              background: `${surfaceColor}18`, color: surfaceColor, border: `1px solid ${surfaceColor}28`,
            }}>{m.surface}</span>
            {m.date && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{m.date}</span>}
          </div>
        </div>
        {m.status === 'live' && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 700, color: 'var(--green)',
            background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.22)',
            padding: '4px 10px', borderRadius: '999px', flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--green)',
              animation: 'tv-live-dot 1.2s ease infinite',
              display: 'inline-block',
            }} />
            LIVE
          </span>
        )}
      </div>

      {/* Players */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[m.player1, m.player2].map((p, idx) => (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{p.flag}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.2 }}>{p.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>#{p.rank} ATP</p>
              </div>
            </div>
            {m.score && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700,
                color: m.status === 'live' ? 'var(--lime)' : 'var(--text-muted)',
              }}>
                {m.score.split(', ')[idx] ?? ''}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onPredict}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          padding: '9px', width: '100%',
          background: hov ? 'rgba(159,239,102,0.12)' : 'transparent',
          border: `1px solid ${hov ? 'rgba(159,239,102,0.35)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--lime)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px',
          cursor: 'pointer', transition: 'var(--t)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Get prediction
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ allMatches, matchesLoading, selectedMatch, onSelectMatch }) {
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);

  return (
    <div className="tv-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>

      {/* Sidebar — match picker */}
      <div style={{ flex: '0 0 clamp(220px, 30%, 320px)', minWidth: '220px' }}>
        <SectionHeading label="Select a Match" />
        {matchesLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
          </div>
        ) : allMatches.length === 0 ? (
          <EmptyState icon="🎾" title="No matches available" desc="Check back soon for upcoming fixtures." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allMatches.map(m => (
              <MatchPickerRow
                key={m.id} match={m}
                selected={selectedMatch?.id === m.id}
                onSelect={() => onSelectMatch(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main — prediction output */}
      <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
        <SectionHeading label="Match Analysis" />
        {!selectedMatch ? (
          <EmptyState
            icon="🔮"
            title="Select a match to analyse"
            desc="Pick any match on the left to see win probabilities, surface analysis, and key stat breakdowns."
          />
        ) : predLoading ? (
          <PredictionSkeleton />
        ) : predError ? (
          <ErrorMessage msg={predError} />
        ) : (
          <PredictionPanel match={selectedMatch} prediction={prediction} />
        )}
      </div>
    </div>
  );
}

function MatchPickerRow({ match: m, selected, onSelect }) {
  const [hov, setHov] = useState(false);
  const active = selected || hov;
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: '5px',
        padding: '12px 14px', width: '100%', textAlign: 'left',
        background: selected ? 'rgba(159,239,102,0.08)' : hov ? 'var(--bg-glass-md)' : 'var(--bg-card)',
        border: `1px solid ${active ? 'rgba(159,239,102,0.35)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'var(--t)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 500 }}>{m.tournament}</span>
        {m.status === 'live' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--green)', fontWeight: 700 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'tv-live-dot 1.2s ease infinite' }} />
            LIVE
          </span>
        )}
      </div>
      <span style={{ fontSize: '13.5px', fontWeight: 600, color: selected ? 'var(--lime)' : 'var(--text)', lineHeight: 1.3 }}>
        {m.player1.flag} {m.player1.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {m.player2.flag} {m.player2.name}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{m.round} · {m.surface}</span>
    </button>
  );
}

function PredictionSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
      <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
    </div>
  );
}

function PredictionPanel({ match: m, prediction: pred }) {
  if (!pred) return <ErrorMessage msg="Could not compute prediction." />;
  const { player1_win_pct: p1, player2_win_pct: p2, confidence, key_factors } = pred;
  const confColor = CONF_COLOR[confidence] ?? 'var(--text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Win probability card */}
      <Card glow style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--lime),var(--lime-dark),transparent)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
              Win Probability
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px,2.5vw,19px)', fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              {m.player1.name} vs {m.player2.name}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {m.tournament} · {m.round} · {m.surface}
            </p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 12px', borderRadius: '999px',
            background: `${confColor}18`, color: confColor,
            border: `1px solid ${confColor}30`,
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            {confidence} confidence
          </span>
        </div>

        {/* Player bars */}
        {[
          { player: m.player1, pct: p1, color: 'var(--lime)' },
          { player: m.player2, pct: p2, color: 'var(--clay)' },
        ].map(({ player, pct, color }) => (
          <div key={player.id} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{player.flag}</span>
                {player.name}
                <span style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 400 }}>#{player.rank}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '18px', color }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: pct > 55
                  ? `linear-gradient(90deg,${color},${color}cc)`
                  : `${color}88`,
                borderRadius: 99,
                transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: pct > 60 ? `0 0 12px ${color}55` : 'none',
              }} />
            </div>
          </div>
        ))}
      </Card>

      {/* Key factors card */}
      {key_factors?.length > 0 && (
        <Card>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px', fontFamily: 'var(--font-mono)' }}>
            Key Factors
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {key_factors.map((factor, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--lime)', flexShrink: 0,
                }} />
                <span style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{factor}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKINGS TAB
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab() {
  const [tour, setTour] = useState('ATP');
  const [hovRow, setHovRow] = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  return (
    <div className="tv-fade-up">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <SectionHeading label={`${tour} World Rankings`} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['ATP', 'WTA'].map(t => (
            <button key={t} onClick={() => setTour(t)} style={{
              padding: '6px 20px', borderRadius: '999px', cursor: 'pointer', transition: 'var(--t)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '13px',
              background: tour === t ? 'var(--lime)' : 'var(--bg-glass-md)',
              color: tour === t ? '#070B14' : 'var(--text-muted)',
              border: tour === t ? 'none' : '1px solid var(--border)',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <RankingsSkeleton />
      ) : error ? (
        <ErrorMessage msg={error} />
      ) : rankings.length === 0 ? (
        <EmptyState icon="🏆" title="No rankings data" desc="Rankings sync runs daily. Check back soon." />
      ) : (
        <Card padding="0" style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr 110px 90px 70px',
            padding: '11px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-glass)',
          }}>
            {['#', 'Player', 'Points', 'W / L', 'Surface'].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {rankings.map((p, i) => {
            const rankChange = p.prev_rank != null ? p.prev_rank - p.rank : 0;
            const surfColor  = SURFACE_COLOR[p.surface_pref] ?? 'var(--blue)';

            return (
              <div
                key={p.id}
                onMouseEnter={() => setHovRow(p.id)}
                onMouseLeave={() => setHovRow(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 110px 90px 70px',
                  padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
                  background: hovRow === p.id ? 'rgba(159,239,102,0.04)' : 'transparent',
                  transition: 'var(--t)',
                }}
              >
                {/* Rank */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    fontSize: i < 3 ? '15px' : '13px',
                    color: i === 0 ? 'var(--lime)' : i === 1 ? 'var(--yellow)' : i === 2 ? 'var(--clay)' : 'var(--text-faint)',
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
                  </span>
                  {rankChange !== 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: rankChange > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {rankChange > 0 ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
                    </span>
                  )}
                </div>

                {/* Player */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{p.flag}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.2 }}>{p.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>{p.country}</p>
                  </div>
                </div>

                {/* Points */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: hovRow === p.id ? 'var(--lime)' : 'var(--text)', fontSize: '13px',
                }}>
                  {p.points?.toLocaleString() ?? '—'}
                </span>

                {/* W/L */}
                <span style={{ fontSize: '13px' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>{p.wins ?? 0}</span>
                  <span style={{ color: 'var(--text-faint)' }}> / {p.losses ?? 0}</span>
                </span>

                {/* Surface chip */}
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase',
                  background: `${surfColor}18`, color: surfColor, border: `1px solid ${surfColor}28`,
                  whiteSpace: 'nowrap',
                }}>
                  {p.surface_pref ?? '—'}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function RankingsSkeleton() {
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '11px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)' }}>
        <div className="skeleton" style={{ height: 14, width: 200, borderRadius: 4 }} />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', borderBottom: i < 9 ? '1px solid var(--border)' : 'none' }}>
          <div className="skeleton" style={{ width: 28, height: 20, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: '50%', height: 14, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: '30%', height: 11, borderRadius: 4 }} />
          </div>
          <div className="skeleton" style={{ width: 60, height: 14, borderRadius: 4 }} />
        </div>
      ))}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT TAB
// ─────────────────────────────────────────────────────────────────────────────
function AiChatTab({ contextMatch }) {
  const { messages, typing, sendMessage, reset, bottomRef } = useAiChat(contextMatch);
  const [input, setInput] = useState('');

  function submit(e) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  }

  const suggestions = [
    'Who is favoured today?',
    'Explain clay vs hard court',
    'What is first-serve percentage?',
    "Djokovic vs Alcaraz head-to-head",
  ];

  return (
    <div className="tv-fade-up" style={{
      display: 'grid',
      gridTemplateColumns: contextMatch ? '1fr 280px' : '1fr',
      gap: '20px',
      alignItems: 'start',
    }}>

      {/* Chat panel */}
      <Card padding="0" style={{ display: 'flex', flexDirection: 'column', height: 'clamp(500px,70vh,720px)' }}>
        {/* Chat header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🤖</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>AI Tennis Analyst</p>
              <p style={{ fontSize: '11px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                Online
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            title="Clear chat"
            style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '6px 12px',
              color: 'var(--text-faint)', fontSize: '12px',
              cursor: 'pointer', transition: 'var(--t)',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            Clear
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
          {typing && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
              <div style={{ padding: '11px 16px', background: 'var(--bg-card-alt)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 2px' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: 18 }}>
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)', animation: `tv-live-dot 1s ease ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions — only on first message */}
        {messages.length === 1 && (
          <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => sendMessage(s)} style={{
                padding: '5px 12px', background: 'var(--bg-glass)',
                border: '1px solid var(--border)', borderRadius: '999px',
                color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                fontFamily: 'var(--font-body)', transition: 'var(--t)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--lime)'; e.currentTarget.style.borderColor = 'rgba(159,239,102,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={submit} style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about any match, player, or tournament…"
            style={{
              flex: 1, padding: '10px 16px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-md)',
              borderRadius: '999px', color: 'var(--text)', fontSize: '14px',
              outline: 'none', fontFamily: 'var(--font-body)', transition: 'var(--t)',
            }}
            onFocus={e  => e.currentTarget.style.borderColor = 'rgba(159,239,102,0.4)'}
            onBlur={e   => e.currentTarget.style.borderColor = 'var(--border-md)'}
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !typing ? 'var(--lime)' : 'var(--bg-glass-md)',
              border: 'none', cursor: input.trim() && !typing ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'var(--t)',
            }}
          >
            {typing
              ? <Spinner size={16} color="var(--text-faint)" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#070B14' : 'var(--text-faint)'} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            }
          </button>
        </form>
      </Card>

      {/* Context card (only when a match is selected) */}
      {contextMatch && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SectionHeading label="Match Context" />
          <Card>
            <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {contextMatch.tournament} · {contextMatch.round}
            </p>
            <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{contextMatch.player1.flag} {contextMatch.player1.name}</p>
            <p style={{ color: 'var(--text-faint)', fontSize: '13px', margin: '6px 0' }}>vs</p>
            <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>{contextMatch.player2.flag} {contextMatch.player2.name}</p>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
              padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase',
              background: `${SURFACE_COLOR[contextMatch.surface] ?? 'var(--blue)'}18`,
              color: SURFACE_COLOR[contextMatch.surface] ?? 'var(--blue)',
              border: `1px solid ${SURFACE_COLOR[contextMatch.surface] ?? 'var(--blue)'}28`,
            }}>
              {contextMatch.surface}
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '14px', lineHeight: 1.6 }}>
              The analyst has context about this match. Ask specific questions for tailored predictions.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ msg }) {
  const isAI = msg.role === 'assistant';
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: isAI ? 'row' : 'row-reverse' }}>
      {isAI && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
      )}
      <div style={{
        maxWidth: '80%', padding: '11px 15px',
        background: isAI ? 'var(--bg-card-alt)' : 'rgba(159,239,102,0.1)',
        border: `1px solid ${isAI ? 'var(--border)' : 'rgba(159,239,102,0.22)'}`,
        borderRadius: isAI ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
        fontSize: '14px', lineHeight: 1.65, color: 'var(--text)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeading({ label, dot }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: 'clamp(14px,2vw,16px)', letterSpacing: '-0.01em',
      marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
      color: 'var(--text)', margin: '0 0 16px 0',
    }}>
      {dot && (
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, animation: 'tv-live-dot 1.2s ease infinite' }} />
      )}
      {label}
      <span style={{ flex: 1, height: '1px', background: 'var(--border)', display: 'block', marginLeft: '4px' }} />
    </h2>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div style={{
      padding: '32px', textAlign: 'center',
      background: 'rgba(248,113,113,0.05)',
      border: '1px solid rgba(248,113,113,0.18)',
      borderRadius: 'var(--radius)',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
      <p style={{ color: 'var(--red)', marginBottom: onRetry ? '16px' : 0, fontSize: '14px' }}>{msg}</p>
      {onRetry && <Btn variant="danger" size="sm" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ padding: '52px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '44px', marginBottom: '14px', opacity: 0.65 }}>{icon}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', marginBottom: '10px', color: 'var(--text)' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '300px', margin: '0 auto', lineHeight: 1.72 }}>{desc}</p>
    </div>
  );
}