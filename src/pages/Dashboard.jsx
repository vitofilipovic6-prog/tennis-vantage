// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx – TennisVantage main app screen
//
// NEW IN THIS VERSION:
//  + MatchesTab: queries Supabase per-date via useMatchesByDate (not memory filter)
//  + ATP / WTA / All tour filter (from MatchCalendar pills) applied to match list
//  + Skeleton loaders on date change instead of full spinner
//  + Past matches (finished) show score + "Finished" badge; predict button hidden
//  + PredictionsTab: only shows upcoming/live matches; past matches excluded
//  + MatchCard: "Predict" button replaced by results badge for finished matches
//  + Timezone-safe local date comparisons throughout
//  + All previous fixes preserved
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useMatches, useMatchesByDate, useRankings,
  usePrediction, useAiChat, CHAT_MAX_CHARS, detectTour,
} from '../hooks/hooks';
import { getHeadToHead } from '../services/tennisApi';
import { Logo, Btn, Badge, Card } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';
import PlayerBioModal from '../components/PlayerBioModal';
import PlayerSearchModal from '../components/PlayerSearchModal';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '16px',
};

// Timezone-safe local YYYY-MM-DD
function toLocalDateStr(date) {
  const d  = date instanceof Date ? date : new Date(date);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

// Returns true if a match is in the past (finished or match_date before today)
function isMatchPast(match) {
  if (match.status === 'finished') return true;
  if (!match.date) return false;
  const matchDay = new Date(match.date);
  matchDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return matchDay < today;
}

// Filter matches by tour (ATP/WTA/All) using the detectTour heuristic
function filterByTour(matches, tourFilter) {
  if (tourFilter === 'All') return matches;
  return matches.filter(m => detectTour(m.tournament) === tourFilter);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();

  const [activeTab, setActiveTab]       = useState('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [bioPlayer, setBioPlayer]       = useState(null);

  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();

  // Only upcoming + live matches go to the prediction picker
  const predictableMatches = useMemo(
    () => [...live, ...upcoming].filter(m => !isMatchPast(m)),
    [live, upcoming]
  );

  // All players across live + upcoming for the search modal
  const allPlayersForSearch = useMemo(() => {
    const seen = new Set();
    const players = [];
    [...live, ...upcoming].forEach(m => {
      [m.player1, m.player2].forEach(p => {
        if (p?.id && !seen.has(p.id)) { seen.add(p.id); players.push(p); }
      });
    });
    return players.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [live, upcoming]);

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
    if (isMatchPast(match)) return; // guard: never open past matches in predictor
    setSelectedMatch(match);
    switchTab('predictions');
  }

  function handleChatAboutPlayer(player) {
    showToast(`Asking AI about ${player.name}…`, 'info');
    switchTab('chat');
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Navbar ──────────────────────────────────────────────────── */}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span className="hide-xs">Search players</span>
          </button>
        </div>

        {/* Desktop tab bar */}
        <div className="tv-desktop-tabs" style={{ display: 'flex', gap: '4px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 16px',
                background: activeTab === t.id ? 'rgba(159,239,102,0.1)' : 'transparent',
                border: activeTab === t.id ? '1px solid rgba(159,239,102,0.3)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', transition: 'var(--t)',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right: user avatar + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' }}>
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
              background: 'none', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-muted)',
              padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '12px',
            }}
          >
            Out
          </button>
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="tv-main-content" style={{
        flex: 1, maxWidth: '1200px', width: '100%',
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
            loading={matchesLoading}
            error={matchesError}
            refresh={refresh}
            onSelectMatch={handleSelectMatch}
          />
        )}
        {activeTab === 'predictions' && (
          <PredictionsTab
            predictableMatches={predictableMatches}
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

      {/* ── BOTTOM TAB BAR (mobile only) ────────────────────────────────── */}
      <nav className="tv-bottom-nav" aria-label="Main navigation">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tv-bottom-nav__item${activeTab === t.id ? ' tv-bottom-nav__item--active' : ''}`}
            onClick={() => switchTab(t.id)}
            aria-label={t.label}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
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
// MATCHES TAB
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, loading: liveLoading, error, refresh, onSelectMatch }) {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [selectedDate, setSelectedDate]     = useState(today);
  const [selectedDateStr, setSelectedDateStr] = useState(toLocalDateStr(today));
  const [tourFilter, setTourFilter]           = useState('All');

  const { matches: dateMatches, loading: dateLoading, error: dateError } = useMatchesByDate(selectedDateStr);

  const isToday = useMemo(() => {
    const sel = new Date(selectedDate); sel.setHours(0, 0, 0, 0);
    return sel.getTime() === today.getTime();
  }, [selectedDate, today]);

  // On today's view: merge live matches (fresher status) with stored ones
  const mergedMatches = useMemo(() => {
    if (!isToday) return dateMatches;
    const liveIds = new Set(live.map(m => m.id));
    return [...live, ...dateMatches.filter(m => !liveIds.has(m.id))];
  }, [isToday, live, dateMatches]);

  // Apply tour filter
  const visibleMatches = useMemo(
    () => filterByTour(mergedMatches, tourFilter),
    [mergedMatches, tourFilter]
  );

  // Split into live, upcoming, finished sections
  const liveSection     = visibleMatches.filter(m => m.status === 'live');
  const upcomingSection = visibleMatches.filter(m => m.status === 'upcoming');
  const finishedSection = visibleMatches.filter(m => m.status === 'finished');

  const dateLabel = isToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  function handleDateSelect(date, dateStr) {
    setSelectedDate(date);
    setSelectedDateStr(dateStr);
  }

  if (error) return <ErrorMessage msg={error} onRetry={refresh} />;

  return (
    <div className="tv-fade-up">
      <MatchCalendar
        onSelectDate={handleDateSelect}
        onTourFilter={setTourFilter}
      />

      {/* Live section — only today */}
      {isToday && liveSection.length > 0 && !liveLoading && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading label="Live Now" dot />
          <div style={gridStyle}>
            {liveSection.map(m => (
              <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />
            ))}
          </div>
        </section>
      )}

      {/* Skeleton loader while fetching date */}
      {dateLoading && (
        <div style={gridStyle}>
          {[1, 2, 3, 4].map(n => <MatchCardSkeleton key={n} />)}
        </div>
      )}

      {/* Error */}
      {!dateLoading && dateError && (
        <EmptyState icon="⚠️" title="Couldn't load matches" desc={dateError} />
      )}

      {/* Upcoming section */}
      {!dateLoading && !dateError && upcomingSection.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading label={isToday ? 'Upcoming Today' : `Upcoming · ${dateLabel}`} />
          <div style={gridStyle}>
            {upcomingSection.map((m, i) => (
              <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                <MatchCard match={m} onPredict={() => onSelectMatch(m)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Finished section */}
      {!dateLoading && !dateError && finishedSection.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading label="Results" />
          <div style={gridStyle}>
            {finishedSection.map((m, i) => (
              <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                <MatchCard match={m} isPast />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!dateLoading && !dateError && visibleMatches.length === 0 && (
        <EmptyState
          icon="📅"
          title={`No ${tourFilter !== 'All' ? tourFilter + ' ' : ''}matches on ${dateLabel}`}
          desc={
            isToday
              ? 'No matches scheduled today. Try another date or check back soon.'
              : 'No data stored for this date. Matches sync daily at 06:00 UTC.'
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH CARD
// ─────────────────────────────────────────────────────────────────────────────
const MatchCard = memo(function MatchCard({ match: m, onPredict, isPast }) {
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const surfaceColor  = surfaceColors[m.surface] ?? '#94a3b8';
  const tour          = detectTour(m.tournament);
  const tourColor     = tour === 'WTA' ? '#f472b6' : tour === 'ITF' ? '#94a3b8' : 'var(--lime)';

  return (
    <Card hover={!isPast} glow={!isPast}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--text-faint)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {m.tournament}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.round}</p>
        </div>
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginLeft: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {m.status === 'live' && <Badge color="var(--green)">● Live</Badge>}
          {isPast && m.status === 'finished' && <Badge color="var(--text-faint)">Finished</Badge>}
          <Badge color={tourColor}>{tour}</Badge>
          <Badge color={surfaceColor}>{m.surface}</Badge>
        </div>
      </div>

      {/* Players + Scores */}
      {[m.player1, m.player2].map((player, idx) => {
        // Parse score per player — format is "6-4, 7-5" meaning sets
        const sets = m.score ? m.score.split(',').map(s => s.trim()) : [];
        return (
          <div key={player?.id ?? idx} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: idx === 0 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{player?.flag ?? '🏳️'}</span>
              <div style={{ minWidth: 0 }}>
                <p className="tv-match-card-name" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                  {player?.name ?? 'TBD'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>#{player?.rank ?? '—'}</p>
              </div>
            </div>

            {/* Score display for live / finished */}
            {sets.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: '8px' }}>
                {sets.map((set, si) => {
                  const parts = set.split('-');
                  const val   = idx === 0 ? parts[0] : parts[1];
                  const other = idx === 0 ? parts[1] : parts[0];
                  const won   = parseInt(val) > parseInt(other);
                  return (
                    <span key={si} style={{
                      padding: '2px 7px', borderRadius: '4px',
                      background: won ? 'rgba(159,239,102,0.12)' : 'var(--bg-glass-md)',
                      fontSize: '13px', fontWeight: 700,
                      color: won ? 'var(--lime)' : 'var(--text-muted)',
                    }}>
                      {val ?? '—'}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Time tag */}
      {m.date && (
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '10px' }}>
          {new Date(m.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {' · '}
          {new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
      )}

      {/* Predict button — hidden for past / finished matches */}
      {!isPast && m.status !== 'finished' && (
        <Btn
          variant="lime"
          size="sm"
          fullWidth
          style={{ marginTop: '16px' }}
          onClick={onPredict}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Predict this match
        </Btn>
      )}

      {/* Past match CTA — view results only */}
      {(isPast || m.status === 'finished') && (
        <div style={{
          marginTop: '14px',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-faint)',
        }}>
          {m.score ? '✓ Match completed' : 'Result pending'}
        </div>
      )}
    </Card>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MATCH CARD SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function MatchCardSkeleton() {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      minHeight: '180px',
    }}>
      {['75%', '55%', '90%', '40%'].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? '16px' : '13px',
          width: w,
          borderRadius: '6px',
          background: 'linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.05) 50%, var(--bg-card) 75%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.4s infinite',
        }} />
      ))}
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// Only shows upcoming and live matches — past matches are excluded entirely
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ predictableMatches, matchesLoading, selectedMatch, onSelectMatch }) {
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);
  const [h2h, setH2h]             = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [tourFilter, setTourFilter] = useState('All');

  // If a past match somehow ends up selected, clear it
  useEffect(() => {
    if (selectedMatch && isMatchPast(selectedMatch)) {
      onSelectMatch(null);
    }
  }, [selectedMatch, onSelectMatch]);

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

  const filteredMatches = useMemo(
    () => filterByTour(predictableMatches, tourFilter),
    [predictableMatches, tourFilter]
  );

  return (
    <div className="tv-fade-up">
      <div className="tv-predictions-layout" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'start' }}>

        {/* Match picker sidebar */}
        <div className="tv-predictions-sidebar" style={{ flex: '0 0 clamp(200px, 30%, 340px)', minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <SectionHeading label="Select a Match" style={{ marginBottom: 0 }} />
            {/* Tour filter pills in sidebar */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {['All', 'ATP', 'WTA'].map(t => (
                <button
                  key={t}
                  onClick={() => setTourFilter(t)}
                  style={{
                    padding: '4px 10px', borderRadius: '999px',
                    border: tourFilter === t ? 'none' : '1px solid var(--border)',
                    background: tourFilter === t
                      ? t === 'WTA' ? '#f472b6' : 'var(--lime)'
                      : 'var(--bg-glass-md)',
                    color: tourFilter === t ? '#070B14' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '11px',
                    cursor: 'pointer', transition: 'var(--t)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {matchesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(n => (
                <div key={n} style={{
                  height: '62px', borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.04) 50%, var(--bg-card) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'skeleton-shimmer 1.4s infinite',
                }} />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <EmptyState
              icon="🎾"
              title={tourFilter !== 'All' ? `No ${tourFilter} matches` : 'No upcoming matches'}
              desc="No predictable matches right now. Check back later."
            />
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

        {/* Prediction panel */}
        <div className="tv-predictions-main" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <SectionHeading label="Match Analysis" />
          {!selectedMatch ? (
            <EmptyState
              icon="🔮"
              title="Select a match to analyse"
              desc="Choose any upcoming or live match to see our AI prediction breakdown."
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
                  <div style={{ height: '140px', borderRadius: 'var(--radius)', background: 'linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.04) 50%, var(--bg-card) 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.4s infinite' }} />
                ) : h2h ? (
                  <H2HPanel h2h={h2h} match={selectedMatch} />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MatchPickerRow({ match: m, selected, onSelect }) {
  const tour      = detectTour(m.tournament);
  const tourColor = tour === 'WTA' ? '#f472b6' : 'var(--lime)';

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p style={{
          fontSize: '11px', color: 'var(--text-faint)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {m.tournament} · {m.round}
        </p>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '1px 6px',
          borderRadius: '4px', background: `${tourColor}22`,
          color: tourColor, marginLeft: '6px', flexShrink: 0,
        }}>
          {tour}
        </span>
      </div>
      <p style={{ fontSize: '13px', fontWeight: 600, color: selected ? 'var(--lime)' : 'var(--text)', lineHeight: 1.5 }}>
        {m.player1?.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {m.player2?.name}
      </p>
      {m.status === 'live' && (
        <p style={{ fontSize: '11px', color: 'var(--green)', marginTop: '3px', fontWeight: 600 }}>● Live now</p>
      )}
    </button>
  );
}

function PredictionCard({ match: m, prediction: pred }) {
  const p1 = m.player1;
  const p2 = m.player2;
  const confColor = pred.confidence === 'High'
    ? 'var(--lime)'
    : pred.confidence === 'Medium'
      ? 'var(--yellow)'
      : 'var(--text-muted)';

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.tournament} · {m.surface}</p>
        <Badge style={{ background: `${confColor}22`, color: confColor, border: `1px solid ${confColor}44` }}>
          {pred.confidence} confidence
        </Badge>
      </div>

      {[
        { player: p1, pct: pred.player1_win_pct, color: 'var(--lime)' },
        { player: p2, pct: pred.player2_win_pct, color: 'var(--clay)' },
      ].map(({ player, pct, color }) => (
        <div key={player.id} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.flag} {player.name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color, fontSize: '15px', flexShrink: 0 }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-glass)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: '99px',
              background: color, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        </div>
      ))}

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pred.key_factors.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', background: 'var(--bg-glass)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            fontSize: '13px', color: 'var(--text-muted)',
          }}>
            <span style={{ color: 'var(--lime)', flexShrink: 0 }}>▸</span>
            {f}
          </div>
        ))}
      </div>
    </Card>
  );
}

function PredictionSkeleton() {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {['60%', '100%', '100%', '80%', '80%'].map((w, i) => (
          <div key={i} style={{
            height: i < 2 ? '36px' : '48px', width: w, borderRadius: '8px',
            background: 'linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.04) 50%, var(--bg-card) 75%)',
            backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.4s infinite',
          }} />
        ))}
      </div>
    </Card>
  );
}

function H2HPanel({ h2h, match }) {
  const p1 = match.player1;
  const p2 = match.player2;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--lime)' }}>
            {h2h.p1_wins}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p1.name.split(' ').pop()}
          </p>
        </div>
        <div style={{ textAlign: 'center', padding: '0 8px', flexShrink: 0 }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>H2H</p>
          <p style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: '4px 0' }}>vs</p>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{h2h.meetings?.length ?? 0} meetings</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--clay)' }}>
            {h2h.p2_wins}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p2.name.split(' ').pop()}
          </p>
        </div>
      </div>

      {h2h.meetings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '4px' }}>
            Recent Meetings
          </p>
          {h2h.meetings.slice(0, 4).map((meet, i) => {
            const sc = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' }[meet.surface] ?? '#94a3b8';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--bg-glass)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                flexWrap: 'wrap', gap: '6px',
              }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                    {meet.year} · {meet.tournament}
                  </span>
                  <span style={{ fontSize: '11px', color: sc, marginLeft: '8px' }}>{meet.surface}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {meet.score && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {meet.score}
                    </span>
                  )}
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
  const [tour, setTour]   = useState('ATP');
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
                background: tour === t
                  ? t === 'WTA' ? '#f472b6' : 'var(--lime)'
                  : 'var(--bg-glass-md)',
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
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{
                height: '52px', borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.04) 50%, var(--bg-card) 75%)',
                backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.4s infinite',
              }} />
            ))}
          </div>
        </Card>
      ) : error ? (
        <ErrorMessage msg={error} />
      ) : rankings.length === 0 ? (
        <EmptyState icon="🏆" title="No rankings data" desc="Rankings sync daily. Check back soon." />
      ) : (
        <Card>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr 100px 80px',
            gap: '8px', padding: '0 12px 10px',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Rank', 'Player', 'Points', 'W/L'].map((h, i) => (
              <span key={h} style={{
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.07em', color: 'var(--text-faint)',
                textAlign: i > 1 ? 'right' : 'left',
              }}>
                {h}
              </span>
            ))}
          </div>

          {rankings.map((p, i) => (
            <div
              key={p.id}
              onClick={() => onSelectPlayer(p)}
              onMouseEnter={() => setHovRow(p.id)}
              onMouseLeave={() => setHovRow(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 100px 80px',
                gap: '8px', padding: '14px 12px',
                borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
                background: hovRow === p.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderRadius: hovRow === p.id ? 'var(--radius-sm)' : '0',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px',
                alignSelf: 'center',
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
                color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
                fontSize: '14px', textAlign: 'right', alignSelf: 'center',
              }}>
                {p.points?.toLocaleString()}
              </span>

              <span className="rankings-wl" style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right', alignSelf: 'center' }}>
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
      gridTemplateColumns: contextMatch ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr',
      gap: '20px', alignItems: 'start',
    }}>
      {/* Chat panel */}
      <div className="tv-chat-column" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHeading label="AI Tennis Analyst" />
          <Btn variant="ghost" size="sm" onClick={reset}>New chat</Btn>
        </div>

        {/* Messages */}
        <Card style={{ minHeight: '340px', maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'rgba(159,239,102,0.15)' : 'var(--bg-glass)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(159,239,102,0.25)' : 'var(--border)'}`,
                fontSize: '14px', lineHeight: 1.6,
                color: 'var(--text)',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', gap: '4px', padding: '8px 12px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--lime)', opacity: 0.7,
                  animation: `tv-bounce 1.2s ease ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </Card>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg-glass-md)',
                  color: 'var(--text-muted)', fontSize: '12px',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'var(--t)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value.slice(0, CHAT_MAX_CHARS))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask about tactics, players, predictions…"
              disabled={typing}
              rows={2}
              style={{
                flex: 1, padding: '10px 14px',
                background: 'var(--bg-glass-md)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '14px',
                resize: 'none', outline: 'none', lineHeight: 1.5,
                opacity: typing ? 0.6 : 1,
              }}
            />
            <Btn
              variant="lime" size="sm"
              onClick={submit}
              disabled={typing || !input.trim()}
              style={{ alignSelf: 'flex-end', height: '42px', paddingInline: '16px' }}
            >
              Send
            </Btn>
          </div>
          <span style={{ fontSize: '11px', color: charColor, alignSelf: 'flex-end' }}>
            {charsLeft} chars left
          </span>
        </div>
      </div>

      {/* Context panel — only shows when a match is selected */}
      {contextMatch && (
        <div className="tv-chat-context" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SectionHeading label="Match Context" />
          <Card>
            <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: '10px' }}>
              Currently analysing
            </p>
            <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', lineHeight: 1.5 }}>
              {contextMatch.player1?.name}
              <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> vs </span>
              {contextMatch.player2?.name}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
              {contextMatch.tournament} · {contextMatch.round}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>
              {contextMatch.surface} · {detectTour(contextMatch.tournament)}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ label, dot, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', ...style }}>
      {dot && (
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--green)', boxShadow: '0 0 6px var(--green)',
          animation: 'tv-pulse 2s ease infinite', flexShrink: 0,
        }} />
      )}
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 'clamp(16px,2vw,20px)', letterSpacing: '-0.01em',
        color: 'var(--text)', margin: 0,
      }}>
        {label}
      </h2>
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
      gap: '12px',
    }}>
      <span style={{ fontSize: '40px' }}>{icon}</span>
      <p style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>{title}</p>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div style={{
      padding: '20px', background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '12px', flexWrap: 'wrap',
    }}>
      <p style={{ color: '#f87171', fontSize: '14px' }}>⚠️ {msg}</p>
      {onRetry && (
        <Btn variant="ghost" size="sm" onClick={onRetry}>Retry</Btn>
      )}
    </div>
  );
}