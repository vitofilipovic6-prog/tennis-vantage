// ─────────────────────────────────────────────────────────────────────────────
// src/pages/LoginPage.jsx
//
// CHANGES:
//  - Apple sign-in button removed
//  - "Forgot password?" replaced with "Sign in without password" → nav('magic')
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { Btn, Input, PasswordInput, SocialBtn, Divider } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ nav, showToast }) {
  const { login, loginWithGoogle, authLoading, error, clearError } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    const { error } = await login(email.trim(), password);
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Welcome back! 🎾', 'success');
    }
  }

  async function handleGoogle() {
    setOauthLoading(true);
    clearError();
    await loginWithGoogle();
    setOauthLoading(false);
  }

  return (
    <AuthLayout
      nav={nav}
      title="Welcome back"
      subtitle="Sign in to your TennisVantage account"
    >
      {/* Google only — Apple removed */}
      <div style={{ marginBottom: '24px' }}>
        <SocialBtn
          provider="google"
          label="Continue with Google"
          onClick={handleGoogle}
          loading={oauthLoading}
        />
      </div>

      <Divider label="or sign in with email" />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
        <Input
          label="Email"
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

        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
        />

        {/* "Sign in without password" replaces "Forgot password?" */}
        <div style={{ textAlign: 'right', marginTop: '-8px' }}>
          <button
            type="button"
            onClick={() => nav('magic')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: 'var(--lime)', fontFamily: 'var(--font-body)',
              fontWeight: 500, padding: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Sign in without password →
          </button>
        </div>

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
          Sign In
        </Btn>
      </form>

      {/* Sign-up link */}
      <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)', marginTop: '24px' }}>
        Don't have an account?{' '}
        <button
          onClick={() => nav('signup')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--lime)', fontWeight: 600, fontSize: '14px',
            fontFamily: 'var(--font-body)', padding: 0,
          }}
        >
          Sign up free →
        </button>
      </p>
    </AuthLayout>
  );
}