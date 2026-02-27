// ─────────────────────────────────────────────────────────────────────────────
// ResetPage.jsx  –  TennisVantage reset password screen
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { Btn, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function ResetPage({ nav, showToast }) {
  const { resetPassword, authLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    const { error } = await resetPassword(email.trim());
    if (error) {
      showToast('Error: ' + error.message, 'error');
    } else {
      setSent(true);
      showToast('Reset link sent! Check your inbox.', 'success');
    }
  }

  return (
    <AuthLayout
      nav={nav}
      title={sent ? 'Check your email' : 'Reset password'}
      subtitle={sent ? `We sent a reset link to ${email}` : 'Enter your email and we\'ll send you a reset link'}
    >
      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '56px', marginBottom: '20px',
            animation: 'tv-bounce 2s ease infinite',
          }}>📬</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.7 }}>
            If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>,
            you'll receive a password reset link within a few minutes.
          </p>
          <Btn variant="secondary" size="md" fullWidth onClick={() => nav('login')}>
            ← Back to Sign In
          </Btn>
          <button
            onClick={() => { setSent(false); setEmail(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-faint)', fontSize: '13px', marginTop: '16px',
              fontFamily: 'var(--font-body)',
            }}
          >
            Try a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            Send Reset Link
          </Btn>

          <Btn variant="ghost" size="md" fullWidth onClick={() => nav('login')}>
            ← Back to Sign In
          </Btn>
        </form>
      )}
    </AuthLayout>
  );
}
