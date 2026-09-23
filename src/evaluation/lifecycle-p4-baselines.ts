import { createHash } from 'node:crypto';
import {
  averagePrecision,
  brierScore,
  expectedCalibrationError,
  logLoss,
  rocAuc,
} from './metrics';
import type { LifecycleP3Snapshot, LifecycleState } from './lifecycle-p3-snapshot-dataset';
import type { BillStagePrediction } from './stages';

export const LIFECYCLE_P4_BASELINE_SCHEMA_VERSION = 'lifecycle-p4-baselines-v1' as const;
export const FROZEN_LIFECYCLE_P3_CONTENT_SHA256 =
  '45030a9780ce76690ea960605385f501c24047b461a82e1368a427a7267be39d' as const;
export const LIFECYCLE_P4_HAZARD_HORIZON_DAYS = 30 as const;

type Chamber = 'house' | 'senate';

export interface LifecycleP4PassagePrediction {
  billId: string;
  session: string;
  chamber: Chamber;
  cutoffDateExclusive: string;
  lifecycleState: LifecycleState;
  outcome: 0 | 1;
  probability: number;
  model: 'intro-title-text-eb-v4-forward-chain' | 'lifecycle-stage-empirical-v1';
}

export interface LifecycleP4HazardRiskRow {
  billId: string;
  session: string;
  chamber: Chamber;
  lifecycleState: LifecycleState;
  cutoffDateExclusive: string;
  daysSinceIntroduction: number;
  daysSincePreviousTransition: number;
  daysRemainingInBiennium: number;
  nextEventDate: string;
  nextEventWithin30Days: 0 | 1;
}

export interface LifecycleP4HazardPrediction extends LifecycleP4HazardRiskRow {
  probability: number;
  model: 'lifecycle-stage-hazard-30d-v1' | 'lifecycle-stage-elapsed-hazard-30d-v1';
}

export interface LifecycleP4BinaryScore {
  observations: number;
  positiveRate: number;
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
  averagePrecision: number | null;
  rocAuc: number | null;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function scoreLifecycleBinary(
  rows: readonly { probability: number; outcome: 0 | 1 }[],
): LifecycleP4BinaryScore {
  if (rows.length === 0) throw new Error('Lifecycle P4 scoring requires at least one observation');
  const forecasts = rows.map((row) => ({ probability: row.probability, outcome: row.outcome }));
  return {
    observations: rows.length,
    positiveRate: rows.reduce((sum, row) => sum + row.outcome, 0) / rows.length,
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    expectedCalibrationError: expectedCalibrationError(forecasts),
    averagePrecision: finiteOrNull(averagePrecision(forecasts)),
    rocAuc: finiteOrNull(rocAuc(forecasts)),
  };
}

function isoDate(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`Expected ISO date, received ${value}`);
  return match[1];
}

function dayNumber(value: string): number {
  const parsed = Date.parse(`${isoDate(value)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid date ${value}`);
  return Math.floor(parsed / 86_400_000);
}

function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

function addDays(value: string, days: number): string {
  return new Date((dayNumber(value) + days) * 86_400_000).toISOString().slice(0, 10);
}

function empiricalJeffreys(positives: number, total: number): number {
  return (positives + 0.5) / (total + 1);
}

function rate(rows: readonly { outcome: 0 | 1 }[]): number {
  return empiricalJeffreys(rows.reduce((sum, row) => sum + row.outcome, 0), rows.length);
}

function passageGroupKey(row: Pick<LifecycleP3Snapshot, 'bill' | 'features'>): string {
  return `${row.bill.chamber}|${row.features.lifecycleState}`;
}

