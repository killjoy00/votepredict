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

export interface IntroductionStructuralModelOptions {
  unigramPriorStrength?: number;
  unigramMinSupport?: number;
  unigramMaxFeatures?: number;
  unigramScale?: number;
  bigramPriorStrength?: number;
  bigramMinSupport?: number;
  bigramMaxFeatures?: number;
  bigramScale?: number;
  structuralPriorStrength?: number;
  chamberScale?: number;
  billNumberScale?: number;
  titleLengthScale?: number;
  probabilityFloor?: number;
  probabilityCeiling?: number;
}

export interface IntroductionStructuralModel {
  model: 'intro-structural-eb-v2';
  baseRate: number;
  unigramStats: Map<string, TokenStat>;
  bigramStats: Map<string, TokenStat>;
  chamberStats: Map<string, TokenStat>;
  billNumberStats: Map<string, TokenStat>;
  titleLengthStats: Map<string, TokenStat>;
  options: Required<IntroductionStructuralModelOptions>;
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

const DEFAULT_STRUCTURAL_OPTIONS: Required<IntroductionStructuralModelOptions> = {
  unigramPriorStrength: 150,
  unigramMinSupport: 30,
  unigramMaxFeatures: 6,
  unigramScale: 0.22,
  bigramPriorStrength: 120,
  bigramMinSupport: 20,
  bigramMaxFeatures: 4,
  bigramScale: 0.12,
  structuralPriorStrength: 600,
  chamberScale: 0.08,
  billNumberScale: 0.18,
  titleLengthScale: 0.08,
  probabilityFloor: 0.003,
  probabilityCeiling: 0.20,
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

function orderedIntroductionTitleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !STOPWORDS.has(token));
}

export function tokenizeIntroductionTitle(title: string): string[] {
  return [...new Set(orderedIntroductionTitleTokens(title))];
}

export function introductionTitleBigrams(title: string): string[] {
  const tokens = orderedIntroductionTitleTokens(title);
  return [...new Set(tokens.slice(0, -1).map((token, index) => `${token}_${tokens[index + 1]}`))];
}

export function introductionBillNumberBand(billNumber: number | null): string {
  if (!billNumber || !Number.isFinite(billNumber) || billNumber < 1) return 'unknown';
  return `${Math.floor((billNumber - 1) / 500) * 500 + 1}-${(Math.floor((billNumber - 1) / 500) + 1) * 500}`;
}

export function introductionTitleLengthBand(title: string): string {
  const count = orderedIntroductionTitleTokens(title).length;
  if (count <= 2) return '0-2';
  if (count <= 5) return '3-5';
  if (count <= 9) return '6-9';
  return '10+';
}

function addStat(stats: Map<string, TokenStat>, key: string, outcome: 0 | 1): void {
  const stat = stats.get(key) ?? { positives: 0, total: 0 };
  stat.total += 1;
  stat.positives += outcome;
  stats.set(key, stat);
}

function empiricalBayesDelta(stat: TokenStat | undefined, baseRate: number, priorStrength: number, minSupport = 1): number {
  if (!stat || stat.total < minSupport) return 0;
  const smoothedRate = (stat.positives + priorStrength * baseRate) / (stat.total + priorStrength);
  return logit(smoothedRate) - logit(baseRate);
}

function strongestMean(deltas: readonly number[], limit: number): number {
  const strongest = [...deltas]
    .filter((delta) => Number.isFinite(delta) && delta !== 0)
    .sort((a, b) => Math.abs(b) - Math.abs(a))
    .slice(0, limit);
  return strongest.length ? strongest.reduce((sum, delta) => sum + delta, 0) / strongest.length : 0;
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
    for (const token of tokenizeIntroductionTitle(row.title)) addStat(tokenStats, token, row.outcome);
  }

  return { model: 'intro-title-eb-v1', baseRate, tokenStats, options: resolved };
}

export function predictIntroductionTitleModel(model: IntroductionTitleModel, title: string): number {
  const baseLogOdds = logit(model.baseRate);
  const deltas = tokenizeIntroductionTitle(title).map((token) =>
    empiricalBayesDelta(model.tokenStats.get(token), model.baseRate, model.options.priorStrength, model.options.minTokenSupport),
  );
  const meanDelta = strongestMean(deltas, model.options.maxTokens);
  return clamp(
    logistic(baseLogOdds + model.options.tokenScale * meanDelta),
    model.options.probabilityFloor,
    model.options.probabilityCeiling,
  );
}

