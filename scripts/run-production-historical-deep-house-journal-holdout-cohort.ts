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

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(
    process.env.VOTEPREDICT_HOUSE_JOURNAL_HOLDOUT_COHORT_OUTPUT
      ?? 'artifacts/historical-deep-house-journal-holdout-cohort-v1.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-house-journal-holdout-cohort', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production House Journal holdout cohort returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    schemaVersion?: string;
    metadata?: {
      totalSelected?: number;
      poolBySession?: Record<string, number>;
      sessions?: string[];
    };
    cases?: Array<{
      session?: string;
      identifier?: string;
      occurredOn?: string;
      tranche?: string;
      targetOverlap?: number;
      targetDisagreementRate?: number;
    }>;
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: parsed.schemaVersion ?? null,
    totalSelected: parsed.metadata?.totalSelected ?? parsed.cases?.length ?? null,
    sessions: parsed.metadata?.sessions ?? null,
    poolBySession: parsed.metadata?.poolBySession ?? null,
    cases: parsed.cases?.map((item) => ({
      session: item.session ?? null,
      identifier: item.identifier ?? null,
      occurredOn: item.occurredOn ?? null,
      tranche: item.tranche ?? null,
      targetOverlap: item.targetOverlap ?? null,
      targetDisagreementRate: item.targetDisagreementRate ?? null,
    })) ?? [],
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
