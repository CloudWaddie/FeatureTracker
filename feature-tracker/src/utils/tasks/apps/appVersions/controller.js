import updateDB from "./updateDB.js";
import fs from "fs";
import { cwd } from "process";

// --- Import your new store-specific functions ---
import getLastUpdated from "./getLastUpdated.js";
import checkAndroidForUpdates from "./checkAndroidForUpdates.js";
import checkAppleForUpdates from "./checkAppleForUpdates.js";
// --- End of new imports ---

import downloadApk from "./downloadApk.js";
import extractStrings from "./extractStrings.js";
import compareAndUpdateDB from "./compareAndUpdateDB.js";
import logger from '../../../../lib/logger.js';

export default async function appVersionController() {
    const configPath = `${cwd()}/src/utils/tasks/apps/appVersions/config.txt`;
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const lines = fileContent.split("\n");

    const appListsByStore = {};
    let currentStore = null;

    // --- Parsing logic remains the same ---
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === "" || trimmedLine.startsWith('#')) {
            continue;
        }

        const sectionMatch = trimmedLine.match(/^\[(.*?)\]$/);
        if (sectionMatch) {
            currentStore = sectionMatch[1].toLowerCase();
            if (!appListsByStore[currentStore]) {
                appListsByStore[currentStore] = [];
            }
        } else {
            if (currentStore) {
                appListsByStore[currentStore].push(trimmedLine);
            } else {
                logger.warn(`App ID "${trimmedLine}" found before any store section header in ${configPath}. Ignoring.`);
            }
        }
    }
    // --- End of parsing logic ---

    logger.info({ appListsByStore }, "Parsed app lists by store");

    // --- Modified looping logic ---
    for (const store in appListsByStore) {
        if (appListsByStore.hasOwnProperty(store)) {
            logger.info(`--- Checking apps for store: ${store} ---`);
            const apps = appListsByStore[store];

            for (const app of apps) {
                logger.info(`Checking app: ${app} in store ${store}`);

                let lastUpdatedData; // Variable to hold data from get...LastUpdated
                let updateCheckResult; // Variable to hold data from check...ForUpdates

                // --- Conditional function calls based on store ---
                if (store === 'android') {
                    logger.info(`Using Android specific functions for ${app}`);
                    lastUpdatedData = await getLastUpdated(app);
                    updateCheckResult = await checkAndroidForUpdates(lastUpdatedData.lastUpdated, app);
                } else if (store === 'ios') {
                    logger.info(`Using iOS specific functions for ${app}`);
                    lastUpdatedData = await getLastUpdated(app);
                    updateCheckResult = await checkAppleForUpdates(lastUpdatedData.lastUpdated, app);
                } else {
                    logger.warn(`Unknown store "${store}" for app "${app}". Cannot check for updates. Skipping.`);
                    continue; // Skip to the next app if the store is not recognized
                }
                // --- End of conditional function calls ---

                // Now, check the result from the store-specific function call
                // Make sure updateCheckResult is defined before accessing its properties
                if (updateCheckResult && updateCheckResult.updateAvailable) {
                    logger.info(`Update available for ${app} in ${store}! Details: ${updateCheckResult.updateString}`);
                    const data = {
                        type: `appversion-${store}`,
                        details: updateCheckResult.updateString,
                        appId: updateCheckResult.package, // Assuming 'package' property holds the ID,
                        id: updateCheckResult.id, // Assuming 'id' property holds the ID,
                        lastUpdated: updateCheckResult.lastUpdated, // Assuming 'lastUpdated' property
                        store: store
                    };
                    await updateDB(data);
                    if (store === 'android') {
                            try {
                                logger.info(`Starting background APK processing for ${updateCheckResult.package}`);
                                await downloadApk(updateCheckResult.package);
                                // Wait for 100 milliseconds to give time for the server to start listening again
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                const stringsXMLPath = await extractStrings(`./apk-files/${updateCheckResult.package}.apk`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                logger.info(`Extracted strings from APK for ${updateCheckResult.package}`);
                                // Compare and update the database with the new strings
                                await compareAndUpdateDB(stringsXMLPath, updateCheckResult.package);
                                logger.info(`Finished background APK processing for ${updateCheckResult.package}`);
                            } catch (error) {
                                logger.error({ err: error, package: updateCheckResult.package }, `Error during background APK processing for ${updateCheckResult.package}`);
                            }
                    }
                } else {
                    // This will catch cases where updateCheckResult is not set (unknown store)
                    // or where updateAvailable is false.
                     if (updateCheckResult) { // Only log "No updates" if we successfully got a result
                         logger.info(`No updates available for ${app} in ${store}.`);
                     }
                     // If updateCheckResult was null/undefined, the warning above handles it.
                }
            }
        }
    }
    // --- End of modified looping logic ---

    logger.info("--- App controller finished ---");
    return "App controller finished running.";
}
