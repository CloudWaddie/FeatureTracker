import { getMiscData } from "@/utils/db";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function GET(request) {
    try {
        const miscData = await getMiscData('geminiModelsApi');
        if (!miscData || miscData.length === 0 || !miscData[0] || typeof miscData[0].value !== 'string') {
            logger.error("No Gemini API models data found in misc table or data is not a string.");
            return NextResponse.json({ error: "Gemini API models data not found or in unexpected format." }, { status: 404 });
        }

        const modelsDataString = miscData[0].value;
        const parsedData = JSON.parse(modelsDataString);

        if (!parsedData || !parsedData.models || !Array.isArray(parsedData.models)) {
            logger.error("Parsed Gemini API models data is not in the expected format (missing 'models' array).", parsedData);
            return NextResponse.json({ error: "Gemini API models data is not in the expected format." }, { status: 500 });
        }

        // The controller stores the whole API response, the models are in a 'models' property
        const geminiModels = parsedData.models.map(model => ({
            // Attempt to map to a structure similar to the existing 'models' table
            // This mapping might need adjustment based on how 'lmarena' models are structured
            // and what fields are essential for the model-checker table.
            id: model.name, // Using 'name' (e.g., "models/gemini-pro") as a unique ID
            modelApiId: model.name,
            publicId: model.name, // Placeholder, adjust if a more suitable publicId exists
            provider: "Gemini",
            providerId: "google-gemini", // Placeholder
            name: model.displayName,
            multiModal: model.supportedGenerationMethods ? model.supportedGenerationMethods.includes("generateContent") && model.supportedGenerationMethods.length > 1 : false, // Basic inference
            supportsStructuredOutput: model.supportsStructuredOutput || false, // Assuming this field might exist or defaulting
            baseSampleWeight: model.version || "N/A", // Using version as a placeholder
            isPrivate: false, // Assuming public models from API, adjust if needed
            newModel: false, // Placeholder, logic for this might be elsewhere
            description: model.description,
            inputTokenLimit: model.inputTokenLimit,
            outputTokenLimit: model.outputTokenLimit,
            supportedGenerationMethods: model.supportedGenerationMethods,
            temperature: model.temperature,
            topP: model.topP,
            topK: model.topK,
            version: model.version
        }));

        return NextResponse.json(geminiModels);
    } catch (error) {
        logger.error({ err: error }, "Error fetching Gemini API models from DB");
        return NextResponse.json({ error: "Failed to fetch Gemini API models." }, { status: 500 });
    }
}
