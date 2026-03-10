// ─────────────────────────────────────────────────────────────────────────────
// App.jsx  –  TennisVantage root router
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage   from './pages/LandingPage';
import LoginPage     from './pages/LoginPage';
import SignupPage    from './pages/SignupPage';
import ResetPage     from './pages/ResetPage';
import Dashboard     from './pages/Dashboard';
import ProfilePage   from './pages/ProfilePage';
import { useToast }  from './hooks/hooks';
import ToastContainer from './components/ToastContainer';

function AppRouter() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState('landing');
  const { toasts, show: showToast, dismiss } = useToast();

  // Ref so we can read current screen inside useEffect without it being a dep
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      // Only auto-redirect from auth/landing screens — don't interrupt profile
      const authScreens = ['landing', 'login', 'signup', 'reset'];
      if (authScreens.includes(screenRef.current)) setScreen('dashboard');
    } else {
      // Logout → always return to landing
      if (['dashboard', 'profile'].includes(screenRef.current)) setScreen('landing');
    }
  }, [user, loading]);

  if (loading) return <FullscreenLoader />;

  const sharedProps = { nav: setScreen, showToast };

  return (
    <>
      {screen === 'landing'   && <LandingPage  {...sharedProps} />}
      {screen === 'login'     && <LoginPage    {...sharedProps} />}
      {screen === 'signup'    && <SignupPage   {...sharedProps} />}
      {screen === 'reset'     && <ResetPage    {...sharedProps} />}
      {screen === 'dashboard' && (
        <Dashboard {...sharedProps} onGoToProfile={() => setScreen('profile')} />
      )}
      {screen === 'profile'   && (
        <ProfilePage {...sharedProps} onBack={() => setScreen('dashboard')} />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function FullscreenLoader() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#070B14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20,
    }}>
      <div style={{ fontSize: 48, animation: 'tv-bounce 1.2s ease infinite' }}>🎾</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <p style={{
          color: '#9fef66',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13, letterSpacing: '0.12em',
          textTransform: 'uppercase', opacity: 0.8,
        }}>
          TennisVantage
        </p>
        {/* Animated progress bar — gives perceived speed while session loads */}
        <div style={{
          width: 100, height: 2, borderRadius: 99, overflow: 'hidden',
          background: 'rgba(159,239,102,0.12)',
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            backgroundImage: 'linear-gradient(90deg, transparent, #9fef66, transparent)',
            backgroundSize: '200% auto',
            animation: 'tv-shimmer 1.4s linear infinite',
          }} />
        </div>
      </div>
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