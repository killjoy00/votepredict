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
    process.env.VOTEPREDICT_DEEP_TARGET_STRATEGIES_OUTPUT ?? 'artifacts/historical-deep-target-strategies.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-target-strategies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production historical Deep target strategy bakeoff returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    metadata?: Record<string, unknown>;
    strategies?: Array<{
      strategy?: string;
      development?: Record<string, unknown>;
      holdout?: Record<string, unknown>;
      overall?: Record<string, unknown>;
    }>;
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    strategies: parsed.strategies?.map((item) => ({
      strategy: item.strategy ?? null,
      developmentErrorRecall: item.development?.modelErrorRecall ?? null,
      developmentHighConfidenceRecall: item.development?.highConfidenceErrorRecall ?? null,
      developmentBrierMassRecall: item.development?.brierMassRecall ?? null,
      holdoutErrorRecall: item.holdout?.modelErrorRecall ?? null,
      holdoutHighConfidenceRecall: item.holdout?.highConfidenceErrorRecall ?? null,
      holdoutBrierMassRecall: item.holdout?.brierMassRecall ?? null,
    })) ?? [],
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
