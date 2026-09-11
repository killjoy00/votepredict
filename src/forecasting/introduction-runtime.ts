import { pool } from '@/lib/db';
import {
  predictIntroductionTextModel,
  trainIntroductionTextModel,
  type IntroductionTextModel,
  type IntroductionTextObservation,
} from '@/evaluation/introduction-text-model';

export const INTRODUCTION_MODEL_VERSION = 'intro-title-text-eb-v4' as const;

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
  };
};

type TargetRow = {
  bill_id: string;
  identifier: string;
  title: string;
  introduced_at: string | null;
  session_slug: string;
  session_start: string;
  chamber_id: string | null;
  chamber_slug: 'house' | 'senate' | null;
  chamber_name: string | null;
  initial_version_id: string | null;
  raw_text: string | null;
  text_model_eligible: string | null;
};

type TrainingRow = {
  bill_id: string;
  session_slug: string;
  session_start: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  title: string;
  raw_text: string | null;
  text_model_eligible: string | null;
  outcome: boolean;
};

type CachedModel = {
  model: IntroductionTextModel;
  trainingBills: number;
  trainingPasses: number;
  trainingSessions: string[];
};

const modelCache = new Map<string, Promise<CachedModel>>();

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

async function loadModelBefore(sessionStart: string): Promise<CachedModel> {
  const rows = await pool.query<TrainingRow>(`
    SELECT b.id::text AS bill_id,
           s.slug AS session_slug,
           s.starts_on::text AS session_start,
           c.slug AS chamber_slug,
           b.identifier,
           COALESCE(b.title, '') AS title,
           CASE
             WHEN b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' = 'true'
               THEN left(bv.raw_text, 8000)
             ELSE NULL
           END AS raw_text,
           b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS text_model_eligible,
           (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
      JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.metadata ? 'revisorUniverse'
       AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true', 'false')
       AND b.metadata #>> '{sourceChamberPassage,targetStage}' = 'source_chamber_passage'
       AND s.starts_on < $1::date
     ORDER BY s.starts_on, c.slug, b.identifier`, [sessionStart]);

  if (rows.rows.length === 0) {
    throw new Error(`No authoritative prior-biennium training data exists before ${sessionStart}.`);
  }

  const observations: IntroductionTextObservation[] = rows.rows.map((row) => ({
    billId: row.bill_id,
    sessionSlug: row.session_slug,
    sessionStart: row.session_start,
    chamber: row.chamber_slug,
    title: row.title,
    billNumber: parseBillNumber(row.identifier),
    outcome: row.outcome ? 1 : 0,
    initialText: row.text_model_eligible === 'true' ? row.raw_text : null,
    initialTextAvailableAtIntroduction: row.text_model_eligible === 'true',
  }));

  for (const row of observations) {
    if (row.initialTextAvailableAtIntroduction && !row.initialText) {
      throw new Error(`${row.billId}: authoritative introduction text is missing from the production training corpus.`);
    }
  }

  return {
    model: trainIntroductionTextModel(observations),
    trainingBills: observations.length,
    trainingPasses: observations.reduce((sum, row) => sum + row.outcome, 0),
    trainingSessions: [...new Set(observations.map((row) => row.sessionSlug))].sort(),
  };
}

function modelBefore(sessionStart: string): Promise<CachedModel> {
  let cached = modelCache.get(sessionStart);
  if (!cached) {
    cached = loadModelBefore(sessionStart).catch((error) => {
      modelCache.delete(sessionStart);
      throw error;
    });
    modelCache.set(sessionStart, cached);
  }
  return cached;
}

export async function forecastSourceChamberPassageAtIntroduction(billId: string): Promise<IntroductionStageForecast> {
  const result = await pool.query<TargetRow>(`
    SELECT b.id::text AS bill_id,
           b.identifier,
           COALESCE(b.title, '') AS title,
           b.introduced_at::text,
           s.slug AS session_slug,
           s.starts_on::text AS session_start,
           c.id::text AS chamber_id,
           c.slug AS chamber_slug,
           c.name AS chamber_name,
           bv.id::text AS initial_version_id,
           CASE
             WHEN b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' = 'true'
               THEN left(bv.raw_text, 8000)
             ELSE NULL
           END AS raw_text,
           b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS text_model_eligible
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      LEFT JOIN chambers c ON c.id = b.originating_chamber_id
      LEFT JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.id = $1::uuid
       AND b.metadata ? 'revisorUniverse'
     LIMIT 1`, [billId]);

  const row = result.rows[0];
  if (!row) throw new Error('The selected bill is not in the authoritative Minnesota introduction universe.');
  if (!row.introduced_at) throw new Error('The selected bill is missing its authoritative introduction date.');
  if (!row.chamber_id || !row.chamber_slug || !row.chamber_name) throw new Error('The selected bill is missing its originating chamber.');
  if (row.chamber_slug !== 'house' && row.chamber_slug !== 'senate') throw new Error('The originating chamber is unsupported.');
  if (!row.initial_version_id) throw new Error('The selected bill is missing its authoritative initial version.');

  const textAvailable = row.text_model_eligible === 'true';
  if (textAvailable && !row.raw_text) throw new Error('The selected bill is missing introduction-available initial text.');

  const cached = await modelBefore(row.session_start);
  const probability = predictIntroductionTextModel(cached.model, {
    title: row.title,
    initialText: textAvailable ? row.raw_text : null,
    initialTextAvailableAtIntroduction: textAvailable,
  });

  return {
    targetKind: 'source_chamber_passage',
    modelVersion: INTRODUCTION_MODEL_VERSION,
    probability,
    asOfIntroduction: row.introduced_at,
    bill: {
      id: row.bill_id,
      identifier: row.identifier,
      title: row.title,
    },
    sourceChamber: {
      id: row.chamber_id,
      slug: row.chamber_slug,
      name: row.chamber_name,
    },
    model: {
      trainingBills: cached.trainingBills,
      trainingPasses: cached.trainingPasses,
      historicalBaseRate: cached.model.baseRate,
      trainingSessions: cached.trainingSessions,
      initialTextAvailableAtIntroduction: textAvailable,
      purposeTextOnly: true,
    },
  };
}
