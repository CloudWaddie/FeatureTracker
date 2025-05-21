import { NextResponse } from 'next/server';
import { getAllTables } from '@/utils/db';
import { auth } from "@/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  try {
    const tables = await getAllTables();
    return NextResponse.json(tables);
  } catch (error) {
    console.error('Error fetching all tables:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}
