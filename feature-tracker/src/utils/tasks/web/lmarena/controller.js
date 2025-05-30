import { chromium } from 'playwright'
import { updateModels, compareModels, updateFeed } from '../../../db.js'
import logger from '../../../../lib/logger.js';

export default async function lmarenaController() {
    let browser;

    try {
        browser = await chromium.launch();
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        });

        const [response] = await Promise.all([
            page.waitForResponse(res => res.url().match(/https:\/\/web\.lmarena\.ai\/_next\/static\/chunks\/app\/\(home\)\/page-.*\.js/)),
            page.goto("https://web.lmarena.ai")
        ]);
        const bodyBuffer = await response.body();
        const bodyString = bodyBuffer.toString('utf-8');

        const modelRegex = /{modelApiId:".+?".+?provider:".+?".+?}/g;
        const models = bodyString.match(modelRegex) || [];
        logger.info({ modelsCount: models.length }, "Models found");

        let jsonArrayString = `[${models.join(',')}]`;
        jsonArrayString = jsonArrayString.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
        jsonArrayString = jsonArrayString.replace(/!0/g, 'true').replace(/!1/g, 'false');

        try {
            const jsObject = JSON.parse(jsonArrayString);
            // Update the database with the new models
            const compareresponse = await compareModels(jsObject);
            // Check if compareresponse is not empty
            if (!compareresponse || (compareresponse.additions.length === 0 && compareresponse.deletions.length === 0)) {
                logger.info("No changes detected in the models.");
                return;
            }
            // If there are changes, update the models in the database
            logger.info({ compareresponse }, "Response from compareModels");
            await updateModels(jsObject);
            // Format details string for the feed - Added models, removed models using the id from the response
            const addedModels = compareresponse.additions.map(model => model.id).join(', ');
            const removedModels = compareresponse.deletions.map(model => model.id).join(', ');
            const formattedDetails = `Added models: ${addedModels} Removed models: ${removedModels}`;
            logger.info({ formattedDetails }, "Formatted details for feed");
            // Update feed - type, details, appId, date
            const dataToUpdate = {
                type: 'models',
                details: formattedDetails,
                appId: 'lmarena',
            }
            await updateFeed(dataToUpdate);
            logger.info("Feed updated successfully with the new or removed models.");

        } catch (error) {
            logger.error({ err: error }, "Error parsing the string");
        }
          

    } catch (error) {
        logger.error({ err: error }, 'An error occurred in the lmarenaController task route');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    return "lmarenaController task completed successfully.";
}
