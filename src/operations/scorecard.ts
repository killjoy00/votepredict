import { pool } from '@/lib/db';

export class ScorecardError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'INVALID_OUTCOME', message: string) {
    super(message);
  }
}

type CandidateVoteRow = {
  id: string;
  occurred_on: string;
  yea_count: number;
  nay_count: number;
  passed: boolean | null;
  motion_text: string;
  external_key: string;
};

type ResolutionRow = {
  forecast_id: string;
  target_label: string;
  chamber_name: string;
  vote_event_id: string;
  occurred_on: string;
  yea_count: number;
  nay_count: number;
  passed: boolean | null;
  resolved_at: string;
};

export type ForecastOutcomeCandidate = {
  id: string;
  occurredOn: string;
  yeaCount: number;
  nayCount: number;
  passed: boolean | null;
  motionText: string;
  externalKey: string;
};

export type ScorecardRevision = {
  forecastId: string;
  targetLabel: string;
  chamberName: string;
  revisionId: string;
  revisionNumber: number;
  researchMode: 'quick' | 'deep';
  modelVersion?: string;
  generatedAt?: string;
  actualOccurredOn: string;
  actualPassed: boolean | null;
  actualYes: number;
  passageProbability?: number;
  passageBrier?: number;
  expectedYes?: number;
  yesAbsoluteError?: number;
  yesLow?: number;
  yesHigh?: number;
  rangeContainsActual?: boolean;
  memberResolved: number;
  memberCannotPredict: number;
  memberAccuracy?: number;
  memberBrier?: number;
  memberLogLoss?: number;
};

export type ProductionScorecard = {
  resolvedForecasts: number;
  scoredRevisions: number;
  aggregate: {
    passageBrier?: number;
    expectedYesMae?: number;
    rangeCoverage?: number;
    memberAccuracy?: number;
    memberBrier?: number;
    memberLogLoss?: number;
    memberResolved: number;
    memberCannotPredict: number;
  };
  revisions: ScorecardRevision[];
};

function finite(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clipProbability(probability: number): number {
  return Math.min(1 - 1e-9, Math.max(1e-9, probability));
}

export async function listOutcomeCandidates(forecastId: string, ownerUserId: string): Promise<ForecastOutcomeCandidate[]> {
  const result = await pool.query<CandidateVoteRow>(`
    SELECT ve.id,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed,
           ve.motion_text,
           ve.external_key
      FROM forecasts f
      JOIN vote_events ve
        ON ve.bill_id = f.bill_id
       AND ve.chamber_id = f.target_chamber_id
       AND ve.is_passage = true
     WHERE f.id = $1
       AND f.owner_user_id = $2
       AND f.target_type = 'bill'
     ORDER BY ve.occurred_on DESC, ve.id DESC`, [forecastId, ownerUserId]);
  return result.rows.map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    yeaCount: Number(row.yea_count),
    nayCount: Number(row.nay_count),
    passed: row.passed,
    motionText: row.motion_text,
    externalKey: row.external_key,
  }));
}

export async function resolveForecastOutcome(input: {
  forecastId: string;
  ownerUserId: string;
  voteEventId: string;
}): Promise<void> {
  const validResult = await pool.query<{ forecast_id: string }>(`
    SELECT f.id AS forecast_id
      FROM forecasts f
      JOIN vote_events ve
        ON ve.id = $3
       AND ve.bill_id = f.bill_id
       AND ve.chamber_id = f.target_chamber_id
       AND ve.is_passage = true
     WHERE f.id = $1
       AND f.owner_user_id = $2
       AND f.target_type = 'bill'
     LIMIT 1`, [input.forecastId, input.ownerUserId, input.voteEventId]);
  if (!validResult.rows[0]) {
    throw new ScorecardError('INVALID_OUTCOME', 'The selected official passage vote does not match this forecast bill and chamber.');
  }
  await pool.query(`
    INSERT INTO forecast_resolutions (forecast_id, vote_event_id, metadata)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (forecast_id) DO UPDATE SET
      vote_event_id = EXCLUDED.vote_event_id,
      resolved_at = now(),
      metadata = forecast_resolutions.metadata || EXCLUDED.metadata`, [
    input.forecastId,
    input.voteEventId,
    JSON.stringify({ resolutionSource: 'owner_selected_official_passage_vote' }),
  ]);
}

async function resolvedForecasts(ownerUserId: string): Promise<ResolutionRow[]> {
  const result = await pool.query<ResolutionRow>(`
    SELECT f.id AS forecast_id,
           concat(b.identifier, ' · ', b.title) AS target_label,
           c.name AS chamber_name,
           ve.id AS vote_event_id,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed,
           fr.resolved_at::text
      FROM forecast_resolutions fr
      JOIN forecasts f ON f.id = fr.forecast_id
      JOIN bills b ON b.id = f.bill_id
      JOIN chambers c ON c.id = f.target_chamber_id
      JOIN vote_events ve ON ve.id = fr.vote_event_id
     WHERE f.owner_user_id = $1
     ORDER BY ve.occurred_on DESC, fr.resolved_at DESC`, [ownerUserId]);
  return result.rows;
}

