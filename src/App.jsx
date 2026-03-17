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

  // Don't block the whole screen — show a minimal top bar skeleton instead
// Auth resolves in <200ms via JWT; this is just a brief flash fallback
if (loading) return <AppSkeleton />;

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

function AppSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: '#070B14', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar skeleton */}
      <div style={{
        height: 60, background: 'rgba(7,11,20,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 clamp(12px,3vw,32px)', gap: 12,
      }}>
        {/* Logo placeholder */}
        <div style={{ width: 120, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'tv-shimmer 1.4s linear infinite', backgroundSize: '200% auto', backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)' }} />
        <div style={{ flex: 1 }} />
        {/* Avatar placeholder */}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'tv-shimmer 1.4s linear infinite', backgroundSize: '200% auto', backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)' }} />
      </div>
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: 'clamp(16px,3vw,32px)', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[80, 70, 90, 70].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, borderRadius: 999, background: 'rgba(255,255,255,0.05)', animation: 'tv-shimmer 1.4s linear infinite', backgroundSize: '200% auto', backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)' }} />
          ))}
        </div>
        {/* Card skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 160, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'tv-shimmer 1.4s linear infinite', backgroundSize: '200% auto', backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)' }} />
          ))}
        </div>
      </div>
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