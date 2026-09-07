import { NextResponse } from 'next/server';
import { databaseConnectionSource, pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

function configurationStatus() {
  return {
    neonAuthBaseUrl: process.env.NEON_AUTH_BASE_URL?.trim() ? 'configured' : 'missing',
    neonAuthCookieSecret: process.env.NEON_AUTH_COOKIE_SECRET?.trim() ? 'configured' : 'missing',
  } as const;
}

export async function GET() {
  const authConfiguration = configurationStatus();

  try {
    await pool.query('select 1');
    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      databaseSource: databaseConnectionSource,
      authConfiguration,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unavailable',
        databaseSource: databaseConnectionSource,
        databaseConfiguration: databaseConnectionSource === 'missing' ? 'missing' : 'configured',
        authConfiguration,
      },
      { status: 503 },
    );
  }
}
