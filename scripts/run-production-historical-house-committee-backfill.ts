import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/committee-evidence-refresh';
const COMMITTEE_IDS = [
  ...Array.from({ length: 99 }, (_, i) => 92001 + i),
  ...Array.from({ length: 99 }, (_, i) => 93001 + i),
  ...Array.from({ length: 99 }, (_, i) => 94001 + i),
];
const CONCURRENCY = 2;
const ATTEMPTS = 3;

type Result = {
  committeeId: number;
  session?: string;
  found: boolean;
  pages: number;
  rollCalls: number;
  inserted: number;
  reused: number;
  resolvedVotes: number;
  unresolvedVotes: number;
  ambiguousVotes: number;
  skippedUnknownBills: number;
  warnings: string[];
};

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function fetchCommittee(secret: string, committeeId: number): Promise<Result> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${ENDPOINT}?houseCommitteeId=${committeeId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(310_000),
      });
      const body = await response.text();
      if (!response.ok) {
        if (response.status >= 500 && attempt < ATTEMPTS) continue;
        throw new Error(`Committee ${committeeId} HTTP ${response.status}: ${body.slice(0, 1200)}`);
      }
      return JSON.parse(body) as Result;
    } catch (error) {
      lastError = error;
      if (attempt === ATTEMPTS) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Committee ${committeeId} backfill failed`);
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return output;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const runtime = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  const secret = runtime.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is missing from production environment');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const results = await mapConcurrent(COMMITTEE_IDS, CONCURRENCY, async (committeeId) => {
    const result = await fetchCommittee(secret, committeeId);
    if (result.found || result.warnings.length > 0) console.log(JSON.stringify(result));
    return result;
  });

  const found = results.filter((row) => row.found);
  const summary = {
    schemaVersion: 'committee-evidence-historical-house-backfill-v1',
    generatedAt: new Date().toISOString(),
    committeeIdsAttempted: results.length,
    committeesFound: found.length,
    pages: found.reduce((sum, row) => sum + row.pages, 0),
    rollCalls: found.reduce((sum, row) => sum + row.rollCalls, 0),
    inserted: found.reduce((sum, row) => sum + row.inserted, 0),
    reused: found.reduce((sum, row) => sum + row.reused, 0),
    resolvedVotes: found.reduce((sum, row) => sum + row.resolvedVotes, 0),
    unresolvedVotes: found.reduce((sum, row) => sum + row.unresolvedVotes, 0),
    ambiguousVotes: found.reduce((sum, row) => sum + row.ambiguousVotes, 0),
    skippedUnknownBills: found.reduce((sum, row) => sum + row.skippedUnknownBills, 0),
    bySession: Object.fromEntries(['2021-2022','2023-2024','2025-2026'].map((session) => {
      const rows = found.filter((row) => row.session === session);
      return [session, {
        committees: rows.length,
        pages: rows.reduce((sum, row) => sum + row.pages, 0),
        rollCalls: rows.reduce((sum, row) => sum + row.rollCalls, 0),
        inserted: rows.reduce((sum, row) => sum + row.inserted, 0),
        resolvedVotes: rows.reduce((sum, row) => sum + row.resolvedVotes, 0),
      }];
    })),
    warnings: found.flatMap((row) => row.warnings.map((warning) => `${row.committeeId}: ${warning}`)).slice(0, 100),
  };

  const output = resolve(
    process.env.VOTEPREDICT_HISTORICAL_COMMITTEE_OUTPUT
      ?? 'artifacts/committee-evidence-historical-house-backfill-v1.json',
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, summary }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
