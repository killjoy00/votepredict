import type { BillStagePrediction } from './stages';
import {
  predictIntroductionTitleModel,
  tokenizeIntroductionTitle,
  trainIntroductionTitleModel,
  type IntroductionModelOptions,
  type IntroductionObservation,
  type IntroductionTitleModel,
} from './introduction-model';

export interface IntroductionTextObservation extends IntroductionObservation {
  initialText: string | null;
  initialTextAvailableAtIntroduction: boolean;
}

export interface IntroductionTextModelOptions {
  titleOptions?: IntroductionModelOptions;
  textPriorStrength?: number;
  textMinSupport?: number;
  textMaxFeatures?: number;
  textScale?: number;
  preambleMaxChars?: number;
  probabilityFloor?: number;
  probabilityCeiling?: number;
}

type TokenStat = { positives: number; total: number };

export interface IntroductionTextModel {
  model: 'intro-title-text-eb-v4';
  titleModel: IntroductionTitleModel;
  baseRate: number;
  textStats: Map<string, TokenStat>;
  options: Required<Omit<IntroductionTextModelOptions, 'titleOptions'>> & { titleOptions: IntroductionModelOptions };
}

const DEFAULT_OPTIONS: Required<Omit<IntroductionTextModelOptions, 'titleOptions'>> = {
  textPriorStrength: 200,
  textMinSupport: 40,
  textMaxFeatures: 10,
  textScale: 0.18,
  preambleMaxChars: 8_000,
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

export function introductionPreamble(rawText: string | null, maxChars = DEFAULT_OPTIONS.preambleMaxChars): string {
  if (!rawText) return '';
  const enacted = rawText.search(/\bBE IT ENACTED BY THE LEGISLATURE\b/i);
  const preamble = (enacted >= 0 ? rawText.slice(0, enacted) : rawText).slice(0, maxChars).trim();
  return preamble;
}

export function incrementalIntroductionTextTokens(title: string, rawText: string | null, maxChars = DEFAULT_OPTIONS.preambleMaxChars): string[] {
  const titleTokens = new Set(tokenizeIntroductionTitle(title));
  return tokenizeIntroductionTitle(introductionPreamble(rawText, maxChars)).filter((token) => !titleTokens.has(token));
}

function addStat(stats: Map<string, TokenStat>, key: string, outcome: 0 | 1): void {
  const stat = stats.get(key) ?? { positives: 0, total: 0 };
  stat.total += 1;
  stat.positives += outcome;
  stats.set(key, stat);
}

function empiricalBayesDelta(stat: TokenStat | undefined, baseRate: number, priorStrength: number, minSupport: number): number {
  if (!stat || stat.total < minSupport) return 0;
  const smoothedRate = (stat.positives + priorStrength * baseRate) / (stat.total + priorStrength);
  return logit(smoothedRate) - logit(baseRate);
}

function strongestMean(deltas: readonly number[], limit: number): number {
  const strongest = [...deltas]
    .filter((delta) => Number.isFinite(delta) && delta !== 0)
    .sort((left, right) => Math.abs(right) - Math.abs(left))
    .slice(0, limit);
  return strongest.length ? strongest.reduce((sum, delta) => sum + delta, 0) / strongest.length : 0;
}

export function trainIntroductionTextModel(
  observations: readonly IntroductionTextObservation[],
  options: IntroductionTextModelOptions = {},
): IntroductionTextModel {
  if (observations.length === 0) throw new Error('Cannot train introduction text model without observations');
  const resolved = { ...DEFAULT_OPTIONS, ...options, titleOptions: options.titleOptions ?? {} };
  const titleModel = trainIntroductionTitleModel(observations, resolved.titleOptions);
  const textStats = new Map<string, TokenStat>();
  for (const row of observations) {
    if (!row.initialTextAvailableAtIntroduction) continue;
    if (!row.initialText) throw new Error(`${row.billId}: introduction-available initial text is missing`);
    for (const token of incrementalIntroductionTextTokens(row.title, row.initialText, resolved.preambleMaxChars)) {
      addStat(textStats, token, row.outcome);
    }
  }
  return { model: 'intro-title-text-eb-v4', titleModel, baseRate: titleModel.baseRate, textStats, options: resolved };
}

export function predictIntroductionTextModel(
  model: IntroductionTextModel,
  row: Pick<IntroductionTextObservation, 'title' | 'initialText' | 'initialTextAvailableAtIntroduction'>,
): number {
  const titleProbability = predictIntroductionTitleModel(model.titleModel, row.title);
  if (!row.initialTextAvailableAtIntroduction) return titleProbability;
  if (!row.initialText) throw new Error('Introduction-available initial text is missing');
  const deltas = incrementalIntroductionTextTokens(row.title, row.initialText, model.options.preambleMaxChars).map((token) =>
    empiricalBayesDelta(model.textStats.get(token), model.baseRate, model.options.textPriorStrength, model.options.textMinSupport),
  );
  const textDelta = strongestMean(deltas, model.options.textMaxFeatures);
  return clamp(
    logistic(logit(titleProbability) + model.options.textScale * textDelta),
    model.options.probabilityFloor,
    model.options.probabilityCeiling,
  );
}

export function evaluateIntroductionTextModelChronologically(
  observations: readonly IntroductionTextObservation[],
  options: IntroductionTextModelOptions = {},
): BillStagePrediction[] {
  const sessionStarts = [...new Set(observations.map((row) => row.sessionStart))].sort();
  const predictions: BillStagePrediction[] = [];
  for (let index = 1; index < sessionStarts.length; index += 1) {
    const sessionStart = sessionStarts[index];
    const training = observations.filter((row) => row.sessionStart < sessionStart);
    const holdout = observations.filter((row) => row.sessionStart === sessionStart);
    const model = trainIntroductionTextModel(training, options);
    for (const row of holdout) {
      predictions.push({
        billId: row.billId,
        asOf: `${row.sessionStart}T00:00:00Z`,
        targetKind: 'source_chamber_passage',
        outcome: row.outcome,
        probability: predictIntroductionTextModel(model, row),
        model: model.model,
      });
    }
  }
  return predictions;
}
