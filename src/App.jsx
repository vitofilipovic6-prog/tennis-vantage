// ─────────────────────────────────────────────────────────────────────────────
// src/App.jsx
//
// CHANGES:
//  - Added 'magic' screen → MagicLinkPage (passwordless sign-in)
//  - ResetPage kept for backward compat (still exported, just not linked)
//  - All other logic unchanged
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Auth pages — always eager-loaded (on the critical path)
import LandingPage    from './pages/LandingPage';
import LoginPage      from './pages/LoginPage';
import SignupPage     from './pages/SignupPage';
import MagicLinkPage  from './pages/MagicLinkPage';

// Dashboard is large — lazy-load so unauthenticated users don't pay the cost
const Dashboard = lazy(() => import('./pages/Dashboard'));

import { useToast } from './hooks/hooks';
import ToastContainer from './components/ToastContainer';

// ── Inner router ──────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState('landing');
  const { toasts, show: showToast, dismiss } = useToast();

  // Once user logs in (including via magic link click), always go to dashboard
  useEffect(() => {
    if (!loading) {
      if (user) setScreen('dashboard');
      else if (screen === 'dashboard') setScreen('landing');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const nav = (to) => setScreen(to);

  if (loading) return <FullscreenLoader />;

  const sharedProps = { nav, showToast };

  return (
    <>
      {screen === 'landing'   && <LandingPage    {...sharedProps} />}
      {screen === 'login'     && <LoginPage       {...sharedProps} />}
      {screen === 'signup'    && <SignupPage       {...sharedProps} />}
      {screen === 'magic'     && <MagicLinkPage    {...sharedProps} />}

      {screen === 'dashboard' && (
        <Suspense fallback={<FullscreenLoader />}>
          <Dashboard {...sharedProps} />
        </Suspense>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

// ── Fullscreen loader ─────────────────────────────────────────────────────────
function FullscreenLoader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#070B14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20,
    }}>
      <div style={{ fontSize: 48, animation: 'tv-bounce 1.2s ease infinite' }}>🎾</div>
      <p style={{
        color: '#9fef66', fontFamily: '"DM Sans", sans-serif',
        fontSize: 14, letterSpacing: '0.1em',
        textTransform: 'uppercase', opacity: 0.7,
      }}>
        Loading TennisVantage
      </p>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}