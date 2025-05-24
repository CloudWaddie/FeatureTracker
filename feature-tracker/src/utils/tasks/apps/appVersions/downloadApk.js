import { promises as fs } from 'fs'; // Changed to fs.promises
import { exec as execCallback } from 'child_process'; // Changed to exec
import util from 'util'; // To promisify exec
import path from 'path';
import os from 'os';

const exec = util.promisify(execCallback); // Promisify exec

export default async function downloadApk(appId) {
  // Placeholder for apkeep logic
  console.log(`Attempting to download APK for: ${appId}`);

  const isWindows = os.platform() === 'win32';
  const apkeepExecutable = isWindows ? 'apkeep-windows.exe' : 'apkeep-linux';
  const apkeepPath = path.resolve(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', apkeepExecutable);
  const apkFilesDir = path.resolve(process.cwd(), 'apk-files');

  // Ensure the output directory for apkeep is absolute and quoted if it contains spaces, though 'apk-files' does not.
  const command = `"${apkeepPath}" --accept-tos -d google-play --aas-token "${process.env.AAS_TOKEN}" -e "${process.env.APK_EMAIL}" -a ${appId} "${apkFilesDir}"`;

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

    console.log(`Executing: ${command}`);
    // Using promisified exec. stdio: 'inherit' is not directly supported in the same way.
    // We can capture stdout and stderr and log them.
    const { stdout, stderr } = await exec(command);
    if (stdout) console.log('stdout:', stdout);
    if (stderr) console.error('stderr:', stderr); // apkeep might output progress to stderr

    console.log(`Successfully initiated APK download for ${appId}`);
    // Add further processing here, e.g., moving the file, extracting info, etc.
  } catch (error) {
    console.error(`Failed to download APK for ${appId}: ${error.message}`);
    if (error.stdout) console.error(`Stdout: ${error.stdout.toString()}`);
    if (error.stderr) console.error(`Stderr: ${error.stderr.toString()}`);
    // Handle errors, e.g., apkeep not found, download failed, etc.
  }
}
