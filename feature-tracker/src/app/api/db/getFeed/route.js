import { getFeed } from "@/utils/db"; // Assuming this function returns a Promise
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

// Get the feed data from the database
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.abs(parseInt(searchParams.get('page') || '1', 10));
  const showHidden = searchParams.get('showHidden') === 'true' || false;
  const searchQuery = searchParams.get('search') || null;
  const filterType = searchParams.get('filter') || null;
  const typesParam = searchParams.get('types') || null;
  const typesArray = typesParam ? typesParam.split(',') : null;

  try {
    // Pass typesArray to getFeed. The getFeed function in @/utils/db.js will need to handle this.
    const feed = await getFeed(page, showHidden, searchQuery, filterType, typesArray); 
    return new NextResponse(JSON.stringify(feed), { status: 200 });
  } catch (error) {
    logger.error("Error fetching feed data:", { error, page, showHidden, searchQuery, filterType, types: typesArray });
    return new NextResponse("Error fetching feed data", { status: 500 });
  }
}
