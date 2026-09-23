import { createHash } from 'node:crypto';
import {
  scoreLifecycleBinary,
  type LifecycleP4BinaryScore,
  type LifecycleP4ProspectiveStageModel,
} from './lifecycle-p4-baselines';
import type { LifecycleP3Snapshot } from './lifecycle-p3-snapshot-dataset';
import {
  LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES,
  type LifecycleExternalAvailabilityAccepted,
  type LifecycleExternalAvailabilityFamily,
} from './lifecycle-external-availability';

export const LIFECYCLE_EXTERNAL_SCREEN_SCHEMA_VERSION =
  'lifecycle-external-evidence-screen-v1' as const;

export const LIFECYCLE_EXTERNAL_SCREEN_LAMBDAS = [0.1, 1, 5, 20, 100] as const;
export const LIFECYCLE_EXTERNAL_SCREEN_ARMS = ['bill_only', 'author_only', 'combined'] as const;
export type LifecycleExternalScreenArm = typeof LIFECYCLE_EXTERNAL_SCREEN_ARMS[number];

const BILL_FAMILIES = new Set<LifecycleExternalAvailabilityFamily>([
  'official_bill_summary',
  'official_fiscal_note',
  'official_floor_amendment',
  'official_conferee',
  'official_legislative_speech',
  'official_committee_rollcall',
  'member_primary_bill_statement',
  'verified_news_bill_statement',
]);
const AUTHOR_FAMILIES = new Set<LifecycleExternalAvailabilityFamily>([
  'author_district_context',
  'author_member_primary_publication',
  'author_verified_news',
]);

export interface LifecycleExternalFeatureRow {
  snapshotId: string;
  billId: string;
  session: string;
  chamber: 'house' | 'senate';
  cutoffDateExclusive: string;
  lifecycleState: string;
  outcome: 0 | 1;
  baselineProbability: number;
  features: Record<LifecycleExternalAvailabilityFamily, number>;
  billEvidenceItems: number;
  authorEvidenceItems: number;
  reconstructableAuthors: boolean;
}

type Observation = LifecycleExternalFeatureRow & { vector: number[] };

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
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

function familyAllowed(arm: LifecycleExternalScreenArm, family: LifecycleExternalAvailabilityFamily): boolean {
  if (arm === 'combined') return true;
  return arm === 'bill_only' ? BILL_FAMILIES.has(family) : AUTHOR_FAMILIES.has(family);
}

function vectorFor(
  features: Record<LifecycleExternalAvailabilityFamily, number>,
  arm: LifecycleExternalScreenArm,
): number[] {
  return LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES.map((family) =>
    familyAllowed(arm, family) ? Math.log1p(features[family] ?? 0) : 0);
}

