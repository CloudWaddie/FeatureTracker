// lib/logger.js
import "server-cli-only";
import pino from 'pino';
import path from 'path';
import fs from 'fs'; // Required for fs.createWriteStream
import { mkdir } from 'fs/promises'; // For ensuring log directory exists

const logDirectory = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDirectory, 'app.log');

let logger;

// Asynchronously initialize the logger
async function initializeLogger() {
  try {
    // Asynchronously ensure the log directory exists
    await mkdir(logDirectory, { recursive: true });

    const streams = [
      { level: process.env.LOG_LEVEL || 'info', stream: process.stdout },
      { level: process.env.LOG_LEVEL || 'info', stream: fs.createWriteStream(logFilePath, { flags: 'a' }) }
    ];

    return pino({
      level: process.env.LOG_LEVEL || 'info', // Set top-level minimum
    }, pino.multistream(streams));

  } catch (error) {
    console.error("Failed to initialize pino logger with multistream, falling back to basic console logger:", error);
    // Fallback to a very basic pino console logger
    return pino({
      level: process.env.LOG_LEVEL || 'info',
    }); // Defaults to stdout
  }
}

// Initialize the logger and export it.
// This uses top-level await, so the module will provide the initialized logger.
logger = await initializeLogger();

export default logger;
