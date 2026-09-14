import { pool } from '@/lib/db';
import {
  estimateMemberHistoryCap20ProspectiveShadow,
  MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
  shouldCaptureMemberHistoryCap20ProspectiveShadow,
} from './member-history-cap20-prospective-shadow';
import {
  estimateMemberProbability,
  type MemberProbabilityInput,
  type RateEvidence,
} from './member-model';
import type { ForecastRuntimeRequest, ForecastRuntimeResult } from './runtime';

const BASELINE_TOLERANCE = 1e-12;

type HistoricalSupportRow = {
  legislator_id: string;
  party: string;
  yes: number;
  total: number;
};

type AnalogueVoteRow = {
  vote_event_id: string;
  legislator_id: string;
  choice: 'yea' | 'nay';
};

export interface MemberHistoryCap20ProspectiveCaptureResult {
  experiment: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT;
  revisionId: string;
  capturedMembers: number;
  predictedMembers: number;
  maximumBaselineAbsoluteDifference: number;
  servesTraffic: false;
}

interface ReconstructedMemberInput {
  membershipId: string;
  legislatorId: string;
  servingProbability?: number;
  input: MemberProbabilityInput;
}

function toCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rateEvidence(yes: number, total: number): RateEvidence {
  return { yes, total };
}

export function buildMemberHistoryCap20ProspectiveInputs(input: {
  quick: ForecastRuntimeResult;
  historicalRows: readonly HistoricalSupportRow[];
  analogueVotes: readonly AnalogueVoteRow[];
}): ReconstructedMemberInput[] {
  const parties = new Map<string, RateEvidence>();
  const members = new Map<string, RateEvidence>();
  let globalYes = 0;
  let globalTotal = 0;
  for (const row of input.historicalRows) {
    const yes = toCount(row.yes);
    const total = toCount(row.total);
    globalYes += yes;
    globalTotal += total;
    const party = parties.get(row.party) ?? rateEvidence(0, 0);
    party.yes += yes;
    party.total += total;
    parties.set(row.party, party);
    const member = members.get(row.legislator_id) ?? rateEvidence(0, 0);
    member.yes += yes;
    member.total += total;
    members.set(row.legislator_id, member);
  }

  const analogueScoreByEvent = new Map(input.quick.analogues.map((item) => [item.voteEventId, item.score]));
  const analogueRowsByLegislator = new Map<string, AnalogueVoteRow[]>();
  for (const row of input.analogueVotes) {
    if (!analogueScoreByEvent.has(row.vote_event_id)) continue;
    const rows = analogueRowsByLegislator.get(row.legislator_id) ?? [];
    rows.push(row);
    analogueRowsByLegislator.set(row.legislator_id, rows);
  }

  return input.quick.members.map((member) => {
    let analogueYesWeight = 0;
    let analogueWeight = 0;
    for (const row of analogueRowsByLegislator.get(member.legislatorId) ?? []) {
      const score = analogueScoreByEvent.get(row.vote_event_id);
      if (score === undefined) continue;
      analogueWeight += score;
      if (row.choice === 'yea') analogueYesWeight += score;
    }
    return {
      membershipId: member.membershipId,
      legislatorId: member.legislatorId,
      servingProbability: member.yesProbability,
      input: {
        memberId: member.legislatorId,
        party: member.party,
        global: rateEvidence(globalYes, globalTotal),
        partyHistory: parties.get(member.party),
        memberHistory: members.get(member.legislatorId),
        analogueYesRate: analogueWeight > 0 ? analogueYesWeight / analogueWeight : undefined,
        analogueEffectiveWeight: analogueWeight,
      },
    };
  });
}

function baselineDifference(serving: number | undefined, reconstructed: number | undefined): number {
  if (serving === undefined && reconstructed === undefined) return 0;
  if (serving === undefined || reconstructed === undefined) return Number.POSITIVE_INFINITY;
  return Math.abs(serving - reconstructed);
}

