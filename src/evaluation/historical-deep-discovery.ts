import type { Pool } from 'pg';
import type { DeepResearchRequest } from '../evidence/provider';
import { strictPreVoteCutoff } from './deep-replay';
import {
  HISTORICAL_DEEP_PILOT_CASES,
  resolveHistoricalDeepPilotMetadata,
  type HistoricalDeepPilotMember,
} from './historical-deep-pilot';
import {
  historicalQuickEvidenceQuality,
  selectHistoricalDeepTargets,
  type HistoricalQuickEvidenceQuality,
} from './historical-deep-targets';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';
import { evaluateHistoricalQuickReplay } from './historical-quick-runtime';

export interface HistoricalDeepDiscoveryMember {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  district?: string;
  party: string;
  title?: string;
  yesProbability?: number;
  cannotPredictReason?: string;
  evidenceQuality: HistoricalQuickEvidenceQuality;
  support: HistoricalQuickReplayMemberPrediction['support'];
  selectedForCurrentDeep: boolean;
}

export interface HistoricalDeepDiscoveryCase {
  voteEventId: string;
  billId: string;
  identifier: string;
  title: string;
  session: string;
  chamberId: string;
  chamber: string;
  occurredOn: string;
  asOf: string;
  targetVersionId: string;
  quickModelVersion: string;
  members: HistoricalDeepDiscoveryMember[];
  currentDeepTargetIds: string[];
  discoveryRequest: DeepResearchRequest;
}

export interface HistoricalDeepDiscoveryManifest {
  metadata: {
    generatedAt: string;
    codeSha: string | null;
    databaseSource: string | null;
    purpose: string;
    pilotCases: typeof HISTORICAL_DEEP_PILOT_CASES;
    cases: number;
    memberCasePairs: number;
    currentDeepTargetLimit: number;
  };
  cases: HistoricalDeepDiscoveryCase[];
}

type EventMetadataRow = {
  vote_event_id: string;
  bill_id: string;
  identifier: string;
  title: string;
  session_slug: string;
  chamber_id: string;
  chamber_slug: string;
  occurred_on: string;
  yea_count: number;
  nay_count: number;
  passed: boolean;
};

type MemberMetadataRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  district: string | null;
  party: string;
  title: string | null;
};

function runtimeEvents(result: Record<string, unknown>): HistoricalQuickReplayEventResult[] {
  if (!Array.isArray(result.events)) throw new Error('Historical Quick replay did not return an events array');
  return result.events as HistoricalQuickReplayEventResult[];
}

export function buildHistoricalDeepDiscoveryMembers(
  predictions: readonly HistoricalQuickReplayMemberPrediction[],
  memberByMembership: ReadonlyMap<string, HistoricalDeepPilotMember>,
  selectedMembershipIds: ReadonlySet<string>,
): HistoricalDeepDiscoveryMember[] {
  return predictions.map((prediction) => {
    const member = memberByMembership.get(prediction.membershipId);
    if (!member) throw new Error(`Missing member metadata for discovery member ${prediction.membershipId}`);
    return {
      membershipId: prediction.membershipId,
      legislatorId: prediction.legislatorId,
      memberName: member.memberName,
      district: member.district,
      party: prediction.party,
      title: member.title,
      yesProbability: prediction.yesProbability,
      cannotPredictReason: prediction.cannotPredictReason,
      evidenceQuality: historicalQuickEvidenceQuality(prediction.support),
      support: prediction.support,
      selectedForCurrentDeep: selectedMembershipIds.has(prediction.membershipId),
    };
  });
}

export function buildHistoricalDeepDiscoveryRequest(
  input: Pick<HistoricalDeepDiscoveryCase, 'voteEventId' | 'billId' | 'chamberId' | 'asOf' | 'identifier' | 'title' | 'members'>,
): DeepResearchRequest {
  return {
    forecastId: input.voteEventId,
    billId: input.billId,
    chamberId: input.chamberId,
    asOf: input.asOf,
    subject: { identifier: input.identifier, title: input.title },
    targets: input.members.map((member) => ({
      membershipId: member.membershipId,
      memberName: member.memberName,
      party: member.party,
      district: member.district,
      yesProbability: member.yesProbability,
      rationale: 'Outcome-blind chamber-wide pre-vote discovery candidate; expensive Deep targeting occurs after discovery.',
    })),
  };
}

