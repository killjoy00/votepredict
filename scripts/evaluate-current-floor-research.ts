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
  const outputPath = resolve(process.env.VOTEPREDICT_CURRENT_FLOOR_RESEARCH_OUTPUT ?? 'artifacts/current-floor-model-research.json');
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/current-floor-model-research', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production current-floor model research returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    data?: { fixedResearchTargets?: number };
    issueConditioning?: { selected?: { config?: { id?: string } } };
    participation?: { selected?: { config?: { id?: string } } };
    processContext?: { selected?: { config?: { id?: string } } };
    analogues?: { selected?: { config?: { id?: string } } };
    eventSpecificUncertainty?: { selected?: { bandCount?: number } };
    decision?: { combinedProspectiveShadow?: boolean; uncertaintyProspectiveShadow?: boolean };
    baseline?: { validation?: unknown; test?: unknown };
    combined?: { validation?: unknown; test?: unknown };
    final?: { validation?: unknown; test?: unknown };
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    fixedResearchTargets: parsed.data?.fixedResearchTargets ?? null,
    selectedIssue: parsed.issueConditioning?.selected?.config?.id ?? null,
    selectedParticipation: parsed.participation?.selected?.config?.id ?? null,
    selectedProcess: parsed.processContext?.selected?.config?.id ?? null,
    selectedAnalogue: parsed.analogues?.selected?.config?.id ?? null,
    selectedUncertaintyBands: parsed.eventSpecificUncertainty?.selected?.bandCount ?? null,
    combinedProspectiveShadow: parsed.decision?.combinedProspectiveShadow ?? false,
    uncertaintyProspectiveShadow: parsed.decision?.uncertaintyProspectiveShadow ?? false,
    baselineValidation: parsed.baseline?.validation ?? null,
    combinedValidation: parsed.combined?.validation ?? null,
    finalValidation: parsed.final?.validation ?? null,
    baselineTest: parsed.baseline?.test ?? null,
    combinedTest: parsed.combined?.test ?? null,
    finalTest: parsed.final?.test ?? null,
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
