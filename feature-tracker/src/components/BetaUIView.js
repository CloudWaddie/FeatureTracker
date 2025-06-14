// src/components/BetaUIView.js
'use client';
import { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import Link from 'next/link';
// Card, CardHeader, etc. are now part of FeedCard
import FeedCard from '@/components/FeedCard'; // Import the FeedCard component
import { typeDisplayNameMap, categoryDisplayNameMap } from '@/app/consts'; // For displaying item types and category names

export default function BetaUIView() {
  const aiSummariesEnabled = true; // Assuming this is globally enabled for consistency
  const [groupingConfig, setGroupingConfig] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [feedItems, setFeedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false); // For loading items in content area
  const [loadingConfig, setLoadingConfig] = useState(true); // For loading grouping config
  const [lastSeenIdsPerType, setLastSeenIdsPerType] = useState({});
  const [latestItemIdsFromApi, setLatestItemIdsFromApi] = useState({}); // To store results from /api/db/getLatestItemIdsPerType
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const previousSelectedCategoryRef = useRef(null); // Ref to store the previous category

  // Fetch grouping config
  useEffect(() => {
    setLoadingConfig(true);
    fetch('/api/grouping')
      .then(res => res.json())
      .then(data => {
        setGroupingConfig(data);
        if (data && Object.keys(data).length > 0) {
          // Automatically select the first category
          const firstCategory = Object.keys(data)[0];
          setSelectedCategory(firstCategory);
        }
        setLoadingConfig(false);
      })
      .catch(err => {
        console.error("Error fetching grouping config:", err);
        setLoadingConfig(false);
      });
  }, []);

  // Load lastSeenIdsPerType from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('lastSeenIdsPerType');
    if (stored) {
      try {
        setLastSeenIdsPerType(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing lastSeenIdsPerType from localStorage:", e);
        setLastSeenIdsPerType({});
      }
    }
  }, []);

  // Fetch latest item IDs for all types (for dot indicator logic)
  useEffect(() => {
    // This endpoint needs to be created (Phase 3, Step 4, Option B)
    fetch('/api/db/getLatestItemIdsPerType') 
      .then(res => res.json())
      .then(data => {
        setLatestItemIdsFromApi(data);
      })
      .catch(err => {
        console.error("Error fetching latest item IDs per type:", err);
      });
  }, []);


  // Fetch feed items based on selectedCategory
  useEffect(() => {
    if (!selectedCategory || !groupingConfig || !groupingConfig[selectedCategory]) {
      setFeedItems([]);
      return;
    }

    const typesForCategory = groupingConfig[selectedCategory];
    if (!typesForCategory || typesForCategory.length === 0) {
      setFeedItems([]);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);
    const typesQueryParam = typesForCategory.join(',');
    // This API endpoint /api/db/getFeed needs to be enhanced to accept a 'types' parameter
    fetch(`/api/db/getFeed?types=${typesQueryParam}&page=1`) // Assuming page 1 for now, and all items for selected types
      .then(res => res.json())
      .then(data => {
        // Assuming data is an array of items. If it's an object with a 'feed' property: data.feed
        setFeedItems(Array.isArray(data) ? data : (data.feed || []));
        setLoadingItems(false);
      })
      .catch(err => {
        console.error("Error fetching feed items for category:", selectedCategory, err);
        setFeedItems([]);
        setLoadingItems(false);
      });
  }, [selectedCategory, groupingConfig]);

  // Update localStorage when lastSeenIdsPerType changes
  useEffect(() => {
    if (Object.keys(lastSeenIdsPerType).length > 0) { // Avoid writing empty object on initial load if nothing was in localStorage
        localStorage.setItem('lastSeenIdsPerType', JSON.stringify(lastSeenIdsPerType));
    }
  }, [lastSeenIdsPerType]);

  // Effect to mark items of the *previous* category as seen when selectedCategory changes
  useEffect(() => {
    const previousCategory = previousSelectedCategoryRef.current;

    if (previousCategory && previousCategory !== selectedCategory) {
      if (groupingConfig && groupingConfig[previousCategory] && latestItemIdsFromApi) {
        const typesInPreviousCategory = groupingConfig[previousCategory];
        const newLastSeenIds = { ...lastSeenIdsPerType };
        let changed = false;

        typesInPreviousCategory.forEach(type => {
          if (latestItemIdsFromApi[type] && (newLastSeenIds[type] !== latestItemIdsFromApi[type])) {
            newLastSeenIds[type] = latestItemIdsFromApi[type]; // Update to the true latest ID
            changed = true;
          }
        });

        if (changed) {
          setLastSeenIdsPerType(newLastSeenIds);
        }
      }
    }
    // Update the ref to the current selected category for the next run
    previousSelectedCategoryRef.current = selectedCategory;
  }, [selectedCategory, groupingConfig, latestItemIdsFromApi, lastSeenIdsPerType, setLastSeenIdsPerType]);
  
  const handleCategorySelect = (category) => {
    setSelectedCategory(category); // This will trigger the useEffect above to handle marking previous category's items as seen
    if (window.innerWidth < 768) { // md breakpoint in Tailwind
      setIsSidebarOpen(false); // Close sidebar on mobile after selection
    }
    // The logic to immediately mark items as seen has been moved to the useEffect above.
  };

  const hasNewItems = useCallback((categoryName) => {
    if (loadingConfig || !groupingConfig || !groupingConfig[categoryName] || Object.keys(latestItemIdsFromApi).length === 0) {
      return false;
    }
    const typesInCategory = groupingConfig[categoryName];
    for (const type of typesInCategory) {
      const latestIdForType = latestItemIdsFromApi[type] || 0;
      const lastSeenIdForType = lastSeenIdsPerType[type] || 0;
      if (latestIdForType > lastSeenIdForType) {
        return true; // Found a new item for this type
      }
    }
    return false;
  }, [groupingConfig, latestItemIdsFromApi, lastSeenIdsPerType, loadingConfig]);

  if (loadingConfig || !groupingConfig) {
    return <p className="text-center p-4">Loading configuration...</p>;
  }

  return (
    <div className="relative flex h-[calc(100vh-150px)] bg-background rounded-lg overflow-hidden"> {/* Added rounded-lg and overflow-hidden, relative for absolute sidebar */}
      {/* Hamburger Menu Button - visible only on small screens when sidebar is closed */}
      <button 
        onClick={() => setIsSidebarOpen(true)} 
        className={`${isSidebarOpen ? 'hidden' : 'block'} md:hidden p-2 m-2 absolute top-0 left-0 z-30 bg-primary text-primary-foreground rounded-md`}
        aria-label="Open sidebar"
      >
        {/* Simple hamburger icon */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Sidebar */}
      {/* Base classes for sidebar, conditional classes for mobile toggle */}
      <div 
        className={`
          ${isSidebarOpen ? 'block' : 'hidden'} md:block 
          absolute md:relative z-20 md:z-auto /* Adjusted z-index */
          w-64 h-full md:h-auto 
          bg-muted border-r border-border 
          p-4 overflow-y-auto 
          transition-transform duration-300 ease-in-out 
          md:translate-x-0 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          rounded-r-lg md:rounded-r-none md:rounded-l-lg 
        `}
      >
        {/* Close button inside sidebar for mobile */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground z-30" /* Ensure button is clickable */
          aria-label="Close sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold mb-4 mt-10 md:mt-0">Categories</h2> 
        <ul>
          {Object.keys(groupingConfig).map(categoryName => (
            <li 
              key={categoryName} 
              onClick={() => handleCategorySelect(categoryName)} 
              className={`p-2 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground ${selectedCategory === categoryName ? 'bg-primary text-primary-foreground font-semibold' : ''} flex items-center justify-between mb-1`}
            >
              <span>{categoryDisplayNameMap[categoryName] || categoryName}</span>
              {hasNewItems(categoryName) && (
                <span className="w-2.5 h-2.5 bg-white rounded-full ml-2"></span> 
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Content Area */}
      {/* Adjusted margin for mobile when sidebar can be open */}
      <div className={`flex-1 p-6 overflow-y-auto transition-all duration-300 ease-in-out rounded-r-lg md:rounded-l-none ${isSidebarOpen && window.innerWidth < 768 ? 'ml-0' : 'ml-0 md:ml-0'}`}>
        {selectedCategory ? (
          <>
            {loadingItems && <p className="text-center">Loading items...</p>}
            {!loadingItems && feedItems.length === 0 && <p className="text-center text-muted-foreground">No items to display for this category.</p>}
            
            {!loadingItems && feedItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {feedItems.map(item => (
                  <FeedCard
                    key={item.id}
                    update={item}
                    // Pass the actual last seen ID for this item's type
                    lastSeenHighestId={lastSeenIdsPerType[item.type] || 0} 
                    aiSummariesEnabled={aiSummariesEnabled}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-muted-foreground mt-10">Select a category to view items.</p>
        )}
      </div>
    </div>
  );
}