export async function evaluateHistoricalDeepDiscoveryManifest(
  pool: Pool,
  options: { codeSha?: string | null; databaseSource?: string | null } = {},
): Promise<HistoricalDeepDiscoveryManifest> {
  const quick = await evaluateHistoricalQuickReplay(pool, {
    includeMembers: true,
    codeSha: options.codeSha ?? null,
    databaseSource: options.databaseSource ?? null,
  });
  const replayById = new Map(runtimeEvents(quick).map((event) => [event.voteEventId, event]));

  const sessions = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.session))];
  const chambers = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.chamber))];
  const identifiers = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.identifier))];
  const occurredOn = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.occurredOn))];
  const metadataResult = await pool.query<EventMetadataRow>(`
    SELECT ve.id AS vote_event_id,
           ve.bill_id,
           b.identifier,
           b.title,
           s.slug AS session_slug,
           ve.chamber_id,
           c.slug AS chamber_slug,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed
      FROM vote_events ve
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
     WHERE ve.is_passage = true
       AND ve.passed IS NOT NULL
       AND s.slug = ANY($1::text[])
       AND c.slug = ANY($2::text[])
       AND b.identifier = ANY($3::text[])
       AND ve.occurred_on = ANY($4::date[])`, [sessions, chambers, identifiers, occurredOn]);
  const resolvedMetadata = resolveHistoricalDeepPilotMetadata(HISTORICAL_DEEP_PILOT_CASES, metadataResult.rows);

  const planned = resolvedMetadata.map((metadata) => {
    const replay = replayById.get(metadata.vote_event_id);
    if (!replay) throw new Error(`Discovery vote ${metadata.vote_event_id} is missing from historical Quick replay`);
    if (replay.status !== 'replayable') {
      throw new Error(`Discovery vote ${metadata.vote_event_id} is not replayable: ${replay.status}`);
    }
    const currentTargets = selectHistoricalDeepTargets(replay);
    return { metadata, replay, currentTargets };
  });

  const membershipIds = [...new Set(planned.flatMap(({ replay }) =>
    replay.memberPredictions.map((prediction) => prediction.membershipId)))];
  const memberResult = await pool.query<MemberMetadataRow>(`
    SELECT m.id AS membership_id,
           m.legislator_id,
           l.name AS member_name,
           m.district,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           m.title
      FROM memberships m
      JOIN legislators l ON l.id = m.legislator_id
     WHERE m.id = ANY($1::uuid[])`, [membershipIds]);
  const memberByMembership = new Map<string, HistoricalDeepPilotMember>(memberResult.rows.map((row) => [
    row.membership_id,
    {
      membershipId: row.membership_id,
      legislatorId: row.legislator_id,
      memberName: row.member_name,
      district: row.district ?? undefined,
      party: row.party,
      title: row.title ?? undefined,
    },
  ]));

  const cases: HistoricalDeepDiscoveryCase[] = planned.map(({ metadata, replay, currentTargets }) => {
    const currentDeepTargetIds = currentTargets.map((target) => target.membershipId);
    const members = buildHistoricalDeepDiscoveryMembers(
      replay.memberPredictions,
      memberByMembership,
      new Set(currentDeepTargetIds),
    );
    const base = {
      voteEventId: metadata.vote_event_id,
      billId: metadata.bill_id,
      identifier: metadata.identifier,
      title: metadata.title,
      session: metadata.session_slug,
      chamberId: metadata.chamber_id,
      chamber: metadata.chamber_slug,
      occurredOn: metadata.occurred_on,
      asOf: strictPreVoteCutoff(metadata.occurred_on),
      targetVersionId: replay.targetVersionId,
      quickModelVersion: replay.modelVersion,
      members,
      currentDeepTargetIds,
    };
    return { ...base, discoveryRequest: buildHistoricalDeepDiscoveryRequest(base) };
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'evaluation-only outcome-blind chamber-wide pre-vote discovery manifest; no research calls, evidence application, database writes, or serving changes',
      pilotCases: HISTORICAL_DEEP_PILOT_CASES,
      cases: cases.length,
      memberCasePairs: cases.reduce((sum, value) => sum + value.members.length, 0),
      currentDeepTargetLimit: 12,
    },
    cases,
  };
}