function fitOffsetCoordinateRidge(rows: readonly Observation[], lambda: number): number[] {
  const beta = LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES.map(() => 0);
  const eta = rows.map((row) => logit(row.baselineProbability));
  for (let pass = 0; pass < 40; pass += 1) {
    let maxStep = 0;
    for (let column = 0; column < beta.length; column += 1) {
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

function candidateProbability(row: Observation, beta: readonly number[]): number {
  const delta = row.vector.reduce((sum, value, index) => sum + value * beta[index], 0);
  return logistic(logit(row.baselineProbability) + Math.max(-1, Math.min(1, delta)));
}

function score(rows: readonly Observation[], beta?: readonly number[]) {
  const baseline = scoreLifecycleBinary(rows.map((row) => ({
    probability: row.baselineProbability,
    outcome: row.outcome,
  })));
  const candidate = beta
    ? scoreLifecycleBinary(rows.map((row) => ({
        probability: candidateProbability(row, beta),
        outcome: row.outcome,
      })))
    : baseline;
  return {
    baseline,
    candidate,
    deltaCandidateMinusBaseline: {
      brier: candidate.brier - baseline.brier,
      logLoss: candidate.logLoss - baseline.logLoss,
      expectedCalibrationError:
        candidate.expectedCalibrationError - baseline.expectedCalibrationError,
      averagePrecision:
        candidate.averagePrecision === null || baseline.averagePrecision === null
          ? null : candidate.averagePrecision - baseline.averagePrecision,
      rocAuc:
        candidate.rocAuc === null || baseline.rocAuc === null
          ? null : candidate.rocAuc - baseline.rocAuc,
    },
  };
}

function scoreOrNull(rows: readonly Observation[], beta: readonly number[]) {
  return rows.length ? score(rows, beta) : null;
}

function coefficientObject(beta: readonly number[]) {
  return Object.fromEntries(
    LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES.map((family, index) => [family, beta[index]]),
  );
}

function coverage(rows: readonly LifecycleExternalFeatureRow[]) {
  const any = rows.filter((row) => row.billEvidenceItems + row.authorEvidenceItems > 0);
  const bill = rows.filter((row) => row.billEvidenceItems > 0);
  const author = rows.filter((row) => row.authorEvidenceItems > 0);
  return {
    snapshots: rows.length,
    bills: new Set(rows.map((row) => row.billId)).size,
    snapshotsWithAnyEvidence: any.length,
    billsWithAnyEvidence: new Set(any.map((row) => row.billId)).size,
    snapshotsWithBillEvidence: bill.length,
    billsWithBillEvidence: new Set(bill.map((row) => row.billId)).size,
    snapshotsWithAuthorEvidence: author.length,
    billsWithAuthorEvidence: new Set(author.map((row) => row.billId)).size,
    reconstructableAuthorSnapshots: rows.filter((row) => row.reconstructableAuthors).length,
  };
}

export function buildLifecycleExternalFeatureRows(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  accepted: readonly LifecycleExternalAvailabilityAccepted[];
  baselineModel: LifecycleP4ProspectiveStageModel;
  baselinePredict: (
    model: LifecycleP4ProspectiveStageModel,
    row: Pick<LifecycleP3Snapshot, 'bill' | 'features'>,
  ) => number;
}): LifecycleExternalFeatureRow[] {
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

  return input.snapshots.map((snapshot) => {
    const counts = Object.fromEntries(
      LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES.map((family) => [family, 0]),
    ) as Record<LifecycleExternalAvailabilityFamily, number>;
    let billEvidenceItems = 0;
    for (const evidence of byBill.get(snapshot.bill.billId) ?? []) {
      if (evidence.availableOn >= snapshot.cutoff.asOfDateExclusive) continue;
      if (!BILL_FAMILIES.has(evidence.family)) continue;
      counts[evidence.family] += 1;
      billEvidenceItems += 1;
    }

    let authorEvidenceItems = 0;
    const authorIds = snapshot.features.authorship.reconstructable
      ? snapshot.features.authorship.membershipIds
      : null;
    if (authorIds) {
      const seen = new Set<string>();
      for (const membershipId of authorIds) {
        for (const evidence of byMember.get(membershipId) ?? []) {
          if (evidence.availableOn >= snapshot.cutoff.asOfDateExclusive) continue;
          if (!AUTHOR_FAMILIES.has(evidence.family)) continue;
          const key = evidence.evidenceId + '|' + evidence.family;
          if (seen.has(key)) continue;
          seen.add(key);
          counts[evidence.family] += 1;
          authorEvidenceItems += 1;
        }
      }
    }

    return {
      snapshotId: snapshot.snapshotId,
      billId: snapshot.bill.billId,
      session: snapshot.bill.session,
      chamber: snapshot.bill.chamber,
      cutoffDateExclusive: snapshot.cutoff.asOfDateExclusive,
      lifecycleState: snapshot.features.lifecycleState,
      outcome: snapshot.targets.eventualSourceChamberPassage ? 1 : 0,
      baselineProbability: input.baselinePredict(input.baselineModel, snapshot),
      features: counts,
      billEvidenceItems,
      authorEvidenceItems,
      reconstructableAuthors: authorIds !== null,
    };
  });
}

export function evaluateLifecycleExternalEvidenceScreen(
  rows: readonly LifecycleExternalFeatureRow[],
) {
  const trainingBase = rows.filter((row) => row.session === '2021-2022');
  const validationBase = rows.filter((row) => row.session === '2023-2024');
  const descriptiveBase = rows.filter((row) => row.session === '2025-2026');
  if (!trainingBase.length || !validationBase.length || !descriptiveBase.length) {
    throw new Error('Lifecycle external screen requires all three frozen biennia');
  }

  const arms = Object.fromEntries(LIFECYCLE_EXTERNAL_SCREEN_ARMS.map((arm) => {
    const training = trainingBase.map((row) => ({ ...row, vector: vectorFor(row.features, arm) }));
    const validation = validationBase.map((row) => ({ ...row, vector: vectorFor(row.features, arm) }));
    const descriptive = descriptiveBase.map((row) => ({ ...row, vector: vectorFor(row.features, arm) }));

    const candidates = LIFECYCLE_EXTERNAL_SCREEN_LAMBDAS.map((lambda) => {
      const beta = fitOffsetCoordinateRidge(training, lambda);
      const validationScore = score(validation, beta);
      return { lambda, beta, validationScore };
    }).sort((a, b) =>
      a.validationScore.candidate.brier - b.validationScore.candidate.brier
      || a.validationScore.candidate.logLoss - b.validationScore.candidate.logLoss
      || a.lambda - b.lambda);
    const selected = candidates[0];

    const byChamber = Object.fromEntries(['house', 'senate'].map((chamber) => [
      chamber,
      {
        validation: scoreOrNull(validation.filter((row) => row.chamber === chamber), selected.beta),
        descriptive: scoreOrNull(descriptive.filter((row) => row.chamber === chamber), selected.beta),
      },
    ]));
    const byState = Object.fromEntries(
      [...new Set(rows.map((row) => row.lifecycleState))].sort().map((state) => [
        state,
        {
          validation: scoreOrNull(validation.filter((row) => row.lifecycleState === state), selected.beta),
          descriptive: scoreOrNull(descriptive.filter((row) => row.lifecycleState === state), selected.beta),
        },
      ]),
    );

    const ablations = LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES.map((family) => {
      const index = LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES.indexOf(family);
      const beta = [...selected.beta];
      beta[index] = 0;
      return {
        family,
        validation: score(validation, beta),
        descriptive: score(descriptive, beta),
      };
    });

    return [arm, {
      selectedLambda: selected.lambda,
      coefficients: coefficientObject(selected.beta),
      lambdaCandidates: candidates.map((candidate) => ({
        lambda: candidate.lambda,
        validation: candidate.validationScore,
      })),
      scores: {
        training: score(training, selected.beta),
        validation: selected.validationScore,
        descriptive2025_2026: score(descriptive, selected.beta),
      },
      byChamber,
      byState,
      ablations,
    }];
  }));

  const digest = createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row) + '\n');

  return {
    schemaVersion: LIFECYCLE_EXTERNAL_SCREEN_SCHEMA_VERSION,
    featureNames: LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES,
    chronology: {
      trainingSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      lambdaSelectionUsesOnlyValidationSession: true,
      sameDayEvidenceExcluded: true,
    },
    coverage: {
      overall: coverage(rows),
      bySession: Object.fromEntries(
        ['2021-2022','2023-2024','2025-2026'].map((session) => [
          session, coverage(rows.filter((row) => row.session === session)),
        ]),
      ),
    },
    arms,
    featureRowSha256: digest.digest('hex'),
    policy: {
      retrospectiveDevelopmentOnly: true,
      causalInterpretationAllowed: false,
      automaticPromotionAllowed: false,
      servingChanged: false,
      p8ModelChanged: false,
      productionAction: 'none',
    },
  };
}
