// src/app/api/db/getLatestItemIdsPerType/route.js
import { getLatestItemIdsPerType } from "@/utils/db";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function GET(request) {
  try {
    const latestIds = await getLatestItemIdsPerType();
    return NextResponse.json(latestIds);
  } catch (error) {
    logger.error("Error fetching latest item IDs per type:", { error });
    return NextResponse.json({ message: "Error fetching latest item IDs per type" }, { status: 500 });
  }
}
