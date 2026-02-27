// ─────────────────────────────────────────────────────────────────────────────
// supabase.js  –  Singleton Supabase client for TennisVantage
// Credentials taken directly from the user's MaturaPrep project
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://zleddweuzesuymahjniw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IGVYTJawZt9ZDY76tk-aQw_lWhVKjqb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
