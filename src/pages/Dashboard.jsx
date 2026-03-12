// src/pages/Dashboard.jsx
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
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
  gap: '16px',
};

function toLocalDateStr(date) {
  const d  = date instanceof Date ? date : new Date(date);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function isMatchPast(match) {
  if (match.status === 'finished') return true;
  if (!match.date) return false;
  const matchDay = new Date(match.date);
  matchDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return matchDay < today;
}

// ── FIXED filterByTour ────────────────────────────────────────────────────────
// 'All' shows everything. 'ATP' shows only ATP. 'WTA' shows only WTA.
// detectTour already returns 'ATP'|'WTA'|'ITF' — we just match exactly.
function filterByTour(matches, tourFilter) {
  if (tourFilter === 'All') return matches;
  return matches.filter(m => detectTour(m.tournament) === tourFilter);
}

// ── Shared Tour Filter Pills component ───────────────────────────────────────
function TourPills({ value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: '6px', ...style }}>
      {['All', 'ATP', 'WTA'].map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '5px 14px',
            borderRadius: '999px',
            border: value === t ? 'none' : '1px solid var(--border)',
            background: value === t
              ? t === 'WTA' ? '#f472b6' : 'var(--lime)'
              : 'var(--bg-glass-md)',
            color: value === t ? '#070B14' : 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'var(--t)',
            letterSpacing: '0.04em',
            WebkitTapHighlightColor: 'transparent',
            whiteSpace: 'nowrap',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();

  const [activeTab, setActiveTab]         = useState('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [bioPlayer, setBioPlayer]         = useState(null);
  const [profileOpen, setProfileOpen]     = useState(false);

  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();

  const predictableMatches = useMemo(
    () => [...live, ...upcoming].filter(m => !isMatchPast(m)),
    [live, upcoming]
  );

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

  function switchTab(id) {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectMatch(match) {
    if (isMatchPast(match)) return;
    setSelectedMatch(match);
    switchTab('predictions');
  }

  function handleChatAboutPlayer(player) {
    showToast?.(`Asking AI about ${player.name}…`, 'info');
    switchTab('chat');
  }

  async function handleLogout() {
    setProfileOpen(false);
    await logout();
    showToast?.('Signed out successfully', 'info');
  }

  const initials = (firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Navbar ── */}
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
            className="hide-md"
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
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(159,239,102,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search players
          </button>
        </div>

        <div className="hide-md" style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 18px', border: 'none', borderRadius: '8px',
                background: activeTab === t.id ? 'rgba(159,239,102,0.12)' : 'transparent',
                color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '14px',
                cursor: 'pointer', transition: 'var(--t)',
              }}
            >
              <span style={{ fontSize: '15px' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="hide-md" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 14px', background: 'var(--bg-glass-md)',
            border: '1px solid var(--border)', borderRadius: '999px',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#9fef66,#6bc940)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', color: '#070B14', fontWeight: 700,
            }}>
              {initials}
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text)' }}>{firstName}</span>
          </div>
          <Btn variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Btn>
        </div>

        <div className="show-md" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', position: 'relative' }}>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search players"
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          <button
            onClick={() => setProfileOpen(v => !v)}
            aria-label="Profile menu"
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#9fef66,#6bc940)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', color: '#070B14', fontWeight: 700,
              border: profileOpen ? '2px solid var(--lime)' : '2px solid transparent',
              cursor: 'pointer', padding: 0,
              boxShadow: profileOpen ? '0 0 0 3px rgba(159,239,102,0.2)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {initials}
          </button>

          {profileOpen && (
            <>
              <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
              <div className="tv-profile-dropdown">
                <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{firstName}</p>
                  <p style={{
                    margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px',
                  }}>{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="tv-profile-dropdown__item tv-profile-dropdown__item--danger"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="tv-main-content" style={{
        flex: 1, maxWidth: '1200px', width: '100%',
        margin: '0 auto',
        padding: 'clamp(20px,3vh,40px) clamp(16px,3vw,40px)',
        // CRITICAL: never clip children — the calendar strip scrolls horizontally
        overflow: 'visible',
      }}>
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
          <AiChatTab contextMatch={selectedMatch} showToast={showToast} />
        )}
      </main>

      {/* ── Bottom tab bar (mobile only) ── */}
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

      {searchOpen && (
        <PlayerSearchModal
          allPlayers={allPlayersForSearch}
          onClose={() => setSearchOpen(false)}
          onChatAboutPlayer={handleChatAboutPlayer}
        />
      )}
      {bioPlayer && (
        <PlayerBioModal player={bioPlayer} onClose={() => setBioPlayer(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES TAB
// tourFilter is owned here and passed down to MatchCalendar as a controlled prop
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, loading: liveLoading, error, refresh, onSelectMatch }) {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [selectedDate, setSelectedDate]       = useState(today);
  const [selectedDateStr, setSelectedDateStr] = useState(toLocalDateStr(today));
  // tourFilter lives HERE — single source of truth, passed to both calendar pills and filter logic
  const [tourFilter, setTourFilter]           = useState('All');

  const { matches: dateMatches, loading: dateLoading, error: dateError } = useMatchesByDate(selectedDateStr);

  const isToday = useMemo(() => {
    const sel = new Date(selectedDate); sel.setHours(0, 0, 0, 0);
    return sel.getTime() === today.getTime();
  }, [selectedDate, today]);

  const mergedMatches = useMemo(() => {
    if (!isToday) return dateMatches;
    const liveIds = new Set(live.map(m => m.id));
    return [...live, ...dateMatches.filter(m => !liveIds.has(m.id))];
  }, [isToday, live, dateMatches]);

  const visibleMatches = useMemo(
    () => filterByTour(mergedMatches, tourFilter),
    [mergedMatches, tourFilter]
  );

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
      {/* Calendar receives tourFilter as controlled prop so pills stay in sync */}
      <MatchCalendar
        onSelectDate={handleDateSelect}
        onTourFilter={setTourFilter}
        tourFilter={tourFilter}
      />

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

      {dateLoading && (
        <div style={gridStyle}>
          {[1, 2, 3, 4].map(n => <MatchCardSkeleton key={n} />)}
        </div>
      )}

      {!dateLoading && dateError && (
        <EmptyState icon="⚠️" title="Couldn't load matches" desc={dateError} />
      )}

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
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
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
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {m.status === 'live' && <Badge color="var(--green)">● Live</Badge>}
          {(isPast || m.status === 'finished') && <Badge color="var(--text-faint)">Finished</Badge>}
          <Badge color={tourColor}>{tour}</Badge>
          <Badge color={surfaceColor}>{m.surface}</Badge>
        </div>
      </div>

      {[m.player1, m.player2].map((player, idx) => {
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
                <p className="tv-match-card-name" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {player?.name ?? 'TBD'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>#{player?.rank ?? '—'}</p>
              </div>
            </div>
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

      {m.date && (
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '10px' }}>
          {new Date(m.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {' · '}
          {new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
      )}

      {!isPast && m.status !== 'finished' && (
        <Btn variant="lime" size="sm" fullWidth style={{ marginTop: '16px' }} onClick={onPredict}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Predict this match
        </Btn>
      )}

      {(isPast || m.status === 'finished') && (
        <div style={{
          marginTop: '14px', padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', textAlign: 'center',
          fontSize: '12px', color: 'var(--text-faint)',
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
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '180px',
    }}>
      <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {['75%', '55%', '90%', '40%'].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? '16px' : '13px', width: w, borderRadius: '6px',
          background: 'linear-gradient(90deg,var(--bg-card) 25%,rgba(255,255,255,0.05) 50%,var(--bg-card) 75%)',
          backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite',
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ predictableMatches, matchesLoading, selectedMatch, onSelectMatch }) {
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);
  const [h2h, setH2h]               = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [tourFilter, setTourFilter] = useState('All');

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

        {/* Sidebar */}
        <div className="tv-predictions-sidebar" style={{ flex: '0 0 clamp(200px,30%,340px)', minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <SectionHeading label="Select a Match" style={{ marginBottom: 0 }} />
            <TourPills value={tourFilter} onChange={setTourFilter} />
          </div>

          {matchesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{
                  height: '62px', borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(90deg,var(--bg-card) 25%,rgba(255,255,255,0.04) 50%,var(--bg-card) 75%)',
                  backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite',
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
                  key={m.id} match={m}
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
            <EmptyState icon="🔮" title="Select a match to analyse" desc="Choose any upcoming or live match to see our AI prediction breakdown." />
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
                  <div style={{
                    height: '140px', borderRadius: 'var(--radius)',
                    background: 'linear-gradient(90deg,var(--bg-card) 25%,rgba(255,255,255,0.04) 50%,var(--bg-card) 75%)',
                    backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite',
                  }} />
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
        fontFamily: 'var(--font-body)', WebkitTapHighlightColor: 'transparent',
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
          fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
          background: `${tourColor}22`, color: tourColor, marginLeft: '6px', flexShrink: 0,
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
  const confColor = pred.confidence === 'High' ? 'var(--lime)' : pred.confidence === 'Medium' ? 'var(--yellow)' : 'var(--text-muted)';
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
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', background: color, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
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
            background: 'linear-gradient(90deg,var(--bg-card) 25%,rgba(255,255,255,0.04) 50%,var(--bg-card) 75%)',
            backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite',
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
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--lime)' }}>{h2h.p1_wins}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p1.name.split(' ').pop()}</p>
        </div>
        <div style={{ textAlign: 'center', padding: '0 8px', flexShrink: 0 }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>H2H</p>
          <p style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: '4px 0' }}>vs</p>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{h2h.meetings?.length ?? 0} meetings</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--clay)' }}>{h2h.p2_wins}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p2.name.split(' ').pop()}</p>
        </div>
      </div>
      {h2h.meetings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '4px' }}>Recent Meetings</p>
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
// RANKINGS TAB — FIXED layout for mobile + all viewports
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab({ onSelectPlayer }) {
  const [tour, setTour]     = useState('ATP');
  const [hovRow, setHovRow] = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  return (
    <div className="tv-fade-up">
      <style>{`
        @media (max-width: 500px) {
          .tv-rankings-row  { grid-template-columns: 36px 1fr 72px !important; }
          .tv-rankings-head { grid-template-columns: 36px 1fr 72px !important; }
          .tv-rankings-wl   { display: none !important; }
          .tv-rankings-pts-head { text-align: right !important; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SectionHeading label={`${tour} Live Rankings`} />
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {['ATP', 'WTA'].map(t => (
            <button key={t} onClick={() => setTour(t)} style={{
              padding: '6px 18px', borderRadius: '999px',
              border: tour === t ? 'none' : '1px solid var(--border)',
              background: tour === t ? (t === 'WTA' ? '#f472b6' : 'var(--lime)') : 'var(--bg-glass-md)',
              color: tour === t ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', transition: 'var(--t)',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{
                height: '52px', borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(90deg,var(--bg-card) 25%,rgba(255,255,255,0.04) 50%,var(--bg-card) 75%)',
                backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite',
              }} />
            ))}
          </div>
        </Card>
      ) : error ? (
        <ErrorMessage msg={error} />
      ) : rankings.length === 0 ? (
        <EmptyState icon="🏆" title="No rankings data" desc="Rankings sync daily. Check back soon." />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div className="tv-rankings-head" style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr 90px 72px',
            gap: '8px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {[
              { label: '#',      align: 'left'  },
              { label: 'Player', align: 'left'  },
              { label: 'Points', align: 'right', className: 'tv-rankings-pts-head' },
              { label: 'W/L',    align: 'right', className: 'tv-rankings-wl' },
            ].map(h => (
              <span
                key={h.label}
                className={h.className}
                style={{
                  fontSize: '11px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: 'var(--text-faint)', textAlign: h.align,
                }}
              >
                {h.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          {rankings.map((p, i) => (
            <div
              key={p.id}
              className="tv-rankings-row"
              onClick={() => onSelectPlayer(p)}
              onMouseEnter={() => setHovRow(p.id)}
              onMouseLeave={() => setHovRow(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 90px 72px',
                gap: '8px',
                padding: '13px 16px',
                borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
                background: hovRow === p.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                alignItems: 'center',
              }}
            >
              {/* Rank */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px',
                color: i === 0 ? 'var(--lime)' : i === 1 ? 'var(--yellow)' : i === 2 ? 'var(--clay)' : 'var(--text-faint)',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
              </span>

              {/* Player — name + country */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1 }}>{p.flag}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
                    transition: 'color 0.15s',
                    // Critical: prevent name from overflowing into points column
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {p.name}
                  </p>
                  <p style={{
                    fontSize: '11px', color: 'var(--text-faint)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.country}{p.surface_pref ? ` · ${p.surface_pref}` : ''}
                  </p>
                </div>
              </div>

              {/* Points */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
                fontSize: '13px', textAlign: 'right',
                // Ensure points never wraps
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {p.points?.toLocaleString() ?? '—'}
              </span>

              {/* W/L — hidden on very small screens via CSS above */}
              <span className="tv-rankings-wl" style={{
                fontSize: '13px', color: 'var(--text-muted)',
                textAlign: 'right', whiteSpace: 'nowrap',
              }}>
                <span style={{ color: 'var(--green)' }}>{p.wins ?? '—'}</span>
                <span style={{ color: 'var(--text-faint)' }}>/{p.losses ?? '—'}</span>
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
function AiChatTab({ contextMatch, showToast }) {
  const { messages, typing, sendMessage, reset, bottomRef } = useAiChat(contextMatch);
  const [input, setInput] = useState('');

  async function submit(e) {
    e?.preventDefault();
    if (!input.trim() || typing) return;
    const text = input.trim();
    setInput('');
    try {
      await sendMessage(text);
    } catch {
      showToast?.('AI service unavailable. Please try again.', 'error');
    }
  }

  const charsLeft = CHAT_MAX_CHARS - input.length;
  const charColor = charsLeft < 50 ? '#f87171' : charsLeft < 100 ? 'var(--yellow)' : 'var(--text-faint)';

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
      gap: '20px',
      alignItems: 'start',
    }}>
      <div
        className="tv-chat-column"
        style={{
          display: 'flex', flexDirection: 'column', gap: '12px',
          height: 'calc(100dvh - 62px - 80px)',
          minHeight: '400px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <SectionHeading label="AI Tennis Analyst" />
          <Btn variant="ghost" size="sm" onClick={reset}>New chat</Btn>
        </div>

        <Card style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '12px',
          padding: '16px', minHeight: 0,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'rgba(159,239,102,0.15)' : 'var(--bg-glass)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(159,239,102,0.25)' : 'var(--border)'}`,
                fontSize: '14px', lineHeight: 1.6, color: 'var(--text)',
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

        {messages.length <= 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => setInput(s)} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-glass-md)',
                color: 'var(--text-muted)', fontSize: '12px',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'var(--t)',
                WebkitTapHighlightColor: 'transparent',
              }}>{s}</button>
            ))}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value.slice(0, CHAT_MAX_CHARS))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={typing ? 'AI is thinking…' : 'Ask about tactics, players, predictions…'}
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
              onFocus={e => e.target.style.borderColor = 'rgba(159,239,102,0.4)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
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
        </form>
      </div>

      {contextMatch && (
        <div className="tv-chat-context-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
// SHARED UI HELPERS
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '12px' }}>
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
      {onRetry && <Btn variant="ghost" size="sm" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}