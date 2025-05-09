'use client'

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Page() {
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const timeSince = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchTotalPages = async () => {
      try {
        const response = await fetch(`/api/getTotalPages`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTotalPages(data);
      } catch (err) {
        console.error("Fetching total pages failed:", err);
      }
    };
    fetchTotalPages();
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    const pageFromUrl = searchParams.get('page');
    if (pageFromUrl && !isNaN(parseInt(pageFromUrl))) {
      setCurrentPage(parseInt(pageFromUrl));
    }
  }, [searchParams]);

  const fetchUpdates = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/db/getFeed?page=${page}`);
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
    fetchUpdates(currentPage);

    const pollingInterval = setInterval(() => fetchUpdates(currentPage), 60000); // Poll every 60 seconds (60000 ms)
    return () => clearInterval(pollingInterval);
  }, [currentPage]);

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
    'strings': 'New strings added',
    'appversion': 'New app version',
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
              <h2 className="text-xl font-bold" id={'update-'+update.id}>{typeDisplayName}: {update.appId}</h2>
              <p className="text-sm">{update.details}</p>
              <p className="text-xs text-gray-500">{new Date(update.date).toLocaleString()}</p>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center space-x-4 mt-4">
        <button
          onClick={() => {
            const newPage = Math.max(1, currentPage - 1);
            setCurrentPage(newPage);
            router.push(`/?page=${newPage}`);
            fetchUpdates(newPage);
          }}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
        >
          Previous Page
        </button>
        <button
          onClick={() => {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            router.push(`/?page=${newPage}`);
            fetchUpdates(newPage);
          }}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
        >
          Next Page
        </button>
      </div>
    </>
  );
}
