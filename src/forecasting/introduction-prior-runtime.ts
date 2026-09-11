import { createHash } from 'node:crypto';
import meta from './generated/introduction-v4-2025-2026-meta.json';
import titleStats1 from './generated/introduction-v4-title-stats-1.json';
import titleStats2 from './generated/introduction-v4-title-stats-2.json';
import titleStats3 from './generated/introduction-v4-title-stats-3.json';
import textStats from './generated/introduction-v4-text-stats.json';
import {
  INTRODUCTION_PRIOR_MODEL_VERSION,
  predictIntroductionPriorFromArtifact,
  type IntroductionPriorStat,
  type SerializedIntroductionPriorModelV4,
} from './introduction-prior-model';
import { pool } from '@/lib/db';

const FROZEN_ARTIFACT_SHA256 = '646b428ce6a2192bc97c0cd5301fc5a9bac7c4866bf9a33c52b0a2d0d8a36e4d';
const ORIGINAL_EXPORT_SHA256 = 'a5731c809298e7b6d914259178c9fcafe45b8cba314fea4c4253d3bfb144ae84';
const PREDICTION_SHA256 = '56ef5169cca75b8586a4e2571bcb7745c33770c8a55d1723db9cdab97e9f3ca4';

function asStats(value: unknown): IntroductionPriorStat[] {
  if (!Array.isArray(value)) throw new Error('Invalid frozen introduction prior stats');
  return value as IntroductionPriorStat[];
}

export const FROZEN_INTRODUCTION_PRIOR_ARTIFACT: SerializedIntroductionPriorModelV4 = {
  ...(meta as Omit<SerializedIntroductionPriorModelV4, 'titleStats' | 'textStats'>),
  titleStats: [...asStats(titleStats1), ...asStats(titleStats2), ...asStats(titleStats3)],
  textStats: asStats(textStats),
};

function verifyFrozenArtifact(): void {
  const artifact = FROZEN_INTRODUCTION_PRIOR_ARTIFACT;
  if (artifact.model !== INTRODUCTION_PRIOR_MODEL_VERSION
    || artifact.targetSessionSlug !== '2025-2026'
    || artifact.targetSessionStart !== '2025-01-01'
    || artifact.trainedThroughSessionSlug !== '2023-2024'
    || artifact.trainingRows !== 20_538
    || artifact.trainingPositives !== 402
    || artifact.titleStats.length !== 1_175
    || artifact.textStats.length !== 306) {
    throw new Error('Frozen introduction prior artifact metadata failed integrity checks');
  }
  const sha256 = createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
  if (sha256 !== FROZEN_ARTIFACT_SHA256) {
    throw new Error(`Frozen introduction prior artifact hash mismatch: ${sha256}`);
  }
}

verifyFrozenArtifact();

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
    minifiedSha256: string;
    originalExportSha256: string;
    predictionSha256: string;
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

export function scoreIntroductionPriorRow(row: IntroductionPriorBillRow): ForecastIntroductionPrior | undefined {
  const artifact = FROZEN_INTRODUCTION_PRIOR_ARTIFACT;
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
      minifiedSha256: FROZEN_ARTIFACT_SHA256,
      originalExportSha256: ORIGINAL_EXPORT_SHA256,
      predictionSha256: PREDICTION_SHA256,
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
