// lib/supabaseClient.js (Create a separate file for your Supabase client)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mccbekclrcnckrzfdoza.supabase.co'; // Replace with your Supabase URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2Jla2NscmNuY2tyemZkb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNDczNDAsImV4cCI6MjA1ODcyMzM0MH0.7HSl_zdjOrfcQFLFYFES-t0KGaK2zRAnt1MDP3_Dpqk'; // Replace with your Supabase Anon Key

export const supabase = createClient(supabaseUrl, supabaseKey);