export function buildForwardChainedStagePassagePredictions(
  snapshots: readonly LifecycleP3Snapshot[],
): LifecycleP4PassagePrediction[] {
  const sessions = [...new Set(snapshots.map((row) => row.bill.session))].sort();
  const predictions: LifecycleP4PassagePrediction[] = [];

  for (let index = 1; index < sessions.length; index += 1) {
    const holdoutSession = sessions[index];
    const training = snapshots
      .filter((row) => row.bill.session < holdoutSession)
      .map((row) => ({ row, outcome: row.targets.eventualSourceChamberPassage ? 1 as const : 0 as const }));
    const holdout = snapshots.filter((row) => row.bill.session === holdoutSession);
    if (!training.length || !holdout.length) continue;

    const overall = rate(training);
    const chamberRates = new Map<Chamber, number>();
    const groupRates = new Map<string, number>();
    for (const chamber of ['house', 'senate'] as const) {
      const rows = training.filter(({ row }) => row.bill.chamber === chamber);
      if (rows.length) chamberRates.set(chamber, rate(rows));
    }
    for (const key of [...new Set(training.map(({ row }) => passageGroupKey(row)))]) {
      const rows = training.filter(({ row }) => passageGroupKey(row) === key);
      groupRates.set(key, rate(rows));
    }

    for (const row of holdout) {
      predictions.push({
        billId: row.bill.billId,
        session: row.bill.session,
        chamber: row.bill.chamber,
        cutoffDateExclusive: row.cutoff.asOfDateExclusive,
        lifecycleState: row.features.lifecycleState,
        outcome: row.targets.eventualSourceChamberPassage ? 1 : 0,
        probability: groupRates.get(passageGroupKey(row))
          ?? chamberRates.get(row.bill.chamber)
          ?? overall,
        model: 'lifecycle-stage-empirical-v1',
      });
    }
  }
  return predictions;
}

export function applyStaticIntroductionBenchmark(
  snapshots: readonly LifecycleP3Snapshot[],
  introductionPredictions: readonly BillStagePrediction[],
): LifecycleP4PassagePrediction[] {
  const byBill = new Map(
    introductionPredictions
      .filter((row) => row.model === 'intro-title-text-eb-v4')
      .map((row) => [row.billId, row]),
  );
  return snapshots.flatMap((snapshot) => {
    const prediction = byBill.get(snapshot.bill.billId);
    if (!prediction) return [];
    return [{
      billId: snapshot.bill.billId,
      session: snapshot.bill.session,
      chamber: snapshot.bill.chamber,
      cutoffDateExclusive: snapshot.cutoff.asOfDateExclusive,
      lifecycleState: snapshot.features.lifecycleState,
      outcome: snapshot.targets.eventualSourceChamberPassage ? 1 as const : 0 as const,
      probability: prediction.probability,
      model: 'intro-title-text-eb-v4-forward-chain' as const,
    }];
  });
}

function terminalOn(snapshot: LifecycleP3Snapshot): boolean {
  return snapshot.targets.transitionOnCutoffDate.terminalOutcome !== null;
}

function stateAfter(snapshot: LifecycleP3Snapshot): LifecycleState {
  return snapshot.targets.transitionOnCutoffDate.toState ?? snapshot.features.lifecycleState;
}

