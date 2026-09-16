import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { MIN_REVISOR_PROCESS_RESEARCH_COVERAGE } from '../src/operations/revisor-process-source-policy.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/revisor-process-backfill';
const BATCH_LIMIT = 12;
const MAX_BATCHES = 80;
const MAX_ATTEMPTS = 3;

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function failureDetails(response: Response): Promise<string> {
  const text = await response.text();
  return safeMessage(text).slice(0, 1200);
}

async function post(secret: string, suffix: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${ENDPOINT}${suffix}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(310_000),
      });
      if (response.status >= 500 && attempt < MAX_ATTEMPTS - 1) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Process backfill request failed');
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  let totalProcessed = 0;
  let totalExcluded = 0;
  let totalClassifiedActions = 0;
  let totalStageEvents = 0;
  const excludedIdentifiers = new Set<string>();
  for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
    const response = await post(secret, `?limit=${BATCH_LIMIT}`);
    if (!response.ok) {
      throw new Error(`Production process backfill returned HTTP ${response.status}: ${await failureDetails(response)}`);
    }
    const result = await response.json() as {
      processed: number;
      excluded: number;
      excludedIdentifiers: string[];
      classifiedActions: number;
      stageEvents: number;
      done: boolean;
    };
    totalProcessed += result.processed;
    totalExcluded += result.excluded;
    totalClassifiedActions += result.classifiedActions;
    totalStageEvents += result.stageEvents;
    for (const identifier of result.excludedIdentifiers) excludedIdentifiers.add(identifier);
    console.log(JSON.stringify({ batch, ...result }));
    if (result.done || result.processed === 0) break;
    if (batch === MAX_BATCHES) throw new Error('Process backfill exceeded maximum batch count');
  }

  const verificationResponse = await post(secret, '?verify=1');
  if (!verificationResponse.ok) {
    throw new Error(`Process backfill verification returned HTTP ${verificationResponse.status}: ${await failureDetails(verificationResponse)}`);
  }
  const verification = await verificationResponse.json() as {
    targetBills: number;
    parsedBills: number;
    excludedBills: number;
    completedBills: number;
    coverage: number;
    stageEvents: number;
    stageKinds: Record<string, number>;
    complete: boolean;
  };
  console.log(JSON.stringify({
    totals: {
      totalProcessed,
      totalExcluded,
      totalClassifiedActions,
      totalStageEvents,
      excludedIdentifiers: [...excludedIdentifiers].sort(),
    },
    verification,
    minimumResearchCoverage: MIN_REVISOR_PROCESS_RESEARCH_COVERAGE,
  }));
  if (!verification.complete) {
    throw new Error(`Process backfill incomplete: ${verification.completedBills}/${verification.targetBills} classified or explicitly excluded`);
  }
  if (verification.coverage < MIN_REVISOR_PROCESS_RESEARCH_COVERAGE) {
    throw new Error(
      `Process source coverage ${(verification.coverage * 100).toFixed(2)}% is below the frozen ${(MIN_REVISOR_PROCESS_RESEARCH_COVERAGE * 100).toFixed(2)}% research gate`,
    );
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
