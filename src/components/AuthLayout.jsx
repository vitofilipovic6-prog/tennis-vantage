// ─────────────────────────────────────────────────────────────────────────────
// AuthLayout.jsx  –  Shared wrapper for all auth screens
// ─────────────────────────────────────────────────────────────────────────────
import { Logo, CourtSVG } from '../components/ui';

export default function AuthLayout({ children, title, subtitle, nav }) {
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(20px,4vw,40px) 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background layers */}
      <div className="court-grid-bg" />
      <CourtSVG opacity={0.04} />
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: 'clamp(300px, 50vw, 700px)', height: 'clamp(300px, 50vw, 700px)',
        background: 'radial-gradient(circle, rgba(159,239,102,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-10%',
        width: 'clamp(250px, 40vw, 500px)', height: 'clamp(250px, 40vw, 500px)',
        background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div className="tv-pop" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(28px, 5vw, 48px)',
        width: '100%', maxWidth: '440px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(159,239,102,0.06)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo + titles */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Logo size="md" onClick={() => nav('landing')} />
          </div>
          {title && (
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'clamp(20px, 3vw, 24px)',
              letterSpacing: '-0.02em', marginBottom: '6px',
            }}>{title}</h1>
          )}
          {subtitle && (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
