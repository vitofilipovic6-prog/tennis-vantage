import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const SUPABASE_SESSION_KEY = 'sb-zleddweuzesuymahjniw-auth-token';

function getInitialState() {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const user = parsed?.user ?? parsed?.currentSession?.user ?? null;
    if (!user?.id) return null;
    return {
      user,
      profile: {
        full_name:         user.user_metadata?.full_name ?? 'Player',
        avatar_url:        user.user_metadata?.avatar_url ?? null,
        favourite_players: [],
      },
      loading:     false,
      authLoading: false,
      error:       null,
    };
  } catch {
    return null;
  }
}

const initialState = getInitialState() ?? {
  user:        null,
  profile:     null,
  loading:     true,
  authLoading: false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'AUTH_START':      return { ...state, authLoading: true,  error: null };
    case 'AUTH_END':        return { ...state, authLoading: false };
    case 'SET_USER':        return { ...state, user: action.user, profile: action.profile, loading: false, authLoading: false, error: null };
    case 'UPDATE_PROFILE':  return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'CLEAR_USER':      return { ...state, user: null, profile: null, loading: false, authLoading: false };
    case 'SET_ERROR':       return { ...state, error: action.error, authLoading: false };
    case 'CLEAR_ERROR':     return { ...state, error: null };
    case 'LOADING_DONE':    return { ...state, loading: false };
    default:                return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef        = useRef(true);

  const loadProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, favourite_players')
        .eq('id', userId)
        .single();
      return data ?? { full_name: 'Player', avatar_url: null, favourite_players: [] };
    } catch {
      return { full_name: 'Player', avatar_url: null, favourite_players: [] };
    }
  }, []);

  const updateProfileInContext = useCallback((patch) => {
    dispatch({ type: 'UPDATE_PROFILE', patch });
  }, []);

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
            // Unblock UI immediately using JWT metadata (no network needed)
            const cachedName = session.user.user_metadata?.full_name ?? 'Player';
            dispatch({
              type: 'SET_USER',
              user: session.user,
              profile: { full_name: cachedName, avatar_url: null },
            });
            // Load real profile in background without blocking
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

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    dispatch({ type: 'AUTH_END' });
    return { error: error?.message ?? null };
  }, []);

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

  const sendMagicLink = useCallback(async (email) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });
    dispatch({ type: 'AUTH_END' });
    return { error: error?.message ?? null };
  }, []);

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
    updateProfileInContext,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}