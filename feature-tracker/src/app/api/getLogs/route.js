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
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return a Promise that resolves with the Response object
    return new Promise((resolve) => {
      const stream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
      const parsedLogs = [];
      let validLineFound = false;
      let leftover = ''; // To handle partial lines from chunks

      stream.on('data', (chunk) => {
        const lines = (leftover + chunk).split('\n');
        leftover = lines.pop() || ''; // Ensure leftover is always a string, handles last line correctly

        for (const line of lines) {
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
            logger.warn(`Skipping invalid JSON line in log file '${logFilePath}':`, lineParseError.message, "Line content (first 200 chars):", line.substring(0, 200));
          }
        }
      });

      stream.on('end', () => {
        // Process any leftover data from the last chunk
        if (leftover.trim() !== '') {
          try {
            const logEntry = JSON.parse(leftover);
            parsedLogs.push({
              timestamp: new Date(logEntry.time).toISOString(),
              level: pinoLevelToString(logEntry.level),
              message: logEntry.msg,
              hostname: logEntry.hostname,
              pid: logEntry.pid,
            });
            validLineFound = true;
          } catch (lineParseError) {
            logger.warn(`Skipping invalid JSON line (final leftover) in log file '${logFilePath}':`, lineParseError.message, "Line content (first 200 chars):", leftover.substring(0, 200));
          }
        }

        try {
            const fileStats = fs.statSync(logFilePath); // Get file stats to check if it had content

            // If the file had content but no valid logs were parsed
            if (fileStats.size > 0 && !validLineFound) {
                logger.error(`Log file '${logFilePath}' contained content (${fileStats.size} bytes), but no lines could be parsed as valid JSON.`);
                resolve(new Response(JSON.stringify({ message: 'Log file contains invalid data that could not be parsed.', error: "No valid log entries found." }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }));
                return;
            }
        } catch (statError) {
            // This might happen if the file is deleted between existsSync and statSync, or permission issues
            logger.error(`Error getting stats for log file '${logFilePath}' during stream end:`, statError);
            resolve(new Response(JSON.stringify({ message: 'Error processing log file (could not get file stats).', error: statError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }));
            return;
        }
        
        // If no logs were parsed (e.g., empty file, or file with only whitespace/invalid lines and size was 0 or stat failed gracefully)
        if (parsedLogs.length === 0) {
            resolve(new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));
            return;
        }
        
        // Successfully parsed logs
        resolve(new Response(JSON.stringify(parsedLogs), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      });

      stream.on('error', (streamError) => {
        logger.error(`Error reading log file stream '${logFilePath}':`, streamError);
        resolve(new Response(JSON.stringify({ message: 'Error reading log file', error: streamError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }));
      });
    });

  } catch (error) { // Catches synchronous errors before Promise creation (e.g., path.join issues, or initial fs.existsSync failure)
    logger.error(`Unexpected synchronous error in GET /api/getLogs for '${logFilePath}':`, error);
    return new Response(JSON.stringify({ message: 'An unexpected server error occurred', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
