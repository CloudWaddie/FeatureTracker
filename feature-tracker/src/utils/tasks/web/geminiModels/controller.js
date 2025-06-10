import logger from "../../../../lib/logger.js";
import { getMiscData, updateMiscData, updateFeed } from '../../../db.js'

export default async function geminiModelsController() {
    // Get some juicy data from the Gemini ListModels API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    if (!response.ok) {
        logger.error('Failed to fetch gemini models!');
        return;
    }
    // Parse the response (juicy data hehe) as JSON
    const models = JSON.parse(await response.text());
    // Now get the old models (brother ughhhhh)
    let oldModels = await getMiscData('geminiModelsApi');
    if (oldModels.length === 0 || !oldModels[0] || typeof oldModels[0].value !== 'string') {
        await updateMiscData('geminiModelsApi', JSON.stringify(models));
        logger.info('Updated gemini models in the database');
        return;
    }
    oldModels = oldModels[0].value ? JSON.parse(oldModels[0].value) : null;
    // If the old models are empty, we need to update them
    // Not empty so find additions and removals
    const newModels = models.models.filter(model => !oldModels.models.some(oldModel => oldModel.name === model.name));
    const removedModels = oldModels.models.filter(oldModel => !models.models.some(model => model.name === oldModel.name));
    // If there are new models, we need to update the database
    if (newModels.length > 0 || removedModels.length > 0) {
        // Update the database with the new models
        await updateMiscData('geminiModelsApi', JSON.stringify(models));
        logger.info(`Updated gemini models in the database. New: ${newModels.length}, Removed: ${removedModels.length}`);
        let formattedDetails = '';
        if (newModels.length > 0) {
            formattedDetails += `New models: ${newModels.map(model => model.name).join(', ')}. `;
        }
        if (removedModels.length > 0) {
            formattedDetails += `Removed models: ${removedModels.map(model => model.name).join(', ')}. `;
        } 
        const details = {
            type: 'models',
            appId: 'Gemini API',
            details: formattedDetails
        }
        await updateFeed(details);
    }
}