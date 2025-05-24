'use client'

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { typeDisplayNameMap } from '../../consts'; // Adjusted path
import { Autolinker } from 'autolinker';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function FeedItemDetailContent() {
  const params = useParams();
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
      console.error("Fetching feed item failed:", err);
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

  const typeDisplayName = typeDisplayNameMap[feedItem.type] || feedItem.type;

  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col justify-center items-center">
      <Card className="w-full md:w-3/4 lg:w-2/3 max-w-4xl mx-auto"> {/* Responsive card with proportional and max width */}
        <CardHeader>
          <CardTitle>{typeDisplayName}</CardTitle>
          <CardDescription>{feedItem.appId}</CardDescription>
        </CardHeader>
        <CardContent>
          {feedItem.type === 'strings' ? (
            feedItem.details.split('\n').map((line, index) => {
              let style = { whiteSpace: 'pre-wrap' };
              if (line.startsWith('+')) {
                style.color = 'green';
              } else if (line.startsWith('-')) {
                style.color = 'red';
              }
              const linkedContent = Autolinker.link(line, {
                newWindow: true,
                className: 'text-blue-500 hover:underline',
                truncate: { length: 50, location: 'smart' }
              });
              return <div key={index} style={style} dangerouslySetInnerHTML={{ __html: linkedContent }} />;
            })
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: Autolinker.link(feedItem.details, { newWindow: true, className: 'text-blue-500 hover:underline', truncate: { length: 50, location: 'smart' }}) }} />
          )}
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground text-sm'>{new Date(feedItem.date).toLocaleString()}</p>
        </CardFooter>
      </Card>
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
