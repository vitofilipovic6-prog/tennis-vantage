// ─────────────────────────────────────────────────────────────────────────────
// src/pages/MagicLinkPage.jsx
//
// NEW FILE — replaces ResetPage for the "sign in without password" flow.
//
// HOW IT WORKS:
//  1. User enters their email and clicks "Send Magic Link"
//  2. Supabase sends an email with a one-click login link
//  3. User clicks the link → browser navigates to window.location.origin
//  4. Supabase parses the OTP token from the URL hash automatically
//  5. AuthContext.onAuthStateChange fires SIGNED_IN → App.jsx routes to dashboard
//  6. User is now logged in. No password ever needed.
//
// IMPORTANT: In Supabase Dashboard → Authentication → Email Templates,
//  update the "Magic Link" template subject/body to match your brand.
//  The default template works fine but personalizing it looks more professional.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { Btn, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function MagicLinkPage({ nav, showToast }) {
  const { sendMagicLink, authLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    const { error } = await sendMagicLink(email.trim());
    if (error) {
      showToast('Could not send link: ' + error, 'error');
    } else {
      setSent(true);
      showToast('Magic link sent! Check your inbox.', 'success');
    }
  }

  return (
    <AuthLayout
      nav={nav}
      title={sent ? 'Check your inbox' : 'Sign in without password'}
      subtitle={
        sent
          ? `We sent a sign-in link to ${email}`
          : 'Enter your email and we\'ll send you a one-click login link'
      }
    >
      {sent ? (
        /* ── Sent state ── */
        <div style={{ textAlign: 'center' }}>
          {/* Animated envelope */}
          <div style={{
            fontSize: '56px', marginBottom: '16px',
            animation: 'tv-bounce 2s ease infinite',
          }}>
            ✉️
          </div>

          {/* Explanation */}
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <p style={{ color: 'var(--text)', fontSize: '14px', lineHeight: 1.7, marginBottom: '8px' }}>
              A sign-in link was sent to{' '}
              <strong style={{ color: 'var(--lime)' }}>{email}</strong>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
              Click the link in that email and you'll be logged in automatically — no password needed.
              The link expires in 24 hours.
            </p>
          </div>

          {/* Steps */}
          <div style={{ textAlign: 'left', marginBottom: '28px' }}>
            {[
              { step: '1', text: 'Open your email app' },
              { step: '2', text: 'Find the email from TennisVantage' },
              { step: '3', text: 'Click "Sign in to TennisVantage"' },
            ].map(({ step, text }) => (
              <div key={step} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 0',
                borderBottom: step !== '3' ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'var(--lime)', color: '#070B14',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 800, flexShrink: 0,
                }}>
                  {step}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text)' }}>{text}</span>
              </div>
            ))}
          </div>

          <Btn variant="secondary" size="md" fullWidth onClick={() => nav('login')}>
            ← Back to Sign In
          </Btn>

          <button
            onClick={() => { setSent(false); setEmail(''); clearError(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-faint)', fontSize: '13px', marginTop: '12px',
              fontFamily: 'var(--font-body)', display: 'block', margin: '12px auto 0',
            }}
          >
            Try a different email
          </button>
        </div>
      ) : (
        /* ── Form state ── */
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* What is this? explanation */}
          <div style={{
            padding: '12px 14px',
            background: 'rgba(159,239,102,0.06)',
            border: '1px solid rgba(159,239,102,0.2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            <span style={{ color: 'var(--lime)', fontWeight: 600 }}>How it works: </span>
            We'll email you a secure link. One click and you're in — no password required.
          </div>

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            }
          />

          {error && (
            <div style={{
              padding: '12px 16px', background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--radius-sm)',
              fontSize: '13.5px', color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <Btn type="submit" variant="primary" size="lg" fullWidth loading={authLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Send Magic Link
          </Btn>

          <Btn variant="ghost" size="md" fullWidth onClick={() => nav('login')}>
            ← Back to Sign In
          </Btn>
        </form>
      )}
    </AuthLayout>
  );
}
