'use client';

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Create a context for Supabase authentication
const Context = createContext(undefined);

// Updated to accept URL and key as props
export function SupabaseProvider({ children, initialSession, supabaseUrl, supabaseKey }) {
  // Create a memoized Supabase client that persists across renders
  const client = useMemo(() => {
    // Pass URL and key explicitly
    return createClientComponentClient({
      supabaseUrl,
      supabaseKey,
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'supabase-auth-token',
        storage: {
          getItem: (key) => {
            // Move the check inside the function so it runs only when called
            if (typeof window === 'undefined') return null;
            const item = window.localStorage.getItem(key);
            console.log(`Storage getItem [${key}]:`, item ? 'exists' : 'does not exist');
            return item;
          },
          setItem: (key, value) => {
            // Move the check inside the function so it runs only when called
            if (typeof window === 'undefined') return;
            console.log(`Storage setItem [${key}]`);
            window.localStorage.setItem(key, value);
          },
          removeItem: (key) => {
            // Move the check inside the function so it runs only when called
            if (typeof window === 'undefined') return;
            console.log(`Storage removeItem [${key}]`);
            window.localStorage.removeItem(key);
          }
        },
        cookieOptions: {
          // Move window.location check inside a function to defer execution
          secure: (() => {
            if (typeof window === 'undefined') return false;
            return window.location.protocol === "https:";
          })(),
          sameSite: 'Lax',
          path: '/'
        }
      },
      global: {
        headers: {
          'x-client-info': 'featureTracker'
        }
      }
    });
  }, [supabaseUrl, supabaseKey]); // Add dependencies to ensure client is updated if these change

  const [session, setSession] = useState(initialSession);

  useEffect(() => {
    console.log("Setting up auth state change listener");
    const { data: { subscription } } = client.auth.onAuthStateChange((event, currentSession) => {
      console.log("Auth state changed:", event, "Session:", !!currentSession);
      setSession(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  return (
    <Context.Provider value={{ supabase: client, session }}>
      {children}
    </Context.Provider>
  );
}

// Custom hook to consume the Supabase context
export function useSupabase() {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useSupabase must be used inside SupabaseProvider');
  }
  return context.supabase;
}

// Hook to access the current session
export function useSession() {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useSession must be used inside SupabaseProvider');
  }
  return context.session;
}