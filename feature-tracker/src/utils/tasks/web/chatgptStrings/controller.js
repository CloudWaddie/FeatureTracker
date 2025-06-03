import { chromium } from 'playwright';
import { updateMiscData, getMiscData, updateFeed } from '../../../db.js';
import logger from '../../../../lib/logger.js';

export default async function chatgptStringsController() {
    let browser;
    const allDefaultMessages = new Set();
    // Array to hold promises for response text processing
    const responseProcessingPromises = [];

    const handleResponse = async (response) => {
        // Only process JavaScript files
        if (response.url().endsWith('.js')) {
            const status = response.status();
            // Ignore redirects
            if (status >= 300 && status < 400) {
                return;
            }
            // Push a promise to the array for each response to be processed
            responseProcessingPromises.push(
                (async () => {
                    try {
                        // Get the text content of the response.
                        const text = await response.text();

                        // Regex to find defaultMessage strings
                        const regex = /defaultMessage\s*:\s*(["'])(.*?)\1/g;
                        let match;

                        // Add all found messages to the Set
                        while ((match = regex.exec(text)) !== null) {
                            allDefaultMessages.add(match[2]);
                        }
                    } catch (e) {
                        // Log errors for individual responses without stopping the whole process
                        logger.error(`Error processing ${response.url()}: ${e.message}`);
                    }
                })()
            );
        }
    };

    try {
        // Launch a new Chromium browser instance
        browser = await chromium.launch();
        const page = await browser.newPage();

        // Set extra HTTP headers to mimic a real browser
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        });

        // Attach the response handler to the page
        page.on('response', handleResponse);

        // Navigate to ChatGPT and wait for network to be idle
        await page.goto("https://chatgpt.com/", { waitUntil: 'networkidle', timeout: 60000 });

        // Wait for all response processing promises to resolve
        // This ensures all JS files are processed before proceeding
        await Promise.all(responseProcessingPromises);

        try {
            // Retrieve old data from the database
            const oldMiscDataRecords = await getMiscData('chatgptStrings');
            // Ensure oldMiscDataRecords is not empty and get the first record's value
            const oldMiscData = oldMiscDataRecords.length > 0 ? oldMiscDataRecords[0].value : '[]';
            let parsedOldMiscData;

            try {
                // Parse the old data, default to an empty array if parsing fails or data is empty
                parsedOldMiscData = (oldMiscData && oldMiscData.length !== 0) ? JSON.parse(oldMiscData) : [];
            } catch (error) {
                logger.error({ err: error }, "Error parsing old misc data for chatgpt strings");
                return; // Exit if old data cannot be parsed
            }

            // Convert the new set of messages to an array
            const newMiscData = Array.from(allDefaultMessages);
            const oldDataSet = new Set(parsedOldMiscData);

            // Calculate additions and deletions by comparing new and old data sets
            const additions = newMiscData.filter(item => !oldDataSet.has(item));
            const deletions = parsedOldMiscData.filter(item => !allDefaultMessages.has(item));

            // If no changes, log and return
            if (additions.length === 0 && deletions.length === 0) {
                logger.info("No changes detected in the chatgpt strings.");
                return { status: "success", message: "chatgptStringsController task completed successfully." }; // Return success message
            }

            // Update the database with the new strings
            await updateMiscData('chatgptStrings', JSON.stringify(newMiscData));

            // Format details string for the feed
            let formattedDetails = '';
            if (additions.length > 0) {
                formattedDetails += `Added: ${additions.join(', ')}`;
            }
            if (deletions.length > 0) {
                if (formattedDetails.length > 0) formattedDetails += '; '; // Add separator if both exist
                formattedDetails += `Removed: ${deletions.join(', ')}`;
            }
            logger.info({ formattedDetails }, "Formatted details for feed");

            // Update feed - type, details, appId, date
            const dataToUpdate = {
                type: 'chatgptStrings',
                details: formattedDetails,
                appId: 'ChatGPT Web App', // Your app ID for the feed
            };
            await updateFeed(dataToUpdate);
            logger.info("Feed updated successfully with the new or removed chatgpt strings.");

        } catch (error) {
            logger.error({ err: error }, "Error during update process");
            return;
        }

    } catch (error) {
        logger.error({ err: error }, 'An error occurred in the chatgptStringsController task route');
    } finally {
        // Ensure the browser is closed even if errors occur
        if (browser) {
            await browser.close();
        }
    }
    return "chatgptStringsController task completed successfully.";
}