export function trainIntroductionStructuralModel(
  observations: readonly IntroductionObservation[],
  options: IntroductionStructuralModelOptions = {},
): IntroductionStructuralModel {
  if (observations.length === 0) throw new Error('Cannot train structural introduction model without observations');
  const resolved = { ...DEFAULT_STRUCTURAL_OPTIONS, ...options };
  const positives = observations.reduce((sum, row) => sum + row.outcome, 0);
  const baseRate = positives / observations.length;
  const unigramStats = new Map<string, TokenStat>();
  const bigramStats = new Map<string, TokenStat>();
  const chamberStats = new Map<string, TokenStat>();
  const billNumberStats = new Map<string, TokenStat>();
  const titleLengthStats = new Map<string, TokenStat>();

  for (const row of observations) {
    for (const token of tokenizeIntroductionTitle(row.title)) addStat(unigramStats, token, row.outcome);
    for (const bigram of introductionTitleBigrams(row.title)) addStat(bigramStats, bigram, row.outcome);
    addStat(chamberStats, row.chamber, row.outcome);
    addStat(billNumberStats, `${row.chamber}:${introductionBillNumberBand(row.billNumber)}`, row.outcome);
    addStat(titleLengthStats, introductionTitleLengthBand(row.title), row.outcome);
  }

  return {
    model: 'intro-structural-eb-v2',
    baseRate,
    unigramStats,
    bigramStats,
    chamberStats,
    billNumberStats,
    titleLengthStats,
    options: resolved,
  };
}

export function predictIntroductionStructuralModel(model: IntroductionStructuralModel, row: Pick<IntroductionObservation, 'chamber' | 'title' | 'billNumber'>): number {
  const baseLogOdds = logit(model.baseRate);
  const unigramDelta = strongestMean(
    tokenizeIntroductionTitle(row.title).map((token) =>
      empiricalBayesDelta(model.unigramStats.get(token), model.baseRate, model.options.unigramPriorStrength, model.options.unigramMinSupport),
    ),
    model.options.unigramMaxFeatures,
  );
  const bigramDelta = strongestMean(
    introductionTitleBigrams(row.title).map((bigram) =>
      empiricalBayesDelta(model.bigramStats.get(bigram), model.baseRate, model.options.bigramPriorStrength, model.options.bigramMinSupport),
    ),
    model.options.bigramMaxFeatures,
  );
  const chamberDelta = empiricalBayesDelta(
    model.chamberStats.get(row.chamber), model.baseRate, model.options.structuralPriorStrength,
  );
  const billNumberDelta = empiricalBayesDelta(
    model.billNumberStats.get(`${row.chamber}:${introductionBillNumberBand(row.billNumber)}`),
    model.baseRate,
    model.options.structuralPriorStrength,
  );
  const titleLengthDelta = empiricalBayesDelta(
    model.titleLengthStats.get(introductionTitleLengthBand(row.title)),
    model.baseRate,
    model.options.structuralPriorStrength,
  );

  return clamp(
    logistic(
      baseLogOdds
      + model.options.unigramScale * unigramDelta
      + model.options.bigramScale * bigramDelta
      + model.options.chamberScale * chamberDelta
      + model.options.billNumberScale * billNumberDelta
      + model.options.titleLengthScale * titleLengthDelta,
    ),
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

export function evaluateIntroductionStructuralModelChronologically(
  observations: readonly IntroductionObservation[],
  options: IntroductionStructuralModelOptions = {},
): BillStagePrediction[] {
  const sessionStarts = [...new Set(observations.map((row) => row.sessionStart))].sort();
  const predictions: BillStagePrediction[] = [];

  for (let index = 1; index < sessionStarts.length; index += 1) {
    const sessionStart = sessionStarts[index];
    const training = observations.filter((row) => row.sessionStart < sessionStart);
    const holdout = observations.filter((row) => row.sessionStart === sessionStart);
    const model = trainIntroductionStructuralModel(training, options);
    for (const row of holdout) {
      predictions.push({
        billId: row.billId,
        asOf: `${row.sessionStart}T00:00:00Z`,
        targetKind: 'source_chamber_passage',
        outcome: row.outcome,
        probability: predictIntroductionStructuralModel(model, row),
        model: model.model,
      });
    }
  }

  return predictions;
}
