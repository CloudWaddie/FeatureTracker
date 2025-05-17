import Sitemapper from 'sitemapper';
import fs from "fs";
import { cwd } from "process";
import { updateNewSitemaps, clearNewSitemapsByURL, findAdditionsSitemaps, findDeletionsSitemaps, clearOldSitemapsByURL, updateOldSitemaps, updateFeed } from '../../../../utils/db.js';

export default async function sitemapController() {
    const configPath = `${cwd()}/src/utils/tasks/web/sitemaps/config.txt`;
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const lines = fileContent.split("\n");
    const sitemapUrls = [];

    // --- Parsing logic remains the same ---
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === "" || trimmedLine.startsWith('#')) {
            continue;
        }
        // --- Add URLs to the sitemapUrls array ---
        if (trimmedLine.startsWith('http') && trimmedLine.endsWith('.xml')) {
            sitemapUrls.push(trimmedLine);
        } else {
            console.warn(`URL "${trimmedLine}" is not (likely to be) a valid URL in ${configPath}. Ignoring.`);
        }
    }
    // --- End of parsing logic ---

    // --- Fetching sitemaps ---
    const sitemapper = new Sitemapper({
        fields: {
        loc: true,
        lastmod: true,
      }
    });
    for (const url of sitemapUrls) {
        let sites = [];
        try {
            const sitemap = await sitemapper.fetch(url);
            sites = sitemap;
            console.log(`Fetched sitemap from ${url}`);
        } catch (error) {
            console.error(`Error fetching sitemap from ${url}:`, error);
            continue;
        }
        await clearNewSitemapsByURL(url);
        await updateNewSitemaps(sites);
        const additions = await findAdditionsSitemaps(url);
        const deletions = await findDeletionsSitemaps(url);
        await clearOldSitemapsByURL(url);
        await updateOldSitemaps(sites);
        if (additions.length === 0 && deletions.length === 0) {
            console.log(`No changes detected for ${url}`);
            continue;
        }
        else {
            console.log(`Additions for ${url}:`, additions);
            console.log(`Deletions for ${url}:`, deletions);
            const readableAdditions = additions.map(item => item.url).join(', ');
            const readableDeletions = deletions.map(item => item.url).join(', ');
            const dataToAddToFeed = {
                type: 'sitemap',
                details: `Additions: ${readableAdditions}, Deletions: ${readableDeletions}`,
                appId: url,
                date: new Date().toISOString(),
            };
            //console.log(`Data to add to feed for ${url}:`, dataToAddToFeed);
            await updateFeed(dataToAddToFeed);
        }
    }
    return "Sitemap web controller is running...";
}
