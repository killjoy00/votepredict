import { createHash } from 'node:crypto';
import meta2025 from './generated/introduction-v4-2025-2026-meta.json';
import titleStats2025Part1 from './generated/introduction-v4-title-stats-1.json';
import titleStats2025Part2 from './generated/introduction-v4-title-stats-2.json';
import titleStats2025Part3 from './generated/introduction-v4-title-stats-3.json';
import textStats2025 from './generated/introduction-v4-text-stats.json';
import meta2027 from './generated/introduction-v4-2027-2028-meta.json';
import titleStats2027Part1 from './generated/introduction-v4-2027-title-stats-1.json';
import titleStats2027Part2 from './generated/introduction-v4-2027-title-stats-2.json';
import titleStats2027Part3 from './generated/introduction-v4-2027-title-stats-3.json';
import titleStats2027Part4 from './generated/introduction-v4-2027-title-stats-4.json';
import textStats2027 from './generated/introduction-v4-2027-text-stats.json';
import {
  INTRODUCTION_PRIOR_MODEL_VERSION,
  predictIntroductionPriorFromArtifact,
  type IntroductionPriorStat,
  type SerializedIntroductionPriorModelV4,
} from './introduction-prior-model';
import { pool } from '@/lib/db';

export const INTRODUCTION_PRIOR_SERVING_PROVENANCE = Object.freeze({
  expectedTargetRows: 10_472,
  expectedTextEligibleRows: 10_471,
  expectedTitleOnlyFallbackRows: 1,
  runtimeAssembledArtifactSha256: '7e1f87193ffe3182a27086d1d5a66e6f730f0f4b31bd2785ef25d9a45700d200',
  originalMinifiedArtifactSha256: '646b428ce6a2192bc97c0cd5301fc5a9bac7c4866bf9a33c52b0a2d0d8a36e4d',
  originalExportSha256: 'a5731c809298e7b6d914259178c9fcafe45b8cba314fea4c4253d3bfb144ae84',
  predictionSha256: '56ef5169cca75b8586a4e2571bcb7745c33770c8a55d1723db9cdab97e9f3ca4',
});

export const INTRODUCTION_PRIOR_2027_SERVING_PROVENANCE = Object.freeze({
  trainingCorpusSha256: '94f0702073a9fe7afe9b86f8df10b715be28e9386e99bfb0159ae2cafaab3963',
  runtimeAssembledArtifactSha256: '2f648020d45bf061354671957d1e076937f2aa995b8b618d3e7605e66684dae1',
  originalExportSha256: 'e9926b9d6696b119c3122173b31508a24828acbcd359c9e1beb29d89df936932',
  predictionSha256: null,
  predictionDigestState: 'pending-target-session-universe' as const,
});

function asStats(value: unknown): IntroductionPriorStat[] {
  if (!Array.isArray(value)) throw new Error('Invalid frozen introduction prior stats');
  return value as IntroductionPriorStat[];
}

function assembleArtifact(
  meta: unknown,
  titleParts: unknown[],
  textStats: unknown,
): SerializedIntroductionPriorModelV4 {
  return {
    ...(meta as Omit<SerializedIntroductionPriorModelV4, 'titleStats' | 'textStats'>),
    titleStats: titleParts.flatMap(asStats),
    textStats: asStats(textStats),
  };
}

export const FROZEN_INTRODUCTION_PRIOR_ARTIFACT: SerializedIntroductionPriorModelV4 = assembleArtifact(
  meta2025,
  [titleStats2025Part1, titleStats2025Part2, titleStats2025Part3],
  textStats2025,
);

export const FROZEN_INTRODUCTION_PRIOR_ARTIFACT_2027_2028: SerializedIntroductionPriorModelV4 = assembleArtifact(
  meta2027,
  [titleStats2027Part1, titleStats2027Part2, titleStats2027Part3, titleStats2027Part4],
  textStats2027,
);

const FROZEN_INTRODUCTION_ARTIFACTS = Object.freeze({
  '2025-2026': {
    artifact: FROZEN_INTRODUCTION_PRIOR_ARTIFACT,
    runtimeAssembledSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.runtimeAssembledArtifactSha256,
    originalMinifiedSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.originalMinifiedArtifactSha256,
    originalExportSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.originalExportSha256,
    predictionSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.predictionSha256,
  },
  '2027-2028': {
    artifact: FROZEN_INTRODUCTION_PRIOR_ARTIFACT_2027_2028,
    runtimeAssembledSha256: INTRODUCTION_PRIOR_2027_SERVING_PROVENANCE.runtimeAssembledArtifactSha256,
    originalMinifiedSha256: INTRODUCTION_PRIOR_2027_SERVING_PROVENANCE.runtimeAssembledArtifactSha256,
    originalExportSha256: INTRODUCTION_PRIOR_2027_SERVING_PROVENANCE.originalExportSha256,
    predictionSha256: null,
  },
});

