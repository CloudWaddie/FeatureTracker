import sitemapController from './sitemaps/controller.js';
import lmarenaController from './lmarena/controller.js';

export default async function webController() {
    console.log("Running web controller...");
    await sitemapController();
    await lmarenaController();
    return "Web controller is running...";
}