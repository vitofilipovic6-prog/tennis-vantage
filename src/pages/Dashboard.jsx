// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx – TennisVantage (complete rewrite)
// NEW vs previous:
//   • "Sign Out" moved into mobile hamburger overlay (not cramped in top-right)
//   • RankingsTab → clickable rows → PlayerModal (bio + stats + last-5 serve table)
//   • MatchCalendar integrated in MatchesTab with per-date fetch + empty state
//   • AiChatTab wired to real Anthropic API via sendChatMessage() (ATP-only prompt)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat } from '../hooks/hooks';
import { Logo, Btn, Badge, Card } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';
import { getPlayerProfile, getMatchesByDate } from '../services/tennisApi';

const TABS = [
  { id: 'matches',     label: 'Live & Upcoming', icon: '🎾' },
  { id: 'predictions', label: 'Predictions',     icon: '🔮' },
  { id: 'rankings',    label: 'Rankings',        icon: '🏆' },
  { id: 'chat',        label: 'AI Analyst',      icon: '🤖' },
];

// ─── SHELL ────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();
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

  // Lock scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileMenu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenu]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <style>{DB_CSS}</style>
      <div className="db-root">

        {/* ══ NAVBAR ════════════════════════════════════════════════════════ */}
        <nav className="db-nav">
          <Logo size="sm" />

          {/* Desktop tabs */}
          <div className="db-nav__tabs hide-sm">
            {TABS.map(t => (
              <button key={t.id} className={`db-tab${activeTab===t.id?' db-tab--on':''}`} onClick={() => setActiveTab(t.id)}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* Desktop user + sign out */}
          <div className="db-nav__right hide-sm">
            <div className="db-pill">
              <div className="db-pill__av">{(firstName?.[0]??'P').toUpperCase()}</div>
              <span className="db-pill__name">{firstName}</span>
            </div>
            <Btn variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Btn>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`db-ham show-sm${mobileMenu?' db-ham--open':''}`}
            aria-label="Toggle menu" aria-expanded={mobileMenu}
            onClick={e => { e.stopPropagation(); setMobileMenu(v => !v); }}
          >
            <span className="db-ham__b db-ham__b--t"/><span className="db-ham__b db-ham__b--m"/><span className="db-ham__b db-ham__b--b"/>
          </button>
        </nav>

        {/* ══ MOBILE OVERLAY ════════════════════════════════════════════════ */}
        <div className={`db-backdrop show-sm${mobileMenu?' db-backdrop--on':''}`} onClick={() => setMobileMenu(false)} />
        <aside className={`db-overlay show-sm${mobileMenu?' db-overlay--open':''}`}>
          <div className="db-overlay__glow" aria-hidden="true" />

          {/* User badge */}
          <div className="db-overlay__user">
            <div className="db-overlay__av">{(firstName?.[0]??'P').toUpperCase()}</div>
            <div>
              <p className="db-overlay__name">{firstName}</p>
              <p className="db-overlay__email">{user?.email}</p>
            </div>
          </div>

          <div className="db-overlay__hr" />

          {/* Nav tabs */}
          <nav className="db-overlay__nav">
            {TABS.map((t,i) => (
              <button key={t.id} className={`db-overlay__link${activeTab===t.id?' db-overlay__link--on':''}`} style={{'--i':i}}
                onClick={() => { setActiveTab(t.id); setMobileMenu(false); }}>
                <span className="db-overlay__icon">{t.icon}</span>
                <span>{t.label}</span>
                {activeTab===t.id && <span className="db-overlay__dot"/>}
              </button>
            ))}
          </nav>

          <div className="db-overlay__hr" />

          {/* ★ Sign Out lives here on mobile */}
          <button className="db-overlay__signout" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </aside>

        {/* ══ MAIN CONTENT ══════════════════════════════════════════════════ */}
        <main className="db-main">

          {/* Greeting */}
          <div className="db-greeting">
            <div>
              <h1 className="db-greeting__h">{greeting}, <span className="db-greeting__name">{firstName}</span> 👋</h1>
              <p className="db-greeting__sub">{user?.email} · {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</p>
            </div>
            <div className="db-greeting__badge hide-sm">
              <span>{TABS.find(t=>t.id===activeTab)?.icon}</span>
              {TABS.find(t=>t.id===activeTab)?.label}
            </div>
          </div>

          {/* Tab content */}
          {activeTab==='matches'     && <MatchesTab     onSelectMatch={goToPredict}                              showToast={showToast} />}
          {activeTab==='predictions' && <PredictionsTab selectedMatch={selectedMatch} onSelectMatch={setSelectedMatch} />}
          {activeTab==='rankings'    && <RankingsTab    showToast={showToast} />}
          {activeTab==='chat'        && <AiChatTab      contextMatch={selectedMatch} />}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="db-bottom show-sm">
          {TABS.map(t => (
            <button key={t.id} className={`db-bottom__item${activeTab===t.id?' db-bottom__item--on':''}`}
              onClick={() => { setActiveTab(t.id); setMobileMenu(false); }}>
              <span className="db-bottom__icon">{t.icon}</span>
              <span className="db-bottom__lbl">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>

      </div>
    </>
  );
}

// ─── MATCHES TAB (with calendar) ──────────────────────────────────────────────
function MatchesTab({ onSelectMatch, showToast }) {
  const { live, upcoming, loading, error, refresh } = useMatches();
  const [calDate,   setCalDate]   = useState(new Date());
  const [calMatches,setCalMatches]= useState(null);
  const [calLoading,setCalLoading]= useState(false);

  async function handleDateSelect(date) {
    setCalDate(date);
    setCalLoading(true);
    try {
      const data = await getMatchesByDate(date);
      setCalMatches(data);
    } catch {
      setCalMatches([]);
      showToast?.('Could not load matches for this date', 'error');
    } finally {
      setCalLoading(false);
    }
  }

  if (loading) return <LoadingGrid />;
  if (error)   return <ErrMsg msg={error} onRetry={refresh} />;

  const UPCOMING_SUGGESTIONS = [
    { label:'Roland Garros', date:'Jun 26 – Jul 6', surface:'Clay',  accent:'#f97316' },
    { label:'Wimbledon',     date:'Jun 30 – Jul 13',surface:'Grass', accent:'#4ade80' },
    { label:'US Open',       date:'Aug 25 – Sep 7', surface:'Hard',  accent:'#60a5fa' },
  ];

  return (
    <div className="tv-fade-up">
      {/* Calendar strip */}
      <div className="db-cal-wrap">
        <MatchCalendar onSelectDate={handleDateSelect} />
      </div>

      {/* Per-date matches */}
      {calMatches !== null && (
        <section className="db-section" style={{marginBottom:32}}>
          <SecHead label={calDate.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} />
          {calLoading ? (
            <LoadingGrid cols={2} rows={1} />
          ) : calMatches.length === 0 ? (
            <CalEmptyState suggestions={UPCOMING_SUGGESTIONS} onSelect={onSelectMatch} />
          ) : (
            <div className="db-mgrid">
              {calMatches.map(m => <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />)}
            </div>
          )}
        </section>
      )}

      {/* Live matches */}
      {live.length > 0 && (
        <section className="db-section">
          <SecHead label="Live Now" dot accent="var(--green)" />
          <div className="db-mgrid">
            {live.map(m => <MatchCard key={m.id} match={m} onPredict={() => onSelectMatch(m)} />)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section className="db-section">
        <SecHead label="Upcoming Matches" />
        {upcoming.length === 0
          ? <EmptyState icon="🎾" title="No upcoming matches" desc="Fixtures are updated daily. Check back soon." />
          : <div className="db-mgrid">{upcoming.map((m,i)=><div key={m.id} className={`tv-fade-up d${Math.min(i+1,5)}`}><MatchCard match={m} onPredict={()=>onSelectMatch(m)} /></div>)}</div>
        }
      </section>
    </div>
  );
}

function CalEmptyState({ suggestions }) {
  return (
    <div className="db-empty-cal">
      <div className="db-empty-cal__icon">📅</div>
      <h3 className="db-empty-cal__title">No matches scheduled</h3>
      <p className="db-empty-cal__desc">There are no ATP fixtures on this day. Here are the next big events to look forward to:</p>
      <div className="db-suggestions">
        {suggestions.map(s => (
          <div key={s.label} className="db-suggestion" style={{'--sa':s.accent}}>
            <div className="db-suggestion__surface" style={{background:`${s.accent}18`,color:s.accent,border:`1px solid ${s.accent}30`}}>{s.surface}</div>
            <div>
              <p className="db-suggestion__name">{s.label}</p>
              <p className="db-suggestion__date">{s.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match:m, onPredict }) {
  const [hov,setHov]=useState(false);
  const SC = { Clay:'#f97316', Hard:'#60a5fa', Grass:'#4ade80' };
  const sc = SC[m.surface] ?? 'var(--text-muted)';
  return (
    <div className={`db-mc${hov?' db-mc--hov':''}`} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div className="db-mc__hdr">
        <div>
          <p className="db-mc__tourney">{m.tournament} · {m.round}</p>
          <div className="db-mc__badges">
            <span className="db-surface" style={{'--sc':sc}}>{m.surface}</span>
            {m.date && <span className="db-mc__date">{m.date}</span>}
          </div>
        </div>
        {m.status==='live' && <span className="db-live-badge"><span className="live-dot"/>LIVE</span>}
      </div>
      {[m.player1,m.player2].map((p,i)=>(
        <div key={p.id??i} className="db-mc__player">
          <div className="db-mc__pi"><span className="db-mc__flag">{p.flag}</span><div><p className="db-mc__pname">{p.name}</p><p className="db-mc__prank">#{p.rank} ATP</p></div></div>
          {m.score && <span className="db-mc__score">{m.score.split(', ')[i]??''}</span>}
        </div>
      ))}
      <button className="db-mc__btn" onClick={onPredict}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Predict this match
      </button>
    </div>
  );
}

// ─── PREDICTIONS TAB ──────────────────────────────────────────────────────────
function PredictionsTab({ selectedMatch, onSelectMatch }) {
  const { live, upcoming } = useMatches();
  const allMatches = [...(live??[]), ...(upcoming??[])];
  const { prediction, loading } = usePrediction(selectedMatch);

  return (
    <div className="tv-fade-up db-pred-layout">
      <div className="db-pred-sidebar">
        <SecHead label="Select a Match" />
        <div className="db-picker-list">
          {allMatches.length===0
            ? <p style={{fontSize:13,color:'var(--text-faint)',padding:'12px 0'}}>No matches available</p>
            : allMatches.map(m=><PickerRow key={m.id} match={m} selected={selectedMatch?.id===m.id} onSelect={()=>onSelectMatch(m)} />)
          }
        </div>
      </div>
      <div>
        <SecHead label="Match Analysis" />
        {!selectedMatch
          ? <EmptyState icon="🔮" title="Select a match to analyse" desc="Choose any upcoming or live match to see the full AI prediction breakdown." />
          : loading
          ? <LoadingGrid cols={1} rows={3} />
          : <PredPanel match={selectedMatch} prediction={prediction} />
        }
      </div>
    </div>
  );
}

function PickerRow({ match:m, selected, onSelect }) {
  return (
    <button onClick={onSelect} className={`db-pr${selected?' db-pr--on':''}`}>
      <div className="db-pr__top">
        <span className="db-pr__t">{m.tournament}</span>
        {m.status==='live'&&<span className="db-pr__live"><span className="live-dot" style={{width:5,height:5}}/>LIVE</span>}
      </div>
      <span className="db-pr__players">{m.player1.name} <span style={{color:'var(--text-faint)',fontWeight:400}}>vs</span> {m.player2.name}</span>
    </button>
  );
}

function PredPanel({ match:m, prediction:pred }) {
  if (!pred) return <ErrMsg msg="Could not compute prediction for this match." />;
  const { player1_win_pct:p1, player2_win_pct:p2, confidence, key_factors } = pred;
  const CC = { High:'var(--green)', Medium:'var(--yellow)', Low:'var(--clay)' };
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div className="db-panel">
        <div className="db-panel__hdr">
          <div><p className="db-eyebrow">Win Probability</p><h2 className="db-panel__title">{m.player1.name} vs {m.player2.name}</h2><p className="db-panel__sub">{m.tournament} · {m.round} · {m.surface}</p></div>
          <Badge color={CC[confidence]??'var(--lime)'}>{confidence} confidence</Badge>
        </div>
        {[{name:m.player1.name,flag:m.player1.flag,pct:p1,color:'var(--lime)'},{name:m.player2.name,flag:m.player2.flag,pct:p2,color:'var(--clay)'}].map(r=>(
          <div key={r.name} className="db-prob">
            <div className="db-prob__p"><span>{r.flag}</span><span className="db-prob__nm">{r.name}</span></div>
            <div className="db-prob__row">
              <div className="db-prob__bar"><div className="db-prob__fill" style={{width:`${r.pct}%`,'--fc':r.color}}/></div>
              <span className="db-prob__pct" style={{color:r.color}}>{r.pct}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="db-panel">
        <p className="db-eyebrow" style={{marginBottom:12}}>Key Prediction Factors</p>
        {key_factors.map(f=>(
          <div key={f} className="db-factor"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5" style={{flexShrink:0,marginTop:2}}><polyline points="20 6 9 17 4 12"/></svg><span>{f}</span></div>
        ))}
      </div>
      <div className="db-panel">
        <p className="db-eyebrow" style={{marginBottom:12}}>Player Stats</p>
        {[
          {label:'ATP Rank',     v1:`#${m.player1.rank}`,             v2:`#${m.player2.rank}`},
          {label:'Career Wins',  v1:m.player1.wins,                   v2:m.player2.wins},
          {label:'1st Serve %',  v1:`${m.player1.first_serve_pct}%`,  v2:`${m.player2.first_serve_pct}%`},
          {label:'Ace Avg',      v1:m.player1.ace_avg,                v2:m.player2.ace_avg},
          {label:'Surface Pref', v1:m.player1.surface_pref,           v2:m.player2.surface_pref},
        ].map(s=><StatRow key={s.label} {...s} />)}
      </div>
    </div>
  );
}
function StatRow({ label, v1, v2 }) {
  return (
    <div className="db-sr">
      <span className="db-sr__v1">{v1}</span>
      <span className="db-sr__lbl">{label}</span>
      <span className="db-sr__v2">{v2}</span>
    </div>
  );
}

// ─── RANKINGS TAB (with player modal) ─────────────────────────────────────────
function RankingsTab({ showToast }) {
  const [tour,     setTour]    = useState('ATP');
  const [selected, setSelected]= useState(null);
  const [profile,  setProfile] = useState(null);
  const [loading2, setLoading2]= useState(false);
  const { rankings, loading, error } = useRankings(tour);

  async function openPlayer(player) {
    setSelected(player);
    setLoading2(true);
    try {
      const data = await getPlayerProfile(player.id, player.tour ?? tour);
      setProfile(data);
    } catch {
      setProfile(null);
      showToast?.('Could not load player profile', 'error');
    } finally {
      setLoading2(false);
    }
  }

  if (loading) return <LoadingGrid cols={1} rows={10} />;
  if (error)   return <ErrMsg msg={error} />;

  return (
    <div className="tv-fade-up">
      {/* Tour switcher */}
      <div className="db-tour-sw">
        {['ATP','WTA'].map(t => (
          <button key={t} className={`db-tour-btn${tour===t?' db-tour-btn--on':''}`}
            onClick={() => { setTour(t); setSelected(null); setProfile(null); }}>
            {t}
          </button>
        ))}
        <span className="db-tour-hint">Click a player row for full profile</span>
      </div>

      <SecHead label={`${tour} World Rankings — Top 20`} />

      <div className="db-rank-card">
        <div className="db-rank-head">
          {['#','Player','Points','W/L'].map(h=><span key={h} className="db-rank-hcell">{h}</span>)}
        </div>
        {rankings.map((p,i)=>(
          <button key={p.id} className="db-rank-row" onClick={()=>openPlayer(p)} title={`View ${p.name} profile`}>
            <span className="db-rank-pos" data-medal={i<3?i:''}>
              {i===0?'🥇':i===1?'🥈':i===2?'🥉':p.rank}
            </span>
            <div className="db-rank-player">
              <span className="db-rank-flag">{p.flag}</span>
              <div>
                <p className="db-rank-name">{p.name}</p>
                <p className="db-rank-meta">{p.country} · {p.surface_pref}</p>
              </div>
            </div>
            <span className="db-rank-pts">{p.points?.toLocaleString()}</span>
            <span className="db-rank-wl"><span className="db-rank-w">{p.wins}</span><span className="db-rank-l">/{p.losses}</span></span>
          </button>
        ))}
      </div>

      {/* Player Modal */}
      {selected && (
        <PlayerModal
          player={selected}
          profile={loading2 ? null : profile}
          loading={loading2}
          onClose={() => { setSelected(null); setProfile(null); }}
        />
      )}
    </div>
  );
}

function PlayerModal({ player:p, profile, loading, onClose }) {
  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="pm-backdrop" onClick={e => { if (e.target===e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={`${p.name} profile`}>
      <div className="pm-panel">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header__left">
            <div className="pm-avatar">{p.flag}</div>
            <div>
              <h2 className="pm-name">{p.name}</h2>
              <p className="pm-meta">{p.country} · Rank #{p.rank}</p>
            </div>
          </div>
          <button className="pm-close" onClick={onClose} aria-label="Close">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:'center'}}>
            <div className="skeleton" style={{height:120,borderRadius:12,marginBottom:16}}/>
            <div className="skeleton" style={{height:80,borderRadius:12}}/>
          </div>
        ) : profile ? (
          <div className="pm-body">
            {/* Bio */}
            <section className="pm-section">
              <p className="pm-eyebrow">About</p>
              <p className="pm-bio">{profile.bio}</p>
            </section>

            {/* Quick stats grid */}
            <section className="pm-section">
              <p className="pm-eyebrow">Career Stats</p>
              <div className="pm-stats-grid">
                {[
                  {label:'Grand Slams',  val: profile.grand_slams ?? 0,             accent:'var(--lime)'},
                  {label:'Career Wins',  val: profile.career_wins ?? '—',           accent:'var(--green)'},
                  {label:`${profile.tour ?? 'ATP'} Rank`, val: `#${profile.rank}`,  accent:'var(--clay)'},
                  {label:'Height',       val: profile.height ?? '—',                accent:'var(--blue,#60a5fa)'},
                  {label:'Turned Pro',   val: profile.turned_pro ?? '—',            accent:'var(--text-muted)'},
                  {label:'Dominant Hand',val: profile.hand ?? '—',                  accent:'var(--text-muted)'},
                ].map(s=>(
                  <div key={s.label} className="pm-stat">
                    <span className="pm-stat__val" style={{color:s.accent}}>{s.val}</span>
                    <span className="pm-stat__lbl">{s.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Last 5 matches with serve stats */}
            {profile.last5?.length > 0 && (
              <section className="pm-section">
                <p className="pm-eyebrow">Last 5 Matches — Serve Stats</p>
                <div className="pm-table-wrap">
                  <table className="pm-table">
                    <thead>
                      <tr>
                        <th>Result</th>
                        <th>Tournament</th>
                        <th>Opponent</th>
                        <th>Score</th>
                        <th>1st Srv%</th>
                        <th>2nd Srv%</th>
                        <th>Aces</th>
                        <th>DFs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.last5.map((m,i)=>(
                        <tr key={i}>
                          <td><span className={`pm-result pm-result--${m.result==='W'?'w':'l'}`}>{m.result}</span></td>
                          <td>
                            <span className="pm-tourney">{m.tournament}</span>
                            <span className="pm-surface-dot" style={{'--sc':m.surface==='Clay'?'#f97316':m.surface==='Grass'?'#4ade80':'#60a5fa'}} />
                          </td>
                          <td className="pm-opp">vs {m.opponent}</td>
                          <td className="pm-score-cell">{m.score}</td>
                          <td><span className={`pm-serve${m.first_serve>=65?' pm-serve--hi':m.first_serve<=57?' pm-serve--lo':''}`}>{m.first_serve}%</span></td>
                          <td><span className="pm-serve">{m.second_serve ?? '—'}{m.second_serve?'%':''}</span></td>
                          <td className="pm-num">{m.aces}</td>
                          <td className="pm-num pm-num--red">{m.double_faults}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="pm-table-note">🟢 ≥65% · 🔴 ≤57% first serve percentage</p>
              </section>
            )}
          </div>
        ) : (
          <div style={{padding:32,textAlign:'center',color:'var(--text-muted)'}}>Could not load profile data.</div>
        )}
      </div>
    </div>
  );
}

// ─── AI CHAT TAB ──────────────────────────────────────────────────────────────
function AiChatTab({ contextMatch }) {
  const { messages, typing, sendMessage, reset, bottomRef } = useAiChat(contextMatch);
  const [input, setInput] = useState('');

  const SUGG = [
    "Who is favoured to win today?",
    "Compare Djokovic and Alcaraz form",
    "Who leads the WTA rankings?",
    "Explain clay vs hard court play",
  ];

  function submit(e) {
    e?.preventDefault();
    if (!input.trim() || typing) return;
    sendMessage(input);
    setInput('');
  }

  return (
    <div className={`tv-fade-up db-chat-wrap${contextMatch?' db-chat-wrap--ctx':''}`}>
      {/* Chat panel */}
      <div className="db-chat">
        <div className="db-chat__hdr">
          <div className="db-chat__hdr-l">
            <div className="db-chat__av">🤖</div>
            <div><p className="db-chat__title">AI Tennis Analyst</p><p className="db-chat__status"><span className="db-chat__dot"/>Online · ATP & WTA</p></div>
          </div>
          <Btn variant="ghost" size="sm" onClick={reset}>Clear</Btn>
        </div>
        <div className="db-chat__msgs">
          {messages.map((msg,i) => <Bubble key={i} msg={msg} />)}
          {typing && <TypingDots />}
          <div ref={bottomRef} />
        </div>
        {messages.length===1 && (
          <div className="db-chat__sugg">
            {SUGG.map(s=><button key={s} className="db-chat__pill" onClick={()=>sendMessage(s)}>{s}</button>)}
          </div>
        )}
        <form className="db-chat__input-row" onSubmit={submit}>
          <input className="db-chat__input" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about any ATP or WTA match, player, or stat…" />
          <button type="submit" className={`db-chat__send${(!input.trim()||typing)?' db-chat__send--off':''}`} disabled={!input.trim()||typing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>

      {/* Context match sidebar */}
      {contextMatch && (
        <div className="db-chat__ctx">
          <SecHead label="Analysing" />
          <div className="db-panel">
            <p className="db-eyebrow">{contextMatch.tournament} · {contextMatch.round}</p>
            <p style={{fontWeight:700,marginTop:10}}>{contextMatch.player1.name}</p>
            <p style={{color:'var(--text-faint)',fontSize:13,margin:'5px 0'}}>vs</p>
            <p style={{fontWeight:700,marginBottom:14}}>{contextMatch.player2.name}</p>
            <Badge color={contextMatch.surface==='Clay'?'var(--clay)':contextMatch.surface==='Grass'?'var(--green)':'var(--blue,#60a5fa)'}>{contextMatch.surface}</Badge>
          </div>
          <p style={{fontSize:12,color:'var(--text-faint)',marginTop:10,lineHeight:1.6}}>The AI has context about this match. Ask specific questions for tailored analysis.</p>
        </div>
      )}
    </div>
  );
}

function Bubble({ msg }) {
  const ai = msg.role==='assistant';
  return (
    <div className={`db-bub-w${ai?'':' db-bub-w--u'}`}>
      {ai && <div className="db-chat__av db-chat__av--sm">🤖</div>}
      <div className={`db-bub${ai?' db-bub--ai':' db-bub--u'}`}>{msg.content}</div>
    </div>
  );
}
function TypingDots() {
  return (
    <div className="db-bub-w">
      <div className="db-chat__av db-chat__av--sm">🤖</div>
      <div className="db-bub db-bub--ai db-bub--typing"><span/><span/><span/></div>
    </div>
  );
}

// ─── SHARED HELPERS ────────────────────────────────────────────────────────────
function SecHead({ label, accent='var(--lime)', dot }) {
  return (
    <h2 className="db-sh">
      {dot && <span className="live-dot" />}
      <span style={{color:accent}}>{label}</span>
      <span className="db-sh__line" />
    </h2>
  );
}
function LoadingGrid({ cols=2, rows=3 }) {
  return <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:16}}>{Array.from({length:cols*rows}).map((_,i)=><div key={i} className="skeleton" style={{height:180,borderRadius:'var(--radius)'}}/>)}</div>;
}
function ErrMsg({ msg, onRetry }) {
  return (
    <div className="db-err">
      <p className="db-err__msg">⚠ {msg}</p>
      {onRetry && <Btn variant="danger" size="sm" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}
function EmptyState({ icon, title, desc }) {
  return <div className="db-empty"><div className="db-empty__icon">{icon}</div><h3 className="db-empty__title">{title}</h3><p className="db-empty__desc">{desc}</p></div>;
}

// ─── SCOPED CSS ───────────────────────────────────────────────────────────────
const DB_CSS = `
.db-root*,.db-root*::before,.db-root*::after{box-sizing:border-box}
.db-root{min-height:100dvh;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow-x:hidden}
.db-root button{-webkit-tap-highlight-color:transparent;font-family:var(--font-body)}

@keyframes db-slide-in{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
@keyframes db-dots{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}

/* ── Navbar ── */
.db-nav{position:sticky;top:0;z-index:100;height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(14px,3vw,40px);background:rgba(7,11,20,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);gap:12px}
.db-nav__tabs{display:flex;gap:3px;flex:1;justify-content:center}
.db-tab{display:flex;align-items:center;gap:7px;padding:8px 16px;border:none;border-radius:8px;background:transparent;color:var(--text-muted);font-size:14px;font-weight:500;cursor:pointer;transition:var(--t);white-space:nowrap}
.db-tab:hover{background:rgba(255,255,255,.05);color:var(--text)}
.db-tab--on{background:rgba(159,239,102,.12)!important;color:var(--lime)!important;font-weight:600}
.db-nav__right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.db-pill{display:flex;align-items:center;gap:9px;padding:5px 13px 5px 5px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:999px}
.db-pill__av{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#9fef66,#6bc940);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#070B14;flex-shrink:0}
.db-pill__name{font-size:13px;font-weight:500;color:var(--text)}

/* ── Mobile hamburger ── */
.db-ham{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;width:38px;height:38px;border-radius:8px;background:rgba(159,239,102,.08);border:1px solid rgba(159,239,102,.2);cursor:pointer;transition:background .2s}
.db-ham:hover{background:rgba(159,239,102,.14)}
.db-ham__b{display:block;width:17px;height:2px;background:var(--lime);border-radius:2px;transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .25s;transform-origin:center}
.db-ham--open .db-ham__b--t{transform:translateY(7px) rotate(45deg)}
.db-ham--open .db-ham__b--m{opacity:0;transform:scaleX(0)}
.db-ham--open .db-ham__b--b{transform:translateY(-7px) rotate(-45deg)}

/* ── Mobile backdrop + overlay ── */
.db-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .3s}
.db-backdrop--on{opacity:1;pointer-events:all}
.db-overlay{position:fixed;top:0;right:0;bottom:0;z-index:210;width:min(88vw,300px);background:rgba(7,11,20,.97);border-left:1px solid rgba(159,239,102,.12);display:flex;flex-direction:column;padding:0 0 env(safe-area-inset-bottom);transform:translateX(100%);opacity:0;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .3s;pointer-events:none;overflow-y:auto}
.db-overlay--open{transform:translateX(0);opacity:1;pointer-events:all}
.db-overlay__glow{position:absolute;top:-60px;right:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(159,239,102,.07)0%,transparent 65%);pointer-events:none;flex-shrink:0}
.db-overlay__user{display:flex;align-items:center;gap:12px;padding:20px 20px 16px;position:relative}
.db-overlay__av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#9fef66,#6bc940);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#070B14;flex-shrink:0}
.db-overlay__name{font-weight:700;font-size:15px;color:var(--text)}
.db-overlay__email{font-size:11.5px;color:var(--text-faint);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
.db-overlay__hr{height:1px;background:rgba(159,239,102,.08);margin:0 20px}
.db-overlay__nav{display:flex;flex-direction:column;padding:8px 0}
.db-overlay__link{display:flex;align-items:center;gap:12px;padding:13px 20px;border:none;background:transparent;color:var(--text-muted);font-size:14.5px;font-weight:500;cursor:pointer;transition:var(--t);text-align:left;width:100%;opacity:0;animation:none;position:relative}
.db-overlay--open .db-overlay__link{animation:db-slide-in .35s ease both;animation-delay:calc(.04s + var(--i,0) * .06s)}
.db-overlay__link:hover,.db-overlay__link--on{color:var(--lime);background:rgba(159,239,102,.05)}
.db-overlay__icon{font-size:18px;width:24px;text-align:center;flex-shrink:0}
.db-overlay__dot{width:6px;height:6px;border-radius:50%;background:var(--lime);margin-left:auto}
.db-overlay__signout{display:flex;align-items:center;gap:12px;padding:14px 20px;border:none;background:transparent;color:var(--red,#f87171);font-size:14.5px;font-weight:500;cursor:pointer;transition:var(--t);text-align:left;width:100%;margin-top:4px}
.db-overlay__signout:hover{background:rgba(248,113,113,.07)}

/* ── Main ── */
.db-main{flex:1;max-width:1200px;width:100%;margin:0 auto;padding:clamp(20px,3vh,40px) clamp(14px,3vw,40px);padding-bottom:80px}
.db-section{margin-bottom:36px}

/* ── Greeting ── */
.db-greeting{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:clamp(20px,4vh,36px);gap:16px;flex-wrap:wrap}
.db-greeting__h{font-family:var(--font-display);font-weight:700;font-size:clamp(18px,3vw,26px);letter-spacing:-.02em;line-height:1.2}
.db-greeting__name{color:var(--lime)}
.db-greeting__sub{color:var(--text-muted);font-size:13px;margin-top:4px}
.db-greeting__badge{display:flex;align-items:center;gap:7px;padding:8px 16px;background:rgba(159,239,102,.08);border:1px solid rgba(159,239,102,.2);border-radius:999px;font-size:13px;font-weight:600;color:var(--lime);white-space:nowrap}

/* ── Calendar wrap ── */
.db-cal-wrap{margin-bottom:24px}

/* ── Section heading ── */
.db-sh{font-family:var(--font-display);font-weight:700;font-size:clamp(13px,2vw,16px);letter-spacing:-.01em;margin-bottom:14px;display:flex;align-items:center;gap:9px;color:var(--text)}
.db-sh__line{flex:1;height:1px;background:var(--border);display:block}

/* ── Match card ── */
.db-mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(260px,30vw,340px),1fr));gap:16px}
.db-mc{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:var(--t-md);display:flex;flex-direction:column;cursor:default}
.db-mc--hov{border-color:rgba(159,239,102,.28);transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.5),0 0 30px rgba(159,239,102,.06)}
.db-mc__hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:8px}
.db-mc__tourney{font-size:12px;color:var(--text-faint);font-weight:500;margin-bottom:5px}
.db-mc__badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.db-surface{font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--sc) 15%,transparent);color:var(--sc);border:1px solid color-mix(in srgb,var(--sc) 28%,transparent);text-transform:uppercase}
.db-mc__date{font-size:11px;color:var(--text-faint)}
.db-live-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--green);background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);padding:4px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.db-mc__player{display:flex;justify-content:space-between;align-items:center;padding:10px 13px;margin-bottom:7px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:var(--radius-sm)}
.db-mc__pi{display:flex;align-items:center;gap:9px}
.db-mc__flag{font-size:17px}
.db-mc__pname{font-weight:600;font-size:14px}
.db-mc__prank{font-size:11px;color:var(--text-faint);margin-top:1px}
.db-mc__score{font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--lime)}
.db-mc__btn{width:100%;margin-top:14px;padding:10px;border:1px solid rgba(159,239,102,.25);border-radius:var(--radius-sm);background:rgba(159,239,102,.07);color:var(--lime);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:var(--t)}
.db-mc__btn:hover{background:rgba(159,239,102,.14);border-color:rgba(159,239,102,.4)}

/* ── Calendar empty state ── */
.db-empty-cal{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:32px;text-align:center}
.db-empty-cal__icon{font-size:40px;margin-bottom:12px;opacity:.7}
.db-empty-cal__title{font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--text);margin-bottom:8px}
.db-empty-cal__desc{color:var(--text-muted);font-size:14px;max-width:420px;margin:0 auto 20px;line-height:1.7}
.db-suggestions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.db-suggestion{display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:default;transition:border-color .2s}
.db-suggestion:hover{border-color:var(--sa)}
.db-suggestion__surface{font-size:10px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:999px;text-transform:uppercase;white-space:nowrap}
.db-suggestion__name{font-weight:600;font-size:13.5px;color:var(--text)}
.db-suggestion__date{font-size:11.5px;color:var(--text-faint);margin-top:2px}

/* ── Predictions layout ── */
.db-pred-layout{display:grid;grid-template-columns:clamp(220px,30%,340px) 1fr;gap:20px;align-items:start}
.db-picker-list{display:flex;flex-direction:column;gap:7px}
.db-pr{display:flex;flex-direction:column;gap:5px;padding:13px 15px;width:100%;text-align:left;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;transition:var(--t)}
.db-pr:hover{border-color:rgba(159,239,102,.25);background:rgba(255,255,255,.02)}
.db-pr--on{background:rgba(159,239,102,.08)!important;border-color:rgba(159,239,102,.35)!important}
.db-pr__top{display:flex;justify-content:space-between;align-items:center}
.db-pr__t{font-size:11px;color:var(--text-faint)}
.db-pr__live{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--green);font-weight:700}
.db-pr__players{font-size:13.5px;font-weight:600;color:var(--text)}

/* ── Panel / shared card ── */
.db-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.db-panel__hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.db-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-faint)}
.db-panel__title{font-family:var(--font-display);font-size:18px;font-weight:700;margin-top:5px}
.db-panel__sub{font-size:13px;color:var(--text-muted);margin-top:3px}
.db-prob{margin-bottom:16px}
.db-prob:last-child{margin-bottom:0}
.db-prob__p{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.db-prob__nm{font-size:14px;font-weight:600}
.db-prob__row{display:flex;align-items:center;gap:10px}
.db-prob__bar{flex:1;height:10px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden}
.db-prob__fill{height:100%;border-radius:99px;background:var(--fc);box-shadow:0 0 12px color-mix(in srgb,var(--fc) 40%,transparent);transition:width .8s cubic-bezier(.4,0,.2,1)}
.db-prob__pct{font-family:var(--font-mono);font-size:15px;font-weight:700;width:42px;text-align:right;flex-shrink:0}
.db-factor{display:flex;gap:9px;align-items:flex-start;padding:10px 13px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;color:var(--text-muted);margin-bottom:8px}
.db-factor:last-child{margin-bottom:0}
.db-sr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);gap:10px}
.db-sr:last-child{border-bottom:none}
.db-sr__v1{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--lime);text-align:right}
.db-sr__lbl{font-size:11.5px;color:var(--text-faint);text-align:center;white-space:nowrap}
.db-sr__v2{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--clay)}

/* ── Rankings ── */
.db-tour-sw{display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.db-tour-btn{padding:8px 22px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-muted);font-size:14px;font-weight:600;cursor:pointer;transition:var(--t)}
.db-tour-btn:hover{border-color:rgba(159,239,102,.3);color:var(--lime)}
.db-tour-btn--on{background:rgba(159,239,102,.12);border-color:rgba(159,239,102,.35);color:var(--lime)}
.db-tour-hint{font-size:12px;color:var(--text-faint);margin-left:4px}
.db-rank-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.db-rank-head{display:grid;grid-template-columns:52px 1fr 110px 80px;padding:11px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}
.db-rank-hcell{font-size:11px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em}
.db-rank-row{display:grid;grid-template-columns:52px 1fr 110px 80px;padding:13px 20px;align-items:center;border-bottom:1px solid var(--border);transition:var(--t);cursor:pointer;width:100%;background:transparent;text-align:left}
.db-rank-row:last-child{border-bottom:none}
.db-rank-row:hover{background:rgba(159,239,102,.04)}
.db-rank-pos{font-family:var(--font-mono);font-weight:700;font-size:14px;color:var(--text-faint)}
.db-rank-pos[data-medal="0"],.db-rank-pos[data-medal="1"],.db-rank-pos[data-medal="2"]{font-size:18px}
.db-rank-player{display:flex;align-items:center;gap:11px}
.db-rank-flag{font-size:20px}
.db-rank-name{font-weight:600;font-size:14px;color:var(--text)}
.db-rank-meta{font-size:11px;color:var(--text-faint);margin-top:1px}
.db-rank-pts{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--text)}
.db-rank-row:hover .db-rank-pts{color:var(--lime)}
.db-rank-wl{font-size:13px}
.db-rank-w{color:var(--green);font-weight:600}
.db-rank-l{color:var(--text-faint)}

/* ── Player Modal ── */
.pm-backdrop{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:db-fade-in .2s ease}
@keyframes db-fade-in{from{opacity:0}to{opacity:1}}
.pm-panel{background:var(--bg-card);border:1px solid rgba(159,239,102,.18);border-radius:var(--radius-lg,16px);width:100%;max-width:720px;max-height:90vh;overflow-y:auto;animation:pm-pop .28s cubic-bezier(.34,1.56,.64,1)}
@keyframes pm-pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
.pm-header{display:flex;justify-content:space-between;align-items:flex-start;padding:24px 24px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-card);z-index:10}
.pm-header__left{display:flex;align-items:center;gap:14px}
.pm-avatar{font-size:36px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px}
.pm-name{font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text)}
.pm-meta{font-size:13px;color:var(--text-muted);margin-top:3px}
.pm-close{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:var(--t);flex-shrink:0}
.pm-close:hover{background:rgba(248,113,113,.12);border-color:rgba(248,113,113,.3);color:var(--red,#f87171)}
.pm-body{padding:24px;display:flex;flex-direction:column;gap:24px}
.pm-section{display:flex;flex-direction:column;gap:10px}
.pm-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--lime);font-weight:700}
.pm-bio{font-size:14px;color:var(--text-muted);line-height:1.75}
.pm-stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pm-stat{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;text-align:center}
.pm-stat__val{display:block;font-family:var(--font-mono);font-size:18px;font-weight:800;margin-bottom:5px}
.pm-stat__lbl{font-size:11px;color:var(--text-faint)}
.pm-table-wrap{overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border)}
.pm-table{width:100%;border-collapse:collapse;font-size:13px}
.pm-table th{padding:9px 12px;background:rgba(255,255,255,.03);color:var(--text-faint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
.pm-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
.pm-table tr:last-child td{border-bottom:none}
.pm-table tr:hover td{background:rgba(159,239,102,.03)}
.pm-result{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:700}
.pm-result--w{background:rgba(74,222,128,.15);color:var(--green);border:1px solid rgba(74,222,128,.3)}
.pm-result--l{background:rgba(248,113,113,.12);color:var(--red,#f87171);border:1px solid rgba(248,113,113,.25)}
.pm-tourney{font-weight:600;color:var(--text);display:inline-block;margin-right:6px}
.pm-surface-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--sc);vertical-align:middle}
.pm-opp{color:var(--text-muted)}
.pm-score-cell{font-family:var(--font-mono);font-size:12px;color:var(--text-muted);white-space:nowrap}
.pm-serve{font-family:var(--font-mono);font-weight:600;color:var(--text);font-size:13px}
.pm-serve--hi{color:var(--green)}
.pm-serve--lo{color:var(--red,#f87171)}
.pm-num{font-family:var(--font-mono);color:var(--text-muted)}
.pm-num--red{color:var(--red,#f87171)}
.pm-table-note{font-size:11.5px;color:var(--text-faint);margin-top:8px}

/* ── AI Chat ── */
.db-chat-wrap{display:grid;grid-template-columns:1fr;gap:20px;align-items:start}
.db-chat-wrap--ctx{grid-template-columns:1fr clamp(200px,26%,280px)}
.db-chat{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;height:clamp(480px,70vh,720px);overflow:hidden}
.db-chat__hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02);flex-shrink:0}
.db-chat__hdr-l{display:flex;align-items:center;gap:10px}
.db-chat__av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.db-chat__av--sm{width:28px;height:28px;font-size:13px}
.db-chat__title{font-weight:600;font-size:14px}
.db-chat__status{font-size:11px;color:var(--green);display:flex;align-items:center;gap:4px;margin-top:2px}
.db-chat__dot{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block}
.db-chat__msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.db-bub-w{display:flex;gap:8px;align-items:flex-end}
.db-bub-w--u{flex-direction:row-reverse}
.db-bub{max-width:82%;padding:11px 15px;font-size:14px;line-height:1.6}
.db-bub--ai{background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:14px 14px 14px 2px}
.db-bub--u{background:rgba(159,239,102,.1);border:1px solid rgba(159,239,102,.22);border-radius:14px 14px 2px 14px}
.db-bub--typing{display:flex;gap:5px;align-items:center;padding:12px 16px}
.db-bub--typing span{width:7px;height:7px;border-radius:50%;background:var(--text-faint);animation:db-dots 1s ease infinite}
.db-bub--typing span:nth-child(2){animation-delay:.18s}
.db-bub--typing span:nth-child(3){animation-delay:.36s}
.db-chat__sugg{padding:0 14px 10px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}
.db-chat__pill{padding:6px 12px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:999px;color:var(--text-muted);font-size:12px;cursor:pointer;transition:var(--t)}
.db-chat__pill:hover{border-color:rgba(159,239,102,.35);color:var(--lime)}
.db-chat__input-row{padding:11px 14px;border-top:1px solid var(--border);display:flex;gap:9px;flex-shrink:0}
.db-chat__input{flex:1;padding:10px 16px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:999px;color:var(--text);font-size:14px;outline:none;transition:var(--t);font-family:var(--font-body)}
.db-chat__input:focus{border-color:rgba(159,239,102,.4);background:rgba(159,239,102,.03)}
.db-chat__send{width:38px;height:38px;border-radius:50%;background:var(--lime);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#070B14;flex-shrink:0;transition:var(--t)}
.db-chat__send:hover{background:#b5f07a;transform:scale(1.06)}
.db-chat__send--off{background:var(--border)!important;color:var(--text-faint)!important;cursor:not-allowed!important;transform:none!important}
.db-chat__ctx{}

/* ── Error / Empty ── */
.db-err{padding:28px;text-align:center;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.2);border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;gap:12px}
.db-err__msg{color:var(--red,#f87171);font-size:14px}
.db-empty{padding:48px 24px;text-align:center}
.db-empty__icon{font-size:44px;margin-bottom:14px;opacity:.7}
.db-empty__title{font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:8px}
.db-empty__desc{color:var(--text-muted);font-size:14px;max-width:300px;margin:0 auto;line-height:1.7}

/* ── Bottom nav ── */
.db-bottom{position:fixed;bottom:0;left:0;right:0;z-index:100;display:flex;background:rgba(11,17,28,.97);border-top:1px solid var(--border);backdrop-filter:blur(20px);padding-bottom:env(safe-area-inset-bottom)}
.db-bottom__item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;transition:var(--t)}
.db-bottom__item--on{color:var(--lime)}
.db-bottom__icon{font-size:20px;line-height:1}
.db-bottom__lbl{font-size:9px;font-weight:600;letter-spacing:.03em;text-transform:uppercase}

/* ── Responsive ── */
@media(max-width:900px){
  .db-pred-layout{grid-template-columns:1fr}
  .db-chat-wrap--ctx{grid-template-columns:1fr}
  .db-chat__ctx{display:none}
  .db-rank-head,.db-rank-row{grid-template-columns:44px 1fr 90px}
  .db-rank-hcell:last-child,.db-rank-wl{display:none}
  .pm-stats-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:640px){
  .db-mgrid{grid-template-columns:1fr}
  .db-rank-head,.db-rank-row{grid-template-columns:40px 1fr 80px}
  .db-rank-meta{display:none}
  .pm-stats-grid{grid-template-columns:repeat(2,1fr)}
  .db-main{padding-bottom:90px}
}
@media(max-width:640px){.hide-sm{display:none!important}}
@media(min-width:641px){.show-sm{display:none!important}}
`;