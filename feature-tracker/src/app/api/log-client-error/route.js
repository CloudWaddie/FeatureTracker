import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { level = 'error', message, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const logData = context ? { ...context, clientMessage: message } : { clientMessage: message };

    switch (level.toLowerCase()) {
      case 'info':
        logger.info(logData);
        break;
      case 'warn':
        logger.warn(logData);
        break;
      case 'debug':
        logger.debug(logData);
        break;
      case 'fatal':
        logger.fatal(logData);
        break;
      case 'error':
      default:
        logger.error(logData);
        break;
    }

    return NextResponse.json({ success: true, message: 'Log received' }, { status: 200 });
  } catch (error) {
    // Use console.error here for issues within the logging endpoint itself
    console.error('Failed to process client log:', error);
    // Log to the main logger as well, but be careful of infinite loops if logger itself is broken
    logger.error({
        err: {
            message: error.message,
            stack: error.stack,
            name: error.name
        },
        context: 'log-client-error_api_itself'
    }, 'Error in /api/log-client-error endpoint');
    return NextResponse.json({ error: 'Failed to process log' }, { status: 500 });
  }
}
