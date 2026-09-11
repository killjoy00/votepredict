import {
  scoreStagePredictions,
  stageBaseRatePredictions,
  type BillStageObservation,
  type BillStagePrediction,
} from './stages';
import {
  evaluateIntroductionStructuralModelChronologically,
  evaluateIntroductionTitleModelChronologically,
  type IntroductionObservation,
} from './introduction-model';
import {
  evaluateIntroductionTimingModelChronologically,
  type IntroductionTimingObservation,
} from './introduction-timing-model';
import type { ForecastTargetKind } from '../forecasting/targets';

type Queryable = {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

type Row = {
  bill_id: string;
  session_slug: string;
  session_start: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  title: string;
  introduced_on: string | null;
  initial_document_on: string | null;
  introduction_parser_version: string | null;
  initial_document_model_eligible: string | null;
  target_kind: ForecastTargetKind;
  outcome: boolean;
};

function scoreBySession(predictions: readonly BillStagePrediction[], observations: readonly Row[]) {
  const sessionByBill = new Map(observations.map((row) => [row.bill_id, row.session_slug]));
  return Object.fromEntries(
    [...new Set(observations.map((row) => row.session_slug))].sort().map((session) => [
      session,
      scoreStagePredictions(predictions.filter((row) => sessionByBill.get(row.billId) === session)),
    ]),
  );
}

function chamberBaseRatePredictions(observations: readonly BillStageObservation[], rows: readonly Row[], fallback = 0.5): BillStagePrediction[] {
  const chamberByBill = new Map(rows.map((row) => [row.bill_id, row.chamber_slug]));
  const ordered = [...observations].sort((a, b) => a.asOf.localeCompare(b.asOf) || a.billId.localeCompare(b.billId));
  const history = new Map<'house' | 'senate', { positives: number; total: number }>();
  const predictions: BillStagePrediction[] = [];
  let offset = 0;
  while (offset < ordered.length) {
    const asOf = ordered[offset].asOf;
    let end = offset;
    while (end < ordered.length && ordered[end].asOf === asOf) end += 1;
    const group = ordered.slice(offset, end);
    for (const observation of group) {
      const chamber = chamberByBill.get(observation.billId);
      if (!chamber) throw new Error(`Missing chamber for ${observation.billId}`);
      const prior = history.get(chamber);
      predictions.push({
        ...observation,
        model: 'stage-chamber-base-rate',
        probability: prior?.total ? prior.positives / prior.total : fallback,
      });
    }
    for (const observation of group) {
      const chamber = chamberByBill.get(observation.billId);
      if (!chamber) throw new Error(`Missing chamber for ${observation.billId}`);
      const prior = history.get(chamber) ?? { positives: 0, total: 0 };
      prior.positives += observation.outcome;
      prior.total += 1;
      history.set(chamber, prior);
    }
    offset = end;
  }
  return predictions;
}

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

export async function evaluateAuthoritativeFullUniverse(database: Queryable, codeSha: string | null = null) {
  const result = await database.query<Row>(`
    SELECT b.id::text AS bill_id,
           s.slug AS session_slug,
           s.starts_on::text AS session_start,
           c.slug AS chamber_slug,
           b.identifier,
           COALESCE(b.title, '') AS title,
           (b.metadata #>> '{revisorIntroduction,introducedOn}')::text AS introduced_on,
           (b.metadata #>> '{revisorIntroduction,initialDocument,insertedOn}')::text AS initial_document_on,
           (b.metadata #>> '{revisorIntroduction,parserVersion}')::text AS introduction_parser_version,
           (b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}')::text AS initial_document_model_eligible,
           'source_chamber_passage'::text AS target_kind,
           (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
     WHERE b.metadata ? 'revisorUniverse'
       AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true', 'false')
       AND b.metadata #>> '{sourceChamberPassage,targetStage}' = 'source_chamber_passage'
     ORDER BY s.starts_on, c.slug, b.identifier`);

  const observations: BillStageObservation[] = result.rows.map((row) => ({
    billId: row.bill_id,
    asOf: `${row.session_start}T00:00:00Z`,
    targetKind: row.target_kind,
    outcome: row.outcome ? 1 : 0,
  }));
  if (observations.length === 0) throw new Error('No authoritative full-universe source-chamber passage labels are available');

  const introductionObservations: IntroductionObservation[] = result.rows.map((row) => ({
    billId: row.bill_id,
    sessionSlug: row.session_slug,
    sessionStart: row.session_start,
    chamber: row.chamber_slug,
    title: row.title,
    billNumber: parseBillNumber(row.identifier),
    outcome: row.outcome ? 1 : 0,
  }));

  const timingRows = result.rows.filter((row) =>
    row.introduction_parser_version === 'revisor-introduction-v1'
    && row.initial_document_model_eligible === 'true'
    && row.introduced_on !== null
    && row.initial_document_on !== null,
  );
  if (timingRows.length !== result.rows.length) {
    throw new Error(`Exact introduction timing coverage is incomplete: ${timingRows.length}/${result.rows.length}`);
  }
  const timingObservations: IntroductionTimingObservation[] = timingRows.map((row) => ({
    billId: row.bill_id,
    sessionSlug: row.session_slug,
    sessionStart: row.session_start,
    chamber: row.chamber_slug,
    title: row.title,
    billNumber: parseBillNumber(row.identifier),
    introducedOn: row.introduced_on!,
    initialDocumentOn: row.initial_document_on!,
    outcome: row.outcome ? 1 : 0,
  }));

  const overallBaseRate = stageBaseRatePredictions(observations);
  const chamberBaseRate = chamberBaseRatePredictions(observations, result.rows);
  const introductionTitleModel = evaluateIntroductionTitleModelChronologically(introductionObservations);
  const introductionStructuralModel = evaluateIntroductionStructuralModelChronologically(introductionObservations);
  const introductionTimingModel = evaluateIntroductionTimingModelChronologically(timingObservations);
  const baselinePredictions = [...overallBaseRate, ...chamberBaseRate];
  const candidatePredictions = [...introductionTitleModel, ...introductionStructuralModel, ...introductionTimingModel];
  const orderedSessions = [...new Set(result.rows.map((row) => row.session_slug))].sort();
  const firstSession = orderedSessions[0];
  const sessionByBill = new Map(result.rows.map((row) => [row.bill_id, row.session_slug]));
  const holdoutBaselines = baselinePredictions.filter((prediction) => sessionByBill.get(prediction.billId) !== firstSession);
  const holdoutPredictions = [...holdoutBaselines, ...candidatePredictions];

  const counts = result.rows.reduce<Record<string, { bills: number; passed: number; failed: number; rate: number }>>((acc, row) => {
    const key = `${row.session_slug}/${row.chamber_slug}`;
    const bucket = acc[key] ?? { bills: 0, passed: 0, failed: 0, rate: 0 };
    bucket.bills += 1;
    if (row.outcome) bucket.passed += 1;
    else bucket.failed += 1;
    bucket.rate = bucket.passed / bucket.bills;
    acc[key] = bucket;
    return acc;
  }, {});

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      codeSha,
      target: 'Unconditional originating-chamber passage among the complete official regular-session introduced-bill universe.',
      labelVersion: 'revisor-source-chamber-passage-v1',
      introductionMetadataVersion: 'revisor-introduction-v1',
      predictionTiming: 'Biennium-forward evaluation. Each holdout biennium is predicted using only earlier biennia; v3 features are fixed from facts demonstrably known by each bill introduction.',
      holdoutDefinition: `Metrics under holdout exclude the cold-start ${firstSession} cohort; later sessions use only prior-session history. The 2023-24 and 2025-26 cohorts are now development holdouts, not untouched blind data.`,
      candidates: [
        'intro-title-eb-v1: title unigram empirical-Bayes model retained as the exploratory champion.',
        'intro-structural-eb-v2: title n-grams plus weak structural proxies; retained as a rejected comparison.',
        'intro-title-timing-eb-v3: v1 title probability plus strongly shrunk first/second legislative-year, year-month, and initial-document lead-time effects from exact official introduction metadata.',
      ],
      caveat: 'No current author or companion state is model eligible. Initial bill text is not used until the exact zero-engrossment versions are separately fetched and provenance-verified. No candidate in this evaluator changes production forecasts.',
    },
    observations: observations.length,
    timingCoverage: timingRows.length,
    counts,
    allSessions: scoreStagePredictions(baselinePredictions),
    holdout: scoreStagePredictions(holdoutPredictions),
    bySession: scoreBySession([...baselinePredictions, ...candidatePredictions], result.rows),
  };
}
