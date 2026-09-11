import type { BillStagePrediction } from './stages';

export interface IntroductionObservation {
  billId: string;
  sessionSlug: string;
  sessionStart: string;
  chamber: 'house' | 'senate';
  title: string;
  billNumber: number | null;
  outcome: 0 | 1;
}

export interface IntroductionModelOptions {
  priorStrength?: number;
  minTokenSupport?: number;
  maxTokens?: number;
  tokenScale?: number;
  probabilityFloor?: number;
  probabilityCeiling?: number;
}

type TokenStat = { positives: number; total: number };

export interface IntroductionTitleModel {
  model: 'intro-title-eb-v1';
  baseRate: number;
  tokenStats: Map<string, TokenStat>;
  options: Required<IntroductionModelOptions>;
}

const STOPWORDS = new Set([
  'about', 'after', 'against', 'also', 'among', 'and', 'are', 'bill', 'chapter', 'concerning',
  'for', 'from', 'into', 'law', 'laws', 'making', 'minnesota', 'of', 'on', 'or', 'relating',
  'section', 'sections', 'state', 'the', 'this', 'to', 'under', 'with', 'providing', 'requiring',
  'certain', 'various', 'modifying', 'establishing', 'authorizing', 'appropriating',
]);

const DEFAULT_OPTIONS: Required<IntroductionModelOptions> = {
  priorStrength: 100,
  minTokenSupport: 25,
  maxTokens: 8,
  tokenScale: 0.35,
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

export function tokenizeIntroductionTitle(title: string): string[] {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !STOPWORDS.has(token));
  return [...new Set(tokens)];
}

export function trainIntroductionTitleModel(
  observations: readonly IntroductionObservation[],
  options: IntroductionModelOptions = {},
): IntroductionTitleModel {
  if (observations.length === 0) throw new Error('Cannot train introduction model without observations');
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const positives = observations.reduce((sum, row) => sum + row.outcome, 0);
  const baseRate = positives / observations.length;
  const tokenStats = new Map<string, TokenStat>();

  for (const row of observations) {
    for (const token of tokenizeIntroductionTitle(row.title)) {
      const stat = tokenStats.get(token) ?? { positives: 0, total: 0 };
      stat.total += 1;
      stat.positives += row.outcome;
      tokenStats.set(token, stat);
    }
  }

  return { model: 'intro-title-eb-v1', baseRate, tokenStats, options: resolved };
}

export function predictIntroductionTitleModel(model: IntroductionTitleModel, title: string): number {
  const baseLogOdds = logit(model.baseRate);
  const deltas: number[] = [];

  for (const token of tokenizeIntroductionTitle(title)) {
    const stat = model.tokenStats.get(token);
    if (!stat || stat.total < model.options.minTokenSupport) continue;
    const smoothedRate =
      (stat.positives + model.options.priorStrength * model.baseRate) /
      (stat.total + model.options.priorStrength);
    deltas.push(logit(smoothedRate) - baseLogOdds);
  }

  const strongest = deltas
    .sort((a, b) => Math.abs(b) - Math.abs(a))
    .slice(0, model.options.maxTokens);
  const meanDelta = strongest.length
    ? strongest.reduce((sum, delta) => sum + delta, 0) / strongest.length
    : 0;
  return clamp(
    logistic(baseLogOdds + model.options.tokenScale * meanDelta),
    model.options.probabilityFloor,
    model.options.probabilityCeiling,
  );
}

export function evaluateIntroductionTitleModelChronologically(
  observations: readonly IntroductionObservation[],
  options: IntroductionModelOptions = {},
): BillStagePrediction[] {
  const sessionStarts = [...new Set(observations.map((row) => row.sessionStart))].sort();
  const predictions: BillStagePrediction[] = [];

  for (let index = 1; index < sessionStarts.length; index += 1) {
    const sessionStart = sessionStarts[index];
    const training = observations.filter((row) => row.sessionStart < sessionStart);
    const holdout = observations.filter((row) => row.sessionStart === sessionStart);
    const model = trainIntroductionTitleModel(training, options);
    for (const row of holdout) {
      predictions.push({
        billId: row.billId,
        asOf: `${row.sessionStart}T00:00:00Z`,
        targetKind: 'source_chamber_passage',
        outcome: row.outcome,
        probability: predictIntroductionTitleModel(model, row.title),
        model: model.model,
      });
    }
  }

  return predictions;
}
