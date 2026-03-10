// ─────────────────────────────────────────────────────────────────────────────
// useProfile.js  –  TennisVantage profile hook
// Handles: fetch profile, update name, upload avatar, manage favourite players
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export function useProfile(userId) {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState(null);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, favourite_players, updated_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data ?? { full_name: '', avatar_url: null, favourite_players: [] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Update display name ─────────────────────────────────────────────────────
  const updateName = useCallback(async (fullName) => {
    if (!userId) return { error: 'Not authenticated' };
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      setProfile(prev => ({ ...prev, full_name: fullName }));
      return { error: null };
    } catch (e) {
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [userId]);

  // ── Upload avatar ───────────────────────────────────────────────────────────
  // Files go to: avatars/{userId}/avatar.{ext}
  // The bucket is public so we construct the URL directly after upload.
  const uploadAvatar = useCallback(async (file) => {
    if (!userId) return { error: 'Not authenticated' };
    setSaving(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;

      // Upload (upsert — overwrites previous avatar)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Bust cache with a timestamp so the browser doesn't show the old avatar
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      // Persist to profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (dbError) throw dbError;

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      return { error: null, avatarUrl };
    } catch (e) {
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [userId]);

  // ── Toggle favourite player ─────────────────────────────────────────────────
  const toggleFavourite = useCallback(async (playerName) => {
    if (!userId) return { error: 'Not authenticated' };
    setSaving(true);
    try {
      const current = profile?.favourite_players ?? [];
      const updated = current.includes(playerName)
        ? current.filter(p => p !== playerName)   // remove
        : [...current, playerName];               // add (max 10)

      if (updated.length > 10) {
        setSaving(false);
        return { error: 'You can favourite up to 10 players.' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ favourite_players: updated, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;

      setProfile(prev => ({ ...prev, favourite_players: updated }));
      return { error: null };
    } catch (e) {
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [userId, profile]);

  return {
    profile,
    loading,
    saving,
    error,
    refetch: fetchProfile,
    updateName,
    uploadAvatar,
    toggleFavourite,
  };
}