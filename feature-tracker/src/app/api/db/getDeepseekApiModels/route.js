import { getMiscData } from "@/utils/db";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function GET(request) {
    try {
        const miscData = await getMiscData('deepseekModelsApi');
        if (!miscData || miscData.length === 0 || !miscData[0] || typeof miscData[0].value !== 'string') {
            logger.error("No Deepseek API models data found in misc table or data is not a string.");
            return NextResponse.json({ error: "Deepseek API models data not found or in unexpected format." }, { status: 404 });
        }

        const modelsDataString = miscData[0].value;
        const parsedData = JSON.parse(modelsDataString);

        if (!parsedData || !parsedData.data || !Array.isArray(parsedData.data)) {
            logger.error("Parsed Deepseek API models data is not in the expected format (missing 'data' array).", parsedData);
            return NextResponse.json({ error: "Deepseek API models data is not in the expected format." }, { status: 500 });
        }

        // Return the raw models array directly
        return NextResponse.json(parsedData.data);
    } catch (error) {
        logger.error({ err: error }, "Error fetching Deepseek API models from DB");
        return NextResponse.json({ error: "Failed to fetch Deepseek API models." }, { status: 500 });
    }
}
