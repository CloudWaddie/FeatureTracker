'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabase } from '../../app/supabase-provider';

export default function SignIn() {
  const { push } = useRouter();
  const searchParams = useSearchParams();
  // Only access searchParams in useEffect to avoid SSR issues
  const [redirectTo, setRedirectTo] = useState('/dashboard');
  
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Get redirectTo from URL and check for existing session on component mount
  useEffect(() => {
    // Safe to access searchParams here as this runs only in browser
    setRedirectTo(searchParams.get('redirectedFrom') || '/dashboard');
    
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      console.log('Initial session check:', JSON.stringify(data, null, 2));
      
      // If session exists, redirect to dashboard
      if (data?.session) {
        console.log('Session found during component mount, redirecting to dashboard');
        push('/dashboard');
      }
      
      setAuthChecked(true);
    };
    
    checkSession();
  }, [supabase, push, searchParams]);
  
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Signing in with email: ${email}`);
      
      // Sign in with appropriate options
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data?.session) {
        console.log('Sign-in successful, session established');
        console.log(`User ID: ${data.session.user.id}`);
        console.log(`Session expiry: ${new Date(data.session.expires_at * 1000)}`);
        
        // Only run browser-specific code in browser context
        // localStorage is already protected here
        if (typeof window !== 'undefined') {
          // Manually store session in localStorage as a backup
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at
          }));
        }
        
        // Explicitly tell the server about our session
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({ 
              event: 'SIGNED_IN', 
              session: data.session,
              timestamp: new Date().toISOString()
            }),
          });
          
          const result = await response.json();
          console.log('Server session sync result:', result);
        } catch (fetchError) {
          console.error('Error syncing session with server:', fetchError);
        }
        
        // Navigate after brief delay to ensure all processes complete
        console.log(`Redirecting to: ${redirectTo} in 1.5 seconds...`);
        
        // Use window.location only in browser context
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            // Force a full page load to ensure session is recognized
            window.location.href = redirectTo;
          } else {
            // Fallback for server-side
            push(redirectTo);
          }
        }, 1500);
      } else {
        console.error('No session returned despite successful login');
        setError('Authentication succeeded but session not established. Please try again.');
      }
    } catch (error) {
      console.error('Sign-in error:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Don't render form until we've checked authentication
  if (!authChecked) {
    return <div>Checking authentication...</div>;
  }
  
  return (
    <div className="auth-form">
      <h1>Sign In</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSignIn}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Sign In'}
        </button>
      </form>
      <p>
        <a href="/auth/reset-password">Forgot your password?</a>
      </p>
      <p>
        Don't have an account? <a href="/auth/signup">Sign Up</a>
      </p>
    </div>
  );
}
