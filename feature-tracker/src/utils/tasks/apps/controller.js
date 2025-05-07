import getLastUpdated from "./getLastUpdated.js";
import checkForUpdates from "./checkForUpdates.js";

export default async function appController() {
    const lastUpdated = await getLastUpdated(); // Call the function to check for updates
    const anyUpdates = await checkForUpdates(lastUpdated.lastUpdated); // Call the function to get the app version
    if (anyUpdates.updatesAvailable) {
        console.log("Updates available:", anyUpdates.updatesAvailable); // Log the updates available
    }
    else {
        console.log("No updates available.");
    }

    return "App controller is running...";
}