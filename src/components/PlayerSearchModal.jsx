// ─────────────────────────────────────────────────────────────────────────────
// PlayerSearchModal.jsx – ⌘K-style player search command palette
// Props: onClose (fn) | allPlayers (array) | onChatAboutPlayer (fn)
// Triggered from Dashboard navbar search button
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import PlayerBioModal from './PlayerBioModal';

const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };

export default function PlayerSearchModal({ onClose, allPlayers = [], onChatAboutPlayer }) {
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(null);
  const inputRef               = useRef(null);

  // Auto-focus input
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape (only when bio is not open)
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !selected) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, selected]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Filter players
  const results = query.trim()
    ? allPlayers
        .filter(p =>
          p.name?.toLowerCase().includes(query.toLowerCase()) ||
          p.country?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : allPlayers.slice(0, 8);

  // Show bio on top if one is selected
  if (selected) {
    return (
      <PlayerBioModal
        player={selected}
        onClose={() => setSelected(null)}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(7,11,20,0.8)',
          backdropFilter: 'blur(8px)',
          animation: 'tv-fade-in 0.15s ease',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed',
        top: '10dvh',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(560px, calc(100vw - 32px))',
        zIndex: 201,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
        animation: 'tv-slide-up 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Search input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search players by name or country…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 15,
              fontFamily: 'var(--font-body)',
            }}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-faint)', cursor: 'pointer',
                fontSize: 20, lineHeight: 1, flexShrink: 0, padding: 0,
              }}
            >
              ×
            </button>
          ) : (
            <kbd style={{
              padding: '3px 8px',
              background: 'var(--bg-glass-md)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11, color: 'var(--text-faint)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}>
              ESC
            </kbd>
          )}
        </div>

        {/* Results list */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{
              padding: '48px 20px', textAlign: 'center',
              color: 'var(--text-faint)', fontSize: 14,
            }}>
              No players found for "{query}"
            </div>
          ) : (
            results.map((p, i) => (
              <PlayerRow
                key={p.id ?? i}
                player={p}
                onSelect={() => setSelected(p)}
                onChat={() => { onChatAboutPlayer?.(p); onClose(); }}
                isLast={i === results.length - 1}
              />
            ))
          )}
        </div>

        {/* Footer hints */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 20, alignItems: 'center',
        }}>
          <Hint icon="↵" label="View profile" />
          <Hint icon="🤖" label="Ask AI about player" />
        </div>
      </div>
    </>
  );
}

// ── Individual player row ─────────────────────────────────────────────────────
function PlayerRow({ player: p, onSelect, onChat, isLast }) {
  const [hov, setHov] = useState(false);
  const surfaceColor  = surfaceColors[p.surface_pref] ?? '#94a3b8';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        background: hov ? 'rgba(159,239,102,0.05)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        transition: 'background 0.15s ease',
        cursor: 'pointer',
      }}
    >
      {/* Rank */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
        color: (p.rank ?? 999) <= 3 ? 'var(--lime)' : 'var(--text-faint)',
        width: 30, textAlign: 'right', flexShrink: 0,
      }}>
        #{p.rank ?? '—'}
      </span>

      {/* Flag */}
      <span style={{ fontSize: 22, flexShrink: 0 }}>{p.flag ?? '🏳️'}</span>

      {/* Name + country */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontWeight: 600, fontSize: 14,
          color: hov ? 'var(--lime)' : 'var(--text)',
          transition: 'color 0.15s',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {p.name}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
          {p.country ?? '—'}
        </p>
      </div>

      {/* Surface badge */}
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 9px',
        borderRadius: 999,
        background: `${surfaceColor}18`,
        color: surfaceColor,
        border: `1px solid ${surfaceColor}30`,
        flexShrink: 0,
      }}>
        {p.surface_pref ?? '—'}
      </span>

      {/* Chat button — only visible on hover */}
      {hov && (
        <button
          onClick={e => { e.stopPropagation(); onChat(); }}
          title="Ask AI about this player"
          style={{
            padding: '5px 10px',
            background: 'rgba(167,139,250,0.12)',
            border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: 8,
            color: '#a78bfa', fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-body)', flexShrink: 0,
            transition: 'var(--t)',
          }}
        >
          🤖 Chat
        </button>
      )}
    </div>
  );
}

function Hint({ icon, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-faint)' }}>
      <kbd style={{
        padding: '2px 6px',
        background: 'var(--bg-glass-md)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        {icon}
      </kbd>
      {label}
    </span>
  );
}