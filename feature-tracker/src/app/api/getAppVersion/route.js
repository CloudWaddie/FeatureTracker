import gplay, { app } from "google-play-scraper";
import { NextResponse } from "next/server";


export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const packageName = searchParams.get('packageName')
    let initialLastUpdated = searchParams.get('lastUpdated')

    if (!packageName) {
        // Use NextResponse for consistency
        return NextResponse.json({ error: 'Missing packageName' }, { status: 400 })
    }
    if (!initialLastUpdated) {
        initialLastUpdated = '0' // Default to 0 if initialLastUpdated is not provided
        console.log('initialLastUpdated not provided, defaulting to 0')
    }

    try {
        // Await the promise chain and return the result
        const appDetails = await gplay.app({appId: packageName})
        console.log('App details:', appDetails)
        const lastUpdated = appDetails?.updated
        if (!lastUpdated) {
            // Use NextResponse
            return NextResponse.json({ error: 'App lastUpdated not found' }, { status: 404 })
        }
        console.log('App lastUpdated:', initialLastUpdated)

        if (lastUpdated > parseInt(initialLastUpdated, 10)) { // Ensure comparison is numeric
            // Use NextResponse
            return NextResponse.json({ updateAvailable: true, lastUpdated: lastUpdated, updateString: appDetails.recentChanges, details: appDetails.descriptionHtml }, { status: 200 })
        } else {
            // Use NextResponse
            return NextResponse.json({ updateAvailable: false }, { status: 200 })
        }
    }
    catch (error) {
        console.error('Error fetching app version:', error)
        // Use NextResponse
        return NextResponse.json({ error: 'Error fetching app version' }, { status: 500 })
    }
}
