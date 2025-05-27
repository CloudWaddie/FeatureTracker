import Sitemapper from 'sitemapper';
import fs from "fs";
import { cwd } from "process";
import { updateNewSitemaps, clearNewSitemapsByURL, findAdditionsSitemaps, findDeletionsSitemaps, clearOldSitemapsByURL, updateOldSitemaps, updateFeed } from '../../../../utils/db.js';
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
        await clearNewSitemapsByURL(actualSitemapUrl);
        await updateNewSitemaps({ sites: sites, url: actualSitemapUrl });
        const additions = await findAdditionsSitemaps(actualSitemapUrl);
        const deletions = await findDeletionsSitemaps(actualSitemapUrl);
        await clearOldSitemapsByURL(actualSitemapUrl);
        await updateOldSitemaps({ sites: sites, url: actualSitemapUrl });

        if (additions.length === 0 && deletions.length === 0) {
            logger.info(`No changes detected for ${actualSitemapUrl}`);
            continue;
        }
        else {
            logger.info({ additions, url: actualSitemapUrl }, `Additions for ${actualSitemapUrl}`);
            logger.info({ deletions, url: actualSitemapUrl }, `Deletions for ${actualSitemapUrl}`);
            const readableAdditions = additions.map(item => item.url).join(', '); // item.url refers to db schema
            const readableDeletions = deletions.map(item => item.url).join(', ');
            const dataToAddToFeed = {
                type: 'sitemap',
                details: `Additions: ${readableAdditions}, Deletions: ${readableDeletions}`,
                appId: actualSitemapUrl, // Use actualSitemapUrl for consistency
            };
            logger.debug({actualSitemapUrl, dataToAddToFeed}, `Data to add to feed for ${actualSitemapUrl}`);
            await updateFeed(dataToAddToFeed);
        }
    }
    return "Sitemap web controller is running...";
}
