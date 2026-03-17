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
const SUPABASE_SESSION_KEY = 'sb-zleddweuzesuymahjniw-auth-token';

function hasStoredSession() {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const userId = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
    return !!userId;
  } catch {
    return false;
  }
}

function saveScreen(s) {
  try { sessionStorage.setItem('tv_screen', s); } catch {}
}

function getSavedScreen() {
  try { return sessionStorage.getItem('tv_screen') ?? 'landing'; } catch { return 'landing'; }
}

// ── Inner router ──────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, loading } = useAuth();
  const { toasts, show: showToast, dismiss } = useToast();

  const [screen, setScreen] = useState(() => {
    // If localStorage has a valid Supabase session start on dashboard
    // immediately — prevents landing flash on refresh
    if (hasStoredSession()) return 'dashboard';
    return getSavedScreen();
  });

  const nav = (to) => {
    setScreen(to);
    saveScreen(to);
  };

  useEffect(() => {
    if (loading) return;
    if (user) {
      setScreen('dashboard');
      saveScreen('dashboard');
    } else {
      setScreen('landing');
      saveScreen('landing');
    }
  }, [user, loading]);

  // Show skeleton while Supabase confirms the session
  if (loading) return <AppSkeleton />;

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

// ── Skeleton ──────────────────────────────────────────────────────────────────
function AppSkeleton() {
  const shimmer = {
    backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% auto',
    animation: 'tv-shimmer 1.4s linear infinite',
  };
  return (
    <div style={{ minHeight: '100dvh', background: '#070B14', display: 'flex', flexDirection: 'column' }}>
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
      <div style={{ flex: 1, padding: 'clamp(16px,3vw,32px)', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[80, 72, 90, 72].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, borderRadius: 999, background: 'rgba(255,255,255,0.05)', ...shimmer }} />
          ))}
        </div>
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