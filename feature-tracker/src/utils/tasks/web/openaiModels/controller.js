import logger from "../../../../lib/logger.js";
import { getMiscData, updateMiscData, updateFeed } from '../../../db.js'

export default async function openaiModelsController() {
    // Get some juicy data from the chatgpt ListModels API
    const response = await fetch(`https://api.openai.com/v1/models`, {headers: {
        'Authorization': `Bearer ${process.env.CHATGPT_API_KEY}`
    }});
    if (!response.ok) {
        logger.error('Failed to fetch chatgpt models!');
        return;
    }
    // Parse the response (juicy data hehe) as JSON
    const models = await response.json();
    // Now get the old models (brother ughhhhh)
    let oldModels = await getMiscData('chatgptModelsApi');
    if (oldModels.length === 0 || !oldModels[0] || typeof oldModels[0].value !== 'string') {
        await updateMiscData('chatgptModelsApi', JSON.stringify(models));
        logger.info('Updated chatgpt models in the database');
        return;
    }
    if (oldModels[0].value) {
        try {
            oldModels = JSON.parse(oldModels[0].value);
        } catch (error) {
            logger.error(`Failed to parse old models JSON: ${error.message}`);
            oldModels = null;
        }
    } else {
        oldModels = null;
    }
    // If the old models are empty, we need to update them
    // Not empty so find additions and removals
    const newModels = models.data.filter(model => !oldModels.data.some(oldModel => oldModel.id === model.id));
    const removedModels = oldModels.data.filter(oldModel => !models.data.some(model => model.id === oldModel.id));
    // If there are new models, we need to update the database
    if (newModels.length > 0 || removedModels.length > 0) {
        // Update the database with the new models
        await updateMiscData('chatgptModelsApi', JSON.stringify(models));
        logger.info(`Updated chatgpt models in the database. New: ${newModels.length}, Removed: ${removedModels.length}`);
        let formattedDetails = '';
        if (newModels.length > 0) {
            formattedDetails += `New models: ${newModels.map(model => model.id).join(', ')}. `;
        }
        if (removedModels.length > 0) {
            formattedDetails += `Removed models: ${removedModels.map(model => model.id).join(', ')}. `;
        } 
        const details = {
            type: 'models',
            appId: 'ChatGPT API',
            details: formattedDetails
        }
        await updateFeed(details);
    }
}
