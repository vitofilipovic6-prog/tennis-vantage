// ─────────────────────────────────────────────────────────────────────────────
// App.jsx  –  TennisVantage root
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage  from './pages/LandingPage';
import LoginPage    from './pages/LoginPage';
import SignupPage   from './pages/SignupPage';
import ResetPage    from './pages/ResetPage';
import Dashboard    from './pages/Dashboard';
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
      {screen === 'dashboard' && <Dashboard   {...sharedProps} />}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function FullscreenLoader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#070B14',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20,
    }}>
      <div style={{ fontSize: 48, animation: 'tv-bounce 1.2s ease infinite' }}>🎾</div>
      <p style={{ color: '#9fef66', fontFamily: '"DM Sans", sans-serif', fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7 }}>
        Loading TennisVantage
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
