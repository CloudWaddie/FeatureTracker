import sitemapController from './sitemaps/controller.js';
import lmarenaController from './lmarena/controller.js';
import geminiDatesController from './geminiDates/controller.js';
import feedController from './feeds/controller.js';
import domainFinderController from './domainFinders/controller.js';

const controllers = [
    sitemapController,
    lmarenaController,
    geminiDatesController,
    feedController,
    domainFinderController
];

export default async function webController() {
    console.log("Running web controller...");
    const results = await Promise.all(controllers.map(controller => controller()));
    console.log("Web controller tasks completed:", results);
    return "Web controller is running...";
}