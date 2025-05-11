import updateDB from "./updateDB.js";
import fs from "fs";
import { cwd } from "process";

// --- Import your new store-specific functions ---
import getLastUpdated from "./getLastUpdated.js";
import checkAndroidForUpdates from "./checkAndroidForUpdates.js";
import checkAppleForUpdates from "./checkAppleForUpdates.js";
// --- End of new imports ---


export default async function appController() {
    const configPath = `${cwd()}/src/utils/tasks/apps/config.txt`;
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const lines = fileContent.split("\n");

    const appListsByStore = {};
    let currentStore = null;

    // --- Parsing logic remains the same ---
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === "") {
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
                console.warn(`App ID "${trimmedLine}" found before any store section header in ${configPath}. Ignoring.`);
            }
        }
    }
    // --- End of parsing logic ---

    console.log("Parsed app lists by store:", appListsByStore);

    // --- Modified looping logic ---
    for (const store in appListsByStore) {
        if (appListsByStore.hasOwnProperty(store)) {
            console.log(`--- Checking apps for store: ${store} ---`);
            const apps = appListsByStore[store];

            for (const app of apps) {
                console.log(`Checking app: ${app} in store ${store}`);

                let lastUpdatedData; // Variable to hold data from get...LastUpdated
                let updateCheckResult; // Variable to hold data from check...ForUpdates

                // --- Conditional function calls based on store ---
                if (store === 'android') {
                    console.log(`Using Android specific functions for ${app}`);
                    lastUpdatedData = await getLastUpdated(app);
                    updateCheckResult = await checkAndroidForUpdates(lastUpdatedData.lastUpdated, app);
                } else if (store === 'ios') {
                    console.log(`Using iOS specific functions for ${app}`);
                    lastUpdatedData = await getLastUpdated(app);
                    updateCheckResult = await checkAppleForUpdates(lastUpdatedData.lastUpdated, app);
                } else {
                    console.warn(`Unknown store "${store}" for app "${app}". Cannot check for updates. Skipping.`);
                    continue; // Skip to the next app if the store is not recognized
                }
                // --- End of conditional function calls ---

                // Now, check the result from the store-specific function call
                // Make sure updateCheckResult is defined before accessing its properties
                if (updateCheckResult && updateCheckResult.updateAvailable) {
                    console.log(`Update available for ${app} in ${store}! Details: ${updateCheckResult.updateString}`);
                    const data = {
                        type: `appversion-${store}`,
                        details: updateCheckResult.updateString,
                        appId: updateCheckResult.package, // Assuming 'package' property holds the ID,
                        id: updateCheckResult.id, // Assuming 'id' property holds the ID,
                        lastUpdated: updateCheckResult.lastUpdated, // Assuming 'lastUpdated' property
                        store: store
                    };
                    await updateDB(data);
                } else {
                    // This will catch cases where updateCheckResult is not set (unknown store)
                    // or where updateAvailable is false.
                     if (updateCheckResult) { // Only log "No updates" if we successfully got a result
                         console.log(`No updates available for ${app} in ${store}.`);
                     }
                     // If updateCheckResult was null/undefined, the warning above handles it.
                }
            }
        }
    }
    // --- End of modified looping logic ---

    console.log("--- App controller finished ---");
    return "App controller finished running.";
}