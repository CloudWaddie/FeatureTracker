import { updateFeed, updateLastUpdated } from "../../../db.js"; // <-- Import the updateFeed function from db.js

export default async function updateDB(data) { // <-- Make the function async
    console.log("Updating the database...");
    try {
        if (data.details === null || data.details === undefined) {
            data.details = "No update details found."; // Set to a default message if not found
        }
        await updateFeed(data); // <-- Call the function to update the feed
        console.log("Updating the last updated date...");
        await updateLastUpdated(data.id || data.appId, data.lastUpdated); // <-- Call the function to update the last updated date
    } catch (error) {
        console.error("Error updating the database:", error); // <-- Log any errors
        return "Error updating the database."; // <-- Return an error message
    }
}