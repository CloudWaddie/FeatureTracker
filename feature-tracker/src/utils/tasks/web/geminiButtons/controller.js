import { getMiscData, updateMiscData, updateFeed } from "../../../db.js";
import logger from '../../../../lib/logger.js';

export default async function geminiButtonsController() {
    try {
        const url = "https://www.gstatic.com/_/mss/boq-bard-web/_/js/k=boq-bard-web.BardChatUi.en.XySAOOWrtBk.es5.O/ck=boq-bard-web.BardChatUi.QN3aNRBgQHs.L.B1.O/am=zziQnEf8d--9__-_51wHoAEAAAM/d=1/exm=_b/excm=_b/ed=1/br=1/wt=2/ujg=1/rs=AL3bBk3MGX3vYYrUimA4uM8bib-9yfHCaQ/ee=DGWCxb:CgYiQ;Pjplud:PoEs9b;QGR0gd:Mlhmy;ScI3Yc:e7Hzgb;Uvc8o:VDovNc;YIZmRd:A1yn5d;cEt90b:ws9Tlc;dowIGb:ebZ3mb;lOO0Vd:OTA3Ae;qafBPd:ovKuLd/m=LQaXg"; // Storing URL in a variable for clarity

        const response = await fetch(url);

        // Check if the fetch was successful
        if (!response.ok) {
            logger.error("Fetch failed lol jk")
            return;
        }

        // This regex now has named capture groups: ?<label> and ?<icon>
        // It also looks for `label: "..."` and `icon: "..."` specifically.
        const buttonsRegex = /label:\s*?"(?<label>[^"]*?)",\s*?.*?icon:\s*?"(?<icon>[^"]*?)"/gms;
        const buttonsData = await response.text();
        let match;
        const actualButtonData = [];

        while ((match = buttonsRegex.exec(buttonsData)) !== null) {
            if (match.groups) {
                actualButtonData.push({
                    label: match.groups.label,
                    icon: match.groups.icon
                });
            }
        }
        if (actualButtonData.length === 0) {
            logger.warn("No Gemini buttons data found.");
            return;
        }
        let existingData = await getMiscData("geminiButtons");
        if (JSON.stringify(existingData) === JSON.stringify(actualButtonData)) {
            logger.info("Gemini buttons data is already up to date.");
            return;
        }
        try {
            existingData = existingData[0].value
        } catch (error) {
            logger.warn("No existing Gemini buttons data found, treating as empty.");
            await updateMiscData("geminiButtons", JSON.stringify(actualButtonData));
            return;
        }
        existingData = existingData ? JSON.parse(existingData) : [];
        // There was a change
        const additions = actualButtonData.filter(button => !existingData.some(existingButton => existingButton.label === button.label));
        const removals = existingData.filter(button => !actualButtonData.some(newButton => newButton.label === button.label));
        const formattedDetails = `Additions: ${additions.map(button => `${button.label} (${button.icon})`).join(", ")}\nRemovals: ${removals.map(button => `${button.label} (${button.icon})`).join(", ")}`;
        if (additions.length === 0 && removals.length === 0) {
            logger.info("No changes detected in Gemini buttons data.");
            return;
        };
        logger.info(`Gemini buttons data has changed:\n${formattedDetails}`);
        await updateMiscData("geminiButtons", JSON.stringify(actualButtonData));
        await updateFeed({
            type: "geminiButtons",
            details: formattedDetails,
            appId: "Gemini Web App"
        });
        logger.info("Gemini buttons data updated successfully.");
        return 'Gemini buttons data updated successfully.';
    } catch (error) {
        logger.error("Error fetching Gemini buttons:", error);
        return;
    }
}