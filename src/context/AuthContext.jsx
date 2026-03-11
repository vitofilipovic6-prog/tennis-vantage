// ─────────────────────────────────────────────────────────────────────────────
// AuthContext.jsx  –  TennisVantage Auth State
// FIX: Replaced dual getSession()+onAuthStateChange race condition with a
//      single onAuthStateChange bootstrap. Supabase fires INITIAL_SESSION
//      on mount, which is the correct way to restore sessions per their docs.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

const initialState = {
  user:        null,
  profile:     null,
  loading:     true,
  authLoading: false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':     return { ...state, user: action.user, profile: action.profile, loading: false, error: null };
    case 'SIGNED_OUT':   return { ...state, user: null, profile: null, loading: false, error: null };
    case 'LOADING_DONE': return { ...state, loading: false };
    case 'AUTH_START':   return { ...state, authLoading: true, error: null };
    case 'AUTH_END':     return { ...state, authLoading: false };
    case 'SET_ERROR':    return { ...state, error: action.error, authLoading: false };
    case 'CLEAR_ERROR':  return { ...state, error: null };
    default: return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef(true);

  // ── Load profile ─────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (userId) => {
    if (!userId) return null;
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

  // ── Bootstrap — single source of truth via onAuthStateChange ─────────────────
  // Supabase v2 fires 'INITIAL_SESSION' synchronously on subscribe with the
  // restored (or refreshed) session. This eliminates the getSession() race.
  useEffect(() => {
    mountedRef.current = true;

    // Safety net: if INITIAL_SESSION never fires (e.g. network totally offline),
    // stop the loading screen after 5 seconds so the user isn't stuck forever.
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        dispatch({ type: 'LOADING_DONE' });
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        // INITIAL_SESSION fires once on mount — this replaces getSession()
        if (event === 'INITIAL_SESSION') {
          clearTimeout(safetyTimeout);
          if (session?.user) {
            const profile = await loadProfile(session.user.id);
            if (mountedRef.current) {
              dispatch({ type: 'SET_USER', user: session.user, profile });
            }
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
          // Clean up OAuth hash from URL if present
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token silently refreshed — update user object but don't re-fetch profile
          if (mountedRef.current) {
            dispatch({ type: 'SET_USER', user: session.user, profile: state.profile });
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          clearTimeout(safetyTimeout);
          if (mountedRef.current) dispatch({ type: 'SIGNED_OUT' });
          return;
        }
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile]);

  // ── Login ─────────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return { error }; }
    dispatch({ type: 'AUTH_END' });
    return { error: null };
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────────
  const register = useCallback(async (email, password, fullName) => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return { error }; }

    if (data.user) {
      await supabase
        .from('profiles')
        .upsert([{ id: data.user.id, full_name: fullName }], { onConflict: 'id' });
    }

    dispatch({ type: 'AUTH_END' });
    return { error: null, requiresConfirmation: !data.session };
  }, []);

  // ── Google OAuth ──────────────────────────────────────────────────────────────
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

  // ── Apple OAuth ───────────────────────────────────────────────────────────────
  const loginWithApple = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); }
    dispatch({ type: 'AUTH_END' });
  }, []);

  // ── Reset password ────────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    dispatch({ type: 'AUTH_END' });
    return { error };
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────────
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
    loginWithApple,
    resetPassword,
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