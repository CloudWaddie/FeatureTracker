import Sitemapper from 'sitemapper';
import fs from "fs";
import { cwd } from "process";
import { updateNewSitemaps, clearNewSitemapsByURL, findAdditionsSitemaps, updateOldSitemaps, updateFeed } from '../../../../utils/db.js';
import logger from '../../../../lib/logger.js';

export default async function sitemapController() {
    const configPath = `${cwd()}/src/utils/tasks/web/sitemaps/config.txt`;
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const lines = fileContent.split("\n");
    let sitemapUrls = [];

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
            logger.warn(`URL "${trimmedLine}" is not (likely to be) a valid URL in ${configPath}. Ignoring.`);
        }
    }
    // Ensure sitemapUrls are unique
    sitemapUrls = [...new Set(sitemapUrls)];
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
        let actualSitemapUrl = url; // Initialize with the loop url
        try {
            const sitemapObject = await sitemapper.fetch(url); // Renamed to avoid confusion

            if (sitemapObject && typeof sitemapObject.url === 'string') {
                actualSitemapUrl = sitemapObject.url; // Use URL from fetched object if available and it's a string
            }

            // Ensure sites are unique by URL (loc)
            if (sitemapObject && Array.isArray(sitemapObject.sites)) {
                const uniqueSitesMap = new Map();
                sitemapObject.sites.forEach(site => {
                    if (site && site.loc) {
                        uniqueSitesMap.set(site.loc, site);
                    }
                });
                sites = Array.from(uniqueSitesMap.values());
            } else if (Array.isArray(sitemapObject)) { // Fallback if sitemapObject is directly an array
                const uniqueSitesMap = new Map();
                sitemapObject.forEach(site => {
                    if (site && site.loc) {
                        uniqueSitesMap.set(site.loc, site);
                    }
                });
                sites = Array.from(uniqueSitesMap.values());
            } else {
                sites = []; // Or handle as an error/empty case
            }
            logger.info(`Fetched and deduplicated sitemap from ${url}. Original count: ${sitemapObject && sitemapObject.sites ? sitemapObject.sites.length : (Array.isArray(sitemapObject) ? sitemapObject.length : 0)}, Unique count: ${sites.length}. Effective URL: ${actualSitemapUrl}`);
        } catch (error) {
            logger.error({ err: error, url }, `Error fetching sitemap from ${url}`);
            continue;
        }

        // Use actualSitemapUrl for all DB operations related to this sitemap
        // 1. Clear temporary storage for the current scan's results
        await clearNewSitemapsByURL(actualSitemapUrl);
        // 2. Store current scan's results into temporary storage
        await updateNewSitemaps({ sites: sites, url: actualSitemapUrl });
        // 3. Find additions by comparing temporary storage with persistent historical storage
        const additions = await findAdditionsSitemaps(actualSitemapUrl);
        // 4. Merge current scan's results into the persistent historical sitemap storage
        //    (updateOldSitemaps now uses INSERT OR IGNORE for cumulative storage)
        await updateOldSitemaps({ sites: sites, url: actualSitemapUrl });

        if (additions.length === 0) {
            logger.info(`No new additions detected for ${actualSitemapUrl}`);
            continue;
        }
        else {
            logger.info({ additions, url: actualSitemapUrl }, `New additions for ${actualSitemapUrl}`);
            const readableAdditions = additions.map(item => item.url).join(', '); // item.url refers to db schema
            // Feed details will only contain additions.
            // Consider if it's the first run (e.g. by checking if historical data existed before updateOldSitemaps)
            // For now, we'll assume findAdditionsSitemaps correctly identifies items as "new" on the first scan.
            let feedDetailString = `New sitemap entries: ${readableAdditions}`;
            // A more sophisticated check for "Initial scan" might involve checking if 'old' data existed prior to this run.
            // However, if findAdditionsSitemaps returns all items on first scan, this is sufficient.

            const dataToAddToFeed = {
                type: 'sitemap',
                details: feedDetailString,
                appId: actualSitemapUrl, // Use actualSitemapUrl for consistency
            };
            logger.debug({actualSitemapUrl, dataToAddToFeed}, `Data to add to feed for ${actualSitemapUrl}`);
            await updateFeed(dataToAddToFeed);
        }
    }
    return "Sitemap web controller is running...";
}
