// src/pages/Dashboard.jsx – TennisVantage main app screen
//
// FIXES IN THIS VERSION:
//  [RANKINGS]   ITF Men, ITF Women, UTR Men, UTR Women tabs in Rankings
//  [FLAGS]      resolveFlag() patched via tennisApi everywhere
//  [MOBILE-SO]  Avatar tap shows dropdown with Profile + Sign Out (not just Profile)
//  [SEARCH]     allPlayersForSearch now pulls from full DB via useAllPlayers hook
//  [AI-PRED]    PredictionCard shows AI analysis field + "AI Powered" badge
//  [LIVE]       Client-side reclassify bridges gap between sync-live cron runs
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useMatches, useRankings, usePrediction, useAiChat,
  useAllPlayers, CHAT_MAX_CHARS,
} from '../hooks/hooks';
import { getHeadToHead, getMatchesByDate, deriveMatchType, resolveFlag } from '../services/tennisApi';
import { Logo, Btn, Badge, Card } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';
import PlayerBioModal from '../components/PlayerBioModal';
import PlayerSearchModal from '../components/PlayerSearchModal';
import ProfilePage from './ProfilePage';

// ─────────────────────────────────────────────────────────────────────────────
// MATCH TYPE FILTER DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const MATCH_FILTERS = [
  { id: 'atp_singles', label: 'ATP', shortLabel: 'ATP', color: '#60a5fa' },
  { id: 'wta_singles', label: 'WTA', shortLabel: 'WTA', color: '#f472b6' },
  { id: 'itf_men_singles', label: 'ITF Men', shortLabel: 'ITF M', color: '#fb923c' },
  { id: 'itf_women_singles', label: 'ITF Women', shortLabel: 'ITF W', color: '#f59e0b' },
  { id: 'utr_men_singles', label: 'UTR Men', shortLabel: 'UTR M', color: '#a78bfa' },
  { id: 'utr_women_singles', label: 'UTR Women', shortLabel: 'UTR W', color: '#e879f9' },
  { id: 'atp_doubles', label: 'ATP Doubles', shortLabel: 'ATP 2×', color: '#818cf8' },
  { id: 'wta_doubles', label: 'WTA Doubles', shortLabel: 'WTA 2×', color: '#fb7185' },
  { id: 'mixed_doubles', label: 'Mixed Doubles', shortLabel: 'Mixed', color: '#34d399' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, profile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState(() => {
    // Restore last active tab from sessionStorage on refresh
    try {
      return sessionStorage.getItem('tv_active_tab') ?? 'matches';
    } catch {
      return 'matches';
    }
  });

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bioPlayer, setBioPlayer] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarMenuRefMobile = useRef(null);

  // Mobile avatar dropdown state
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  // ── CHANGE 1: removed syncing: matchesSyncing — syncing is now cron-driven ──
  const { live, upcoming, loading: matchesLoading, error: matchesError, refresh } = useMatches();
  const allMatches = useMemo(() => [...live, ...upcoming], [live, upcoming]);

  // Full player list from DB — feeds search modal
  const { players: allDbPlayers } = useAllPlayers();

  // Build WTA player ID set from rankings
  const { rankings: wtaRankings } = useRankings('WTA');
  const wtaPlayerIds = useMemo(
    () => new Set((wtaRankings ?? []).map(r => r.id)),
    [wtaRankings]
  );

  // Merge DB players with match players for search — DB list takes precedence
  const allPlayersForSearch = useMemo(() => {
    const seen = new Map();
    // First add all DB players (has full data including rank)
    allDbPlayers.forEach(p => { if (p?.id) seen.set(p.id, p); });
    // Then add any players from today's matches not yet in DB list
    allMatches.forEach(m => {
      [m.player1, m.player2].forEach(p => {
        if (p?.id && !seen.has(p.id)) seen.set(p.id, p);
      });
    });
    return [...seen.values()]
      .filter(p => p.name && !p.name.includes('/'))
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  }, [allDbPlayers, allMatches]);

  // Close avatar menu on outside click
  // Uses 'pointerup' instead of 'mousedown' so dropdown button onClick fires first
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handler = (e) => {
      const clickedInsideDesktop = avatarMenuRef.current?.contains(e.target);
      const clickedInsideMobile = avatarMenuRefMobile.current?.contains(e.target);
      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('pointerup', handler);
    return () => document.removeEventListener('pointerup', handler);
  }, [avatarMenuOpen]);

  // Keyboard shortcut: Cmd/Ctrl+K opens search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const tabs = [
    { id: 'matches', label: 'Matches', icon: '🎾' },
    { id: 'predictions', label: 'Predict', icon: '🔮' },
    { id: 'rankings', label: 'Rankings', icon: '🏆' },
    { id: 'chat', label: 'AI Chat', icon: '🤖' },
  ];

  async function handleLogout() {
    setAvatarMenuOpen(false);
    await logout();
    showToast('Signed out successfully', 'info');
  }

  function switchTab(id) {
    setActiveTab(id);
    try { sessionStorage.setItem('tv_active_tab', id); } catch { }
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

  const avatarInitial = (firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();

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
            minWidth: 0, maxWidth: '220px', flex: '1',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="hide-sm">Search players…</span>
        </button>

        {/* ── CHANGE 2: Syncing indicator removed — sync is now cron-driven ── */}

        {/* Desktop: avatar dropdown */}
        <div className="hide-md" style={{ position: 'relative', flexShrink: 0 }} ref={avatarMenuRef}>
          <button
            onClick={() => setAvatarMenuOpen(prev => !prev)}
            style={{
              width: '34px', height: '34px', borderRadius: '50%', padding: 0,
              background: profile?.avatar_url
                ? 'transparent'
                : 'linear-gradient(135deg, var(--lime), var(--clay))',
              border: avatarMenuOpen ? '2px solid var(--lime)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: '#070B14',
              cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
              overflow: 'hidden',
            }}
            aria-label="Account menu"
            aria-expanded={avatarMenuOpen}
          >
            {profile?.avatar_url
              ? <img
                src={profile.avatar_url}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
              : avatarInitial
            }
          </button>

          {/* Dropdown */}
          {avatarMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border-md)',
              borderRadius: '12px', overflow: 'hidden', minWidth: '190px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              animation: 'tv-slide-up 0.15s ease',
              zIndex: 200,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>
                  {firstName ?? 'Player'}
                </p>
                <p style={{
                  fontSize: '11px', color: 'var(--text-faint)', margin: '2px 0 0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.email}
                </p>
              </div>

              <button
                onClick={() => { setAvatarMenuOpen(false); setProfileOpen(true); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  background: 'none', border: 'none', color: 'var(--text)',
                  fontFamily: 'var(--font-body)', fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: '16px' }}>👤</span>
                My Profile
              </button>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                  color: 'var(--clay)', fontFamily: 'var(--font-body)',
                  fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,146,60,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: '16px' }}>🚪</span>
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Mobile: avatar with dropdown */}
        <div className="show-md" style={{ position: 'relative', flexShrink: 0 }} ref={avatarMenuRefMobile}>
          <button
            onClick={() => setAvatarMenuOpen(prev => !prev)}
            style={{
              width: '36px', height: '36px', borderRadius: '50%', padding: 0,
              background: profile?.avatar_url
                ? 'transparent'
                : 'linear-gradient(135deg, var(--lime), var(--clay))',
              border: avatarMenuOpen ? '2px solid var(--lime)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: '#070B14',
              cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
              overflow: 'hidden',
            }}
            aria-label="Account menu"
            aria-expanded={avatarMenuOpen}
          >
            {profile?.avatar_url
              ? <img
                src={profile.avatar_url}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
              : avatarInitial
            }
          </button>

          {avatarMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border-md)',
              borderRadius: '12px', overflow: 'hidden', minWidth: '180px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              animation: 'tv-slide-up 0.15s ease',
              zIndex: 200,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>
                  {firstName ?? 'Player'}
                </p>
                <p style={{
                  fontSize: '11px', color: 'var(--text-faint)', margin: '2px 0 0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.email}
                </p>
              </div>

              <button
                onClick={() => { setAvatarMenuOpen(false); setProfileOpen(true); }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 16px', background: 'none', border: 'none',
                  color: 'var(--text)', fontFamily: 'var(--font-body)',
                  fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: '16px' }}>👤</span>
                My Profile
              </button>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 16px', background: 'none', border: 'none',
                  borderTop: '1px solid var(--border)',
                  color: 'var(--clay)', fontFamily: 'var(--font-body)',
                  fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,146,60,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: '16px' }}>🚪</span>
                Sign Out
              </button>
            </div>
          )}
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
          <RankingsTab onSelectPlayer={p => setBioPlayer(p)} />
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

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
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
          onChat={handleChatAboutPlayer}
        />
      )}

      {/* Profile page overlay */}
      {profileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', overflowY: 'auto' }}>
          <ProfilePage
            onBack={() => setProfileOpen(false)}
            showToast={showToast}
          />
        </div>
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
    <div className="tv-rankings-filters" style={{
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
              padding: size === 'small' ? '4px 10px' : '6px 14px',
              borderRadius: '999px',
              border: active ? 'none' : '1px solid var(--border)',
              background: active ? f.color : 'var(--bg-glass-md)',
              color: active ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: size === 'small' ? '11px' : '12px',
              cursor: 'pointer', transition: 'var(--t)', whiteSpace: 'nowrap',
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
  const [activeFilter, setActiveFilter] = useState('atp_singles');
  const [calendarDate, setCalendarDate] = useState(null);
  const [calendarDateStr, setCalendarDateStr] = useState(null);
  const [dateMatches, setDateMatches] = useState([]);
  const [dateLoading, setDateLoading] = useState(false);

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const selectedDay = calendarDate;
  const isToday = !calendarDateStr || calendarDateStr === todayStr;

  // Load matches for a past/future calendar date
  useEffect(() => {
    if (!calendarDateStr || calendarDateStr === todayStr) {
      setDateMatches([]);
      refresh();
      return;
    }
    let cancelled = false;
    setDateLoading(true);
    getMatchesByDate(calendarDateStr, wtaPlayerIds)
      .then(d => { if (!cancelled) setDateMatches(d ?? []); })
      .catch(() => { if (!cancelled) setDateMatches([]); })
      .finally(() => { if (!cancelled) setDateLoading(false); });
    return () => { cancelled = true; };
  }, [calendarDateStr, wtaPlayerIds, todayStr]);

  if (loading) return <LoadingGrid />;
  if (error) return <ErrorMessage msg={error} onRetry={refresh} />;

  // ── Build today's unified match list ────────────────────────────────────────
  const todayMatches = (() => {
    const map = new Map();

    // Always use Paris timezone for date fallback — matches how DB writes local_date
    const toLocalDateStr = (m) => {
      if (m.local_date) return m.local_date;
      if (m.date) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Paris',
          year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date(m.date));
      }
      return null;
    };

    // ── CHANGE 3: Client-side reclassify ─────────────────────────────────────
    // If a match's scheduled time has passed by 5+ minutes and it's still
    // "upcoming" in DB, show it as live on the client.
    // This bridges the gap between sync-live cron runs (every 5 min).
    const now = Date.now();
    const reclassify = (m) => {
      if (m.status !== 'upcoming') return m;
      const matchTime = m.date ? new Date(m.date).getTime() : null;
      if (matchTime && now > matchTime + 5 * 60 * 1000) {
        return { ...m, status: 'live' };
      }
      return m;
    };

    // 1. upcoming rows dated today (reclassify overdue ones to live)
    upcoming.forEach(m => {
      const d = toLocalDateStr(m);
      if (d === todayStr) map.set(m.id, reclassify(m));
    });

    // 2. live rows — always include, overwrite upcoming version
    live.forEach(m => map.set(m.id, m));

    return [...map.values()].sort(
      (a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
    );
  })();

  // ── Active pool: today's merged list OR calendar-date results ───────────────
  const pool = isToday ? todayMatches : dateMatches;

  // ── Filter by the selected type pill ────────────────────────────────────────
  const byType = (arr) => arr.filter(m => deriveMatchType(m, wtaPlayerIds) === activeFilter);
  const activeFilterDef = MATCH_FILTERS.find(f => f.id === activeFilter);

  const filteredPool = byType(pool);
  const filteredLive = filteredPool.filter(m => m.status === 'live');
  const filteredNonLive = filteredPool.filter(m => m.status !== 'live');

  const sectionLabel = isToday
    ? `${activeFilterDef?.label} — Today's Matches`
    : `${activeFilterDef?.label} — ${selectedDay?.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'short',
    }) ?? ''}`;

  return (
    <div className="tv-fade-up">
      <FilterPills activeFilter={activeFilter} onSelect={setActiveFilter} />

      <MatchCalendar
        onSelectDate={(date, dateStr) => {
          setCalendarDate(date);
          setCalendarDateStr(dateStr);
        }}
      />

      {dateLoading ? (
        <LoadingGrid />
      ) : (
        <>
          {/* ── Live now section ── */}
          {filteredLive.length > 0 && (
            <section style={{ marginBottom: '40px' }}>
              <SectionHeading label="Live Now" dot />
              <div style={gridStyle}>
                {filteredLive.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    onPredict={() => onSelectMatch(m)}
                    wtaPlayerIds={wtaPlayerIds}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Scheduled / all matches section ── */}
          <section>
            <SectionHeading label={sectionLabel} />
            {filteredNonLive.length === 0 && filteredLive.length === 0 ? (
              <EmptyState
                icon={isToday ? '🎾' : '📅'}
                title={`No ${activeFilterDef?.label} matches`}
                desc={
                  isToday
                    ? 'No matches found for this filter today.'
                    : 'No matches found for this filter on this day.'
                }
              />
            ) : filteredNonLive.length === 0 ? null : (
              <div style={gridStyle}>
                {filteredNonLive.map((m, i) => (
                  <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
                    <MatchCard
                      match={m}
                      onPredict={() => onSelectMatch(m)}
                      wtaPlayerIds={wtaPlayerIds}
                    />
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

  const effectiveType = deriveMatchType(m, wtaPlayerIds);
  const matchTypeDef = MATCH_FILTERS.find(f => f.id === effectiveType) ?? null;

  const todayLocal = new Date().toLocaleDateString('en-CA');
  const matchLocal = m.date ? new Date(m.date).toLocaleDateString('en-CA') : null;
  const isFinished = m.status === 'finished' || (matchLocal && matchLocal < todayLocal);
  const isLive = m.status === 'live' && !isFinished;

  // Resolve flags on-the-fly for any missing ones
  const p1Flag = m.player1?.flag && m.player1.flag !== '🏳️' ? m.player1.flag : resolveFlag(m.player1?.country ?? '');
  const p2Flag = m.player2?.flag && m.player2.flag !== '🏳️' ? m.player2.flag : resolveFlag(m.player2?.country ?? '');

  return (
    <Card style={{ padding: '16px', transition: 'var(--t)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {m.tournament}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
            {m.round}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isLive && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(159,239,102,0.12)', border: '1px solid rgba(159,239,102,0.3)',
              color: 'var(--lime)', fontSize: '10px', fontWeight: 700,
              padding: '2px 7px', borderRadius: '999px', textTransform: 'uppercase',
            }}>
              <span className="live-dot" style={{ width: '5px', height: '5px' }} />
              Live
            </span>
          )}
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '999px',
            background: `${surfaceColor}20`, color: surfaceColor,
            border: `1px solid ${surfaceColor}40`,
          }}>
            {m.surface ?? 'Hard'}
          </span>
          {matchTypeDef && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
              background: `${matchTypeDef.color}20`, color: matchTypeDef.color,
              border: `1px solid ${matchTypeDef.color}40`,
            }}>
              {matchTypeDef.shortLabel}
            </span>
          )}
        </div>
      </div>

      {/* Players */}
      {[
        { player: m.player1, flag: p1Flag, isWinner: m.winner_id === m.player1?.id },
        { player: m.player2, flag: p2Flag, isWinner: m.winner_id === m.player2?.id },
      ].map(({ player: p, flag, isWinner }, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '6px 0',
          borderTop: idx === 1 ? '1px dashed var(--border)' : 'none',
          opacity: isFinished && m.winner_id && !isWinner ? 0.55 : 1,
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>{flag}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontWeight: isWinner ? 700 : 500,
              fontSize: '14px', color: isWinner ? 'var(--text)' : 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {p?.name ?? 'TBD'}
              {isWinner && <span style={{ color: 'var(--lime)', marginLeft: '6px', fontSize: '12px' }}>✓</span>}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '1px' }}>
              {p?.rank ? `#${p.rank}` : ''}
              {p?.country ? ` · ${p.country}` : ''}
            </p>
          </div>
        </div>
      ))}

      {/* Score / time */}
      <div style={{ marginTop: '12px' }}>
        {isFinished ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', background: 'var(--bg-glass)',
            borderRadius: '6px',
          }}>
            {m.score ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '13px' }}>
                {m.score}
              </span>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                Result unavailable
              </span>
            )}
            <span style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Final
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

      {/* Predict button */}
      {!isFinished && (
        <button
          onClick={onPredict}
          style={{
            marginTop: '12px', width: '100%', padding: '9px 16px',
            borderRadius: '8px', background: 'transparent',
            border: '1px solid var(--lime)', color: 'var(--lime)',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px',
            cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--lime)'; e.currentTarget.style.color = '#070B14'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--lime)'; }}
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
  const { prediction, loading: predLoading, error: predError, cooldown } = usePrediction(selectedMatch);
  const [h2h, setH2h] = useState(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Only today's matches + anything currently live
  const predictableMatches = allMatches.filter(m => {
    if (m.status === 'finished') return false;
    if (m.status === 'live') return true;
    const d = m.local_date ?? (m.date ? new Date(m.date).toLocaleDateString('en-CA') : null);
    return d === todayStr;
  });

  const filteredMatches = predictableMatches.filter(m =>
    deriveMatchType(m, wtaPlayerIds) === predFilter
  );

  useEffect(() => {
    if (!selectedMatch?.player1?.id || !selectedMatch?.player2?.id) { setH2h(null); return; }
    let cancelled = false;
    setH2hLoading(true);
    getHeadToHead(selectedMatch.player1.id, selectedMatch.player2.id)
      .then(data => { if (!cancelled) setH2h(data); })
      .catch(() => { if (!cancelled) setH2h(null); })
      .finally(() => { if (!cancelled) setH2hLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMatch?.player1?.id, selectedMatch?.player2?.id]);

  return (
    <div className="tv-fade-up tv-predictions-layout" style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr',
      gap: '20px', alignItems: 'start',
    }}>
      {/* Sidebar */}
      <div className="tv-predictions-sidebar" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            Filter
          </p>
          <FilterPills activeFilter={predFilter} onSelect={setPredFilter} size="small" />
        </div>
        {cooldown > 0 && (
          <div style={{
            margin: '8px 8px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(251,146,60,0.08)',
            border: '1px solid rgba(251,146,60,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>⏳</span>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--yellow)', margin: 0 }}>
                Next prediction in {cooldown}s
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
                Ensures every prediction is deep & detailed
              </p>
            </div>
          </div>
        )}
        <div style={{ maxHeight: '60dvh', overflowY: 'auto', padding: '8px' }}>
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
      </div>

      {/* Main panel */}
      <div className="tv-predictions-main" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!selectedMatch ? (
          <Card>
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🔮</p>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Select a match to predict</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                AI-powered win probability with key factor breakdowns.
              </p>
            </div>
          </Card>
        ) : predLoading ? (
          <Card>
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-faint)' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--lime)', animation: 'tv-spin 0.7s linear infinite' }} />
                Analysing with AI…
              </div>
            </div>
          </Card>
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
        width: '100%', textAlign: 'left', padding: '10px 12px',
        background: selected ? 'var(--bg-glass-md)' : 'var(--bg-glass)',
        border: selected ? '1px solid var(--lime)' : '1px solid var(--border)',
        borderRadius: '10px', cursor: 'pointer', transition: 'var(--t)',
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
// PREDICTION CARD — shows AI analysis + source badge
// ─────────────────────────────────────────────────────────────────────────────
function PredictionCard({ match: m, prediction: pred }) {
  const p1 = m.player1;
  const p2 = m.player2;
  const confColor = pred.confidence === 'High' ? 'var(--lime)'
    : pred.confidence === 'Medium' ? 'var(--yellow)' : 'var(--clay)';

  const p1WinPct = pred.player1_win_pct ?? 50;
  const p2WinPct = pred.player2_win_pct ?? (100 - p1WinPct);
  const isAi = pred.source === 'ai';

  const p1Flag = p1?.flag && p1.flag !== '🏳️' ? p1.flag : resolveFlag(p1?.country ?? '');
  const p2Flag = p2?.flag && p2.flag !== '🏳️' ? p2.flag : resolveFlag(p2?.country ?? '');

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', margin: 0 }}>
            Match Prediction
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '2px' }}>
            {m.tournament} · {m.round} · {m.surface}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {isAi && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
              background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.3)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              🤖 AI Powered
            </span>
          )}
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
            background: `${confColor}20`, color: confColor,
            border: `1px solid ${confColor}40`,
          }}>
            {pred.confidence} Confidence
          </span>
        </div>
      </div>

      {/* Predicted winner banner */}
      <div style={{
        padding: '12px 16px', borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(159,239,102,0.1), rgba(159,239,102,0.05))',
        border: '1px solid rgba(159,239,102,0.2)',
        marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '20px' }}>🏆</span>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
            Predicted Winner
          </p>
          <p style={{ fontWeight: 700, color: 'var(--lime)', fontSize: '16px' }}>
            {pred.predicted_winner ?? (p1WinPct >= 50 ? p1?.name : p2?.name)}
          </p>
        </div>
      </div>

      {/* Win probability bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        {/* P1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{p1Flag}</span>
              <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p1?.name ?? 'Player 1'}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: 'var(--lime)', flexShrink: 0 }}>
              {p1WinPct}%
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: '99px', background: 'var(--bg-glass-md)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p1WinPct}%`, background: 'var(--lime)', borderRadius: '99px', transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {/* P2 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{p2Flag}</span>
              <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p2?.name ?? 'Player 2'}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: 'var(--clay)', flexShrink: 0 }}>
              {p2WinPct}%
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: '99px', background: 'var(--bg-glass-md)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p2WinPct}%`, background: 'var(--clay)', borderRadius: '99px', transition: 'width 0.8s ease' }} />
          </div>
        </div>
      </div>

      {/* AI Analysis block */}
      {pred.ai_analysis && (
        <div style={{
          padding: '14px 16px', borderRadius: '10px',
          background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)',
          marginBottom: '16px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🤖 AI Analysis
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {pred.ai_analysis}
          </p>
        </div>
      )}

      {/* Key factors */}
      {pred.key_factors?.length > 0 && (
        <div>
          <p style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px',
          }}>
            Key Factors ({pred.key_factors.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {pred.key_factors.map((f, i) => {
              // Auto-assign an icon based on what the factor is likely about
              const fl = f.toLowerCase();
              const icon = fl.includes('rank') || fl.includes('seed') ? '📊'
                : fl.includes('surface') || fl.includes('clay') || fl.includes('grass') || fl.includes('hard') ? '🎾'
                  : fl.includes('form') || fl.includes('w/l') || fl.includes('won') || fl.includes('lost') ? '📈'
                    : fl.includes('h2h') || fl.includes('head') || fl.includes('meeting') || fl.includes('record') ? '⚔️'
                      : fl.includes('serve') || fl.includes('ace') || fl.includes('style') || fl.includes('game') ? '💥'
                        : fl.includes('round') || fl.includes('tournament') || fl.includes('draw') || fl.includes('seeded') ? '🏆'
                          : fl.includes('fatigue') || fl.includes('fitness') || fl.includes('injur') || fl.includes('schedule') ? '💪'
                            : '→';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px',
                  background: i % 2 === 0 ? 'var(--bg-glass)' : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>{f}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent form strip — shown when no H2H and we have DB recent matches */}
      {pred.source === 'ai' && !pred.key_factors?.some(f => f.toLowerCase().includes('h2h') || f.toLowerCase().includes('head-to-head') || f.toLowerCase().includes('meeting')) && (
        <div style={{
          marginTop: '12px', padding: '12px 14px', borderRadius: '10px',
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
            Recent Form
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { name: m.player1?.name, form: m.player1?.recent_form },
              { name: m.player2?.name, form: m.player2?.recent_form },
            ].map(({ name, form }) => {
              const letters = (form ?? '').split('').filter(c => c === 'W' || c === 'L');
              if (!letters.length) return null;
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-faint)', minWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {letters.slice(-5).map((r, i) => (
                      <div key={i} style={{
                        width: '24px', height: '24px', borderRadius: '5px', fontWeight: 800, fontSize: '11px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: r === 'W' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                        border: `1px solid ${r === 'W' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.3)'}`,
                        color: r === 'W' ? 'var(--green)' : 'var(--red)',
                      }}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
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

  return (
    <Card>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', marginBottom: '16px' }}>
        Head to Head
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p1?.name}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, color: 'var(--lime)' }}>{h2h.p1_wins ?? 0}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{h2h.total ?? 0}</p>
          <p style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>matches</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p2?.name}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, color: 'var(--clay)' }}>{h2h.p2_wins ?? 0}</p>
        </div>
      </div>

      {h2h.meetings?.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            Recent Meetings
          </p>
          {h2h.meetings.slice(0, 5).map((meet, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 0',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              fontSize: '13px',
            }}>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '11px', flexShrink: 0 }}>
                {meet.year ?? '—'}
              </span>
              <span style={{ flex: 1, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
// ─────────────────────────────────────────────────────────────────────────────
const RANKING_TOURS = [
  { id: 'ATP', label: 'ATP', color: '#60a5fa', pointsLabel: 'Points', interactive: true },
  { id: 'WTA', label: 'WTA', color: '#f472b6', pointsLabel: 'Points', interactive: true },
  { id: 'ITF_MEN', label: 'ITF Men', color: '#fb923c', pointsLabel: 'Wins', interactive: false },
  { id: 'ITF_WOMEN', label: 'ITF Women', color: '#f59e0b', pointsLabel: 'Wins', interactive: false },
  { id: 'UTR_MEN', label: 'UTR Men', color: '#a78bfa', pointsLabel: 'Wins', interactive: false },
  { id: 'UTR_WOMEN', label: 'UTR Women', color: '#e879f9', pointsLabel: 'Wins', interactive: false },
];

function RankingsTab({ onSelectPlayer }) {
  const [tour, setTour] = useState('ATP');
  const [hovRow, setHovRow] = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  const tourDef = RANKING_TOURS.find(t => t.id === tour) ?? RANKING_TOURS[0];
  const isClickable = tourDef.interactive;
  const isAltTour = !isClickable;

  return (
    <div className="tv-fade-up">

      {/* Tour selector pills */}
      <div className="tv-rankings-filters" style={{
        display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap',
      }}>
        {RANKING_TOURS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTour(t.id); setHovRow(null); }}
            style={{
              padding: '6px 16px', borderRadius: '999px',
              border: tour === t.id ? 'none' : '1px solid var(--border)',
              background: tour === t.id ? t.color : 'var(--bg-glass-md)',
              color: tour === t.id ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '12px',
              cursor: 'pointer', transition: 'var(--t)', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div style={{
        padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
        background: `${tourDef.color}10`,
        border: `1px solid ${tourDef.color}30`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '14px' }}>{isAltTour ? 'ℹ️' : '👆'}</span>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          {isAltTour ? (
            <>
              <span style={{ color: tourDef.color, fontWeight: 700 }}>{tourDef.label}</span>
              {' '}rankings are derived from match wins. Player profiles are not available for this tour.
            </>
          ) : (
            <>
              Showing <span style={{ color: tourDef.color, fontWeight: 700 }}>Top 50</span>
              {' '}— click any player to view their full profile and stats.
            </>
          )}
        </p>
      </div>

      {/* States */}
      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorMessage msg={error} />
      ) : rankings.length === 0 ? (
        <EmptyState
          icon="📊"
          title={`No ${tourDef.label} rankings yet`}
          desc={isAltTour
            ? 'Rankings appear once matches of this type are synced.'
            : 'Rankings will appear after the next sync.'}
        />
      ) : (
        <Card style={{ overflow: 'hidden' }}>

          {/* Header row */}
          <div className="tv-ranking-header" style={{
            display: 'grid',
            gridTemplateColumns: '36px minmax(0,1fr) 70px',
            gap: '8px', padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px', fontWeight: 700,
            color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            <span>#</span>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>{tourDef.pointsLabel}</span>
          </div>

          {/* Player rows */}
          {rankings.map((p, i) => {
            const rank = p.rank ?? (i + 1);
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
            const flag = p.flag && p.flag !== '🏳️' ? p.flag : resolveFlag(p.country ?? '');
            const rankDir = p.prev_rank == null ? null
              : p.prev_rank > rank ? 'up'
                : p.prev_rank < rank ? 'down'
                  : 'same';

            return (
              <div
                className="tv-ranking-row"
                key={p.id ?? i}
                onClick={() => isClickable && onSelectPlayer?.(p)}
                onMouseEnter={() => isClickable && setHovRow(i)}
                onMouseLeave={() => isClickable && setHovRow(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0,1fr) 70px',
                  gap: '8px', padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  background: isClickable && hovRow === i ? 'var(--bg-glass)' : 'transparent',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                  alignItems: 'center',
                  opacity: isAltTour ? 0.78 : 1,
                }}
              >
                {/* Rank */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px',
                  color: rank <= 3 ? tourDef.color : 'var(--text-muted)',
                }}>
                  {medal ?? rank}
                </span>

                {/* Name + flag + movement */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{flag}</span>
                  <span style={{
                    fontWeight: 600, fontSize: '13px', color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </span>
                  {rankDir && rankDir !== 'same' && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, flexShrink: 0,
                      color: rankDir === 'up' ? 'var(--lime)' : 'var(--clay)',
                    }}>
                      {rankDir === 'up' ? '▲' : '▼'}
                    </span>
                  )}
                </div>

                {/* Points */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                  fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right',
                }}>
                  {p.points != null ? p.points.toLocaleString() : '—'}
                </span>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border)',
            fontSize: '11px', color: 'var(--text-faint)', textAlign: 'center',
          }}>
            Showing Top {rankings.length}
            {' · '}
            {isAltTour ? 'Derived from match wins' : 'Official rankings'}
            {isClickable && (
              <span style={{ color: tourDef.color }}>
                {' · '}Click a player for full profile
              </span>
            )}
          </div>

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
  const textareaRef = useRef(null);

  function submit(e) {
    e?.preventDefault();
    if (!input.trim() || typing) return;
    sendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleInputChange(e) {
    const val = e.target.value.slice(0, CHAT_MAX_CHARS);
    setInput(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  const charsLeft = CHAT_MAX_CHARS - input.length;
  const charColor = charsLeft < 50 ? 'var(--red)' : charsLeft < 100 ? 'var(--yellow)' : 'var(--text-faint)';

  const suggestions = [
    "Who should win today's ATP matches?",
    'Explain clay vs hard court differences',
    "Analyze Alcaraz's recent form",
    "Compare Swiatek and Sabalenka's styles",
  ];

  return (
    <div className="tv-fade-up tv-chat-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

      <div className="tv-chat-shell">

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderBottom: 'none',
          borderRadius: 'var(--radius) var(--radius) 0 0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', margin: 0 }}>
                Tennis AI Analyst
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '1px' }}>
                Powered by Gemini · Tennis expert
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            style={{
              padding: '5px 10px', borderRadius: '6px',
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              color: 'var(--text-faint)', fontSize: '11px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'var(--t)',
            }}
          >
            New Chat
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderTop: 'none', borderBottom: 'none',
          display: 'flex', flexDirection: 'column', gap: '16px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {contextMatch && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(159,239,102,0.06)', border: '1px solid rgba(159,239,102,0.2)',
              fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0,
            }}>
              📍 Context: <strong>{contextMatch.player1?.name}</strong> vs <strong>{contextMatch.player2?.name}</strong>
              {' '}· {contextMatch.surface} · {contextMatch.tournament}
            </div>
          )}

          {messages.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '20px 0',
            }}>
              <span style={{ fontSize: '40px' }}>🎾</span>
              <p style={{ color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
                Ask me anything about ATP/WTA matches, players, stats, or predictions.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                flexShrink: 0,
              }}
            >
              <div style={{
                maxWidth: 'min(80%, 520px)',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, rgba(159,239,102,0.18), rgba(159,239,102,0.1))'
                  : 'var(--bg-glass-md)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(159,239,102,0.25)' : 'var(--border)'}`,
                fontSize: '14px',
                lineHeight: 1.65,
                color: 'var(--text)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
              <div style={{
                padding: '10px 16px', borderRadius: '14px 14px 14px 4px',
                background: 'var(--bg-glass-md)', border: '1px solid var(--border)',
                display: 'flex', gap: '5px', alignItems: 'center',
              }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--lime)', display: 'block',
                    animation: `tv-live-dot 1.2s ease ${delay}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} style={{ flexShrink: 0 }} />
        </div>

        {/* Suggestion chips */}
        {messages.length === 0 && !typing && (
          <div
            className="tv-chat-suggestions"
            style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', flexShrink: 0 }}
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { sendMessage(s); }}
                style={{
                  padding: '7px 13px', whiteSpace: 'nowrap',
                  borderRadius: '999px', border: '1px solid var(--border)',
                  background: 'var(--bg-glass)', color: 'var(--text-muted)',
                  fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'var(--t)', flexShrink: 0,
                  minHeight: '36px',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lime)'; e.currentTarget.style.color = 'var(--lime)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input footer */}
        <div className="tv-chat-input-footer">
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask about any match, player, or prediction…"
              rows={1}
              style={{
                width: '100%',
                resize: 'none',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '11px 44px 11px 14px',
                color: 'var(--text)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                lineHeight: 1.5,
                outline: 'none',
                overflowY: 'hidden',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
                WebkitTextSizeAdjust: '100%',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(159,239,102,0.4)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <span style={{
              position: 'absolute', right: '10px', bottom: '10px',
              fontSize: '10px', color: charColor,
              fontFamily: 'var(--font-mono)', pointerEvents: 'none',
            }}>
              {charsLeft < 200 ? charsLeft : ''}
            </span>
          </div>

          <button
            className="tv-chat-send-btn"
            onClick={submit}
            disabled={!input.trim() || typing}
            style={{
              background: !input.trim() || typing ? 'var(--bg-glass-md)' : 'var(--lime)',
            }}
          >
            {typing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.5">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={!input.trim() ? 'var(--text-faint)' : '#070B14'}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}