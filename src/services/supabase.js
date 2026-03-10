// ─────────────────────────────────────────────────────────────────────────────
// supabase.js  –  Singleton Supabase client for TennisVantage
// FIX: Reads from env vars instead of hardcoded strings so the project
//      is portable and credentials are never accidentally committed.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] Missing env vars — make sure VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY are set in your .env file AND in the Vercel dashboard.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);