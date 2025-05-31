import { chromium } from "playwright";
import Table from 'terminal-table';
import { getMiscData, updateMiscData, updateFeed } from "@/utils/db";
import { leaderboardTypeMap } from "@/app/consts";
import list from "app-store-scraper/lib/list";

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
    browser.close();

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
        const detailsToUpdateFeed = {
            type: 'leaderboard',
            details: 'New leaderboard data for ' + leaderboardTypeMap[leaderboardIdsJson[i].leaderboards[0].name],
            appId: 'lmarena'
        }
        await updateFeed(detailsToUpdateFeed);

    }
}