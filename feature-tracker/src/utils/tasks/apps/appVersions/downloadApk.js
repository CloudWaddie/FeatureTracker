import { promises as fs } from 'fs'; // Changed to fs.promises
import { spawn } from 'child_process'; // Changed to use spawn
import path from 'path';
import os from 'os';
import logger from '../../../../lib/logger.js';

export default async function downloadApk(appId) {
  // Placeholder for apkeep logic
  logger.info(`Attempting to download APK for: ${appId}`);

  const isWindows = os.platform() === 'win32';
  const apkeepExecutable = isWindows ? 'apkeep-windows.exe' : 'apkeep-linux';
  const apkeepPath = path.resolve(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', apkeepExecutable);
  const apkFilesDir = path.resolve(process.cwd(), 'apk-files');
  let source = 'google-play';

  try {
    logger.info("Preparing APK directory:", apkFilesDir);
    try {
      // Check if directory exists
      await fs.access(apkFilesDir);
      logger.info("Directory exists, deleting old APK files...");
      const files = await fs.readdir(apkFilesDir);
      for (const file of files) {
        const filePath = path.join(apkFilesDir, file);
        try {
          await fs.rm(filePath, { recursive: true, force: true });
          logger.info("Deleted:", filePath);
        } catch (err) {
          logger.error({ err, filePath }, `Error deleting ${filePath}`);
          // Decide if this error is critical enough to stop
        }
      }
    } catch (error) {
      // If directory doesn't exist (ENOENT) or other access error
      if (error.code === 'ENOENT') {
        logger.info("Creating directory:", apkFilesDir);
        await fs.mkdir(apkFilesDir, { recursive: true });
      } else {
        logger.error({ err: error, apkFilesDir }, "Error accessing or preparing APK directory");
        throw error; // Re-throw if it's not a simple "not found" error
      }
    }

    logger.info(`Executing apkeep for: ${appId}`);
    const apkeepProcess = spawn(apkeepPath, [
      '--accept-tos',
      '-d', source,
      '--aas-token', process.env.AAS_TOKEN,
      '-e', process.env.APK_EMAIL,
      '-a', appId,
      apkFilesDir
    ]);

    apkeepProcess.stdout.on('data', (data) => {
      logger.info(`stdout: ${data}`);
    });

    apkeepProcess.stderr.on('data', (data) => {
      logger.error(`stderr: ${data}`); // apkeep might output progress to stderr
    });

    const exitCode = await new Promise((resolve, reject) => {
      apkeepProcess.on('close', resolve);
      apkeepProcess.on('error', reject);
    });

    if (exitCode !== 0) {
      throw new Error(`apkeep process exited with code ${exitCode}`);
    }

    logger.info(`Successfully initiated APK download for ${appId}`);
    // Add further processing here, e.g., moving the file, extracting info, etc.
  } catch (error) {
    logger.error({ err: error, appId }, `Failed to download APK for ${appId}`);
    // Handle errors, e.g., apkeep not found, download failed, etc.
  }
}
