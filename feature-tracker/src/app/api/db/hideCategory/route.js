import { hideFeedByCategory } from "@/utils/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req) {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ message: "You must be logged in." }, { status: 401 });
    }

    try {
        const { category, hide } = await req.json(); // Expect 'hide' boolean in request
        if (!category) {
            return NextResponse.json({ message: "Missing 'category' in request body" }, { status: 400 });
        }
        if (typeof hide !== 'boolean') {
            return NextResponse.json({ message: "Missing or invalid 'hide' in request body, must be true or false" }, { status: 400 });
        }
        await hideFeedByCategory(category, hide);
        return NextResponse.json({ message: `Category ${hide ? "hidden" : "shown"} successfully` }, { status: 200 });
    } catch (error) {
        console.error(`Error ${hide ? "hiding" : "showing"} feed category:`, error);
        if (error instanceof SyntaxError) { // Handle cases where req.json() fails
            return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 });
        }
        return NextResponse.json({ message: `Error ${hide ? "hiding" : "showing"} feed item` }, { status: 500 });
    }
}
