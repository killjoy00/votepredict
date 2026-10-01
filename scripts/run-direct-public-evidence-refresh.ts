import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function main(): Promise<void> {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');

  const runtime = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  for (const [key, value] of Object.entries(runtime)) {
    if (value !== undefined) process.env[key] = value;
  }

  if (!process.env.DATABASE_URL
    && !process.env.POSTGRES_URL
    && !process.env.DATABASE_URL_UNPOOLED
    && !process.env.POSTGRES_URL_NON_POOLING) {
    throw new Error('Production database connection is unavailable');
  }

  const batchSize = Math.min(
    24,
    Math.max(1, Number(process.env.VOTEPREDICT_PUBLIC_EVIDENCE_BATCH ?? '12') || 12),
  );

  const [{ runPublicEvidenceRefresh }, { pool }] = await Promise.all([
    import('../src/evidence/public-evidence-refresh.js'),
    import('../src/lib/db/index.js'),
  ]);

  try {
    const result = await runPublicEvidenceRefresh({
      batchSize,
      execution: 'github-actions-direct-neon',
    });
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
