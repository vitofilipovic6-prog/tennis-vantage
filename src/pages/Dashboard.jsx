// ─────────────────────────────────────────────────────────────────────────────
// src/pages/Dashboard.jsx – TennisVantage main app screen
//
// CHANGES IN THIS VERSION:
//  + MATCH_FILTERS constant — 5 filter pills: ATP, WTA, ATP Doubles, WTA Doubles, Mixed
//  + MatchesTab — filter pills above calendar; live + upcoming filtered by match_type
//  + PredictionsTab — filter pills in sidebar; match list filtered by match_type
//  + Past day view also filtered by match_type
//
// All prior fixes preserved:
//  #1  useRankings — session cache (no re-fetch on tab switch)
//  #2  Navbar cleaned up — desktop only
//  #3  Rankings table responsive — W/L hidden on mobile
//  #4  PredictionsTab stacks to single column on mobile
//  #5  AiChatTab — input locked while typing, char counter
//  #6  BOTTOM TAB BAR — replaces hamburger drawer
//  #7  scroll-to-top on every tab switch
//  #9  Calendar date filter uses real ISO date comparison
//  #10 MatchCard wrapped in React.memo
//  #11 Main content padded above bottom nav bar
//  #12 PlayerSearchModal full-screen on mobile
//  #13 RankingsTab tour filter pills wrap on narrow screens
//  #14 Greeting email hidden on tiny screens
//  #15 MatchCard player name ellipsis overflow protection
//  #17 PlayerSearchModal wired to navbar search button
//  #18 H2H panel wired into PredictionsTab
//  PlayerBioModal opens when clicking any player row in Rankings
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat, CHAT_MAX_CHARS } from '../hooks/hooks';
import { getHeadToHead, getMatchesByDate } from '../services/tennisApi';
import { Logo, Btn, Badge, Card } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';
import PlayerBioModal from '../components/PlayerBioModal';
import PlayerSearchModal from '../components/PlayerSearchModal';

