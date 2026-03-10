// ─────────────────────────────────────────────────────────────────────────────
// useProfile.js  –  TennisVantage profile management hook
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export function useProfile() {
  const { user, profile: ctxProfile, updateProfileInContext } = useAuth();
  const [profile, setProfile] = useState(ctxProfile);
  const [loading, setLoading] = useState(!ctxProfile);
  const [saving, setSaving]   = useState(false);

  // Keep local state in sync when AuthContext profile changes
  useEffect(() => {
    if (ctxProfile) { setProfile(ctxProfile); setLoading(false); }
  }, [ctxProfile]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, favourite_players, updated_at')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      const p = data ?? { full_name: 'Player', avatar_url: null, favourite_players: [] };
      setProfile(p);
      updateProfileInContext(p);
    } catch (e) {
      console.error('[fetchProfile]', e.message);
    } finally {
      setLoading(false);
    }
  }, [user, updateProfileInContext]);

  const updateName = useCallback(async (fullName) => {
    if (!user) return { error: 'Not signed in' };
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      const patch = { full_name: fullName };
      setProfile(p => ({ ...p, ...patch }));
      updateProfileInContext(patch);
      return { error: null };
    } catch (e) {
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [user, updateProfileInContext]);

  const uploadAvatar = useCallback(async (file) => {
    if (!user) return { error: 'Not signed in' };
    if (file.size > 3 * 1024 * 1024) return { error: 'Image must be under 3 MB' };
    if (!['image/jpeg','image/png','image/webp'].includes(file.type))
      return { error: 'Only JPG, PNG or WebP allowed' };

    setSaving(true);
    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `${user.id}/avatar_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars').getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (dbErr) throw dbErr;

      const patch = { avatar_url: publicUrl };
      setProfile(p => ({ ...p, ...patch }));
      updateProfileInContext(patch);
      return { error: null, url: publicUrl };
    } catch (e) {
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [user, updateProfileInContext]);

  const toggleFavourite = useCallback(async (playerName) => {
    if (!user) return { error: 'Not signed in' };
    const current  = profile?.favourite_players ?? [];
    const isAdding = !current.includes(playerName);
    if (isAdding && current.length >= 10)
      return { error: 'Maximum 10 favourite players' };

    const updated = isAdding
      ? [...current, playerName]
      : current.filter(p => p !== playerName);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ favourite_players: updated, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      const patch = { favourite_players: updated };
      setProfile(p => ({ ...p, ...patch }));
      updateProfileInContext(patch);
      return { error: null };
    } catch (e) {
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [user, profile, updateProfileInContext]);

  return { profile, loading, saving, fetchProfile, updateName, uploadAvatar, toggleFavourite };
}