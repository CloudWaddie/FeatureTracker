import { promises as fs } from 'fs'; // Changed to fs.promises
import { spawn } from 'child_process'; // Changed to use spawn
import path from 'path';
import os from 'os';

export default async function downloadApk(appId) {
  // Placeholder for apkeep logic
  console.log(`Attempting to download APK for: ${appId}`);

  const isWindows = os.platform() === 'win32';
  const apkeepExecutable = isWindows ? 'apkeep-windows.exe' : 'apkeep-linux';
  const apkeepPath = path.resolve(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', apkeepExecutable);
  const apkFilesDir = path.resolve(process.cwd(), 'apk-files');
  let source = 'google-play';

  try {
    console.log("Preparing APK directory:", apkFilesDir);
    try {
      // Check if directory exists
      await fs.access(apkFilesDir);
      console.log("Directory exists, deleting old APK files...");
      const files = await fs.readdir(apkFilesDir);
      for (const file of files) {
        const filePath = path.join(apkFilesDir, file);
        try {
          await fs.rm(filePath, { recursive: true, force: true });
          console.log("Deleted:", filePath);
        } catch (err) {
          console.error(`Error deleting ${filePath}:`, err);
          // Decide if this error is critical enough to stop
        }
      }
    } catch (error) {
      // If directory doesn't exist (ENOENT) or other access error
      if (error.code === 'ENOENT') {
        console.log("Creating directory:", apkFilesDir);
        await fs.mkdir(apkFilesDir, { recursive: true });
      } else {
        console.error("Error accessing or preparing APK directory:", error);
        throw error; // Re-throw if it's not a simple "not found" error
      }
    }

    console.log(`Executing apkeep for: ${appId}`);
    const apkeepProcess = spawn(apkeepPath, [
      '--accept-tos',
      '-d', source,
      '--aas-token', process.env.AAS_TOKEN,
      '-e', process.env.APK_EMAIL,
      '-a', appId,
      apkFilesDir
    ]);

    apkeepProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    apkeepProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`); // apkeep might output progress to stderr
    });

    const exitCode = await new Promise((resolve, reject) => {
      apkeepProcess.on('close', resolve);
      apkeepProcess.on('error', reject);
    });

    if (exitCode !== 0) {
      throw new Error(`apkeep process exited with code ${exitCode}`);
    }

    console.log(`Successfully initiated APK download for ${appId}`);
    // Add further processing here, e.g., moving the file, extracting info, etc.
  } catch (error) {
    console.error(`Failed to download APK for ${appId}: ${error.message}`);
    // Handle errors, e.g., apkeep not found, download failed, etc.
  }
}
