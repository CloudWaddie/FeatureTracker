'use client'

import { useEffect, useState } from 'react';

export default function Page() {
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const timeSince = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/db/getFeed');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUpdates(data);
      setError(null);
    } catch (err) {
      console.error("Fetching updates failed:", err);
      setError(err.message);
      setUpdates(null);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    fetchUpdates();

    const pollingInterval = setInterval(fetchUpdates, 60000); // Poll every 60 seconds (60000 ms)
    return () => clearInterval(pollingInterval);
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  if (loading && !updates) return <p>Loading updates...</p>;
  if (error) return <p>Error loading updates: {error}</p>;
  if (!updates) return <p>No updates available.</p>;
  const secondsDiff = lastChecked ? Math.round((currentTime - lastChecked) / 1000) : null;
  const typeDisplayNameMap = {
    'strings': 'New strings added: '
  };

  return (
    <>
      <p>Last checked for updates: {lastChecked ? timeSince.format(-secondsDiff, "second") : 'Never'}</p>
      {/* Feed (card grid) orded by most recent */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {updates.map((update) => {
          const typeDisplayName = typeDisplayNameMap[update.type] || update.type;

          return (
            <div className="p-4 bg-gray-950 rounded shadow border border-solid border-white rounded-xl" key={update.id}>
              <h2 className="text-xl font-bold">{typeDisplayName}{update.appId}</h2>
              <p className="text-sm">{update.details}</p>
              <p className="text-xs text-gray-500">{update.date}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