function verifyFrozenArtifact(
  artifact: SerializedIntroductionPriorModelV4,
  expectedRuntimeSha256: string,
): void {
  if (artifact.model !== INTRODUCTION_PRIOR_MODEL_VERSION) {
    throw new Error(`Unexpected introduction prior model ${artifact.model}`);
  }
  const sha256 = createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
  if (sha256 !== expectedRuntimeSha256) {
    throw new Error(`Frozen introduction prior artifact hash mismatch for ${artifact.targetSessionSlug}: ${sha256}`);
  }
}

verifyFrozenArtifact(
  FROZEN_INTRODUCTION_PRIOR_ARTIFACT,
  INTRODUCTION_PRIOR_SERVING_PROVENANCE.runtimeAssembledArtifactSha256,
);
verifyFrozenArtifact(
  FROZEN_INTRODUCTION_PRIOR_ARTIFACT_2027_2028,
  INTRODUCTION_PRIOR_2027_SERVING_PROVENANCE.runtimeAssembledArtifactSha256,
);

export interface ForecastIntroductionPrior {
  targetKind: 'source_chamber_passage';
  modelVersion: typeof INTRODUCTION_PRIOR_MODEL_VERSION;
  probability: number;
  introducedOn: string;
  originatingChamber: 'house' | 'senate';
  inputMode: 'title+purpose-text' | 'title-only-fallback';
  artifact: {
    targetSessionSlug: string;
    trainedThroughSessionSlug: string;
    trainingRows: number;
    trainingPositives: number;
    evaluationCommit: string;
    generatedAt: string;
    runtimeAssembledSha256: string;
    originalMinifiedSha256: string;
    originalExportSha256: string;
    predictionSha256: string | null;
  };
}

export interface IntroductionPriorBillRow {
  session_slug: string;
  session_start: string;
  originating_chamber: 'house' | 'senate';
  title: string;
  introduced_on: string | null;
  model_eligible: string | null;
  raw_text: string | null;
  text_hash: string | null;
  in_authoritative_universe: boolean;
}

export function frozenIntroductionArtifactForSession(sessionSlug: string): SerializedIntroductionPriorModelV4 | undefined {
  return FROZEN_INTRODUCTION_ARTIFACTS[sessionSlug as keyof typeof FROZEN_INTRODUCTION_ARTIFACTS]?.artifact;
}

export function scoreIntroductionPriorRow(row: IntroductionPriorBillRow): ForecastIntroductionPrior | undefined {
  const frozen = FROZEN_INTRODUCTION_ARTIFACTS[row.session_slug as keyof typeof FROZEN_INTRODUCTION_ARTIFACTS];
  if (!frozen) return undefined;
  const artifact = frozen.artifact;
  if (!row.in_authoritative_universe || !row.introduced_on) return undefined;
  if (row.model_eligible !== 'true' && row.model_eligible !== 'false') return undefined;
  if (row.model_eligible === 'true' && (!row.raw_text || !row.text_hash)) return undefined;

  const probability = predictIntroductionPriorFromArtifact(artifact, {
    sessionSlug: row.session_slug,
    sessionStart: row.session_start,
    title: row.title,
    initialText: row.model_eligible === 'true' ? row.raw_text : null,
    initialTextAvailableAtIntroduction: row.model_eligible === 'true',
  });
  if (probability === undefined) return undefined;

  return {
    targetKind: 'source_chamber_passage',
    modelVersion: INTRODUCTION_PRIOR_MODEL_VERSION,
    probability,
    introducedOn: row.introduced_on,
    originatingChamber: row.originating_chamber,
    inputMode: row.model_eligible === 'true' ? 'title+purpose-text' : 'title-only-fallback',
    artifact: {
      targetSessionSlug: artifact.targetSessionSlug,
      trainedThroughSessionSlug: artifact.trainedThroughSessionSlug,
      trainingRows: artifact.trainingRows,
      trainingPositives: artifact.trainingPositives,
      evaluationCommit: artifact.provenance.evaluationCommit,
      generatedAt: artifact.provenance.generatedAt,
      runtimeAssembledSha256: frozen.runtimeAssembledSha256,
      originalMinifiedSha256: frozen.originalMinifiedSha256,
      originalExportSha256: frozen.originalExportSha256,
      predictionSha256: frozen.predictionSha256,
    },
  };
}

export async function loadIntroductionPriorForBill(billId: string): Promise<ForecastIntroductionPrior | undefined> {
  const result = await pool.query<IntroductionPriorBillRow>(`
    SELECT s.slug AS session_slug,
           s.starts_on::text AS session_start,
           c.slug AS originating_chamber,
           COALESCE(b.title, '') AS title,
           COALESCE(b.metadata #>> '{revisorIntroduction,introducedOn}', b.introduced_at::date::text) AS introduced_on,
           b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
           bv.raw_text,
           bv.text_hash,
           (b.metadata ? 'revisorUniverse') AS in_authoritative_universe
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house','senate')
      LEFT JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.id = $1
     LIMIT 1`, [billId]);
  const row = result.rows[0];
  return row ? scoreIntroductionPriorRow(row) : undefined;
}
