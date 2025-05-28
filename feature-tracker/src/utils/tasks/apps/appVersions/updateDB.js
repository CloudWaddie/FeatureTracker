import { updateFeed, updateLastUpdated } from "../../../db.js"; // <-- Import the updateFeed function from db.js
import logger from '../../../../lib/logger.js';

export default async function updateDB(data) { // <-- Make the function async
    logger.info("Updating the database...");
    try {
        if (data.details === null || data.details === undefined) {
            data.details = "No update details found."; // Set to a default message if not found
        }
        await updateFeed(data); // <-- Call the function to update the feed
        logger.info("Updating the last updated date...");
        await updateLastUpdated(data.id || data.appId, data.lastUpdated); // <-- Call the function to update the last updated date
    } catch (error) {
        logger.error({ err: error, data }, "Error updating the database"); // <-- Log any errors
        return "Error updating the database."; // <-- Return an error message
    }
}
