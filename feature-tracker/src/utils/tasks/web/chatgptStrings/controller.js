import { chromium } from 'playwright'
import { updateMiscData, getMiscData, updateFeed } from '../../../db.js'
import logger from '../../../../lib/logger.js';

export default async function chatgptStringsContoller() {
    let browser;
    const allDefaultMessages = new Set();

    const handleResponse = async (response) => {
        if (response.url().endsWith('.js')) {
            const status = response.status();
            if (status >= 300 && status < 400) {
                return;
            }
            try {
                // Get the text content of the response.
                const text = await response.text();

                const regex = /defaultMessage\s*:\s*(["'])(.*?)\1/g;
                let match;

                while ((match = regex.exec(text)) !== null) {
                    allDefaultMessages.add(match[2]);
                }
            } catch (e) {
                logger.error(`Error processing ${response.url()}: ${e.message}`);
            }
        }
    };

    try {
        browser = await chromium.launch();
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        });

        page.on('response', handleResponse);
        await page.goto("https://chatgpt.com/", {waitUntil: 'networkidle'})

        try {
            // Now we compare from the database
            const oldMiscData = (await getMiscData('chatgptStrings'))[0].value;
            let parsedOldMiscData;
            try {
                parsedOldMiscData = (oldMiscData.length !== 0)  ? JSON.parse(oldMiscData) : [];
            }
            catch (error) {
                logger.error({ err: error }, "Error parsing old misc data for chatgpt strings");
                return
            }
            const newMiscData = Array.from(allDefaultMessages);
            const additions = newMiscData.filter(item => !parsedOldMiscData.includes(item));
            const deletions = parsedOldMiscData.filter(item => !newMiscData.includes(item));

            if (additions.length === 0 && deletions.length === 0) {
                logger.info("No changes detected in the chatgpt strings.");
                return;
            }

            // Update the database with the new strings
            await updateMiscData('chatgptStrings', JSON.stringify(newMiscData));

            // Format details string for the feed
            let formatedDetails = '';
            if (additions.length > 0) {
                formatedDetails += `Added: ${additions.join(', ')}`;
            }
            if (deletions.length > 0) {
                if (formatedDetails.length > 0) formatedDetails += '; '; // Add separator if both exist
                formatedDetails += `Removed: ${deletions.join(', ')}`;
            }
            logger.info({ formatedDetails }, "Formatted details for feed");

            // Update feed - type, details, appId, date
            const dataToUpdate = {
                type: 'chatgptStrings',
                details: formatedDetails,
                appId: 'ChatGPT Web App',
            }
            await updateFeed(dataToUpdate);
            logger.info("Feed updated successfully with the new or removed chatgpt strings.");

        } catch (error) {
            logger.error({ err: error }, "Error during update process");
        }
          

    } catch (error) {
        logger.error({ err: error }, 'An error occurred in the chatgptStringsController task route');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    return "chatgptStringsController task completed successfully.";
}
