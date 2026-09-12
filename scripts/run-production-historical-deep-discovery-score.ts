import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

let secretValues: string[] = [];

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

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
  const candidatePathValue = argumentValue('--candidates');
  if (!candidatePathValue) throw new Error('--candidates is required');
  const candidatePath = resolve(candidatePathValue);
  const outputPath = resolve(
    argumentValue('--output')
      ?? process.env.VOTEPREDICT_DEEP_DISCOVERY_SCORE_OUTPUT
      ?? 'artifacts/historical-deep-discovery-score.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const candidateJson = readFileSync(candidatePath, 'utf8');
  JSON.parse(candidateJson);
  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-discovery-score', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'content-type': 'application/json',
    },
    body: candidateJson,
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production historical Deep discovery score returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    overall?: Record<string, unknown>;
    challengeExamples?: Array<Record<string, unknown>>;
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    overall: parsed.overall ?? null,
    challengeExamples: parsed.challengeExamples?.slice(0, 20) ?? [],
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
