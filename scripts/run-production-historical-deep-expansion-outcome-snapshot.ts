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
  const discoveryPath = process.argv[2];
  const lineagePath = process.argv[3] ?? 'data/evaluation/historical-deep-expansion-scoring-lineage-v1.json';
  if (!discoveryPath) throw new Error('Frozen expansion discovery manifest path is required');
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(
    process.env.VOTEPREDICT_DEEP_EXPANSION_OUTCOME_OUTPUT
      ?? 'artifacts/historical-deep-expansion-outcome-snapshot.json',
  );
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8'));
  const lineage = JSON.parse(readFileSync(resolve(lineagePath), 'utf8')) as {
    candidateArtifact?: {
      workflowRunId?: string;
      artifactId?: number;
      artifactSha256?: string;
      headSha?: string;
    };
  };
  const candidateArtifact = lineage.candidateArtifact;
  if (
    !candidateArtifact?.workflowRunId
    || !Number.isInteger(candidateArtifact.artifactId)
    || !candidateArtifact.artifactSha256
    || !candidateArtifact.headSha
  ) throw new Error('Pinned candidate artifact lineage is incomplete');

  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-expansion-outcome-snapshot', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ discovery, candidateArtifact }),
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    throw new Error(`Production historical Deep expansion outcome snapshot returned HTTP ${response.status}`);
  }
  const parsed = await response.json() as {
    schemaVersion?: string;
    codeSha?: string | null;
    cases?: Array<{ members?: unknown[] }>;
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: parsed.schemaVersion ?? null,
    codeSha: parsed.codeSha ?? null,
    cases: parsed.cases?.length ?? 0,
    decisiveMemberOutcomes: parsed.cases?.reduce((sum, item) => sum + (item.members?.length ?? 0), 0) ?? 0,
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
