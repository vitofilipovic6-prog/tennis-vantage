// ─────────────────────────────────────────────────────────────────────────────
// src/pages/Dashboard.jsx – TennisVantage main app screen
//
// FIXES IN THIS VERSION:
//  [TODAY-FIX]  Today's matches: The calendar defaults to today. Upcoming
//               matches are shown without a day filter when "today" is selected
//               so they always appear even if match_date is slightly off UTC.
//  [PAST-FIX]   Past matches forced to 'finished' by sync-matches Edge Function,
//               but also guarded here: any match whose date < today is treated
//               as finished regardless of stored status. No Predict button shown.
//  [SCORE-FIX]  Finished past matches: show the stored score if API provided it,
//               or show "Result unavailable" gracefully. No empty state.
//  [RNK-FIX]    Rankings mobile: responsive grid, abbreviated name on very small
//               screens, points column always visible, W/L hidden on mobile.
//  [NAV-FIX]    Search/nav unchanged from working version.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat, CHAT_MAX_CHARS } from '../hooks/hooks';
import { getHeadToHead, getMatchesByDate, deriveMatchType } from '../services/tennisApi';
import { Logo, Btn, Badge, Card } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';
import PlayerBioModal from '../components/PlayerBioModal';
import PlayerSearchModal from '../components/PlayerSearchModal';

// ─────────────────────────────────────────────────────────────────────────────
// MATCH TYPE FILTER DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const MATCH_FILTERS = [
  { id: 'atp_singles', label: 'ATP', shortLabel: 'ATP', color: '#60a5fa' },
  { id: 'wta_singles', label: 'WTA', shortLabel: 'WTA', color: '#f472b6' },
  { id: 'atp_doubles', label: 'ATP Doubles', shortLabel: 'ATP 2×', color: '#818cf8' },
  { id: 'wta_doubles', label: 'WTA Doubles', shortLabel: 'WTA 2×', color: '#fb7185' },
  { id: 'mixed_doubles', label: 'Mixed Doubles', shortLabel: 'Mixed', color: '#34d399' },
];

