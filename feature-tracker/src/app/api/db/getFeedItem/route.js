import { getFeedItem } from "@/utils/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response("Missing 'id' parameter", { status: 400 });
  }

  try {
    const feedItem = await getFeedItem(id);
    if (!feedItem) {
      return new Response("Feed item not found", { status: 404 });
    }
    return new Response(JSON.stringify(feedItem), { status: 200 });
  } catch (error) {
    console.error("Error fetching feed item:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}