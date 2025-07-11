import { runMyScheduledTask } from "@/utils/scheduler";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function GET(request) {
    try {
        // Call the function to run your scheduled task
        await runMyScheduledTask();
        return new NextResponse("Scheduled task executed successfully", { status: 200 });
    } catch (error) {
        logger.error("Error executing scheduled task:", error);
        return new NextResponse("Error executing scheduled task", { status: 500 });
    }
}