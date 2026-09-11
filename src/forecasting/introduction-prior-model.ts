import {
  predictIntroductionTextModel,
  type IntroductionTextModel,
  type IntroductionTextObservation,
} from '../evaluation/introduction-text-model';
import type { IntroductionTitleModel } from '../evaluation/introduction-model';

export const INTRODUCTION_PRIOR_MODEL_VERSION = 'intro-title-text-eb-v4' as const;
export const INTRODUCTION_PRIOR_TARGET_KIND = 'source_chamber_passage' as const;
export const INTRODUCTION_PRIOR_ARTIFACT_SCHEMA_VERSION = 1 as const;

export type IntroductionPriorStat = readonly [token: string, positives: number, total: number];

export interface SerializedIntroductionPriorModelV4 {
  schemaVersion: typeof INTRODUCTION_PRIOR_ARTIFACT_SCHEMA_VERSION;
  model: typeof INTRODUCTION_PRIOR_MODEL_VERSION;
  targetKind: typeof INTRODUCTION_PRIOR_TARGET_KIND;
  targetSessionSlug: string;
  targetSessionStart: string;
  trainedThroughSessionSlug: string;
  trainingSessions: string[];
  trainingRows: number;
  trainingPositives: number;
  baseRate: number;
  titleOptions: IntroductionTitleModel['options'];
  textOptions: Omit<IntroductionTextModel['options'], 'titleOptions'>;
  titleStats: IntroductionPriorStat[];
  textStats: IntroductionPriorStat[];
  provenance: {
    authoritativeUniverse: number;
    generatedAt: string;
    codeSha: string | null;
    evaluationCommit: string;
  };
}

function supportedStats(
  stats: ReadonlyMap<string, { positives: number; total: number }>,
  minimumSupport: number,
): IntroductionPriorStat[] {
  return [...stats.entries()]
    .filter(([, stat]) => stat.total >= minimumSupport)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([token, stat]) => [token, stat.positives, stat.total] as const);
}

export function serializeIntroductionPriorModelV4(
  model: IntroductionTextModel,
  metadata: Omit<SerializedIntroductionPriorModelV4,
    'schemaVersion' | 'model' | 'targetKind' | 'baseRate' | 'titleOptions' | 'textOptions' | 'titleStats' | 'textStats'>,
): SerializedIntroductionPriorModelV4 {
  if (model.model !== INTRODUCTION_PRIOR_MODEL_VERSION) throw new Error(`Unexpected introduction model: ${model.model}`);
  return {
    schemaVersion: INTRODUCTION_PRIOR_ARTIFACT_SCHEMA_VERSION,
    model: INTRODUCTION_PRIOR_MODEL_VERSION,
    targetKind: INTRODUCTION_PRIOR_TARGET_KIND,
    ...metadata,
    baseRate: model.baseRate,
    titleOptions: model.titleModel.options,
    textOptions: {
      textPriorStrength: model.options.textPriorStrength,
      textMinSupport: model.options.textMinSupport,
      textMaxFeatures: model.options.textMaxFeatures,
      textScale: model.options.textScale,
      preambleMaxChars: model.options.preambleMaxChars,
      probabilityFloor: model.options.probabilityFloor,
      probabilityCeiling: model.options.probabilityCeiling,
    },
    titleStats: supportedStats(model.titleModel.tokenStats, model.titleModel.options.minTokenSupport),
    textStats: supportedStats(model.textStats, model.options.textMinSupport),
  };
}

export function deserializeIntroductionPriorModelV4(artifact: SerializedIntroductionPriorModelV4): IntroductionTextModel {
  if (artifact.schemaVersion !== INTRODUCTION_PRIOR_ARTIFACT_SCHEMA_VERSION) throw new Error('Unsupported introduction prior artifact schema');
  if (artifact.model !== INTRODUCTION_PRIOR_MODEL_VERSION || artifact.targetKind !== INTRODUCTION_PRIOR_TARGET_KIND) {
    throw new Error('Unexpected introduction prior artifact identity');
  }
  const titleModel: IntroductionTitleModel = {
    model: 'intro-title-eb-v1',
    baseRate: artifact.baseRate,
    tokenStats: new Map(artifact.titleStats.map(([token, positives, total]) => [token, { positives, total }])),
    options: artifact.titleOptions,
  };
  return {
    model: INTRODUCTION_PRIOR_MODEL_VERSION,
    titleModel,
    baseRate: artifact.baseRate,
    textStats: new Map(artifact.textStats.map(([token, positives, total]) => [token, { positives, total }])),
    options: { ...artifact.textOptions, titleOptions: artifact.titleOptions },
  };
}

export function canServeIntroductionPrior(
  artifact: SerializedIntroductionPriorModelV4,
  sessionSlug: string,
  sessionStart: string,
): boolean {
  return artifact.targetSessionSlug === sessionSlug && artifact.targetSessionStart === sessionStart;
}

export function predictIntroductionPriorFromArtifact(
  artifact: SerializedIntroductionPriorModelV4,
  row: Pick<IntroductionTextObservation, 'title' | 'initialText' | 'initialTextAvailableAtIntroduction'> & {
    sessionSlug: string;
    sessionStart: string;
  },
): number | undefined {
  if (!canServeIntroductionPrior(artifact, row.sessionSlug, row.sessionStart)) return undefined;
  return predictIntroductionTextModel(deserializeIntroductionPriorModelV4(artifact), row);
}