export async function captureMemberHistoryCap20ProspectiveShadow(
  request: ForecastRuntimeRequest,
  quick: ForecastRuntimeResult,
): Promise<MemberHistoryCap20ProspectiveCaptureResult | undefined> {
  if (request.subject.kind !== 'bill') return undefined;
  if (!shouldCaptureMemberHistoryCap20ProspectiveShadow({
    sessionSlug: request.subject.sessionSlug,
    chamberSlug: request.chamberSlug,
    researchMode: request.researchMode,
  })) return undefined;
  if (quick.researchMode !== 'quick') throw new Error('Prospective cap-20 capture requires a Quick runtime result');

  const asOfDate = quick.asOf.slice(0, 10);
  const historicalResult = await pool.query<HistoricalSupportRow>(`
    SELECT m.legislator_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           sum(CASE WHEN mv.choice = 'yea' THEN 1 ELSE 0 END)::int AS yes,
           count(*)::int AS total
      FROM member_votes mv
      JOIN vote_events ve ON ve.id = mv.vote_event_id
      JOIN memberships m ON m.id = mv.membership_id
     WHERE ve.is_passage = true
       AND ve.occurred_on < $1::date
       AND ve.chamber_id = $2
       AND mv.choice IN ('yea', 'nay')
     GROUP BY m.legislator_id, COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN')`, [asOfDate, request.chamberId]);

  const analogueEventIds = quick.analogues.map((item) => item.voteEventId);
  const analogueResult = analogueEventIds.length === 0
    ? { rows: [] as AnalogueVoteRow[] }
    : await pool.query<AnalogueVoteRow>(`
        SELECT mv.vote_event_id,
               m.legislator_id,
               mv.choice
          FROM member_votes mv
          JOIN memberships m ON m.id = mv.membership_id
         WHERE mv.vote_event_id = ANY($1::uuid[])
           AND mv.choice IN ('yea', 'nay')`, [analogueEventIds]);

  const reconstructed = buildMemberHistoryCap20ProspectiveInputs({
    quick,
    historicalRows: historicalResult.rows,
    analogueVotes: analogueResult.rows,
  });
  if (reconstructed.length !== quick.members.length) {
    throw new Error(`Prospective cap-20 reconstruction produced ${reconstructed.length}/${quick.members.length} members`);
  }

  const writes: Array<{ membershipId: string; context: Record<string, unknown> }> = [];
  let maximumBaselineAbsoluteDifference = 0;
  let predictedMembers = 0;
  for (const member of reconstructed) {
    const baseline = estimateMemberProbability(member.input);
    const difference = baselineDifference(member.servingProbability, baseline.probability);
    if (!Number.isFinite(difference) || difference > BASELINE_TOLERANCE) {
      throw new Error(`Prospective cap-20 baseline reconstruction drift ${difference} for ${member.legislatorId}`);
    }
    maximumBaselineAbsoluteDifference = Math.max(maximumBaselineAbsoluteDifference, difference);
    const shadow = estimateMemberHistoryCap20ProspectiveShadow(member.input);
    if (member.servingProbability !== undefined) predictedMembers += 1;
    writes.push({
      membershipId: member.membershipId,
      context: shadow
        ? {
            ...shadow,
            baselineReproductionAbsoluteDifference: difference,
            capturedAt: quick.asOf,
          }
        : {
            kind: 'prospective_shadow_model',
            experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
            modelVersion: baseline.modelVersion,
            maximumMemberHistoryWeight: 20,
            yesProbability: null,
            servesTraffic: false,
            outcomeUseAtCapture: 'none',
            cannotPredictReason: baseline.cannotPredictReason ?? 'candidate probability unavailable',
            baselineReproductionAbsoluteDifference: difference,
            capturedAt: quick.asOf,
          },
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updated = 0;
    for (const write of writes) {
      const result = await client.query(`
        UPDATE forecast_member_predictions
           SET context = COALESCE(context, '[]'::jsonb) || $3::jsonb
         WHERE revision_id = $1
           AND membership_id = $2
           AND NOT COALESCE(context, '[]'::jsonb) @> $4::jsonb`, [
        quick.revisionId,
        write.membershipId,
        JSON.stringify([write.context]),
        JSON.stringify([{ experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT }]),
      ]);
      updated += result.rowCount ?? 0;
    }
    if (updated !== writes.length) {
      throw new Error(`Prospective cap-20 capture updated ${updated}/${writes.length} member rows`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
    revisionId: quick.revisionId,
    capturedMembers: writes.length,
    predictedMembers,
    maximumBaselineAbsoluteDifference,
    servesTraffic: false,
  };
}
