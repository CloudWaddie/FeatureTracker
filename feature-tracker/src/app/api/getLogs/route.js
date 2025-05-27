import fs from 'fs';
import path from 'path';
import { auth } from "@/auth";
import logger from '@/lib/logger';

// Pino log levels: https://getpino.io/#/docs/api?id=level-number
const PINO_LEVELS = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

function pinoLevelToString(levelNumber) {
  return PINO_LEVELS[levelNumber] || 'UNKNOWN';
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ message: "You must be logged in." }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
  try {
    if (!fs.existsSync(logFilePath)) {
      logger.warn('Log file does not exist:', logFilePath);
      return new Response(JSON.stringify([]), { // Return empty array if log file doesn't exist
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = fileContent.trim().split('\n');
    const parsedLogs = [];

    if (fileContent.trim() === '') {
      // Handle empty log file gracefully
      return new Response(JSON.stringify([]), { // Return empty array for no logs
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let validLineFound = false;
    for (const [index, line] of lines.entries()) {
      if (line.trim() === '') continue; // Skip empty lines

      try {
        const logEntry = JSON.parse(line);
        parsedLogs.push({
          timestamp: new Date(logEntry.time).toISOString(),
          level: pinoLevelToString(logEntry.level),
          message: logEntry.msg,
          hostname: logEntry.hostname,
          pid: logEntry.pid,
          // Include other relevant fields from logEntry if needed
        });
        validLineFound = true;
      } catch (lineParseError) {
        logger.warn(`Skipping invalid JSON line ${index + 1} in log file '${logFilePath}':`, lineParseError.message, "Line content (first 200 chars):", line.substring(0, 200));
        // Optionally, push a placeholder error log or just skip. Current: skip.
      }
    }

    // If there was content but nothing could be parsed, it's an error.
    // Check if lines array had non-empty content initially.
    const hadContent = lines.some(l => l.trim() !== '');
    if (hadContent && !validLineFound) {
      logger.error(`Log file '${logFilePath}' contained content, but no lines could be parsed as valid JSON.`);
      return new Response(JSON.stringify({ message: 'Log file contains invalid data that could not be parsed.', error: "No valid log entries found." }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsedLogs), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) { // This catch is for fs.readFileSync or other unexpected errors like permission issues
    logger.error(`Error reading or processing log file '${logFilePath}':`, error);
    const errorMessage = error.message || 'An unexpected error occurred';
    return new Response(JSON.stringify({ message: 'Error reading or processing log file', error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
