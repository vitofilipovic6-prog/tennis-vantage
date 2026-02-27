// ─────────────────────────────────────────────────────────────────────────────
// ui.jsx  –  TennisVantage shared UI primitives
// Every component here follows the design token system in index.css
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({
  children, variant = 'primary', size = 'md',
  onClick, disabled, loading, type = 'button', style, fullWidth,
}) {
  const sizes = {
    sm:  { padding: '8px 18px',  fontSize: '13px', gap: '6px'  },
    md:  { padding: '12px 26px', fontSize: '15px', gap: '8px'  },
    lg:  { padding: '15px 32px', fontSize: '16px', gap: '10px' },
    xl:  { padding: '17px 40px', fontSize: '17px', gap: '10px' },
  };
  const variants = {
    primary:  { background: 'linear-gradient(135deg, #9fef66 0%, #6bc940 100%)', color: '#070B14', border: 'none', boxShadow: '0 4px 22px rgba(159,239,102,0.28)' },
    secondary:{ background: 'rgba(255,255,255,0.04)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.10)', boxShadow: 'none' },
    ghost:    { background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none' },
    danger:   { background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', boxShadow: 'none' },
    lime:     { background: 'transparent', color: '#9fef66', border: '1px solid #9fef66', boxShadow: '0 0 18px rgba(159,239,102,0.10)' },
    clay:     { background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', boxShadow: '0 4px 18px rgba(249,115,22,0.3)' },
  };

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '0.01em',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.48 : 1,
    transition: 'var(--t)', outline: 'none',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : undefined,
    flexShrink: 0,
    ...sizes[size],
    ...variants[variant],
    ...style,
  };

  return (
    <button
      type={type} disabled={disabled || loading} onClick={onClick}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
      style={base}
    >
      {loading ? <Spinner size={15} color={variant === 'primary' ? '#070B14' : '#9fef66'} /> : children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({
  label, type = 'text', placeholder, value, onChange,
  error, hint, icon, action, required, name, autoComplete,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}{required && <span style={{ color: 'var(--lime)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: focused ? 'var(--lime)' : 'var(--text-faint)',
            transition: 'var(--t)', pointerEvents: 'none', display: 'flex',
          }}>{icon}</span>
        )}
        <input
          name={name} type={type} placeholder={placeholder}
          value={value} required={required} autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `13px ${action ? '44px' : '14px'} 13px ${icon ? '42px' : '14px'}`,
            background: focused ? 'rgba(159,239,102,0.04)' : 'var(--bg-glass)',
            border: `1px solid ${error ? 'var(--red)' : focused ? 'rgba(159,239,102,0.5)' : 'var(--border-md)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)', fontSize: '15px',
            outline: 'none', transition: 'var(--t)',
            backdropFilter: 'blur(8px)',
          }}
        />
        {action && (
          <span style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-faint)', cursor: 'pointer', display: 'flex',
          }}>{action}</span>
        )}
      </div>
      {error && <span style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{hint}</span>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style, glow, hover, onClick, padding }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hov && hover ? 'var(--border-accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: padding ?? '22px',
        transition: 'var(--t-md)',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: glow && hov ? 'var(--shadow-glow)' : 'var(--shadow-card)',
        transform: hov && hover ? 'translateY(-3px)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'var(--lime)', size = 'sm' }) {
  const sizes = { sm: '11px', md: '13px' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      fontSize: sizes[size], fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = 'var(--lime)' }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid transparent`,
      borderTop: `2px solid ${color}`,
      borderRadius: '50%',
      animation: 'tv-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      {label && <span style={{ fontSize: '12px', color: 'var(--text-faint)', whiteSpace: 'nowrap', fontWeight: 500 }}>{label}</span>}
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
export function Logo({ size = 'md', onClick }) {
  const sizes = { sm: { ball: 28, font: 16 }, md: { ball: 36, font: 20 }, lg: { ball: 48, font: 28 } };
  const s = sizes[size];
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default',
        padding: 0,
      }}
    >
      <div style={{
        width: s.ball, height: s.ball,
        background: 'linear-gradient(135deg, #9fef66, #6bc940)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: s.ball * 0.52,
        boxShadow: '0 4px 16px rgba(159,239,102,0.35)',
      }}>🎾</div>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: s.font,
        letterSpacing: '-0.02em',
        color: 'var(--text)',
      }}>
        Tennis<span style={{ color: 'var(--lime)' }}>Vantage</span>
      </span>
    </button>
  );
}

// ── SocialButton ──────────────────────────────────────────────────────────────
export function SocialBtn({ provider, onClick, loading, label }) {
  const [hov, setHov] = useState(false);
  const icons = {
    google: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    apple: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.36.74 3.18.8 1.21-.24 2.37-.93 3.67-.84 1.56.12 2.74.7 3.5 1.77-3.2 1.9-2.44 5.87.48 7.03-.57 1.5-1.3 3-2.83 4.12zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick} disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '12px 16px',
        background: hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text)', fontSize: '14px', fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'var(--t)', outline: 'none',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? <Spinner size={16} color="var(--text-muted)" /> : icons[provider]}
      <span>{loading ? 'Redirecting…' : (label ?? `Continue with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`)}</span>
    </button>
  );
}

// ── PasswordInput ─────────────────────────────────────────────────────────────
export function PasswordInput({ label, value, onChange, error, placeholder, required, name, autoComplete }) {
  const [show, setShow] = useState(false);
  const eyeIcon = show ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  );

  return (
    <Input
      label={label} type={show ? 'text' : 'password'}
      placeholder={placeholder ?? '••••••••'}
      value={value} onChange={onChange} error={error}
      required={required} name={name} autoComplete={autoComplete}
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
      action={<span onClick={() => setShow(v => !v)} style={{ color: 'var(--text-faint)', transition: 'var(--t)' }}>{eyeIcon}</span>}
    />
  );
}

// ── CourtSVG (decorative tennis court lines) ──────────────────────────────────
export function CourtSVG({ opacity = 0.07, style }) {
  return (
    <svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none', ...style }}>
      <rect x="70" y="55"  width="760" height="370" fill="none" stroke="#9fef66" strokeWidth="2"/>
      <line x1="70"  y1="240" x2="830" y2="240" stroke="#9fef66" strokeWidth="1.5" strokeDasharray="8,5"/>
      <line x1="70"  y1="150" x2="830" y2="150" stroke="#9fef66" strokeWidth="1"/>
      <line x1="70"  y1="330" x2="830" y2="330" stroke="#9fef66" strokeWidth="1"/>
      <line x1="450" y1="150" x2="450" y2="330" stroke="#9fef66" strokeWidth="1"/>
      <line x1="70"  y1="55"  x2="70"  y2="425" stroke="#9fef66" strokeWidth="2.5"/>
      <line x1="830" y1="55"  x2="830" y2="425" stroke="#9fef66" strokeWidth="2.5"/>
      <line x1="450" y1="55"  x2="450" y2="68"  stroke="#9fef66" strokeWidth="1.5"/>
      <line x1="450" y1="412" x2="450" y2="425" stroke="#9fef66" strokeWidth="1.5"/>
    </svg>
  );
}