export function buildLifecycleHazardRiskRows(
  snapshots: readonly LifecycleP3Snapshot[],
  horizonDays = LIFECYCLE_P4_HAZARD_HORIZON_DAYS,
): LifecycleP4HazardRiskRow[] {
  if (!Number.isInteger(horizonDays) || horizonDays <= 0) {
    throw new Error('Lifecycle hazard horizon must be a positive integer');
  }
  const byBill = new Map<string, LifecycleP3Snapshot[]>();
  for (const snapshot of snapshots) {
    const bucket = byBill.get(snapshot.bill.billId) ?? [];
    bucket.push(snapshot);
    byBill.set(snapshot.bill.billId, bucket);
  }

  const rows: LifecycleP4HazardRiskRow[] = [];
  for (const billSnapshots of byBill.values()) {
    billSnapshots.sort((left, right) =>
      left.cutoff.asOfDateExclusive.localeCompare(right.cutoff.asOfDateExclusive));
    const first = billSnapshots[0];
    const introducedOn = first.cutoff.asOfDateExclusive;
    const adjournmentOn = addDays(introducedOn, first.features.daysRemainingInBiennium);

    for (let index = 0; index < billSnapshots.length - 1; index += 1) {
      const current = billSnapshots[index];
      if (terminalOn(current)) break;
      const next = billSnapshots[index + 1];
      const currentDate = current.cutoff.asOfDateExclusive;
      const nextDate = next.cutoff.asOfDateExclusive;
      if (nextDate <= currentDate) throw new Error(`${current.bill.identifier}: non-increasing lifecycle snapshot dates`);

      const state = stateAfter(current);
      let anchor = addDays(currentDate, 1);
      while (anchor <= nextDate && anchor <= adjournmentOn) {
        const untilNext = daysBetween(anchor, nextDate);
        rows.push({
          billId: current.bill.billId,
          session: current.bill.session,
          chamber: current.bill.chamber,
          lifecycleState: state,
          cutoffDateExclusive: anchor,
          daysSinceIntroduction: Math.max(0, daysBetween(introducedOn, anchor)),
          daysSincePreviousTransition: Math.max(0, daysBetween(currentDate, anchor)),
          daysRemainingInBiennium: Math.max(0, daysBetween(anchor, adjournmentOn)),
          nextEventDate: nextDate,
          nextEventWithin30Days: untilNext < horizonDays ? 1 : 0,
        });
        anchor = addDays(anchor, horizonDays);
      }
    }
  }

  rows.sort((left, right) =>
    left.session.localeCompare(right.session)
    || left.chamber.localeCompare(right.chamber)
    || left.billId.localeCompare(right.billId)
    || left.cutoffDateExclusive.localeCompare(right.cutoffDateExclusive));
  return rows;
}

function elapsedBucket(days: number): string {
  if (days < 30) return '00-29';
  if (days < 60) return '30-59';
  if (days < 90) return '60-89';
  if (days < 180) return '90-179';
  return '180+';
}

function remainingBucket(days: number): string {
  if (days <= 30) return '000-030';
  if (days <= 90) return '031-090';
  if (days <= 180) return '091-180';
  if (days <= 365) return '181-365';
  return '366+';
}

function hazardStageKey(row: LifecycleP4HazardRiskRow): string {
  return `${row.chamber}|${row.lifecycleState}`;
}

function hazardTimeKey(row: LifecycleP4HazardRiskRow): string {
  return [
    hazardStageKey(row),
    elapsedBucket(row.daysSincePreviousTransition),
    remainingBucket(row.daysRemainingInBiennium),
  ].join('|');
}

function fitRateMap<T>(
  rows: readonly T[],
  key: (row: T) => string,
  outcome: (row: T) => 0 | 1,
): Map<string, number> {
  const grouped = new Map<string, { positives: number; total: number }>();
  for (const row of rows) {
    const k = key(row);
    const stat = grouped.get(k) ?? { positives: 0, total: 0 };
    stat.total += 1;
    stat.positives += outcome(row);
    grouped.set(k, stat);
  }
  return new Map([...grouped.entries()].map(([keyValue, stat]) => [
    keyValue,
    empiricalJeffreys(stat.positives, stat.total),
  ]));
}

export function buildForwardChainedHazardPredictions(
  riskRows: readonly LifecycleP4HazardRiskRow[],
): LifecycleP4HazardPrediction[] {
  const sessions = [...new Set(riskRows.map((row) => row.session))].sort();
  const predictions: LifecycleP4HazardPrediction[] = [];

  for (let index = 1; index < sessions.length; index += 1) {
    const holdoutSession = sessions[index];
    const training = riskRows.filter((row) => row.session < holdoutSession);
    const holdout = riskRows.filter((row) => row.session === holdoutSession);
    if (!training.length || !holdout.length) continue;

    const overall = empiricalJeffreys(
      training.reduce((sum, row) => sum + row.nextEventWithin30Days, 0),
      training.length,
    );
    const stageRates = fitRateMap(training, hazardStageKey, (row) => row.nextEventWithin30Days);
    const timeRates = fitRateMap(training, hazardTimeKey, (row) => row.nextEventWithin30Days);

    for (const row of holdout) {
      const stageProbability = stageRates.get(hazardStageKey(row)) ?? overall;
      predictions.push({
        ...row,
        probability: stageProbability,
        model: 'lifecycle-stage-hazard-30d-v1',
      });
      predictions.push({
        ...row,
        probability: timeRates.get(hazardTimeKey(row)) ?? stageProbability,
        model: 'lifecycle-stage-elapsed-hazard-30d-v1',
      });
    }
  }
  return predictions;
}

