// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx  –  TennisVantage main app screen
// Sections: Live Matches · Predictions · Rankings · AI Chat (stub)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat } from '../hooks/hooks';
import { Logo, Btn, Badge, Card, Spinner } from '../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
//  LAYOUT SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, profile, firstName, logout } = useAuth();
  const [activeTab, setActiveTab]     = useState('matches');   // matches | predictions | rankings | chat
  const [mobileMenu, setMobileMenu]   = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const tabs = [
    { id: 'matches',     label: 'Live & Upcoming', icon: '🎾' },
    { id: 'predictions', label: 'Predictions',     icon: '🔮' },
    { id: 'rankings',    label: 'Rankings',        icon: '🏆' },
    { id: 'chat',        label: 'AI Analyst',      icon: '🤖' },
  ];

  async function handleLogout() {
    await logout();
    showToast('Signed out successfully', 'info');
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Navbar ──────────────────────────────────────────────────── */}
      <nav style={{
        background: 'rgba(7,11,20,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)',
        height: '62px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Logo size="sm" />

        {/* Desktop tab bar */}
        <div className="hide-sm" style={{ display: 'flex', gap: '4px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
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
          <div className="hide-sm" style={{
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
          <Btn variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Btn>

          {/* Mobile hamburger */}
          <button
            className="show-sm"
            onClick={() => setMobileMenu(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '6px' }}
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
        <div className="tv-fade-in show-sm" style={{
          position: 'fixed', top: '62px', left: 0, right: 0,
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          zIndex: 99, padding: '12px',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setMobileMenu(false); }}
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

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        maxWidth: '1200px', width: '100%', margin: '0 auto',
        padding: 'clamp(20px,3vh,40px) clamp(16px,3vw,40px)',
      }}>
        {/* Greeting banner */}
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

        {/* Tab content */}
        {activeTab === 'matches'     && <MatchesTab     onSelectMatch={m => { setSelectedMatch(m); setActiveTab('predictions'); }} />}
        {activeTab === 'predictions' && <PredictionsTab selectedMatch={selectedMatch} onSelectMatch={setSelectedMatch} />}
        {activeTab === 'rankings'    && <RankingsTab />}
        {activeTab === 'chat'        && <AiChatTab      contextMatch={selectedMatch} />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MATCHES TAB
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ onSelectMatch }) {
  const { live, upcoming, loading, error, refresh } = useMatches();

  if (loading) return <LoadingGrid />;
  if (error)   return <ErrorMessage msg={error} onRetry={refresh} />;

  return (
    <div className="tv-fade-up">
      {/* Live matches */}
      {live.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading
            label="Live Now"
            accent="var(--green)"
            dot
          />
          <div style={gridStyle}>
            {live.map(m => <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section>
        <SectionHeading label="Upcoming Matches" />
        <div style={gridStyle}>
          {upcoming.map((m, i) => (
            <div key={m.id} className={`tv-fade-up d${Math.min(i + 1, 5)}`}>
              <MatchCard match={m} onPredict={() => onSelectMatch(m)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MatchCard({ match: m, onPredict }) {
  const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };
  const surfaceColor  = surfaceColors[m.surface] ?? 'var(--text-muted)';

  return (
    <Card hover glow style={{ cursor: 'default' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500 }}>{m.tournament} · {m.round}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
              padding: '2px 8px', borderRadius: '999px',
              background: `${surfaceColor}18`, color: surfaceColor,
              border: `1px solid ${surfaceColor}30`,
              textTransform: 'uppercase',
            }}>{m.surface}</span>
            {m.date && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{m.date}</span>}
          </div>
        </div>
        {m.status === 'live' && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 700, color: 'var(--green)',
            background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
            padding: '4px 10px', borderRadius: '999px',
          }}>
            <span className="live-dot" /> LIVE
          </span>
        )}
      </div>

      {/* Players */}
      {[m.player1, m.player2].map((p, i) => (
        <div key={p.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '11px 14px', marginBottom: i === 0 ? '6px' : 0,
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>{p.flag}</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: '14.5px' }}>{p.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>#{p.rank} ATP</p>
            </div>
          </div>
          {m.score && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '14px',
              fontWeight: 600, color: 'var(--lime)',
            }}>{m.score.split(', ')[i] ?? ''}</span>
          )}
        </div>
      ))}

      {/* CTA */}
      <Btn
        variant="lime" size="sm" fullWidth
        style={{ marginTop: '16px' }}
        onClick={onPredict}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Predict this match
      </Btn>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PREDICTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ selectedMatch, onSelectMatch }) {
  const { matches: allMatches } = useMockMatchList();
  const { prediction, loading } = usePrediction(selectedMatch);

  return (
    <div className="tv-fade-up" style={{
      display: 'grid',
      gridTemplateColumns: 'clamp(240px,38%,380px) 1fr',
      gap: '20px',
      alignItems: 'start',
    }}>
      {/* Sidebar: match picker */}
      <div>
        <SectionHeading label="Select a Match" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allMatches.map(m => (
            <MatchPickerRow
              key={m.id} match={m}
              selected={selectedMatch?.id === m.id}
              onSelect={() => onSelectMatch(m)}
            />
          ))}
        </div>
      </div>

      {/* Main: prediction card */}
      <div>
        <SectionHeading label="Match Analysis" />
        {!selectedMatch ? (
          <EmptyState
            icon="🔮"
            title="Select a match to analyse"
            desc="Choose any upcoming or live match to see our AI prediction breakdown."
          />
        ) : loading ? (
          <LoadingGrid cols={1} rows={1} />
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
      style={{
        display: 'flex', flexDirection: 'column', gap: '6px',
        padding: '14px 16px', width: '100%', textAlign: 'left',
        background: selected ? 'rgba(159,239,102,0.08)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'rgba(159,239,102,0.35)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'var(--t)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{m.tournament}</span>
        {m.status === 'live' && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--green)', fontWeight: 700 }}><span className="live-dot" style={{ width: 5, height: 5 }} />LIVE</span>}
      </div>
      <span style={{ fontSize: '14px', fontWeight: 600, color: selected ? 'var(--lime)' : 'var(--text)' }}>
        {m.player1.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>vs</span> {m.player2.name}
      </span>
    </button>
  );
}

function PredictionPanel({ match: m, prediction: pred }) {
  if (!pred) return <ErrorMessage msg="Could not compute prediction" />;

  const { player1_win_pct: p1, player2_win_pct: p2, confidence, key_factors } = pred;
  const confColors = { High: 'var(--green)', Medium: 'var(--yellow)', Low: 'var(--clay)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Win probability card */}
      <Card glow>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Win Probability</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
              {m.player1.name} vs {m.player2.name}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {m.tournament} · {m.round} · {m.surface}
            </p>
          </div>
          <Badge color={confColors[confidence]}>{confidence} confidence</Badge>
        </div>

        {/* Bar chart */}
        {[
          { name: m.player1.name, flag: m.player1.flag, pct: p1, color: 'var(--lime)' },
          { name: m.player2.name, flag: m.player2.flag, pct: p2, color: 'var(--clay)' },
        ].map(row => (
          <div key={row.name} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}>
                {row.flag} {row.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '17px', color: row.color,
              }}>{row.pct}%</span>
            </div>
            <div style={{ height: '10px', background: 'var(--border-md)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${row.pct}%`,
                background: row.pct > 55
                  ? `linear-gradient(90deg, ${row.color}, ${row.color}cc)`
                  : `${row.color}88`,
                borderRadius: '99px',
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: `0 0 12px ${row.color}50`,
              }} />
            </div>
          </div>
        ))}
      </Card>

      {/* Key factors */}
      <Card>
        <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '14px' }}>Key Prediction Factors</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {key_factors.map(f => (
            <div key={f} style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              padding: '11px 14px', background: 'var(--bg-glass)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5" style={{ marginTop: 2, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{f}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Player stat comparison */}
      <Card>
        <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '14px' }}>Player Stats</p>
        <StatRow label="ATP Rank" v1={`#${m.player1.rank}`} v2={`#${m.player2.rank}`} />
        <StatRow label="Career Wins" v1={m.player1.wins} v2={m.player2.wins} />
        <StatRow label="1st Serve %" v1={`${m.player1.first_serve_pct}%`} v2={`${m.player2.first_serve_pct}%`} />
        <StatRow label="Ace Avg" v1={m.player1.ace_avg} v2={m.player2.ace_avg} />
        <StatRow label="Surface Pref" v1={m.player1.surface_pref} v2={m.player2.surface_pref} />
      </Card>
    </div>
  );
}

function StatRow({ label, v1, v2 }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', marginBottom: '10px', gap: '12px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--lime)', textAlign: 'right', fontWeight: 600 }}>{v1}</span>
      <span style={{ fontSize: '11.5px', color: 'var(--text-faint)', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--clay)', textAlign: 'left', fontWeight: 600 }}>{v2}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RANKINGS TAB
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab() {
  const { rankings, loading, error } = useRankings('ATP');
  const [hovRow, setHovRow] = useState(null);

  if (loading) return <LoadingGrid cols={1} rows={8} />;
  if (error)   return <ErrorMessage msg={error} />;

  return (
    <div className="tv-fade-up">
      <SectionHeading label="ATP Live Rankings" />
      <Card padding="0" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '52px 1fr 100px 80px',
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-glass)',
        }}>
          {['#', 'Player', 'Points', 'W/L'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {rankings.map((p, i) => (
          <div
            key={p.id}
            onMouseEnter={() => setHovRow(p.id)}
            onMouseLeave={() => setHovRow(null)}
            style={{
              display: 'grid', gridTemplateColumns: '52px 1fr 100px 80px',
              padding: '14px 20px', alignItems: 'center',
              borderBottom: i < rankings.length - 1 ? '1px solid var(--border)' : 'none',
              background: hovRow === p.id ? 'rgba(159,239,102,0.04)' : 'transparent',
              transition: 'var(--t)', cursor: 'default',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              fontSize: i < 3 ? '16px' : '14px',
              color: i === 0 ? 'var(--lime)' : i === 1 ? 'var(--yellow)' : i === 2 ? 'var(--clay)' : 'var(--text-faint)',
            }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>{p.flag}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14.5px' }}>{p.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{p.country} · {p.surface_pref}</p>
              </div>
            </div>

            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: hovRow === p.id ? 'var(--lime)' : 'var(--text)',
              fontSize: '14px',
            }}>
              {p.points?.toLocaleString()}
            </span>

            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--green)' }}>{p.wins}</span>
              <span style={{ color: 'var(--text-faint)' }}>/{p.losses}</span>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  AI CHAT TAB  — AI integration prep area
// ─────────────────────────────────────────────────────────────────────────────
function AiChatTab({ contextMatch }) {
  const { messages, typing, sendMessage, reset, bottomRef } = useAiChat(contextMatch);
  const [input, setInput] = useState('');

  function submit(e) {
    e?.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  }

  const suggestions = [
    "Who is favoured to win today?",
    "Explain clay vs hard court performance",
    "What does 'first serve percentage' mean?",
    "Compare Djokovic and Alcaraz's recent form",
  ];

  return (
    <div className="tv-fade-up" style={{
      display: 'grid',
      gridTemplateColumns: contextMatch ? '1fr clamp(220px,28%,300px)' : '1fr',
      gap: '20px', alignItems: 'start',
    }}>
      {/* Chat panel */}
      <Card padding="0" style={{ display: 'flex', flexDirection: 'column', height: 'clamp(500px,70vh,720px)', overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-glass)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}>🤖</div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>AI Tennis Analyst</p>
              <p style={{ fontSize: '11px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                Online
              </p>
            </div>
          </div>
          <Btn variant="ghost" size="sm" onClick={reset}>Clear</Btn>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}
          {typing && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-card-alt)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 2px' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '18px' }}>
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)', animation: `tv-live-dot 1s ease ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions */}
        {messages.length === 1 && (
          <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  padding: '6px 12px', background: 'var(--bg-glass)',
                  border: '1px solid var(--border)', borderRadius: '999px',
                  color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'var(--t)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lime)'; e.currentTarget.style.color = 'var(--lime)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={submit} style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '10px',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about any match, player, or prediction…"
            style={{
              flex: 1, padding: '11px 16px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-md)',
              borderRadius: '999px', color: 'var(--text)', fontSize: '14px',
              outline: 'none', fontFamily: 'var(--font-body)',
              transition: 'var(--t)',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(159,239,102,0.4)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
          />
          <Btn type="submit" variant="primary" size="sm" disabled={!input.trim() || typing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </Btn>
        </form>
      </Card>

      {/* Context card: selected match */}
      {contextMatch && (
        <div>
          <SectionHeading label="Analysing Match" />
          <Card>
            <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '10px' }}>{contextMatch.tournament} · {contextMatch.round}</p>
            <p style={{ fontWeight: 700, marginBottom: '6px' }}>{contextMatch.player1.name}</p>
            <p style={{ color: 'var(--text-faint)', fontSize: '13px', marginBottom: '10px' }}>vs</p>
            <p style={{ fontWeight: 700, marginBottom: '16px' }}>{contextMatch.player2.name}</p>
            <Badge color={contextMatch.surface === 'Clay' ? 'var(--clay)' : contextMatch.surface === 'Grass' ? 'var(--green)' : 'var(--blue)'}>
              {contextMatch.surface}
            </Badge>
          </Card>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '12px', lineHeight: 1.6 }}>
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
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: isAI ? 'row' : 'row-reverse' }}>
      {isAI && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
      )}
      <div style={{
        maxWidth: '80%', padding: '11px 15px',
        background: isAI ? 'var(--bg-card-alt)' : 'rgba(159,239,102,0.12)',
        border: `1px solid ${isAI ? 'var(--border)' : 'rgba(159,239,102,0.25)'}`,
        borderRadius: isAI ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
        fontSize: '14px', lineHeight: 1.6, color: 'var(--text)',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeading({ label, accent = 'var(--lime)', dot }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: 'clamp(14px,2vw,17px)', letterSpacing: '-0.01em',
      marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)',
    }}>
      {dot && <span className="live-dot" />}
      {label}
      <span style={{ flex: 1, height: '1px', background: 'var(--border)', display: 'block' }} />
    </h2>
  );
}

function LoadingGrid({ cols = 2, rows = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px' }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius)' }} />
      ))}
    </div>
  );
}

function ErrorMessage({ msg, onRetry }) {
  return (
    <div style={{
      padding: '32px', textAlign: 'center',
      background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)',
      borderRadius: 'var(--radius)',
    }}>
      <p style={{ color: 'var(--red)', marginBottom: '12px' }}>⚠ {msg}</p>
      {onRetry && <Btn variant="danger" size="sm" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.7 }}>{icon}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', marginBottom: '10px' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '320px', margin: '0 auto', lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(260px,30vw,340px), 1fr))',
  gap: '16px',
};

// ── tiny hook to access all mock matches (for predictions picker) ────────────
function useMockMatchList() {
  const { live, upcoming } = useMatches();
  return { matches: [...live, ...upcoming] };
}
