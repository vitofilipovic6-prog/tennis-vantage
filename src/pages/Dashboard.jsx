// src/pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM REDESIGN — built 100% on what the API actually returns.
//
// ✅ REAL API DATA SURFACED:
//   Player  → name · flag · country · rank · points · prev_rank
//   Match   → tournament · round · surface · status · score · match_date (ISO)
//   Derived → tournament tier (from name) · surface theme · rank-change delta
//
// ❌ FAKE DEFAULTS — NEVER SHOWN:
//   wins=0  losses=0  ace_avg=5.5  first_serve_pct=60  recent_form='- - - - -'
//   sync-matches injects these as placeholders. Treating them as real data would
//   show every single player with identical, meaningless stats.
//
// WHAT'S NEW vs previous version:
//   • Segmented pill navbar with live-count badge on Matches tab
//   • User initial avatar pill
//   • MatchCard: 3-px surface colour bar · tier badge · ISO → human time
//   • MatchCard: per-player set scores parsed from "6-4, 3-2" string
//   • RankingsTab: ▲▼ rank-change arrows (prev_rank vs rank)
//   • RankingsTab: proportional points bars · W/L column removed (always 0/0)
//   • RankingsTab: surface pill only when ≠ 'Hard' (Hard is injected default)
//   • PredictionsTab: StatDuel only shows rank · points · flag · surface/form
//     when those values differ from the injected defaults
//   • AI Chat: match context banner · suggestion chips · premium bubbles
//   • Skeleton loaders on every async boundary
//   • Full mobile bottom nav
//   • All existing design tokens used — no new CSS variables introduced
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useRef } from 'react';
import { useAuth }   from '../context/AuthContext';
import { useMatches, useRankings, usePrediction, useAiChat } from '../hooks/hooks';
import { Logo, Card, Badge } from '../components/ui';
import MatchCalendar from '../components/MatchCalendar';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN DATA  (no new CSS vars — all colours inline from existing tokens)
// ─────────────────────────────────────────────────────────────────────────────
const SURFACE = {
  Clay:  { color: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.26)',  glow: 'rgba(249,115,22,0.20)'  },
  Grass: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.26)',  glow: 'rgba(74,222,128,0.20)'  },
  Hard:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.26)',  glow: 'rgba(96,165,250,0.20)'  },
};
const sfn = s => SURFACE[s] ?? SURFACE.Hard;   // surface theme by name

const TIERS = [
  { label: 'Grand Slam',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',
    match: n => ['australian open','roland garros','wimbledon','us open'].some(k => n.includes(k)) },
  { label: 'Masters 1000', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)',
    match: n => ['indian wells','miami','monte-carlo','madrid','rome','canada',
                 'toronto','cincinnati','shanghai','paris','bercy'].some(k => n.includes(k)) },
  { label: 'ATP 500',      color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',
    match: n => ['dubai','rotterdam','acapulco','barcelona','halle',"queen's",
                 'washington','beijing','vienna','basel'].some(k => n.includes(k)) },
  { label: 'WTA 1000',     color: '#f472b6', bg: 'rgba(244,114,182,0.10)',
    match: n => n.startsWith('wta') || n.includes('wta 1000') },
];
const TIER_DEFAULT = { label: 'Tour Event', color: '#64748b', bg: 'rgba(100,116,139,0.08)' };
const getTier = name => TIERS.find(t => t.match(name.toLowerCase())) ?? TIER_DEFAULT;

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return null;
  try {
    const d    = new Date(iso);
    const now  = new Date();
    const diff = Math.floor((d - now) / 86_400_000);
    const hm   = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (diff === 0)  return `Today · ${hm}`;
    if (diff === 1)  return `Tomorrow · ${hm}`;
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 8)
      return `${d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })} · ${hm}`;
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  } catch { return null; }
}

// Parse "6-4, 3-2" → player-indexed set score string
function pScore(scoreStr, idx) {
  if (!scoreStr) return null;
  return scoreStr.split(/[,\s]+/).filter(Boolean)
    .map(s => (s.replace('*','').split('-')[idx] ?? ''))
    .filter(Boolean).join(' ');
}

// Rank movement from prev_rank
function rankDelta(rank, prev) {
  if (!prev || prev === rank) return null;
  return prev > rank ? { dir:'up', n: prev - rank } : { dir:'down', n: rank - prev };
}

// Detect injected placeholder defaults — never render these
const FAKES = { wins:0, losses:0, ace_avg:5.5, first_serve_pct:60 };
const isReal = (field, val) => val != null && val !== FAKES[field] && val !== '- - - - -';

