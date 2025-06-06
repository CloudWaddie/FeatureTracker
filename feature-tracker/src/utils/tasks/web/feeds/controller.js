import Parser from "rss-parser";
import fs from "fs";
import { cwd } from "process";
import { updateFeed, updateOldFeeds, updateNewFeeds, clearNewFeedsByURL, findAdditionsFeeds } from '../../../../utils/db.js';
import logger from '../../../../lib/logger.js';

export default async function feedController() {
    const configPath = `${cwd()}/src/utils/tasks/web/feeds/config.txt`;
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const lines = fileContent.split("\n");
    let feedURLS = [];

    // --- Parsing logic remains the same ---
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === "" || trimmedLine.startsWith('#')) {
            continue;
        }
        // --- Add URLs to the feedURLS array ---
        if (trimmedLine.startsWith('http')) {
            feedURLS.push(trimmedLine);
        } else {
            logger.warn(`URL "${trimmedLine}" is not (likely to be) a valid URL in ${configPath}. Ignoring.`);
        }
    }
    // Ensure feedURLS are unique
    feedURLS = [...new Set(feedURLS)];
    // --- End of parsing logic ---
    let parser = new Parser();
    for (const url of feedURLS) {
        let feedItems = [];
        let feedLink = url; // Default to URL if feed.link is not available
        try {
            const parsedFeed = await parser.parseURL(url);
            if (parsedFeed && parsedFeed.items) {
                feedLink = parsedFeed.link || url; // Use parsed feed link if available
                // Ensure feed items are unique by link or guid
                const uniqueItemsMap = new Map();
                parsedFeed.items.forEach(item => {
                    const key = item.link || item.guid || item.title; // Use link, then guid, then title as key
                    if (key && !uniqueItemsMap.has(key)) {
                        uniqueItemsMap.set(key, item);
                    }
                });
                feedItems = Array.from(uniqueItemsMap.values());
            }
            logger.info(`Fetched and deduplicated feed from ${url}. Original count: ${parsedFeed.items ? parsedFeed.items.length : 0}, Unique count: ${feedItems.length}`);
        } catch (error) {
            logger.error({ err: error, url }, `Error fetching feed from ${url}`);
            continue;
        }
        if (!feedItems || feedItems.length === 0) {
            logger.error({ url }, `No items found or processed in the feed from ${url}`);
            continue;
        }
        // Construct a feed object compatible with downstream functions
        const feedDataForDB = {
            link: feedLink,
            items: feedItems
        };
        await clearNewFeedsByURL(feedLink);
        await updateNewFeeds(feedDataForDB);
        // findAdditionsFeeds compares against the persistent historical list
        const additions = await findAdditionsFeeds(feedLink);
        // updateOldFeeds now uses INSERT OR IGNORE for cumulative storage
        await updateOldFeeds(feedDataForDB);

        if (additions.length === 0) {
            logger.info(`No new feed items detected for ${url}`);
            continue;
        }
        else {
            const readableAdditions = additions.map(item => item.url || item.link || item.title).join('; '); // Using semicolon for better readability if titles have commas
            // Feed details will only contain additions.
            // Similar to sitemaps, assuming findAdditionsFeeds handles "new" on first scan correctly.
            let feedDetailString = `New feed items: ${readableAdditions}`;

            const dataToAddToFeed = {
                type: 'rssFeed',
                details: feedDetailString,
                appId: feedLink,
            };
            try {
                await updateFeed(dataToAddToFeed);
                logger.info({ feedLink, details: feedDetailString }, `Successfully updated feed for ${feedLink}`);
            } catch (error) {
                logger.error({ err: error, url }, `Error updating feed for ${url}`);
            }
        }
    }
    // Add your feed-related tasks here
    logger.info("Feed tasks are running...");
    return "Feed tasks are running...";
}
