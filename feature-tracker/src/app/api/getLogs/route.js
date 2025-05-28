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
      let validLineFound = false;
      let leftover = ''; // To handle partial lines from chunks

      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => {
            const lines = (leftover + chunk).split('\n');
            leftover = lines.pop() || ''; // Ensure leftover is always a string, handles last line correctly

            for (const line of lines) {
              if (line.trim() === '') continue; // Skip empty lines

              try {
                const logEntry = JSON.parse(line);
                const parsedLog = {
                  timestamp: new Date(logEntry.time).toISOString(),
                  level: pinoLevelToString(logEntry.level),
                  message: logEntry.msg,
                  hostname: logEntry.hostname,
                  pid: logEntry.pid,
                  // Include other relevant fields from logEntry if needed
                };
                controller.enqueue(JSON.stringify(parsedLog) + '\n');
                validLineFound = true;
              } catch (lineParseError) {
                logger.warn({ 
                  message: `Skipping invalid JSON line in log file`,
                  logFilePath,
                  error: lineParseError.message,
                  lineContent: line.substring(0, 200)
                });
              }
            }
          });

          stream.on('end', () => {
            if (leftover.trim() !== '') {
              try {
                const logEntry = JSON.parse(leftover);
                const parsedLog = {
                  timestamp: new Date(logEntry.time).toISOString(),
                  level: pinoLevelToString(logEntry.level),
                  message: logEntry.msg,
                  hostname: logEntry.hostname,
                  pid: logEntry.pid,
                };
                controller.enqueue(JSON.stringify(parsedLog) + '\n');
                validLineFound = true; // Set true if the last leftover line is valid
              } catch (lineParseError) {
                logger.warn(`Skipping invalid JSON line (final leftover) in log file '${logFilePath}':`, lineParseError.message, "Line content (first 200 chars):", leftover.substring(0, 200));
              }
            }

            // After processing all data, including leftover, check if any valid line was found.
            // This check is now implicitly handled by whether anything was enqueued.
            // If the stream ends and nothing was enqueued, the client receives an empty stream,
            // which is acceptable for an empty or fully invalid log file.
            // The specific error for "file had content but no valid logs" needs careful placement
            // if still desired, potentially by checking validLineFound before closing controller.

            if (!validLineFound) {
                try {
                    const fileStats = fs.statSync(logFilePath);
                    if (fileStats.size > 0) {
                        logger.error(`Log file '${logFilePath}' contained content (${fileStats.size} bytes), but no lines could be parsed as valid JSON.`);
                        // Enqueue an error object or a special marker if the stream should convey this error.
                        // Or, handle this by resolving the main promise with an error Response,
                        // but that's tricky with ReadableStream already started.
                        // For now, we'll let it close, and the client gets an empty stream.
                        // A more robust solution might involve a different status code or a trailer.
                    }
                } catch (statError) {
                     logger.error(`Error getting stats for log file '${logFilePath}' during stream end:`, statError);
                }
            }
            controller.close();
          });

          stream.on('error', (error) => {
            logger.error(`Error reading log file stream '${logFilePath}':`, error);
            controller.error(error); // Propagate the error to the ReadableStream
          });
        },
      });

      resolve(new Response(readableStream, {
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
      }));
    });

  } catch (error) { // Catches synchronous errors before Promise creation
    logger.error(`Unexpected synchronous error in GET /api/getLogs for '${logFilePath}':`, error);
    return new Response(JSON.stringify({ message: 'An unexpected server error occurred', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
