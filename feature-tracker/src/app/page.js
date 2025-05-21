'use client'

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { typeDisplayNameMap } from './consts';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function PageContent() {
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

  const fetchTotalPages = useCallback(async () => {
    try {
      const response = await fetch(`/api/getTotalPages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTotalPages(data);
    } catch (err) {
      console.error("Fetching total pages failed:", err);
      // Optionally set an error state for total pages if needed
    }
  }, []); // setTotalPages is stable

  useEffect(() => {
    fetchTotalPages(); // Initial fetch
  }, [fetchTotalPages]);

  useEffect(() => {
    const pageFromUrl = searchParams.get('page');
    if (pageFromUrl && !isNaN(parseInt(pageFromUrl))) {
      const pageNumber = Math.abs(parseInt(pageFromUrl));
      if (pageNumber !== currentPage) {
        setCurrentPage(pageNumber);
      }
    } else if (currentPage !== 1) { // Reset to 1 if no valid page in URL and not already 1
        setCurrentPage(1);
        // Optionally update URL if page is reset, though this might cause loops if not handled carefully
        // router.push(`/?page=1`); 
    }
  }, [searchParams, currentPage, setCurrentPage]);

  const fetchUpdates = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      // fetchTotalPages(); // fetchTotalPages is now called independently and on interval
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
  }, []);

  useEffect(() => {
    fetchUpdates(currentPage);
    // Also fetch total pages when current page changes or on interval, as it might affect pagination
    fetchTotalPages(); 

    const pollingInterval = setInterval(() => {
        fetchUpdates(currentPage);
        fetchTotalPages(); // Keep total pages updated
    }, 60000);
    return () => clearInterval(pollingInterval);
  }, [currentPage, fetchUpdates, fetchTotalPages]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  if (loading && !updates) return <p>Loading updates...</p>;
  if (error) return <p>Error loading updates: {error}</p>;
  if (!updates) return <p>No updates available.</p>;

  const secondsDiff = lastChecked ? Math.round((currentTime.getTime() - lastChecked.getTime()) / 1000) : null;

  return (
    <>
      <p>Last checked for updates: {lastChecked ? timeSince.format(-secondsDiff, "second") : 'Never'}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {updates.filter(update => !update.isHidden).map((update) => {
          const typeDisplayName = typeDisplayNameMap[update.type] || update.type;
          return (
            <Card key={update.id}>
              <CardHeader>
                <CardTitle>{typeDisplayName}</CardTitle>
                <CardDescription>{update.appId}</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{update.details}</p>
              </CardContent>
              <CardFooter>
                <p className='text-muted-foreground text-sm'>{new Date(update.date).toLocaleString()}</p>
              </CardFooter>
            </Card> 
          );
        })}
      </div>
      <div className="flex justify-center space-x-4 mt-4">
        <Button
          onClick={() => {
            const newPage = Math.max(1, currentPage - 1);
            router.push(`/?page=${newPage}`);
          }}
          disabled={currentPage === 1}
          
        >
          Previous Page
        </Button>
        <Button
          onClick={() => {
            const newPage = currentPage + 1;
            router.push(`/?page=${newPage}`);
          }}
          disabled={currentPage === totalPages || totalPages === 0} // Disable if totalPages is 0
          
        >
          Next Page
        </Button>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading page information...</p>}>
      <PageContent />
    </Suspense>
  );
}
