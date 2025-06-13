import logger from "../../../../lib/logger.js";
import { getMiscData, updateMiscData, updateFeed } from '../../../db.js'

export default async function anthropicModelsController() {
    // Get some juicy data from the anthropic ListModels API
    const response = await fetch(`https://api.anthropic.com/v1/models`, {headers: {
        'x-api-key': `${process.env.ANTHROPIC_API_KEY}`,
        'anthropic-version': '2023-06-01'
    }});
    if (!response.ok) {
        logger.error('Failed to fetch anthropic models!');
        return;
    }
    // Parse the response (juicy data hehe) as JSON
    const models = await response.json();
    // Now get the old models (brother ughhhhh)
    let oldModels = await getMiscData('anthropicModelsApi');
    if (oldModels.length === 0 || !oldModels[0] || typeof oldModels[0].value !== 'string') {
        await updateMiscData('anthropicModelsApi', JSON.stringify(models));
        logger.info('Updated anthropic models in the database');
        return;
    }
    oldModels = oldModels[0].value ? JSON.parse(oldModels[0].value) : null;

    const oldModelObjectsArray = (oldModels && oldModels.data && Array.isArray(oldModels.data))
        ? oldModels.data // Current/new format (object with a 'data' array)
        : (oldModels && Array.isArray(oldModels))
            ? oldModels // Legacy format (array directly)
            : [];

    // Find additions and removals by comparing the new API data with the (potentially legacy) stored data.
    const newModels = models.data.filter(model => !oldModelObjectsArray.some(oldModel => oldModel.id === model.id));
    const removedModels = oldModelObjectsArray.filter(oldModel => !models.data.some(model => model.id === oldModel.id));
    // If there are new models, we need to update the database
    if (newModels.length > 0 || removedModels.length > 0) {
        // Update the database with the new models
        await updateMiscData('anthropicModelsApi', JSON.stringify(models));
        logger.info(`Updated anthropic models in the database. New: ${newModels.length}, Removed: ${removedModels.length}`);
        let formattedDetails = '';
        if (newModels.length > 0) {
            formattedDetails += `New models: ${newModels.map(model => model.id).join(', ')}. `;
        }
        if (removedModels.length > 0) {
            formattedDetails += `Removed models: ${removedModels.map(model => model.id).join(', ')}. `;
        } 
        const details = {
            type: 'models',
            appId: 'Anthropic API',
            details: formattedDetails
        }
        await updateFeed(details);
    }
}
