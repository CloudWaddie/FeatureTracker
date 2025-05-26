import { getAllApps } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(request) {
    const apps = await getAllApps();
    if (!apps) {
        return new Response("No apps found", { status: 404 });
    }
    // Search for appId that doesn't contain numbers
    const filteredApps = apps.filter((app) =>  !/\d/.test(app.appId));
    return NextResponse.json(filteredApps, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
    });
}