async function scoreRevision(resolution: ResolutionRow, revisionId: string): Promise<ScorecardRevision | null> {
  const revisionResult = await pool.query<{
    id: string;
    revision_number: number;
    research_mode: 'quick' | 'deep';
    model_version: string | null;
    generated_at: string | null;
    passage_probability: number | null;
    expected_yes: number | null;
    yes_low: number | null;
    yes_high: number | null;
  }>(`
    SELECT id, revision_number, research_mode, model_version, generated_at::text,
           passage_probability, expected_yes, yes_low, yes_high
      FROM forecast_revisions
     WHERE id = $1
       AND forecast_id = $2
     LIMIT 1`, [revisionId, resolution.forecast_id]);
  const revision = revisionResult.rows[0];
  if (!revision) return null;
  if (revision.generated_at && revision.generated_at.slice(0, 10) > resolution.occurred_on) return null;

  const actualPassed = resolution.passed;
  const actualYes = Number(resolution.yea_count);
  const passageProbability = finite(revision.passage_probability);
  const expectedYes = finite(revision.expected_yes);
  const yesLow = finite(revision.yes_low);
  const yesHigh = finite(revision.yes_high);
  const passageBrier = passageProbability !== undefined && actualPassed !== null
    ? (passageProbability - (actualPassed ? 1 : 0)) ** 2
    : undefined;

  const memberResult = await pool.query<{
    yes_probability: number | null;
    actual_choice: string | null;
  }>(`
    SELECT p.yes_probability,
           mv.choice AS actual_choice
      FROM forecast_member_predictions p
      LEFT JOIN member_votes mv
        ON mv.vote_event_id = $2
       AND mv.membership_id = p.membership_id
     WHERE p.revision_id = $1`, [revision.id, resolution.vote_event_id]);

  let memberCannotPredict = 0;
  let memberCorrect = 0;
  const memberBriers: number[] = [];
  const memberLogLosses: number[] = [];
  for (const row of memberResult.rows) {
    const probability = finite(row.yes_probability);
    if (probability === undefined || (row.actual_choice !== 'yea' && row.actual_choice !== 'nay')) {
      memberCannotPredict += 1;
      continue;
    }
    const actual = row.actual_choice === 'yea' ? 1 : 0;
    if ((probability >= 0.5 ? 1 : 0) === actual) memberCorrect += 1;
    memberBriers.push((probability - actual) ** 2);
    const clipped = clipProbability(probability);
    memberLogLosses.push(-(actual * Math.log(clipped) + (1 - actual) * Math.log(1 - clipped)));
  }
  const memberResolved = memberBriers.length;

  return {
    forecastId: resolution.forecast_id,
    targetLabel: resolution.target_label,
    chamberName: resolution.chamber_name,
    revisionId: revision.id,
    revisionNumber: Number(revision.revision_number),
    researchMode: revision.research_mode,
    modelVersion: revision.model_version ?? undefined,
    generatedAt: revision.generated_at ?? undefined,
    actualOccurredOn: resolution.occurred_on,
    actualPassed,
    actualYes,
    passageProbability,
    passageBrier,
    expectedYes,
    yesAbsoluteError: expectedYes === undefined ? undefined : Math.abs(expectedYes - actualYes),
    yesLow,
    yesHigh,
    rangeContainsActual: yesLow === undefined || yesHigh === undefined ? undefined : actualYes >= yesLow && actualYes <= yesHigh,
    memberResolved,
    memberCannotPredict,
    memberAccuracy: memberResolved ? memberCorrect / memberResolved : undefined,
    memberBrier: mean(memberBriers),
    memberLogLoss: mean(memberLogLosses),
  };
}

export async function getProductionScorecard(ownerUserId: string): Promise<ProductionScorecard> {
  const resolutions = await resolvedForecasts(ownerUserId);
  const revisions: ScorecardRevision[] = [];
  for (const resolution of resolutions) {
    const revisionIdsResult = await pool.query<{ id: string }>(`
      SELECT id
        FROM forecast_revisions
       WHERE forecast_id = $1
         AND (generated_at IS NULL OR generated_at::date <= $2::date)
       ORDER BY revision_number`, [resolution.forecast_id, resolution.occurred_on]);
    for (const row of revisionIdsResult.rows) {
      const scored = await scoreRevision(resolution, row.id);
      if (scored) revisions.push(scored);
    }
  }

  const passageBriers = revisions.map((row) => row.passageBrier).filter((value): value is number => value !== undefined);
  const yesErrors = revisions.map((row) => row.yesAbsoluteError).filter((value): value is number => value !== undefined);
  const rangeCoverage = revisions.map((row) => row.rangeContainsActual).filter((value): value is boolean => value !== undefined).map((value) => value ? 1 : 0);
  const memberAccuracyWeighted: number[] = [];
  const memberBrierWeighted: number[] = [];
  const memberLogLossWeighted: number[] = [];
  let memberResolved = 0;
  let memberCannotPredict = 0;
  for (const row of revisions) {
    memberResolved += row.memberResolved;
    memberCannotPredict += row.memberCannotPredict;
    if (row.memberAccuracy !== undefined) memberAccuracyWeighted.push(...Array(row.memberResolved).fill(row.memberAccuracy));
    if (row.memberBrier !== undefined) memberBrierWeighted.push(...Array(row.memberResolved).fill(row.memberBrier));
    if (row.memberLogLoss !== undefined) memberLogLossWeighted.push(...Array(row.memberResolved).fill(row.memberLogLoss));
  }

  return {
    resolvedForecasts: resolutions.length,
    scoredRevisions: revisions.length,
    aggregate: {
      passageBrier: mean(passageBriers),
      expectedYesMae: mean(yesErrors),
      rangeCoverage: mean(rangeCoverage),
      memberAccuracy: mean(memberAccuracyWeighted),
      memberBrier: mean(memberBrierWeighted),
      memberLogLoss: mean(memberLogLossWeighted),
      memberResolved,
      memberCannotPredict,
    },
    revisions: revisions.sort((a, b) => b.actualOccurredOn.localeCompare(a.actualOccurredOn) || b.revisionNumber - a.revisionNumber),
  };
}
