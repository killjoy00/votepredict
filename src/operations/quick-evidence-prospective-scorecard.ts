import type { Pool } from 'pg';
import { simulateChamber, type PassageRule } from '@/forecasting/chamber';
import {
  QUICK_EVIDENCE_BASE_MODEL_VERSION,
  QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
  QUICK_EVIDENCE_PROSPECTIVE_SESSION,
} from '@/forecasting/quick-evidence-shadow';
import { PROSPECTIVE_EVIDENCE_OWNER_USER_ID } from './prospective-evidence-plan';
import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from '@/evaluation/metrics';

export const QUICK_EVIDENCE_PROSPECTIVE_SCORECARD_SCHEMA =
  'quick-evidence-prospective-scorecard-v1' as const;

const MIN_RESOLVED_FORECASTS = 40;
const MIN_MEMBER_OUTCOMES = 2000;
const MIN_DIRECTIONAL_MEMBERS = 50;

type Queryable = Pick<Pool, 'query'>;

type RevisionRow = {
  forecast_id: string;
  identifier: string;
  chamber_slug: 'house' | 'senate';
  vote_event_id: string;
  occurred_on: string;
  actual_passed: boolean | null;
  actual_yes: number;
  revision_id: string | null;
  revision_number: number | null;
  generated_at: string | null;
  model_version: string | null;
  metadata: Record<string, unknown> | null;
  serving_passage_probability: number | null;
  serving_expected_yes: number | null;
};

type MemberRow = {
  revision_id: string;
  membership_id: string;
  serving_probability: number | null;
  actual_choice: 'yea' | 'nay' | null;
  shadow: Record<string, unknown> | null;
};

export type QuickEvidenceScoreExclusionReason =
  | 'no_strictly_prevote_quick_revision'
  | 'serving_model_mismatch'
  | 'missing_member_predictions'
  | 'missing_quick_evidence_shadow'
  | 'invalid_shadow_probability'
  | 'base_probability_lineage_mismatch'
  | 'unsupported_passage_rule';

export interface QuickEvidenceProspectiveCaseMember {
  membershipId: string;
  servingProbability: number;
  candidateProbability: number;
  outcome?: 0 | 1;
  directionalEvidenceItems: number;
}

export interface QuickEvidenceProspectiveCase {
  forecastId: string;
  identifier: string;
  chamber: 'house' | 'senate';
  voteEventId: string;
  occurredOn: string;
  actualPassed: boolean | null;
  actualYes: number;
  revisionId: string;
  revisionNumber: number;
  generatedAt: string;
  passageRule: PassageRule;
  servingPassageProbability?: number;
  servingExpectedYes?: number;
  members: QuickEvidenceProspectiveCaseMember[];
}

interface ProbabilityOutcome {
  probability: number;
  outcome: 0 | 1;
}

function finiteProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function passageRuleFromMetadata(metadata: Record<string, unknown> | null): PassageRule {
  const value = metadata?.passageRule;
  if (!value || typeof value !== 'object') throw new Error('missing passageRule');
  const rule = value as Record<string, unknown>;
  if (rule.kind === 'majority-of-cast') return { kind: 'majority-of-cast' };
  if (rule.kind === 'absolute-majority' && Number.isInteger(rule.seats)) {
    return { kind: 'absolute-majority', seats: rule.seats as number };
  }
  if (rule.kind === 'fixed' && Number.isInteger(rule.requiredYes)) {
    return { kind: 'fixed', requiredYes: rule.requiredYes as number };
  }
  if (
    rule.kind === 'fraction-of-seats'
    && Number.isInteger(rule.seats)
    && Number.isInteger(rule.numerator)
    && Number.isInteger(rule.denominator)
  ) {
    return {
      kind: 'fraction-of-seats',
      seats: rule.seats as number,
      numerator: rule.numerator as number,
      denominator: rule.denominator as number,
    };
  }
  throw new Error('unsupported passageRule');
}

function memberMetric(pairs: readonly ProbabilityOutcome[]) {
  if (pairs.length === 0) return null;
  return {
    observations: pairs.length,
    brier: brierScore(pairs),
    logLoss: logLoss(pairs),
    accuracy: binaryAccuracy(pairs),
    expectedCalibrationError: expectedCalibrationError(pairs),
  };
}

