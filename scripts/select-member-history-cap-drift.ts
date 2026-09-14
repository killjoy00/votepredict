import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type Score = { observations: number; predicted: number; coverage: number; accuracy: number; brier: number; logLoss: number; expectedCalibrationError: number; };
type Candidate = { cap: string; overall: Score; bySessionAndChamber: Record<string, Score>; };
type RawEvaluation = { metadata: { generatedAt: string; codeSha: string | null; warning: string; scope: string }; observations: number; baseline: Score; candidates: Candidate[]; };
type Plan = {
  schemaVersion: 'member-history-cap-drift-plan-v1';
  existingEvaluator: { candidateCaps: Array<number | 'uncapped'>; sourceFileBlobSha: string };
  selectionRule: { baseline: 'uncapped'; primarySlice: '2025-2026/house'; promotionBoundary: string };
  guardrails: { probabilityAction: 'none'; runtimeDefaultChange: false; modelVersionChange: false; databaseWrites: false; productionWrites: false; nextStepIfCandidateQualifies: string };
};

const rawPath = process.argv[2];
const planPath = process.argv[3];
const outputPath = resolve(process.argv[4] ?? 'artifacts/member-history-cap-drift-evaluation-v1.json');
if (!rawPath || !planPath) throw new Error('raw member-history-cap evaluation and plan paths are required');
const raw = JSON.parse(readFileSync(resolve(rawPath), 'utf8')) as RawEvaluation;
const plan = JSON.parse(readFileSync(resolve(planPath), 'utf8')) as Plan;
if (plan.schemaVersion !== 'member-history-cap-drift-plan-v1') throw new Error('Unexpected member-history cap drift plan schema');
if (plan.selectionRule.baseline !== 'uncapped' || plan.selectionRule.primarySlice !== '2025-2026/house') throw new Error('Selection rule drifted');
if (plan.guardrails.probabilityAction !== 'none' || plan.guardrails.runtimeDefaultChange !== false || plan.guardrails.modelVersionChange !== false || plan.guardrails.databaseWrites !== false || plan.guardrails.productionWrites !== false) throw new Error('Member-history cap guardrails drifted');
const expectedLabels = plan.existingEvaluator.candidateCaps.map(String);
const actualLabels = raw.candidates.map((item) => item.cap);
if (expectedLabels.join(',') !== actualLabels.join(',')) throw new Error(`Candidate cap grid drifted: expected ${expectedLabels.join(',')}, got ${actualLabels.join(',')}`);
const baseline = raw.candidates.find((item) => item.cap === 'uncapped');
if (!baseline) throw new Error('Uncapped baseline missing');
const requiredSlices = ['2021-2022/house', '2023-2024/house', '2025-2026/house'];
for (const slice of requiredSlices) if (!baseline.bySessionAndChamber[slice]) throw new Error(`Baseline missing required slice ${slice}`);

function delta(candidate: Score, base: Score) {
  return { brier: candidate.brier - base.brier, logLoss: candidate.logLoss - base.logLoss, expectedCalibrationError: candidate.expectedCalibrationError - base.expectedCalibrationError, accuracy: candidate.accuracy - base.accuracy };
}

const assessed = raw.candidates.filter((item) => item.cap !== 'uncapped').map((candidate) => {
  const primary = candidate.bySessionAndChamber['2025-2026/house'];
  const basePrimary = baseline.bySessionAndChamber['2025-2026/house'];
  const prior1 = candidate.bySessionAndChamber['2021-2022/house'];
  const prior2 = candidate.bySessionAndChamber['2023-2024/house'];
  if (!primary || !prior1 || !prior2) throw new Error(`Candidate ${candidate.cap} missing required House slices`);
  const conditions = {
    improves2025Brier: primary.brier < basePrimary.brier,
    improves2025Ece: primary.expectedCalibrationError < basePrimary.expectedCalibrationError,
    acceptable2025LogLoss: primary.logLoss - basePrimary.logLoss <= 0.005,
    acceptableOverallBrier: candidate.overall.brier - baseline.overall.brier <= 0.001,
    acceptableOverallAccuracy: candidate.overall.accuracy - baseline.overall.accuracy >= -0.002,
    acceptable2021HouseBrier: prior1.brier - baseline.bySessionAndChamber['2021-2022/house'].brier <= 0.003,
    acceptable2023HouseBrier: prior2.brier - baseline.bySessionAndChamber['2023-2024/house'].brier <= 0.003,
  };
  return {
    cap: candidate.cap,
    qualifies: Object.values(conditions).every(Boolean),
    conditions,
    overall: candidate.overall,
    overallDelta: delta(candidate.overall, baseline.overall),
    primary2025House: primary,
    primary2025HouseDelta: delta(primary, basePrimary),
    priorHouse: {
      '2021-2022': prior1,
      '2021-2022Delta': delta(prior1, baseline.bySessionAndChamber['2021-2022/house']),
      '2023-2024': prior2,
      '2023-2024Delta': delta(prior2, baseline.bySessionAndChamber['2023-2024/house']),
    },
  };
});

const qualifiers = assessed.filter((item) => item.qualifies).sort((left, right) => left.primary2025House.brier - right.primary2025House.brier || left.primary2025House.expectedCalibrationError - right.primary2025House.expectedCalibrationError || Number(left.cap) - Number(right.cap));
const selected = qualifiers[0] ?? null;
const result = {
  schemaVersion: 'member-history-cap-drift-evaluation-v1',
  generatedAt: new Date().toISOString(),
  purpose: 'retrospective evaluation of the pre-existing member-history cap grid against 2025-2026 House calibration drift; may nominate a shadow cap but cannot change production runtime defaults',
  metadata: {
    runtimeCodeSha: raw.metadata.codeSha,
    analysisStatus: 'retrospective-shadow-only',
    probabilityAction: 'none',
    runtimeDefaultChange: false,
    modelVersionChange: false,
    evaluatorWarning: raw.metadata.warning,
    evaluatorScope: raw.metadata.scope,
  },
  baseline: {
    cap: 'uncapped',
    overall: baseline.overall,
    house2021_2022: baseline.bySessionAndChamber['2021-2022/house'],
    house2023_2024: baseline.bySessionAndChamber['2023-2024/house'],
    house2025_2026: baseline.bySessionAndChamber['2025-2026/house'],
  },
  candidates: assessed,
  decision: {
    status: selected ? 'shadow_candidate_nominated' : 'no_candidate_qualifies',
    selectedCap: selected?.cap ?? null,
    qualifyingCaps: qualifiers.map((item) => item.cap),
    productionAction: 'none',
    nextStep: selected ? plan.guardrails.nextStepIfCandidateQualifies : 'Retain uncapped history and investigate other drift mechanisms; do not alter production defaults.',
  },
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputPath, decision: result.decision, baseline2025House: result.baseline.house2025_2026, candidates: result.candidates.map((item) => ({ cap: item.cap, qualifies: item.qualifies, primary2025HouseDelta: item.primary2025HouseDelta, overallDelta: item.overallDelta, conditions: item.conditions })) }, null, 2));
