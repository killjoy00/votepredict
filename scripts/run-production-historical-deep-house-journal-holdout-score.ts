import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

let secretValues: string[] = [];

function safeMessage(value: unknown): string {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secretValues.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function maskSecrets(env: Record<string, string | undefined>): void {
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string' && value.length > 3);
  for (const value of secretValues) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const cohortPath = process.env.VOTEPREDICT_HOUSE_JOURNAL_HOLDOUT_SCORE_COHORT;
  const mechanicsPath = process.env.VOTEPREDICT_HOUSE_JOURNAL_HOLDOUT_SCORE_MECHANICS;
  const planPath = process.env.VOTEPREDICT_HOUSE_JOURNAL_HOLDOUT_SCORE_PLAN;
  const lineagePath = process.env.VOTEPREDICT_HOUSE_JOURNAL_HOLDOUT_SCORE_LINEAGE;
  if (!cohortPath || !mechanicsPath || !planPath || !lineagePath) {
    throw new Error('Frozen cohort, mechanics, plan, and score-lineage paths are required');
  }
  const outputPath = resolve(
    process.env.VOTEPREDICT_HOUSE_JOURNAL_HOLDOUT_SCORE_OUTPUT
      ?? 'artifacts/historical-deep-house-journal-holdout-score-v1.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-house-journal-holdout-score', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cohort: readJson(cohortPath),
      mechanics: readJson(mechanicsPath),
      plan: readJson(planPath),
      lineage: readJson(lineagePath),
    }),
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production House Journal holdout score returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    schemaVersion?: string;
    metadata?: { runtimeCodeSha?: string | null; probabilityAction?: string; actionabilityDecision?: string };
    input?: { frozenCases?: number; quickMemberCasePairs?: number; decisiveMemberOutcomes?: number; mechanicsObservations?: number };
    summary?: {
      primaryHypotheses?: Array<{
        id?: string;
        mechanic?: string;
        status?: string;
        reason?: string;
        holdout?: { cases?: number; decisiveMemberOutcomes?: number; memberWeightedSignedResidual?: number; caseMeanSignedResidual?: number } | null;
      }>;
      billOutcomeAnalysis?: { identifiable?: boolean; overall?: { passedCases?: number; failedCases?: number } };
      highOverlapPairs?: Array<{ left?: string; right?: string; sharedCases?: number; unionCases?: number; jaccard?: number }>;
    };
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: parsed.schemaVersion ?? null,
    runtimeCodeSha: parsed.metadata?.runtimeCodeSha ?? null,
    probabilityAction: parsed.metadata?.probabilityAction ?? null,
    actionabilityDecision: parsed.metadata?.actionabilityDecision ?? null,
    input: parsed.input ?? null,
    primaryHypotheses: parsed.summary?.primaryHypotheses ?? [],
    billOutcomeAnalysis: parsed.summary?.billOutcomeAnalysis ?? null,
    highOverlapPairs: parsed.summary?.highOverlapPairs ?? [],
  }, null, 2));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
