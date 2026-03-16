// ─────────────────────────────────────────────────────────────────────────────
// src/context/AuthContext.jsx
//
// CHANGES IN THIS VERSION:
//  - Apple OAuth removed (not configured — avoided to prevent auth errors)
//  - resetPassword replaced with sendMagicLink (OTP / passwordless sign-in)
//  - Magic link flow: user enters email → Supabase sends OTP email →
//    user clicks link → Supabase fires SIGNED_IN event → AuthContext picks
//    it up automatically → App.jsx routes to dashboard. Zero extra code needed.
//  - All other auth logic (Google, email+password, profile loading) unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

// ── State shape ───────────────────────────────────────────────────────────────
const initialState = {
  user: null,
  profile: null,
  loading: true,
  authLoading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'AUTH_START': return { ...state, authLoading: true, error: null };
    case 'AUTH_END': return { ...state, authLoading: false };
    case 'SET_USER': return { ...state, user: action.user, profile: action.profile, loading: false, authLoading: false, error: null };
    case 'CLEAR_USER': return { ...state, user: null, profile: null, loading: false, authLoading: false };
    case 'SET_ERROR': return { ...state, error: action.error, authLoading: false };
    case 'CLEAR_ERROR': return { ...state, error: null };
    case 'LOADING_DONE': return { ...state, loading: false };
    default: return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef(true);

  // ── Load user profile from DB ──────────────────────────────────────────────
  const loadProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();
      return data ?? { full_name: 'Player', avatar_url: null };
    } catch {
      return { full_name: 'Player', avatar_url: null };
    }
  }, []);

  // ── Bootstrap — single source of truth via onAuthStateChange ──────────────
  // Supabase v2 fires 'INITIAL_SESSION' synchronously on subscribe with the
  // restored (or refreshed) session. This also catches magic link sign-ins:
  // when a user clicks the magic link in their email, Supabase resolves the
  // OTP token from the URL hash and fires 'SIGNED_IN' here automatically.
  useEffect(() => {
    mountedRef.current = true;

    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) dispatch({ type: 'LOADING_DONE' });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        if (event === 'INITIAL_SESSION') {
          clearTimeout(safetyTimeout);
          if (session?.user) {
            // ── FAST PATH: unblock the UI immediately with a minimal profile ──
            // The session is already restored from localStorage — no need to
            // wait for a DB round-trip before showing the dashboard.
            const cachedName = session.user.user_metadata?.full_name ?? 'Player';
            dispatch({
              type: 'SET_USER',
              user: session.user,
              profile: { full_name: cachedName, avatar_url: null },
            });
            // ── BACKGROUND: load the real profile without blocking render ─────
            loadProfile(session.user.id).then(profile => {
              if (mountedRef.current) {
                dispatch({ type: 'SET_USER', user: session.user, profile });
              }
            });
          } else {
            if (mountedRef.current) dispatch({ type: 'LOADING_DONE' });
          }
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await loadProfile(session.user.id);
          if (mountedRef.current) {
            dispatch({ type: 'SET_USER', user: session.user, profile });
          }
          if (window.location.hash || window.location.search.includes('token')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          if (mountedRef.current) {
            dispatch({ type: 'SET_USER', user: session.user, profile: state.profile });
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (mountedRef.current) dispatch({ type: 'CLEAR_USER' });
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ── Email + password login ─────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    dispatch({ type: 'AUTH_END' });
    return { error: error?.message ?? null };
  }, []);

  // ── Email + password register ──────────────────────────────────────────────
  const register = useCallback(async (email, password, fullName) => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    dispatch({ type: 'AUTH_END' });
    if (error) return { error: error.message, requiresConfirmation: false };
    const requiresConfirmation = !data?.session;
    return { error: null, requiresConfirmation };
  }, []);

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return; }
    if (data?.url) window.location.href = data.url;
    dispatch({ type: 'AUTH_END' });
  }, []);

  // ── Magic link (passwordless sign-in) ─────────────────────────────────────
  // Supabase sends an email with a one-time link. When the user clicks it,
  // Supabase handles the token automatically and fires SIGNED_IN above.
  // No extra callback page or URL parsing needed — it just works.
  const sendMagicLink = useCallback(async (email) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // After clicking the link, redirect back to the app root.
        // Supabase appends the token as a URL fragment (#access_token=...).
        // The onAuthStateChange listener above handles it from there.
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true, // creates account if doesn't exist yet
      },
    });
    dispatch({ type: 'AUTH_END' });
    return { error: error?.message ?? null };
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  const value = {
    ...state,
    firstName: state.profile?.full_name?.split(' ')[0] ?? 'Player',
    login,
    register,
    loginWithGoogle,
    sendMagicLink,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}