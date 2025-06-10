import logger from '../../../lib/logger.js';
import sitemapController from './sitemaps/controller.js';
import lmarenaController from './lmarena/controller.js';
import geminiDatesController from './geminiDates/controller.js';
import feedController from './feeds/controller.js';
import domainFinderController from './domainFinders/controller.js';
import geminiValuesController from './geminiValues/controller.js';
import googleLabsController from './googleLabs/controller.js';
import geminiPreferencesController from './geminiPreferences/controller.js';
import chatgptStringsController from './chatgptStrings/controller.js';
import lmLeaderboardsController from './lmLeaderboards/controller.js';
import perplexityStringsController from './perplexityStrings/controller.js';
import claudeStringsController from './claudeStrings/controller.js';
import claudeInternalStringsController from './claudeInternalStrings/controller.js';
import geminiButtonsController from './geminiButtons/controller.js';
import geminiModelsController from './geminiModels/controller.js';

const controllers = [
    sitemapController,
    geminiDatesController,
    feedController,
    domainFinderController,
    geminiValuesController,
    geminiPreferencesController,
    geminiButtonsController,
    geminiModelsController
];

const runIndividually = [
    chatgptStringsController,
    lmLeaderboardsController,
    perplexityStringsController,
    claudeStringsController,
    googleLabsController,
    lmarenaController,
    claudeInternalStringsController
];

export default async function webController() {
    logger.info("Running web controller...");
    const results = await Promise.all(controllers.map(controller => controller()));
    for (const controller of runIndividually) {
        try {
            await controller();
        } catch (error) {
            logger.error({ error }, `Error running controller: ${controller.name}`);
        }
    }
    logger.info({ results }, "Web controller tasks completed");
    return "Web controller is running...";
}
