import { NextResponse } from 'next/server';
import groupingData from '@/config/grouping.json';

export async function GET() {
  try {
    return NextResponse.json(groupingData);
  } catch (error) {
    console.error("Failed to load grouping configuration:", error);
    return NextResponse.json({ message: "Error loading grouping configuration" }, { status: 500 });
  }
}
