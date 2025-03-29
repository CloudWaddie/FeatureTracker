'use client';

import Link from 'next/link';
import { useSupabase } from '../app/supabase-provider';
import { useSession } from '../app/supabase-provider';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const supabase = useSupabase();
  const session = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <nav className="main-navigation">
      <div className="logo">
        <Link href="/">Feature Tracker</Link>
      </div>
      <div className="nav-links">
        <Link href="/">Home</Link>
        {session ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/profile">Profile</Link>
            <button 
              onClick={handleSignOut} 
              disabled={loading}
              className="sign-out-button"
            >
              {loading ? 'Signing out...' : 'Sign out'}
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/signin">Sign In</Link>
            <Link href="/auth/signup">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
