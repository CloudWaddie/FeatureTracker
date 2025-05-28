import sitemapController from './sitemaps/controller.js';
import lmarenaController from './lmarena/controller.js';
import geminiDatesController from './geminiDates/controller.js';
import feedController from './feeds/controller.js';
import domainFinderController from './domainFinders/controller.js';
import geminiPreferencesController from './geminiPreferences/controller.js';
import logger from '../../../lib/logger.js';

const controllers = [
    sitemapController,
    lmarenaController,
    geminiDatesController,
    feedController,
    domainFinderController
];

export default async function webController() {
    logger.info("Running web controller...");
    const results = await Promise.all(controllers.map(controller => controller()));
    logger.info({ results }, "Web controller tasks completed");
    return "Web controller is running...";
}
