// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx – TennisVantage main app screen
//
// ALL FIXES INCLUDED:
//  #1  useRankings — session cache (no re-fetch on tab switch)
//  #2  Navbar breakpoint 900px (hide-md / show-md)
//  #3  Rankings table responsive — W/L hidden on mobile
//  #4  PredictionsTab sidebar minWidth safe on 375px
//  #5  AiChatTab — input locked while typing, char counter, grid stacks on mobile
//  #7  scroll-to-top on every tab switch
//  #8  Duplicate border declaration removed from ATP/WTA pills
//  #9  Calendar date filter uses real ISO date comparison
//  #10 MatchCard wrapped in React.memo
//  #17 PlayerSearchModal wired to navbar search button
//  #18 H2H panel wired into PredictionsTab
//  PlayerBioModal opens when clicking any player row in Rankings
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, memo } from 'react';
import { useAuth }       from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat, CHAT_MAX_CHARS } from '../hooks/hooks';
import { getHeadToHead } from '../services/tennisApi';
import { Logo, Btn, Badge, Card } from '../components/ui';
import MatchCalendar     from '../components/MatchCalendar';
import PlayerBioModal    from '../components/PlayerBioModal';
import PlayerSearchModal from '../components/PlayerSearchModal';

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();

  const [activeTab,     setActiveTab]     = useState('matches');
  const [mobileMenu,    setMobileMenu]    = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [bioPlayer,     setBioPlayer]     = useState(null);

  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();
  const allMatches = useMemo(() => [...live, ...upcoming], [live, upcoming]);

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
    { id: 'matches',     label: 'Live & Upcoming', icon: '🎾' },
    { id: 'predictions', label: 'Predictions',     icon: '🔮' },
    { id: 'rankings',    label: 'Rankings',         icon: '🏆' },
    { id: 'chat',        label: 'AI Analyst',       icon: '🤖' },
  ];

  async function handleLogout() {
    await logout();
    showToast('Signed out successfully', 'info');
  }

  // FIX #7: Scroll to top on every tab switch
  function switchTab(id) {
    setActiveTab(id);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectMatch(match) {
    setSelectedMatch(match);
    switchTab('predictions');
  }

  // Called from PlayerSearchModal's "Chat" button
  function handleChatAboutPlayer(player) {
    showToast(`Asking AI about ${player.name}…`, 'info');
    switchTab('chat');
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Navbar ─────────────────────────────────────────────────── */}
      <nav style={{
        background: 'rgba(7,11,20,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)', height: '62px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo size="sm" />

          {/* Search trigger button */}
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px',
              background: 'var(--bg-glass-md)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)', fontSize: 13,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'var(--t)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(159,239,102,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span className="hide-sm">Search players</span>
          </button>
        </div>

        {/* FIX #2: Desktop tabs — hidden at ≤900px via hide-md class */}
        <div className="hide-md" style={{ display: 'flex', gap: '4px' }}>
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

        {/* User area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="hide-md" style={{
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
              {(firstName?.[0] ?? 'P').toUpperCase()}
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text)' }}>
              {firstName}
            </span>
          </div>
          <Btn variant="ghost" size="sm" onClick={handleLogout} className="hide-md">Sign Out</Btn>

          {/* Mobile hamburger — shown at ≤900px */}
          <button
            className="show-md"
            onClick={() => setMobileMenu(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '6px', cursor: 'pointer' }}
            aria-label={mobileMenu ? 'Close menu' : 'Open menu'}
          >
            {mobileMenu ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileMenu && (
        <div className="tv-fade-in show-md" style={{
          position: 'fixed', top: '62px', left: 0, right: 0,
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          zIndex: 99, padding: '12px',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                width: '100%', padding: '13px 16px', border: 'none',
                borderRadius: '10px', marginBottom: '4px',
                background: activeTab === t.id ? 'rgba(159,239,102,0.1)' : 'transparent',
                color: activeTab === t.id ? 'var(--lime)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 500,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
          <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', padding: '13px 16px', border: 'none',
              borderRadius: '10px', background: 'transparent',
              color: 'var(--red)', fontFamily: 'var(--font-body)',
              fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main style={{
        flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto',
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
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
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
// MATCHES TAB
// FIX #9: Calendar filter uses real ISO date comparison
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, upcoming, loading, error, refresh, onSelectMatch }) {
  const [calendarDate, setCalendarDate] = useState(null);

  if (loading) return <LoadingGrid />;
  if (error)   return <ErrorMessage msg={error} onRetry={refresh} />;

  const filteredUpcoming = calendarDate
    ? upcoming.filter(m => {
        if (!m.date) return true;
        const matchDay = new Date(m.date);
        return (
          matchDay.getFullYear() === calendarDate.getFullYear() &&
          matchDay.getMonth()    === calendarDate.getMonth()    &&
          matchDay.getDate()     === calendarDate.getDate()
        );
      })
    : upcoming;

  return (
    <div className="tv-fade-up">
      <MatchCalendar onSelectDate={setCalendarDate} />

      {live.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading label="Live Now" dot />
          <div style={gridStyle}>
            {live.map(m => (
              <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading label={
          calendarDate
            ? `Matches on ${calendarDate.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' })}`
            : 'Upcoming Matches'
        } />
        {filteredUpcoming.length === 0 ? (
          <EmptyState icon="📅" title="No matches on this day" desc="Select another date or check back soon." />
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
    </div>
  );
}

// FIX #10: React.memo prevents re-renders unless match or onPredict changes
const MatchCard = memo(function MatchCard({ match: m, onPredict }) {
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const surfaceColor  = surfaceColors[m.surface] ?? '#94a3b8';
  const isLive        = m.status === 'live';

  return (
    <Card style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {m.tournament}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>{m.round}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="live-dot" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
            </div>
          )}
          <Badge style={{ background: `${surfaceColor}22`, color: surfaceColor, border: `1px solid ${surfaceColor}44` }}>
            {m.surface}
          </Badge>
        </div>
      </div>

      {[m.player1, m.player2].map((p, i) => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0',
          borderTop: i === 0 ? '1px solid var(--border)' : 'none',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{p.flag}</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>{p.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>#{p.rank} · {p.country}</p>
            </div>
          </div>
          {isLive && m.score && (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: i === 0 ? 'var(--lime)' : 'var(--text)' }}>
              {m.score.split(',')[i] ?? ''}
            </span>
          )}
        </div>
      ))}

      <Btn variant="lime" size="sm" fullWidth style={{ marginTop: '16px' }} onClick={onPredict}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Predict this match
      </Btn>
    </Card>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// FIX #4: Sidebar minWidth safe on 375px phones
// FIX #18: H2H panel wired via getHeadToHead()
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ allMatches, matchesLoading, selectedMatch, onSelectMatch }) {
  const { prediction, loading: predLoading, error: predError } = usePrediction(selectedMatch);
  const [h2h, setH2h]               = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);

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

  return (
    <div className="tv-fade-up">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'start' }}>

        {/* FIX #4: minWidth lowered to 140px so it wraps safely on 375px */}
        <div style={{ flex: '0 0 clamp(140px, 30%, 340px)', minWidth: '140px' }}>
          <SectionHeading label="Select a Match" />
          {matchesLoading ? (
            <LoadingGrid cols={1} rows={3} />
          ) : allMatches.length === 0 ? (
            <EmptyState icon="🎾" title="No matches available" desc="Check back soon." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

        <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
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
                  <LoadingGrid cols={1} rows={2} />
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
      <p style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
        {m.tournament} · {m.round}
      </p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: selected ? 'var(--lime)' : 'var(--text)', lineHeight: 1.5 }}>
        {m.player1.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {m.player2.name}
      </p>
    </button>
  );
}

function PredictionCard({ match: m, prediction: pred }) {
  const p1        = m.player1;
  const p2        = m.player2;
  const confColor = pred.confidence === 'High' ? 'var(--lime)' : pred.confidence === 'Medium' ? 'var(--yellow)' : 'var(--text-muted)';

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{player.flag} {player.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color, fontSize: '15px' }}>{pct}%</span>
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

function H2HPanel({ h2h, match }) {
  const p1 = match.player1;
  const p2 = match.player2;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--lime)' }}>{h2h.p1_wins}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{p1.name.split(' ').pop()}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {h2h.total} matches
          </p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--clay)' }}>{h2h.p2_wins}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{p2.name.split(' ').pop()}</p>
        </div>
      </div>

      {h2h.last5?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Last 5 ({p1.name.split(' ').pop()})
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {h2h.last5.map((r, i) => (
              <div key={i} style={{
                width: '32px', height: '32px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: r === 'W' ? 'rgba(159,239,102,0.15)' : 'rgba(248,113,113,0.12)',
                border: `1px solid ${r === 'W' ? 'rgba(159,239,102,0.3)' : 'rgba(248,113,113,0.3)'}`,
                fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                color: r === 'W' ? 'var(--lime)' : 'var(--red)',
              }}>{r}</div>
            ))}
          </div>
        </div>
      )}

      {h2h.meetings?.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Recent meetings
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {h2h.meetings.slice(0, 4).map((meet, i) => {
              const sc = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' }[meet.surface] ?? '#94a3b8';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg-glass)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
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
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKINGS TAB
// FIX #1: useRankings uses session cache — no re-fetch on tab switch
// FIX #3: W/L column hidden on mobile via .rankings-wl class
// FIX #8: Duplicate border declaration removed from ATP/WTA pills
// PlayerBioModal: clicking a row fires onSelectPlayer
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab({ onSelectPlayer }) {
  const [tour, setTour]     = useState('ATP');
  const [hovRow, setHovRow] = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  return (
    <div className="tv-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SectionHeading label={`${tour} Live Rankings`} />
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {['ATP', 'WTA'].map(t => (
            <button
              key={t}
              onClick={() => setTour(t)}
              style={{
                padding: '6px 18px', borderRadius: '999px',
                // FIX #8: Single border declaration
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
          {/* FIX #3: Responsive grid — W/L hidden on mobile via .rankings-wl */}
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
                // Clickable cursor — opens PlayerBioModal
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

              {/* FIX #3: W/L hidden on mobile */}
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
// FIX #5: Input locked while typing, char counter shown, grid stacks on mobile
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

  const charsLeft  = CHAT_MAX_CHARS - input.length;
  const charColor  = charsLeft < 50 ? 'var(--red)' : charsLeft < 100 ? 'var(--yellow)' : 'var(--text-faint)';

  const suggestions = [
    'Who is favoured to win today?',
    'Explain clay vs hard court performance',
    "What does 'first serve percentage' mean?",
    "Compare Djokovic and Alcaraz's recent form",
  ];

  return (
    <div className="tv-fade-up" style={{
      display: 'grid',
      // FIX #5: Single column on narrow screens, side-by-side when match context exists
      gridTemplateColumns: contextMatch ? 'clamp(180px,28%,300px) 1fr' : '1fr',
      gap: '20px',
      alignItems: 'start',
    }}>

      {/* Context panel */}
      {contextMatch && (
        <Card>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            Match context
          </p>
          <p style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.6 }}>
            {contextMatch.player1.flag} {contextMatch.player1.name}
            <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> vs </span>
            {contextMatch.player2.flag} {contextMatch.player2.name}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {contextMatch.surface} · {contextMatch.tournament} · {contextMatch.round}
          </p>
          <button
            onClick={reset}
            style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}
          >
            Clear context ✕
          </button>
        </Card>
      )}

      {/* Chat column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'clamp(440px, 70vh, 640px)' }}>
        {/* Messages */}
        <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: '14px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#9fef66,#6bc940)'
                    : 'var(--bg-glass-md)',
                  color: msg.role === 'user' ? '#070B14' : 'var(--text)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  fontSize: '14px', lineHeight: 1.65,
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '14px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '14px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {typing && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '12px 16px', borderRadius: '14px', borderBottomLeftRadius: '4px',
                  background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
                  display: 'flex', gap: '5px', alignItems: 'center',
                }}>
                  {[0,1,2].map(d => (
                    <span key={d} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: 'var(--lime)',
                      display: 'inline-block',
                      animation: 'tv-live-dot 1s ease infinite',
                      animationDelay: `${d * 0.15}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </Card>

        {/* Quick suggestions before first user message */}
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                style={{
                  padding: '6px 12px', fontSize: '12px', borderRadius: '999px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer', transition: 'var(--t)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input bar with char counter */}
        <form onSubmit={submit} style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </Btn>
        </form>
      </div>
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
            <div className="skeleton" style={{ width: '40px',  height: '16px', borderRadius: '4px' }} />
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