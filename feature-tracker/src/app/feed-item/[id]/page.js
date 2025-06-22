'use client'

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
// typeDisplayNameMap will be used by FeedCard, which imports it from @/app/consts
// Autolinker and DOMPurify are used by FeedCard
import FeedCard from '@/components/FeedCard'; // Import the FeedCard component
import BetaUIView from '@/components/BetaUIView'; // Corrected import path
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlagEnabled } from 'posthog-js/react';

function FeedItemDetailContent() {
  const params = useParams();
  const [activeUITab, setActiveUITab] = useState("standard"); // 'standard' or 'beta'
  const betaUiFeatureEnabled = useFeatureFlagEnabled('beta-ui'); // PostHog feature flag
  const aiSummariesEnabled = true; // Assuming this is globally enabled for consistency
  const { id } = params;
  const [feedItem, setFeedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeedItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/db/getFeedItem?id=${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFeedItem(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setFeedItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFeedItem();
  }, [fetchFeedItem]);

  if (loading) return <div className="flex justify-center items-center min-h-screen"><p>Loading feed item details...</p></div>;
  if (error) return <div className="flex justify-center items-center min-h-screen"><p>Error loading feed item: {error}</p></div>;
  if (!feedItem) return <div className="flex justify-center items-center min-h-screen"><p>Feed item not found.</p></div>;

  // const typeDisplayName = typeDisplayNameMap[feedItem.type] || feedItem.type; // This logic is now within FeedCard

  return (
    <div className="container mx-auto p-4">
      {(!betaUiFeatureEnabled || activeUITab === "standard") && (
        <div className="flex flex-col items-center"> {/* Centering container for the card */}
          <div className="w-full md:w-3/4 lg:w-2/3 max-w-4xl"> {/* Responsive width container */}
            <FeedCard
              update={feedItem}
              lastSeenHighestId={feedItem.id} // Pass feedItem.id to ensure "New" badge doesn't show
              aiSummariesEnabled={aiSummariesEnabled}
              isDetailView={true} // Indicate this is the detail view
            />
          </div>
        </div>
      )}

      {betaUiFeatureEnabled && activeUITab === "beta" && (
        <BetaUIView />
      )}
    </div>
  );
}

export default function FeedItemDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><p>Loading page information...</p></div>}>
      <FeedItemDetailContent />
    </Suspense>
  );
}
