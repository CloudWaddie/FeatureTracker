import { NextResponse } from 'next/server';
import { getTableData } from '@/utils/db';
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
    const data = await getTableData(tableName);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching data for table ${tableName}:`, error);
    return NextResponse.json({ error: `Failed to fetch data for table ${tableName}` }, { status: 500 });
  }
}
