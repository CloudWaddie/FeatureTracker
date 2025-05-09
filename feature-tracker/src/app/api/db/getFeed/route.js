import { getFeed } from "@/utils/db"; // Assuming this function returns a Promise
import { NextResponse } from "next/server";

// Get the feed data from the database
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  try {
    const feed = await getFeed(page);
    return new NextResponse(JSON.stringify(feed), { status: 200 });
  } catch (error) {
    console.error("Error fetching feed data:", error);

    return new NextResponse("Error fetching feed data", { status: 500 });
  }
}
