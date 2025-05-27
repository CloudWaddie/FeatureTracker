import appVersionController from "./appVersions/controller.js";
import logger from '../../../lib/logger.js';

export default async function appController() {
    logger.info("Running app controller...");
    await appVersionController();
    logger.info("App controller tasks completed.");
    return "All tasks are running...";
}
