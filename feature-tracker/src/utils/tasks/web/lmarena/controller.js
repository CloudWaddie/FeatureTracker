import { chromium } from 'playwright'
import { updateModels, compareModels, updateFeed } from '../../../db.js'

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

        const modelRegex = /{modelApiId:".*"*.isPrivate:[!][0-1]}/g;
        const models = bodyString.match(modelRegex) || [];

        let jsonArrayString = `[${models[0]}]`;
        jsonArrayString = jsonArrayString.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
        jsonArrayString = jsonArrayString.replace(/!0/g, 'true').replace(/!1/g, 'false');

        try {
            const jsObject = JSON.parse(jsonArrayString);
            // Update the database with the new models
            const compareresponse = await compareModels(jsObject);
            if (!compareresponse) {
                console.log("No changes detected in the models.");
                return;
            }
            // If there are changes, update the models in the database
            console.log("Response from compareModels:", compareresponse);
            await updateModels(jsObject);
            // Format details string for the feed - Added models, removed models using the id from the response
            const addedModels = compareresponse.additions.map(model => model.id).join(', ');
            const removedModels = compareresponse.deletions.map(model => model.id).join(', ');
            const formatedDetails = `Added models: ${addedModels} Removed models: ${removedModels}`;
            console.log("Formatted details for feed:", formatedDetails);
            // Update feed - type, details, appId, date
            const dataToUpdate = {
                type: 'lmarena',
                details: formatedDetails,
                appId: 'lmarena',
                date: new Date().toISOString()
            }
            await updateFeed(dataToUpdate);
            console.log("Feed updated successfully with the new or removed models.");

        } catch (error) {
            console.error("Error parsing the string:", error);
        }
          

    } catch (error) {
        console.error('An error occurred in the task route:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}