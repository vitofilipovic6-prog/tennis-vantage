// ─────────────────────────────────────────────────────────────────────────────
// ProfilePage.jsx  –  TennisVantage user profile
// Sections: Hero (avatar + name) · Favourite Players · Account Info
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { MOCK_DATA } from '../services/tennisApi';
import { supabase } from '../services/supabase';
import { resolveFlag } from '../services/tennisApi';

const SURFACE_COLOR = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };

const ALL_PLAYERS = [
  ...(MOCK_DATA.players ?? []),
  ...(MOCK_DATA.wtaPlayers ?? []),
].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

export default function ProfilePage({ onBack, showToast }) {
  const { user } = useAuth();
  const { profile, loading, saving, updateName, uploadAvatar, toggleFavourite } = useProfile();

  if (loading) return <ProfileSkeleton />;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Sticky back bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,11,20,0.92)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)', height: 62,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          padding: '6px 10px 6px 2px', borderRadius: 8, transition: 'var(--t)',
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </button>
        <span style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, margin: 0 }}>
          My Profile
        </h1>
        {saving && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--lime)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid transparent', borderTop: '2px solid var(--lime)', animation: 'tv-spin 0.7s linear infinite' }} />
            Saving…
          </span>
        )}
      </div>

      <div style={{
        maxWidth: 720, margin: '0 auto',
        padding: 'clamp(24px,4vh,40px) clamp(16px,4vw,40px)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <HeroCard
          profile={profile} user={user} saving={saving}
          onUpdateName={async name => {
            const { error } = await updateName(name);
            error ? showToast(error, 'error') : showToast('Name updated!', 'success');
          }}
          onUploadAvatar={async file => {
            const { error } = await uploadAvatar(file);
            error ? showToast(error, 'error') : showToast('Avatar updated!', 'success');
          }}
        />
        <FavouritePlayersCard
          profile={profile} saving={saving}
          onToggle={async name => {
            const { error } = await toggleFavourite(name);
            if (error) showToast(error, 'error');
          }}
        />
        <AccountInfoCard user={user} />
      </div>
    </div>
  );
}

