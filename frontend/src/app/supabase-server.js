import { createServerClient } from '@supabase/ssr'; // Use createServerClient for server components
import { cookies } from 'next/headers';
// Remove the incorrect import below
// import { supabaseUrl, supabaseKey } from '../lib/supabaseClient';

// Read URL and Key directly from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Anon Key in environment variables for server client (supabase-server.js).");
}

export async function createSupabaseServerClient() {
  // Get cookieStore here, once per request, as per Supabase docs
  const cookieStore = cookies();

  // Use createServerClient with cookies for server-side rendering
  return createServerClient(
    supabaseUrl, // Use env var
    supabaseKey, // Use env var
    {
      cookies: {
        // Make get synchronous again
        get(name) {
          try {
            // Use the cookieStore captured outside
            return cookieStore.get(name)?.value;
          } catch (error) {
             // Handle potential errors during get
             console.error(`Error getting cookie "${name}":`, error);
             return undefined; // Or null, depending on expected behavior
          }
        },
        // Make set synchronous again
        set(name, value, options) {
          try {
            // Use the cookieStore captured outside
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // This will throw in middleware/Server Components, but can be ignored
            // if middleware handles session refresh.
          }
        },
        // Make remove synchronous again
        remove(name, options) {
          try {
            // Use the cookieStore captured outside
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
