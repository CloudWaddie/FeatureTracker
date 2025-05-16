// server.js
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import startScheduler from './src/utils/scheduler.js';

const port = parseInt(process.env.PORT || '45819', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  console.log('Next.js app prepared.');
  startScheduler();
  console.log('Scheduler initialization triggered.');

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => { // Use the callback to log when listening starts
    if (err) {
      console.error(`Failed to start server on port ${port}:`, err);
      process.exit(1); // Exit the process with a failure code
    }
    console.log(
      `> Server listening at http://localhost:${port} as ${
        dev ? 'development' : process.env.NODE_ENV
      }`
    );
  });
});