// Shorten to last name only for tight UI elements
const lastName = n => { if (!n) return '?'; const p = n.trim().split(' '); return p[p.length-1]; };

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — DASHBOARD SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ showToast }) {
  const { user, firstName, logout } = useAuth();
  const [tab, setTab]               = useState('matches');
  const [selMatch, setSelMatch]     = useState(null);

  const { live, upcoming, loading: mLoad, error: mErr, refresh } = useMatches();
  const allMatches = useMemo(() => [...live, ...upcoming], [live, upcoming]);

  const TABS = [
    { id:'matches',     label:'Matches',    icon:'🎾' },
    { id:'predictions', label:'Predictions',icon:'🔮' },
    { id:'rankings',    label:'Rankings',   icon:'🏆' },
    { id:'chat',        label:'AI Analyst', icon:'🤖' },
  ];

  async function handleLogout() {
    await logout();
    showToast?.('Signed out', 'info');
  }

  function pickMatch(m) { setSelMatch(m); setTab('predictions'); }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>

      {/* ════════════ NAVBAR ════════════════════════════════════════════ */}
      <nav style={{
        position:'sticky', top:0, zIndex:100,
        height:62, padding:'0 clamp(16px,4vw,48px)',
        background:'rgba(7,11,20,0.95)', backdropFilter:'blur(24px)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
      }}>
        <Logo size="sm" />

        {/* Segmented pill tab-bar — desktop only */}
        <div className="hide-sm" style={{
          display:'flex', gap:2, padding:4,
          background:'rgba(255,255,255,0.035)',
          border:'1px solid var(--border)', borderRadius:12,
        }}>
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                position:'relative',
                display:'flex', alignItems:'center', gap:6,
                padding:'7px 16px', border:'none', borderRadius:9,
                background: on ? 'rgba(159,239,102,0.13)' : 'transparent',
                color:      on ? 'var(--lime)' : 'var(--text-muted)',
                boxShadow:  on ? 'inset 0 0 0 1px rgba(159,239,102,0.30)' : 'none',
                fontFamily:'var(--font-body)', fontSize:13, fontWeight:600,
                cursor:'pointer', transition:'var(--t)',
              }}>
                <span style={{ fontSize:14 }}>{t.icon}</span>
                {t.label}
                {/* Live count badge on Matches tab */}
                {t.id === 'matches' && !mLoad && live.length > 0 && (
                  <span style={{
                    position:'absolute', top:3, right:3,
                    minWidth:16, height:16, borderRadius:99, padding:'0 4px',
                    background:'var(--green)', color:'#070B14',
                    fontSize:9, fontWeight:800, fontFamily:'var(--font-mono)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>{live.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* User pill + sign out */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="hide-sm" style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'5px 12px 5px 5px',
            background:'rgba(255,255,255,0.04)',
            border:'1px solid var(--border)', borderRadius:99,
          }}>
            <div style={{
              width:26, height:26, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,#9fef66,#6bc940)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:800, color:'#070B14',
            }}>
              {(firstName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
            </div>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{firstName}</span>
          </div>
          <GhostBtn onClick={handleLogout}>Sign out</GhostBtn>
        </div>
      </nav>

      {/* ════════════ MAIN CONTENT ══════════════════════════════════════ */}
      <main style={{
        flex:1, maxWidth:1240, width:'100%', margin:'0 auto',
        padding:'clamp(24px,3.5vh,48px) clamp(16px,3vw,48px) 80px',
      }}>

        {/* Greeting + live alert */}
        <div className="tv-fade-up" style={{
          display:'flex', flexWrap:'wrap', alignItems:'flex-end',
          justifyContent:'space-between', rowGap:10,
          marginBottom:'clamp(28px,4vh,44px)',
        }}>
          <div>
            <h1 style={{
              fontFamily:'var(--font-display)', fontWeight:700,
              fontSize:'clamp(20px,2.8vw,28px)', letterSpacing:'-0.025em', marginBottom:4,
            }}>
              Good game, <span style={{ color:'var(--lime)' }}>{firstName}</span> 👋
            </h1>
            <p style={{ fontSize:13, color:'var(--text-faint)' }}>
              {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          {!mLoad && live.length > 0 && (
            <button onClick={() => setTab('matches')} style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'7px 16px', border:'1px solid rgba(74,222,128,0.25)',
              borderRadius:999, background:'rgba(74,222,128,0.07)', cursor:'pointer',
            }}>
              <span className="live-dot" />
              <span style={{ fontSize:13, fontWeight:700, color:'var(--green)', fontFamily:'var(--font-body)' }}>
                {live.length} match{live.length !== 1 ? 'es' : ''} live now
              </span>
            </button>
          )}
        </div>

        {/* Tab content */}
        {tab === 'matches'     && <MatchesTab     live={live} upcoming={upcoming} loading={mLoad} error={mErr} refresh={refresh} onPick={pickMatch} />}
        {tab === 'predictions' && <PredictionsTab allMatches={allMatches} mLoading={mLoad} sel={selMatch} onSel={setSelMatch} />}
        {tab === 'rankings'    && <RankingsTab />}
        {tab === 'chat'        && <AiChatTab contextMatch={selMatch} />}
      </main>

      {/* ════════════ MOBILE BOTTOM NAV ═════════════════════════════════ */}
      <div className="mob-nav" style={{
        display:'none', position:'fixed', bottom:0, left:0, right:0, zIndex:99,
        background:'rgba(7,11,20,0.97)', backdropFilter:'blur(20px)',
        borderTop:'1px solid var(--border)',
        gridTemplateColumns:'repeat(4,1fr)', padding:'6px 0',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            border:'none', background:'transparent', cursor:'pointer', padding:'7px 0',
            color: tab === t.id ? 'var(--lime)' : 'var(--text-faint)',
            fontFamily:'var(--font-body)', fontSize:10, fontWeight:600,
            transition:'var(--t)',
          }}>
            <span style={{ fontSize:19 }}>{t.icon}</span>
            {t.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <style>{`
        @media (max-width:640px){
          .hide-sm{display:none!important;}
          .mob-nav{display:grid!important;}
          main{padding-bottom:76px!important;}
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES TAB
// ─────────────────────────────────────────────────────────────────────────────
function MatchesTab({ live, upcoming, loading, error, refresh, onPick }) {
  const [calDate, setCalDate] = useState(null);

  if (loading) return <SkeletonCards count={6} />;
  if (error)   return <ErrBox msg={error} onRetry={refresh} />;

  const filtered = calDate
    ? upcoming.filter(m => {
        const iso = m.match_date ?? m.date;
        return iso ? new Date(iso).toDateString() === calDate.toDateString() : true;
      })
    : upcoming;

  return (
    <div className="tv-fade-up">
      <MatchCalendar onSelectDate={setCalDate} />

      {live.length > 0 && (
        <section style={{ marginBottom:44 }}>
          <SH label="Live Now" dot />
          <div style={GRID}>{live.map(m => <MatchCard key={m.id} match={m} onPick={onPick} />)}</div>
        </section>
      )}

      <section>
        <SH label={calDate
          ? `Matches · ${calDate.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}`
          : 'Upcoming Matches'}
        />
        {filtered.length === 0
          ? <Empty icon="📅" title="No matches on this day" sub="Try another date or check back soon." />
          : (
            <div style={GRID}>
              {filtered.map((m,i) => (
                <div key={m.id} className={`tv-fade-up d${Math.min(i+1,5)}`}>
                  <MatchCard match={m} onPick={onPick} />
                </div>
              ))}
            </div>
          )
        }
      </section>
    </div>
  );
}

// ── Premium MatchCard ─────────────────────────────────────────────────────────
function MatchCard({ match: m, onPick }) {
  const [hov, setHov] = useState(false);
  const sf   = sfn(m.surface);
  const tier = getTier(m.tournament ?? '');
  const time = fmtTime(m.match_date ?? m.date);
  const live = m.status === 'live';

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', flexDirection:'column',
        background:'var(--bg-card)', borderRadius:'var(--radius)',
        border:`1px solid ${hov ? 'var(--border-md)' : 'var(--border)'}`,
        overflow:'hidden', transition:'var(--t-md)',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov
          ? `0 20px 50px rgba(0,0,0,0.52), 0 0 0 1px ${sf.color}1A`
          : 'var(--shadow-card)',
      }}
    >
      {/* ▌ Surface colour accent bar */}
      <div style={{ height:3, background:`linear-gradient(90deg,${sf.color},${sf.color}44,transparent)` }} />

      <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:12, flex:1 }}>

        {/* Tournament meta row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
          <div style={{ minWidth:0, flex:1 }}>
            {/* Tier + surface pills */}
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:5 }}>
              <Pill color={tier.color} bg={tier.bg}>{tier.label}</Pill>
              <Pill color={sf.color}   bg={sf.bg}>{m.surface}</Pill>
            </div>
            <p style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {m.tournament}
            </p>
            <p style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>
              {m.round}{time ? ` · ${time}` : ''}
            </p>
          </div>
          {live
            ? <LiveBadge />
            : time && (
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-faint)', flexShrink:0, whiteSpace:'nowrap' }}>
                {(()=>{ try{ return new Date(m.match_date??m.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch{return '';} })()}
              </span>
            )
          }
        </div>

        {/* Player rows — both players */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {[m.player1, m.player2].map((p, idx) => !p ? null : (
            <div key={p.id ?? idx} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'9px 11px',
              background:'var(--bg-glass)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-sm)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                <span style={{ fontSize:21, flexShrink:0 }}>{p.flag ?? '🏳️'}</span>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.name}
                  </p>
                  {p.rank && p.rank !== 999 && (
                    <p style={{ fontSize:11, color:'var(--text-faint)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                      #{p.rank}
                    </p>
                  )}
                </div>
              </div>
              {/* Live: set scores per player, parsed from score string */}
              {live && m.score && (
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:14, color:'var(--lime)', flexShrink:0, marginLeft:8 }}>
                  {pScore(m.score, idx)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={() => onPick(m)} style={{
          width:'100%', padding:'9px 0', marginTop:'auto',
          border:`1px solid ${hov ? 'rgba(159,239,102,0.38)' : 'rgba(159,239,102,0.14)'}`,
          borderRadius:'var(--radius-sm)',
          background: hov ? 'rgba(159,239,102,0.07)' : 'transparent',
          color:'var(--lime)', fontFamily:'var(--font-body)',
          fontSize:12, fontWeight:700, letterSpacing:'0.02em',
          cursor:'pointer', transition:'var(--t)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Analyse &amp; Predict
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function PredictionsTab({ allMatches, mLoading, sel, onSel }) {
  const { prediction, loading: pLoad } = usePrediction(sel);

  return (
    <div className="tv-fade-up" style={{ display:'flex', flexWrap:'wrap', gap:24, alignItems:'start' }}>

      {/* Sidebar — picker */}
      <div style={{ flex:'0 0 clamp(240px,28%,320px)', minWidth:240 }}>
        <SH label="Select Match" />
        {mLoading
          ? <SkeletonList count={4} />
          : allMatches.length === 0
            ? <Empty icon="🎾" title="No matches" sub="Check back soon." />
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {allMatches.map(m => (
                  <PickerRow key={m.id} match={m} selected={sel?.id === m.id} onSelect={() => onSel(m)} />
                ))}
              </div>
            )
        }
      </div>

      {/* Main analysis */}
      <div style={{ flex:'1 1 300px', minWidth:280 }}>
        <SH label="Match Analysis" />
        {!sel
          ? <Empty icon="🔮" title="Select a match" sub="Choose any match from the sidebar for full AI prediction breakdown." />
          : pLoad
            ? <SkeletonList count={3} tall />
            : <PredPanel match={sel} pred={prediction} />
        }
      </div>
    </div>
  );
}

function PickerRow({ match: m, selected, onSelect }) {
  const [hov, setHov] = useState(false);
  const sf = sfn(m.surface);
  return (
    <button onClick={onSelect}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width:'100%', textAlign:'left', cursor:'pointer',
        padding:'11px 13px', borderRadius:'var(--radius-sm)',
        border:`1px solid ${selected ? 'rgba(159,239,102,0.38)' : hov ? 'var(--border-md)' : 'var(--border)'}`,
        background: selected ? 'rgba(159,239,102,0.06)' : hov ? 'rgba(255,255,255,0.025)' : 'var(--bg-glass)',
        transition:'var(--t)', display:'flex', flexDirection:'column', gap:4,
      }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:sf.color }}>
          {m.surface}
        </span>
        {m.status === 'live' && <LiveBadge small />}
      </div>
      <p style={{ fontSize:13, fontWeight:600, color: selected ? 'var(--lime)' : 'var(--text)', lineHeight:1.3 }}>
        {m.player1?.flag} {lastName(m.player1?.name)}{' '}
        <span style={{ color:'var(--text-faint)', fontWeight:400 }}>vs</span>{' '}
        {m.player2?.flag} {lastName(m.player2?.name)}
      </p>
      <p style={{ fontSize:11, color:'var(--text-faint)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {m.tournament} · {m.round}
      </p>
    </button>
  );
}

// ── Prediction output panel ───────────────────────────────────────────────────
function PredPanel({ match: m, pred }) {
  if (!pred) return <ErrBox msg="Could not compute prediction" />;
  const { player1_win_pct:p1pct, player2_win_pct:p2pct, confidence, key_factors } = pred;
  const sf   = sfn(m.surface);
  const tier = getTier(m.tournament ?? '');
  const CC   = { High:'var(--green)', Medium:'var(--yellow)', Low:'var(--clay)' };
  const cc   = CC[confidence] ?? 'var(--text-muted)';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* ─── Win probability card ─────────────────────────────────────── */}
      <Card glow>
        {/* Context pills */}
        <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
          <Pill color={tier.color} bg={tier.bg}>{tier.label}</Pill>
          <Pill color={sf.color}   bg={sf.bg}>{m.surface}</Pill>
          <Pill color={cc}         bg={`${cc}14`}>{confidence} confidence</Pill>
        </div>

        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, marginBottom:3 }}>
          {m.player1?.name} <span style={{ color:'var(--text-faint)', fontWeight:400, fontSize:13 }}>vs</span> {m.player2?.name}
        </h2>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:22 }}>
          {m.tournament} · {m.round}
          {(m.match_date ?? m.date) ? ` · ${fmtTime(m.match_date ?? m.date)}` : ''}
        </p>

        {[
          { p:m.player1, pct:p1pct, color:'var(--lime)' },
          { p:m.player2, pct:p2pct, color:'var(--clay)' },
        ].map(row => (
          <div key={row.p?.id} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{row.p?.flag}</span>
                <div>
                  <p style={{ fontWeight:600, fontSize:14 }}>{row.p?.name}</p>
                  {/* Rank + points — both real API fields */}
                  {row.p?.rank && row.p.rank !== 999 && (
                    <p style={{ fontSize:11, color:'var(--text-faint)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                      #{row.p.rank}{row.p.points ? ` · ${row.p.points.toLocaleString()} pts` : ''}
                    </p>
                  )}
                </div>
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:26, color:row.color }}>
                {row.pct}<span style={{ fontSize:14 }}>%</span>
              </span>
            </div>
            {/* Animated win-probability bar */}
            <div style={{ height:8, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
              <div style={{
                height:'100%', width:`${row.pct}%`, borderRadius:99,
                background: row.pct > 55
                  ? `linear-gradient(90deg,${row.color},${row.color}bb)`
                  : `${row.color}70`,
                transition:'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: row.pct > 55 ? `0 0 16px ${row.color}40` : 'none',
              }} />
            </div>
          </div>
        ))}
      </Card>

      {/* ─── Key factors ──────────────────────────────────────────────── */}
      <Card>
        <ML>Key Factors</ML>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {key_factors.map(f => (
            <div key={f} style={{
              display:'flex', gap:10, alignItems:'flex-start',
              padding:'9px 12px', background:'var(--bg-glass)',
              border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5" style={{ flexShrink:0, marginTop:2 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.55 }}>{f}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Real stat comparison ─────────────────────────────────────── */}
      {/* Only fields that the API actually provides are rendered here.    */}
      {/* Fake defaults are filtered out by isReal() so the table is       */}
      {/* never populated with meaningless placeholder numbers.            */}
      <Card>
        <ML>Head to Head</ML>

        {/* Rank — always real from rankings sync */}
        <Duel
          label="World Rank"
          v1={m.player1?.rank && m.player1.rank !== 999 ? `#${m.player1.rank}` : '—'}
          v2={m.player2?.rank && m.player2.rank !== 999 ? `#${m.player2.rank}` : '—'}
        />

        {/* Points — real from rankings sync */}
        {m.player1?.points && m.player2?.points && (
          <Duel
            label="Ranking Pts"
            v1={m.player1.points.toLocaleString()}
            v2={m.player2.points.toLocaleString()}
          />
        )}

        {/* Flag emoji — always real */}
        <Duel label="Country" v1={m.player1?.flag ?? '—'} v2={m.player2?.flag ?? '—'} big />

        {/* Surface pref — only when not both 'Hard' (Hard is the injected default) */}
        {(m.player1?.surface_pref || m.player2?.surface_pref) &&
         !(m.player1?.surface_pref === 'Hard' && m.player2?.surface_pref === 'Hard') && (
          <Duel label="Fav. Surface" v1={m.player1?.surface_pref ?? '—'} v2={m.player2?.surface_pref ?? '—'} />
        )}

        {/* Recent form — only when not the injected placeholder '- - - - -' */}
        {isReal('recent_form', m.player1?.recent_form) && isReal('recent_form', m.player2?.recent_form) && (
          <Duel label="Recent Form" v1={m.player1.recent_form} v2={m.player2.recent_form} />
        )}

        {/* 1st serve % — only when different from injected default 60 */}
        {isReal('first_serve_pct', m.player1?.first_serve_pct) && isReal('first_serve_pct', m.player2?.first_serve_pct) && (
          <Duel label="1st Serve %" v1={`${m.player1.first_serve_pct}%`} v2={`${m.player2.first_serve_pct}%`} />
        )}
      </Card>
    </div>
  );
}

function Duel({ label, v1, v2, big }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:10, marginBottom:10 }}>
      <span style={{
        textAlign:'right', fontWeight:700,
        fontFamily: big ? undefined : 'var(--font-mono)',
        fontSize: big ? 22 : 14, color:'var(--lime)',
      }}>{v1}</span>
      <span style={{ fontSize:11, color:'var(--text-faint)', textAlign:'center', whiteSpace:'nowrap' }}>{label}</span>
      <span style={{
        textAlign:'left', fontWeight:700,
        fontFamily: big ? undefined : 'var(--font-mono)',
        fontSize: big ? 22 : 14, color:'var(--clay)',
      }}>{v2}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKINGS TAB
// ─────────────────────────────────────────────────────────────────────────────
function RankingsTab() {
  const [tour, setTour]   = useState('ATP');
  const [hovR, setHovR]   = useState(null);
  const { rankings, loading, error } = useRankings(tour);

  // Points bar widths, normalised against rank #1
  const maxPts = useMemo(() => Math.max(...rankings.map(r => r.points ?? 0), 1), [rankings]);

  return (
    <div className="tv-fade-up">
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        flexWrap:'wrap', gap:12, marginBottom:24,
      }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'clamp(15px,2.2vw,20px)', letterSpacing:'-0.02em' }}>
            {tour} World Rankings
          </h2>
          <p style={{ fontSize:12, color:'var(--text-faint)', marginTop:3 }}>
            Live data via RapidAPI · Top 10
          </p>
        </div>
        {/* ATP / WTA toggle */}
        <div style={{
          display:'flex', gap:3, padding:4,
          background:'rgba(255,255,255,0.04)',
          border:'1px solid var(--border)', borderRadius:10,
        }}>
          {['ATP','WTA'].map(t => (
            <button key={t} onClick={() => setTour(t)} style={{
              padding:'7px 24px', border:'none', borderRadius:7,
              background: tour === t ? 'var(--lime)' : 'transparent',
              color:      tour === t ? '#070B14' : 'var(--text-muted)',
              fontFamily:'var(--font-body)', fontWeight:700, fontSize:13,
              cursor:'pointer', transition:'var(--t)',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {loading
        ? <SkeletonList count={10} />
        : error
          ? <ErrBox msg={error} />
          : (
            <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'hidden' }}>

              {/* Column headers — no W/L (wins/losses are always 0 from API) */}
              <div style={{
                display:'grid', gridTemplateColumns:'68px 1fr 130px 120px',
                padding:'11px 20px',
                background:'rgba(255,255,255,0.02)', borderBottom:'1px solid var(--border)',
              }}>
                {['Rank','Player','Points','Form'].map(h => (
                  <span key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</span>
                ))}
              </div>

              {rankings.map((p, i) => {
                const delta  = rankDelta(p.rank, p.prev_rank);
                const barPct = Math.round((p.points / maxPts) * 100);
                const form   = isReal('recent_form', p.recent_form);
                const isHov  = hovR === (p.id ?? i);
                const medal  = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : null;

                return (
                  <div
                    key={p.id ?? i}
                    onMouseEnter={() => setHovR(p.id ?? i)}
                    onMouseLeave={() => setHovR(null)}
                    style={{
                      display:'grid', gridTemplateColumns:'68px 1fr 130px 120px',
                      padding:'15px 20px', alignItems:'center',
                      borderBottom: i < rankings.length-1 ? '1px solid var(--border)' : 'none',
                      background: isHov ? 'rgba(159,239,102,0.028)' : 'transparent',
                      transition:'var(--t)',
                    }}
                  >
                    {/* Rank cell + optional rank-change arrow */}
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      {medal
                        ? <span style={{ fontSize:17 }}>{medal}</span>
                        : <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:14, color:'var(--text-faint)' }}>#{p.rank}</span>
                      }
                      {delta && (
                        <span style={{
                          fontSize:9, fontWeight:800, lineHeight:1,
                          color: delta.dir === 'up' ? 'var(--green)' : 'var(--red)',
                        }}>
                          {delta.dir === 'up' ? '▲' : '▼'}{delta.n}
                        </span>
                      )}
                    </div>

                    {/* Player identity */}
                    <div style={{ display:'flex', alignItems:'center', gap:11, minWidth:0 }}>
                      <span style={{ fontSize:22, flexShrink:0 }}>{p.flag ?? '🏳️'}</span>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.name}
                        </p>
                        <p style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>
                          {p.country ?? ''}
                          {/* Surface pref shown only if ≠ 'Hard' — Hard is the default injected by sync-matches */}
                          {p.surface_pref && p.surface_pref !== 'Hard' && (
                            <span style={{ marginLeft:6, color: sfn(p.surface_pref).color }}>
                              · {p.surface_pref}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Points + proportional bar */}
                    <div>
                      <p style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, marginBottom:5 }}>
                        {p.points ? p.points.toLocaleString() : '—'}
                      </p>
                      <div style={{ height:3, width:'82%', background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{
                          height:'100%', width:`${barPct}%`, borderRadius:99,
                          background: i===0 ? '#fbbf24' : i < 3 ? 'var(--lime)' : 'var(--lime-dark)',
                          transition:'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </div>
                    </div>

                    {/* Recent form — only when real (not '- - - - -') */}
                    <div>
                      {form ? (
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          {p.recent_form.trim().split(/\s+/).map((r,j) => {
                            const w = r==='W', l = r==='L';
                            return (
                              <span key={j} style={{
                                fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700,
                                padding:'2px 5px', borderRadius:4,
                                background: w ? 'rgba(74,222,128,0.14)' : l ? 'rgba(248,113,113,0.14)' : 'var(--bg-glass)',
                                color: w ? 'var(--green)' : l ? 'var(--red)' : 'var(--text-faint)',
                                border: `1px solid ${w ? 'rgba(74,222,128,0.22)' : l ? 'rgba(248,113,113,0.22)' : 'var(--border)'}`,
                              }}>{r}</span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--text-faint)' }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT TAB
// ─────────────────────────────────────────────────────────────────────────────
function AiChatTab({ contextMatch }) {
  const { messages, typing, sendMessage, reset, bottomRef } = useAiChat(contextMatch);
  const [input, setInput] = useState('');

  const CHIPS = [
    'Who will win the next Grand Slam?',
    'Compare Sinner vs Alcaraz on clay',
    'Best servers in the ATP top 10?',
    'How does surface type affect match outcomes?',
  ];

  function doSend() {
    const t = input.trim();
    if (!t || typing) return;
    sendMessage(t); setInput('');
  }

  return (
    <div className="tv-fade-up" style={{ display:'flex', flexDirection:'column', height:'clamp(500px,70vh,760px)' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:38, height:38, borderRadius:11, flexShrink:0,
            background:'linear-gradient(135deg,#a78bfa,#7c3aed)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
          }}>🤖</div>
          <div>
            <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15 }}>AI Tennis Analyst</p>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />
              <span style={{ fontSize:11, color:'var(--green)', fontWeight:500 }}>Powered by Gemini</span>
            </div>
          </div>
        </div>
        <GhostBtn onClick={reset}>New chat</GhostBtn>
      </div>

      {/* Match context banner — when user clicked "Analyse" on a match card */}
      {contextMatch && (
        <div style={{
          display:'flex', alignItems:'center', gap:9, padding:'9px 14px', marginBottom:12,
          background:'rgba(159,239,102,0.06)', border:'1px solid rgba(159,239,102,0.2)',
          borderRadius:'var(--radius-sm)', fontSize:12, color:'var(--lime)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          Context: <strong style={{ marginLeft:4 }}>{contextMatch.player1?.name} vs {contextMatch.player2?.name}</strong>
          <span style={{ color:'var(--text-faint)', marginLeft:6 }}>· {contextMatch.surface} · {contextMatch.tournament}</span>
        </div>
      )}

      {/* Message thread */}
      <div style={{
        flex:1, overflowY:'auto', padding:16,
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'var(--radius)', marginBottom:10,
        display:'flex', flexDirection:'column', gap:12,
        scrollbarWidth:'thin', scrollbarColor:'var(--text-faint) transparent',
      }}>
        {/* Suggestion chips — only when conversation is fresh (1 greeting msg) */}
        {messages.length === 1 && (
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:11, color:'var(--text-faint)', marginBottom:10 }}>Try asking</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
              {CHIPS.map(c => (
                <button key={c} onClick={() => sendMessage(c)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(159,239,102,0.35)'; e.currentTarget.style.color='var(--lime)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)';              e.currentTarget.style.color='var(--text-muted)'; }}
                  style={{
                    padding:'5px 13px', background:'var(--bg-glass)',
                    border:'1px solid var(--border)', borderRadius:999,
                    fontSize:12, color:'var(--text-muted)', cursor:'pointer',
                    fontFamily:'var(--font-body)', transition:'var(--t)',
                  }}>{c}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

        {/* Typing indicator — 3 pulsing dots */}
        {typing && (
          <div style={{ display:'flex', gap:9, alignItems:'flex-end' }}>
            <BotIcon />
            <div style={{
              padding:'11px 15px', background:'var(--bg-card-alt)',
              border:'1px solid var(--border)', borderRadius:'14px 14px 14px 2px',
              display:'flex', gap:4, alignItems:'center',
            }}>
              {[0, 0.18, 0.36].map(d => (
                <div key={d} style={{
                  width:7, height:7, borderRadius:'50%',
                  background:'var(--lime)', opacity:0.6,
                  animation:'tv-live-dot 1.1s ease infinite', animationDelay:`${d}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display:'flex', gap:8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && doSend()}
          placeholder="Ask about players, tactics, predictions…"
          style={{
            flex:1, padding:'12px 16px',
            background:'var(--bg-glass)', border:'1px solid var(--border-md)',
            borderRadius:'var(--radius-sm)', color:'var(--text)',
            fontFamily:'var(--font-body)', fontSize:14, outline:'none', transition:'var(--t)',
          }}
          onFocus={e => { e.target.style.borderColor='rgba(159,239,102,0.42)'; e.target.style.background='rgba(159,239,102,0.03)'; }}
          onBlur={e  => { e.target.style.borderColor='var(--border-md)';       e.target.style.background='var(--bg-glass)'; }}
        />
        <button onClick={doSend} disabled={!input.trim() || typing} style={{
          padding:'12px 22px', border:'none', borderRadius:'var(--radius-sm)',
          background: !input.trim() || typing
            ? 'rgba(255,255,255,0.04)'
            : 'linear-gradient(135deg,#9fef66,#6bc940)',
          color: !input.trim() || typing ? 'var(--text-faint)' : '#070B14',
          fontFamily:'var(--font-body)', fontSize:13, fontWeight:700,
          cursor: !input.trim() || typing ? 'not-allowed' : 'pointer',
          transition:'var(--t)', flexShrink:0,
        }}>Send</button>
      </div>
    </div>
  );
}

function Bubble({ msg }) {
  const ai = msg.role === 'assistant';
  return (
    <div style={{ display:'flex', gap:9, flexDirection: ai ? 'row' : 'row-reverse' }}>
      {ai && <BotIcon />}
      <div style={{
        maxWidth:'82%', padding:'10px 14px', whiteSpace:'pre-wrap',
        background: ai ? 'var(--bg-card-alt)' : 'rgba(159,239,102,0.08)',
        border: `1px solid ${ai ? 'var(--border)' : 'rgba(159,239,102,0.22)'}`,
        borderRadius: ai ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
        fontSize:14, lineHeight:1.65, color:'var(--text)',
      }}>{msg.content}</div>
    </div>
  );
}

function BotIcon() {
  return (
    <div style={{
      width:28, height:28, borderRadius:'50%', flexShrink:0, alignSelf:'flex-end',
      background:'linear-gradient(135deg,#a78bfa,#7c3aed)',
      display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
    }}>🤖</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES  (all inline styles — no new CSS classes)
// ─────────────────────────────────────────────────────────────────────────────
function GhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding:'6px 14px', borderRadius:8, cursor:'pointer',
        background:'rgba(255,255,255,0.03)',
        border:`1px solid ${hov ? 'var(--border-md)' : 'var(--border)'}`,
        color: hov ? 'var(--text)' : 'var(--text-muted)',
        fontFamily:'var(--font-body)', fontSize:12, fontWeight:600,
        transition:'var(--t)',
      }}>{children}</button>
  );
}

// Pill badge — used for tier + surface labels
function Pill({ color, bg, children }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', flexShrink:0,
      fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
      padding:'2px 8px', borderRadius:999,
      color, background:bg, border:`1px solid ${color}2A`,
    }}>{children}</span>
  );
}

// Animated LIVE badge
function LiveBadge({ small }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: small ? 4 : 5,
      fontSize: small ? 9 : 10, fontWeight:700, color:'#4ade80', flexShrink:0,
      background:'rgba(74,222,128,0.10)', border:'1px solid rgba(74,222,128,0.24)',
      padding: small ? '2px 7px' : '4px 9px', borderRadius:999,
    }}>
      <span className="live-dot" style={{ width: small?5:6, height: small?5:6 }} />
      LIVE
    </span>
  );
}

// Section heading with optional live dot + horizontal rule
function SH({ label, dot }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
      {dot && <span className="live-dot" style={{ flexShrink:0 }} />}
      <h2 style={{
        fontFamily:'var(--font-display)', fontWeight:700,
        fontSize:'clamp(13px,1.6vw,15px)', letterSpacing:'-0.01em', whiteSpace:'nowrap',
      }}>{label}</h2>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  );
}

// Mini uppercase label above card sections
function ML({ children }) {
  return (
    <p style={{
      fontSize:10, fontWeight:700, textTransform:'uppercase',
      letterSpacing:'0.09em', color:'var(--text-faint)', marginBottom:13,
    }}>{children}</p>
  );
}

// Skeleton shimmer cards grid
function SkeletonCards({ count = 6 }) {
  return (
    <div style={GRID}>
      {Array.from({ length:count }).map((_,i) => (
        <div key={i} className="skeleton" style={{ height:196, borderRadius:'var(--radius)' }} />
      ))}
    </div>
  );
}

// Skeleton list rows
function SkeletonList({ count = 4, tall }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {Array.from({ length:count }).map((_,i) => (
        <div key={i} className="skeleton" style={{ height: tall ? 120 : 64, borderRadius:'var(--radius-sm)' }} />
      ))}
    </div>
  );
}

// Error box with optional retry
function ErrBox({ msg, onRetry }) {
  return (
    <div style={{
      padding:32, textAlign:'center',
      background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.15)',
      borderRadius:'var(--radius)',
    }}>
      <p style={{ color:'var(--red)', fontSize:14, marginBottom: onRetry ? 12 : 0 }}>⚠ {msg}</p>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding:'7px 18px', background:'rgba(248,113,113,0.1)',
          border:'1px solid rgba(248,113,113,0.25)', borderRadius:8,
          color:'var(--red)', fontSize:12, fontWeight:600,
          cursor:'pointer', fontFamily:'var(--font-body)',
        }}>Retry</button>
      )}
    </div>
  );
}

// Generic empty state
function Empty({ icon, title, sub }) {
  return (
    <div style={{ padding:'52px 20px', textAlign:'center' }}>
      <div style={{ fontSize:46, marginBottom:14, opacity:0.6 }}>{icon}</div>
      <h3 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17, marginBottom:8 }}>{title}</h3>
      <p style={{ color:'var(--text-muted)', fontSize:13, maxWidth:280, margin:'0 auto', lineHeight:1.72 }}>{sub}</p>
    </div>
  );
}

// Responsive auto-fill card grid
const GRID = {
  display:'grid',
  gridTemplateColumns:'repeat(auto-fill,minmax(clamp(280px,30vw,360px),1fr))',
  gap:14,
};