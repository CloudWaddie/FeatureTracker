import { NextResponse } from 'next/server';
import { getTableInfo } from '@/utils/db';
import { auth } from "@/auth";

export async function GET(request, context) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const { tableName } = await context.params;
  try {
    // Basic validation for tableName
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }
    const tableInfo = await getTableInfo(tableName);
    return NextResponse.json(tableInfo);
  } catch (error) {
    console.error(`Error fetching table info for ${tableName}:`, error);
    return NextResponse.json({ error: `Failed to fetch table info for ${tableName}` }, { status: 500 });
  }
}
