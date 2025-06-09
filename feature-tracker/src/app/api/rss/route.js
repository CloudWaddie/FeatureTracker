import RSS from 'rss';
import { getFeed } from "@/utils/db";
import { NextResponse } from "next/server";
import { typeDisplayNameMap } from '@/app/consts';
import logger from "@/lib/logger";
import { FEED_ITEM_SUMMARY_LENGTH } from '@/app/consts';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupTypeParam = searchParams.get('type');
    const prefixParam = searchParams.get('prefix');

    const domain = process.env.DOMAIN || 'http://localhost:3000';
    let feedUrl = `${domain}/api/rss`;
    const queryParams = [];
    if (groupTypeParam) {
      queryParams.push(`type=${groupTypeParam}`);
    }
    if (prefixParam) {
      queryParams.push(`prefix=${prefixParam}`);
    }
    if (queryParams.length > 0) {
      feedUrl += `?${queryParams.join('&')}`;
    }
    const siteUrl = domain;

    let feedFilterTypes = null;
    let feedTitle = "Feature Tracker";
    let feedDescription = "Realtime tracking of features added to AI apps";

    if (groupTypeParam) {
      try {
        const groupsFilePath = path.join(process.cwd(), 'src', 'config', 'rssFeedGroups.json');
        const groupsFileContent = await fs.readFile(groupsFilePath, 'utf-8');
        const rssFeedGroups = JSON.parse(groupsFileContent);
        
        if (rssFeedGroups[groupTypeParam]) {
          feedFilterTypes = rssFeedGroups[groupTypeParam];
          feedTitle = `Feature Tracker - ${groupTypeParam.charAt(0).toUpperCase() + groupTypeParam.slice(1)} Updates`;
          feedDescription = `Realtime tracking of ${groupTypeParam} features added to AI apps`;
        } else {
          logger.warn(`RSS feed group type "${groupTypeParam}" not found. Serving all items.`);
        }
      } catch (err) {
        logger.error("Error reading or parsing rssFeedGroups.json:", err);
        // Fallback to serving all items if config is missing or malformed
      }
    }

    const feed = new RSS({
      title: feedTitle,
      description: feedDescription,
      feed_url: feedUrl,
      site_url: siteUrl,
      language: 'en',
      pubDate: new Date().toISOString(),
      ttl: 15, 
    });

    // Pass page 1, showHidden false, no searchQuery, and the determined filterType(s)
    const updates = await getFeed(1, false, null, feedFilterTypes);

    updates.forEach(update => {
      const typeDisplayName = typeDisplayNameMap[update.type] || update.type;
      const itemTitle = `${typeDisplayName}: ${update.appId}`;
      let itemDescription = update.details.length > FEED_ITEM_SUMMARY_LENGTH ? (update.summary || update.details) : update.details;

      if (prefixParam) {
        itemDescription = `${prefixParam}\n${itemDescription}`;
      }
      
      feed.item({
        title: itemTitle,
        description: itemDescription,
        url: `${siteUrl}/feed-item/${update.id}`,
        guid: update.id.toString(),
        date: new Date(update.date).toISOString(),
        author: update.appId,
      });
    });

    const xml = feed.xml({ indent: true });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });

  } catch (error) {
    logger.error("Error generating RSS feed:", error);
    return new NextResponse("Error generating RSS feed", { status: 500 });
  }
}
