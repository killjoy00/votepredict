import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';

export interface CoalitionChamberOutcome {
  voteEventId: string;
  chamber: string;
  passageProbability: number;
  expectedYes: number;
  yesLow: number;
  yesHigh: number;
  actualYes: number;
  passed: 0 | 1;
}

export function scoreCoalitionChambers(rows: readonly CoalitionChamberOutcome[]) {
  if (rows.length === 0) throw new Error('No chamber outcomes to score');
  const forecasts = rows.map((row) => ({ probability: row.passageProbability, outcome: row.passed }));
  const alwaysPass = rows.map((row) => ({ probability: 1, outcome: row.passed }));
  const passageBrier = brierScore(forecasts);
  const alwaysPassBrier = brierScore(alwaysPass);
  return {
    events: rows.length,
    passageAccuracy: binaryAccuracy(forecasts),
    passageBrier,
    passageLogLoss: logLoss(forecasts),
    passageCalibrationError: expectedCalibrationError(forecasts),
    passageBrierSkillVsAlwaysPass: alwaysPassBrier === 0 ? Number.NaN : 1 - passageBrier / alwaysPassBrier,
    meanAbsoluteYesError: rows.reduce((sum, row) => sum + Math.abs(row.expectedYes - row.actualYes), 0) / rows.length,
    intervalCoverage: rows.filter((row) => row.actualYes >= row.yesLow && row.actualYes <= row.yesHigh).length / rows.length,
  };
}

export function scoreCoalitionChambersBy(rows: readonly CoalitionChamberOutcome[], dimension: 'chamber') {
  return Object.fromEntries([...new Set(rows.map((row) => row[dimension]))].sort().map((value) => [
    value,
    scoreCoalitionChambers(rows.filter((row) => row[dimension] === value)),
  ]));
}
