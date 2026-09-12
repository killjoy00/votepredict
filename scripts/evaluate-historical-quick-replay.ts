import { Pool } from 'pg';
import { evaluateHistoricalQuickReplay } from '../src/evaluation/historical-quick-runtime.js';
import { requireEvaluationDatabaseConnection } from '../src/operations/evaluation-database.js';

async function main(): Promise<void> {
  const { connectionString, source: databaseSource } = requireEvaluationDatabaseConnection();
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await evaluateHistoricalQuickReplay(pool, {
      includeMembers: process.argv.includes('--include-members'),
      codeSha: process.env.GITHUB_SHA ?? null,
      databaseSource,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
