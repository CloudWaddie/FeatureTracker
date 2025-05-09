import { createReadStream } from "fs";
import { join } from "path";

export async function GET(request) {
    try {
        const dbPath = join(process.cwd(), "db", "feature-tracker.db");
        const fileStream = createReadStream(dbPath);
        
        return new Response(fileStream, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="feature-tracker.db"`,
            },
        });
    } catch (error) {
        console.error("Error downloading database file:", error);
        return new Response("Error downloading database file", { status: 500 });
    }
}