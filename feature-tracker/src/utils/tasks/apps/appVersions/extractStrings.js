import { exec as execCallback } from 'child_process'; // Changed to exec
import util from 'util'; // To promisify exec
import path from 'path';
import { promises as fs } from 'fs'; // Import fs.promises
import logger from '../../../../lib/logger.js';

const exec = util.promisify(execCallback); // Promisify exec

export default async function extractStrings(apkPath) {
    // Use apktool to extract strings from the APK
    const apktoolPath = path.resolve(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', 'apktool.jar');
    const baseOutputDir = path.join(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', 'apk-extracted');
    const outputDir = path.join(baseOutputDir, path.basename(apkPath, '.apk'));

    try {
        // Ensure the base output directory exists
        await fs.mkdir(baseOutputDir, { recursive: true });
        logger.info(`Ensured base output directory exists: ${baseOutputDir}`);
    } catch (error) {
        logger.error({ err: error, baseOutputDir }, `Error creating base output directory ${baseOutputDir}`);
        throw error; // Re-throw if directory creation fails
    }
    
    const command = `java -jar "${apktoolPath}" d -f -o "${outputDir}" --no-src --no-assets "${apkPath}"`;
    logger.info(`Executing: ${command}`);

    try {
        const { stdout, stderr } = await exec(command);
        if (stdout) logger.info('stdout:', stdout);
        if (stderr) logger.error('stderr:', stderr); // apktool might output progress/errors to stderr
        logger.info(`APK extracted to: ${outputDir}`);
    } catch (error) {
        logger.error({ err: error, apkPath, stdout: error.stdout?.toString(), stderr: error.stderr?.toString() }, `Failed to extract strings from APK ${apkPath}`);
        throw error; // Re-throw the error to be handled by the caller
    }
    
    // Return the path to the extracted strings
    const stringsFilePath = path.join(outputDir, 'res', 'values', 'strings.xml');
    return stringsFilePath;
}
