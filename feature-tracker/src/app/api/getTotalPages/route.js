import { getTotalPages } from "@/utils/db"

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const showHidden = searchParams.get("showHidden") === "true" || false;
    return new Response(JSON.stringify(await getTotalPages(showHidden)), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}