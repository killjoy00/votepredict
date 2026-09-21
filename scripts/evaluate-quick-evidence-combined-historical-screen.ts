import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
  type QuickEvidenceCommitteeRollcallCandidateArtifact,
} from '../src/evaluation/quick-evidence-committee-rollcall-extractor.js';
import {
  QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA,
  type QuickEvidenceCombinedScreenInput,
} from '../src/evaluation/quick-evidence-combined-historical-screen.js';

let secretValues: string[] = [];

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
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

interface CandidateLineage {
  schemaVersion: 'quick-evidence-committee-rollcall-candidate-lineage-v1';
  extractionRunId: number;
  extractionHeadSha: string;
  candidateArtifact: {
    name: string;
    id: number;
    digest: string;
  };
  policy: {
    plan: string;
    parser: string;
    mechanicsPolicy: string;
    outcomeUseBeforeThisStage: string;
    productionAction: string;
  };
}

async function main(): Promise<void> {
  const candidatePath = resolve(requiredArgument('--committee-candidates'));
  const lineagePath = resolve(requiredArgument('--committee-lineage'));
  const outputPath = resolve(
    argumentValue('--output')
      ?? process.env.VOTEPREDICT_COMBINED_EVIDENCE_SCREEN_OUTPUT
      ?? 'artifacts/quick-evidence-combined-historical-screen-v1.json',
  );
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');

  const committee = JSON.parse(readFileSync(candidatePath, 'utf8')) as QuickEvidenceCommitteeRollcallCandidateArtifact;
  const lineage = JSON.parse(readFileSync(lineagePath, 'utf8')) as CandidateLineage;
  if (committee.schemaVersion !== 'quick-evidence-committee-rollcall-candidates-v1') {
    throw new Error(`Unsupported committee candidate schema: ${String(committee.schemaVersion)}`);
  }
  if (committee.metadata.outcomeUse !== 'none' || committee.metadata.probabilityAction !== 'none') {
    throw new Error('Committee candidate artifact is not outcome-blind');
  }
  if (lineage.schemaVersion !== 'quick-evidence-committee-rollcall-candidate-lineage-v1') {
    throw new Error('Unexpected committee candidate lineage schema');
  }
  if (
    lineage.policy.plan !== 'quick-evidence-committee-rollcall-screen-plan-v1'
    || lineage.policy.outcomeUseBeforeThisStage !== 'none'
    || lineage.policy.productionAction !== 'none'
  ) {
    throw new Error('Committee candidate lineage does not match the frozen combined screen boundary');
  }

  const input: QuickEvidenceCombinedScreenInput = {
    schemaVersion: QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA,
    committeeArtifact: {
      workflowRunId: lineage.extractionRunId,
      headSha: lineage.extractionHeadSha,
      artifactId: lineage.candidateArtifact.id,
      digest: lineage.candidateArtifact.digest,
    },
    committeeFeatureNames: [...QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES],
    committeeRows: committee.featureRows.map((row) => ({
      voteEventId: row.voteEventId,
      membershipId: row.membershipId,
      features: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.map((name) => row.features[name]),
    })),
  };

  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/quick-evidence-combined-historical-screen', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Production combined Quick Evidence screen returned HTTP ${response.status}: ${body.slice(0, 1000)}`);
  }

  const result = await response.json() as Record<string, unknown>;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  const selected = result.selected as Record<string, unknown> | null | undefined;
  const conclusion = result.conclusion as Record<string, unknown> | undefined;
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: result.schemaVersion ?? null,
    coverageGate: (result.coverageGate as Record<string, unknown> | undefined)?.passed ?? null,
    coverage: result.coverage ?? null,
    selectedLambda: selected?.lambda ?? null,
    validationDelta: (selected?.deltaCandidateMinusBaseline as Record<string, unknown> | undefined)?.validation ?? null,
    descriptiveDelta: (selected?.deltaCandidateMinusBaseline as Record<string, unknown> | undefined)?.descriptiveTest ?? null,
    hypothesisSignal: conclusion?.hypothesisSignal ?? null,
    reason: conclusion?.reason ?? null,
    productionAction: conclusion?.productionAction ?? null,
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
