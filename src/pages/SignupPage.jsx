// ─────────────────────────────────────────────────────────────────────────────
// SignupPage.jsx  –  TennisVantage sign-up screen
// Auth logic migrated from the user's MaturaPrep project
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { Btn, Input, PasswordInput, SocialBtn, Divider } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function SignupPage({ nav, showToast }) {
  const { register, loginWithGoogle, loginWithApple, authLoading, error, clearError } = useAuth();

  const [fullName, setFullName]   = useState('');
  const [email,    setEmail]      = useState('');
  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [oauthLoading, setOauthLoading] = useState(null);

  function validate() {
    const errs = {};
    if (!fullName.trim())             errs.fullName = 'Full name is required';
    if (!email.trim())                errs.email    = 'Email is required';
    if (password.length < 8)          errs.password = 'Password must be at least 8 characters';
    if (password !== confirm)         errs.confirm  = 'Passwords do not match';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    const { error, requiresConfirmation } = await register(email.trim(), password, fullName.trim());
    if (error) {
      showToast(error, 'error');
    } else if (requiresConfirmation) {
      // Email confirmation is ON — tell user to check inbox
      showToast('Account created! Check your email for a confirmation link.', 'success');
      nav('login');
    } else {
      // Email confirmation is OFF — user is already logged in, App.jsx routes to dashboard
      showToast('Welcome to TennisVantage!', 'success');
    }
  }

  async function handleGoogle() {
    setOauthLoading('google');
    clearError();
    await loginWithGoogle();
    setOauthLoading(null);
  }

  async function handleApple() {
    setOauthLoading('apple');
    clearError();
    await loginWithApple();
    setOauthLoading(null);
  }

  return (
    <AuthLayout
      nav={nav}
      title="Create your account"
      subtitle="Start predicting matches in seconds"
    >
      {/* Social buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        <SocialBtn
          provider="google"
          label="Sign up with Google"
          onClick={handleGoogle}
          loading={oauthLoading === 'google'}
        />
        <SocialBtn
          provider="apple"
          label="Sign up with Apple"
          onClick={handleApple}
          loading={oauthLoading === 'apple'}
        />
      </div>

      <Divider label="or sign up with email" />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
        <Input
          label="Full Name"
          type="text"
          placeholder="Carlos Alcaraz"
          value={fullName}
          onChange={v => { setFullName(v); setFieldErrors(p => ({ ...p, fullName: undefined })); }}
          error={fieldErrors.fullName}
          required
          autoComplete="name"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          }
        />

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={v => { setEmail(v); setFieldErrors(p => ({ ...p, email: undefined })); }}
          error={fieldErrors.email}
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
          onChange={v => { setPassword(v); setFieldErrors(p => ({ ...p, password: undefined })); }}
          error={fieldErrors.password}
          required
          autoComplete="new-password"
          hint="Minimum 8 characters"
        />

        <PasswordInput
          label="Confirm Password"
          value={confirm}
          onChange={v => { setConfirm(v); setFieldErrors(p => ({ ...p, confirm: undefined })); }}
          error={fieldErrors.confirm}
          required
          autoComplete="new-password"
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
          Create Account →
        </Btn>

        <p style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.5 }}>
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>

      <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)', marginTop: '24px' }}>
        Already have an account?{' '}
        <button
          onClick={() => nav('login')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--lime)', fontWeight: 600, fontSize: '14px',
            fontFamily: 'var(--font-body)', padding: 0,
          }}
        >
          Sign in →
        </button>
      </p>
    </AuthLayout>
  );
}
