// ─────────────────────────────────────────────────────────────────────────────
// PlayerSearchModal.jsx – ⌘K-style player search command palette
// Props: onClose (fn) | allPlayers (array) | onChatAboutPlayer (fn)
//
// MOBILE FIX: Added className="tv-search-modal" to the dialog div.
// CSS in index.css makes this full-screen on ≤640px phones.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import PlayerBioModal from './PlayerBioModal';
import { useScrollLock } from '../hooks/useScrollLock';

const surfaceColors = { Clay: '#f97316', Hard: '#60a5fa', Grass: '#4ade80' };

export default function PlayerSearchModal({ onClose, allPlayers = [], onChatAboutPlayer }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

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

  // Lock body scroll while modal is open
  useScrollLock();

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
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'tv-fade-in 0.15s ease',
        }}
      />

      {/* Dialog — tv-search-modal class makes this full-screen on mobile */}
      <div
        className="tv-search-modal"
        style={{
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
        }}
      >
        {/* Search input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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
                fontSize: 22, lineHeight: 1, flexShrink: 0, padding: 0,
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
        <div style={{
          maxHeight: '60dvh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',    // ← ADD
          WebkitOverflowScrolling: 'touch', // ← ADD
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                No players found for "{query}"
              </p>
            </div>
          ) : (
            results.map((p, i) => {
              const sc = surfaceColors[p.surface_pref] ?? '#94a3b8';
              return (
                <div
                  key={p.id ?? i}
                  onClick={() => setSelected(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 20px',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Flag */}
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{p.flag ?? '🎾'}</span>

                  {/* Name + country */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontWeight: 600, fontSize: '14px', color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '2px' }}>
                      {p.country}
                      {p.surface_pref && <span style={{ color: sc, marginLeft: '8px' }}>● {p.surface_pref}</span>}
                    </p>
                  </div>

                  {/* Rank badge */}
                  {p.rank && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '13px',
                      fontWeight: 700, color: 'var(--text-faint)',
                      flexShrink: 0,
                    }}>
                      #{p.rank}
                    </span>
                  )}

                  {/* Chat CTA */}
                  {onChatAboutPlayer && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onChatAboutPlayer(p);
                        onClose();
                      }}
                      style={{
                        flexShrink: 0,
                        padding: '5px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--bg-glass-md)',
                        color: 'var(--lime)',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-body)',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        transition: 'var(--t)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--lime)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      Chat ›
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: '16px',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-glass-md)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>↵</kbd>
            {' '}to open bio
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-glass-md)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>esc</kbd>
            {' '}to close
          </span>
        </div>
      </div>
    </>
  );
}