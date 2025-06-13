import logger from "../../../../lib/logger.js";
import { getMiscData, updateMiscData, updateFeed } from '../../../db.js'

export default async function deepseekModelsController() {
    // Get data from the deepseek ListModels API
    const response = await fetch(`https://api.deepseek.com/models`, {
        headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        logger.error(`Failed to fetch deepseek models! Status: ${response.status}`);
        return;
    }

    let apiResponse;
    try {
        apiResponse = await response.json();
    } catch (e) {
        logger.error('Failed to parse deepseek models API response JSON:', e);
        return;
    }

    if (!apiResponse || typeof apiResponse !== 'object' || !Array.isArray(apiResponse.data)) {
        logger.error('Deepseek models API response is not in the expected format (object with a data array).');
        return;
    }
    const currentModelsList = apiResponse.data; // Actual list of models from API

    // Get the old models from the database
    let oldStoredResponse;
    let oldModelsList = []; // Default to empty list

    const oldModelsRaw = await getMiscData('deepseekModelsApi');
    if (oldModelsRaw.length === 0 || !oldModelsRaw[0] || typeof oldModelsRaw[0].value !== 'string') {
        // No valid existing data, treat as initial load.
        // Store the new data (apiResponse, which is the full object)
        await updateMiscData('deepseekModelsApi', JSON.stringify(apiResponse));
        logger.info('Initialized deepseek models in the database.');
        // To add feed update on initialization, uncomment and adapt this:
        // if (currentModelsList.length > 0) {
        //     const initDetails = { type: 'models', appId: 'deepseek API', details: `Initial models loaded: ${currentModelsList.map(model => model.id).join(', ')}.`};
        //     await updateFeed(initDetails);
        // }
        return;
    }

    try {
        oldStoredResponse = JSON.parse(oldModelsRaw[0].value);
    } catch (e) {
        logger.error('Failed to parse stored deepseek models JSON from database:', e);
        // Treat as if no valid old data; effectively re-initialize with current API data.
        await updateMiscData('deepseekModelsApi', JSON.stringify(apiResponse));
        logger.warn('Re-initialized deepseek models due to parsing error of stored data.');
        return;
    }

    if (!oldStoredResponse || typeof oldStoredResponse !== 'object' || !Array.isArray(oldStoredResponse.data)) {
        logger.warn('Stored deepseek models data is not in the expected format (object with a data array). Re-initializing.');
        // Treat as re-initialization.
        await updateMiscData('deepseekModelsApi', JSON.stringify(apiResponse));
        // Optionally, update feed about this re-initialization.
        return;
    }
    oldModelsList = oldStoredResponse.data; // Actual list of old models

    // Compare current models from API with old models from DB
    const newModels = currentModelsList.filter(model => !oldModelsList.some(oldModel => oldModel.id === model.id));
    const removedModels = oldModelsList.filter(oldModel => !currentModelsList.some(model => model.id === oldModel.id));

    if (newModels.length > 0 || removedModels.length > 0) {
        // Update the database with the new full response (apiResponse)
        await updateMiscData('deepseekModelsApi', JSON.stringify(apiResponse));
        logger.info(`Updated deepseek models in the database. New: ${newModels.length}, Removed: ${removedModels.length}`);
        
        let formattedDetails = '';
        if (newModels.length > 0) {
            formattedDetails += `New models: ${newModels.map(model => model.id).join(', ')}. `;
        }
        if (removedModels.length > 0) {
            formattedDetails += `Removed models: ${removedModels.map(model => model.id).join(', ')}. `;
        } 
        const details = {
            type: 'models',
            appId: 'deepseek API',
            details: formattedDetails.trim() // Use trim to remove trailing space
        };
        await updateFeed(details);
    } else {
        logger.info('No changes detected in deepseek models.');
    }
}
