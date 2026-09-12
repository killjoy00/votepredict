import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';
import type { EvidenceKind } from '../evidence/types';

export interface PairedMemberForecast {
  forecastId: string;
  quickRevisionId: string;
  deepRevisionId: string;
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  quickProbability: number;
  deepProbability: number;
  outcome: 0 | 1;
  includedEvidenceKinds: EvidenceKind[];
  includedEvidenceCount: number;
}

export interface PairedChamberForecast {
  forecastId: string;
  quickRevisionId: string;
  deepRevisionId: string;
  voteEventId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  quickProbability: number;
  deepProbability: number;
  outcome: 0 | 1;
  quickExpectedYes?: number;
  deepExpectedYes?: number;
  actualYes?: number;
}

export interface ProbabilityScore {
  observations: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
}

export interface MovementScore {
  changed: number;
  unchanged: number;
  improved: number;
  worsened: number;
  meanAbsoluteMovement: number;
  meanSignedMovement: number;
}

export interface PairedProbabilityComparison {
  status: 'evaluable' | 'insufficient-sample';
  observations: number;
  quick?: ProbabilityScore;
  deep?: ProbabilityScore;
  delta: {
    brier?: number;
    logLoss?: number;
    expectedCalibrationError?: number;
    accuracy?: number;
  };
  movement: MovementScore;
}

export interface ChamberComparison extends PairedProbabilityComparison {
  voteCount?: {
    observations: number;
    quickMeanAbsoluteYesError: number;
    deepMeanAbsoluteYesError: number;
    deltaMeanAbsoluteYesError: number;
  };
}

const MOVEMENT_EPSILON = 1e-12;

function score(rows: readonly { probability: number; outcome: 0 | 1 }[]): ProbabilityScore {
  return {
    observations: rows.length,
    accuracy: binaryAccuracy(rows),
    brier: brierScore(rows),
    logLoss: logLoss(rows),
    expectedCalibrationError: expectedCalibrationError(rows),
  };
}

function movement(rows: readonly { quickProbability: number; deepProbability: number; outcome: 0 | 1 }[]): MovementScore {
  let changed = 0;
  let unchanged = 0;
  let improved = 0;
  let worsened = 0;
  let absoluteMovement = 0;
  let signedMovement = 0;

  for (const row of rows) {
    const delta = row.deepProbability - row.quickProbability;
    absoluteMovement += Math.abs(delta);
    signedMovement += delta;
    if (Math.abs(delta) <= MOVEMENT_EPSILON) {
      unchanged += 1;
      continue;
    }
    changed += 1;
    const quickError = (row.quickProbability - row.outcome) ** 2;
    const deepError = (row.deepProbability - row.outcome) ** 2;
    if (deepError + MOVEMENT_EPSILON < quickError) improved += 1;
    else if (deepError > quickError + MOVEMENT_EPSILON) worsened += 1;
  }

  return {
    changed,
    unchanged,
    improved,
    worsened,
    meanAbsoluteMovement: rows.length ? absoluteMovement / rows.length : 0,
    meanSignedMovement: rows.length ? signedMovement / rows.length : 0,
  };
}

function compare(rows: readonly { quickProbability: number; deepProbability: number; outcome: 0 | 1 }[]): PairedProbabilityComparison {
  const move = movement(rows);
  if (rows.length === 0) {
    return {
      status: 'insufficient-sample',
      observations: 0,
      delta: {},
      movement: move,
    };
  }
  const quick = score(rows.map((row) => ({ probability: row.quickProbability, outcome: row.outcome })));
  const deep = score(rows.map((row) => ({ probability: row.deepProbability, outcome: row.outcome })));
  return {
    status: 'evaluable',
    observations: rows.length,
    quick,
    deep,
    delta: {
      brier: deep.brier - quick.brier,
      logLoss: deep.logLoss - quick.logLoss,
      expectedCalibrationError: deep.expectedCalibrationError - quick.expectedCalibrationError,
      accuracy: deep.accuracy - quick.accuracy,
    },
    movement: move,
  };
}

export function scorePairedMemberForecasts(rows: readonly PairedMemberForecast[]): PairedProbabilityComparison {
  return compare(rows);
}

export function scorePairedChamberForecasts(rows: readonly PairedChamberForecast[]): ChamberComparison {
  const base = compare(rows);
  const countRows = rows.filter((row): row is PairedChamberForecast & {
    quickExpectedYes: number;
    deepExpectedYes: number;
    actualYes: number;
  } => row.quickExpectedYes !== undefined && row.deepExpectedYes !== undefined && row.actualYes !== undefined);
  if (countRows.length === 0) return base;
  const quickMae = countRows.reduce((sum, row) => sum + Math.abs(row.quickExpectedYes - row.actualYes), 0) / countRows.length;
  const deepMae = countRows.reduce((sum, row) => sum + Math.abs(row.deepExpectedYes - row.actualYes), 0) / countRows.length;
  return {
    ...base,
    voteCount: {
      observations: countRows.length,
      quickMeanAbsoluteYesError: quickMae,
      deepMeanAbsoluteYesError: deepMae,
      deltaMeanAbsoluteYesError: deepMae - quickMae,
    },
  };
}

export function scorePairedMembersByEvidenceKind(
  rows: readonly PairedMemberForecast[],
): Record<EvidenceKind | 'none', PairedProbabilityComparison> {
  const kinds: Array<EvidenceKind | 'none'> = ['direct_statement', 'related_statement', 'fact', 'context', 'inference', 'none'];
  return Object.fromEntries(kinds.map((kind) => [
    kind,
    scorePairedMemberForecasts(rows.filter((row) => kind === 'none'
      ? row.includedEvidenceKinds.length === 0
      : row.includedEvidenceKinds.includes(kind))),
  ])) as Record<EvidenceKind | 'none', PairedProbabilityComparison>;
}

export function scorePairedMembersBy(
  rows: readonly PairedMemberForecast[],
  dimension: 'session' | 'chamber',
): Record<string, PairedProbabilityComparison> {
  return Object.fromEntries([...new Set(rows.map((row) => row[dimension]))].sort().map((value) => [
    value,
    scorePairedMemberForecasts(rows.filter((row) => row[dimension] === value)),
  ]));
}
