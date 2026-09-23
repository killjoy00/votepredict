import { createHash } from 'node:crypto';
import { scoreLifecycleBinary } from './lifecycle-p4-baselines';
import type { LifecycleP3Snapshot } from './lifecycle-p3-snapshot-dataset';
import type { LifecycleExternalAvailabilityAccepted } from './lifecycle-external-availability';
import {
  buildLifecycleP5ProspectiveRow,
  predictLifecycleP5RetainedProspectiveModel,
  type LifecycleP5RetainedProspectiveModel,
} from './lifecycle-p5-evidence-allocation';

export const LIFECYCLE_EXTERNAL_SELECTION_CONTROL_SCHEMA =
  'lifecycle-external-selection-control-v1' as const;
export const LIFECYCLE_EXTERNAL_SELECTION_CONTROL_LAMBDAS = [0.1, 1, 5, 20, 100] as const;

export interface LifecycleExternalSelectionRow {
  snapshotId: string;
  billId: string;
  session: string;
  chamber: 'house' | 'senate';
  cutoffDateExclusive: string;
  lifecycleState: string;
  outcome: 0 | 1;
  p5Probability: number;
  authorshipReconstructable: 0 | 1;
  officialBillSummary: number;
  authorDistrictContext: number;
  authorMemberPrimaryPublication: number;
  authorVerifiedNews: number;
}

type DiagnosticFeature =
  | 'authorshipReconstructable'
  | 'officialBillSummary'
  | 'authorDistrictContext'
  | 'authorMemberPrimaryPublication'
  | 'authorVerifiedNews';

type Observation = LifecycleExternalSelectionRow & { vector: number[] };

function clampProbability(value: number): number {
  return Math.min(0.9975, Math.max(0.0025, value));
}
function logit(value: number): number {
  const p = clampProbability(value);
  return Math.log(p / (1 - p));
}
function logistic(value: number): number {
  if (value >= 0) return clampProbability(1 / (1 + Math.exp(-value)));
  const exp = Math.exp(value);
  return clampProbability(exp / (1 + exp));
}

const MODEL_FEATURES = {
  authorship_nuisance: ['authorshipReconstructable'],
  author_external_after_nuisance: [
    'authorshipReconstructable',
    'authorDistrictContext',
    'authorMemberPrimaryPublication',
    'authorVerifiedNews',
  ],
  bill_summary_on_p5: ['officialBillSummary'],
} as const satisfies Record<string, readonly DiagnosticFeature[]>;

function vector(row: LifecycleExternalSelectionRow, features: readonly DiagnosticFeature[]): number[] {
  return features.map((feature) => {
    const value = row[feature];
    return feature === 'authorshipReconstructable' ? value : Math.log1p(value);
  });
}

function fitOffsetRidge(rows: readonly Observation[], lambda: number): number[] {
  const width = rows[0]?.vector.length ?? 0;
  const beta = Array.from({ length: width }, () => 0);
  const eta = rows.map((row) => logit(row.p5Probability));
  for (let pass = 0; pass < 40; pass += 1) {
    let maxStep = 0;
    for (let column = 0; column < width; column += 1) {
      let gradient = -lambda * beta[column];
      let information = lambda;
      for (let i = 0; i < rows.length; i += 1) {
        const x = rows[i].vector[column];
        if (Math.abs(x) < 1e-15) continue;
        const p = logistic(eta[i]);
        gradient += x * (rows[i].outcome - p);
        information += x * x * Math.max(1e-8, p * (1 - p));
      }
      if (information <= 1e-12) continue;
      const step = gradient / information;
      beta[column] += step;
      maxStep = Math.max(maxStep, Math.abs(step));
      if (Math.abs(step) > 0) {
        for (let i = 0; i < rows.length; i += 1) eta[i] += rows[i].vector[column] * step;
      }
    }
    if (maxStep < 1e-7) break;
  }
  return beta;
}

function adjusted(row: Observation, beta: readonly number[]): number {
  const delta = row.vector.reduce((sum, value, index) => sum + value * beta[index], 0);
  return logistic(logit(row.p5Probability) + Math.max(-1, Math.min(1, delta)));
}

function metrics(rows: readonly Observation[], beta?: readonly number[]) {
  if (!rows.length) return null;
  const baseline = scoreLifecycleBinary(rows.map((row) => ({
    probability: row.p5Probability,
    outcome: row.outcome,
  })));
  const candidate = scoreLifecycleBinary(rows.map((row) => ({
    probability: beta ? adjusted(row, beta) : row.p5Probability,
    outcome: row.outcome,
  })));
  return {
    baseline,
    candidate,
    deltaCandidateMinusBaseline: {
      brier: candidate.brier - baseline.brier,
      logLoss: candidate.logLoss - baseline.logLoss,
      expectedCalibrationError: candidate.expectedCalibrationError - baseline.expectedCalibrationError,
      averagePrecision: candidate.averagePrecision === null || baseline.averagePrecision === null
        ? null : candidate.averagePrecision - baseline.averagePrecision,
      rocAuc: candidate.rocAuc === null || baseline.rocAuc === null
        ? null : candidate.rocAuc - baseline.rocAuc,
    },
  };
}

