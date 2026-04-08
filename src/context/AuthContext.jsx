import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const SUPABASE_SESSION_KEY = 'sb-zleddweuzesuymahjniw-auth-token';

// Read user from localStorage synchronously — only used to pre-populate
// the screen state in App.jsx so we know to show the dashboard skeleton.
// loading stays TRUE — we never trust this data to make auth decisions.
function getBootstrapUser() {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}

export const bootstrapUserExists = !!getBootstrapUser();

// Initial state always has loading: true
const initialState = {
  user:        null,
  profile:     null,
  loading:     true,
  authLoading: false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, authLoading: true, error: null };
    case 'AUTH_END':
      return { ...state, authLoading: false };

    case 'SET_USER':
      return {
        ...state,
        user:        action.user,
        // FIX #310: NEVER set profile to null. If action.profile is null/undefined,
        // keep the existing state.profile. This prevents a mid-render null wipe
        // that causes downstream components to crash when reading profile?.full_name.
        profile:     action.profile != null ? action.profile : state.profile,
        loading:     false,
        authLoading: false,
        error:       null,
      };

    // FIX #310: New action for TOKEN_REFRESHED — updates ONLY the user object,
    // never touches profile. This prevents the null-profile render cycle.
    case 'REFRESH_USER':
      return {
        ...state,
        user:    action.user,
        loading: false,
        // profile intentionally untouched — it was already loaded at SIGNED_IN
      };

    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...(state.profile ?? {}), ...action.patch } };

    case 'CLEAR_USER':
      return { ...state, user: null, profile: null, loading: false, authLoading: false };

    case 'SET_ERROR':
      return { ...state, error: action.error, authLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'LOADING_DONE':
      return { ...state, loading: false };

    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef        = useRef(true);

  const loadProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, favourite_players')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data ?? { full_name: 'Player', avatar_url: null, favourite_players: [] };
    } catch {
      return { full_name: 'Player', avatar_url: null, favourite_players: [] };
    }
  }, []);

  // FIX #310: Use useCallback with no deps so this reference is permanently stable.
  // Previously this was recreating on every render because it closed over `dispatch`
  // which was a new reference each render in some React versions.
  const updateProfileInContext = useCallback((patch) => {
    dispatch({ type: 'UPDATE_PROFILE', patch });
  }, []); // dispatch from useReducer is stable — safe to omit from deps

  useEffect(() => {
    mountedRef.current = true;

    // Increased safety timeout — 4s is too tight on slow connections
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) dispatch({ type: 'LOADING_DONE' });
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH EVENT]', event, 'user:', session?.user?.id ?? 'null');
        if (!mountedRef.current) return;

        if (event === 'INITIAL_SESSION') {
          clearTimeout(safetyTimeout);
          if (session?.user) {
            // Optimistic render with metadata, then hydrate from DB
            dispatch({
              type: 'SET_USER',
              user: session.user,
              profile: {
                full_name:         session.user.user_metadata?.full_name ?? 'Player',
                avatar_url:        session.user.user_metadata?.avatar_url ?? null,
                favourite_players: [],
              },
            });
            loadProfile(session.user.id).then(profile => {
              if (mountedRef.current) {
                dispatch({ type: 'SET_USER', user: session.user, profile });
              }
            });
          } else {
            dispatch({ type: 'CLEAR_USER' });
          }
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          clearTimeout(safetyTimeout);
          dispatch({
            type: 'SET_USER',
            user: session.user,
            profile: {
              full_name:         session.user.user_metadata?.full_name ?? 'Player',
              avatar_url:        session.user.user_metadata?.avatar_url ?? null,
              favourite_players: [],
            },
          });
          loadProfile(session.user.id).then(profile => {
            if (mountedRef.current) {
              dispatch({ type: 'SET_USER', user: session.user, profile });
            }
          });
          // Clean up magic link tokens from URL
          if (window.location.hash || window.location.search.includes('token')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          clearTimeout(safetyTimeout);
          if (mountedRef.current) {
            // FIX #310 (PRIMARY): Use REFRESH_USER instead of SET_USER.
            // SET_USER with profile:null was wiping the profile mid-render,
            // causing downstream components to crash in production builds.
            // REFRESH_USER only updates the user token — profile is untouched.
            dispatch({ type: 'REFRESH_USER', user: session.user });

            // Still re-hydrate profile in background to catch any staleness
            loadProfile(session.user.id).then(profile => {
              if (mountedRef.current) {
                dispatch({ type: 'UPDATE_PROFILE', patch: profile });
              }
            });
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          clearTimeout(safetyTimeout);
          if (mountedRef.current) dispatch({ type: 'CLEAR_USER' });
        }
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
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

    // Supabase returns no error but empty identities when email already exists.
    if (data?.user && data.user.identities?.length === 0) {
      return {
        error: 'An account with this email already exists. Please sign in instead.',
        requiresConfirmation: false,
      };
    }

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

  const resetPassword = useCallback(async (email) => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    dispatch({ type: 'AUTH_END' });
    return { error: error ? { message: error.message } : null };
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
    resetPassword,
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