'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { SparkleButton } from "@/components/ui/sparkle-button";
import { Autolinker } from 'autolinker';
import DOMPurify from 'dompurify';
import { FEED_ITEM_SUMMARY_LENGTH, typeDisplayNameMap } from '@/app/consts'; // Assuming consts are accessible here

export default function FeedCard({ update, lastSeenHighestId, aiSummariesEnabled, isDetailView = false }) {
  if (!update) return null;

  const typeDisplayName = typeDisplayNameMap[update.type] || update.type;
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
        {isDetailView ? (
          // Detail View: Show full content without truncation
          update.type === 'strings' ? (
            update.details.split('\n').map((line, index) => {
              let style = { whiteSpace: 'pre-wrap' }; // Ensure pre-wrap for newlines
              if (line.startsWith('+')) style.color = 'green';
              else if (line.startsWith('-')) style.color = 'red';
              const linkedContent = Autolinker.link(line, {
                newWindow: true,
                className: 'text-blue-500 hover:underline',
                truncate: { length: 50, location: 'smart' } // Keep autolinker truncation for long URLs
              });
              return <div key={index} style={style} className="break-words" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(linkedContent) }} />;
            })
          ) : (
            <div className="break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(Autolinker.link(update.details, { newWindow: true, className: 'text-blue-500 hover:underline', truncate: { length: 50, location: 'smart' }})) }} />
          )
        ) : (
          // Standard View: Existing truncation logic
          update.type === 'strings' ? (() => {
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
          )
        )}
      </CardContent>
      <CardFooter>
        <p className='text-muted-foreground text-sm'>{new Date(update.date).toLocaleString()}</p>
      </CardFooter>
    </Card>
  );
}
