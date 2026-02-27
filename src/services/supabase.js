// ─────────────────────────────────────────────────────────────────────────────
// supabase.js  –  Singleton Supabase client for TennisVantage
// Credentials taken directly from the user's MaturaPrep project
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://qhwprkulwbrnvibqsedo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZlRimh7Vq6vg0MaL0sTIGA_4aWxHgUC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
