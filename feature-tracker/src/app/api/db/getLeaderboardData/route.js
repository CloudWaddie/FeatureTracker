import { getMiscData } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leaderboardName = searchParams.get('leaderboardName');

  if (!leaderboardName) {
    return new Response("Missing 'leaderboardName' parameter", { status: 400 });
  }

  try {
    let leaderboardData = await getMiscData(`leaderboard_${leaderboardName}`);
    leaderboardData = leaderboardData[0];
    if (leaderboardData && leaderboardData.value) {
      leaderboardData = JSON.parse(leaderboardData.value);
    } else {
      leaderboardData = null;
    }
    if (!leaderboardData) {
      return NextResponse.json(
        { error: `Leaderboard data for '${leaderboardName}' not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}