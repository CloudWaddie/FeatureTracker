'use client'

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BetaUIView from '@/components/BetaUIView'; // Import BetaUIView
import { typeDisplayNameMap, FEED_ITEM_SUMMARY_LENGTH } from './consts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Tabs are no longer used here
import { Autolinker } from 'autolinker';
import DOMPurify from 'dompurify';
import { CardSkeleton } from "@/components/ui/card-skeleton";
// Card components are now in FeedCard
// SparkleButton and Badge are used within FeedCard or still needed if other parts use them.
// For now, assume SparkleButton and Badge are primarily for the card, if not, they'd be re-imported or kept.
// import { useFeatureFlagEnabled } from 'posthog-js/react'; // No longer needed here for UI switching
import FeedCard from '@/components/FeedCard'; // Import the new FeedCard component

// Placeholder for BetaUIView until it's created
// const BetaUIView = () => <div>Beta UI Placeholder</div>; 

function PageContent() {
  const [showBetaUI, setShowBetaUI] = useState(false);
  const [isClient, setIsClient] = useState(false); // To ensure localStorage is accessed only on client

  // const [showBetaChatUi, setShowBetaChatUi] = useState(false); // State for Beta UI toggle - replaced by activeUITab
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const timeSince = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const searchParams = useSearchParams();
  const router = useRouter();
  const aiSummariesEnabled = true; // No more feature flag, always enabled for now


  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterType, setSelectedFilterType] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [lastSeenHighestId, setLastSeenHighestId] = useState(null);
  const [currentSessionHighestId, setCurrentSessionHighestId] = useState(null);

  // Effect to read localStorage for Beta UI preference
  useEffect(() => {
    setIsClient(true); // Component has mounted
    const betaPreference = localStorage.getItem('enableBetaUI');
    if (betaPreference) {
      setShowBetaUI(JSON.parse(betaPreference));
    }
  }, []);


  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const fetchTotalPages = useCallback(async (currentSearchQuery, currentFilterType) => {
    try {
      let apiUrl = `/api/getTotalPages?`;
      const queryParams = new URLSearchParams();
      if (currentSearchQuery) queryParams.append('search', currentSearchQuery);
      if (currentFilterType) queryParams.append('filter', currentFilterType);
      
      apiUrl += queryParams.toString();

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTotalPages(data);
    } catch (err) {
      console.error("Fetching total pages failed:", err);
    }
  }, []);

  useEffect(() => {
    const pageFromUrl = searchParams.get('page');
    const searchFromUrl = searchParams.get('search') || '';
    const filterFromUrl = searchParams.get('filter') || '';

    const pageNumber = pageFromUrl && !isNaN(parseInt(pageFromUrl)) ? Math.abs(parseInt(pageFromUrl)) : 1;
    
    if (pageNumber !== currentPage) setCurrentPage(pageNumber);
    if (searchFromUrl !== searchQuery) setSearchQuery(searchFromUrl);
    if (searchFromUrl !== debouncedSearchQuery) setDebouncedSearchQuery(searchFromUrl); // Initialize debounced search
    if (filterFromUrl !== selectedFilterType) setSelectedFilterType(filterFromUrl);

  }, [searchParams]); // Removed currentPage, searchQuery, selectedFilterType to avoid loops, router is stable

  const fetchUpdates = useCallback(async (page, currentSearchQuery, currentFilterType) => {
    setLoading(true);
    try {
      let apiUrl = `/api/db/getFeed?page=${page}`;
      const queryParams = new URLSearchParams();
      if (currentSearchQuery) queryParams.append('search', currentSearchQuery);
      if (currentFilterType) queryParams.append('filter', currentFilterType);
      
      const queryString = queryParams.toString();
      if (queryString) apiUrl += `&${queryString}`;

      const response = await fetch(apiUrl);
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
  }, []); // Dependencies are stable setters or primitive types passed as arguments

  // Effect for fetching data when page, debouncedSearchQuery, or filter changes
  useEffect(() => {
    fetchUpdates(currentPage, debouncedSearchQuery, selectedFilterType);
    fetchTotalPages(debouncedSearchQuery, selectedFilterType);

    // Update URL
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
    if (selectedFilterType) params.set('filter', selectedFilterType);
    router.push(`?${params.toString()}`, undefined, { shallow: true });

  }, [currentPage, debouncedSearchQuery, selectedFilterType, fetchUpdates, fetchTotalPages, router]);

  // Polling interval
  useEffect(() => {
    const pollingInterval = setInterval(() => {
      // Fetch with current debounced search and filter
      fetchUpdates(currentPage, debouncedSearchQuery, selectedFilterType);
      fetchTotalPages(debouncedSearchQuery, selectedFilterType);
    }, 60000);
    return () => clearInterval(pollingInterval);
  }, [currentPage, debouncedSearchQuery, selectedFilterType, fetchUpdates, fetchTotalPages]); // Ensure polling uses up-to-date params

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Initialize and manage last seen highest feed ID from localStorage
  useEffect(() => {
    const storedLastSeenId = localStorage.getItem('lastSeenHighestFeedId');
    if (storedLastSeenId) {
      setLastSeenHighestId(parseInt(storedLastSeenId, 10));
    }
  }, []);

  // Track current session's highest ID (don't persist to localStorage yet)
  useEffect(() => {
    if (updates && updates.length > 0) {
      const highestCurrentId = Math.max(...updates.map(update => update.id));
      setCurrentSessionHighestId(prev => prev === null ? highestCurrentId : Math.max(prev, highestCurrentId));
    }
  }, [updates]);

  // Handle page unload - update localStorage with session's highest ID
  useEffect(() => {
    const updateLastSeenOnUnload = () => {
      if (currentSessionHighestId !== null) {
        localStorage.setItem('lastSeenHighestFeedId', currentSessionHighestId.toString());
      }
    };

    // Add event listeners for various page leave scenarios
    window.addEventListener('beforeunload', updateLastSeenOnUnload);
    window.addEventListener('pagehide', updateLastSeenOnUnload);

    // Cleanup function - also save when component unmounts
    return () => {
      updateLastSeenOnUnload();
      window.removeEventListener('beforeunload', updateLastSeenOnUnload);
      window.removeEventListener('pagehide', updateLastSeenOnUnload);
    };
  }, [currentSessionHighestId]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const handleFilterChange = (value) => {
    setSelectedFilterType(value === 'all' ? '' : value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  if (error) return <p>Error loading updates: {error}</p>;
  if (!updates) return <p>No updates available.</p>;

  const secondsDiff = lastChecked ? Math.round((currentTime.getTime() - lastChecked.getTime()) / 1000) : null;

  return (
    <>
      {/* Conditional rendering based on showBetaUI state */}
      {isClient && showBetaUI ? (
        <BetaUIView />
      ) : (
        <> {/* Standard Feed UI */}
          <div className="flex gap-4 mb-4 items-center">
            <Input
              type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
        <Select value={selectedFilterType || 'all'} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeDisplayNameMap).map(([key, displayName]) => (
              <SelectItem key={key} value={key}>{displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p>Last refreshed: {lastChecked ? timeSince.format(-secondsDiff, "second") : 'Never'}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={`loading-${index}`} />
          ))
        ) : (
          updates.filter(update => !update.isHidden).map((update) => (
            <FeedCard
              key={update.id}
              update={update}
              lastSeenHighestId={lastSeenHighestId}
              aiSummariesEnabled={aiSummariesEnabled}
            />
          ))
        )}
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
        </> // Closing fragment for standard feed UI
      )}
      {/* The BetaUIView is now rendered above based on showBetaUI state */}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}
