import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { requireEvaluationDatabaseConnection } from '../src/operations/evaluation-database.js';

const envPath = process.argv[2];
if (!envPath) throw new Error('Production environment file path is required');

const runtimeEnv = parseRuntimeEnvironment(readFileSync(resolve(envPath), 'utf8'));
const connection = requireEvaluationDatabaseConnection(runtimeEnv);

// The historical evaluator predates the shared evaluation-database resolver and
// prefers DATABASE_URL_UNPOOLED. Normalize only the child-process database
// variables so it connects in the same priority order as the production app,
// while leaving the pinned evaluator source/candidate grid unchanged.
const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: connection.connectionString,
  POSTGRES_URL: '',
  DATABASE_URL_UNPOOLED: '',
  POSTGRES_URL_NON_POOLING: '',
};

const child = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'scripts/evaluate-member-history-cap.ts'],
  {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['ignore', 'inherit', 'inherit'],
  },
);

if (child.error) throw child.error;
if (child.status !== 0) {
  throw new Error(`Member-history cap evaluator exited with status ${child.status ?? 'unknown'}`);
}
