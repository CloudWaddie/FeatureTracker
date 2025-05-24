import { exec as execCallback } from 'child_process'; // Changed to exec
import util from 'util'; // To promisify exec
import path from 'path';

const exec = util.promisify(execCallback); // Promisify exec

export default async function extractStrings(apkPath) {
    // Use apktool to extract strings from the APK
    const apktoolPath = path.resolve(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', 'apktool.jar');
    const outputDir = path.join(process.cwd(), 'src', 'utils', 'tasks', 'apps', 'resources', 'apk-extracted', path.basename(apkPath, '.apk'));
    
    const command = `java -jar "${apktoolPath}" d -f -o "${outputDir}" --no-src --no-assets "${apkPath}"`;
    console.log(`Executing: ${command}`);

    try {
        const { stdout, stderr } = await exec(command);
        if (stdout) console.log('stdout:', stdout);
        if (stderr) console.error('stderr:', stderr); // apktool might output progress/errors to stderr
        console.log(`APK extracted to: ${outputDir}`);
    } catch (error) {
        console.error(`Failed to extract strings from APK ${apkPath}: ${error.message}`);
        if (error.stdout) console.error(`Stdout: ${error.stdout.toString()}`);
        if (error.stderr) console.error(`Stderr: ${error.stderr.toString()}`);
        throw error; // Re-throw the error to be handled by the caller
    }
    
    // Return the path to the extracted strings
    const stringsFilePath = path.join(outputDir, 'res', 'values', 'strings.xml');
    return stringsFilePath;
}
