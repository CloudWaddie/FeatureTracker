import { hideFeedItem } from "@/utils/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import logger from "@/lib/logger";

export async function POST(req) {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ message: "You must be logged in." }, { status: 401 });
    }

    try {
        const { id, isHidden } = await req.json();
        if (id == null || isHidden == null) {
            return NextResponse.json({ message: "Missing 'id' or 'isHidden' in request body" }, { status: 400 });
        }
        await hideFeedItem(id, isHidden);
        return NextResponse.json({ message: `Item ${isHidden ? 'hidden' : 'shown'} successfully` }, { status: 200 });
    } catch (error) {
        logger.error("Error hiding feed item:", error);
        if (error instanceof SyntaxError) { // Handle cases where req.json() fails
            return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 });
        }
        return NextResponse.json({ message: "Error hiding feed item" }, { status: 500 });
    }
}