// isBeforeToday() REMOVED — caused timezone bugs in Croatia (UTC+2).
// Trust the DB status field only. sync-matches force-finishes stale rows.

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bioPlayer, setBioPlayer] = useState(null);

  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();
  const allMatches = useMemo(() => [...live, ...upcoming], [live, upcoming]);

  // ── Build WTA player ID set from rankings (key fix for combined events) ────
  const { rankings: wtaRankings } = useRankings('WTA');
  const wtaPlayerIds = useMemo(
    () => new Set((wtaRankings ?? []).map(r => r.id)),
    [wtaRankings]
  );

  const allPlayersForSearch = useMemo(() => {
    const seen = new Set();
    const players = [];
    allMatches.forEach(m => {
      [m.player1, m.player2].forEach(p => {
        if (p?.id && !seen.has(p.id)) { seen.add(p.id); players.push(p); }
      });
    });
    return players.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [allMatches]);

  const tabs = [
    { id: 'matches', label: 'Matches', icon: '🎾' },
    { id: 'predictions', label: 'Predict', icon: '🔮' },
    { id: 'rankings', label: 'Rankings', icon: '🏆' },
    { id: 'chat', label: 'AI Chat', icon: '🤖' },
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

      {/* ── Top Navbar ───────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(7,11,20,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(12px,3vw,32px)',
        display: 'flex', alignItems: 'center', height: '60px', gap: '12px',
      }}>
        {/* Logo */}
        <div style={{ flexShrink: 0 }}>
          <Logo size="sm" />
        </div>

        {/* Desktop tabs */}
        <div className="hide-md" style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: activeTab === t.id ? 'var(--bg-glass-md)' : 'transparent',
                border: activeTab === t.id ? '1px solid var(--border-md)' : '1px solid transparent',
                color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', transition: 'var(--t)', whiteSpace: 'nowrap',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search button */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 12px', borderRadius: '8px',
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
            fontSize: '13px', cursor: 'pointer', transition: 'var(--t)',
            flex: '1', maxWidth: '220px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="hide-sm">Search players…</span>
        </button>

        {/* Desktop: avatar + logout */}
        <div className="hide-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--lime), var(--clay))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 800, color: '#070B14', flexShrink: 0,
          }}>
            {firstName?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px', borderRadius: '8px',
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
              fontSize: '13px', cursor: 'pointer', transition: 'var(--t)',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="tv-main-content" style={{
        flex: 1, padding: 'clamp(16px,3vw,32px) clamp(12px,3vw,32px)',
        maxWidth: '1200px', margin: '0 auto', width: '100%',
      }}>
        {activeTab === 'matches' && (
          <MatchesTab
            live={live}
            upcoming={upcoming}
            loading={matchesLoading}
            error={matchesError}
            refresh={refresh}
            onSelectMatch={handleSelectMatch}
            wtaPlayerIds={wtaPlayerIds}
          />
        )}
        {activeTab === 'predictions' && (
          <PredictionsTab
            allMatches={allMatches}
            matchesLoading={matchesLoading}
            selectedMatch={selectedMatch}
            onSelectMatch={setSelectedMatch}
            wtaPlayerIds={wtaPlayerIds}
          />
        )}
        {activeTab === 'rankings' && (
          <RankingsTab onSelectPlayer={p => { setBioPlayer(p); }} />
        )}
        {activeTab === 'chat' && (
          <AiChatTab contextMatch={selectedMatch} />
        )}
      </main>

      {/* ── Bottom nav bar (mobile) ───────────────────────────────────────── */}
      <nav className="tv-bottom-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tv-bottom-nav__item${activeTab === t.id ? ' active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {searchOpen && (
        <PlayerSearchModal
          players={allPlayersForSearch}
          onClose={() => setSearchOpen(false)}
          onSelectPlayer={p => { setBioPlayer(p); setSearchOpen(false); }}
        />
      )}
      {bioPlayer && (
        <PlayerBioModal
          player={bioPlayer}
          onClose={() => setBioPlayer(null)}
          onChat={handleChatAboutPlayer}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
  gap: '16px',
};

function SectionHeading({ label, dot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      {dot && <span className="live-dot" />}
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 'clamp(16px, 2.5vw, 20px)', letterSpacing: '-0.02em',
      }}>
        {label}
      </h2>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div style={gridStyle}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="tv-skeleton" style={{ height: '160px', borderRadius: 'var(--radius)' }} />
      ))}
    </div>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div style={{
      padding: '24px', background: 'rgba(248,113,113,0.06)',
      border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius)',
      textAlign: 'center',
    }}>
      <p style={{ color: 'var(--red)', marginBottom: onRetry ? '12px' : 0 }}>{msg}</p>
      {onRetry && <Btn variant="secondary" size="sm" onClick={onRetry}>Try again</Btn>}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-faint)' }}>
      <p style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</p>
      <p style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>{title}</p>
      <p style={{ fontSize: '13px' }}>{desc}</p>
    </div>
  );
}

