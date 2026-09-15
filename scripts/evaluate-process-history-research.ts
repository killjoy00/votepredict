import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/process-history-model-research';

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(process.env.VOTEPREDICT_PROCESS_RESEARCH_OUTPUT ?? 'artifacts/process-history-model-research.json');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) throw new Error(`Production process-history model research returned HTTP ${response.status}`);
  const parsed = await response.json() as {
    data?: Record<string, unknown>;
    processContext?: { selected?: { config?: { id?: string } }; deltaVsBaseline?: unknown };
    decision?: { prospectiveShadow?: boolean };
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    data: parsed.data ?? null,
    selected: parsed.processContext?.selected?.config?.id ?? null,
    prospectiveShadow: parsed.decision?.prospectiveShadow ?? false,
    deltaVsBaseline: parsed.processContext?.deltaVsBaseline ?? null,
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
