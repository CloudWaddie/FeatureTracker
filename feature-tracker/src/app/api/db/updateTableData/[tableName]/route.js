import { NextResponse } from 'next/server';
import { updateTableData } from '@/utils/db';
import { auth } from "@/auth";
import logger from '@/lib/logger';

export async function POST(request, context) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const { tableName } = await context.params;
  try {
    const { rowId, column, value } = await request.json();

    if (!tableName || !rowId || !column || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields: tableName, rowId, column, value' }, { status: 400 });
    }

    // Basic validation
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(column)) {
      return NextResponse.json({ error: 'Invalid table or column name' }, { status: 400 });
    }

    const changes = await updateTableData(tableName, rowId, column, value);
    return NextResponse.json({ message: `Table ${tableName} updated successfully`, changes });
  } catch (error) {
    logger.error(`Error updating table data for ${tableName}:`, error);
    if (error instanceof SyntaxError) { // Handle cases where req.json() fails
        return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to update table data for ${tableName}: ${error.message}` }, { status: 500 });
  }
}
