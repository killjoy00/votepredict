/**
 * Issue #847: offline by default. The explicit --verify command is intended
 * exclusively for GitHub's protected evidence-readonly-sandbox environment.
 * It performs exactly one Neon project-details GET; never reads database rows
 * or creates/modifies Neon branches.
 */
import { appendFileSync } from 'node:fs';
import {
  PROJECT_CHECK_APPROVAL,
  verifyVotePredictNeonProject,
} from '../src/operations/votepredict-neon-project-identity.js';

const mode = process.argv.slice(2);
async function main() {
  if (mode.length === 0 || (mode.length === 1 && mode[0] === '--offline')) {
    console.log(JSON.stringify({
      schemaVersion: 'votepredict-neon-project-identity-gate-v1',
      mode: 'offline',
      neonContacted: false,
      sandboxCreated: false,
      productionAccessed: false,
      evidenceWritten: false,
    }));
    return;
  }
  if (mode.length !== 1 || mode[0] !== '--verify') {
    throw new Error('Only --offline (default) or --verify are supported');
  }
  const report = await verifyVotePredictNeonProject({
    apiKey: process.env.NEON_API_KEY,
    projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID,
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GITHUB_REF,
    eventName: process.env.GITHUB_EVENT_NAME,
    approved: process.env.VOTEPREDICT_NEON_APPROVAL,
  });
  const output = JSON.stringify(report);
  console.log(output);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## VotePredict Neon project identity',
      '',
      report.verified ? 'Project metadata **matches the configured ID and VotePredict name**.' : 'Unverified.',
      '',
      'No sandbox branch, database connection, production read/write or ingestion was performed.',
      'API key project scope and independent production-project binding are **not** proven by this check.',
      '',
    ].join('\n'), { encoding: 'utf8' });
  }
}

main().catch(() => {
  // Never print secrets, response bodies, URLs, or driver errors to CI logs.
  console.error('VotePredict Neon project verification did not pass; no database connection or branch mutation was attempted.');
  process.exitCode = 1;
});
