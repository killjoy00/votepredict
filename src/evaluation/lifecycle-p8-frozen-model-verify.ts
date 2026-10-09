/**
 * Offline-only verifier for the exact September 23, 2026 P8 model.json bytes.
 *
 * It never fits a model, reads an app database, executes a prediction, or
 * downloads artifacts. The caller must supply the ORIGINAL extracted model.json
 * from GitHub Actions run 35910925882, artifact 10772991611.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256,
  LIFECYCLE_P8_FROZEN_PLAN_SHA256,
  LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256,
  LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256,
  LIFECYCLE_P8_MODEL_SCHEMA_VERSION,
  LIFECYCLE_P8_REVEAL_NOT_BEFORE,
  LIFECYCLE_P8_TARGET_SESSION,
  type LifecycleP8ProspectiveModelArtifact,
} from './lifecycle-p8-prospective';

export const P8_FROZEN_MODEL_JSON_RAW_SHA256 =
  '850aa4344bfe1635622af95c8f0871a38cbc234dc23eb9ae50085da668fcfc76' as const;
export const P8_FROZEN_MODEL_ARCHIVE_SHA256 =
  '72a42063a028114b4f6cbd8a356e74940eb00bdcda28a83cadf884aaa346061e' as const;
export const P8_FROZEN_MODEL_SOURCE_RUN = 35910925882 as const;
export const P8_FROZEN_MODEL_SOURCE_ARTIFACT = 10772991611 as const;
export const P8_FROZEN_MODEL_BUILD_SHA =
  '2733a6c8f96e88e1028dbcea7c5d9caac212ab08' as const;

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Testable primitive: raw-byte SHA and serialized content hash must both match. */
export function inspectP8ModelDocument(raw: Uint8Array, expected: {
  rawSha256: string;
  modelContentSha256: string;
}): { document: Record<string, unknown>; rawSha256: string; modelContentSha256: string } {
  const rawSha256 = sha256(raw);
  if (rawSha256 !== expected.rawSha256) {
    throw new Error('P8 model.json original file bytes do not match the pinned SHA-256');
  }
  let document: unknown;
  try { document = JSON.parse(Buffer.from(raw).toString('utf8')); } catch {
    throw new Error('P8 model.json is not valid UTF-8 JSON');
  }
  if (!isRecord(document) || !isRecord(document.modelContent)) {
    throw new Error('P8 model.json is missing the frozen modelContent object');
  }
  const modelContentSha256 = sha256(JSON.stringify(document.modelContent));
  if (modelContentSha256 !== expected.modelContentSha256 ||
    document.modelContentSha256 !== expected.modelContentSha256) {
    throw new Error('P8 modelContent digest or embedded claim does not match the frozen hash');
  }
  return { document, rawSha256, modelContentSha256 };
}

export interface VerifiedP8FrozenModel {
  readonly artifact: LifecycleP8ProspectiveModelArtifact;
  readonly verification: {
    readonly rawModelJsonSha256: typeof P8_FROZEN_MODEL_JSON_RAW_SHA256;
    readonly modelContentSha256: typeof LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256;
    readonly planSha256: typeof LIFECYCLE_P8_FROZEN_PLAN_SHA256;
    readonly sourceRunId: typeof P8_FROZEN_MODEL_SOURCE_RUN;
    readonly sourceArtifactId: typeof P8_FROZEN_MODEL_SOURCE_ARTIFACT;
    readonly sourceArchiveSha256: typeof P8_FROZEN_MODEL_ARCHIVE_SHA256;
    readonly servingChanged: false;
    readonly predictionsComputed: false;
    readonly productionCaptureActivated: false;
  };
}

/**
 * Strictly fail closed for any different model, reformatted JSON, truncated
 * input, drifted plan, future-outcome fit, or modified serving policy.
 * This is not a scoring API and cannot authorize real capture.
 */
export function verifyPinnedP8FrozenModelJson(raw: Uint8Array): VerifiedP8FrozenModel {
  const checked = inspectP8ModelDocument(raw, {
    rawSha256: P8_FROZEN_MODEL_JSON_RAW_SHA256,
    modelContentSha256: LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256,
  });
  const artifact = checked.document as unknown as LifecycleP8ProspectiveModelArtifact;
  if (artifact.schemaVersion !== LIFECYCLE_P8_MODEL_SCHEMA_VERSION ||
    artifact.codeSha !== P8_FROZEN_MODEL_BUILD_SHA ||
    artifact.planSha256 !== LIFECYCLE_P8_FROZEN_PLAN_SHA256 ||
    artifact.modelContent.targetSession !== LIFECYCLE_P8_TARGET_SESSION ||
    artifact.modelContent.targetKind !== 'source_chamber_passage' ||
    artifact.modelContent.introduction.trainingCorpusSha256 !== LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256 ||
    artifact.modelContent.introduction.modelContentSha256 !== LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256 ||
    artifact.modelContent.p6Conditional.servingMemberModelVersion !== 'member-eb-v1.2-decay180' ||
    artifact.modelContent.p6Conditional.sameDayExcluded !== true ||
    artifact.modelContent.p6Conditional.historyPolicy !==
      'member-votes-and-passage-events-strictly-before-cutoff' ||
    artifact.modelContent.p5Retained.model !== 'core_minus_companion' ||
    artifact.modelContent.p4Stage.model !== 'lifecycle-stage-empirical-v1' ||
    !artifact.preActivation ||
    Object.values(artifact.preActivation).some(value => value !== 0) ||
    artifact.policy?.revealNotBefore !== LIFECYCLE_P8_REVEAL_NOT_BEFORE ||
    artifact.policy?.retrospectiveInputsEndWith2026 !== true ||
    artifact.policy?.targetSessionOutcomesUsedForFit !== false ||
    artifact.policy?.targetSessionForecastsUsedForFit !== false ||
    artifact.policy?.servingChanged !== false ||
    artifact.policy?.automaticPromotionAllowed !== false ||
    artifact.policy?.strictAndSubstantiveVehicleTargetsReportedSeparately !== true) {
    throw new Error('P8 verified bytes contain an unexpected model, lineage, or serving policy');
  }
  return {
    artifact,
    verification: {
      rawModelJsonSha256: P8_FROZEN_MODEL_JSON_RAW_SHA256,
      modelContentSha256: LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256,
      planSha256: LIFECYCLE_P8_FROZEN_PLAN_SHA256,
      sourceRunId: P8_FROZEN_MODEL_SOURCE_RUN,
      sourceArtifactId: P8_FROZEN_MODEL_SOURCE_ARTIFACT,
      sourceArchiveSha256: P8_FROZEN_MODEL_ARCHIVE_SHA256,
      servingChanged: false,
      predictionsComputed: false,
      productionCaptureActivated: false,
    },
  };
}

export async function loadPinnedP8FrozenModelJsonFile(path: string): Promise<VerifiedP8FrozenModel> {
  return verifyPinnedP8FrozenModelJson(await readFile(path));
}
