import { NextResponse } from 'next/server';
import { getServingMemberModelStatus } from '@/forecasting/member-model-serving';
import { databaseConnectionSource, pool, runtimeDatabaseTargetFingerprint } from '@/lib/db';
import { executionPosture, readReleaseBinding } from '@/operations/release-readiness';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

function configurationStatus() {
  return {
    neonAuthBaseUrl: process.env.NEON_AUTH_BASE_URL?.trim() ? 'configured' : 'missing',
    neonAuthCookieSecret: process.env.NEON_AUTH_COOKIE_SECRET?.trim() ? 'configured' : 'missing',
  } as const;
}

function deploymentCommitSha() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
}

function publicMemberModelStatus() {
  const status = getServingMemberModelStatus();
  return {
    servingVersion: status.modelVersion,
    memberHistoryHalfLifeDays: status.memberHistoryHalfLifeDays,
    rollbackActive: status.rollbackActive,
    shadowVersion: status.shadowModelVersion,
  } as const;
}

export async function GET() {
  const authConfiguration = configurationStatus();
  const deployedCommit = deploymentCommitSha();
  const memberModel = publicMemberModelStatus();

  try {
    const binding = await readReleaseBinding(pool, runtimeDatabaseTargetFingerprint,
      process.env.VOTEPREDICT_EXPECTED_DATABASE_FINGERPRINT);
    return NextResponse.json({
      status: binding.verified ? 'ok' : 'degraded',
      database: 'ok',
      databaseSource: databaseConnectionSource,
      deploymentCommitSha: deployedCommit,
      memberModel,
      authConfiguration,
      binding,
      execution: executionPosture(),
    }, { status: binding.verified ? 200 : 503 });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unavailable',
        databaseSource: databaseConnectionSource,
        databaseConfiguration: databaseConnectionSource === 'missing' ? 'missing' : 'configured',
        deploymentCommitSha: deployedCommit,
        memberModel,
        authConfiguration,
        execution: executionPosture(),
      },
      { status: 503 },
    );
  }
}
