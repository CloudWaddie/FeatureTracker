import sitemapController from './sitemaps/controller.js';
import lmarenaController from './lmarena/controller.js';
import geminiDatesController from './geminiDates/controller.js';
import feedController from './feeds/controller.js';
import domainFinderController from './domainFinders/controller.js';

export default async function webController() {
    console.log("Running web controller...");
    await sitemapController();
    await lmarenaController();
    await geminiDatesController();
    await feedController();
    await domainFinderController();
    return "Web controller is running...";
}