import store from "app-store-scraper";
import { NextResponse } from "next/server";
import logger from '@/lib/logger';


export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const appId = searchParams.get('appId')
    // Keep initialLastUpdated as a string initially as it comes from search params
    let initialLastUpdatedStr = searchParams.get('lastUpdated')

    if (!appId) {
        // Use NextResponse for consistency
        return NextResponse.json({ error: 'Missing appId' }, { status: 400 })
    }

    // Parse initialLastUpdated string into a number (milliseconds since epoch)
    // Default to 0 if not provided or if parsing fails
    let initialLastUpdatedNum = 0;
    if (initialLastUpdatedStr) {
        const parsed = parseInt(initialLastUpdatedStr, 10);
        if (!isNaN(parsed)) {
            initialLastUpdatedNum = parsed;
        } else {
            logger.warn(`initialLastUpdated '${initialLastUpdatedStr}' is not a valid number. Defaulting to 0.`);
        }
    } else {
        logger.info('initialLastUpdated not provided, defaulting to 0');
    }


    try {
        // Await the promise chain and return the result
        const appDetails = await store.app({id: appId})
        const lastUpdatedStr = appDetails?.updated // This will be the date string like "2025-05-05T17:27:44Z"

        if (!lastUpdatedStr) {
            // Use NextResponse
            return NextResponse.json({ error: 'App lastUpdated not found' }, { status: 404 })
        }

        // Convert the lastUpdated date string into milliseconds since epoch
        const lastUpdatedNum = Date.parse(lastUpdatedStr);

        if (isNaN(lastUpdatedNum)) {
            logger.error('Error parsing lastUpdated string from store:', lastUpdatedStr);
            // Use NextResponse for consistency
            return NextResponse.json({ error: 'Invalid date format received from store' }, { status: 500 })
        }

        // Now compare the numerical timestamps
        if (lastUpdatedNum > initialLastUpdatedNum) {
            // Use NextResponse
            // Return the numerical timestamp for consistency on the client side if needed
            return NextResponse.json({ updateAvailable: true, lastUpdated: lastUpdatedNum, updateString: appDetails.releaseNotes, details: appDetails.descriptionHtml, package: appDetails.appId, id: appDetails.id }, { status: 200 })
        } else {
            // Use NextResponse
            return NextResponse.json({ updateAvailable: false }, { status: 200 })
        }
    }
    catch (error) {
        logger.error('Error fetching app version:', error)
        // Use NextResponse
        return NextResponse.json({ error: 'Error fetching app version' }, { status: 500 })
    }
}