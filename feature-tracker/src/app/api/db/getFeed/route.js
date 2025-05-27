import { getFeed } from "@/utils/db"; // Assuming this function returns a Promise
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

// Get the feed data from the database
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.abs(parseInt(searchParams.get('page') || '1', 10));
  // If showHiddden is set then parse it otherwise set it to false
  const showHidden = searchParams.get('showHidden') === 'true' || false;

  try {
    const feed = await getFeed(page, showHidden);
    return new NextResponse(JSON.stringify(feed), { status: 200 });
  } catch (error) {
    logger.error("Error fetching feed data:", error);

    return new NextResponse("Error fetching feed data", { status: 500 });
  }
}
