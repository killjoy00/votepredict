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
    process.env.VOTEPREDICT_MEMBER_HISTORY_CAP_DRIFT_RAW_OUTPUT
      ?? 'artifacts/member-history-cap-drift-raw-v1.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/member-history-cap-drift-evaluation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production member-history cap evaluation returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    metadata?: { codeSha?: string | null };
    candidates?: Array<{ cap?: string }>;
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    runtimeCodeSha: parsed.metadata?.codeSha ?? null,
    candidateCaps: parsed.candidates?.map((item) => item.cap ?? null) ?? [],
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