function directCompare(
  rows: readonly LifecycleExternalSelectionRow[],
  leftFeatures: readonly DiagnosticFeature[],
  leftBeta: readonly number[],
  rightFeatures: readonly DiagnosticFeature[],
  rightBeta: readonly number[],
) {
  if (!rows.length) return null;
  const left = rows.map((row) => ({
    probability: adjusted({ ...row, vector: vector(row, leftFeatures) }, leftBeta),
    outcome: row.outcome,
  }));
  const right = rows.map((row) => ({
    probability: adjusted({ ...row, vector: vector(row, rightFeatures) }, rightBeta),
    outcome: row.outcome,
  }));
  const leftScore = scoreLifecycleBinary(left);
  const rightScore = scoreLifecycleBinary(right);
  return {
    nuisanceOnly: leftScore,
    nuisancePlusAuthorExternal: rightScore,
    deltaExternalMinusNuisance: {
      brier: rightScore.brier - leftScore.brier,
      logLoss: rightScore.logLoss - leftScore.logLoss,
      expectedCalibrationError:
        rightScore.expectedCalibrationError - leftScore.expectedCalibrationError,
      averagePrecision:
        rightScore.averagePrecision === null || leftScore.averagePrecision === null
          ? null : rightScore.averagePrecision - leftScore.averagePrecision,
      rocAuc:
        rightScore.rocAuc === null || leftScore.rocAuc === null
          ? null : rightScore.rocAuc - leftScore.rocAuc,
    },
  };
}

function prevalence(rows: readonly LifecycleExternalSelectionRow[]) {
  const rate = (subset: readonly LifecycleExternalSelectionRow[]) => ({
    snapshots: subset.length,
    bills: new Set(subset.map((row) => row.billId)).size,
    positives: subset.reduce((sum, row) => sum + row.outcome, 0),
    positiveRate: subset.length
      ? subset.reduce((sum, row) => sum + row.outcome, 0) / subset.length
      : null,
  });
  const reconstructable = rows.filter((row) => row.authorshipReconstructable === 1);
  const district = reconstructable.filter((row) => row.authorDistrictContext > 0);
  const noDistrict = reconstructable.filter((row) => row.authorDistrictContext === 0);
  const summary = rows.filter((row) => row.officialBillSummary > 0);
  return {
    all: rate(rows),
    reconstructableAuthorship: rate(reconstructable),
    reconstructableWithDistrictContext: rate(district),
    reconstructableWithoutDistrictContext: rate(noDistrict),
    withOfficialBillSummary: rate(summary),
  };
}

function selectModel(
  rows: readonly LifecycleExternalSelectionRow[],
  features: readonly DiagnosticFeature[],
) {
  const training = rows.filter((row) => row.session === '2021-2022')
    .map((row) => ({ ...row, vector: vector(row, features) }));
  const validation = rows.filter((row) => row.session === '2023-2024')
    .map((row) => ({ ...row, vector: vector(row, features) }));
  const descriptive = rows.filter((row) => row.session === '2025-2026')
    .map((row) => ({ ...row, vector: vector(row, features) }));
  const candidates = LIFECYCLE_EXTERNAL_SELECTION_CONTROL_LAMBDAS.map((lambda) => {
    const beta = fitOffsetRidge(training, lambda);
    const validationMetrics = metrics(validation, beta)!;
    return { lambda, beta, validationMetrics };
  }).sort((a, b) =>
    a.validationMetrics.candidate.brier - b.validationMetrics.candidate.brier
    || a.validationMetrics.candidate.logLoss - b.validationMetrics.candidate.logLoss
    || a.lambda - b.lambda);
  const selected = candidates[0];
  return {
    features,
    selectedLambda: selected.lambda,
    coefficients: Object.fromEntries(features.map((feature, index) => [feature, selected.beta[index]])),
    beta: selected.beta,
    training: metrics(training, selected.beta),
    validation: selected.validationMetrics,
    descriptive: metrics(descriptive, selected.beta),
    candidates: candidates.map((candidate) => ({
      lambda: candidate.lambda,
      validation: candidate.validationMetrics,
    })),
  };
}

