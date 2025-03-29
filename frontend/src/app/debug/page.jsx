'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '../supabase-provider';

export default function DebugPage() {
  const supabase = useSupabase();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cookies, setCookies] = useState([]);
  const [localStorage, setLocalStorage] = useState({});
  
  useEffect(() => {
    async function getDebugInfo() {
      try {
        // Get session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
        }
        
        setSessionData(data);
        
        // Only access browser APIs inside useEffect
        if (typeof document !== 'undefined') {
          // Get cookies
          const cookieList = document.cookie.split(';')
            .filter(c => c.trim() !== '')
            .map(cookie => {
              const [name, value] = cookie.split('=').map(c => c.trim());
              return { name, value };
            });
          setCookies(cookieList);
        }
        
        // Only access localStorage in browser
        if (typeof window !== 'undefined') {
          const localStorageItems = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            localStorageItems[key] = window.localStorage.getItem(key);
          }
          setLocalStorage(localStorageItems);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    
    getDebugInfo();
  }, [supabase]);
  
  const refreshSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      setSessionData(data);
      alert('Session refreshed successfully');
    } catch (e) {
      setError(e.message);
      alert(`Error refreshing session: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const clearAllData = () => {
    if (typeof window === 'undefined') return;
    
    if (confirm('Are you sure you want to clear all session data?')) {
      // Clear cookies
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      
      // Clear localStorage
      window.localStorage.clear();
      
      // Sign out
      supabase.auth.signOut();
      
      alert('All session data cleared. Refresh the page to see changes.');
    }
  };
  
  if (loading) return <div>Loading debug information...</div>;
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Session Debug</h1>
      
      {error && (
        <div style={{ color: 'red', padding: '10px', border: '1px solid red', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={refreshSession}
          style={{ marginRight: '10px', padding: '8px 16px' }}
        >
          Refresh Session
        </button>
        
        <button 
          onClick={clearAllData}
          style={{ padding: '8px 16px', backgroundColor: '#ff4040', color: 'white' }}
        >
          Clear All Session Data
        </button>
      </div>
      
      <h2>Session</h2>
      <pre style={{ 
        backgroundColor: '#f4f4f4', 
        padding: '10px', 
        borderRadius: '4px',
        overflowX: 'auto'
      }}>
        {JSON.stringify(sessionData, null, 2)}
      </pre>
      
      <h2>Cookies</h2>
      {cookies.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((cookie, index) => (
              <tr key={index}>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{cookie.name}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                  {cookie.value.length > 30 
                    ? cookie.value.substring(0, 30) + '...' 
                    : cookie.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No cookies found</p>
      )}
      
      <h2>Local Storage</h2>
      {Object.keys(localStorage).length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Key</th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(localStorage).map(([key, value], index) => (
              <tr key={index}>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{key}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                  {value && value.length > 30 
                    ? value.substring(0, 30) + '...' 
                    : value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No local storage items found</p>
      )}
    </div>
  );
}
