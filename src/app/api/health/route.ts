import { NextResponse } from 'next/server';
import { databaseConnectionSource, pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await pool.query('select 1');
    return NextResponse.json({ status: 'ok', database: 'ok', databaseSource: databaseConnectionSource });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unavailable',
        databaseSource: databaseConnectionSource,
        databaseConfiguration: databaseConnectionSource === 'missing' ? 'missing' : 'configured',
      },
      { status: 503 },
    );
  }
}
