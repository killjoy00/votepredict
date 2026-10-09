/**
 * #847: manual GitHub-only, expiring schema-only sandbox provisioning.
 *
 * The default is offline (no Neon API or DB access). --create requires the
 * protected VotePredict GitHub environment and explicit workflow_dispatch
 * confirmation. No secret values or Neon response bodies are ever printed.
 */
import { appendFileSync } from 'node:fs';
import {
  createVotePredictSchemaOnlySandbox,
} from '../src/operations/votepredict-neon-schema-only-sandbox.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--offline')) {
    console.log(JSON.stringify({
      schemaVersion: 'votepredict-neon-schema-only-sandbox-v1',
      mode: 'offline',
      neonContacted: false,
      branchCreated: false,
      databaseQueried: false,
      dataCopied: false,
    }));
    return;
  }
  if (args.length !== 1 || args[0] !== '--create') {
    throw new Error('Only --offline (default) or --create is supported');
  }
  const report = await createVotePredictSchemaOnlySandbox({
    apiKey: process.env.NEON_API_KEY,
    projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID,
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GITHUB_REF,
    eventName: process.env.GITHUB_EVENT_NAME,
    approved: process.env.VOTEPREDICT_SCHEMA_ONLY_APPROVAL,
    runId: process.env.GITHUB_RUN_ID,
  });
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## VotePredict schema-only sandbox (created)',
      '',
      'New branch: `' + report.branchName + '` (`' + report.branchId + '`)',
      '',
      'Automatic expiration: **' + report.expiresAt + '**.',
      '',
      'Schema-only initialization and no compute endpoint verified. No',
      'PostgreSQL connection, evidence reads or ingestion writes occurred.',
      'Neon API key scope and environment protection remain separate checks.',
      'A future dedicated SQL role and bounded audit require their own approval.',
      '',
    ].join('\n'), { encoding: 'utf8' });
  }
}

main().catch((e: unknown) => {
  // All expected errors from the adapter use fixed messages; never print
  // arbitrary native fetch, connection, or raw Neon API error bodies.
  const safePrefixes = [
    'A manual VotePredict', 'The protected VotePredict', 'A genuine numeric',
    'Neon read-only management', 'Neon management metadata',
    'Neon project identity', 'Neon branch inventory', 'Unable to identify',
    'An existing #847', 'Schema-only create result', 'Neon rejected',
    'Branch response', 'Schema-only type', 'Sandbox verification failed',
  ];
  const message = e instanceof Error && safePrefixes.some(x => e.message.startsWith(x))
    ? e.message
    : 'Schema-only sandbox operation could not be completed safely; inspect Neon before retry';
  console.error(message);
  process.exitCode = 1;
});
