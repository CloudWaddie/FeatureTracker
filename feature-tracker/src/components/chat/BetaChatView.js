// src/components/chat/BetaChatView.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"; // Assuming these are used for item display
import { typeDisplayNameMap, categoryDisplayNameMap } from '@/app/consts'; // For displaying item types and category names

export default function BetaChatView() {
  const [groupingConfig, setGroupingConfig] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [feedItems, setFeedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false); // For loading items in content area
  const [loadingConfig, setLoadingConfig] = useState(true); // For loading grouping config
  const [lastSeenIdsPerType, setLastSeenIdsPerType] = useState({});
  const [latestItemIdsFromApi, setLatestItemIdsFromApi] = useState({}); // To store results from /api/db/getLatestItemIdsPerType

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
  
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    // Mark items in this category as seen by updating lastSeenIdsPerType
    if (groupingConfig && groupingConfig[category] && latestItemIdsFromApi) {
      const typesInClickedCategory = groupingConfig[category];
      const newLastSeenIds = { ...lastSeenIdsPerType };
      let changed = false;
  
      typesInClickedCategory.forEach(type => {
        if (latestItemIdsFromApi[type] && (newLastSeenIds[type] !== latestItemIdsFromApi[type])) {
           newLastSeenIds[type] = latestItemIdsFromApi[type]; // Update to the true latest ID from API
           changed = true;
        }
      });
  
      if (changed) {
        setLastSeenIdsPerType(newLastSeenIds);
      }
    }
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
    <div className="flex h-[calc(100vh-150px)] bg-background"> {/* Adjust height as needed, consider header/nav height */}
      {/* Sidebar */}
      <div className="w-64 border-r border-border p-4 overflow-y-auto bg-muted/40">
        <h2 className="text-lg font-semibold mb-4">Categories</h2>
        <ul>
          {Object.keys(groupingConfig).map(categoryName => (
            <li 
              key={categoryName} 
              onClick={() => handleCategorySelect(categoryName)} 
              className={`p-2 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground ${selectedCategory === categoryName ? 'bg-primary text-primary-foreground font-semibold' : ''} flex items-center justify-between mb-1`}
            >
              <span>{categoryDisplayNameMap[categoryName] || categoryName}</span>
              {hasNewItems(categoryName) && (
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full ml-2 border-2 border-background"></span> 
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedCategory ? (
          <>
            <h3 className="text-2xl font-bold mb-6">{groupingConfig[selectedCategory] ? (categoryDisplayNameMap[selectedCategory] || selectedCategory) : 'Unknown Category'}</h3>
            {loadingItems && <p className="text-center">Loading items...</p>}
            {!loadingItems && feedItems.length === 0 && <p className="text-center text-muted-foreground">No items to display for this category.</p>}
            
            {!loadingItems && feedItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {feedItems.map(item => {
                  const typeDisplayName = typeDisplayNameMap[item.type] || item.type;
                  return (
                    <Card key={item.id} className="flex flex-col">
                      <CardHeader>
                        <Link href={`/feed-item/${item.id}`} passHref>
                          <CardTitle className="cursor-pointer hover:underline">{typeDisplayName}</CardTitle>
                        </Link>
                        <p className="text-sm text-muted-foreground">{item.appId}</p>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {item.details.length > 150 ? `${item.details.substring(0, 150)}...` : item.details}
                          {item.details.length > 150 && (
                            <Link href={`/feed-item/${item.id}`} passHref>
                              <span className="text-blue-500 hover:underline cursor-pointer ml-1">Show more</span>
                            </Link>
                          )}
                        </p>
                      </CardContent>
                      <CardFooter>
                        <p className='text-xs text-muted-foreground'>{new Date(item.date).toLocaleString()}</p>
                      </CardFooter>
                    </Card> 
                  );
                })}
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
