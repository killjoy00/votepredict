/**
 * Issue #847: GitHub-only Neon credential-namespace preflight.
 *
 * Receives ONLY presence booleans supplied by GitHub Actions expressions,
 * never secret material or database URLs. No network, DB or secret retrieval.
 */
import { appendFileSync } from 'node:fs';

export const INPUT_NAMES = Object.freeze({
  apiKey: 'VOTEPREDICT_HAS_NEON_API_KEY',
  projectId: 'VOTEPREDICT_HAS_NEON_PROJECT_ID',
  repositorySandboxUrl: 'VOTEPREDICT_HAS_REPO_SANDBOX_URL',
  legacyDatabaseUrl: 'VOTEPREDICT_HAS_LEGACY_DB_URL',
});

function parseFlag(input, name) {
  if (input !== 'true' && input !== 'false') {
    throw new Error('Boolean readiness flag missing or malformed: ' + name);
  }
  return input === 'true';
}

export function auditGithubCredentialPresence(env) {
  const credentialNamesPresent = {
    neonApiKey: parseFlag(env[INPUT_NAMES.apiKey], INPUT_NAMES.apiKey),
    votePredictProjectId: parseFlag(env[INPUT_NAMES.projectId], INPUT_NAMES.projectId),
    repoLevelSandboxUrl: parseFlag(env[INPUT_NAMES.repositorySandboxUrl], INPUT_NAMES.repositorySandboxUrl),
    legacyUnpooledDatabaseUrl: parseFlag(env[INPUT_NAMES.legacyDatabaseUrl], INPUT_NAMES.legacyDatabaseUrl),
  };

  const hasApiPair = credentialNamesPresent.neonApiKey &&
    credentialNamesPresent.votePredictProjectId;
  const hasSandboxUrl = credentialNamesPresent.repoLevelSandboxUrl;

  const status = hasApiPair
    ? 'neon_api_identity_candidates_present'
    : hasSandboxUrl
      ? 'sandbox_url_name_present_scope_unverified'
      : 'no_verified_direct_neon_credentials';

  return {
    schemaVersion: 'votepredict-github-neon-credential-presence-v1',
    scope: 'repository_secret_names_only',
    status,
    credentialNamesPresent,
    checks: {
      projectIdentityVerified: false,
      branchIsolationVerified: false,
      sqlRoleVerified: false,
      databaseConnected: false,
      liveNeonQueried: false,
      productionAccessed: false,
      vercelAccessed: false,
      secretsRetrieved: false,
      evidenceWritten: false,
    },
    caveats: [
      'GitHub secret-name presence does not verify credential values, permissions, ownership or Neon project identity',
      'GitHub environment-level secrets are NOT visible to this repository-level preflight',
      'A legacy database URL, even if present, is NOT approved for this sandbox workflow and may point to production',
      'The Pack 1 Neon integration is a different project; only VotePredict-scoped GitHub credentials are eligible',
      'No existing Neon project or credential is created, displayed, used or modified by this preflight',
    ],
  };
}

export function formatGithubSummary(report) {
  const yesNo = value => value ? 'Present (name only)' : 'Not visible at repository scope';
  return [
    '## VotePredict Neon direct-access readiness (offline)',
    '',
    '**No Neon, Vercel, database, or secret values were accessed.**',
    '',
    '| Required GitHub secret/variable name | GitHub visibility |',
    '| --- | --- |',
    '| NEON_API_KEY | ' + yesNo(report.credentialNamesPresent.neonApiKey) + ' |',
    '| VOTEPREDICT_NEON_PROJECT_ID | ' + yesNo(report.credentialNamesPresent.votePredictProjectId) + ' |',
    '| EVIDENCE_READONLY_SANDBOX_URL (repository scope only) | ' + yesNo(report.credentialNamesPresent.repoLevelSandboxUrl) + ' |',
    '| DATABASE_URL_UNPOOLED (legacy; **never use automatically**) | ' + yesNo(report.credentialNamesPresent.legacyUnpooledDatabaseUrl) + ' |',
    '',
    'Status: `' + report.status + '`.',
    '',
    'All project identity, branch isolation, database role grants and live connectivity remain **unverified**.',
    'The protected GitHub environment `evidence-readonly-sandbox` is not examined here.',
    'No library outreach or future-session work is involved.',
    '',
  ].join('\n');
}

if (process.argv[1] && /(^|\/)check-github-neon-credential-presence\.mjs$/.test(process.argv[1])) {
  try {
    const report = auditGithubCredentialPresence(process.env);
    console.log(JSON.stringify(report));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatGithubSummary(report) + '\n', {
        encoding: 'utf8',
      });
    }
  } catch {
    // Do not print runtime environment values or GitHub secret expressions.
    console.error('GitHub Neon credential-namespace preflight invalid; no connection attempted');
    process.exitCode = 1;
  }
}
