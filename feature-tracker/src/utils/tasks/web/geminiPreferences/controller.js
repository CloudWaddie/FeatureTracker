import logger from "../../../../lib/logger.js";
import { getMiscData, updateMiscData, updateFeed } from "../../../db.js";

export default async function geminiPreferencesController() {
    const url = "https://www.gstatic.com/_/mss/boq-bard-web/_/js/k=boq-bard-web.BardChatUi.en_US.llcRij4DRZs.es5.O/ck=boq-bard-web.BardChatUi.-NhL9YjEaDQ.L.B1.O/am=zyBI5xH_3Xvv3__vOa8B0AAADA/d=1/exm=_b/excm=_b/ed=1/br=1/wt=2/ujg=1/rs=AL3bBk1oq5wJBsP9AxIvk-3gXk0agwCdDw/ee=DGWCxb:CgYiQ;Pjplud:PoEs9b;QGR0gd:Mlhmy;ScI3Yc:e7Hzgb;Uvc8o:VDovNc;YIZmRd:A1yn5d;cEt90b:ws9Tlc;dowIGb:ebZ2mb;lOO0Vd:OTA3Ae;qafBPd:ovKuLd/m=LQaXg";
    const preferences = []; // Changed 'matches' to 'preferences' for clarity
    try {
        const response = await fetch(url);
        if (!response.ok) {
            logger.error(`Failed to fetch the URL: ${response.status} ${response.statusText}`);
            return;
        }

        const jsContent = await response.text();

        // Extract preferences using regex
        const preferencePattern = /preference:\s*['"]([^'\"]+)['"],?/g;
        let match;
        while ((match = preferencePattern.exec(jsContent)) !== null) { // Use preferencePattern here
            preferences.push(match[1]); // Push the captured preference string
        }

        logger.debug(`Found ${preferences.length} preferences.`);
        if (preferences.length > 0) {
            logger.debug("Found matching preferences:");
            preferences.forEach(pref => {
                logger.debug(`Preference: ${pref}`);
            });
        } else {
            logger.debug("No preferences found.");
            return;
        }

    } catch (e) {
        logger.error(`Error fetching the URL: ${e}`);
        return; // Add return here so the function stops if there's an error
    }

    const miscDataRows = await getMiscData("geminiPreferences");
    // logger.info(`Fetching Gemini preferences from: ${url}`); // Log message moved down for clarity if needed, or keep here.

    // Parse previous preferences
    let previousPreferences = [];
    let rawPreviousPreferencesString = null;
    if (miscDataRows && miscDataRows.length > 0 && miscDataRows[0] && typeof miscDataRows[0].value === 'string') {
        rawPreviousPreferencesString = miscDataRows[0].value;
        logger.debug(`Retrieved raw previous preferences string: '${rawPreviousPreferencesString}'`);
    }

    if (rawPreviousPreferencesString && rawPreviousPreferencesString.trim() !== '') {
        try {
            previousPreferences = JSON.parse(rawPreviousPreferencesString);
            if (!Array.isArray(previousPreferences)) {
                logger.warn(`Parsed previous preferences is not an array. Data: '${rawPreviousPreferencesString}'. Resetting to empty array.`);
                previousPreferences = [];
            }
        } catch (parseError) {
            logger.error(`Error parsing previous preferences from string. Data: '${rawPreviousPreferencesString}', Error: ${parseError}`);
            previousPreferences = []; // Fallback to empty array on parse error
        }
    } else {
        logger.info("No previous preferences found in misc data, or data is empty/not a string, or value is not a string.");
        // previousPreferences is already initialized to []
    }

    const currentPreferencesToCompare = preferences; // Use the extracted preferences directly

    // Compare the arrays to find additions and deletions
    const additions = currentPreferencesToCompare.filter(cp => !previousPreferences.includes(cp));
    const deletions = previousPreferences.filter(pp => !currentPreferencesToCompare.includes(pp));

    let formattedDetails = "";
    if (additions.length > 0) {
        formattedDetails += `Added preference(s):\n${additions.map(a => `- ${a}`).join('\n')}`;
    }
    if (deletions.length > 0) {
        if (formattedDetails.length > 0) {
            formattedDetails += "\n\n"; // Add line breaks if there were additions
        }
        formattedDetails += `Removed preference(s):\n${deletions.map(d => `- ${d}`).join('\n')}`;
    }

    if (additions.length === 0 && deletions.length === 0) {
        logger.info("No changes detected in the preferences.");
        return;
    }
    const detailsToUpdate = {
        type: 'geminiPreferences',
        details: formattedDetails,
        appId: 'Gemini Web App',
    };
    await updateFeed(detailsToUpdate);
    logger.info("Gemini preferences feed updated successfully.");
    await updateMiscData("geminiPreferences", JSON.stringify(currentPreferencesToCompare));
    logger.info("Stored current Gemini preferences for future comparisons.");
}
