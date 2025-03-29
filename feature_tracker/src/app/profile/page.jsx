'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '../supabase-provider';
import { useSession } from '../supabase-provider';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const supabase = useSupabase();
  const session = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [website, setWebsite] = useState('');
  const [avatar_url, setAvatarUrl] = useState('');
  
  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        
        if (!session?.user) {
          router.push('/auth/signin');
          return;
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, username, website, avatar_url')
          .eq('id', session.user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setFullName(data.full_name || '');
          setUsername(data.username || '');
          setWebsite(data.website || '');
          setAvatarUrl(data.avatar_url || '');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }
    
    getProfile();
  }, [session, supabase, router]);
  
  async function updateProfile(e) {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          full_name: fullName,
          username,
          website,
          avatar_url,
          updated_at: new Date().toISOString(),
        });
        
      if (error) throw error;
      
      alert('Profile updated!');
    } catch (error) {
      alert('Error updating profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function signOut() {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
  
  if (!session) {
    return <div>Please sign in to view this page</div>;
  }
  
  return (
    <div className="profile-container">
      <h1>Profile</h1>
      <p>Email: {session.user.email}</p>
      
      <form onSubmit={updateProfile} className="profile-form">
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Update Profile'}
        </button>
      </form>
      
      <button onClick={signOut} className="sign-out-button">
        Sign Out
      </button>
    </div>
  );
}
