// ─────────────────────────────────────────────────────────────────────────────
// src/pages/Dashboard.jsx – TennisVantage main app screen
//
// CHANGES IN THIS VERSION:
//  + getEffectiveMatchType() — client-side guard that checks WTA rankings Set
//    so Indian Wells / combined-event WTA matches always show correctly
//  + wtaPlayerIds Set built from WTA rankings and passed to all filter logic
//  + MatchCard + MatchPickerRow use effectiveType for badge — never wrong
//  + All filters use getEffectiveMatchType() — bulletproof for future syncs
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

  // ── Build WTA player ID set from rankings (the key fix for combined events) ─
  const { rankings: wtaRankings } = useRankings('WTA');
  const wtaPlayerIds = useMemo(
    () => new Set((wtaRankings ?? []).map(r => r.id)),
    [wtaRankings]
  );

  // Collect unique players from all matches for the search modal
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
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search players
          </button>
        </div>

        {/* Right: Desktop tabs + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
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
                  color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: activeTab === t.id ? 600 : 400,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'var(--t)',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--lime)', color: '#070B14',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '13px',
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
          <RankingsTab onSelectPlayer={p => setBioPlayer(p)} />
        )}
        {activeTab === 'chat' && (
          <AiChatTab contextMatch={selectedMatch} />
        )}
      </main>

      {/* ── BOTTOM TAB BAR ─────────────────────────────────────────────── */}
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
// FILTER PILLS
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
function MatchesTab({ live, upcoming, loading, error, refresh, onSelectMatch, wtaPlayerIds }) {
  const [calendarDate, setCalendarDate] = useState(null);
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

  const isPastDay = selectedDay && selectedDay < today;
  const isTodayOrFuture = !selectedDay || selectedDay >= today;

  useEffect(() => {
    if (!isPastDay) { setPastMatches([]); return; }
    let cancelled = false;
    setPastLoading(true);
    const dateStr = calendarDate.toISOString().split('T')[0];
    getMatchesByDate(dateStr, wtaPlayerIds)
      .then(data => { if (!cancelled) setPastMatches(data ?? []); })
      .catch(() => { if (!cancelled) setPastMatches([]); })
      .finally(() => { if (!cancelled) setPastLoading(false); });
    return () => { cancelled = true; };
  }, [calendarDate?.toDateString(), isPastDay, wtaPlayerIds]);

  if (loading) return <LoadingGrid />;
  if (error) return <ErrorMessage msg={error} onRetry={refresh} />;

  // ── The key filter function — uses deriveMatchType with WTA ids ───────────
  const byType = (arr) =>
    arr.filter(m => deriveMatchType(m, wtaPlayerIds) === activeFilter);

  const filteredLive = byType(live);

  const calendarFiltered = selectedDay && isTodayOrFuture
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

      {/* 1. Filter pills */}
      <FilterPills activeFilter={activeFilter} onSelect={setActiveFilter} />

      {/* 2. Calendar */}
      <MatchCalendar onSelectDate={setCalendarDate} />

      {/* PAST DAY */}
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
                  <MatchCard match={m} onPredict={() => onSelectMatch(m)} wtaPlayerIds={wtaPlayerIds} />
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
                  <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} wtaPlayerIds={wtaPlayerIds} />
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
// ─────────────────────────────────────────────────────────────────────────────
const MatchCard = memo(function MatchCard({ match: m, onPredict, wtaPlayerIds = new Set() }) {
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const surfaceColor = surfaceColors[m.surface] ?? '#94a3b8';

  // Always derive the effective type — never trust DB blindly
  const effectiveType = deriveMatchType(m, wtaPlayerIds);
  const matchTypeDef = MATCH_FILTERS.find(f => f.id === effectiveType) ?? null;

  const isFinished = m.status === 'finished';
  const isLive = m.status === 'live';

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
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{p?.flag}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontWeight: 600, fontSize: '14px',
                  color: isWinner ? 'var(--lime)' : 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isWinner && '🏆 '}{p?.name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                  Rank #{p?.rank ?? '—'}
                </p>
              </div>
            </div>
            {isLive && m.score && i === 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '13px',
                fontWeight: 700, color: 'var(--lime)', flexShrink: 0,
              }}>
                {m.score}
              </span>
            )}
          </div>
        );
      })}

      {/* Footer */}
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
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ allMatches, matchesLoading, selectedMatch, onSelectMatch, wtaPlayerIds }) {
  const [predFilter, setPredFilter] = useState('atp_singles');
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);
  const [h2h, setH2h] = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  // Only today + future matches are predictable
  const predictableMatches = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return allMatches.filter(m => {
      if (m.status === 'live') return true;
      if (m.status === 'finished') return false;
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
      .then(data => { if (!cancelled) setH2h(data); })
      .catch(() => { if (!cancelled) setH2h(null); })
      .finally(() => { if (!cancelled) setH2hLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMatch?.player1?.id, selectedMatch?.player2?.id]);

  // Use deriveMatchType for filter too
  const filteredMatches = predictableMatches.filter(
    m => deriveMatchType(m, wtaPlayerIds) === predFilter
  );

  return (
    <div className="tv-fade-up" style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(260px, 340px) 1fr',
      gap: '24px',
      alignItems: 'start',
    }}>
      {/* ── Sidebar ── */}
      <div>
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

      {/* ── Main panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!selectedMatch ? (
          <Card>
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🔮</p>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Select a match to predict</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Choose any match from the sidebar to see AI-powered win probability and key factors.</p>
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
        <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    : pred.confidence === 'Medium' ? 'var(--yellow)'
      : 'var(--clay)';

  return (
    <Card>
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
// H2H PANEL
// ─────────────────────────────────────────────────────────────────────────────
function H2HPanel({ h2h, match }) {
  const p1 = match.player1;
  const p2 = match.player2;

  return (
    <Card>
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

      {h2h.last5?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Last {h2h.last5.length} meetings
          </p>
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

      {h2h.meetings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {h2h.meetings.map((meet, i) => {
            const sc = meet.surface === 'Clay' ? '#f97316' : meet.surface === 'Grass' ? '#4ade80' : '#60a5fa';
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: 'var(--bg-glass)',
                border: '1px solid var(--border)', borderRadius: '8px', gap: '8px',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meet.year} · {meet.tournament}
                </span>
                <span style={{ fontSize: '11px', color: sc, fontWeight: 600, flexShrink: 0 }}>{meet.surface}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: meet.winner === 'p1' ? 'var(--lime)' : 'var(--clay)', flexShrink: 0 }}>
                  {meet.winner === 'p1' ? p1.name.split(' ').pop() : p2.name.split(' ').pop()}
                </span>
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
        <Card>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '44px 1fr 80px 60px',
            padding: '0 12px 10px', borderBottom: '1px solid var(--border)',
            gap: '8px',
          }}>
            {['#', 'Player', 'Points', 'W/L'].map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {h}
              </span>
            ))}
          </div>

          {(rankings ?? []).map((p, i) => (
            <div
              key={p.id}
              onClick={() => onSelectPlayer(p)}
              onMouseEnter={() => setHovRow(p.id)}
              onMouseLeave={() => setHovRow(null)}
              style={{
                display: 'grid', gridTemplateColumns: '44px 1fr 80px 60px',
                padding: '12px', gap: '8px', alignItems: 'center',
                borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                background: hovRow === p.id ? 'var(--bg-glass)' : 'transparent',
                transition: 'background 0.15s',
                borderRadius: i === rankings.length - 1 ? '0 0 var(--radius) var(--radius)' : 0,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px',
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
      gridTemplateColumns: contextMatch ? '1fr 340px' : '1fr',
      gap: '24px',
      alignItems: 'start',
    }}>
      <Card style={{ display: 'flex', flexDirection: 'column', height: 'clamp(500px, 70vh, 700px)' }}>
        {/* Chat header with clear button */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 0 14px', borderBottom: '1px solid var(--border)', marginBottom: '14px',
        }}>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '15px' }}>🤖 AI Tennis Analyst</p>
            {contextMatch && (
              <p style={{ fontSize: '12px', color: 'var(--lime)', marginTop: '2px' }}>
                Context: {contextMatch.player1?.name} vs {contextMatch.player2?.name}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            title="Clear chat"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text-faint)', cursor: 'pointer', padding: '6px 8px',
              fontSize: '14px', transition: 'var(--t)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--clay)'; e.currentTarget.style.borderColor = 'var(--clay)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            🗑
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
          {messages.length === 0 && (
            <div style={{ padding: '20px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                Ask me anything about tennis — tactics, players, stats, or match predictions.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { sendMessage(s); }}
                    style={{
                      textAlign: 'left', padding: '10px 14px',
                      background: 'var(--bg-glass)', border: '1px solid var(--border)',
                      borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px',
                      cursor: 'pointer', transition: 'var(--t)', fontFamily: 'var(--font-body)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: '12px',
                background: msg.role === 'user' ? 'var(--lime)' : 'var(--bg-glass-md)',
                color: msg.role === 'user' ? '#070B14' : 'var(--text)',
                fontSize: '14px', lineHeight: 1.6,
                border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', gap: '6px', padding: '10px 14px', width: 'fit-content' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'var(--text-faint)',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, CHAT_MAX_CHARS))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask about tennis…"
              disabled={typing}
              style={{
                flex: 1, padding: '10px 14px',
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text)', fontSize: '14px',
                fontFamily: 'var(--font-body)', outline: 'none',
                opacity: typing ? 0.6 : 1,
              }}
            />
            <Btn onClick={submit} disabled={typing || !input.trim()} size="sm">
              {typing ? '…' : 'Send'}
            </Btn>
          </div>
          <p style={{ fontSize: '11px', color: charColor, marginTop: '6px', textAlign: 'right' }}>
            {charsLeft} chars left
          </p>
        </div>
      </Card>

      {/* Context match panel */}
      {contextMatch && (
        <Card>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
            Match Context
          </p>
          <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
            {contextMatch.player1?.name} vs {contextMatch.player2?.name}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {contextMatch.tournament} · {contextMatch.round}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Surface: {contextMatch.surface}
          </p>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '16px',
};

function SectionHeading({ label, dot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      {dot && <span className="live-dot" />}
      <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{label}</h2>
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: '32px', marginBottom: '12px' }}>{icon}</p>
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>{title}</p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div style={gridStyle}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: '180px', borderRadius: 'var(--radius)',
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div style={{ padding: '24px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <p style={{ color: 'var(--clay)', fontSize: '14px' }}>⚠️ {msg}</p>
      {onRetry && <Btn size="sm" variant="ghost" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}