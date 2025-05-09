import getLastUpdated from "./getLastUpdated.js";
import checkForUpdates from "./checkForUpdates.js";
import updateDB from "./updateDB.js"; // Import the updateDB function
import fs from "fs"; // Import the FileSystem module
import { config, cwd } from "process";

export default async function appController() {
    // Get list of apps to check for updates from config.txt from current directory
    const configPath = `${cwd()}/src/utils/tasks/apps/config.txt`; // Get the current working directory and append config.txt
    const appsToCheck = fs.readFileSync(configPath, "utf8")
                        .split("\n")
                        .filter(Boolean)
                        .map(line => line.trim());
    console.log("Apps to check for updates:", appsToCheck); // Log the apps to check for updates
    for (const app of appsToCheck) {
        const lastUpdated = await getLastUpdated(app); // Call the function to check for updates
        const anyUpdates = await checkForUpdates(lastUpdated.lastUpdated, app); // Call the function to get the app version
        if (anyUpdates.updateAvailable) {
            const data = {
                type: "appversion",
                details: anyUpdates.updateString,
                appId: anyUpdates.package,
                lastUpdated: anyUpdates.lastUpdated,
            };
            await updateDB(data); // Call the function to update the database
        }
        else {
            console.log("No updates available.");
        }
    }

    return "App controller is running...";
}