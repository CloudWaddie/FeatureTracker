import { updateFeed } from "../../../db.js";
import { promises as fs } from "fs"; // Changed to use fs.promises
import { createPatch } from "diff";
import { cwd } from "process";
import logger from '../../../../lib/logger.js';

export default async function compareAndUpdateDB(stringsXMLPath, appId) {
    let currentStrings = "";
    let shouldUpdateFeed = false;
    const currentStringsFilePath = `${cwd()}/src/utils/tasks/apps/resources/strings/${appId}-strings.xml`;

    try {
        // Try to read the existing strings file
        currentStrings = await fs.readFile(currentStringsFilePath, 'utf-8');
        shouldUpdateFeed = true;
    } catch (error) {
        if (error.code === 'ENOENT') { // ENOENT means file not found
            logger.warn({ appId, filePath: currentStringsFilePath }, "The specified strings XML file does not exist, will create it.");
            currentStrings = ""; // Initialize as empty if file doesn't exist
            shouldUpdateFeed = false; // Don't update feed if it's the first time
        } else {
            // For other errors, log and potentially re-throw or return
            logger.error({ err: error, appId, filePath: currentStringsFilePath }, "Error reading current strings XML file");
            return; // Or handle error appropriately
        }
    }

    // Read the new strings XML file
    let newStrings;
    try {
        newStrings = await fs.readFile(stringsXMLPath, 'utf-8'); // Changed to async
    } catch (error) {
        logger.error({ err: error, appId, filePath: stringsXMLPath }, "Error reading new strings XML file");
        return;
    }

    const diffOptions = { context: 3 };
    const diff = createPatch('strings.xml', currentStrings, newStrings, 'Current Strings (XML)', 'New Strings (XML)', diffOptions);
    // Check if the patch has any actual differences apart from the header
    if (diff.split('\n').length <= 5) {
        logger.info({ appId }, "No changes detected in the strings XML file.");
        return; // No changes to update
    }
    // Update the file with the new strings
    try {
        await fs.writeFile(currentStringsFilePath, newStrings, 'utf-8'); // Changed to async
        logger.info({ appId, filePath: currentStringsFilePath }, "Successfully updated the strings XML file.");
    } catch (error) {
        logger.error({ err: error, appId, filePath: currentStringsFilePath }, "Error writing to strings XML file");
        // If writing fails, we might not want to proceed with updating the feed
        return; // Or handle error appropriately
    }
    // Update the feed with the new strings
    // Clean the < and > tags from the details by replacing them with &lt; and &gt;
    const escapedDiff = diff.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    try {
        const feedData = {
            type: 'strings',
            details: escapedDiff,
            appId: appId
        };
        if (shouldUpdateFeed) {
            await updateFeed(feedData);
            logger.info({ appId }, "Successfully updated feed data with new strings.");
        }
        
    }
    catch (error) {
        logger.error({ err: error, appId }, "Failed to update feed with new strings");
    }

    return diff;
}
