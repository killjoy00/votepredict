import type { BillStagePrediction } from './stages';
import {
  predictIntroductionTitleModel,
  trainIntroductionTitleModel,
  type IntroductionModelOptions,
  type IntroductionObservation,
  type IntroductionTitleModel,
} from './introduction-model';

export interface IntroductionTimingObservation extends IntroductionObservation {
  introducedOn: string;
  initialDocumentOn: string;
}

export interface IntroductionTimingModelOptions {
  titleOptions?: IntroductionModelOptions;
  timingPriorStrength?: number;
  legislativeYearScale?: number;
  yearMonthScale?: number;
  initialDocumentLeadScale?: number;
  probabilityFloor?: number;
  probabilityCeiling?: number;
}

type TimingStat = { positives: number; total: number };

export interface IntroductionTimingModel {
  model: 'intro-title-timing-eb-v3';
  titleModel: IntroductionTitleModel;
  baseRate: number;
  legislativeYearStats: Map<string, TimingStat>;
  yearMonthStats: Map<string, TimingStat>;
  initialDocumentLeadStats: Map<string, TimingStat>;
  options: Required<Omit<IntroductionTimingModelOptions, 'titleOptions'>> & { titleOptions: IntroductionModelOptions };
}

const DEFAULT_OPTIONS: Required<Omit<IntroductionTimingModelOptions, 'titleOptions'>> = {
  timingPriorStrength: 700,
  legislativeYearScale: 0.10,
  yearMonthScale: 0.16,
  initialDocumentLeadScale: 0.06,
  probabilityFloor: 0.0025,
  probabilityCeiling: 0.35,
};

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function logit(probability: number) {
  const p = clamp(probability, 1e-9, 1 - 1e-9);
  return Math.log(p / (1 - p));
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function parseIsoDate(value: string, label: string): Date {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ${label}: ${value}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf())) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

export function introductionLegislativeYearKey(row: Pick<IntroductionTimingObservation, 'sessionStart' | 'introducedOn'>): string {
  const sessionYear = Number(row.sessionStart.slice(0, 4));
  const introducedYear = Number(row.introducedOn.slice(0, 4));
  if (!Number.isInteger(sessionYear) || !Number.isInteger(introducedYear)) return 'unknown';
  if (introducedYear === sessionYear) return 'year-1';
  if (introducedYear === sessionYear + 1) return 'year-2';
  return 'unknown';
}

export function introductionYearMonthKey(row: Pick<IntroductionTimingObservation, 'sessionStart' | 'introducedOn'>): string {
  const legislativeYear = introductionLegislativeYearKey(row);
  const month = row.introducedOn.match(/^20\d{2}-(\d{2})-/)?.[1] ?? 'unknown';
  return `${legislativeYear}:${month}`;
}

export function initialDocumentLeadKey(row: Pick<IntroductionTimingObservation, 'introducedOn' | 'initialDocumentOn'>): string {
  const introduced = parseIsoDate(row.introducedOn, 'introduction date');
  const initial = parseIsoDate(row.initialDocumentOn, 'initial document date');
  const days = Math.round((introduced.valueOf() - initial.valueOf()) / 86_400_000);
  if (days < 0) return 'future';
  if (days === 0) return 'same-day';
  if (days === 1) return 'one-day';
  if (days <= 7) return 'two-to-seven-days';
  return 'eight-plus-days';
}

function addStat(stats: Map<string, TimingStat>, key: string, outcome: 0 | 1): void {
  const stat = stats.get(key) ?? { positives: 0, total: 0 };
  stat.total += 1;
  stat.positives += outcome;
  stats.set(key, stat);
}

function empiricalBayesDelta(stat: TimingStat | undefined, baseRate: number, priorStrength: number): number {
  if (!stat || stat.total === 0) return 0;
  const smoothedRate = (stat.positives + priorStrength * baseRate) / (stat.total + priorStrength);
  return logit(smoothedRate) - logit(baseRate);
}

export function trainIntroductionTimingModel(
  observations: readonly IntroductionTimingObservation[],
  options: IntroductionTimingModelOptions = {},
): IntroductionTimingModel {
  if (observations.length === 0) throw new Error('Cannot train introduction timing model without observations');
  const resolved = {
    ...DEFAULT_OPTIONS,
    ...options,
    titleOptions: options.titleOptions ?? {},
  };
  const titleModel = trainIntroductionTitleModel(observations, resolved.titleOptions);
  const legislativeYearStats = new Map<string, TimingStat>();
  const yearMonthStats = new Map<string, TimingStat>();
  const initialDocumentLeadStats = new Map<string, TimingStat>();

  for (const row of observations) {
    const leadKey = initialDocumentLeadKey(row);
    if (leadKey === 'future') throw new Error(`${row.billId}: initial document postdates introduction`);
    addStat(legislativeYearStats, introductionLegislativeYearKey(row), row.outcome);
    addStat(yearMonthStats, introductionYearMonthKey(row), row.outcome);
    addStat(initialDocumentLeadStats, leadKey, row.outcome);
  }

  return {
    model: 'intro-title-timing-eb-v3',
    titleModel,
    baseRate: titleModel.baseRate,
    legislativeYearStats,
    yearMonthStats,
    initialDocumentLeadStats,
    options: resolved,
  };
}

export function predictIntroductionTimingModel(
  model: IntroductionTimingModel,
  row: Pick<IntroductionTimingObservation, 'sessionStart' | 'title' | 'introducedOn' | 'initialDocumentOn'>,
): number {
  const titleProbability = predictIntroductionTitleModel(model.titleModel, row.title);
  const leadKey = initialDocumentLeadKey(row);
  if (leadKey === 'future') throw new Error('Initial document postdates introduction');
  const yearDelta = empiricalBayesDelta(
    model.legislativeYearStats.get(introductionLegislativeYearKey(row)),
    model.baseRate,
    model.options.timingPriorStrength,
  );
  const monthDelta = empiricalBayesDelta(
    model.yearMonthStats.get(introductionYearMonthKey(row)),
    model.baseRate,
    model.options.timingPriorStrength,
  );
  const leadDelta = empiricalBayesDelta(
    model.initialDocumentLeadStats.get(leadKey),
    model.baseRate,
    model.options.timingPriorStrength,
  );

  return clamp(
    logistic(
      logit(titleProbability)
      + model.options.legislativeYearScale * yearDelta
      + model.options.yearMonthScale * monthDelta
      + model.options.initialDocumentLeadScale * leadDelta,
    ),
    model.options.probabilityFloor,
    model.options.probabilityCeiling,
  );
}

export function evaluateIntroductionTimingModelChronologically(
  observations: readonly IntroductionTimingObservation[],
  options: IntroductionTimingModelOptions = {},
): BillStagePrediction[] {
  const sessionStarts = [...new Set(observations.map((row) => row.sessionStart))].sort();
  const predictions: BillStagePrediction[] = [];

  for (let index = 1; index < sessionStarts.length; index += 1) {
    const sessionStart = sessionStarts[index];
    const training = observations.filter((row) => row.sessionStart < sessionStart);
    const holdout = observations.filter((row) => row.sessionStart === sessionStart);
    const model = trainIntroductionTimingModel(training, options);
    for (const row of holdout) {
      predictions.push({
        billId: row.billId,
        asOf: `${row.introducedOn}T12:00:00Z`,
        targetKind: 'source_chamber_passage',
        outcome: row.outcome,
        probability: predictIntroductionTimingModel(model, row),
        model: model.model,
      });
    }
  }

  return predictions;
}
