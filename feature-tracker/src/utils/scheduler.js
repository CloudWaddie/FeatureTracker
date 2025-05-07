import cron from 'node-cron';

let taskRunning = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const runMyScheduledTask = async () => {
  if (taskRunning) {
    console.log('Scheduled task is already running, skipping.');
    return;
  }
  taskRunning = true;
  console.log('Running scheduled task...');
  try {
    console.log('Performing the scheduled task...');
    // Simulate a task that takes some time to complete
    await delay(2000); // Simulate a 2-second delay
    console.log('Scheduled task finished successfully.');
  } catch (error) {
    console.error('Error during scheduled task:', error);
  } finally {
    taskRunning = false;
  }
};

export { runMyScheduledTask }; // Export the function for external use

let schedulerStarted = false; // Flag to ensure scheduler only starts once

const startScheduler = () => {
  if (schedulerStarted) {
    console.log('Scheduler already started.');
    return;
  }

  console.log('Attempting to start scheduler...');
  cron.schedule('*/5 * * * *', () => {
    console.log('Triggering scheduled task via cron...');
    runMyScheduledTask();
  });

  schedulerStarted = true;
  console.log('Scheduler successfully started.');
};

export default startScheduler;