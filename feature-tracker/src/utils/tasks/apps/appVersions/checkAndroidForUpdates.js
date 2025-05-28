import logger from '../../../../lib/logger.js';

export default async function checkForUpdates(lastUpdated, app) { // <-- Make the function async
    logger.info(`Fetching app version for Android app: ${app}`);
  
    try {
      const response = await fetch(`${process.env.DOMAIN}/api/getAndroidAppVersion?appId=${app}&lastUpdated=${lastUpdated}`); // Fetch app version, await the fetch call
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json(); // <-- await parsing the JSON response

      return data;
  
    } catch (error) {
      logger.error({ err: error, app, lastUpdated }, "Error checking for Android app updates"); // <-- Log any errors
      return "Error checking for updates."; // <-- Return an error message
    }
  }
