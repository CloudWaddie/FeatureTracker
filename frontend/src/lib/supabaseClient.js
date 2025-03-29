// lib/supabaseClient.js
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Instead, use this helper function to get the authenticated client
export function getSupabaseClient() {
  return createClientComponentClient({
    supabaseUrl: 'https://mccbekclrcnckrzfdoza.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2Jla2NscmNuY2tyemZkb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNDczNDAsImV4cCI6MjA1ODcyMzM0MH0.7HSl_zdjOrfcQFLFYFES-t0KGaK2zRAnt1MDP3_Dpqk'
  });
}

// For convenience, still export the URL and key
export const supabaseUrl = 'https://mccbekclrcnckrzfdoza.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2Jla2NscmNuY2tyemZkb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNDczNDAsImV4cCI6MjA1ODcyMzM0MH0.7HSl_zdjOrfcQFLFYFES-t0KGaK2zRAnt1MDP3_Dpqk';