// ─────────────────────────────────────────────────────────────────────────────
// ToastContainer.jsx  –  TennisVantage notification system
//
// Improvements vs original:
//   • Toasts slide up from bottom with spring animation
//   • Each toast has a thin progress bar that drains over its lifetime
//   • Dismissing adds a slide-out animation before removing from DOM
//   • Stacks cleanly upward — newest at top
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';

const PALETTES = {
  success: { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  text: '#4ade80', bar: '#4ade80' },
  error:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', text: '#f87171', bar: '#f87171' },
  info:    { bg: 'rgba(159,239,102,0.10)', border: 'rgba(159,239,102,0.28)',text: '#9fef66', bar: '#9fef66' },
  warning: { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24', bar: '#fbbf24' },
};

const ICONS = { success: '✓', error: '✕', info: '◆', warning: '⚠' };

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column-reverse', // newest on top
      gap: '8px',
      zIndex: 9999,
      alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const p = PALETTES[toast.type] ?? PALETTES.info;
  const icon = ICONS[toast.type] ?? '◆';
  const duration = toast.duration ?? 4000;

  function handleDismiss() {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 240);
  }

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '13px 20px 17px',  // extra bottom padding for progress bar
        background: p.bg,
        border: `1px solid ${p.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '12px',
        color: p.text,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        fontSize: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        pointerEvents: 'all',
        cursor: 'pointer',
        maxWidth: '88vw',
        minWidth: '260px',
        userSelect: 'none',
        overflow: 'hidden',
        animation: exiting
          ? 'tv-toast-out 0.25s cubic-bezier(0.4,0,0.2,1) both'
          : 'tv-toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      <span style={{ fontSize: '15px', flexShrink: 0 }}>{icon}</span>
      <span style={{ lineHeight: 1.45 }}>{toast.message}</span>

      {/* Drain progress bar */}
      <ProgressBar duration={duration} color={p.bar} />
    </div>
  );
}

function ProgressBar({ duration, color }) {
  const [width, setWidth] = useState(100);

  useEffect(() => {
    // Start immediately — rAF ensures browser has painted first
    const raf = requestAnimationFrame(() => {
      setWidth(0);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: '3px',
      background: 'rgba(255,255,255,0.08)',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: color,
        opacity: 0.6,
        transition: `width ${duration}ms linear`,
        borderRadius: '0 0 12px 12px',
      }} />
    </div>
  );
}