'use client'

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BetaChatView from '@/components/chat/BetaChatView'; // Import BetaChatView
import { typeDisplayNameMap, FEED_ITEM_SUMMARY_LENGTH } from './consts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { Badge } from '@/components/ui/badge';
import { Autolinker } from 'autolinker';
import DOMPurify from 'dompurify';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { SparkleButton } from "@/components/ui/sparkle-button";
import { useFeatureFlagEnabled } from 'posthog-js/react'

// Placeholder for BetaChatView until it's created
// const BetaChatView = () => <div>Beta Chat UI Placeholder</div>; 

function PageContent() {
  const [activeUITab, setActiveUITab] = useState("standard"); // 'standard' or 'beta'
  const betaUiFeatureEnabled = useFeatureFlagEnabled('beta-ui'); // PostHog feature flag

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
      {betaUiFeatureEnabled && (
        <Tabs value={activeUITab} onValueChange={setActiveUITab} className="mb-4">
          <TabsList>
            <TabsTrigger value="standard">Standard Feed</TabsTrigger>
            <TabsTrigger value="beta">Beta Chat UI</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {(!betaUiFeatureEnabled || activeUITab === "standard") && (
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
          updates.filter(update => !update.isHidden).map((update) => { // Original filter for isHidden is kept client-side for now
            const typeDisplayName = typeDisplayNameMap[update.type] || update.type;
            // Show badge if: no stored value (first time) OR item ID is higher than stored value
            const isNewItem = lastSeenHighestId === null || update.id > lastSeenHighestId;
            return (
              <Card key={update.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Link href={`/feed-item/${update.id}`} passHref>
                      <CardTitle className="cursor-pointer hover:underline">{typeDisplayName}</CardTitle>
                    </Link>
                    <div className="flex items-center gap-2">
                      {aiSummariesEnabled && (
                        <SparkleButton 
                          summary={update.summary} 
                          itemType={typeDisplayName}
                          itemId={update.id}
                        />
                      )}
                      {isNewItem && (
                        <Badge variant="default">
                          New
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{update.appId}</CardDescription>
                </CardHeader>
                <CardContent>
                  {update.type === 'strings' ? (() => {
                    const details = update.details;
                    const lines = details.split('\n');
                    let contentToShow = [];
                    let needsTruncationLink = false;
                    const isLong = details.length > FEED_ITEM_SUMMARY_LENGTH;

                    if (isLong) {
                      needsTruncationLink = true;
                      let accumulatedChars = 0;
                      for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const lineLengthWithPotentialNewline = line.length + (i < lines.length - 1 ? 1 : 0);

                        if (accumulatedChars + lineLengthWithPotentialNewline <= FEED_ITEM_SUMMARY_LENGTH) {
                          contentToShow.push(line);
                          accumulatedChars += lineLengthWithPotentialNewline;
                        } else {
                          const remainingChars = FEED_ITEM_SUMMARY_LENGTH - accumulatedChars;
                          if (remainingChars > 0) {
                            contentToShow.push(line.substring(0, remainingChars) + "...");
                          } else if (contentToShow.length > 0 && !contentToShow[contentToShow.length - 1].endsWith("...")) {
                             contentToShow[contentToShow.length - 1] = contentToShow[contentToShow.length - 1] + "...";
                          } else if (contentToShow.length === 0) { 
                              contentToShow.push(line.substring(0, FEED_ITEM_SUMMARY_LENGTH) + "...");
                          }
                          break;
                        }
                      }
                    } else {
                      contentToShow = lines;
                    }

                    return (
                      <>
                        {contentToShow.map((lineContent, idx) => {
                          const originalLineForStyle = lines[idx] || "";
                          let style = {};
                          if (originalLineForStyle.startsWith('+')) style.color = 'green';
                          else if (originalLineForStyle.startsWith('-')) style.color = 'red';
                          const linkedContent = Autolinker.link(lineContent, {
                            newWindow: true,
                            className: 'text-blue-500 hover:underline',
                            truncate: { length: 50, location: 'smart' }
                          });
                          return <div key={idx} style={style} className="break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(linkedContent) }} />;
                        })}
                        {needsTruncationLink && (
                          <Link href={`/feed-item/${update.id}`} passHref>
                            <span className="text-gray-500 hover:underline cursor-pointer">Show more...</span>
                          </Link>
                        )}
                      </>
                    );
                  })() : (
                    // Original logic for non-'strings' type
                    update.details.length > FEED_ITEM_SUMMARY_LENGTH ? (
                      <>
                        <div className="break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(Autolinker.link(update.details.substring(0, FEED_ITEM_SUMMARY_LENGTH) + "...", { newWindow: true, className: 'text-blue-500 hover:underline', truncate: { length: 50, location: 'smart' }})) }} />
                        <Link href={`/feed-item/${update.id}`} passHref>
                          <span className="text-gray-500 hover:underline cursor-pointer">Show more...</span>
                        </Link>
                      </>
                    ) : (
                      <div className="break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(Autolinker.link(update.details, { newWindow: true, className: 'text-blue-500 hover:underline', truncate: { length: 50, location: 'smart' }})) }} />
                    )
                  )}
                </CardContent>
                <CardFooter>
                  <p className='text-muted-foreground text-sm'>{new Date(update.date).toLocaleString()}</p>
                </CardFooter>
              </Card> 
            );
          })
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

      {betaUiFeatureEnabled && activeUITab === "beta" && (
        <BetaChatView />
      )}
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
