import logger from "../../../../lib/logger.js";
import { getMiscData, updateMiscData, updateFeed } from "../../../db.js";

export default async function geminiPreferencesController() {
    const url = "https://www.gstatic.com/_/mss/boq-bard-web/_/js/k=boq-bard-web.BardChatUi.en_US.llcRij4DRZs.es5.O/ck=boq-bard-web.BardChatUi.-NhL9YjEaDQ.L.B1.O/am=zyBI5xH_3Xvv3__vOa8B0AAADA/d=1/exm=_b/excm=_b/ed=1/br=1/wt=2/ujg=1/rs=AL3bBk1oq5wJBsP9AxIvk-3gXk0agwCdDw/ee=DGWCxb:CgYiQ;Pjplud:PoEs9b;QGR0gd:Mlhmy;ScI3Yc:e7Hzgb;Uvc8o:VDovNc;YIZmRd:A1yn5d;cEt90b:ws9Tlc;dowIGb:ebZ3mb;lOO0Vd:OTA3Ae;qafBPd:ovKuLd/m=LQaXg";
    const matches = [];
    try {
        const response = await fetch(url);
        if (!response.ok) {
            logger.error(`Failed to fetch the URL: ${response.status} ${response.statusText}`);
            return;
        }

        const jsContent = await response.text();

        // Extract case statements using regex
        const casePattern = /case\s+"([^"]+)"\s*:\s*return\s*"([^"]+)";/g;
        let match;
        while ((match = casePattern.exec(jsContent)) !== null) {
            matches.push({ key: match[1], value: match[2] });
        }

        logger.debug(`Found ${matches.length} case statements.`);
        if (matches.length > 0) {
            logger.debug("Found matching case statements:");
            matches.forEach(({ key, value }) => {
                logger.debug(`Key: ${key}, Value: ${value}`);
            });
        } else {
            logger.debug("No case statements found.");
            return;
        }

    } catch (e) {
        console.error(`Error fetching the URL: ${e}`);
    }
    const currentPreferences = await getMiscData("geminiPreferences");
    logger.info(`Fetching Gemini preferences from: ${url}`);
    if (!currentPreferences || currentPreferences.length === 0) {
        logger.info("No previous preferences found in misc data.");
        await updateMiscData("geminiPreferences", JSON.stringify(matches));
        logger.info("Successfully updated Gemini preferences in misc data.");
        return;
    }
    const previousPreferences = JSON.parse(Array.isArray(currentPreferences) && currentPreferences[0]?.value ? currentPreferences[0].value : '[]');
    const currentPreferencesToCompare = matches.map(({ key, value }) => ({ key, value }));
    // Compare the arrays to find additions and deletions
    const additions = currentPreferencesToCompare.filter(cp => !previousPreferences.some(pp => pp.key === cp.key && pp.value === cp.value));
    const deletions = previousPreferences.filter(pp => !currentPreferencesToCompare.some(cp => cp.key === pp.key && cp.value === pp.value));

    let formattedDetails = "";
    if (additions.length > 0) {
        formattedDetails += `Added preference(s):\n${additions.map(a => `- ${a.key}: ${a.value}`).join('\n')}`;
    }
    if (deletions.length > 0) {
        if (formattedDetails.length > 0) {
            formattedDetails += "\n\n"; // Add line breaks if there were additions
        }
        formattedDetails += `Removed preference(s):\n${deletions.map(d => `- ${d.key}: ${d.value}`).join('\n')}`;
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
    logger.info("Gemini preferences updated successfully.");    
}
