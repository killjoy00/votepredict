import { createHash } from 'node:crypto';
import type { LifecycleP3Snapshot } from './lifecycle-p3-snapshot-dataset';
import {
  FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
  fitLifecycleP4ProspectiveStageModel,
  type LifecycleP4ProspectiveStageModel,
} from './lifecycle-p4-baselines';
import {
  buildLifecycleP5Rows,
  fitLifecycleP5RetainedProspectiveModel,
  type LifecycleP5RetainedProspectiveModel,
} from './lifecycle-p5-evidence-allocation';
import type { SerializedIntroductionPriorModelV4 } from '../forecasting/introduction-prior-model';
import {
  DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
  DECAY180_MEMBER_MODEL_VERSION,
} from '../forecasting/member-model-serving';
import {
  FROZEN_LIFECYCLE_P4_PASSAGE_SHA256,
  FROZEN_LIFECYCLE_P5_RETAINED_SHA256,
} from './lifecycle-p6-end-to-end';

export const LIFECYCLE_P8_MODEL_SCHEMA_VERSION = 'lifecycle-p8-prospective-model-v1' as const;
export const LIFECYCLE_P8_TARGET_SESSION = '2027-2028' as const;
export const LIFECYCLE_P8_REVEAL_NOT_BEFORE = '2028-07-01T00:00:00.000Z' as const;
export const LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256 =
  '94f0702073a9fe7afe9b86f8df10b715be28e9386e99bfb0159ae2cafaab3963' as const;
export const LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256 =
  '6071eec2ff48579652586dbb9e077e522f126bca4b6ff0d1f246794a779f60c3' as const;

export type LifecycleP8IntroductionModel =
  Omit<SerializedIntroductionPriorModelV4, 'provenance'>;

export interface LifecycleP8PreActivationState {
  targetSessionBills: number;
  strictOutcomeLabels: number;
  forecastRevisions: number;
  voteEvents: number;
  stageEvents: number;
}

export interface LifecycleP8ModelContent {
  targetSession: typeof LIFECYCLE_P8_TARGET_SESSION;
  targetKind: 'source_chamber_passage';
  introduction: {
    trainingCorpusSha256: typeof LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256;
    modelContentSha256: typeof LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256;
    model: LifecycleP8IntroductionModel;
  };
  p4Stage: LifecycleP4ProspectiveStageModel;
  p5Retained: LifecycleP5RetainedProspectiveModel;
  p6Conditional: {
    servingMemberModelVersion: typeof DECAY180_MEMBER_MODEL_VERSION;
    memberHistoryHalfLifeDays: typeof DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS;
    maxHistoricalAnalogues: 10;
    targetBillVersionPolicy: 'latest-official-version-strictly-before-cutoff';
    historyPolicy: 'member-votes-and-passage-events-strictly-before-cutoff';
    sameDayExcluded: true;
    fallback: 'prior-source-chamber-passage-vote-rate';
  };
}

export interface LifecycleP8ProspectiveModelArtifact {
  schemaVersion: typeof LIFECYCLE_P8_MODEL_SCHEMA_VERSION;
  generatedAt: string;
  codeSha: string | null;
  planSha256: string;
  frozenUpstream: {
    p3SnapshotContentSha256: typeof FROZEN_LIFECYCLE_P3_CONTENT_SHA256;
    p4HistoricalPredictionSha256: typeof FROZEN_LIFECYCLE_P4_PASSAGE_SHA256;
    p5HistoricalPredictionSha256: typeof FROZEN_LIFECYCLE_P5_RETAINED_SHA256;
  };
  preActivation: LifecycleP8PreActivationState;
  modelContent: LifecycleP8ModelContent;
  modelContentSha256: string;
  policy: {
    retrospectiveInputsEndWith2026: true;
    targetSessionOutcomesUsedForFit: false;
    targetSessionForecastsUsedForFit: false;
    servingChanged: false;
    automaticPromotionAllowed: false;
    revealNotBefore: typeof LIFECYCLE_P8_REVEAL_NOT_BEFORE;
    strictAndSubstantiveVehicleTargetsReportedSeparately: true;
  };
}

