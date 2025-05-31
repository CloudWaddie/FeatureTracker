import { getMiscData } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(request) {
    const listOfLeaderboards = await getMiscData('leaderboards');
    if (!listOfLeaderboards || listOfLeaderboards.length === 0) {
        return new Response(JSON.stringify({ error: "No leaderboards found" }), { status: 404 });
    }
    return NextResponse.json({
        leaderboards: listOfLeaderboards[0].value ? JSON.parse(listOfLeaderboards[0].value) : []
    });

}