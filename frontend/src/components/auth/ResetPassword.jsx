// src/components/auth/ResetPassword.jsx
'use client';

import { useState } from 'react';
import { useSupabase } from '../../app/supabase-provider';

export default function ResetPassword() {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      
      if (error) throw error;
      
      setMessage('Check your email for the password reset link!');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="auth-form">
      <h1>Reset Password</h1>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}
      <form onSubmit={handleResetPassword}>
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
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <p>
        Remember your password? <a href="/auth/signin">Sign In</a>
      </p>
    </div>
  );
}