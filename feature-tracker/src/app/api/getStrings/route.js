import { cwd } from 'process';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    if (!appId) {
        return new Response(JSON.stringify({ error: 'Missing appId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // If there are any slashes in the appId, return an error
    if (appId.includes('/')) {
        return new Response(JSON.stringify({ error: 'Invalid appId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const filePath = join(cwd(), 'src', 'utils', 'tasks', 'apps', 'resources' ,'strings', `${appId}-strings.xml`);
    try {
        const fileContent = await readFile(filePath, 'utf8');
        return new Response(fileContent, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    } catch (error) {
        console.error('Error reading strings file:', error);
        return new Response(JSON.stringify({ error: 'Error reading strings file' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800, must-revalidate' } });
    }
}