function metricDelta(
  candidate: ReturnType<typeof memberMetric>,
  serving: ReturnType<typeof memberMetric>,
) {
  if (!candidate || !serving) return null;
  return {
    brier: candidate.brier - serving.brier,
    logLoss: candidate.logLoss - serving.logLoss,
    accuracy: candidate.accuracy - serving.accuracy,
    expectedCalibrationError:
      candidate.expectedCalibrationError - serving.expectedCalibrationError,
  };
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function passageBrier(probability: number, actual: boolean): number {
  return (probability - (actual ? 1 : 0)) ** 2;
}

function scoreCases(cases: readonly QuickEvidenceProspectiveCase[]) {
  const servingPairs: ProbabilityOutcome[] = [];
  const candidatePairs: ProbabilityOutcome[] = [];
  const servingMovedPairs: ProbabilityOutcome[] = [];
  const candidateMovedPairs: ProbabilityOutcome[] = [];
  const servingPassageBriers: number[] = [];
  const candidatePassageBriers: number[] = [];
  const servingYesErrors: number[] = [];
  const candidateYesErrors: number[] = [];
  const directionalMembershipIds = new Set<string>();
  let movedMemberOutcomes = 0;

  const chamberAccumulator = {
    house: {
      servingPairs: [] as ProbabilityOutcome[],
      candidatePairs: [] as ProbabilityOutcome[],
      servingPassageBriers: [] as number[],
      candidatePassageBriers: [] as number[],
      servingYesErrors: [] as number[],
      candidateYesErrors: [] as number[],
    },
    senate: {
      servingPairs: [] as ProbabilityOutcome[],
      candidatePairs: [] as ProbabilityOutcome[],
      servingPassageBriers: [] as number[],
      candidatePassageBriers: [] as number[],
      servingYesErrors: [] as number[],
      candidateYesErrors: [] as number[],
    },
  };

  for (const item of cases) {
    const candidateChamber = simulateChamber(
      item.members.map((member) => member.candidateProbability),
      item.passageRule,
    );
    const chamber = chamberAccumulator[item.chamber];

    if (item.actualPassed !== null && finiteProbability(item.servingPassageProbability)) {
      const servingValue = passageBrier(item.servingPassageProbability, item.actualPassed);
      const candidateValue = passageBrier(candidateChamber.passageProbability, item.actualPassed);
      servingPassageBriers.push(servingValue);
      candidatePassageBriers.push(candidateValue);
      chamber.servingPassageBriers.push(servingValue);
      chamber.candidatePassageBriers.push(candidateValue);
    }
    if (finiteNumber(item.servingExpectedYes)) {
      const servingValue = Math.abs(item.servingExpectedYes - item.actualYes);
      const candidateValue = Math.abs(candidateChamber.expectedYes - item.actualYes);
      servingYesErrors.push(servingValue);
      candidateYesErrors.push(candidateValue);
      chamber.servingYesErrors.push(servingValue);
      chamber.candidateYesErrors.push(candidateValue);
    }

    for (const member of item.members) {
      if (member.directionalEvidenceItems > 0) directionalMembershipIds.add(member.membershipId);
      if (member.outcome === undefined) continue;
      const serving = { probability: member.servingProbability, outcome: member.outcome };
      const candidate = { probability: member.candidateProbability, outcome: member.outcome };
      servingPairs.push(serving);
      candidatePairs.push(candidate);
      chamber.servingPairs.push(serving);
      chamber.candidatePairs.push(candidate);
      if (Math.abs(member.candidateProbability - member.servingProbability) > 1e-12) {
        movedMemberOutcomes += 1;
        servingMovedPairs.push(serving);
        candidateMovedPairs.push(candidate);
      }
    }
  }

  const servingMember = memberMetric(servingPairs);
  const candidateMember = memberMetric(candidatePairs);
  const servingMoved = memberMetric(servingMovedPairs);
  const candidateMoved = memberMetric(candidateMovedPairs);

  function chamberScore(key: 'house' | 'senate') {
    const acc = chamberAccumulator[key];
    const serving = memberMetric(acc.servingPairs);
    const candidate = memberMetric(acc.candidatePairs);
    const servingPassage = mean(acc.servingPassageBriers);
    const candidatePassage = mean(acc.candidatePassageBriers);
    const servingYes = mean(acc.servingYesErrors);
    const candidateYes = mean(acc.candidateYesErrors);
    return {
      member: {
        serving,
        candidate,
        deltaCandidateMinusServing: metricDelta(candidate, serving),
      },
      passage: {
        servingBrier: servingPassage,
        candidateBrier: candidatePassage,
        deltaCandidateMinusServing:
          candidatePassage !== null && servingPassage !== null
            ? candidatePassage - servingPassage
            : null,
      },
      chamberYes: {
        servingMae: servingYes,
        candidateMae: candidateYes,
        deltaCandidateMinusServing:
          candidateYes !== null && servingYes !== null ? candidateYes - servingYes : null,
      },
    };
  }

  const servingPassage = mean(servingPassageBriers);
  const candidatePassage = mean(candidatePassageBriers);
  const servingYes = mean(servingYesErrors);
  const candidateYes = mean(candidateYesErrors);

  return {
    memberOutcomes: servingPairs.length,
    movedMemberOutcomes,
    distinctMembersWithDirectionalEvidence: directionalMembershipIds.size,
    overall: {
      member: {
        serving: servingMember,
        candidate: candidateMember,
        deltaCandidateMinusServing: metricDelta(candidateMember, servingMember),
      },
      movedMembers: {
        serving: servingMoved,
        candidate: candidateMoved,
        deltaCandidateMinusServing: metricDelta(candidateMoved, servingMoved),
      },
      passage: {
        servingBrier: servingPassage,
        candidateBrier: candidatePassage,
        deltaCandidateMinusServing:
          candidatePassage !== null && servingPassage !== null
            ? candidatePassage - servingPassage
            : null,
      },
      chamberYes: {
        servingMae: servingYes,
        candidateMae: candidateYes,
        deltaCandidateMinusServing:
          candidateYes !== null && servingYes !== null ? candidateYes - servingYes : null,
      },
    },
    byChamber: {
      house: chamberScore('house'),
      senate: chamberScore('senate'),
    },
  };
}

export function evaluateQuickEvidenceProspectiveCases(
  cases: readonly QuickEvidenceProspectiveCase[],
  options: { revealMetrics?: boolean } = {},
) {
  const resolvedForecasts = new Set(cases.map((item) => item.forecastId)).size;
  let memberOutcomes = 0;
  const directionalMembers = new Set<string>();
  for (const item of cases) {
    for (const member of item.members) {
      if (member.outcome !== undefined) memberOutcomes += 1;
      if (member.directionalEvidenceItems > 0) directionalMembers.add(member.membershipId);
    }
  }

  const minimums = {
    resolvedForecasts: {
      observed: resolvedForecasts,
      required: MIN_RESOLVED_FORECASTS,
      met: resolvedForecasts >= MIN_RESOLVED_FORECASTS,
    },
    memberOutcomes: {
      observed: memberOutcomes,
      required: MIN_MEMBER_OUTCOMES,
      met: memberOutcomes >= MIN_MEMBER_OUTCOMES,
    },
    membersWithAppliedDirectionalEvidence: {
      observed: directionalMembers.size,
      required: MIN_DIRECTIONAL_MEMBERS,
      met: directionalMembers.size >= MIN_DIRECTIONAL_MEMBERS,
    },
  };
  const primaryScoringAllowed = Object.values(minimums).every((item) => item.met);
  const reveal = options.revealMetrics === true || primaryScoringAllowed;
  return {
    resolvedForecasts,
    selectedRevisions: cases.length,
    minimums,
    primaryScoringAllowed,
    status: resolvedForecasts === 0
      ? 'awaiting_resolved_forecasts'
      : primaryScoringAllowed
        ? 'ready_for_primary_scoring'
        : 'accruing',
    metrics: reveal ? scoreCases(cases) : null,
  } as const;
}

export async function getQuickEvidenceProspectiveScorecard(
  db: Queryable,
  options: { revealMetrics?: boolean } = {},
) {
  const revisions = await db.query<RevisionRow>(`
    SELECT f.id::text AS forecast_id,
           b.identifier,
           c.slug AS chamber_slug,
           ve.id::text AS vote_event_id,
           ve.occurred_on::text,
           ve.passed AS actual_passed,
           ve.yea_count::int AS actual_yes,
           r.id::text AS revision_id,
           r.revision_number,
           r.generated_at::text,
           r.model_version,
           r.metadata,
           r.passage_probability AS serving_passage_probability,
           r.expected_yes AS serving_expected_yes
      FROM forecast_resolutions fr
      JOIN forecasts f ON f.id=fr.forecast_id
      JOIN legislative_sessions s ON s.id=f.session_id
      JOIN bills b ON b.id=f.bill_id
      JOIN chambers c ON c.id=f.target_chamber_id
      JOIN vote_events ve ON ve.id=fr.vote_event_id
      LEFT JOIN LATERAL (
        SELECT candidate.*
          FROM forecast_revisions candidate
         WHERE candidate.forecast_id=f.id
           AND candidate.research_mode='quick'
           AND candidate.generated_at IS NOT NULL
           AND candidate.generated_at::date < ve.occurred_on
         ORDER BY candidate.generated_at DESC, candidate.revision_number DESC, candidate.id DESC
         LIMIT 1
      ) r ON true
     WHERE f.owner_user_id=$1
       AND f.target_type='bill'
       AND s.slug=$2
     ORDER BY ve.occurred_on, f.id
  `, [PROSPECTIVE_EVIDENCE_OWNER_USER_ID, QUICK_EVIDENCE_PROSPECTIVE_SESSION]);

  const exclusions: Array<{
    forecastId: string;
    identifier: string;
    reason: QuickEvidenceScoreExclusionReason;
    revisionId?: string;
  }> = [];
  const selectedIds = revisions.rows
    .map((row) => row.revision_id)
    .filter((value): value is string => Boolean(value));

  const members = selectedIds.length === 0
    ? { rows: [] as MemberRow[] }
    : await db.query<MemberRow>(`
        SELECT fmp.revision_id::text,
               fmp.membership_id::text,
               fmp.yes_probability AS serving_probability,
               CASE WHEN mv.choice IN ('yea','nay') THEN mv.choice ELSE NULL END AS actual_choice,
               shadow.value AS shadow
          FROM forecast_member_predictions fmp
          JOIN forecast_revisions r ON r.id=fmp.revision_id
          JOIN forecasts f ON f.id=r.forecast_id
          JOIN forecast_resolutions fr ON fr.forecast_id=f.id
          LEFT JOIN member_votes mv
            ON mv.vote_event_id=fr.vote_event_id
           AND mv.membership_id=fmp.membership_id
          LEFT JOIN LATERAL (
            SELECT item.value
              FROM jsonb_array_elements(COALESCE(fmp.context,'[]'::jsonb)) item(value)
             WHERE item.value->>'kind'='quick_evidence_shadow'
               AND item.value->>'experiment'=$2
             LIMIT 1
          ) shadow ON true
         WHERE fmp.revision_id=ANY($1::uuid[])
         ORDER BY fmp.revision_id, fmp.membership_id
      `, [selectedIds, QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT]);

  const byRevision = new Map<string, MemberRow[]>();
  for (const member of members.rows) {
    const rows = byRevision.get(member.revision_id) ?? [];
    rows.push(member);
    byRevision.set(member.revision_id, rows);
  }

  const cases: QuickEvidenceProspectiveCase[] = [];
  for (const row of revisions.rows) {
    if (!row.revision_id || !row.generated_at || row.revision_number === null) {
      exclusions.push({
        forecastId: row.forecast_id,
        identifier: row.identifier,
        reason: 'no_strictly_prevote_quick_revision',
      });
      continue;
    }
    if (row.model_version !== QUICK_EVIDENCE_BASE_MODEL_VERSION) {
      exclusions.push({
        forecastId: row.forecast_id,
        identifier: row.identifier,
        revisionId: row.revision_id,
        reason: 'serving_model_mismatch',
      });
      continue;
    }

    const memberRows = byRevision.get(row.revision_id) ?? [];
    if (memberRows.length === 0) {
      exclusions.push({
        forecastId: row.forecast_id,
        identifier: row.identifier,
        revisionId: row.revision_id,
        reason: 'missing_member_predictions',
      });
      continue;
    }

    let passageRule: PassageRule;
    try {
      passageRule = passageRuleFromMetadata(row.metadata);
    } catch {
      exclusions.push({
        forecastId: row.forecast_id,
        identifier: row.identifier,
        revisionId: row.revision_id,
        reason: 'unsupported_passage_rule',
      });
      continue;
    }

    const parsedMembers: QuickEvidenceProspectiveCaseMember[] = [];
    let invalidReason: QuickEvidenceScoreExclusionReason | undefined;
    for (const member of memberRows) {
      if (!member.shadow) {
        invalidReason = 'missing_quick_evidence_shadow';
        break;
      }
      const candidateProbability = member.shadow.candidateProbability;
      const baseProbability = member.shadow.baseProbability;
      if (!finiteProbability(member.serving_probability)
        || !finiteProbability(candidateProbability)
        || !finiteProbability(baseProbability)) {
        invalidReason = 'invalid_shadow_probability';
        break;
      }
      if (Math.abs(member.serving_probability - baseProbability) > 1e-10) {
        invalidReason = 'base_probability_lineage_mismatch';
        break;
      }
      const features = member.shadow.features;
      const directionalEvidenceItems = features && typeof features === 'object'
        ? numeric((features as Record<string, unknown>).candidateEvidenceItems)
        : 0;
      parsedMembers.push({
        membershipId: member.membership_id,
        servingProbability: member.serving_probability,
        candidateProbability,
        ...(member.actual_choice
          ? { outcome: member.actual_choice === 'yea' ? 1 as const : 0 as const }
          : {}),
        directionalEvidenceItems,
      });
    }
    if (invalidReason) {
      exclusions.push({
        forecastId: row.forecast_id,
        identifier: row.identifier,
        revisionId: row.revision_id,
        reason: invalidReason,
      });
      continue;
    }

    cases.push({
      forecastId: row.forecast_id,
      identifier: row.identifier,
      chamber: row.chamber_slug,
      voteEventId: row.vote_event_id,
      occurredOn: row.occurred_on,
      actualPassed: row.actual_passed,
      actualYes: Number(row.actual_yes),
      revisionId: row.revision_id,
      revisionNumber: Number(row.revision_number),
      generatedAt: row.generated_at,
      passageRule,
      ...(finiteProbability(row.serving_passage_probability)
        ? { servingPassageProbability: row.serving_passage_probability }
        : {}),
      ...(finiteNumber(row.serving_expected_yes)
        ? { servingExpectedYes: row.serving_expected_yes }
        : {}),
      members: parsedMembers,
    });
  }

  const evaluated = evaluateQuickEvidenceProspectiveCases(cases, {
    revealMetrics: options.revealMetrics === true,
  });
  return {
    schemaVersion: QUICK_EVIDENCE_PROSPECTIVE_SCORECARD_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'paired prospective serving Quick versus Quick Evidence scorecard for the frozen system evidence cohort; metrics remain sealed until the frozen minimum sample is met',
    metadata: {
      experiment: QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
      session: QUICK_EVIDENCE_PROSPECTIVE_SESSION,
      ownerUserId: PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
      servingBaseline: QUICK_EVIDENCE_BASE_MODEL_VERSION,
      revisionSelection: 'latest strictly pre-vote Quick revision per resolved system forecast; never fall back based on shadow presence or outcome',
      automaticPromotion: false,
      productionAction: 'none',
    },
    cohort: {
      resolvedForecastsInScope: revisions.rows.length,
      selectedStrictlyPreVoteCases: cases.length,
      exclusions,
    },
    ...evaluated,
    productionAction: 'none' as const,
  };
}
