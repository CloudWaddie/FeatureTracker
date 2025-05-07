import getFeed from "@/utils/db"; // Assuming this function returns a Promise
import { NextResponse } from "next/server";

// Get the feed data from the database
export async function GET(request) {
  try {
    const feed = await getFeed();

    console.log("Feed data:", feed);

    return new NextResponse(JSON.stringify(feed), { status: 200 });

  } catch (error) {
    console.error("Error fetching feed data:", error);

    return new NextResponse("Error fetching feed data", { status: 500 });
  }
}
