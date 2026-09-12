import type { Pool } from 'pg';
import type { DeepResearchRequest } from '../evidence/provider';
import { strictPreVoteCutoff } from './deep-replay';
import { selectHistoricalDeepTargets, type HistoricalDeepTarget } from './historical-deep-targets';
import type { HistoricalQuickReplayEventResult } from './historical-quick-replay';
import { evaluateHistoricalQuickReplay } from './historical-quick-runtime';

export const HISTORICAL_DEEP_PILOT_VOTE_EVENT_IDS = [
  '774117b0-4de3-4b55-9107-2951082be473', // 2023-01-19 HF1, House, 69-65, resolved passed event
  '43597bb0-84e9-4aa0-a12f-5ef486d8fd56', // 2023-03-20 HF366, House, 68-62
  'a9850d7d-a8fa-41ae-aeaa-d73413a886fd', // 2023-03-23 HF146, House, 68-62
  'e973bf71-d42b-4e98-b45e-ea15f600d156', // 2023-05-02 HF2, House, 68-64
  '3fe25ee0-8717-45ef-b52c-ad910f2aa3b9', // 2024-05-02 HF4300, House, 68-64
  'd84a2bef-f44e-4d99-96ec-09a7a2a40e88', // 2024-05-19 HF3276, House, 66-62, failed
] as const;

export interface HistoricalDeepPilotMember {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  district?: string;
  party: string;
  title?: string;
}

export interface HistoricalDeepPilotTarget extends HistoricalDeepTarget {
  memberName: string;
  district?: string;
  title?: string;
}

export interface HistoricalDeepPilotCase {
  voteEventId: string;
  forecastId: string;
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
  quickPassageProbability?: number;
  quickExpectedYes?: number;
  actualYes: number;
  actualNay: number;
  passed: boolean;
  targets: HistoricalDeepPilotTarget[];
  researchRequest: DeepResearchRequest;
}

export interface HistoricalDeepPilotManifest {
  metadata: {
    generatedAt: string;
    codeSha: string | null;
    databaseSource: string | null;
    purpose: string;
    pilotVoteEventIds: readonly string[];
    targetLimit: number;
  };
  cases: HistoricalDeepPilotCase[];
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

function withMemberMetadata(
  target: HistoricalDeepTarget,
  memberByMembership: ReadonlyMap<string, HistoricalDeepPilotMember>,
): HistoricalDeepPilotTarget {
  const member = memberByMembership.get(target.membershipId);
  if (!member) throw new Error(`Missing member metadata for Deep target ${target.membershipId}`);
  return {
    ...target,
    memberName: member.memberName,
    district: member.district,
    title: member.title,
  };
}

export async function evaluateHistoricalDeepPilotManifest(
  pool: Pool,
  options: { codeSha?: string | null; databaseSource?: string | null } = {},
): Promise<HistoricalDeepPilotManifest> {
  const quick = await evaluateHistoricalQuickReplay(pool, {
    includeMembers: true,
    codeSha: options.codeSha ?? null,
    databaseSource: options.databaseSource ?? null,
  });
  const replayById = new Map(runtimeEvents(quick).map((event) => [event.voteEventId, event]));

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
     WHERE ve.id = ANY($1::uuid[])`, [HISTORICAL_DEEP_PILOT_VOTE_EVENT_IDS]);
  const metadataById = new Map(metadataResult.rows.map((row) => [row.vote_event_id, row]));

  const planned = HISTORICAL_DEEP_PILOT_VOTE_EVENT_IDS.map((voteEventId) => {
    const replay = replayById.get(voteEventId);
    const metadata = metadataById.get(voteEventId);
    if (!replay) throw new Error(`Pilot vote ${voteEventId} is missing from historical Quick replay`);
    if (!metadata) throw new Error(`Pilot vote ${voteEventId} is missing event metadata`);
    if (replay.status !== 'replayable') {
      throw new Error(`Pilot vote ${voteEventId} is not replayable: ${replay.status}`);
    }
    const targets = selectHistoricalDeepTargets(replay);
    if (targets.length === 0) throw new Error(`Pilot vote ${voteEventId} produced no Deep targets`);
    return { replay, metadata, targets };
  });

  const membershipIds = [...new Set(planned.flatMap(({ targets }) => targets.map((target) => target.membershipId)))];
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

  const cases: HistoricalDeepPilotCase[] = planned.map(({ replay, metadata, targets }) => {
    const detailedTargets = targets.map((target) => withMemberMetadata(target, memberByMembership));
    const asOf = strictPreVoteCutoff(metadata.occurred_on);
    const researchRequest: DeepResearchRequest = {
      forecastId: metadata.vote_event_id,
      billId: metadata.bill_id,
      chamberId: metadata.chamber_id,
      asOf,
      subject: {
        identifier: metadata.identifier,
        title: metadata.title,
      },
      targets: detailedTargets.map((target) => ({
        membershipId: target.membershipId,
        memberName: target.memberName,
        party: target.party,
        district: target.district,
        yesProbability: target.yesProbability,
        rationale: target.rationale,
      })),
    };
    return {
      voteEventId: metadata.vote_event_id,
      forecastId: metadata.vote_event_id,
      billId: metadata.bill_id,
      identifier: metadata.identifier,
      title: metadata.title,
      session: metadata.session_slug,
      chamberId: metadata.chamber_id,
      chamber: metadata.chamber_slug,
      occurredOn: metadata.occurred_on,
      asOf,
      targetVersionId: replay.targetVersionId,
      quickModelVersion: replay.modelVersion,
      quickPassageProbability: replay.passageProbability,
      quickExpectedYes: replay.expectedYes,
      actualYes: metadata.yea_count,
      actualNay: metadata.nay_count,
      passed: metadata.passed,
      targets: detailedTargets,
      researchRequest,
    };
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'evaluation-only close-vote historical Deep target manifest; no research calls, evidence application, database writes, or serving changes',
      pilotVoteEventIds: HISTORICAL_DEEP_PILOT_VOTE_EVENT_IDS,
      targetLimit: 12,
    },
    cases,
  };
}
