/**
 * #912: GitHub protected-environment *manual-only* Neon readiness check.
 *
 * Never retrieves a Neon connection string, creates a role/branch, exports
 * evidence or prints any secret/DB host/source. A Neon API key alone is NOT a
 * read-only SQL role.
 */
import { appendFileSync } from 'node:fs';
import { Pool } from 'pg';
import { verifyVotePredictNeonProject } from '../src/operations/votepredict-neon-project-identity.js';
import {
  SENATE_MEDIA_READONLY_PREFLIGHT_SQL,
  assertSenateMediaReadOnlyPreflight,
} from '../src/evidence/senate-media-readonly-export.js';
import {
  SENATE_MEDIA_NEON_APPROVAL,
  assertMediaReadinessManualApproval,
  assertProjectEndpointBelongsToApprovedBranch,
  mediaNeonReadinessReport,
  parseMediaSqlDestination,
  validateApprovedMediaBranchId,
  type SanitizedMediaNeonReadiness,
} from '../src/operations/senate-media-neon-credential-gate.js';

function publish(report: SanitizedMediaNeonReadiness): void {
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const pending = report.status === 'project_verified_readonly_database_url_required'
      ? 'A *separate*, restricted SELECT-only Postgres URL is not configured as VOTEPREDICT_MEDIA_READONLY_DATABASE_URL in the protected environment.'
      : report.status === 'project_verified_approved_branch_required'
        ? 'The approved exact VotePredict Neon branch ID is not configured as VOTEPREDICT_MEDIA_APPROVED_BRANCH_ID.'
        : 'The restricted Postgres URL host, branch and SQL role passed the read-only checks.';
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Senate media: VotePredict direct-Neon readiness',
      '',
      '- Authenticated VotePredict project name and ID: **verified**',
      '- SQL role strictly SELECT-only: **' + (report.sqlRoleSelectOnlyVerified ? 'verified' : 'NOT verified') + '**',
      '- Production evidence rows read/exported: **no**',
      '- No production writes, Neon role or branch creation, Vercel secrets or artifacts.',
      '',
      pending,
      '',
      'An API key alone cannot satisfy a restricted Postgres role. This is only a connection/privilege preflight, not a completed media export.',
    ].join('\n') + '\n', {encoding:'utf8'});
  }
}

async function main(): Promise<void> {
  if (process.argv.length !== 2)
    throw Error('No CLI inputs allowed. Only the manually approved GitHub workflow may run this guard');
  assertMediaReadinessManualApproval(process.env);
  const apiKey=process.env.NEON_API_KEY?.trim() ?? '';
  const projectId=process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '';
  // Management API step: a single GET verifying the configured project.
  await verifyVotePredictNeonProject({
    apiKey, projectId,
    repository:process.env.GITHUB_REPOSITORY,
    ref:process.env.GITHUB_REF,
    eventName:process.env.GITHUB_EVENT_NAME,
    approved:'VERIFY_VOTEPREDICT_NEON_PROJECT',
  });
  const dbUrl=process.env.VOTEPREDICT_MEDIA_READONLY_DATABASE_URL?.trim() ?? '';
  if (!dbUrl) {
    publish(mediaNeonReadinessReport('project_verified_readonly_database_url_required'));
    return;
  }
  const branchId=process.env.VOTEPREDICT_MEDIA_APPROVED_BRANCH_ID?.trim() ?? '';
  if (!branchId) {
    publish(mediaNeonReadinessReport('project_verified_approved_branch_required'));
    return;
  }
  validateApprovedMediaBranchId(branchId);
  const destination=parseMediaSqlDestination(dbUrl);
  // The database host must really belong to this specific Neon *project and
  // pinned branch*, independent of the user-supplied SQL connection URI.
  await assertProjectEndpointBelongsToApprovedBranch({
    apiKey,projectId,branchId,databaseHost:destination.host,
  });
  // Construct pg options explicitly: URL query parameters cannot weaken TLS
  // certificate verification or inject unsupported driver options.
  const parsedUrl=new URL(dbUrl);
  const pool=new Pool({
    host:destination.host,
    port:parsedUrl.port ? Number(parsedUrl.port) : 5432,
    user:destination.username,
    password:decodeURIComponent(parsedUrl.password),
    database:destination.database,
    ssl:{rejectUnauthorized:true},
    max:1,
    connectionTimeoutMillis:7000,
    idleTimeoutMillis:1500,
    query_timeout:10000,
    application_name:'senate-media-github-manual-readonly-preflight',
  });
  try {
    const client=await pool.connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result=await client.query(SENATE_MEDIA_READONLY_PREFLIGHT_SQL);
      if (result.rows.length !== 1) throw Error('SQL role preflight did not return exactly one row');
      const raw=Object.values(result.rows[0] as Record<string,unknown>)[0];
      if (typeof raw !== 'string') throw Error('SQL role preflight did not return JSON');
      const proof=assertSenateMediaReadOnlyPreflight(JSON.parse(raw));
      if (proof.role !== destination.username || proof.database !== destination.database)
        throw Error('SQL connected identity disagrees with approved restricted URI');
      await client.query('ROLLBACK');
    } finally {
      // Connection closes even if a guard fails. No evidence SELECT is run.
      client.release(true);
    }
  } finally { await pool.end(); }
  publish(mediaNeonReadinessReport('project_verified_role_preflight_ready'));
}

main().catch(() => {
  // No exception details, request URLs, passwords, hostnames, role names,
  // Postgres diagnostic messages or raw Neon API payload in GitHub logs.
  console.error('Senate media Neon identity/SQL-readiness gate failed closed; no article export was attempted');
  process.exitCode=1;
});
