// ─────────────────────────────────────────────────────────────────────────────
// AuthContext.jsx  –  TennisVantage Auth State
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
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
    case 'SET_USER':    return { ...state, user: action.user, profile: action.profile, loading: false, error: null };
    case 'SIGNED_OUT':  return { ...state, user: null, profile: null, loading: false, error: null };
    case 'LOADING_DONE':return { ...state, loading: false };
    case 'AUTH_START':  return { ...state, authLoading: true, error: null };
    case 'AUTH_END':    return { ...state, authLoading: false };
    case 'SET_ERROR':   return { ...state, error: action.error, authLoading: false };
    case 'CLEAR_ERROR': return { ...state, error: null };
    default: return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Load profile ────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single();
    return data ?? { full_name: 'Player', avatar_url: null };
  }, []);

  // ── Bootstrap session ───────────────────────────────────────────────────────
 // ── Bootstrap session ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let userWasSignedIn = false;

    (async () => {
      try {
        // 1. Safely fetch data without immediately destructuring session
        const { data, error } = await supabase.auth.getSession();
        
        // 2. If Supabase returns an explicit error, throw it so the catch block handles it
        if (error) throw error; 

        if (!mounted) return;
        
        // 3. Safely check if session exists using optional chaining (?.)
        if (data?.session?.user) {
          userWasSignedIn = true;
          const profile = await loadProfile(data.session.user.id);
          if (mounted) dispatch({ type: 'SET_USER', user: data.session.user, profile });
        } else {
          // No user found, stop loading
          if (mounted) dispatch({ type: 'LOADING_DONE' });
        }
      } catch (err) {
        console.error("Supabase Connection Error:", err);
        // 4. THE MAGIC FIX: Always stop the loading screen, even if the request completely failed!
        if (mounted) dispatch({ type: 'LOADING_DONE' });
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_IN' && session) {
          userWasSignedIn = true;
          const profile = await loadProfile(session.user.id);
          if (mounted) dispatch({ type: 'SET_USER', user: session.user, profile });
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
        if (event === 'SIGNED_OUT' && userWasSignedIn) {
          userWasSignedIn = false;
          if (mounted) dispatch({ type: 'SIGNED_OUT' });
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return { error }; }
    dispatch({ type: 'AUTH_END' });
    return { error: null };
  }, []);

  // ── Register ────────────────────────────────────────────────────────────────
  const register = useCallback(async (email, password, fullName) => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },           // saved to raw_user_meta_data
        emailRedirectTo: window.location.origin, // used when email confirm is ON
      },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return { error }; }

    // Upsert profile row — safe whether trigger ran or not
    if (data.user) {
      await supabase
        .from('profiles')
        .upsert([{ id: data.user.id, full_name: fullName }], { onConflict: 'id' });
    }

    dispatch({ type: 'AUTH_END' });

    // requiresConfirmation = true  → email confirm is ON, tell user to check inbox
    // requiresConfirmation = false → email confirm is OFF, user is already logged in
    return { error: null, requiresConfirmation: !data.session };
  }, []);

  // ── Google OAuth ────────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,      // always back to http://localhost:5173
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return; }
    if (data?.url) window.location.href = data.url;
    dispatch({ type: 'AUTH_END' });
  }, []);

  // ── Apple OAuth ─────────────────────────────────────────────────────────────
  const loginWithApple = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); }
    dispatch({ type: 'AUTH_END' });
  }, []);

  // ── Reset password ──────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    dispatch({ type: 'AUTH_END' });
    return { error };
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────
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
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
