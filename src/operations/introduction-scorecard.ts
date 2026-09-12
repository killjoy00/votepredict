import { createHash } from 'node:crypto';
import {
  averagePrecision,
  brierScore,
  expectedCalibrationError,
  logLoss,
  rocAuc,
  type BinaryForecast,
} from '@/evaluation/metrics';
import {
  FROZEN_INTRODUCTION_PRIOR_ARTIFACT,
  INTRODUCTION_PRIOR_SERVING_PROVENANCE,
  scoreIntroductionPriorRow,
  type IntroductionPriorBillRow,
} from '@/forecasting/introduction-prior-runtime';
import { INTRODUCTION_PRIOR_MODEL_VERSION } from '@/forecasting/introduction-prior-model';
import { pool } from '@/lib/db';

type SourceRow = IntroductionPriorBillRow & {
  bill_id: string;
  identifier: string;
  outcome: boolean | null;
};

export type ScoredIntroductionRow = {
  billId: string;
  identifier: string;
  chamber: 'house' | 'senate';
  probability: number;
  outcome: 0 | 1 | null;
  inputMode: 'title+purpose-text' | 'title-only-fallback';
};

export type IntroductionScorecardMetrics = {
  bills: number;
  positives: number;
  observedRate?: number;
  meanProbability?: number;
  brier?: number;
  logLoss?: number;
  expectedCalibrationError?: number;
  averagePrecision?: number;
  rocAuc?: number;
};

export type IntroductionServingScorecard = {
  targetKind: 'source_chamber_passage';
  modelVersion: typeof INTRODUCTION_PRIOR_MODEL_VERSION;
  targetSession: string;
  trainedThroughSession: string;
  generatedAt: string;
  evidenceContext: {
    kind: 'promotion-holdout-replay';
    independentProductionEvidence: false;
    note: string;
  };
  corpus: {
    expectedBills: number;
    observedBills: number;
    scoredBills: number;
    labeledBills: number;
    unlabeledBills: number;
    textEligibleBills: number;
    titleOnlyFallbackBills: number;
    completenessVerified: boolean;
  };
  predictionIntegrity: {
    expectedSha256: string;
    observedSha256: string;
    verified: boolean;
  };
  metrics: IntroductionScorecardMetrics;
  byChamber: Record<'house' | 'senate', IntroductionScorecardMetrics>;
  provenance: {
    evaluationCommit: string;
    artifactGeneratedAt: string;
    runtimeAssembledArtifactSha256: string;
    originalMinifiedArtifactSha256: string;
    originalExportSha256: string;
    predictionSha256: string;
    trainingRows: number;
    trainingPositives: number;
  };
};

