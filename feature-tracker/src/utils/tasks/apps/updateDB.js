import { updateFeed } from "../../../utils/db.js"; // <-- Import the updateFeed function from db.js
import { updateLastUpdated} from "../../../utils/db.js"; // <-- Import the updateLastUpdated function from db.js

export default async function updateDB(data) { // <-- Make the function async
    console.log("Updating the database...");
    try {
        updateFeed(data); // <-- Call the function to update the feed
        updateLastUpdated(data.appId, data.lastUpdated); // <-- Call the function to update the last updated date
    } catch (error) {
        console.error("Error updating the database:", error); // <-- Log any errors
        return "Error updating the database."; // <-- Return an error message
    }
}