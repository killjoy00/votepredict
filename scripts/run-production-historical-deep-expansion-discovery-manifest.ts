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
  const cohortPath = process.argv[2];
  if (!cohortPath) throw new Error('Frozen expansion cohort path is required');
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(
    process.env.VOTEPREDICT_DEEP_EXPANSION_DISCOVERY_OUTPUT
      ?? 'artifacts/historical-deep-expansion-discovery-manifest.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const cohortText = readFileSync(resolve(cohortPath), 'utf8');
  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-expansion-discovery-manifest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: cohortText,
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production historical Deep expansion discovery manifest returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    schemaVersion?: string;
    metadata?: { codeSha?: string | null; cases?: number; memberCasePairs?: number };
    cases?: Array<{
      stableKey?: string;
      identifier?: string;
      occurredOn?: string;
      members?: unknown[];
      currentDeepTargetIds?: string[];
      candidateDeepTargetIds?: string[];
    }>;
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: parsed.schemaVersion ?? null,
    codeSha: parsed.metadata?.codeSha ?? null,
    cases: parsed.metadata?.cases ?? parsed.cases?.length ?? null,
    memberCasePairs: parsed.metadata?.memberCasePairs ?? null,
    caseSummary: parsed.cases?.map((item) => ({
      stableKey: item.stableKey ?? null,
      identifier: item.identifier ?? null,
      occurredOn: item.occurredOn ?? null,
      members: item.members?.length ?? null,
      currentTargets: item.currentDeepTargetIds?.length ?? null,
      candidateTargets: item.candidateDeepTargetIds?.length ?? null,
    })) ?? [],
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
