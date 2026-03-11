// ─────────────────────────────────────────────────────────────────────────────
// App.jsx  –  TennisVantage root
//
// FIXES APPLIED (Batch 2A):
//  #13 — React.lazy() on Dashboard: authenticated users pay zero bundle cost
//        on the landing page. Suspense falls back to the existing FullscreenLoader.
//  #16 — ErrorBoundary wraps AppRouter so any unhandled runtime crash in any
//        tab/component shows a friendly recovery screen instead of a white void.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Auth pages are lightweight — always eager-loaded (they're on the critical path)
import LandingPage from './pages/LandingPage';
import LoginPage   from './pages/LoginPage';
import SignupPage  from './pages/SignupPage';
import ResetPage   from './pages/ResetPage';

// FIX #13: Dashboard is large. Only authenticated users ever see it, so we
// lazy-load it. Vite splits it into a separate chunk (~80-120 kB saved from
// initial bundle). The Suspense fallback reuses our existing loader.
const Dashboard = lazy(() => import('./pages/Dashboard'));

import { useToast } from './hooks/hooks';
import ToastContainer from './components/ToastContainer';

// ── Inner router ──────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState('landing'); // landing | login | signup | reset
  const { toasts, show: showToast, dismiss } = useToast();

  // Once user logs in, always go to dashboard; on logout return to landing
  useEffect(() => {
    if (!loading) {
      if (user) setScreen('dashboard');
      else if (screen === 'dashboard') setScreen('landing');
    }
  }, [user, loading]);

  const nav = (to) => setScreen(to);

  if (loading) return <FullscreenLoader />;

  const sharedProps = { nav, showToast };

  return (
    <>
      {screen === 'landing'   && <LandingPage {...sharedProps} />}
      {screen === 'login'     && <LoginPage   {...sharedProps} />}
      {screen === 'signup'    && <SignupPage  {...sharedProps} />}
      {screen === 'reset'     && <ResetPage   {...sharedProps} />}

      {/* Suspense boundary: shows the loader while the Dashboard chunk downloads.
          This only fires once — after that it's cached by the browser. */}
      {screen === 'dashboard' && (
        <Suspense fallback={<FullscreenLoader />}>
          <Dashboard {...sharedProps} />
        </Suspense>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

// ── Fullscreen loader (used by both auth loading state + Suspense fallback) ───
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
    // FIX #16: ErrorBoundary sits outside AuthProvider so it catches crashes
    // in auth context too. Any .map() on undefined, bad API shape, missing
    // prop — all caught here instead of turning the screen white.
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}