export function buildLifecycleExternalSelectionRows(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  accepted: readonly LifecycleExternalAvailabilityAccepted[];
  p5Model: LifecycleP5RetainedProspectiveModel;
}): LifecycleExternalSelectionRow[] {
  const byBill = new Map<string, LifecycleExternalAvailabilityAccepted[]>();
  const byMember = new Map<string, LifecycleExternalAvailabilityAccepted[]>();
  for (const evidence of input.accepted) {
    if (evidence.billId) {
      const bucket = byBill.get(evidence.billId) ?? [];
      bucket.push(evidence);
      byBill.set(evidence.billId, bucket);
    }
    if (evidence.membershipId) {
      const bucket = byMember.get(evidence.membershipId) ?? [];
      bucket.push(evidence);
      byMember.set(evidence.membershipId, bucket);
    }
  }

  return input.snapshots.flatMap((snapshot) => {
    const p5 = predictLifecycleP5RetainedProspectiveModel(
      input.p5Model,
      buildLifecycleP5ProspectiveRow(snapshot, 'source_chamber_passage'),
    );
    if (!p5) return [];

    let officialBillSummary = 0;
    for (const evidence of byBill.get(snapshot.bill.billId) ?? []) {
      if (evidence.availableOn >= snapshot.cutoff.asOfDateExclusive) continue;
      if (evidence.family === 'official_bill_summary') officialBillSummary += 1;
    }

    const authorIds = snapshot.features.authorship.reconstructable
      ? snapshot.features.authorship.membershipIds
      : null;
    let authorDistrictContext = 0;
    let authorMemberPrimaryPublication = 0;
    let authorVerifiedNews = 0;
    if (authorIds) {
      const seen = new Set<string>();
      for (const membershipId of authorIds) {
        for (const evidence of byMember.get(membershipId) ?? []) {
          if (evidence.availableOn >= snapshot.cutoff.asOfDateExclusive) continue;
          if (seen.has(evidence.evidenceId)) continue;
          seen.add(evidence.evidenceId);
          if (evidence.family === 'author_district_context') authorDistrictContext += 1;
          else if (evidence.family === 'author_member_primary_publication') authorMemberPrimaryPublication += 1;
          else if (evidence.family === 'author_verified_news') authorVerifiedNews += 1;
        }
      }
    }

    return [{
      snapshotId: snapshot.snapshotId,
      billId: snapshot.bill.billId,
      session: snapshot.bill.session,
      chamber: snapshot.bill.chamber,
      cutoffDateExclusive: snapshot.cutoff.asOfDateExclusive,
      lifecycleState: snapshot.features.lifecycleState,
      outcome: snapshot.targets.eventualSourceChamberPassage ? 1 as const : 0 as const,
      p5Probability: p5.candidateProbability,
      authorshipReconstructable: authorIds !== null ? 1 as const : 0 as const,
      officialBillSummary,
      authorDistrictContext,
      authorMemberPrimaryPublication,
      authorVerifiedNews,
    }];
  });
}

export function evaluateLifecycleExternalSelectionControl(
  rows: readonly LifecycleExternalSelectionRow[],
) {
  const nuisance = selectModel(rows, MODEL_FEATURES.authorship_nuisance);
  const authorExternal = selectModel(rows, MODEL_FEATURES.author_external_after_nuisance);
  const billSummary = selectModel(rows, MODEL_FEATURES.bill_summary_on_p5);
  const validationRows = rows.filter((row) => row.session === '2023-2024');
  const descriptiveRows = rows.filter((row) => row.session === '2025-2026');

  const digest = createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row) + '\n');

  return {
    schemaVersion: LIFECYCLE_EXTERNAL_SELECTION_CONTROL_SCHEMA,
    chronology: {
      trainingSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      sameDayEvidenceExcluded: true,
      p5BaselineFitUsesTrainingSessionOnly: true,
    },
    population: {
      rows: rows.length,
      bills: new Set(rows.map((row) => row.billId)).size,
      bySession: Object.fromEntries(['2021-2022','2023-2024','2025-2026'].map((session) => {
        const subset = rows.filter((row) => row.session === session);
        return [session, { rows: subset.length, bills: new Set(subset.map((row) => row.billId)).size }];
      })),
    },
    prevalenceDiagnostics: Object.fromEntries(
      ['2021-2022','2023-2024','2025-2026'].map((session) => [
        session, prevalence(rows.filter((row) => row.session === session)),
      ]),
    ),
    models: {
      authorshipNuisance: { ...nuisance, beta: undefined },
      authorExternalAfterNuisance: { ...authorExternal, beta: undefined },
      billSummaryOnP5: { ...billSummary, beta: undefined },
    },
    incrementalAuthorExternalBeyondSelection: {
      validation: directCompare(
        validationRows,
        MODEL_FEATURES.authorship_nuisance,
        nuisance.beta,
        MODEL_FEATURES.author_external_after_nuisance,
        authorExternal.beta,
      ),
      descriptive2025_2026: directCompare(
        descriptiveRows,
        MODEL_FEATURES.authorship_nuisance,
        nuisance.beta,
        MODEL_FEATURES.author_external_after_nuisance,
        authorExternal.beta,
      ),
    },
    featureRowSha256: digest.digest('hex'),
    policy: {
      diagnosticNuisanceFeatureIsNotProspectiveCandidate: true,
      retrospectiveDevelopmentOnly: true,
      causalInterpretationAllowed: false,
      automaticPromotionAllowed: false,
      servingChanged: false,
      p8ModelChanged: false,
      productionAction: 'none',
    },
  };
}
