import { getTotalPages } from "@/utils/db";
import { NextResponse } from "next/server"; // Added for consistency, though Response is fine
import logger from "@/lib/logger"; // Added logger

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const showHidden = searchParams.get("showHidden") === "true" || false;
    const searchQuery = searchParams.get('search') || null;
    const filterType = searchParams.get('filter') || null;

    try {
        const totalPages = await getTotalPages(showHidden, searchQuery, filterType);
        return new NextResponse(JSON.stringify(totalPages), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        logger.error("Error fetching total pages:", { error, showHidden, searchQuery, filterType });
        return new NextResponse("Error fetching total pages", { status: 500 });
    }
}