function HeroCard({ profile, user, saving, onUpdateName, onUploadAvatar }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(profile?.full_name ?? '');
  const [preview, setPreview] = useState(null);
  const [hovAv, setHovAv] = useState(false);
  const fileRef = useRef();

  const handleFile = useCallback(async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    await onUploadAvatar(file);
  }, [onUploadAvatar]);

  const saveName = useCallback(async () => {
    if (!nameVal.trim()) return;
    await onUpdateName(nameVal.trim());
    setEditing(false);
  }, [nameVal, onUpdateName]);

  const avatarUrl = preview ?? profile?.avatar_url;
  const initial = (profile?.full_name?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'clamp(20px,4vw,32px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => fileRef.current?.click()}
            onMouseEnter={() => setHovAv(true)}
            onMouseLeave={() => setHovAv(false)}
            style={{
              width: 96, height: 96, borderRadius: '50%', padding: 0,
              background: avatarUrl ? 'transparent' : 'linear-gradient(135deg,#9fef66,#6bc940)',
              border: `3px solid ${hovAv ? 'var(--lime)' : 'var(--border-md)'}`,
              cursor: 'pointer', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'var(--t)', position: 'relative',
              boxShadow: hovAv ? '0 0 0 4px rgba(159,239,102,0.15)' : 'none',
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 36, fontWeight: 700, color: '#070B14' }}>{initial}</span>
            }
            {hovAv && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
          <span onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--lime)', color: '#070B14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '2px solid var(--bg-card)' }}>+</span>
        </div>

        {/* Name + chips */}
        <div style={{ flex: 1, minWidth: 180 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                autoFocus value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
                style={{ flex: 1, minWidth: 140, padding: '8px 12px', background: 'var(--bg-glass)', border: '1px solid rgba(159,239,102,0.4)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, outline: 'none' }}
              />
              <button onClick={saveName} style={{ padding: '8px 14px', background: 'var(--lime)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, color: '#070B14', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ padding: '8px 10px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(18px,3vw,24px)', letterSpacing: '-0.02em', margin: 0 }}>
                {profile?.full_name ?? 'Player'}
              </h2>
              <button onClick={() => { setNameVal(profile?.full_name ?? ''); setEditing(true); }} title="Edit name" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'var(--t)', display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--lime)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <InfoChip icon="✉" label={user?.email ?? '—'} />
            <InfoChip icon="📅" label={`Joined ${joined}`} />
            <InfoChip icon="🎾" label="Tennis Fan" accent />
          </div>
        </div>
      </div>
    </div>
  );
}

function FavouritePlayersCard({ profile, saving, onToggle }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);

  const favs = profile?.favourite_players ?? [];

  // Debounced live search against the players table
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }

    setSearching(true);
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, name, country, flag, rank, surface_pref')
          .ilike('name', `%${q}%`)
          .not('name', 'is', null)
          .order('rank', { ascending: true, nullsLast: true })
          .limit(8);

        if (error) throw error;

        const filtered = (data ?? [])
          .filter(p => p.name && !p.name.includes('/') && !favs.includes(p.name))
          .map(p => ({
            ...p,
            flag: p.flag && p.flag !== '🏳️' ? p.flag : resolveFlag(p.country ?? ''),
          }));

        setResults(filtered);
      } catch (e) {
        console.error('[FavouritePlayersCard search]', e.message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280); // 280ms debounce — fast but avoids hammering Supabase on every keystroke

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, favs.length]); // re-run when favs change so just-added players disappear from results

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 'clamp(20px,4vw,28px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, margin: 0 }}>
          Favourite Players
        </h3>
        <span style={{
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: favs.length >= 10 ? 'var(--clay)' : 'var(--text-faint)',
        }}>
          {favs.length} / 10
        </span>
      </div>

      {/* Search input — hidden once 10 favs reached */}
      {favs.length < 10 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          {/* Search icon OR spinner */}
          <div style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', display: 'flex', alignItems: 'center',
          }}>
            {searching ? (
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid var(--border-md)',
                borderTop: '2px solid var(--lime)',
                animation: 'tv-spin 0.7s linear infinite',
              }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </div>

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="Search for a player to add…"
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              background: 'var(--bg-glass)',
              border: `1px solid ${focused ? 'rgba(159,239,102,0.4)' : 'var(--border-md)'}`,
              borderRadius: 8, color: 'var(--text)', fontSize: 14,
              outline: 'none', fontFamily: 'var(--font-body)', transition: 'var(--t)',
              boxSizing: 'border-box',
            }}
          />

          {/* Dropdown results */}
          {focused && query.trim() && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--bg-card-alt)', border: '1px solid var(--border-md)',
              borderRadius: 10, marginTop: 4, overflow: 'hidden',
              zIndex: 20, boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}>
              {results.length === 0 && !searching ? (
                <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-faint)', textAlign: 'center' }}>
                  No players found for "{query}"
                </div>
              ) : (
                results.map(p => {
                  const sc = SURFACE_COLOR[p.surface_pref] ?? '#60a5fa';
                  return (
                    <button
                      key={p.id}
                      onMouseDown={() => { onToggle(p.name); setQuery(''); setResults([]); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px',
                        border: 'none', background: 'transparent',
                        cursor: 'pointer', transition: 'var(--t)',
                        fontFamily: 'var(--font-body)', textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-md)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{p.flag || '🏳️'}</span>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                        {p.name}
                      </span>
                      {p.rank && (
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                          #{p.rank}
                        </span>
                      )}
                      {p.surface_pref && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 99, textTransform: 'uppercase',
                          background: `${sc}18`, color: sc, flexShrink: 0,
                        }}>
                          {p.surface_pref}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Favourites list */}
      {favs.length === 0 ? (
        <div style={{
          padding: '28px 20px', textAlign: 'center',
          border: '2px dashed var(--border)', borderRadius: 10,
        }}>
          <p style={{ fontSize: 30, marginBottom: 10 }}>⭐</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Search above to add your favourite players
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {favs.map(name => (
            <FavChip key={name} name={name} onRemove={() => onToggle(name)} saving={saving} />
          ))}
        </div>
      )}
    </div>
  );
}

// Separate chip component — avoids re-fetching player data for each chip
function FavChip({ name, onRemove, saving }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '7px 12px', background: 'var(--bg-glass)',
      border: '1px solid var(--border)', borderRadius: 999,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
      <button
        onClick={onRemove}
        disabled={saving}
        title={`Remove ${name}`}
        style={{
          background: 'none', border: 'none', padding: '1px 0 1px 3px',
          color: 'var(--text-faint)', cursor: saving ? 'not-allowed' : 'pointer',
          lineHeight: 1, transition: 'var(--t)', fontSize: 13,
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
      >✕</button>
    </div>
  );
}

function AccountInfoCard({ user }) {
  const provider = user?.app_metadata?.provider ?? 'email';
  const providerLabel = { google: 'Google OAuth', apple: 'Apple Sign-In', email: 'Email & Password' }[provider] ?? provider;
  const rows = [
    { label: 'Email address', value: user?.email ?? '—' },
    { label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
    { label: 'Sign-in method', value: providerLabel },
    { label: 'User ID', value: (user?.id ?? '—').slice(0, 18) + '…', mono: true },
  ];

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'clamp(20px,4vw,28px)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 16, margin: '0 0 16px' }}>Account Information</h3>
      {rows.map((row, i) => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 500 }}>{row.label}</span>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, fontFamily: row.mono ? 'var(--font-mono)' : 'var(--font-body)' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function InfoChip({ icon, label, accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: accent ? 'rgba(159,239,102,0.1)' : 'var(--bg-glass-md)',
      border: `1px solid ${accent ? 'rgba(159,239,102,0.25)' : 'var(--border)'}`,
      fontSize: 12, color: accent ? 'var(--lime)' : 'var(--text-muted)', fontWeight: 500,
    }}>
      {icon} {label}
    </span>
  );
}

function ProfileSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: 'clamp(24px,4vh,40px) clamp(16px,4vw,40px)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[200, 280, 160].map((h, i) => (
          <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}