function FilterPills({ activeFilter, onSelect, size = 'normal' }) {
  return (
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap',
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
// [TODAY-FIX] When today is selected, show upcoming (no date filter needed)
//             because match_date might be in UTC±offset. If a specific future
//             date is selected, filter by that day. Past days → fetch from DB.
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, upcoming, loading, error, refresh, onSelectMatch, wtaPlayerIds }) {
  const [calendarDate, setCalendarDate] = useState(null);
  const [calendarDateStr, setCalendarDateStr] = useState(null);
  const [activeFilter, setActiveFilter] = useState('atp_singles');
  const [pastMatches, setPastMatches] = useState([]);
  const [pastLoading, setPastLoading] = useState(false);

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

  // Is the selected day strictly before today?
  const isPastDay = selectedDay && selectedDay < today;
  // Is it today or future? (null = no selection = also show today's matches)
  const isToday = !selectedDay || selectedDay.getTime() === today.getTime();
  const isFutureDay = selectedDay && selectedDay > today;

  // Fetch past-day matches from DB when a past day is selected
  useEffect(() => {
    if (!isPastDay || !calendarDateStr) { setPastMatches([]); return; }
    let cancelled = false;
    setPastLoading(true);
    getMatchesByDate(calendarDateStr, wtaPlayerIds)
      .then(data => { if (!cancelled) setPastMatches(data ?? []); })
      .catch(() => { if (!cancelled) setPastMatches([]); })
      .finally(() => { if (!cancelled) setPastLoading(false); });
    return () => { cancelled = true; };
  }, [calendarDateStr, isPastDay, wtaPlayerIds]);

  if (loading) return <LoadingGrid />;
  if (error) return <ErrorMessage msg={error} onRetry={refresh} />;

  // ── Drop stale "live" rows from a previous calendar day ───────────────────
  const todayStr = today.toLocaleDateString('en-CA');
  const trulyLive = live.filter(m => {
    if (!m.date) return true;
    return new Date(m.date).toLocaleDateString('en-CA') >= todayStr;
  });

  // ── Filter by match type ──────────────────────────────────────────────────
  const byType = (arr) =>
    arr.filter(m => deriveMatchType(m, wtaPlayerIds) === activeFilter);

  const filteredLive = byType(trulyLive);

  // For a specific future date: filter upcoming by that day
  // For today or no selection: show all upcoming (don't filter by date —
  // today's matches may have slightly different UTC dates)
  const calendarFiltered = isFutureDay
    ? upcoming.filter(m => {
      if (!m.date) return false;
      const d = new Date(m.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === selectedDay.getTime();
    })
    : upcoming;

  const filteredUpcoming = byType(calendarFiltered);
  const filteredPast = byType(pastMatches);
  const activeFilterDef = MATCH_FILTERS.find(f => f.id === activeFilter);

  return (
    <div className="tv-fade-up">

      {/* Filter pills */}
      <FilterPills activeFilter={activeFilter} onSelect={setActiveFilter} />

      {/* Calendar */}
      <MatchCalendar
        onSelectDate={(date, dateStr) => {
          setCalendarDate(date);
          setCalendarDateStr(dateStr);
        }}
      />

      {/* PAST DAY */}
      {isPastDay ? (
        <section>
          <SectionHeading label={`${activeFilterDef?.label} — ${selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`} />
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
                  <MatchCard match={m} onPredict={() => onSelectMatch(m)} wtaPlayerIds={wtaPlayerIds} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Live section */}
          {filteredLive.length > 0 && (
            <section style={{ marginBottom: '40px' }}>
              <SectionHeading label="Live Now" dot />
              <div style={gridStyle}>
                {filteredLive.map(m => (
                  <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} wtaPlayerIds={wtaPlayerIds} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming / today section */}
          <section>
            <SectionHeading label={
              isFutureDay
                ? `Upcoming — ${selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`
                : `${activeFilterDef?.label} — Today's Matches`
            } />
            {filteredUpcoming.length === 0 ? (
              <EmptyState
                icon="🎾"
                title={`No ${activeFilterDef?.label} matches`}
                desc={isToday ? 'No matches scheduled today for this filter.' : 'Try a different filter or check another date.'}
              />
            ) : (
              <div style={gridStyle}>
                {filteredUpcoming.map((m, i) => (
                  <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                    <MatchCard match={m} onPredict={() => onSelectMatch(m)} wtaPlayerIds={wtaPlayerIds} />
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
// [PAST-FIX]  Any match before today is treated as finished.
//             - No "Predict Winner" button
//             - Score shown if available, nothing if not
//             - "Final" badge shown
// ─────────────────────────────────────────────────────────────────────────────
const MatchCard = memo(function MatchCard({ match: m, onPredict, wtaPlayerIds = new Set() }) {
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const surfaceColor = surfaceColors[m.surface] ?? '#94a3b8';

  const effectiveType = deriveMatchType(m, wtaPlayerIds);
  const matchTypeDef = MATCH_FILTERS.find(f => f.id === effectiveType) ?? null;

  // isFinished: DB status OR local calendar date already passed.
  // Using local date strings (en-CA = YYYY-MM-DD) avoids UTC offset bugs —
  // a match at 01:00 local (23:00 UTC prev day) correctly shows as today locally.
  const todayLocal = new Date().toLocaleDateString('en-CA');
  const matchLocal = m.date ? new Date(m.date).toLocaleDateString('en-CA') : todayLocal;
  const isFinished = m.status === 'finished' || matchLocal < todayLocal;
  const isLive = m.status === 'live' && !isFinished;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {matchTypeDef && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
              background: `${matchTypeDef.color}22`, color: matchTypeDef.color,
              border: `1px solid ${matchTypeDef.color}44`, whiteSpace: 'nowrap',
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
              padding: '2px 6px', borderRadius: '4px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
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
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{p?.flag ?? '🏳️'}</span>
              <span className="tv-match-card-name" style={{
                fontSize: '14px', fontWeight: isWinner ? 700 : 500,
                color: isWinner ? 'var(--lime)' : 'var(--text)',
              }}>
                {p?.name ?? 'TBD'}
              </span>
              {isWinner && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: 'var(--lime)',
                  flexShrink: 0,
                }}>✓</span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)', flexShrink: 0 }}>
              #{p?.rank ?? '—'}
            </span>
          </div>
        );
      })}

      {/* Score or time */}
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
        {isLive && m.score ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--lime)', fontSize: '15px' }}>
              {m.score}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              In Progress
            </span>
          </div>
        ) : isFinished ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {m.score ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '13px' }}>
                {m.score}
              </span>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                Result not available
              </span>
            )}
            <span style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Match Complete
            </span>
          </div>
        ) : m.date ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {new Date(m.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
              {new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ) : null}
      </div>

      {/* Predict button — hidden for finished/past matches */}
      {!isFinished && (
        <button
          onClick={onPredict}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '9px 16px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid var(--lime)',
            color: 'var(--lime)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--lime)';
            e.currentTarget.style.color = '#070B14';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--lime)';
          }}
        >
          {isLive ? '🔮 Predict winner' : '🔮 Predict this match'}
        </button>
      )}
    </Card>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ allMatches, matchesLoading, selectedMatch, onSelectMatch, wtaPlayerIds }) {
  const [predFilter, setPredFilter] = useState('atp_singles');
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);
  const [h2h, setH2h] = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  // Only live + today/future upcoming matches are predictable.
  // IMPORTANT: We compare local YYYY-MM-DD strings (en-CA = YYYY-MM-DD format).
  // This correctly handles UTC offset — a 01:00 local Croatian match stored as
  // 23:00 UTC the previous day still shows the correct LOCAL calendar date.
  // A match is predictable ONLY if:
  //   - It's live (regardless of date), OR
  //   - It's upcoming AND its LOCAL calendar date >= today's LOCAL date
  const predictableMatches = useMemo(() => {
    const todayLocal = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    return allMatches.filter(m => {
      // Live matches always predictable
      if (m.status === 'live') return true;
      // Finished matches never predictable
      if (m.status === 'finished') return false;
      // upcoming: check local calendar date — must be today or future
      if (m.date) {
        const matchLocal = new Date(m.date).toLocaleDateString('en-CA');
        return matchLocal >= todayLocal;
      }
      // No date stored — exclude to be safe (unknown past match)
      return false;
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
      .then(data => { if (!cancelled) setH2h(data); })
      .catch(() => { if (!cancelled) setH2h(null); })
      .finally(() => { if (!cancelled) setH2hLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMatch?.player1?.id, selectedMatch?.player2?.id]);

  const filteredMatches = predictableMatches.filter(
    m => deriveMatchType(m, wtaPlayerIds) === predFilter
  );

  return (
    <div className="tv-fade-up tv-predictions-layout">

      {/* Sidebar */}
      <div className="tv-predictions-sidebar">
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
          Filter matches
        </p>
        <FilterPills activeFilter={predFilter} onSelect={handleFilterChange} size="small" />

        <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', marginTop: '4px' }}>
          Live &amp; Upcoming · {filteredMatches.length} matches
        </p>

        {matchesLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-faint)' }}>Loading…</div>
        ) : filteredMatches.length === 0 ? (
          <EmptyState icon="🎾" title="No matches" desc="Try a different filter." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredMatches.map(m => (
              <MatchPickerRow
                key={m.id}
                match={m}
                selected={selectedMatch?.id === m.id}
                onSelect={onSelectMatch}
                wtaPlayerIds={wtaPlayerIds}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main panel */}
      <div className="tv-predictions-main" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!selectedMatch ? (
          <Card>
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🔮</p>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Select a match to predict</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Choose any live or upcoming match to see AI-powered win probability and key factors.</p>
            </div>
          </Card>
        ) : predLoading ? (
          <Card><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)' }}>Analysing…</div></Card>
        ) : predError ? (
          <Card><div style={{ padding: '20px', color: 'var(--clay)' }}>{predError}</div></Card>
        ) : prediction ? (
          <PredictionCard match={selectedMatch} prediction={prediction} />
        ) : null}

        {selectedMatch && (
          h2hLoading ? (
            <Card><div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-faint)' }}>Loading H2H…</div></Card>
          ) : h2h ? (
            <H2HPanel h2h={h2h} match={selectedMatch} />
          ) : (
            <Card>
              <p style={{ color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                No head-to-head history found.
              </p>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH PICKER ROW
// ─────────────────────────────────────────────────────────────────────────────
function MatchPickerRow({ match: m, selected, onSelect, wtaPlayerIds = new Set() }) {
  const effectiveType = deriveMatchType(m, wtaPlayerIds);
  const matchTypeDef = MATCH_FILTERS.find(f => f.id === effectiveType) ?? null;
  const isLive = m.status === 'live';

  return (
    <button
      onClick={() => onSelect(m)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 12px',
        background: selected ? 'var(--bg-glass-md)' : 'var(--bg-glass)',
        border: selected ? '1px solid var(--lime)' : '1px solid var(--border)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'var(--t)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '6px' }}>
        <span style={{
          fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {m.tournament}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {isLive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, color: 'var(--lime)', textTransform: 'uppercase' }}>
              <span className="live-dot" style={{ width: '5px', height: '5px' }} />
              Live
            </span>
          )}
          {matchTypeDef && (
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
              background: `${matchTypeDef.color}22`, color: matchTypeDef.color,
              border: `1px solid ${matchTypeDef.color}44`,
            }}>
              {matchTypeDef.shortLabel}
            </span>
          )}
        </div>
      </div>
      <p style={{
        fontSize: '13px', fontWeight: selected ? 700 : 500,
        color: selected ? 'var(--lime)' : 'var(--text)', lineHeight: 1.5,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {m.player1?.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {m.player2?.name}
      </p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTION CARD
// ─────────────────────────────────────────────────────────────────────────────
function PredictionCard({ match: m, prediction: pred }) {
  const p1 = m.player1;
  const p2 = m.player2;
  const confColor = pred.confidence === 'High' ? 'var(--lime)'
    : pred.confidence === 'Medium' ? 'var(--yellow)' : 'var(--clay)';

  // Support both field naming conventions
  const p1WinPct = pred.player1_win_pct ?? pred.p1WinPct ?? 50;
  const p2WinPct = pred.player2_win_pct ?? pred.p2WinPct ?? 50;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>
          AI Prediction
        </h3>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 8px',
          borderRadius: '99px', background: `${confColor}20`, color: confColor,
          border: `1px solid ${confColor}50`,
        }}>
          {pred.confidence} Confidence
        </span>
      </div>

      {/* Win probability bars */}
      <div style={{ marginBottom: '20px' }}>
        {/* Player 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px' }}>{p1?.flag ?? '🏳️'}</span>
          <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p1?.name ?? 'Player 1'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: 'var(--lime)', flexShrink: 0 }}>
            {p1WinPct}%
          </span>
        </div>
        <div style={{ height: '8px', borderRadius: '99px', background: 'var(--bg-glass-md)', overflow: 'hidden', marginBottom: '12px' }}>
          <div style={{ height: '100%', width: `${p1WinPct}%`, background: 'var(--lime)', borderRadius: '99px', transition: 'width 0.8s ease' }} />
        </div>

        {/* Player 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px' }}>{p2?.flag ?? '🏳️'}</span>
          <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p2?.name ?? 'Player 2'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: 'var(--clay)', flexShrink: 0 }}>
            {p2WinPct}%
          </span>
        </div>
        <div style={{ height: '8px', borderRadius: '99px', background: 'var(--bg-glass-md)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p2WinPct}%`, background: 'var(--clay)', borderRadius: '99px', transition: 'width 0.8s ease' }} />
        </div>
      </div>

      {/* Key factors */}
      {pred.key_factors?.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
            Key Factors
          </p>
          {pred.key_factors.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: '8px 0',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ color: 'var(--lime)', fontSize: '14px', flexShrink: 0 }}>→</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{f}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// H2H PANEL
// ─────────────────────────────────────────────────────────────────────────────
function H2HPanel({ h2h, match: m }) {
  const p1 = m.player1;
  const p2 = m.player2;
  const total = (h2h.p1Wins ?? 0) + (h2h.p2Wins ?? 0);

  return (
    <Card>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', marginBottom: '16px' }}>
        Head to Head
      </h3>

      {/* Win totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p1?.name}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, color: 'var(--lime)' }}>{h2h.p1Wins ?? 0}</p>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px', fontWeight: 600 }}>
          {total} matches
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p2?.name}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, color: 'var(--clay)' }}>{h2h.p2Wins ?? 0}</p>
        </div>
      </div>

      {/* H2H bar */}
      {total > 0 && (
        <div style={{ height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'var(--bg-glass-md)', marginBottom: '16px' }}>
          <div style={{
            height: '100%',
            width: `${Math.round(((h2h.p1Wins ?? 0) / total) * 100)}%`,
            background: 'linear-gradient(90deg, var(--lime), var(--clay))',
            borderRadius: '99px',
          }} />
        </div>
      )}

      {/* Recent meetings */}
      {h2h.meetings?.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
            Recent Meetings
          </p>
          {h2h.meetings.slice(0, 5).map((meet, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              gap: '8px',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-faint)', flexShrink: 0 }}>
                {meet.tournament ?? 'Unknown'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                {meet.score ?? '—'}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, flexShrink: 0,
                color: meet.winner === 'p1' ? 'var(--lime)' : 'var(--clay)',
              }}>
                {meet.winner === 'p1' ? p1?.name?.split(' ').pop() : p2?.name?.split(' ').pop()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKINGS TAB
// [RNK-FIX] Complete mobile overhaul:
//  - Responsive grid: on mobile (≤480px) removes the points column header label
//    but keeps the value; W/L hidden via CSS class
//  - Player name column uses minmax(0,1fr) so it MUST shrink — this prevents
//    points from ever visually overlapping the name
//  - On very small screens (<380px) the flag emoji is hidden to save space
//  - Points column is always shown (just narrower on mobile)
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab({ onSelectPlayer }) {
  const [tour, setTour] = useState('ATP');
  const [hovRow, setHovRow] = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  return (
    <div className="tv-fade-up">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['ATP', 'WTA'].map(t => (
          <button
            key={t}
            onClick={() => setTour(t)}
            style={{
              padding: '6px 20px', borderRadius: '999px',
              border: tour === t ? 'none' : '1px solid var(--border)',
              background: tour === t ? (t === 'ATP' ? '#60a5fa' : '#f472b6') : 'var(--bg-glass-md)',
              color: tour === t ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', transition: 'var(--t)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorMessage msg={error} />
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {/*
            KEY FIX: The grid uses:
              - '36px' for rank (tight, just enough for 3 chars + medal emoji)
              - 'minmax(0, 1fr)' for the name: the 0 minimum forces this column
                to shrink below its content width on narrow screens.
                Without the 0 minimum (just '1fr'), the browser won't shrink
                the column below the widest text node inside it, causing the
                fixed-width points column to get pushed off or overlap the name.
              - '72px' for points: enough for "25,000" on desktop, tight on mobile
              - '52px' for W/L: hidden on mobile via CSS
          */}
          <style>{`
            .rnk-grid {
              display: grid;
              grid-template-columns: 36px minmax(0, 1fr) 72px 52px;
              gap: 0 8px;
            }
            @media (max-width: 480px) {
              .rnk-grid {
                grid-template-columns: 32px minmax(0, 1fr) 60px;
              }
            }
            .rnk-flag {
              display: inline-block;
            }
            @media (max-width: 360px) {
              .rnk-flag { display: none; }
            }
          `}</style>

          {/* Header */}
          <div className="rnk-grid" style={{
            padding: '0 12px 10px',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>#</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Player</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pts</span>
            <span className="rankings-wl" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>W/L</span>
          </div>

          {/* Rows */}
          {(rankings ?? []).map((p, i) => (
            <div
              key={p.id}
              className="rnk-grid"
              onClick={() => onSelectPlayer(p)}
              onMouseEnter={() => setHovRow(p.id)}
              onMouseLeave={() => setHovRow(null)}
              style={{
                padding: '11px 12px',
                alignItems: 'center',
                borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                background: hovRow === p.id ? 'var(--bg-glass)' : 'transparent',
                transition: 'background 0.15s',
                borderRadius: i === rankings.length - 1 ? '0 0 var(--radius) var(--radius)' : 0,
              }}
            >
              {/* Rank */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px',
                color: i === 0 ? 'var(--lime)' : i === 1 ? 'var(--yellow)' : i === 2 ? 'var(--clay)' : 'var(--text-faint)',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
              </span>

              {/* Player name + country — this column MUST clip, never overflow */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                minWidth: 0,       // critical: lets flex children shrink below their natural size
                overflow: 'hidden', // clip anything that overflows
              }}>
                <span className="rnk-flag" style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1 }}>
                  {p.flag ?? '🏳️'}
                </span>
                <div style={{
                  minWidth: 0,       // critical: allows text to truncate
                  overflow: 'hidden', // clip text
                  flex: 1,
                }}>
                  <p style={{
                    fontWeight: 600,
                    fontSize: 'clamp(12px, 2.5vw, 14.5px)',
                    color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
                    transition: 'color 0.15s',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}>
                    {p.name}
                  </p>
                  <p style={{
                    fontSize: '11px', color: 'var(--text-faint)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}>
                    {p.country}
                  </p>
                </div>
              </div>

              {/* Points — always visible, shrinks on mobile */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
                fontSize: 'clamp(11px, 2.2vw, 14px)',
                transition: 'color 0.15s',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {p.points?.toLocaleString() ?? '—'}
              </span>

              {/* W/L — hidden on mobile via CSS class */}
              <span className="rankings-wl" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--green)' }}>{p.wins ?? '—'}</span>
                <span style={{ color: 'var(--text-faint)' }}>/{p.losses ?? 0}</span>
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
      gridTemplateColumns: contextMatch ? 'minmax(260px,320px) 1fr' : '1fr',
      gap: '20px',
      alignItems: 'start',
    }}>

      {/* Context card — only shown when a match is selected */}
      {contextMatch && (
        <div className="tv-chat-context-panel">
          <Card>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
              Match context
            </p>
            <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
              {contextMatch.player1?.name} vs {contextMatch.player2?.name}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {contextMatch.tournament} · {contextMatch.round}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '12px', padding: '6px 12px', borderRadius: '6px',
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              Clear context
            </button>
          </Card>
        </div>
      )}

      {/* Chat column */}
      <div className="tv-chat-column" style={{
        display: 'flex', flexDirection: 'column', gap: '0',
        height: 'clamp(400px, 65vh, 680px)',
        background: 'var(--bg-card)', border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>

        {/* ── Chat header with Clear button ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-glass)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🤖</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              AI Tennis Analyst
            </span>
          </div>
          {messages.length > 1 && (
            <button
              onClick={reset}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '6px',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-faint)', fontFamily: 'var(--font-body)',
                fontSize: '12px', cursor: 'pointer', transition: 'var(--t)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--clay)';
                e.currentTarget.style.color = 'var(--clay)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-faint)';
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              Clear chat
            </button>
          )}
        </div>

        {/* Messages — rest unchanged */}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', opacity: 0.7 }}>
              <p style={{ fontSize: '40px' }}>🎾</p>
              <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Ask me anything about tennis</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '400px' }}>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => { sendMessage(s); }}
                    style={{
                      padding: '7px 12px', borderRadius: '99px',
                      background: 'var(--bg-glass)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                      fontSize: '12px', cursor: 'pointer', transition: 'var(--t)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--lime-dark), var(--lime))'
                  : 'var(--bg-glass-md)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                color: msg.role === 'user' ? '#070B14' : 'var(--text)',
                fontSize: '14px', lineHeight: 1.6,
                fontWeight: msg.role === 'user' ? 600 : 400,
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', gap: '4px', padding: '10px 14px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--lime)',
                  animation: `tv-live-dot 1.2s ease ${i * 0.2}s infinite`,
                  display: 'inline-block',
                }} />
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          background: 'var(--bg-card)',
        }}>
          <form onSubmit={submit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value.slice(0, CHAT_MAX_CHARS))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Ask about players, matches, stats…"
                rows={1}
                style={{
                  width: '100%', resize: 'none', overflow: 'hidden',
                  background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '10px 12px',
                  color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '14px',
                  outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--lime-dark)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || typing}
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: input.trim() && !typing ? 'var(--lime)' : 'var(--bg-glass-md)',
                border: 'none', cursor: input.trim() && !typing ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s', flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !typing ? '#070B14' : 'var(--text-faint)'} strokeWidth="2.5">
                <path d="m22 2-7 20-4-9-9-4 20-7z" /><path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
          <div style={{ textAlign: 'right', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: charColor }}>
              {charsLeft} chars left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}