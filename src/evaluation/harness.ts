import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';

export type BaselineModel = 'global-rate' | 'party-rate' | 'member-history';

export interface HistoricalMemberObservation {
  observationId: string;
  voteEventId: string;
  memberId: string;
  party: string;
  occurredAt: string;
  outcome: 0 | 1;
  session: string;
  chamber: string;
}

export interface BaselinePrediction {
  model: BaselineModel;
  observationId: string;
  voteEventId: string;
  memberId: string;
  party: string;
  occurredAt: string;
  session: string;
  chamber: string;
  probability: number;
  outcome: 0 | 1;
  priorObservations: number;
}

export interface BaselineScorecard {
  model: BaselineModel;
  observations: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
}

export interface ChamberTotalForecast {
  model: BaselineModel;
  voteEventId: string;
  session: string;
  chamber: string;
  members: number;
  expectedYes: number;
  actualYes: number;
  absoluteYesError: number;
}

export interface ChamberTotalScorecard {
  model: BaselineModel;
  voteEvents: number;
  meanAbsoluteYesError: number;
}

interface CountState {
  yes: number;
  total: number;
}

export interface BaselineHarnessOptions {
  fallback?: number;
  memberPriorStrength?: number;
}

function rate(state: CountState | undefined): number | undefined {
  return state && state.total > 0 ? state.yes / state.total : undefined;
}

function addObservation(map: Map<string, CountState>, key: string, outcome: 0 | 1): void {
  const current = map.get(key) ?? { yes: 0, total: 0 };
  current.yes += outcome;
  current.total += 1;
  map.set(key, current);
}

export function evaluateChronologicalBaselines(
  observations: readonly HistoricalMemberObservation[],
  options: BaselineHarnessOptions = {},
): BaselinePrediction[] {
  const fallback = options.fallback ?? 0.5;
  const memberPriorStrength = options.memberPriorStrength ?? 4;
  if (!Number.isFinite(fallback) || fallback < 0 || fallback > 1) throw new Error('fallback must be between 0 and 1');
  if (!Number.isFinite(memberPriorStrength) || memberPriorStrength < 0) throw new Error('memberPriorStrength cannot be negative');

  const sorted = [...observations].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt)
    || a.voteEventId.localeCompare(b.voteEventId)
    || a.observationId.localeCompare(b.observationId));

  const predictions: BaselinePrediction[] = [];
  const partyCounts = new Map<string, CountState>();
  const memberCounts = new Map<string, CountState>();
  let global: CountState = { yes: 0, total: 0 };

  for (let offset = 0; offset < sorted.length;) {
    const occurredAt = sorted[offset].occurredAt;
    let end = offset + 1;
    while (end < sorted.length && sorted[end].occurredAt === occurredAt) end += 1;
    const group = sorted.slice(offset, end);

    for (const observation of group) {
      const globalProbability = rate(global) ?? fallback;
      const partyProbability = rate(partyCounts.get(observation.party)) ?? globalProbability;
      const member = memberCounts.get(observation.memberId) ?? { yes: 0, total: 0 };
      const memberProbability = member.total === 0
        ? partyProbability
        : (member.yes + memberPriorStrength * partyProbability) / (member.total + memberPriorStrength);

      const common = {
        observationId: observation.observationId,
        voteEventId: observation.voteEventId,
        memberId: observation.memberId,
        party: observation.party,
        occurredAt: observation.occurredAt,
        session: observation.session,
        chamber: observation.chamber,
        outcome: observation.outcome,
        priorObservations: global.total,
      };
      predictions.push({ model: 'global-rate', probability: globalProbability, ...common });
      predictions.push({ model: 'party-rate', probability: partyProbability, ...common });
      predictions.push({ model: 'member-history', probability: memberProbability, ...common });
    }

    for (const observation of group) {
      global = { yes: global.yes + observation.outcome, total: global.total + 1 };
      addObservation(partyCounts, observation.party, observation.outcome);
      addObservation(memberCounts, observation.memberId, observation.outcome);
    }
    offset = end;
  }

  return predictions;
}

export function scoreBaselinePredictions(predictions: readonly BaselinePrediction[]): BaselineScorecard[] {
  const models: BaselineModel[] = ['global-rate', 'party-rate', 'member-history'];
  return models.flatMap((model) => {
    const rows = predictions.filter((prediction) => prediction.model === model);
    if (rows.length === 0) return [];
    const forecasts = rows.map(({ probability, outcome }) => ({ probability, outcome }));
    return [{
      model,
      observations: rows.length,
      accuracy: binaryAccuracy(forecasts),
      brier: brierScore(forecasts),
      logLoss: logLoss(forecasts),
      expectedCalibrationError: expectedCalibrationError(forecasts),
    }];
  });
}

export function scoreBaselinePredictionsBy(
  predictions: readonly BaselinePrediction[],
  dimension: 'session' | 'chamber',
): Record<string, BaselineScorecard[]> {
  const values = [...new Set(predictions.map((prediction) => prediction[dimension]))].sort();
  return Object.fromEntries(values.map((value) => [
    value,
    scoreBaselinePredictions(predictions.filter((prediction) => prediction[dimension] === value)),
  ]));
}

export function aggregateChamberTotals(predictions: readonly BaselinePrediction[]): ChamberTotalForecast[] {
  const groups = new Map<string, Omit<ChamberTotalForecast, 'absoluteYesError'>>();
  for (const prediction of predictions) {
    const key = `${prediction.model}:${prediction.voteEventId}`;
    const existing = groups.get(key) ?? {
      model: prediction.model,
      voteEventId: prediction.voteEventId,
      session: prediction.session,
      chamber: prediction.chamber,
      members: 0,
      expectedYes: 0,
      actualYes: 0,
    };
    existing.members += 1;
    existing.expectedYes += prediction.probability;
    existing.actualYes += prediction.outcome;
    groups.set(key, existing);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    absoluteYesError: Math.abs(group.expectedYes - group.actualYes),
  }));
}

export function scoreChamberTotals(forecasts: readonly ChamberTotalForecast[]): ChamberTotalScorecard[] {
  const models: BaselineModel[] = ['global-rate', 'party-rate', 'member-history'];
  return models.flatMap((model) => {
    const rows = forecasts.filter((forecast) => forecast.model === model);
    if (rows.length === 0) return [];
    return [{
      model,
      voteEvents: rows.length,
      meanAbsoluteYesError: rows.reduce((sum, row) => sum + row.absoluteYesError, 0) / rows.length,
    }];
  });
}
