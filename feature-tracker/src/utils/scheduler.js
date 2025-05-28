import cron from 'node-cron';
import runAllTasks from './tasks/controller.js'; // Import the function to run all tasks
import logger from '../lib/logger.js'; // Import the logger
import { cwd } from 'process'; // Import cwd to get the current working directory
import path from 'path'; // Import path to handle file paths
import fs from 'fs'; // Import fs to handle file system operations

let taskRunning = false;

const runMyScheduledTask = async () => {
  if (taskRunning) {
    logger.info('Scheduled task is already running, skipping.');
    return;
  }
  taskRunning = true;
  logger.info('Running scheduled task...');
  try {
    logger.info('Performing the scheduled task...');
    // Simulate a task that takes some time to complete
    logger.info(await runAllTasks()); // Call the function to run all tasks
    logger.info('Scheduled task finished successfully.');
  } catch (error) {
    logger.error({ err: error }, 'Error during scheduled task');
  } finally {
    taskRunning = false;
  }
};

export { runMyScheduledTask }; // Export the function for external use

let schedulerStarted = false; // Flag to ensure scheduler only starts once

const startScheduler = () => {
  if (schedulerStarted) {
    logger.info('Scheduler already started.');
    return;
  }

  logger.info('Attempting to start scheduler...');
  cron.schedule('*/30 * * * *', () => {
    logger.info('Triggering scheduled task via cron...');
    runMyScheduledTask();
  });

  schedulerStarted = true;
  logger.info('Scheduler successfully started.');
};

// Clear the logs file every 24 hours
cron.schedule('0 0 * * *', () => {
  logger.info('Clearing logs file...');
  const logFilePath = path.join(cwd(), 'logs', 'app.log');
  if (fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, '', 'utf8'); // Clear the log file
    logger.info('Logs file cleared successfully.');
  } else {
    logger.warn('Logs file does not exist, skipping clear operation.');
  }
}
);

export default startScheduler;
