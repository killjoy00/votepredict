/**
 * Issue #847: Vercel-independent, sandbox-only evidence freshness proof.
 *
 * Default invocation does no network/DB work. The optional --connect mode
 * needs a dedicated sandbox Neon role and explicit execution acknowledgement.
 * There is no --write/production mode, Vercel fallback or database bridge.
 */
import { writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import {
  auditNeonEvidenceReadonlySandbox,
  validateReadonlySandboxConfig,
} from '../src/operations/evidence-neon-readonly.js';

const argumentsList = process.argv.slice(2);
const isConnect = argumentsList.length === 1 && argumentsList[0] === '--connect';
const isOffline = argumentsList.length === 0 ||
  (argumentsList.length === 1 && argumentsList[0] === '--offline');

async function main(): Promise<void> {
  if (!isConnect && !isOffline) {
    throw new Error('Only --offline (default) or --connect are supported');
  }

  if (isOffline) {
    console.log(JSON.stringify({
      schemaVersion: 'evidence-neon-readonly-health-invocation-v1',
      mode: 'offline',
      connected: false,
      productionAccess: false,
      vercelAccess: false,
      writesExecuted: false,
      nextStep: 'Sandbox-only --connect requires an approved role and protected GitHub environment',
    }));
    return;
  }

  // No connection object, URL, role or environment file is read before the
  // explicit acknowledgement, scope, and URL checks have passed.
  const config = validateReadonlySandboxConfig(process.env);
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 2_000,
    query_timeout: 5_000,
    application_name: 'votepredict-evidence-readonly-sandbox',
  });
  try {
    const report = await auditNeonEvidenceReadonlySandbox(
      () => pool.connect(),
      config.expectedRole,
    );
    const value = JSON.stringify(report, null, 2) + '\n';
    const outputFile = process.env.VOTEPREDICT_EVIDENCE_RO_OUTPUT_FILE;
    if (outputFile) writeFileSync(outputFile, value, { encoding: 'utf8', flag: 'w', mode: 0o600 });
    console.log(value);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  // Deliberately do not log node-postgres diagnostic messages: they can carry
  // a connection string, endpoint or credential. The CI exit status is enough.
  const safe = error instanceof Error && (
    error.message.startsWith('Missing explicit') ||
    error.message.startsWith('Read-only connection scope') ||
    error.message.startsWith('Dedicated sandbox') ||
    error.message.startsWith('Expected database role') ||
    error.message.startsWith('Sandbox connection must') ||
    error.message.startsWith('Database role must') ||
    error.message.startsWith('Read-only role verification')
  ) ? error.message : 'Sandbox evidence health audit failed; inspect environment/role grants privately';
  console.error(safe);
  process.exitCode = 1;
});
