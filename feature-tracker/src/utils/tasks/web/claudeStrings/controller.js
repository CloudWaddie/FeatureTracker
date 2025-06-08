import { chromium } from 'playwright';
import { updateMiscData, getMiscData, updateFeed } from '../../../db.js';
import logger from '../../../../lib/logger.js';

export default async function claudeStringsController() {
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
                        // Fetch the JS file directly instead of using response.text()
                        const jsResponse = await fetch(response.url());
                        if (!jsResponse.ok) {
                            logger.warn(`Failed to fetch ${response.url()}: ${jsResponse.status}`);
                            return;
                        }
                        const text = await jsResponse.text();

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

        // Navigate to claude and wait for network to be idle
        try {
            await page.goto("https://claude.ai/new", { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Wait for the page to load an extra 10 seconds to ensure all JS files are fetched
            await page.waitForTimeout(10000);
        } catch (timeoutError) {
            logger.warn(`Navigation timeout occurred, continuing with collected data: ${timeoutError.message}`);
        }

        // Wait for all response processing promises to resolve
        // This ensures all JS files are processed before proceeding
        await Promise.all(responseProcessingPromises);

        try {
            // Retrieve old data from the database
            const oldMiscDataRecords = await getMiscData('claudeStrings');
            // Ensure oldMiscDataRecords is not empty and get the first record's value
            const oldMiscData = oldMiscDataRecords.length > 0 ? oldMiscDataRecords[0].value : '[]';
            let parsedOldMiscData;

            try {
                // Parse the old data, default to an empty array if parsing fails or data is empty
                parsedOldMiscData = (oldMiscData && oldMiscData.length !== 0) ? JSON.parse(oldMiscData) : [];
            } catch (error) {
                logger.error({ err: error }, "Error parsing old misc data for claude strings");
                return { status: "error", message: "Error parsing old misc data for claude strings", errorDetails: error.message };
            }

            // Convert the new set of messages to an array
            const newMiscData = Array.from(allDefaultMessages);
            const oldDataSet = new Set(parsedOldMiscData);

            // Calculate only additions by comparing new data against old data
            const additions = newMiscData.filter(item => !oldDataSet.has(item));
            // Deletions are no longer tracked or reported

            // If no new additions, log and return
            if (additions.length === 0) {
                logger.info("No new claude strings detected.");
                return { status: "success", message: "claudeStringsController task completed successfully." }; // Return success message
            }

            // Merge new strings with existing ones to maintain cumulative storage
            const allEverSeenStrings = [...new Set([...parsedOldMiscData, ...newMiscData])];
            
            // Update the database with the cumulative list of all strings ever seen
            await updateMiscData('claudeStrings', JSON.stringify(allEverSeenStrings));

            // Format details string for the feed (additions only)
            const formattedDetails = `New claude strings: ${additions.join('; ')}`;
            logger.info({ formattedDetails }, "Formatted details for feed");

            // Update feed - type, details, appId, date
            const dataToUpdate = {
                type: 'claudeStrings',
                details: formattedDetails,
                appId: 'Public Claude Web App',
            };
            await updateFeed(dataToUpdate);
            logger.info("Feed updated successfully with new claude strings.");

        } catch (error) {
            logger.error({ err: error }, "Error during update process");
            return { status: "error", message: "Error during update process", errorDetails: error.message };
        }

    } catch (error) {
        logger.error({ err: error }, 'An error occurred in the claudeStringsController task route');
        return { status: "error", message: "An error occurred in the claudeStringsController task route", errorDetails: error.message };
    } finally {
        // Ensure the browser is closed even if errors occur
        if (browser) {
            await browser.close();
        }
    }
    return { status: "success", message: "claudeStringsController task completed successfully." };
}
