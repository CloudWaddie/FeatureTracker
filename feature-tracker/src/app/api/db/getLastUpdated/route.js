// Get the code for a specific app ID from the database
import { getLastUpdated } from "@/utils/db";
import logger from "@/lib/logger";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");
    
    if (!appId) {
        return new Response("App ID is required", { status: 400 });
    }
    
    try {
        const lastUpdated = await getLastUpdated(appId);
        return new Response(JSON.stringify({ lastUpdated }), { status: 200 });
    } catch (error) {
        logger.error("Error fetching last updated date:", error);
        return new Response("Error fetching last updated date", { status: 500 });
    }
    }