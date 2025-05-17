import { getMiscData, updateMiscData, updateFeed } from "../../../db.js";

export default async function geminiDatesController() {
    try {
        const url = "https://www.gstatic.com/_/mss/boq-bard-web/_/js/k=boq-bard-web.BardChatUi.en.5QT38Qf6LCg.es5.O/ck=boq-bard-web.BardChatUi.3BslZGPJ5kk.L.F4.O/am=zyBI5xH_3XvvH4Dfcx4GoAMABg/d=1/exm=LQaXg,Z8wCif,_b/excm=_b/ed=1/br=1/wt=2/ujg=1/rs=AL3bBk1MesyyREWnAUpdwBF5f7ERJwSYbA/ee=DGWCxb:CgYiQ;Pjplud:PoEs9b;QGR0gd:Mlhmy;ScI3Yc:e7Hzgb;Uvc8o:VDovNc;YIZmRd:A1yn5d;cEt90b:ws9Tlc;dowIGb:ebZ5mb;lOO0Vd:OTA3Ae;qafBPd:ovKuLd/m=CfTzb"; // Storing URL in a variable for clarity
    
        const response = await fetch(url);
    
        // Check if the fetch was successful
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        // Get the response body as text
        const rawDatesText = await response.text();
    
        const dateRegex = /this\.[a-zA-Z]{3}="(\d{4}\.\d{2}\.\d{2})";/g;
        let dates = [];
    
        for (const match of rawDatesText.matchAll(dateRegex)) {
            dates.push(match[1]);
        }
        const previousDatesToCompare = await getMiscData("geminiDates");
        const currentDatesToCompare = dates.map(date => date.replace(/\./g, "-"));
        const additions = currentDatesToCompare.filter(date => !previousDatesToCompare.includes(date));
        const deletions = previousDatesToCompare.filter(date => !currentDatesToCompare.includes(date));
        const formatedDetails = `Added dates: ${additions.join(', ')} Removed dates: ${deletions.join(', ')}`;
        if (additions.length === 0 && deletions.length === 0) {
            console.log("No changes detected in the dates.");
            return;
        }
        // Update feed - type, details, appId, date
        await updateMiscData("geminiDates", currentDatesToCompare);
        const dataToUpdate = {
            type: 'geminiDates',
            details: formatedDetails,
            appId: 'Gemini Web App',
            date: new Date().toISOString()
        }
        await updateFeed(dataToUpdate);
        console.log("Feed updated successfully with the new or removed dates.");

    } catch (error) {
      console.error("Error fetching or processing dates:", error);
    }
  }