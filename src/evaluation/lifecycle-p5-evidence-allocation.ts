import { createHash } from 'node:crypto';
import type { LifecycleP3Snapshot, LifecycleState } from './lifecycle-p3-snapshot-dataset';
import {
  FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
  scoreLifecycleBinary,
  type LifecycleP4BinaryScore,
} from './lifecycle-p4-baselines';
import { REVISOR_PROCESS_PARSER_VERSION } from '../sources/minnesota/revisor-process';

export const LIFECYCLE_P5_SCHEMA_VERSION = 'lifecycle-p5-evidence-allocation-v1' as const;

export type LifecycleP5Target =
  | 'reach_floor_eligibility'
  | 'reach_source_chamber_passage_vote'
  | 'source_chamber_passage';

export type LifecycleP5EvidenceFamily =
  | 'process_detail'
  | 'companion'
  | 'bill_version'
  | 'authorship';

export type LifecycleP5Model =
  | 'process_detail'
  | 'companion'
  | 'bill_version'
  | 'authorship'
  | 'core_combined'
  | 'core_minus_process_detail'
  | 'core_minus_companion'
  | 'core_minus_bill_version';

type Chamber = 'house' | 'senate';

export interface LifecycleP5Row {
  billId: string;
  session: string;
  chamber: Chamber;
  cutoffDateExclusive: string;
  lifecycleState: LifecycleState;
  target: LifecycleP5Target;
  outcome: 0 | 1;
  eligibleFamilies: Record<LifecycleP5EvidenceFamily, boolean>;
  tokens: Record<LifecycleP5EvidenceFamily, string[]>;
}

export interface LifecycleP5Prediction {
  billId: string;
  session: string;
  chamber: Chamber;
  cutoffDateExclusive: string;
  lifecycleState: LifecycleState;
  target: LifecycleP5Target;
  model: LifecycleP5Model;
  baselineProbability: number;
  candidateProbability: number;
  outcome: 0 | 1;
}

type ModelDefinition = {
  model: LifecycleP5Model;
  families: LifecycleP5EvidenceFamily[];
};

const MODEL_DEFINITIONS: ModelDefinition[] = [
  { model: 'process_detail', families: ['process_detail'] },
  { model: 'companion', families: ['companion'] },
  { model: 'bill_version', families: ['bill_version'] },
  { model: 'authorship', families: ['authorship'] },
  { model: 'core_combined', families: ['process_detail', 'companion', 'bill_version'] },
  { model: 'core_minus_process_detail', families: ['companion', 'bill_version'] },
  { model: 'core_minus_companion', families: ['process_detail', 'bill_version'] },
  { model: 'core_minus_bill_version', families: ['process_detail', 'companion'] },
];

