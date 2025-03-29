'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../../app/supabase-provider';

export default function SignUp() {
  const { push } = useRouter();
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      setMessage('Check your email for the confirmation link!');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="auth-form">
      <h1>Sign Up</h1>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}
      <form onSubmit={handleSignUp}>
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
          {loading ? 'Loading...' : 'Sign Up'}
        </button>
      </form>
      <p>
        Already have an account? <a href="/auth/signin">Sign In</a>
      </p>
    </div>
  );
}
