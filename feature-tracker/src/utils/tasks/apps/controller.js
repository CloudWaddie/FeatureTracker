import getLastUpdated from "./getLastUpdated.js";
import checkForUpdates from "./checkForUpdates.js";
import updateDB from "./updateDB.js"; // Import the updateDB function

export default async function appController() {
    const lastUpdated = await getLastUpdated(); // Call the function to check for updates
    const anyUpdates = await checkForUpdates(lastUpdated.lastUpdated); // Call the function to get the app version
    if (anyUpdates.updateAvailable) {
        console.log("Updates available:", anyUpdates.updateAvailable); // Log the updates available
        const data = {
            type: "appversion",
            details: anyUpdates.updateString,
            appId: anyUpdates.package,
            lastUpdated: anyUpdates.lastUpdated,
        };
        updateDB(data); // Call the function to update the database
    }
    else {
        console.log("No updates available.");
    }

    return "App controller is running...";
}