const PRIOR_STRENGTH = 100;
const MIN_TOKEN_SUPPORT = 30;
const MAX_TOKEN_DELTAS = 6;
const TOKEN_SCALE = 0.5;
const PROBABILITY_FLOOR = 0.0025;
const PROBABILITY_CEILING = 0.9975;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function logit(probability: number): number {
  const p = clamp(probability, 1e-9, 1 - 1e-9);
  return Math.log(p / (1 - p));
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function stateRank(state: LifecycleState): number {
  switch (state) {
    case 'introduced': return 0;
    case 'committee_process_engagement': return 1;
    case 'floor_eligibility_or_scheduling': return 2;
    case 'source_chamber_passage_vote_reached': return 3;
  }
}

function countBucket(value: number): string {
  if (value <= 0) return '0';
  if (value === 1) return '1';
  if (value <= 3) return '2-3';
  if (value <= 7) return '4-7';
  return '8+';
}

function authorCountBucket(value: number): string {
  if (value <= 1) return String(value);
  if (value <= 3) return '2-3';
  if (value <= 6) return '4-6';
  return '7+';
}

function textLengthBucket(value: number | null): string {
  if (value === null) return 'unknown';
  if (value < 2_000) return '<2k';
  if (value < 5_000) return '2k-5k';
  if (value < 10_000) return '5k-10k';
  if (value < 20_000) return '10k-20k';
  return '20k+';
}

export function evidenceFamilyTokens(
  snapshot: LifecycleP3Snapshot,
): Record<LifecycleP5EvidenceFamily, string[]> {
  const processEntries = Object.entries(snapshot.features.priorProcessStageCounts)
    .filter(([stageKind]) => stageKind !== 'companion_reference' && stageKind !== 'author_added')
    .sort(([a], [b]) => a.localeCompare(b));
  const processTokens = [
    `process:event-count:${countBucket(processEntries.reduce((sum, [, count]) => sum + count, 0))}`,
  ];
  for (const [stageKind, count] of processEntries) {
    processTokens.push(`process:stage:${stageKind}:${countBucket(count)}`);
  }

  const companionCount = snapshot.features.priorCompanionIdentifiers.length;
  const companionTokens = [
    `companion:count:${countBucket(companionCount)}`,
    companionCount > 0 ? 'companion:present' : 'companion:absent',
  ];

  const version = snapshot.features.latestEligibleBillVersion;
  const billVersionTokens = version
    ? [
        'bill-version:available',
        `bill-version:text-length:${textLengthBucket(version.textLengthChars)}`,
      ]
    : ['bill-version:not-yet-available'];

  const authors = snapshot.features.authorship.membershipIds;
  const authorshipTokens = snapshot.features.authorship.reconstructable && authors
    ? [
        'authorship:reconstructable',
        `authorship:count:${authorCountBucket(authors.length)}`,
      ]
    : [];

  return {
    process_detail: processTokens,
    companion: companionTokens,
    bill_version: billVersionTokens,
    authorship: authorshipTokens,
  };
}

function familyEligibility(
  snapshot: LifecycleP3Snapshot,
): Record<LifecycleP5EvidenceFamily, boolean> {
  const processAvailable = snapshot.lineage.processParserVersion === REVISOR_PROCESS_PARSER_VERSION;
  return {
    process_detail: processAvailable,
    companion: processAvailable,
    bill_version: true,
    authorship: snapshot.features.authorship.reconstructable
      && snapshot.features.authorship.membershipIds !== null,
  };
}

function billReachedFloorEligibility(snapshots: readonly LifecycleP3Snapshot[]): boolean {
  return snapshots.some((snapshot) =>
    stateRank(snapshot.features.lifecycleState) >= 2
    || (snapshot.targets.transitionOnCutoffDate.toState
      ? stateRank(snapshot.targets.transitionOnCutoffDate.toState) >= 2
      : false));
}

function buildRowsForBill(snapshots: readonly LifecycleP3Snapshot[]): LifecycleP5Row[] {
  if (!snapshots.length) return [];
  const ordered = [...snapshots].sort((left, right) =>
    left.cutoff.asOfDateExclusive.localeCompare(right.cutoff.asOfDateExclusive));
  const processKnown = ordered.some((snapshot) =>
    snapshot.lineage.processParserVersion === REVISOR_PROCESS_PARSER_VERSION);
  const reachedFloor = billReachedFloorEligibility(ordered);
  const reachedVote = ordered[0].targets.eventualReachesSourceChamberPassageVote;
  const passed = ordered[0].targets.eventualSourceChamberPassage;
  const rows: LifecycleP5Row[] = [];

  for (const snapshot of ordered) {
    const rank = stateRank(snapshot.features.lifecycleState);
    const common = {
      billId: snapshot.bill.billId,
      session: snapshot.bill.session,
      chamber: snapshot.bill.chamber,
      cutoffDateExclusive: snapshot.cutoff.asOfDateExclusive,
      lifecycleState: snapshot.features.lifecycleState,
      eligibleFamilies: familyEligibility(snapshot),
      tokens: evidenceFamilyTokens(snapshot),
    };

    if (processKnown && rank < 2) {
      rows.push({
        ...common,
        target: 'reach_floor_eligibility',
        outcome: reachedFloor ? 1 : 0,
      });
    }
    if (processKnown && rank < 3) {
      rows.push({
        ...common,
        target: 'reach_source_chamber_passage_vote',
        outcome: reachedVote ? 1 : 0,
      });
    }
    rows.push({
      ...common,
      target: 'source_chamber_passage',
      outcome: passed ? 1 : 0,
    });
  }

  return rows;
}

export function buildLifecycleP5Rows(
  snapshots: readonly LifecycleP3Snapshot[],
): LifecycleP5Row[] {
  const byBill = new Map<string, LifecycleP3Snapshot[]>();
  for (const snapshot of snapshots) {
    const bucket = byBill.get(snapshot.bill.billId) ?? [];
    bucket.push(snapshot);
    byBill.set(snapshot.bill.billId, bucket);
  }
  const rows = [...byBill.values()].flatMap(buildRowsForBill);
  rows.sort((left, right) =>
    left.target.localeCompare(right.target)
    || left.session.localeCompare(right.session)
    || left.chamber.localeCompare(right.chamber)
    || left.billId.localeCompare(right.billId)
    || left.cutoffDateExclusive.localeCompare(right.cutoffDateExclusive));
  return rows;
}

function rowEligibleForModel(row: LifecycleP5Row, definition: ModelDefinition): boolean {
  return definition.families.every((family) => row.eligibleFamilies[family]);
}

function baseKey(row: LifecycleP5Row): string {
  return `${row.chamber}|${row.lifecycleState}`;
}

type RateStats = { positives: number; total: number };

function addStat(map: Map<string, RateStats>, key: string, outcome: 0 | 1): void {
  const stat = map.get(key) ?? { positives: 0, total: 0 };
  stat.total += 1;
  stat.positives += outcome;
  map.set(key, stat);
}

function jeffreys(stat: RateStats): number {
  return (stat.positives + 0.5) / (stat.total + 1);
}

type BaselineModel = {
  overall: number;
  chamber: Map<Chamber, number>;
  group: Map<string, number>;
};

function fitBaseline(rows: readonly LifecycleP5Row[]): BaselineModel {
  if (!rows.length) throw new Error('Cannot fit lifecycle P5 baseline without rows');
  const overallStat: RateStats = { positives: 0, total: 0 };
  const chamberStats = new Map<string, RateStats>();
  const groupStats = new Map<string, RateStats>();
  for (const row of rows) {
    overallStat.total += 1;
    overallStat.positives += row.outcome;
    addStat(chamberStats, row.chamber, row.outcome);
    addStat(groupStats, baseKey(row), row.outcome);
  }
  return {
    overall: jeffreys(overallStat),
    chamber: new Map([...chamberStats.entries()].map(([key, stat]) => [key as Chamber, jeffreys(stat)])),
    group: new Map([...groupStats.entries()].map(([key, stat]) => [key, jeffreys(stat)])),
  };
}

function baselineProbability(model: BaselineModel, row: LifecycleP5Row): number {
  return model.group.get(baseKey(row))
    ?? model.chamber.get(row.chamber)
    ?? model.overall;
}

type TokenStat = {
  positives: number;
  total: number;
};

type TokenModel = Map<string, TokenStat>;

function tokenKey(row: LifecycleP5Row, token: string): string {
  return `${baseKey(row)}|${token}`;
}

function fitTokenModel(
  rows: readonly LifecycleP5Row[],
  definition: ModelDefinition,
): TokenModel {
  const stats = new Map<string, TokenStat>();
  for (const row of rows) {
    const seen = new Set(
      definition.families.flatMap((family) => row.tokens[family]),
    );
    for (const token of seen) {
      const key = tokenKey(row, token);
      const stat = stats.get(key) ?? { positives: 0, total: 0 };
      stat.total += 1;
      stat.positives += row.outcome;
      stats.set(key, stat);
    }
  }
  return stats;
}

function tokenDelta(
  baseProbability: number,
  stat: TokenStat | undefined,
): number {
  if (!stat || stat.total < MIN_TOKEN_SUPPORT) return 0;
  const smoothed = (stat.positives + PRIOR_STRENGTH * baseProbability)
    / (stat.total + PRIOR_STRENGTH);
  return logit(smoothed) - logit(baseProbability);
}

function candidateProbability(
  row: LifecycleP5Row,
  definition: ModelDefinition,
  baseline: BaselineModel,
  tokens: TokenModel,
): number {
  const base = baselineProbability(baseline, row);
  const deltas = [...new Set(definition.families.flatMap((family) => row.tokens[family]))]
    .map((token) => tokenDelta(base, tokens.get(tokenKey(row, token))))
    .filter((delta) => Number.isFinite(delta) && delta !== 0)
    .sort((left, right) => Math.abs(right) - Math.abs(left))
    .slice(0, MAX_TOKEN_DELTAS);
  if (!deltas.length) return base;
  const meanDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  return clamp(
    logistic(logit(base) + TOKEN_SCALE * meanDelta),
    PROBABILITY_FLOOR,
    PROBABILITY_CEILING,
  );
}

export function buildForwardChainedLifecycleP5Predictions(
  rows: readonly LifecycleP5Row[],
  definition: ModelDefinition,
): LifecycleP5Prediction[] {
  const sessions = [...new Set(rows.map((row) => row.session))].sort();
  const predictions: LifecycleP5Prediction[] = [];
  for (const target of [
    'reach_floor_eligibility',
    'reach_source_chamber_passage_vote',
    'source_chamber_passage',
  ] as const) {
    const targetRows = rows.filter((row) => row.target === target);
    for (let index = 1; index < sessions.length; index += 1) {
      const holdoutSession = sessions[index];
      const training = targetRows.filter((row) =>
        row.session < holdoutSession && rowEligibleForModel(row, definition));
      const holdout = targetRows.filter((row) =>
        row.session === holdoutSession && rowEligibleForModel(row, definition));
      if (!training.length || !holdout.length) continue;
      const baseline = fitBaseline(training);
      const tokenModel = fitTokenModel(training, definition);
      for (const row of holdout) {
        predictions.push({
          billId: row.billId,
          session: row.session,
          chamber: row.chamber,
          cutoffDateExclusive: row.cutoffDateExclusive,
          lifecycleState: row.lifecycleState,
          target: row.target,
          model: definition.model,
          baselineProbability: baselineProbability(baseline, row),
          candidateProbability: candidateProbability(row, definition, baseline, tokenModel),
          outcome: row.outcome,
        });
      }
    }
  }
  return predictions.sort((left, right) =>
    left.target.localeCompare(right.target)
    || left.model.localeCompare(right.model)
    || left.session.localeCompare(right.session)
    || left.chamber.localeCompare(right.chamber)
    || left.billId.localeCompare(right.billId)
    || left.cutoffDateExclusive.localeCompare(right.cutoffDateExclusive));
}

function scoreDelta(candidate: LifecycleP4BinaryScore, baseline: LifecycleP4BinaryScore) {
  return {
    brier: candidate.brier - baseline.brier,
    logLoss: candidate.logLoss - baseline.logLoss,
    expectedCalibrationError: candidate.expectedCalibrationError - baseline.expectedCalibrationError,
    averagePrecision: candidate.averagePrecision === null || baseline.averagePrecision === null
      ? null
      : candidate.averagePrecision - baseline.averagePrecision,
    rocAuc: candidate.rocAuc === null || baseline.rocAuc === null
      ? null
      : candidate.rocAuc - baseline.rocAuc,
  };
}

function scorePredictionRows(rows: readonly LifecycleP5Prediction[]) {
  const baseline = scoreLifecycleBinary(rows.map((row) => ({
    probability: row.baselineProbability,
    outcome: row.outcome,
  })));
  const candidate = scoreLifecycleBinary(rows.map((row) => ({
    probability: row.candidateProbability,
    outcome: row.outcome,
  })));
  return { baseline, candidate, deltaVsBaseline: scoreDelta(candidate, baseline) };
}

function scoreSlices(
  rows: readonly LifecycleP5Prediction[],
  key: (row: LifecycleP5Prediction) => string,
) {
  return Object.fromEntries(
    [...new Set(rows.map(key))].sort().map((slice) => [
      slice,
      scorePredictionRows(rows.filter((row) => key(row) === slice)),
    ]),
  );
}

function predictionsDigest(rows: readonly LifecycleP5Prediction[]): string {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`);
  return hash.digest('hex');
}

function targetCoverage(
  allRows: readonly LifecycleP5Row[],
  predictions: readonly LifecycleP5Prediction[],
  target: LifecycleP5Target,
) {
  const holdoutSessions = new Set(['2023-2024', '2025-2026']);
  const targetRows = allRows.filter((row) =>
    row.target === target && holdoutSessions.has(row.session));
  const predictedKeys = new Set(predictions
    .filter((row) => row.target === target)
    .map((row) => `${row.billId}|${row.cutoffDateExclusive}`));
  return {
    eligibleRows: predictedKeys.size,
    targetRows: targetRows.length,
    rowCoverage: targetRows.length ? predictedKeys.size / targetRows.length : 0,
    eligibleBills: new Set(predictions
      .filter((row) => row.target === target)
      .map((row) => row.billId)).size,
    targetBills: new Set(targetRows.map((row) => row.billId)).size,
  };
}

function modelReport(
  allRows: readonly LifecycleP5Row[],
  predictions: readonly LifecycleP5Prediction[],
  definition: ModelDefinition,
) {
  const byTarget = Object.fromEntries(
    ([
      'reach_floor_eligibility',
      'reach_source_chamber_passage_vote',
      'source_chamber_passage',
    ] as LifecycleP5Target[]).map((target) => {
      const rows = predictions.filter((row) => row.target === target);
      if (!rows.length) return [target, null];
      return [target, {
        coverage: targetCoverage(allRows, predictions, target),
        overall: scorePredictionRows(rows),
        bySession: scoreSlices(rows, (row) => row.session),
        byChamber: scoreSlices(rows, (row) => row.chamber),
        byState: scoreSlices(rows, (row) => row.lifecycleState),
      }];
    }),
  );
  return {
    model: definition.model,
    families: definition.families,
    byTarget,
    predictionSha256: predictionsDigest(predictions),
  };
}

export function summarizeLifecycleP5EvidenceAllocation(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  p3ObservedSha256: string;
  codeSha: string | null;
}) {
  if (input.p3ObservedSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
    throw new Error(
      `Lifecycle P5 refuses P3 drift: observed ${input.p3ObservedSha256}, expected ${FROZEN_LIFECYCLE_P3_CONTENT_SHA256}`,
    );
  }

  const rows = buildLifecycleP5Rows(input.snapshots);
  const predictionsByModel = new Map<LifecycleP5Model, LifecycleP5Prediction[]>();
  for (const definition of MODEL_DEFINITIONS) {
    predictionsByModel.set(
      definition.model,
      buildForwardChainedLifecycleP5Predictions(rows, definition),
    );
  }

  const externalEvidenceSnapshots = input.snapshots.filter((snapshot) =>
    Object.values(snapshot.features.evidenceFamilyCounts).some((count) => count > 0));
  const externalEvidenceKinds = [...new Set(externalEvidenceSnapshots.flatMap((snapshot) =>
    Object.keys(snapshot.features.evidenceFamilyCounts)))].sort();

  const reports = Object.fromEntries(MODEL_DEFINITIONS.map((definition) => [
    definition.model,
    modelReport(rows, predictionsByModel.get(definition.model) ?? [], definition),
  ]));

  const processEligibleSnapshots = input.snapshots.filter((snapshot) =>
    snapshot.lineage.processParserVersion === REVISOR_PROCESS_PARSER_VERSION).length;
  const authorshipEligibleSnapshots = input.snapshots.filter((snapshot) =>
    snapshot.features.authorship.reconstructable
    && snapshot.features.authorship.membershipIds !== null).length;
  const billVersionEligibleSnapshots = input.snapshots.filter((snapshot) =>
    snapshot.features.latestEligibleBillVersion !== null).length;
  const companionPositiveSnapshots = input.snapshots.filter((snapshot) =>
    snapshot.features.priorCompanionIdentifiers.length > 0).length;

  return {
    schemaVersion: LIFECYCLE_P5_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    codeSha: input.codeSha,
    frozenP3: {
      snapshotContentSha256: input.p3ObservedSha256,
      bills: new Set(input.snapshots.map((snapshot) => snapshot.bill.billId)).size,
      snapshots: input.snapshots.length,
    },
    chronology: {
      developmentSession: '2021-2022',
      forwardChainedHoldouts: ['2023-2024', '2025-2026'],
      rule: 'Every P5 candidate is fit on completed earlier biennia only. Already-inspected historical periods remain development/robustness analysis.',
    },
    targetAllocation: {
      reach_floor_eligibility: 'Bill/process evidence may update the chance of reaching floor eligibility or scheduling while the bill is still introduced or in committee process.',
      reach_source_chamber_passage_vote: 'Bill/process evidence may update floor-access probability before a source-chamber passage vote is reached.',
      source_chamber_passage: 'Bill/process evidence may update strict bill-number source-chamber passage probability at any pre-terminal lifecycle snapshot.',
      conditional_member_support: 'Not evaluated in P5. Member-level vote scoring remains a separate conditional model on observed passage votes only.',
    },
    frozenModelingOptions: {
      priorStrength: PRIOR_STRENGTH,
      minimumTokenSupport: MIN_TOKEN_SUPPORT,
      maximumTokenDeltas: MAX_TOKEN_DELTAS,
      tokenScale: TOKEN_SCALE,
      probabilityFloor: PROBABILITY_FLOOR,
      probabilityCeiling: PROBABILITY_CEILING,
      baseline: 'source chamber + canonical lifecycle state empirical rate',
      tokenSemantics: 'Low-dimensional categorical evidence summaries only; no member IDs, companion bill IDs, text hashes, or outcome-derived labels are used as candidate tokens.',
    },
    familyEligibility: {
      process_detail: {
        rule: 'Requires revisor-process-v2 at the snapshot. Uses only prior dated official process-event counts by stage kind beyond the coarse state baseline.',
        eligibleSnapshots: processEligibleSnapshots,
        coverage: processEligibleSnapshots / input.snapshots.length,
      },
      companion: {
        rule: 'Requires revisor-process-v2. Uses only whether/how many companion identifiers were established by dated official actions before cutoff; specific companion IDs are not model tokens.',
        eligibleSnapshots: processEligibleSnapshots,
        positiveSnapshots: companionPositiveSnapshots,
        coverage: processEligibleSnapshots / input.snapshots.length,
      },
      bill_version: {
        rule: 'Uses only the latest bill version proved published strictly before cutoff. Tokens are availability and text-length bucket; text hash/identity are lineage only.',
        eligibleSnapshots: input.snapshots.length,
        snapshotsWithVersion: billVersionEligibleSnapshots,
        coverage: 1,
      },
      authorship: {
        rule: 'Evaluated only where dated authorship is fully reconstructable. Missing reconstruction is not used as a predictive token.',
        eligibleSnapshots: authorshipEligibleSnapshots,
        coverage: authorshipEligibleSnapshots / input.snapshots.length,
      },
      durable_external_evidence: {
        rule: 'Requires both durable fetch availability and publication availability before historical cutoff under the frozen P3 contract.',
        eligibleSnapshots: externalEvidenceSnapshots.length,
        evidenceKinds: externalEvidenceKinds,
        retrospectiveStatus: externalEvidenceSnapshots.length === 0
          ? 'not_testable_prospective_only'
          : 'eligible',
      },
    },
    ablations: {
      singleFamily: ['process_detail', 'companion', 'bill_version', 'authorship'],
      coreCombined: ['process_detail', 'companion', 'bill_version'],
      leaveOneFamilyOut: [
        'core_minus_process_detail',
        'core_minus_companion',
        'core_minus_bill_version',
      ],
      authorshipHandling: 'Authorship remains a matched-subset analysis because only reconstructable snapshots are eligible; it is not mixed into the full-coverage core combined candidate.',
    },
    models: reports,
    policy: {
      associationsAreNotCausalEffects: true,
      floorVoteMemberScoringKeptSeparate: true,
      historicalResultStatus: 'development/robustness',
      automaticPromotionAllowed: false,
      servingChanged: false,
      prospective2027RequiredForGoverningConfirmation: true,
    },
  };
}
