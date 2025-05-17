import Parser from "rss-parser";
import fs from "fs";
import { cwd } from "process";
import { updateFeed, updateOldFeeds, updateNewFeeds, clearNewFeedsByURL, clearOldFeedsByURL, findAdditionsFeeds, findDeletionsFeeds } from '../../../../utils/db.js';
import { clear } from "console";

export default async function feedController() {
    const configPath = `${cwd()}/src/utils/tasks/web/feeds/config.txt`;
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const lines = fileContent.split("\n");
    const feedURLS = [];

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
            console.warn(`URL "${trimmedLine}" is not (likely to be) a valid URL in ${configPath}. Ignoring.`);
        }
    }
    // --- End of parsing logic ---
    let parser = new Parser();
    for (const url of feedURLS) {
        let feed = [];
        try {
            feed = await parser.parseURL(url);
            console.log(`Fetched feed from ${url}`);
        } catch (error) {
            console.error(`Error fetching feed from ${url}:`, error);
            continue;
        }
        await clearNewFeedsByURL(feed.link);
        await updateNewFeeds(feed);
        const additions = await findAdditionsFeeds(feed.link);
        const deletions = await findDeletionsFeeds(feed.link);
        await clearOldFeedsByURL(feed.link);
        await updateOldFeeds(feed);
        if (additions.length === 0 && deletions.length === 0) {
            console.log(`No changes detected for ${url}`);
            continue;
        }
        else {
            const readableAdditions = additions.map(item => item.url).join(', ');
            const readableDeletions = deletions.map(item => item.url).join(', ');
            const dataToAddToFeed = {
                type: 'rssFeed',
                details: `Additions: ${readableAdditions}, Deletions: ${readableDeletions}`,
                appId: feed.link,
                date: new Date().toISOString(),
            };
            await updateFeed(dataToAddToFeed);
        }
    }
    // Add your feed-related tasks here
    console.log("Feed tasks are running...");
    return "Feed tasks are running...";
}