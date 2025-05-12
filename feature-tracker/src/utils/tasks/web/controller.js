import sitemapController from './sitemaps/controller.js';

export default async function webController() {
    console.log("Running web controller...");
    await sitemapController(); // Call the sitemap controller function
    return "Web controller is running...";
}