// ─────────────────────────────────────────────────────────────────────────────
// ProfilePage.jsx  –  TennisVantage user profile
//
// Features:
//   • Avatar upload with live preview (Supabase Storage)
//   • Edit display name with inline save
//   • Favourite players manager — search + add/remove (up to 10)
//   • Account info section (email, member since)
//   • Fully responsive, matches existing design system exactly
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react';
import { useAuth }     from '../context/AuthContext';
import { useProfile }  from '../hooks/useProfile';
import { Btn, Card, Badge, Spinner } from '../components/ui';
import { MOCK_DATA }   from '../services/tennisApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ALL_PLAYERS = [
  ...( MOCK_DATA.players ?? []),
  ...( MOCK_DATA.atpPlayers ?? []),
  ...( MOCK_DATA.wtaPlayers ?? []),
].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i); // dedupe

function surfaceColor(surface) {
  if (!surface) return 'var(--blue)';
  if (surface === 'Clay')  return 'var(--clay)';
  if (surface === 'Grass') return 'var(--green)';
  return 'var(--blue)';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage({ showToast, onBack }) {
  const { user, profile: authProfile } = useAuth();
  const {
    profile, loading, saving,
    updateName, uploadAvatar, toggleFavourite,
  } = useProfile(user?.id);

  // Merge: live profile data takes precedence over auth context snapshot
  const displayName = profile?.full_name  ?? authProfile?.full_name ?? 'Player';
  const avatarUrl   = profile?.avatar_url ?? authProfile?.avatar_url ?? null;
  const favPlayers  = profile?.favourite_players ?? [];
  const initials    = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (loading) return <ProfileSkeleton onBack={onBack} />;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <nav style={{
        background: 'rgba(7,11,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)',
        height: '62px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'var(--font-body)',
            padding: '6px 10px 6px 4px',
            borderRadius: '8px',
            transition: 'var(--t)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Dashboard
        </button>

        <div style={{ flex: 1 }} />

        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '15px',
          color: 'var(--text)',
        }}>
          My Profile
        </span>
      </nav>

      {/* ── Page body ─────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        maxWidth: '860px',
        width: '100%',
        margin: '0 auto',
        padding: 'clamp(24px,4vh,48px) clamp(16px,4vw,40px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>

        {/* ── Hero card: avatar + name ──────────────────────────────────── */}
        <HeroCard
          avatarUrl={avatarUrl}
          initials={initials}
          displayName={displayName}
          email={user?.email}
          createdAt={user?.created_at}
          saving={saving}
          onAvatarChange={async (file) => {
            const { error } = await uploadAvatar(file);
            if (error) showToast(error, 'error');
            else showToast('Avatar updated!', 'success');
          }}
          onNameSave={async (name) => {
            const { error } = await updateName(name);
            if (error) showToast(error, 'error');
            else showToast('Name updated!', 'success');
          }}
        />

        {/* ── Favourite players ─────────────────────────────────────────── */}
        <FavouritePlayersCard
          favourites={favPlayers}
          saving={saving}
          onToggle={async (playerName) => {
            const { error } = await toggleFavourite(playerName);
            if (error) showToast(error, 'error');
          }}
        />

        {/* ── Account info ──────────────────────────────────────────────── */}
        <AccountInfoCard user={user} />

      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO CARD — avatar + name editor
// ─────────────────────────────────────────────────────────────────────────────
function HeroCard({ avatarUrl, initials, displayName, email, createdAt, saving, onAvatarChange, onNameSave }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState(displayName);
  const [preview,     setPreview]     = useState(null);  // local blob URL
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = useRef(null);

  // Keep nameInput in sync if profile loads after mount
  const prevDisplayName = useRef(displayName);
  if (displayName !== prevDisplayName.current && !editingName) {
    prevDisplayName.current = displayName;
    setNameInput(displayName);
  }

  const handleFileChange = useCallback((file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return; // parent toasts on error
    }
    if (file.size > 3 * 1024 * 1024) {
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onAvatarChange(file);
  }, [onAvatarChange]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }, [handleFileChange]);

  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <Card style={{ overflow: 'hidden' }}>
      {/* Top lime accent bar */}
      <div style={{
        height: '3px',
        background: 'linear-gradient(90deg, #9fef66, #6bc940, transparent)',
        margin: '-22px -22px 24px -22px',
      }} />

      <div style={{
        display: 'flex',
        gap: 'clamp(20px,4vw,40px)',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>

        {/* ── Avatar upload zone ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              position: 'relative',
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              cursor: 'pointer',
              border: `2px dashed ${dragOver ? 'var(--lime)' : 'rgba(255,255,255,0.15)'}`,
              transition: 'var(--t)',
              boxShadow: dragOver ? '0 0 30px rgba(159,239,102,0.2)' : 'none',
            }}
          >
            {/* Avatar image or initials */}
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #9fef66 0%, #6bc940 50%, #f97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {(preview || avatarUrl) ? (
                <img
                  src={preview || avatarUrl}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '36px',
                  color: '#070B14',
                  letterSpacing: '-0.02em',
                }}>
                  {initials}
                </span>
              )}
            </div>

            {/* Hover overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              opacity: dragOver ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = dragOver ? '1' : '0'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 600 }}>Upload</span>
            </div>

            {/* Loading spinner overlay */}
            {saving && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Spinner size={24} />
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => handleFileChange(e.target.files[0])}
          />

          <span style={{ fontSize: '11px', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.4 }}>
            Click or drag to upload<br/>JPG, PNG, WebP · max 3MB
          </span>
        </div>

        {/* ── Name + meta ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          {/* Name editor */}
          {editingName ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                autoFocus
                maxLength={60}
                placeholder="Your full name"
                style={{
                  flex: 1, minWidth: '160px',
                  padding: '10px 14px',
                  background: 'var(--bg-glass)',
                  border: '1px solid rgba(159,239,102,0.4)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '18px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  outline: 'none',
                  letterSpacing: '-0.02em',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onNameSave(nameInput.trim()); setEditingName(false); }
                  if (e.key === 'Escape') { setEditingName(false); setNameInput(displayName); }
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn
                  variant="primary" size="sm"
                  onClick={() => { onNameSave(nameInput.trim()); setEditingName(false); }}
                  disabled={!nameInput.trim() || saving}
                  loading={saving}
                >
                  Save
                </Btn>
                <Btn
                  variant="ghost" size="sm"
                  onClick={() => { setEditingName(false); setNameInput(displayName); }}
                >
                  Cancel
                </Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(20px,3vw,28px)',
                letterSpacing: '-0.025em',
                color: 'var(--text)',
                margin: 0,
              }}>
                {displayName}
              </h1>
              <button
                onClick={() => setEditingName(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'var(--bg-glass-md)',
                  border: '1px solid var(--border-md)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  transition: 'var(--t)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--lime)'; e.currentTarget.style.borderColor = 'rgba(159,239,102,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
            </div>
          )}

          {/* Meta chips */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              borderRadius: '999px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                {email}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              borderRadius: '999px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Member since {memberSince}
              </span>
            </div>

            <Badge color="var(--lime)">
              🎾 Tennis Fan
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAVOURITE PLAYERS CARD
// ─────────────────────────────────────────────────────────────────────────────
function FavouritePlayersCard({ favourites, saving, onToggle }) {
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);

  const results = search.trim().length > 0
    ? ALL_PLAYERS.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        !favourites.includes(p.name)
      ).slice(0, 6)
    : [];

  const favouritePlayerObjects = ALL_PLAYERS.filter(p => favourites.includes(p.name));

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '17px',
            color: 'var(--text)',
            margin: '0 0 4px 0',
          }}>
            ⭐ Favourite Players
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-faint)', margin: 0 }}>
            {favourites.length}/10 players selected
          </p>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-faint)',
            display: 'flex',
            pointerEvents: 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search players…"
            disabled={favourites.length >= 10}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 14px 9px 36px',
              background: focused ? 'rgba(159,239,102,0.04)' : 'var(--bg-glass)',
              border: `1px solid ${focused ? 'rgba(159,239,102,0.4)' : 'var(--border-md)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              outline: 'none',
              transition: 'var(--t)',
              opacity: favourites.length >= 10 ? 0.5 : 1,
            }}
          />

          {/* Dropdown results */}
          {focused && results.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              zIndex: 50,
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}>
              {results.map((player) => (
                <button
                  key={player.id}
                  onClick={() => { onToggle(player.name); setSearch(''); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    textAlign: 'left',
                    transition: 'var(--t)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(159,239,102,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{ fontSize: '18px' }}>{player.flag}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{player.name}</span>
                  <span style={{ fontSize: '11px', color: surfaceColor(player.surface_pref), fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {player.surface_pref}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {focused && search.trim().length > 1 && results.length === 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              zIndex: 50,
              fontSize: '13px',
              color: 'var(--text-faint)',
              textAlign: 'center',
            }}>
              No players found matching "{search}"
            </div>
          )}
        </div>
      </div>

      {/* Favourite player chips */}
      {favouritePlayerObjects.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          border: '1px dashed var(--border-md)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⭐</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            No favourite players yet. Search above to add up to 10.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '10px',
        }}>
          {favouritePlayerObjects.map((player) => (
            <FavPlayerChip
              key={player.id}
              player={player}
              onRemove={() => onToggle(player.name)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function FavPlayerChip({ player, onRemove, saving }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: hov ? 'rgba(159,239,102,0.05)' : 'var(--bg-glass)',
        border: `1px solid ${hov ? 'rgba(159,239,102,0.2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        transition: 'var(--t)',
      }}
    >
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{player.flag}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '13.5px',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {player.name}
        </div>
        <div style={{ fontSize: '11px', color: surfaceColor(player.surface_pref), fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '2px' }}>
          {player.surface_pref} · #{player.rank}
        </div>
      </div>

      <button
        onClick={onRemove}
        disabled={saving}
        style={{
          background: 'none',
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          color: hov ? 'var(--red)' : 'var(--text-faint)',
          display: 'flex',
          alignItems: 'center',
          padding: '4px',
          borderRadius: '4px',
          transition: 'var(--t)',
          flexShrink: 0,
        }}
        title="Remove from favourites"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT INFO CARD