export function lifecycleP8JsonSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildLifecycleP8ProspectiveModelArtifact(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  p3ObservedSha256: string;
  introductionModel: LifecycleP8IntroductionModel;
  introductionTrainingCorpusSha256: string;
  historicalP4PredictionSha256: string;
  historicalP5PredictionSha256: string;
  planSha256: string;
  preActivation: LifecycleP8PreActivationState;
  generatedAt: string;
  codeSha: string | null;
}): LifecycleP8ProspectiveModelArtifact {
  if (input.p3ObservedSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
    throw new Error(
      `Lifecycle P8 refuses P3 drift: ${input.p3ObservedSha256} != ${FROZEN_LIFECYCLE_P3_CONTENT_SHA256}`,
    );
  }
  if (input.historicalP4PredictionSha256 !== FROZEN_LIFECYCLE_P4_PASSAGE_SHA256) {
    throw new Error('Lifecycle P8 refuses P4 historical-vector drift');
  }
  if (input.historicalP5PredictionSha256 !== FROZEN_LIFECYCLE_P5_RETAINED_SHA256) {
    throw new Error('Lifecycle P8 refuses P5 retained-vector drift');
  }
  if (input.introductionTrainingCorpusSha256 !== LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256) {
    throw new Error('Lifecycle P8 refuses 2027 introduction training-corpus drift');
  }
  const introSha = lifecycleP8JsonSha256(input.introductionModel);
  if (introSha !== LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256) {
    throw new Error(
      `Lifecycle P8 refuses 2027 introduction-model drift: ${introSha} != ${LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256}`,
    );
  }
  if (input.preActivation.strictOutcomeLabels !== 0) {
    throw new Error('Lifecycle P8 protocol must freeze before any 2027-28 strict outcome label exists');
  }
  if (input.preActivation.forecastRevisions !== 0) {
    throw new Error('Lifecycle P8 protocol must freeze before any 2027-28 forecast revision exists');
  }

  const modelContent: LifecycleP8ModelContent = {
    targetSession: LIFECYCLE_P8_TARGET_SESSION,
    targetKind: 'source_chamber_passage',
    introduction: {
      trainingCorpusSha256: LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256,
      modelContentSha256: LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256,
      model: input.introductionModel,
    },
    p4Stage: fitLifecycleP4ProspectiveStageModel(input.snapshots),
    p5Retained: fitLifecycleP5RetainedProspectiveModel(buildLifecycleP5Rows(input.snapshots)),
    p6Conditional: {
      servingMemberModelVersion: DECAY180_MEMBER_MODEL_VERSION,
      memberHistoryHalfLifeDays: DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
      maxHistoricalAnalogues: 10,
      targetBillVersionPolicy: 'latest-official-version-strictly-before-cutoff',
      historyPolicy: 'member-votes-and-passage-events-strictly-before-cutoff',
      sameDayExcluded: true,
      fallback: 'prior-source-chamber-passage-vote-rate',
    },
  };

  return {
    schemaVersion: LIFECYCLE_P8_MODEL_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    codeSha: input.codeSha,
    planSha256: input.planSha256,
    frozenUpstream: {
      p3SnapshotContentSha256: FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
      p4HistoricalPredictionSha256: FROZEN_LIFECYCLE_P4_PASSAGE_SHA256,
      p5HistoricalPredictionSha256: FROZEN_LIFECYCLE_P5_RETAINED_SHA256,
    },
    preActivation: input.preActivation,
    modelContent,
    modelContentSha256: lifecycleP8JsonSha256(modelContent),
    policy: {
      retrospectiveInputsEndWith2026: true,
      targetSessionOutcomesUsedForFit: false,
      targetSessionForecastsUsedForFit: false,
      servingChanged: false,
      automaticPromotionAllowed: false,
      revealNotBefore: LIFECYCLE_P8_REVEAL_NOT_BEFORE,
      strictAndSubstantiveVehicleTargetsReportedSeparately: true,
    },
  };
}
