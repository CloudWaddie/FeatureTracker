import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export async function logClientError(level, message, context = {}) {
  try {
    await fetch('/api/log-client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ level, message, context }),
    });
  } catch (fetchError) {
    console.error('Failed to send client log to server:', fetchError);
    // Fallback to console.error if sending log to server fails
    console.error('Original client error:', { level, message, context });
  }
}