function finiteOrUndefined(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function metricsFor(rows: readonly ScoredIntroductionRow[]): IntroductionScorecardMetrics {
  const labeled = rows.filter((row): row is ScoredIntroductionRow & { outcome: 0 | 1 } => row.outcome !== null);
  const forecasts: BinaryForecast[] = labeled.map((row) => ({ probability: row.probability, outcome: row.outcome }));
  if (forecasts.length === 0) return { bills: 0, positives: 0 };
  const positives = forecasts.reduce((sum, row) => sum + row.outcome, 0);
  return {
    bills: forecasts.length,
    positives,
    observedRate: positives / forecasts.length,
    meanProbability: forecasts.reduce((sum, row) => sum + row.probability, 0) / forecasts.length,
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    expectedCalibrationError: expectedCalibrationError(forecasts),
    averagePrecision: finiteOrUndefined(averagePrecision(forecasts)),
    rocAuc: finiteOrUndefined(rocAuc(forecasts)),
  };
}

export function predictionDigest(rows: readonly ScoredIntroductionRow[]): string {
  const lines = rows.map((row) => `${row.billId}:${row.probability.toPrecision(17)}`);
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function summarizeIntroductionServingScorecard(rows: readonly ScoredIntroductionRow[]): IntroductionServingScorecard {
  const artifact = FROZEN_INTRODUCTION_PRIOR_ARTIFACT;
  const observedSha256 = predictionDigest(rows);
  const labeledBills = rows.filter((row) => row.outcome !== null).length;
  const textEligibleBills = rows.filter((row) => row.inputMode === 'title+purpose-text').length;
  const titleOnlyFallbackBills = rows.filter((row) => row.inputMode === 'title-only-fallback').length;
  const completenessVerified = rows.length === INTRODUCTION_PRIOR_SERVING_PROVENANCE.expectedTargetRows
    && textEligibleBills === INTRODUCTION_PRIOR_SERVING_PROVENANCE.expectedTextEligibleRows
    && titleOnlyFallbackBills === INTRODUCTION_PRIOR_SERVING_PROVENANCE.expectedTitleOnlyFallbackRows;

  return {
    targetKind: 'source_chamber_passage',
    modelVersion: INTRODUCTION_PRIOR_MODEL_VERSION,
    targetSession: artifact.targetSessionSlug,
    trainedThroughSession: artifact.trainedThroughSessionSlug,
    generatedAt: new Date().toISOString(),
    evidenceContext: {
      kind: 'promotion-holdout-replay',
      independentProductionEvidence: false,
      note: 'The 2025-26 outcomes were part of the locked chronological promotion evaluation. This scorecard verifies frozen serving parity and resolved-session performance; it is not a new independent test set.',
    },
    corpus: {
      expectedBills: INTRODUCTION_PRIOR_SERVING_PROVENANCE.expectedTargetRows,
      observedBills: rows.length,
      scoredBills: rows.length,
      labeledBills,
      unlabeledBills: rows.length - labeledBills,
      textEligibleBills,
      titleOnlyFallbackBills,
      completenessVerified,
    },
    predictionIntegrity: {
      expectedSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.predictionSha256,
      observedSha256,
      verified: observedSha256 === INTRODUCTION_PRIOR_SERVING_PROVENANCE.predictionSha256,
    },
    metrics: metricsFor(rows),
    byChamber: {
      house: metricsFor(rows.filter((row) => row.chamber === 'house')),
      senate: metricsFor(rows.filter((row) => row.chamber === 'senate')),
    },
    provenance: {
      evaluationCommit: artifact.provenance.evaluationCommit,
      artifactGeneratedAt: artifact.provenance.generatedAt,
      runtimeAssembledArtifactSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.runtimeAssembledArtifactSha256,
      originalMinifiedArtifactSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.originalMinifiedArtifactSha256,
      originalExportSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.originalExportSha256,
      predictionSha256: INTRODUCTION_PRIOR_SERVING_PROVENANCE.predictionSha256,
      trainingRows: artifact.trainingRows,
      trainingPositives: artifact.trainingPositives,
    },
  };
}

export async function getIntroductionServingScorecard(): Promise<IntroductionServingScorecard> {
  const artifact = FROZEN_INTRODUCTION_PRIOR_ARTIFACT;
  const result = await pool.query<SourceRow>(`
    SELECT b.id::text AS bill_id,
           b.identifier,
           s.slug AS session_slug,
           s.starts_on::text AS session_start,
           c.slug AS originating_chamber,
           COALESCE(b.title, '') AS title,
           COALESCE(b.metadata #>> '{revisorIntroduction,introducedOn}', b.introduced_at::date::text) AS introduced_on,
           b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
           CASE
             WHEN b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' = 'true'
             THEN left(bv.raw_text, $2)
             ELSE NULL
           END AS raw_text,
           bv.text_hash,
           true AS in_authoritative_universe,
           CASE b.metadata #>> '{sourceChamberPassage,outcome}'
             WHEN 'true' THEN true
             WHEN 'false' THEN false
             ELSE NULL
           END AS outcome
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house','senate')
      LEFT JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.metadata ? 'revisorUniverse'
       AND s.slug = $1
     ORDER BY c.slug, b.identifier`, [artifact.targetSessionSlug, artifact.textOptions.preambleMaxChars]);

  const scored: ScoredIntroductionRow[] = [];
  for (const row of result.rows) {
    const prediction = scoreIntroductionPriorRow(row);
    if (!prediction) {
      throw new Error(`${row.identifier}: frozen introduction serving scorecard could not reproduce the prediction`);
    }
    scored.push({
      billId: row.bill_id,
      identifier: row.identifier,
      chamber: row.originating_chamber,
      probability: prediction.probability,
      outcome: row.outcome === null ? null : row.outcome ? 1 : 0,
      inputMode: prediction.inputMode,
    });
  }

  const scorecard = summarizeIntroductionServingScorecard(scored);
  if (!scorecard.corpus.completenessVerified) {
    throw new Error(`Frozen introduction corpus drift: expected ${scorecard.corpus.expectedBills} bills with ${INTRODUCTION_PRIOR_SERVING_PROVENANCE.expectedTextEligibleRows} text-eligible and ${INTRODUCTION_PRIOR_SERVING_PROVENANCE.expectedTitleOnlyFallbackRows} title-only; observed ${scorecard.corpus.observedBills}, ${scorecard.corpus.textEligibleBills}, and ${scorecard.corpus.titleOnlyFallbackBills}`);
  }
  if (!scorecard.predictionIntegrity.verified) {
    throw new Error(`Frozen introduction prediction digest mismatch: ${scorecard.predictionIntegrity.observedSha256}`);
  }
  return scorecard;
}
