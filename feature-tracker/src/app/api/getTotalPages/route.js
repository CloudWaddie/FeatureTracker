import { getTotalPages } from "@/utils/db"

export async function GET(request) {
    return new Response(JSON.stringify(await getTotalPages()), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}