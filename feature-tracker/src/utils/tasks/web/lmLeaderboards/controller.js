import { chromium } from "playwright";
import { getMiscData, updateMiscData, updateFeed } from "../../../db.js";

export default async function lmLeaderboardsController() {

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    });
    await page.goto('https://lmarena.ai/leaderboard');
    const body = await page.content();

    const leaderboardIdRegex = /{\\["']leaderboards\\["']:\[{\\["']id\\["']:\\".+?\\["'],\\["']name\\["']:\\["'].+?\\["']/g;
    const leaderboardIds = body.match(leaderboardIdRegex) || [];
    const leaderboardIdsWithoutSlashes = leaderboardIds.map((item) => item.replace(/\\/g, ''));
    const leaderboardIdsWithoutSlashesAndBrackets = leaderboardIdsWithoutSlashes.map((item) => item + '}]}');
    const leaderboardIdsJson = leaderboardIdsWithoutSlashesAndBrackets.map((item) => JSON.parse(item));
    await page.close();
    await browser.close();

    let leaderboard_individual;
    let leaderboard_individual_without_slashes;
    let leaderboard_individual_json;

    let listOfLeaderboards = [];
    for (let i = 0; i < leaderboardIdsJson.length; i++) {
        const leaderboardName = leaderboardIdsJson[i].leaderboards[0].name;
        listOfLeaderboards.push(leaderboardName);
    }
    // Update the list of leaderboards in the database
    await updateMiscData('leaderboards', JSON.stringify(listOfLeaderboards));
    for (let i = 0; i < leaderboardIdsJson.length; i++) {
        const escapedLeaderboardId = leaderboardIdsJson[i].leaderboards[0].id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const leaderboard_individual_regex_string = 
            `{\\\\"id\\\\":\\\\"[a-zA-Z0-9-]+?\\\\",\\\\\\"leaderboardId\\\\":\\\\"${escapedLeaderboardId}\\\\",\\\\\\"modelName\\\\".+?\\\\\\"rank\\\\":\\d+?}`;
        
        const leaderboard_individual_regex = new RegExp(leaderboard_individual_regex_string, 'g');

        leaderboard_individual = body.match(leaderboard_individual_regex) || [];
        console.log('Found ' + leaderboard_individual.length + ' items for ' + leaderboardIdsJson[i].leaderboards[0].name);
        
        leaderboard_individual_without_slashes = leaderboard_individual.map((item) => item.replace(/\\/g, ''));
        // Parse the JSON
        try {
            leaderboard_individual_json = leaderboard_individual_without_slashes.map((item) => JSON.parse(item));
        } catch (e) {
            console.error("Failed to parse JSON for " + leaderboardIdsJson[i].leaderboards[0].name + ":", e);
            leaderboard_individual_json = []; // Initialize to empty array on error to prevent further issues
        }

        // Sort the leaderboard data by rank
        if (leaderboard_individual_json && leaderboard_individual_json.length > 0) {
            leaderboard_individual_json.sort((a, b) => a.rank - b.rank);
        }

        let currentLeaderboardData = await getMiscData(`leaderboard_${leaderboardIdsJson[i].leaderboards[0].name}`);
        currentLeaderboardData = currentLeaderboardData[0]
        if (!currentLeaderboardData || !currentLeaderboardData.value) {
            // Update the leaderboard data if it doesn't exist
            await updateMiscData(`leaderboard_${leaderboardIdsJson[i].leaderboards[0].name}`, JSON.stringify(leaderboard_individual_json));
            continue;
        }
        // Parse the current leaderboard data
        try {
            currentLeaderboardData = JSON.parse(currentLeaderboardData.value);
        } catch (e) {
            console.error("Failed to parse current leaderboard data for " + leaderboardIdsJson[i].leaderboards[0].name + ":", e);
            continue; // Skip this leaderboard if parsing fails
        }
        // Make an array of the current leaderboard data but just with the model name and rank
        const currentLeaderboardDataArray = currentLeaderboardData.map(item => ({
            modelName: item.modelName,
            rank: item.rank
        }));
        // Do the same with the new leaderboard data
        const newLeaderboardDataArray = leaderboard_individual_json.map(item => ({
            modelName: item.modelName,
            rank: item.rank
        }));
        // Compare the two arrays and see if there are any changes
        if (JSON.stringify(currentLeaderboardDataArray) === JSON.stringify(newLeaderboardDataArray)) {
            console.log('No changes for ' + leaderboardIdsJson[i].leaderboards[0].name);
            continue; // No changes, skip to the next leaderboard
        }
        // There are changes, so we want to update the leaderboard data
        await updateMiscData(`leaderboard_${leaderboardIdsJson[i].leaderboards[0].name}`, JSON.stringify(leaderboard_individual_json));
        // Make a HTML table with the leaderboard data, styled to be cleaner
        let table = `<table style="width: 100%; border-collapse: collapse; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 0.875rem;">`;
        table += `<thead>`;
        table += `<tr style="border-bottom: 1px solid #e2e8f0;">`; // e.g., Tailwind gray-200
        table += `<th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #ffffff; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">Rank</th>`; // White text
        table += `<th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #ffffff; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">Model Name</th>`; // White text
        table += `</tr>`;
        table += `</thead>`;
        table += `<tbody>`;
        if (leaderboard_individual_json && leaderboard_individual_json.length > 0) {
            for (let j = 0; j < leaderboard_individual_json.length; j++) {
                // Apply border-bottom to all data rows.
                table += `<tr style="border-bottom: 1px solid #e2e8f0;">`; // e.g., Tailwind gray-200
                table += `<td style="padding: 0.75rem 1rem; text-align: left; color: #ffffff;">${leaderboard_individual_json[j].rank}</td>`; // White text
                table += `<td style="padding: 0.75rem 1rem; text-align: left; color: #ffffff;">${leaderboard_individual_json[j].modelName}</td>`; // White text
                table += `</tr>`;
            }
        } else {
            table += `<tr><td colspan="2" style="padding: 0.75rem 1rem; text-align: center; color: #ffffff; border-bottom: 1px solid #e2e8f0;">No data available.</td></tr>`; // White text
        }
        table += `</tbody>`;
        table += `</table>`;
        // Update the feed with the new leaderboard data
        const detailsToUpdateFeed = {
            type: 'leaderboard',
            details: 'New leaderboard data for ' + leaderboardIdsJson[i].leaderboards[0].name + `\n` + table,
            appId: 'lmarena'
        }
        await updateFeed(detailsToUpdateFeed);

    }
}
