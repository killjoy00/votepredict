import { pool } from '@/lib/db';
import {
  FROZEN_INTRODUCTION_PRIOR_ARTIFACT,
  scoreIntroductionPriorRow,
  type IntroductionPriorBillRow,
} from '@/forecasting/introduction-prior-runtime';
import { INTRODUCTION_PRIOR_MODEL_VERSION } from '@/forecasting/introduction-prior-model';

export const INTRODUCTION_MODEL_VERSION = INTRODUCTION_PRIOR_MODEL_VERSION;

export type IntroductionStageForecast = {
  targetKind: 'source_chamber_passage';
  modelVersion: typeof INTRODUCTION_MODEL_VERSION;
  probability: number;
  asOfIntroduction: string;
  bill: {
    id: string;
    identifier: string;
    title: string;
  };
  sourceChamber: {
    id: string;
    slug: 'house' | 'senate';
    name: string;
  };
  model: {
    trainingBills: number;
    trainingPasses: number;
    historicalBaseRate: number;
    trainingSessions: string[];
    initialTextAvailableAtIntroduction: boolean;
    purposeTextOnly: true;
    frozen: true;
    trainedThroughSession: string;
  };
};

type TargetRow = IntroductionPriorBillRow & {
  bill_id: string;
  identifier: string;
  chamber_id: string | null;
  chamber_name: string | null;
  initial_version_id: string | null;
};

export async function forecastSourceChamberPassageAtIntroduction(billId: string): Promise<IntroductionStageForecast> {
  const result = await pool.query<TargetRow>(`
    SELECT b.id::text AS bill_id,
           b.identifier,
           COALESCE(b.title, '') AS title,
           COALESCE(b.metadata #>> '{revisorIntroduction,introducedOn}', b.introduced_at::date::text) AS introduced_on,
           s.slug AS session_slug,
           s.starts_on::text AS session_start,
           c.id::text AS chamber_id,
           c.slug AS originating_chamber,
           c.name AS chamber_name,
           bv.id::text AS initial_version_id,
           b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
           bv.raw_text,
           bv.text_hash,
           (b.metadata ? 'revisorUniverse') AS in_authoritative_universe
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      LEFT JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
      LEFT JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.id = $1::uuid
       AND b.metadata ? 'revisorUniverse'
     LIMIT 1`, [billId]);

  const row = result.rows[0];
  if (!row) throw new Error('The selected bill is not in the authoritative Minnesota introduction universe.');
  if (!row.introduced_on) throw new Error('The selected bill is missing its authoritative introduction date.');
  if (!row.chamber_id || !row.originating_chamber || !row.chamber_name) throw new Error('The selected bill is missing its originating chamber.');
  if (!row.initial_version_id) throw new Error('The selected bill is missing its authoritative initial version.');
  if (row.model_eligible === 'true' && (!row.raw_text || !row.text_hash)) {
    throw new Error('The selected bill is missing introduction-available initial text or its authoritative hash.');
  }

  const prior = scoreIntroductionPriorRow(row);
  if (!prior) {
    throw new Error(`No frozen introduction model is available for Minnesota session ${row.session_slug}.`);
  }

  const artifact = FROZEN_INTRODUCTION_PRIOR_ARTIFACT;
  return {
    targetKind: 'source_chamber_passage',
    modelVersion: INTRODUCTION_MODEL_VERSION,
    probability: prior.probability,
    asOfIntroduction: row.introduced_on,
    bill: {
      id: row.bill_id,
      identifier: row.identifier,
      title: row.title,
    },
    sourceChamber: {
      id: row.chamber_id,
      slug: row.originating_chamber,
      name: row.chamber_name,
    },
    model: {
      trainingBills: artifact.trainingRows,
      trainingPasses: artifact.trainingPositives,
      historicalBaseRate: artifact.baseRate,
      trainingSessions: artifact.trainingSessions,
      initialTextAvailableAtIntroduction: prior.inputMode === 'title+purpose-text',
      purposeTextOnly: true,
      frozen: true,
      trainedThroughSession: artifact.trainedThroughSessionSlug,
    },
  };
}
