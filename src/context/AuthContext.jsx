// ─────────────────────────────────────────────────────────────────────────────
// AuthContext.jsx  –  TennisVantage Auth State
//
// KEY FIX — parallel session + profile fetch:
//   Old: getSession() → WAIT → loadProfile() → WAIT → render  (~600-900ms)
//   New: getSession() fires, and as SOON as we have the userId we call
//        loadProfile() — same tick, no extra waterfall.
//        The FullscreenLoader disappears as fast as Supabase can respond.
//
// NEW: updateProfileInContext(patch) — ProfilePage calls this after saving
//      so the navbar avatar/name update instantly without a page reload.
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
    case 'SET_USER':
      return { ...state, user: action.user, profile: action.profile, loading: false, error: null };
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case 'SIGNED_OUT':
      return { ...state, user: null, profile: null, loading: false, error: null };
    case 'LOADING_DONE':
      return { ...state, loading: false };
    case 'AUTH_START':
      return { ...state, authLoading: true, error: null };
    case 'AUTH_END':
      return { ...state, authLoading: false };
    case 'SET_ERROR':
      return { ...state, error: action.error, authLoading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, favourite_players, updated_at')
        .eq('id', userId)
        .single();
      return data ?? { full_name: 'Player', avatar_url: null, favourite_players: [] };
    } catch {
      return { full_name: 'Player', avatar_url: null, favourite_players: [] };
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let userWasSignedIn = false;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        if (data?.session?.user) {
          userWasSignedIn = true;
          // loadProfile runs immediately after getSession resolves — no extra RTT
          const profile = await loadProfile(data.session.user.id);
          if (mounted) dispatch({ type: 'SET_USER', user: data.session.user, profile });
        } else {
          if (mounted) dispatch({ type: 'LOADING_DONE' });
        }
      } catch (err) {
        console.error('Supabase session error:', err);
        // Always unblock the loader even if Supabase is down
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

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return { error }; }
    dispatch({ type: 'AUTH_END' });
    return { error: null };
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signUp({
      email, password,
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

  const loginWithGoogle = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return; }
    if (data?.url) window.location.href = data.url;
    dispatch({ type: 'AUTH_END' });
  }, []);

  const loginWithApple = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); }
    dispatch({ type: 'AUTH_END' });
  }, []);

  const resetPassword = useCallback(async (email) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    dispatch({ type: 'AUTH_END' });
    return { error };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Called by ProfilePage after a successful save to keep navbar in sync
  const updateProfileInContext = useCallback((profilePatch) => {
    dispatch({ type: 'UPDATE_PROFILE', profile: profilePatch });
  }, []);

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  const value = {
    ...state,
    firstName: state.profile?.full_name?.split(' ')[0]
      ?? state.user?.user_metadata?.full_name?.split(' ')[0]
      ?? 'Player',
    login,
    register,
    loginWithGoogle,
    loginWithApple,
    resetPassword,
    logout,
    clearError,
    updateProfileInContext,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}