'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '../supabase-provider';
import { useSession } from '../supabase-provider';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const supabase = useSupabase();
  const session = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Redirect if not logged in
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    
    async function fetchProjects() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', session.user.id);
          
        if (error) throw error;
        setProjects(data || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProjects();
  }, [session, supabase, router]);
  
  if (!session) {
    return <div>Please sign in to view the dashboard</div>;
  }
  
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.email}!</p>
      
      <div className="projects-section">
        <h2>Your Projects</h2>
        {loading ? (
          <p>Loading projects...</p>
        ) : (
          <div className="projects-list">
            {projects.length === 0 ? (
              <p>You don't have any projects yet. Create one to get started!</p>
            ) : (
              projects.map((project) => (
                <div key={project.id} className="project-card">
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
