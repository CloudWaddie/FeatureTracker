//Seed database for now
import { NextResponse } from 'next/server';

export async function GET(request) {
    // Simulate a database of updates
    const updates = [
        {
        id: 1,
        title: "Gemini App Update",
        description: "Code changed or strings updated",
        date: "2025-10-01",
        },
        {
        id: 2,
        title: "ChatGPT App Update",
        description: "New features added to the ChatGPT app",
        date: "2025-09-15",
        },
        {
        id: 3,
        title: "Deepseek App Update",
        description: "Bug fixes and performance improvements",
        date: "2025-08-20",
        },
        {
            id: 4,
            title: "Gemini App Update",
            description: "Code changed or strings updated",
            date: "2025-10-01",
        }
    ];
    
    return NextResponse.json(updates);
}