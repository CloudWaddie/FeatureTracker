import { chromium } from 'playwright'
import { updateModels } from '../../../db.js'

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
            await updateModels(jsObject);
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