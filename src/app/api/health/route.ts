import { NextResponse } from 'next/server';
import { databaseConnectionSource, pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

function configurationStatus() {
  return {
    neonAuthBaseUrl: process.env.NEON_AUTH_BASE_URL?.trim() ? 'configured' : 'missing',
    neonAuthCookieSecret: process.env.NEON_AUTH_COOKIE_SECRET?.trim() ? 'configured' : 'missing',
  } as const;
}

function deploymentCommitSha() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
}

export async function GET() {
  const authConfiguration = configurationStatus();
  const deployedCommit = deploymentCommitSha();

  try {
    await pool.query('select 1');
    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      databaseSource: databaseConnectionSource,
      deploymentCommitSha: deployedCommit,
      authConfiguration,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unavailable',
        databaseSource: databaseConnectionSource,
        databaseConfiguration: databaseConnectionSource === 'missing' ? 'missing' : 'configured',
        deploymentCommitSha: deployedCommit,
        authConfiguration,
      },
      { status: 503 },
    );
  }
}
