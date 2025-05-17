import sitemapController from './sitemaps/controller.js';
import lmarenaController from './lmarena/controller.js';
import geminiDatesController from './geminiDates/controller.js';
import feedController from './feeds/controller.js';

export default async function webController() {
    console.log("Running web controller...");
    //await sitemapController();
    //await lmarenaController();
    //await geminiDatesController();
    await feedController();
    return "Web controller is running...";
}