// lib/supabaseClient.js
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Read Supabase URL and Anon Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Anon Key in environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).");
}

// Instead, use this helper function to get the authenticated client
export function getSupabaseClient() {
  // Use environment variables here
  return createClientComponentClient({
    supabaseUrl: supabaseUrl,
    supabaseKey: supabaseKey
  });
}

// No longer export these directly, rely on environment variables
// export const supabaseUrl = supabaseUrl;
// export const supabaseKey = supabaseKey;