function scoreSlices<T extends { probability: number; outcome: 0 | 1 }>(
  rows: readonly T[],
  key: (row: T) => string,
): Record<string, LifecycleP4BinaryScore> {
  const keys = [...new Set(rows.map(key))].sort();
  return Object.fromEntries(keys.map((slice) => [
    slice,
    scoreLifecycleBinary(rows.filter((row) => key(row) === slice)),
  ]));
}

function predictionDigest(rows: readonly unknown[]): string {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`);
  return hash.digest('hex');
}

export function summarizeLifecycleP4Baselines(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  introductionPredictions: readonly BillStagePrediction[];
  p3ObservedSha256: string;
  introductionServingParity2025MaxDelta: number;
  codeSha: string | null;
}) {
  if (input.p3ObservedSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
    throw new Error(
      `Lifecycle P4 refuses P3 drift: observed ${input.p3ObservedSha256}, expected ${FROZEN_LIFECYCLE_P3_CONTENT_SHA256}`,
    );
  }

  const introduction = applyStaticIntroductionBenchmark(input.snapshots, input.introductionPredictions);
  const stage = buildForwardChainedStagePassagePredictions(input.snapshots);
  const holdoutKeys = new Set(stage.map((row) =>
    `${row.billId}|${row.cutoffDateExclusive}`));
  const introductionMatched = introduction.filter((row) =>
    holdoutKeys.has(`${row.billId}|${row.cutoffDateExclusive}`));
  if (introductionMatched.length !== stage.length) {
    throw new Error(
      `Introduction/stage lifecycle prediction mismatch: ${introductionMatched.length}/${stage.length}`,
    );
  }

  const riskRows = buildLifecycleHazardRiskRows(input.snapshots);
  const hazard = buildForwardChainedHazardPredictions(riskRows);
  const stageHazard = hazard.filter((row) => row.model === 'lifecycle-stage-hazard-30d-v1');
  const elapsedHazard = hazard.filter((row) => row.model === 'lifecycle-stage-elapsed-hazard-30d-v1');
  const introAtIntroduction = introductionMatched.filter((row) => {
    const snapshot = input.snapshots.find((candidate) =>
      candidate.bill.billId === row.billId
      && candidate.cutoff.asOfDateExclusive === row.cutoffDateExclusive);
    return snapshot?.cutoff.reason === 'introduction';
  });
  const stageAtIntroduction = stage.filter((row) => {
    const snapshot = input.snapshots.find((candidate) =>
      candidate.bill.billId === row.billId
      && candidate.cutoff.asOfDateExclusive === row.cutoffDateExclusive);
    return snapshot?.cutoff.reason === 'introduction';
  });

  const introAllScore = scoreLifecycleBinary(introductionMatched);
  const stageAllScore = scoreLifecycleBinary(stage);
  const stageHazardScore = scoreLifecycleBinary(
    stageHazard.map((row) => ({ probability: row.probability, outcome: row.nextEventWithin30Days })),
  );
  const elapsedHazardScore = scoreLifecycleBinary(
    elapsedHazard.map((row) => ({ probability: row.probability, outcome: row.nextEventWithin30Days })),
  );

  return {
    report: {
      schemaVersion: LIFECYCLE_P4_BASELINE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      codeSha: input.codeSha,
      frozenP3: {
        expectedSnapshotContentSha256: FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
        observedSnapshotContentSha256: input.p3ObservedSha256,
        bills: new Set(input.snapshots.map((row) => row.bill.billId)).size,
        snapshots: input.snapshots.length,
      },
      chronology: {
        developmentSession: '2021-2022',
        forwardChainedHoldouts: ['2023-2024', '2025-2026'],
        rule: 'Each holdout session is predicted from completed earlier biennia only.',
      },
      introductionBenchmark: {
        model: 'intro-title-text-eb-v4-forward-chain',
        inputContract: 'The accepted v4 prior is scored under its already-frozen introduction contract and then carried forward unchanged as a benchmark. Its same-day introduction-text policy is not imported into P3 lifecycle features.',
        frozenServingParity2025MaxDelta: input.introductionServingParity2025MaxDelta,
      },
      passage: {
        holdoutBills: new Set(stage.map((row) => row.billId)).size,
        holdoutEventTimeSnapshots: stage.length,
        introductionOnly: {
          acceptedIntroductionPrior: scoreLifecycleBinary(introAtIntroduction),
          stageOnly: scoreLifecycleBinary(stageAtIntroduction),
        },
        allEventTimeSnapshots: {
          acceptedIntroductionPrior: introAllScore,
          stageOnly: stageAllScore,
          stageOnlyDeltaVsIntroduction: {
            brier: stageAllScore.brier - introAllScore.brier,
            logLoss: stageAllScore.logLoss - introAllScore.logLoss,
            expectedCalibrationError: stageAllScore.expectedCalibrationError - introAllScore.expectedCalibrationError,
          },
        },
        bySession: {
          acceptedIntroductionPrior: scoreSlices(introductionMatched, (row) => row.session),
          stageOnly: scoreSlices(stage, (row) => row.session),
        },
        byChamber: {
          acceptedIntroductionPrior: scoreSlices(introductionMatched, (row) => row.chamber),
          stageOnly: scoreSlices(stage, (row) => row.chamber),
        },
        byState: {
          acceptedIntroductionPrior: scoreSlices(introductionMatched, (row) => row.lifecycleState),
          stageOnly: scoreSlices(stage, (row) => row.lifecycleState),
        },
      },
      hazard30Day: {
        definition: 'At 30-day risk-set landmarks beginning the day after a known lifecycle transition, predict whether the next lifecycle transition or terminal event occurs within the next 30 calendar days.',
        allHoldouts: {
          stageOnly: stageHazardScore,
          stageElapsedTime: elapsedHazardScore,
          elapsedTimeDeltaVsStageOnly: {
            brier: elapsedHazardScore.brier - stageHazardScore.brier,
            logLoss: elapsedHazardScore.logLoss - stageHazardScore.logLoss,
            expectedCalibrationError: elapsedHazardScore.expectedCalibrationError - stageHazardScore.expectedCalibrationError,
          },
        },
        bySession: {
          stageOnly: scoreSlices(
            stageHazard.map((row) => ({ ...row, outcome: row.nextEventWithin30Days })),
            (row) => row.session,
          ),
          stageElapsedTime: scoreSlices(
            elapsedHazard.map((row) => ({ ...row, outcome: row.nextEventWithin30Days })),
            (row) => row.session,
          ),
        },
        byState: {
          stageOnly: scoreSlices(
            stageHazard.map((row) => ({ ...row, outcome: row.nextEventWithin30Days })),
            (row) => row.lifecycleState,
          ),
          stageElapsedTime: scoreSlices(
            elapsedHazard.map((row) => ({ ...row, outcome: row.nextEventWithin30Days })),
            (row) => row.lifecycleState,
          ),
        },
      },
      predictionDigests: {
        passageNdjsonSha256: predictionDigest([...introductionMatched, ...stage]),
        hazardNdjsonSha256: predictionDigest(hazard),
      },
      policy: {
        servingChanged: false,
        automaticPromotionAllowed: false,
        historicalResultStatus: 'development/robustness',
      },
    },
    passagePredictions: [...introductionMatched, ...stage],
    hazardPredictions: hazard,
  };
}
