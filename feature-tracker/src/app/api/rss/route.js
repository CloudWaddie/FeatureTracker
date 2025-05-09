import RSS from 'rss';
import { getFeed } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const domain = process.env.DOMAIN || 'http://localhost:3000'; // Fallback for local dev if DOMAIN is not set
    const feedUrl = `${domain}/api/rss`;
    const siteUrl = domain;

    const feed = new RSS({
      title: "Feature Tracker",
      description: "Realtime tracking of features added to AI apps",
      feed_url: feedUrl,
      site_url: siteUrl,
      language: 'en',
      pubDate: new Date().toISOString(),
      ttl: 15, // Time to live in minutes lowered to make some rss services update faster
    });

    const updates = await getFeed();

    const typeDisplayNameMap = {
      'strings': 'New strings added',
      'appversion': 'New app version',
    };

    updates.forEach(update => {
      const typeDisplayName = typeDisplayNameMap[update.type] || update.type;
      const itemTitle = `${typeDisplayName}: ${update.appId}`;
      
      feed.item({
        title: itemTitle,
        description: update.details,
        url: `${siteUrl}/#update-${update.id}`,
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
    console.error("Error generating RSS feed:", error);
    return new NextResponse("Error generating RSS feed", { status: 500 });
  }
}
