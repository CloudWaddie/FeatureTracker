import appController from "./apps/controller.js";
import webController from "./web/controller.js";
import logger from '../../lib/logger.js';

const controllers = [appController/*, webController*/];

export default async function runAllTasks() {
    logger.info("Starting all tasks...");
    const results = await Promise.all(controllers.map(controller => controller()));
    logger.info({ results }, "All tasks completed.");
    return "All tasks are running...";
}
