import { chromium } from 'playwright'
import { getMiscData, updateMiscData, updateFeed } from '../../../db.js'
import logger from '../../../../lib/logger.js';

export default async function googleLabsController() {
    let browser;

    try {
        browser = await chromium.launch()
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        });

        const [response] = await Promise.all([
            page.waitForResponse('https://labs.google/fx/_next/static/*/_buildManifest.js'),
            page.goto("https://labs.google/fx/"),
        ]);
        const bodyBuffer = await response.body();
        const bodyString = bodyBuffer.toString('utf-8');     
        const pagesRegex = /"\/.*?"/g;
        const pages = bodyString.match(pagesRegex) || [];
        logger.info({ pagesCount: pages.length }, "Pages found");
        const uniquePages = [...new Set(pages.map(page => page.replace(/"/g, '')))];
        logger.info({ uniquePagesCount: uniquePages.length }, "Unique pages found");
        if (uniquePages.length === 0) {
            logger.info("No unique pages found.");
            return;
        }
        const previousPage = await getMiscData("googleLabsPages");
        if (!previousPage || previousPage.length === 0) {
            logger.info("No previous pages found in misc data.");
            await updateMiscData("googleLabsPages", JSON.stringify(uniquePages));
            logger.info("Successfully updated Google Labs pages in misc data.");
            return;
        }
        const previousPages = JSON.parse(Array.isArray(previousPage) && previousPage[0]?.value ? previousPage[0].value : '[]');
        
        // Compare the arrays of strings directly
        const additions = uniquePages.filter(currentPage => !previousPages.includes(currentPage));
        const deletions = previousPages.filter(prevPage => !uniquePages.includes(prevPage));
        
        const formattedDetails = `Added pages: ${additions.join(', ')}\nRemoved pages: ${deletions.join(', ')}`;
        if (additions.length === 0 && deletions.length === 0) {
            logger.info("No changes detected in the pages.");
            return;
        }
        const detailsToUpdate = {
            type: 'googleLabsPages',
            details: `${formattedDetails}\n\nThis data is fetched from the Google Labs FX website.\nTo view the pages, visit: https://labs.google/fx/ (and then the page the tool found).`,
            appId: 'Google Labs FX',
        };
        await updateFeed(detailsToUpdate);
        await updateMiscData("googleLabsPages", JSON.stringify(uniquePages));
        logger.info("Successfully updated Google Labs pages in misc data and feed.");
        await page.close();

    } catch (error) {
        logger.error({ err: error }, 'An error occurred in the googleLabs task route');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    return "googleLabs task completed successfully.";
}
