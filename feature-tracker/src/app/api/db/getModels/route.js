import { getModels } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(request) {
    const models = await getModels();
    if (!models) {
        return new Response("No models found", { status: 404 });
    }
    return NextResponse.json(models);
}