import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseUrl, supabaseKey } from '../lib/supabaseClient';

export async function createSupabaseServerClient() {
  const cookieStore = cookies();
  
  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // This will throw in middleware, but we can safely ignore it for server components
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // This will throw in middleware, but we can safely ignore it for server components
          }
        }
      }
    }
  );
}

// Add a default export that points to the same function
export default createSupabaseServerClient;