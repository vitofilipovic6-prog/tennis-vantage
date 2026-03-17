import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

import LandingPage   from './pages/LandingPage';
import LoginPage     from './pages/LoginPage';
import SignupPage    from './pages/SignupPage';
import MagicLinkPage from './pages/MagicLinkPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));

import { useToast } from './hooks/hooks';
import ToastContainer from './components/ToastContainer';

// ── Helpers ───────────────────────────────────────────────────────────────────
const AUTH_SCREENS = ['landing', 'login', 'signup', 'magic'];

function getSavedScreen() {
  try {
    // Also check if Supabase has a local session — most reliable signal
    const hasSupabaseSession = Object.keys(localStorage).some(k =>
      k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (hasSupabaseSession) return 'dashboard';
    const s = sessionStorage.getItem('tv_screen');
    return s === 'dashboard' ? 'dashboard' : 'landing';
  } catch {
    return 'landing';
  }
}

function saveScreen(s) {
  try { sessionStorage.setItem('tv_screen', s); } catch {}
}

// ── Inner router ──────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, loading } = useAuth();
  const { toasts, show: showToast, dismiss } = useToast();

  // Initialize from sessionStorage — if user was on dashboard before refresh,
  // start there so there's no flash to landing while auth resolves
  const [screen, setScreen] = useState(getSavedScreen);

  const nav = (to) => {
    setScreen(to);
    saveScreen(to);
  };

  useEffect(() => {
    if (loading) return;
    if (user) {
      // Always save dashboard to session when user is confirmed
      saveScreen('dashboard');
      if (AUTH_SCREENS.includes(screen)) {
        setScreen('dashboard');
      }
    } else {
      // User signed out — clear saved screen
      saveScreen('landing');
      if (screen === 'dashboard') {
        setScreen('landing');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // While auth is resolving:
  // - If sessionStorage says dashboard → show dashboard skeleton (user is likely logged in)
  // - If sessionStorage says landing   → show nothing / landing skeleton
  if (loading) {
    return screen === 'dashboard' ? <AppSkeleton /> : <FullscreenLoader />;
  }

  const sharedProps = { nav, showToast };

  return (
    <>
      {screen === 'landing'   && <LandingPage    {...sharedProps} />}
      {screen === 'login'     && <LoginPage       {...sharedProps} />}
      {screen === 'signup'    && <SignupPage       {...sharedProps} />}
      {screen === 'magic'     && <MagicLinkPage    {...sharedProps} />}
      {screen === 'dashboard' && (
        <Suspense fallback={<AppSkeleton />}>
          <Dashboard {...sharedProps} />
        </Suspense>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

// ── Full screen loader (for unauthenticated cold loads) ───────────────────────
function FullscreenLoader() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#070B14',
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

// ── Dashboard skeleton (for authenticated refreshes) ─────────────────────────
function AppSkeleton() {
  const shimmer = {
    backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% auto',
    animation: 'tv-shimmer 1.4s linear infinite',
  };
  return (
    <div style={{ minHeight: '100dvh', background: '#070B14', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <div style={{
        height: 60, background: 'rgba(7,11,20,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 clamp(12px,3vw,32px)', gap: 12, flexShrink: 0,
      }}>
        <div style={{ width: 130, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.06)', ...shimmer }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', ...shimmer }} />
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: 'clamp(16px,3vw,32px)', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[80, 72, 90, 72].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, borderRadius: 999, background: 'rgba(255,255,255,0.05)', ...shimmer }} />
          ))}
        </div>
        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 160, borderRadius: 12, background: 'rgba(255,255,255,0.04)', ...shimmer }} />
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