// ─────────────────────────────────────────────────────────────────────────────
function AccountInfoCard({ user }) {
  const rows = [
    {
      label: 'Email address',
      value: user?.email,
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    },
    {
      label: 'Account created',
      value: user?.created_at
        ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      label: 'Login method',
      value: user?.app_metadata?.provider === 'google' ? 'Google OAuth'
           : user?.app_metadata?.provider === 'apple'  ? 'Apple Sign-In'
           : 'Email & Password',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    },
    {
      label: 'User ID',
      value: user?.id ? `${user.id.slice(0, 8)}…` : '—',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      mono: true,
    },
  ];

  return (
    <Card>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '17px',
        color: 'var(--text)',
        margin: '0 0 18px 0',
      }}>
        🔐 Account Info
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 0',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--text-faint)', fontSize: '13px' }}>
              {row.icon}
              {row.label}
            </div>
            <span style={{
              fontSize: '13px',
              fontFamily: row.mono ? 'var(--font-mono)' : 'var(--font-body)',
              color: 'var(--text-muted)',
              wordBreak: 'break-all',
              textAlign: 'right',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
function ProfileSkeleton({ onBack }) {
  const pulse = {
    background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-alt) 50%, var(--bg-card) 75%)',
    backgroundSize: '200% 100%',
    animation: 'tv-shimmer 1.5s infinite',
    borderRadius: '8px',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <nav style={{
        background: 'rgba(7,11,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(16px,4vw,40px)',
        height: '62px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          ← Dashboard
        </button>
      </nav>
      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px clamp(16px,4vw,40px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px' }}>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
            <div style={{ ...pulse, width: '110px', height: '110px', borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
              <div style={{ ...pulse, height: '28px', width: '200px' }} />
              <div style={{ ...pulse, height: '18px', width: '280px' }} />
              <div style={{ ...pulse, height: '18px', width: '160px' }} />
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px' }}>
          <div style={{ ...pulse, height: '20px', width: '160px', marginBottom: '20px' }} />
          <div style={{ ...pulse, height: '100px', width: '100%' }} />
        </div>
      </main>
    </div>
  );
}