// ─────────────────────────────────────────────────────────────────────────────
// MATCH TYPE FILTER DEFINITIONS
// id must match the match_type values stored in the DB / returned by normaliseMatch
// ─────────────────────────────────────────────────────────────────────────────
const MATCH_FILTERS = [
  { id: 'atp_singles',   label: 'ATP',           shortLabel: 'ATP',    color: '#60a5fa' },
  { id: 'wta_singles',   label: 'WTA',           shortLabel: 'WTA',    color: '#f472b6' },
  { id: 'atp_doubles',   label: 'ATP Doubles',   shortLabel: 'ATP 2×', color: '#818cf8' },
  { id: 'wta_doubles',   label: 'WTA Doubles',   shortLabel: 'WTA 2×', color: '#fb7185' },
  { id: 'mixed_doubles', label: 'Mixed Doubles', shortLabel: 'Mixed',  color: '#34d399' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();

  const [activeTab, setActiveTab]         = useState('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [bioPlayer, setBioPlayer]         = useState(null);

  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();
  const allMatches = useMemo(() => [...live, ...upcoming], [live, upcoming]);

  // Collect unique players from all matches for the search modal
  const allPlayersForSearch = useMemo(() => {
    const seen    = new Set();
    const players = [];
    allMatches.forEach(m => {
      [m.player1, m.player2].forEach(p => {
        if (p?.id && !seen.has(p.id)) { seen.add(p.id); players.push(p); }
      });
    });
    return players.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [allMatches]);

  const tabs = [
    { id: 'matches',     label: 'Matches',  icon: '🎾' },
    { id: 'predictions', label: 'Predict',  icon: '🔮' },
    { id: 'rankings',    label: 'Rankings', icon: '🏆' },
    { id: 'chat',        label: 'AI Chat',  icon: '🤖' },
  ];

  async function handleLogout() {
    await logout();
    showToast('Signed out successfully', 'info');
  }

  function switchTab(id) {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectMatch(match) {
    setSelectedMatch(match);
    switchTab('predictions');
  }

  function handleChatAboutPlayer(player) {
    showToast(`Asking AI about ${player.name}…`, 'info');
    switchTab('chat');
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Navbar ─────────────────────────────────────────────────── */}
      <nav style={{
        background: 'rgba(7,11,20,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)',
        height: '62px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: '12px',
      }}>
        {/* Left: Logo + Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto' }}>
          <Logo size="sm" />
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 14px',
              background: 'var(--bg-glass-md)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)', fontSize: '13px',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'var(--t)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search players
          </button>
        </div>

        {/* Right: Desktop tabs + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
          {/* Desktop tab buttons — hidden on mobile via CSS bottom nav */}
          <div className="tv-desktop-tabs" style={{ display: 'flex', gap: '2px' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                style={{
                  padding: '7px 14px',
                  background: activeTab === t.id ? 'var(--bg-glass-md)' : 'none',
                  border: activeTab === t.id ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer', transition: 'var(--t)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Avatar / logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#9fef66,#6bc940)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '13px', color: '#070B14',
            }}>
              {(firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
              }}
            >
              Out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="tv-main-content" style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: 'clamp(20px,3vh,40px) clamp(16px,3vw,40px)',
      }}>
        {/* Greeting */}
        <div className="tv-fade-up" style={{ marginBottom: 'clamp(24px,4vh,40px)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(20px,3vw,28px)', letterSpacing: '-0.02em',
          }}>
            Good game, <span style={{ color: 'var(--lime)' }}>{firstName}</span> 👋
          </h1>
          <p className="tv-greeting-email" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {user?.email} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {activeTab === 'matches' && (
          <MatchesTab
            live={live}
            upcoming={upcoming}
            loading={matchesLoading}
            error={matchesError}
            refresh={refresh}
            onSelectMatch={handleSelectMatch}
          />
        )}
        {activeTab === 'predictions' && (
          <PredictionsTab
            allMatches={allMatches}
            matchesLoading={matchesLoading}
            selectedMatch={selectedMatch}
            onSelectMatch={setSelectedMatch}
          />
        )}
        {activeTab === 'rankings' && (
          <RankingsTab onSelectPlayer={p => setBioPlayer(p)} />
        )}
        {activeTab === 'chat' && (
          <AiChatTab contextMatch={selectedMatch} />
        )}
      </main>

      {/* ── BOTTOM TAB BAR (mobile only — CSS hides it on desktop) ─────── */}
      <nav className="tv-bottom-nav" aria-label="Main navigation">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tv-bottom-nav__item${activeTab === t.id ? ' active' : ''}`}
            onClick={() => switchTab(t.id)}
            aria-label={t.label}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {searchOpen && (
        <PlayerSearchModal
          allPlayers={allPlayersForSearch}
          onClose={() => setSearchOpen(false)}
          onChatAboutPlayer={handleChatAboutPlayer}
        />
      )}
      {bioPlayer && (
        <PlayerBioModal
          player={bioPlayer}
          onClose={() => setBioPlayer(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER PILLS — reusable pill row used in both Matches and Predictions tabs
// ─────────────────────────────────────────────────────────────────────────────
function FilterPills({ activeFilter, onSelect, size = 'normal' }) {
  return (
    <div style={{
      display: 'flex',
      gap: size === 'small' ? '6px' : '8px',
      flexWrap: 'wrap',
      marginBottom: size === 'small' ? '12px' : '20px',
    }}>
      {MATCH_FILTERS.map(f => {
        const active = activeFilter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            style={{
              padding: size === 'small' ? '4px 12px' : '6px 16px',
              borderRadius: '999px',
              border: active ? 'none' : '1px solid var(--border)',
              background: active ? f.color : 'var(--bg-glass-md)',
              color: active ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: size === 'small' ? '11px' : '12px',
              cursor: 'pointer',
              transition: 'var(--t)',
              whiteSpace: 'nowrap',
            }}
          >
            {size === 'small' ? f.shortLabel : f.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES TAB
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, upcoming, loading, error, refresh, onSelectMatch }) {
  const [calendarDate, setCalendarDate] = useState(null);
  const [activeFilter, setActiveFilter] = useState('atp_singles');
  const [pastMatches,  setPastMatches]  = useState([]);
  const [pastLoading,  setPastLoading]  = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const selectedDay = useMemo(() => {
    if (!calendarDate) return null;
    const d = new Date(calendarDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [calendarDate]);

  const isPastDay       = selectedDay && selectedDay < today;
  const isTodayOrFuture = !selectedDay || selectedDay >= today;

  useEffect(() => {
    if (!isPastDay) { setPastMatches([]); return; }
    let cancelled = false;
    setPastLoading(true);
    const dateStr = calendarDate.toISOString().split('T')[0];
    getMatchesByDate(dateStr)
      .then(data => { if (!cancelled) setPastMatches(data ?? []); })
      .catch(()  => { if (!cancelled) setPastMatches([]); })
      .finally(() => { if (!cancelled) setPastLoading(false); });
    return () => { cancelled = true; };
  }, [calendarDate?.toDateString(), isPastDay]);

  if (loading) return <LoadingGrid />;
  if (error)   return <ErrorMessage msg={error} onRetry={refresh} />;

  const byType = (arr) => arr.filter(m => (m.match_type ?? 'atp_singles') === activeFilter);

  const filteredLive = byType(live);
  const filteredUpcoming = byType(
    selectedDay && isTodayOrFuture
      ? upcoming.filter(m => {
          if (!m.date) return false;
          const d = new Date(m.date);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === selectedDay.getTime();
        })
      : upcoming
  );
  const filteredPast = byType(pastMatches);
  const activeFilterDef = MATCH_FILTERS.find(f => f.id === activeFilter);

  return (
    <div className="tv-fade-up">

      {/* ── 1. Filter pills FIRST (single row, single source of truth) ── */}
      <FilterPills activeFilter={activeFilter} onSelect={setActiveFilter} />

      {/* ── 2. Calendar date strip SECOND ───────────────────────────── */}
      <MatchCalendar onSelectDate={setCalendarDate} />

      {/* ── PAST DAY ─────────────────────────────────────────────────── */}
      {isPastDay ? (
        <section>
          <SectionHeading label={`${activeFilterDef?.label} — ${calendarDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`} />
          {pastLoading ? (
            <LoadingGrid />
          ) : filteredPast.length === 0 ? (
            <EmptyState
              icon="📅"
              title={`No ${activeFilterDef?.label} results`}
              desc="No matches found for this filter on this day."
            />
          ) : (
            <div style={gridStyle}>
              {filteredPast.map((m, i) => (
                <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                  <MatchCard match={m} onPredict={() => onSelectMatch(m)} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {filteredLive.length > 0 && (
            <section style={{ marginBottom: '40px' }}>
              <SectionHeading label="Live Now" dot />
              <div style={gridStyle}>
                {filteredLive.map(m => (
                  <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionHeading label={
              selectedDay
                ? `Upcoming — ${selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`
                : `${activeFilterDef?.label} — Upcoming`
            } />
            {filteredUpcoming.length === 0 ? (
              <EmptyState
                icon="🎾"
                title={`No ${activeFilterDef?.label} matches`}
                desc="Try a different filter or check another date."
              />
            ) : (
              <div style={gridStyle}>
                {filteredUpcoming.map((m, i) => (
                  <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                    <MatchCard match={m} onPredict={() => onSelectMatch(m)} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH CARD
// ─────────────────────────────────────────────────────────────────────────────
const MatchCard = memo(function MatchCard({ match: m, onPredict }) {
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const surfaceColor  = surfaceColors[m.surface] ?? '#94a3b8';

  // Only show a type badge if we actually know the type — no ATP fallback
  const matchTypeDef = m.match_type
    ? MATCH_FILTERS.find(f => f.id === m.match_type)
    : null;

  const isFinished = m.status === 'finished';
  const isLive     = m.status === 'live';

  return (
    <Card>
      {/* Tournament + surface + type badge row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {m.tournament}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.round}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Only render badge if match_type is actually known */}
          {matchTypeDef && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
              background: `${matchTypeDef.color}22`,
              color: matchTypeDef.color,
              border: `1px solid ${matchTypeDef.color}44`,
              whiteSpace: 'nowrap',
            }}>
              {matchTypeDef.shortLabel}
            </span>
          )}
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
            background: `${surfaceColor}18`, color: surfaceColor,
          }}>
            {m.surface}
          </span>
          {isLive && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: 700, color: 'var(--lime)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <span className="live-dot" style={{ width: '6px', height: '6px' }} />
              Live
            </span>
          )}
          {isFinished && (
            <span style={{
              fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Final
            </span>
          )}
        </div>
      </div>

      {/* Players */}
      {[m.player1, m.player2].map((p, i) => {
        const isWinner = isFinished && m.winner_id && m.winner_id === p?.id;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 0',
            borderTop: i === 0 ? '1px solid var(--border)' : 'none',
            borderBottom: '1px solid var(--border)',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{p?.flag ?? '🏳️'}</span>
              <div style={{ minWidth: 0 }}>
                <p className="tv-match-card-name" style={{
                  fontWeight: 600, fontSize: '14px',
                  color: isWinner ? 'var(--lime)' : 'var(--text)',
                }}>
                  {p?.name ?? 'TBD'}
                  {isWinner && <span style={{ marginLeft: '6px', fontSize: '11px' }}>🏆</span>}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                  {p?.rank !== 999 ? `#${p?.rank}` : 'Unranked'}
                </p>
              </div>
            </div>
            {m.score && (
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {m.score.split(',').map((s, si) => (
                  <span key={si} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600,
                    color: i === 0 ? 'var(--lime)' : 'var(--text)',
                  }}>
                    {s.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer button — no predict for finished/live matches */}
      {isFinished ? (
        <div style={{
          marginTop: '14px',
          padding: '9px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-faint)',
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}>
          Match Complete
        </div>
      ) : (
        <Btn variant="lime" size="sm" fullWidth style={{ marginTop: '16px' }} onClick={onPredict}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {isLive ? 'Predict winner' : 'Predict this match'}
        </Btn>
      )}
    </Card>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// Only shows upcoming + live matches (no finished) — you can't predict the past
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ allMatches, matchesLoading, selectedMatch, onSelectMatch }) {
  const [predFilter, setPredFilter] = useState('atp_singles');
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);
  const [h2h, setH2h]           = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  // Only today + future matches are predictable
  const predictableMatches = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return allMatches.filter(m => {
      // Always include live matches
      if (m.status === 'live') return true;
      // Exclude finished
      if (m.status === 'finished') return false;
      // For upcoming, only today or future
      if (m.date) {
        const d = new Date(m.date);
        d.setHours(0, 0, 0, 0);
        return d >= now;
      }
      return true;
    });
  }, [allMatches]);

  function handleFilterChange(filterId) {
    setPredFilter(filterId);
    onSelectMatch(null);
  }

  useEffect(() => {
    if (!selectedMatch) { setH2h(null); return; }
    let cancelled = false;
    setH2hLoading(true);
    getHeadToHead(selectedMatch.player1.id, selectedMatch.player2.id)
      .then(data  => { if (!cancelled) setH2h(data); })
      .catch(()   => { if (!cancelled) setH2h(null); })
      .finally(() => { if (!cancelled) setH2hLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMatch?.player1?.id, selectedMatch?.player2?.id]);

  const filteredMatches = predictableMatches.filter(
    m => (m.match_type ?? 'atp_singles') === predFilter
  );

  return (
    <div className="tv-fade-up">
      <div className="tv-predictions-layout" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'start' }}>

        {/* ── Match picker sidebar ───────────────────────────────────── */}
        <div className="tv-predictions-sidebar" style={{ flex: '0 0 clamp(200px, 30%, 340px)', minWidth: '200px' }}>

          <FilterPills activeFilter={predFilter} onSelect={handleFilterChange} size="small" />

          {/* Info note — predictions are forward-looking only */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 12px', marginBottom: '12px',
            background: 'rgba(159,239,102,0.05)',
            border: '1px solid rgba(159,239,102,0.15)',
            borderRadius: '8px',
          }}>
            <span style={{ fontSize: '12px' }}>🔮</span>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)', lineHeight: 1.4 }}>
              Showing live & upcoming matches only
            </span>
          </div>

          <SectionHeading label="Select a Match" />
          {matchesLoading ? (
            <LoadingGrid cols={1} rows={3} />
          ) : filteredMatches.length === 0 ? (
            <EmptyState icon="🎾" title="No upcoming matches" desc="Check back soon for new fixtures." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredMatches.map(m => (
                <MatchPickerRow
                  key={m.id}
                  match={m}
                  selected={selectedMatch?.id === m.id}
                  onSelect={() => onSelectMatch(m)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Prediction panel ───────────────────────────────────────── */}
        <div className="tv-predictions-main" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <SectionHeading label="Match Analysis" />
          {!selectedMatch ? (
            <EmptyState
              icon="🔮"
              title="Select a match to analyse"
              desc="Choose any upcoming or live match from the left to see our AI prediction breakdown."
            />
          ) : predLoading ? (
            <PredictionSkeleton />
          ) : predError ? (
            <ErrorMessage msg={predError} />
          ) : prediction ? (
            <>
              <PredictionCard match={selectedMatch} prediction={prediction} />
              <div style={{ marginTop: '20px' }}>
                <SectionHeading label="Head to Head" />
                {h2hLoading ? (
                  <LoadingGrid cols={1} rows={2} />
                ) : h2h ? (
                  <H2HPanel h2h={h2h} match={selectedMatch} />
                ) : (
                  <EmptyState icon="📊" title="No H2H data yet" desc="Not enough historical matches recorded." />
                )}
              </div>
            </>
          ) : null}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTION CARD
// ─────────────────────────────────────────────────────────────────────────────
function PredictionCard({ match: m, prediction: pred }) {
  const p1        = m.player1;
  const p2        = m.player2;
  const confColor = pred.confidence === 'High' ? 'var(--lime)'
                  : pred.confidence === 'Medium' ? 'var(--yellow)'
                  : 'var(--clay)';

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.tournament} · {m.round}</p>
          <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
            {p1.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {p2.name}
          </p>
        </div>
        <span style={{
          fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px',
          background: `${confColor}18`, color: confColor,
          border: `1px solid ${confColor}44`,
        }}>
          {pred.confidence} confidence
        </span>
      </div>

      {/* Win probability bars */}
      {[
        { player: p1, pct: pred.player1_win_pct, color: 'var(--lime)' },
        { player: p2, pct: pred.player2_win_pct, color: 'var(--clay)' },
      ].map(({ player, pct, color }) => (
        <div key={player.id} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
              {player.flag} {player.name}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-glass)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: '99px',
              background: color, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
        </div>
      ))}

      {/* Key factors */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pred.key_factors.map((f, i) => (
          <div key={i} style={{
            padding: '10px 14px', background: 'var(--bg-glass)',
            border: '1px solid var(--border)', borderRadius: '8px',
            fontSize: '13px', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ color: 'var(--lime)', flexShrink: 0 }}>→</span>
            {f}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH PICKER ROW (inside Predictions sidebar)
// ─────────────────────────────────────────────────────────────────────────────
function MatchPickerRow({ match: m, selected, onSelect }) {
  // No fallback to 'atp_singles' — only show badge if type is actually known
  const matchTypeDef = m.match_type
    ? MATCH_FILTERS.find(f => f.id === m.match_type)
    : null;

  const isLive = m.status === 'live';

  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 14px',
        background: selected ? 'rgba(159,239,102,0.08)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--lime)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'var(--t)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '6px' }}>
        <p style={{
          fontSize: '11px', color: 'var(--text-faint)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0,
        }}>
          {m.tournament} · {m.round}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isLive && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              fontSize: '9px', fontWeight: 700, color: 'var(--lime)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <span className="live-dot" style={{ width: '5px', height: '5px' }} />
              Live
            </span>
          )}
          {matchTypeDef && (
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
              background: `${matchTypeDef.color}22`, color: matchTypeDef.color,
            }}>
              {matchTypeDef.shortLabel}
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: '13px', fontWeight: 600, color: selected ? 'var(--lime)' : 'var(--text)', lineHeight: 1.5 }}>
        {m.player1?.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {m.player2?.name}
      </p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// H2H PANEL
// ─────────────────────────────────────────────────────────────────────────────
function H2HPanel({ h2h, match }) {
  const p1 = match.player1;
  const p2 = match.player2;

  return (
    <Card>
      {/* Scoreline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px' }}>{p1.flag} {p1.name.split(' ').pop()}</p>
          <p style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>{h2h.p1_wins}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px' }}>Total</p>
          <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-muted)' }}>{h2h.total}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px' }}>{p2.flag} {p2.name.split(' ').pop()}</p>
          <p style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--clay)' }}>{h2h.p2_wins}</p>
        </div>
      </div>

      {/* Last 5 */}
      {h2h.last5?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Last {h2h.last5.length} meetings</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {h2h.last5.map((r, i) => (
              <span key={i} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700,
                background: r === 'W' ? 'rgba(159,239,102,0.15)' : 'rgba(249,115,22,0.15)',
                color: r === 'W' ? 'var(--lime)' : 'var(--clay)',
              }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meeting history */}
      {h2h.meetings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {h2h.meetings.map((meet, i) => {
            const sc = meet.surface === 'Clay' ? '#f97316' : meet.surface === 'Grass' ? '#4ade80' : '#60a5fa';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--bg-glass)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                flexWrap: 'wrap', gap: '6px',
              }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{meet.year} · {meet.tournament}</span>
                  <span style={{ fontSize: '11px', color: sc, marginLeft: '8px' }}>{meet.surface}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {meet.score && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{meet.score}</span>}
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                    background: meet.winner === 'p1' ? 'rgba(159,239,102,0.12)' : 'rgba(249,115,22,0.12)',
                    color: meet.winner === 'p1' ? 'var(--lime)' : 'var(--clay)',
                  }}>
                    {meet.winner === 'p1' ? p1.name.split(' ').pop() : p2.name.split(' ').pop()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKINGS TAB
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab({ onSelectPlayer }) {
  const [tour, setTour]     = useState('ATP');
  const [hovRow, setHovRow] = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  return (
    <div className="tv-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SectionHeading label={`${tour} Live Rankings`} />
        <div className="tv-rankings-filters" style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {['ATP', 'WTA'].map(t => (
            <button
              key={t}
              onClick={() => setTour(t)}
              style={{
                padding: '6px 18px', borderRadius: '999px',
                border: tour === t ? 'none' : '1px solid var(--border)',
                background: tour === t ? 'var(--lime)' : 'var(--bg-glass-md)',
                color: tour === t ? '#070B14' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '13px',
                cursor: 'pointer', transition: 'var(--t)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingGrid cols={1} rows={8} />
      ) : error ? (
        <ErrorMessage msg={error} />
      ) : (
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <div className="rankings-row rankings-header" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)' }}>
            {['#', 'Player', 'Points', 'W/L'].map(h => (
              <span
                key={h}
                className={h === 'W/L' ? 'rankings-wl' : ''}
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {h}
              </span>
            ))}
          </div>

          {rankings.map((p, i) => (
            <div
              key={p.id}
              onMouseEnter={() => setHovRow(p.id)}
              onMouseLeave={() => setHovRow(null)}
              onClick={() => onSelectPlayer?.(p)}
              className="rankings-row"
              style={{
                borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
                background: hovRow === p.id ? 'rgba(159,239,102,0.06)' : 'transparent',
                transition: 'var(--t)',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                fontSize: i < 3 ? '16px' : '14px',
                color: i === 0 ? 'var(--lime)' : i === 1 ? 'var(--yellow)' : i === 2 ? 'var(--clay)' : 'var(--text-faint)',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{p.flag}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontWeight: 600, fontSize: '14.5px',
                    color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
                    transition: 'color 0.15s',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{p.country} · {p.surface_pref}</p>
                </div>
              </div>

              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: hovRow === p.id ? 'var(--lime)' : 'var(--text)', fontSize: '14px',
              }}>
                {p.points?.toLocaleString()}
              </span>

              <span className="rankings-wl" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--green)' }}>{p.wins}</span>
                <span style={{ color: 'var(--text-faint)' }}>/{p.losses}</span>
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
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
    if (!input.trim() || typing) return;
    sendMessage(input);
    setInput('');
  }

  const charsLeft = CHAT_MAX_CHARS - input.length;
  const charColor = charsLeft < 50 ? 'var(--red)' : charsLeft < 100 ? 'var(--yellow)' : 'var(--text-faint)';

  const suggestions = [
    'Who is favoured to win today?',
    'Explain clay vs hard court performance',
    "What does 'first serve percentage' mean?",
    "Compare Djokovic and Alcaraz's recent form",
  ];

  return (
    <div className="tv-fade-up tv-chat-layout" style={{
      display: 'grid',
      gridTemplateColumns: contextMatch ? 'minmax(0,1fr) 280px' : '1fr',
      gap: '20px',
      alignItems: 'start',
    }}>
      {/* Chat column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Card padding="0" style={{ overflow: 'hidden' }}>

          {/* ── Chat header with Clear button ───────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🤖</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '14px',
                color: 'var(--text)',
              }}>
                AI Analyst
              </span>
            </div>
            <button
              onClick={reset}
              title="Clear chat"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '7px',
                color: 'var(--text-faint)',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'var(--t)',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--red)';
                e.currentTarget.style.color = 'var(--red)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-faint)';
              }}
            >
              {/* Trash icon */}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              Clear
            </button>
          </div>

          {/* Message list */}
          <div className="tv-chat-column" style={{
            height: 'clamp(340px,52vh,520px)',
            overflowY: 'auto',
            padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'var(--lime)' : 'var(--bg-glass-md)',
                  color: msg.role === 'user' ? '#070B14' : 'var(--text)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  fontWeight: msg.role === 'user' ? 600 : 400,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
                  display: 'flex', gap: '5px', alignItems: 'center',
                }}>
                  {[0,1,2].map(j => (
                    <div key={j} className="skeleton" style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      animationDelay: `${j * 0.15}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  padding: '6px 12px', borderRadius: '999px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'var(--t)',
                }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Input */}
        <form onSubmit={submit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value.slice(0, CHAT_MAX_CHARS))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={typing ? 'AI is thinking…' : 'Ask about any match, player, or stat…'}
              disabled={typing}
              rows={1}
              style={{
                width: '100%', resize: 'none', overflow: 'hidden',
                padding: '12px 16px', paddingBottom: '26px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '12px', color: 'var(--text)',
                fontFamily: 'var(--font-body)', fontSize: '14px',
                outline: 'none', transition: 'border-color 0.2s',
                opacity: typing ? 0.6 : 1, lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
              onFocus={e  => { e.target.style.borderColor = 'var(--lime)'; }}
              onBlur={e   => { e.target.style.borderColor = 'var(--border)'; }}
            />
            <span style={{
              position: 'absolute', bottom: '8px', right: '12px',
              fontSize: '10px', color: charColor,
              fontFamily: 'var(--font-mono)', pointerEvents: 'none',
            }}>
              {charsLeft}
            </span>
          </div>
          <Btn
            variant="primary" size="md" type="submit"
            disabled={!input.trim() || typing}
            style={{ height: '46px', paddingLeft: '18px', paddingRight: '18px', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </Btn>
        </form>
      </div>

      {/* Context panel */}
      {contextMatch && (
        <div className="tv-chat-context-panel">
          <SectionHeading label="Match Context" />
          <Card>
            <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {contextMatch.tournament} · {contextMatch.round}
            </p>
            <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '12px', lineHeight: 1.4 }}>
              {contextMatch.player1.name}
              <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> vs </span>
              {contextMatch.player2.name}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {contextMatch.surface}
              </span>
              {contextMatch.status === 'live' && (
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(159,239,102,0.1)', border: '1px solid rgba(159,239,102,0.3)', color: 'var(--lime)' }}>
                  LIVE
                </span>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 30%, 400px), 1fr))',
  gap: '16px',
};

function SectionHeading({ label, dot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      {dot && <span className="live-dot" />}
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 'clamp(15px,2vw,18px)', letterSpacing: '-0.01em', color: 'var(--text)',
      }}>
        {label}
      </h2>
    </div>
  );
}

function LoadingGrid({ cols = 2, rows = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px' }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: cols === 1 ? '72px' : '160px', borderRadius: '12px' }} />
      ))}
    </div>
  );
}

function PredictionSkeleton() {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="skeleton" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ width: '80px', height: '20px', borderRadius: '999px' }} />
      </div>
      {[0, 1].map(i => (
        <div key={i} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="skeleton" style={{ width: '140px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '40px', height: '16px', borderRadius: '4px' }} />
          </div>
          <div className="skeleton" style={{ height: '8px', borderRadius: '99px' }} />
        </div>
      ))}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: '40px', borderRadius: '8px' }} />
        ))}
      </div>
    </Card>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div style={{
      padding: '20px', background: 'rgba(248,113,113,0.07)',
      border: '1px solid rgba(248,113,113,0.2)', borderRadius: '12px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <p style={{ color: 'var(--red)', fontSize: '14px' }}>⚠️ {msg}</p>
      {onRetry && (
        <Btn variant="danger" size="sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          Try again
        </Btn>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '16px',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>{title}</p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  );
}