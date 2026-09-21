import type { Pool } from 'pg';
import { strictPreVoteCutoff } from './deep-replay';
import {
  historicalQuickEvidenceQuality,
  type HistoricalQuickEvidenceQuality,
} from './historical-deep-targets';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';
import { evaluateHistoricalQuickReplay } from './historical-quick-runtime';

export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_MANIFEST_SCHEMA =
  'quick-evidence-committee-rollcall-manifest-v1' as const;
export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SESSIONS = [
  '2021-2022',
  '2023-2024',
  '2025-2026',
] as const;
export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER = 'house' as const;

type SessionSlug = typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SESSIONS[number];

export interface QuickEvidenceCommitteeRollcallManifestMember {
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
}

export interface QuickEvidenceCommitteeRollcallManifestCase {
  stableKey: string;
  voteEventId: string;
  externalKey: string;
  billId: string;
  identifier: string;
  title: string;
  session: SessionSlug;
  partition: 'training' | 'validation' | 'descriptive';
  chamberId: string;
  chamber: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER;
  occurredOn: string;
  asOf: string;
  targetVersionId: string;
  quickModelVersion: string;
  members: QuickEvidenceCommitteeRollcallManifestMember[];
}

export interface QuickEvidenceCommitteeRollcallManifest {
  schemaVersion: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_MANIFEST_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    databaseSource: string | null;
    purpose: string;
    outcomeBoundary: string;
    sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1';
    sessions: readonly SessionSlug[];
    chamber: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER;
    cases: number;
    memberCasePairs: number;
    casesBySession: Record<SessionSlug, number>;
  };
  cases: QuickEvidenceCommitteeRollcallManifestCase[];
}

type EventMetadataRow = {
  vote_event_id: string;
  external_key: string;
  bill_id: string;
  identifier: string;
  title: string;
  session_slug: SessionSlug;
  chamber_id: string;
  chamber_slug: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER;
  occurred_on: string;
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

function partitionForSession(session: SessionSlug): QuickEvidenceCommitteeRollcallManifestCase['partition'] {
  if (session === '2021-2022') return 'training';
  if (session === '2023-2024') return 'validation';
  return 'descriptive';
}

function stableEventKey(row: Pick<EventMetadataRow, 'session_slug' | 'chamber_slug' | 'external_key'>): string {
  if (!row.external_key.trim()) throw new Error('Committee-rollcall manifest requires a stable external event key');
  return `${row.session_slug}|${row.chamber_slug}|${row.external_key}`;
}

export async function evaluateQuickEvidenceCommitteeRollcallManifest(
  pool: Pool,
  options: { codeSha?: string | null; databaseSource?: string | null } = {},
): Promise<QuickEvidenceCommitteeRollcallManifest> {
  const quick = await evaluateHistoricalQuickReplay(pool, {
    includeMembers: true,
    codeSha: options.codeSha ?? null,
    databaseSource: options.databaseSource ?? null,
  });
  const replayable = runtimeEvents(quick).filter((event) =>
    event.status === 'replayable'
    && QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SESSIONS.includes(event.session as SessionSlug)
    && event.chamber === QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER);
  if (replayable.length === 0) {
    throw new Error('Committee-rollcall manifest has no replayable House historical Quick events');
  }

  const voteIds = replayable.map((event) => event.voteEventId);
  const metadataResult = await pool.query<EventMetadataRow>(`
    SELECT ve.id AS vote_event_id,
           ve.external_key,
           ve.bill_id,
           b.identifier,
           b.title,
           s.slug AS session_slug,
           ve.chamber_id,
           c.slug AS chamber_slug,
           ve.occurred_on::text
      FROM vote_events ve
      JOIN bills b ON b.id=ve.bill_id
      JOIN legislative_sessions s ON s.id=ve.session_id
      JOIN chambers c ON c.id=ve.chamber_id
     WHERE ve.id = ANY($1::uuid[])
       AND s.slug = ANY($2::text[])
       AND c.slug = $3
     ORDER BY ve.occurred_on, ve.id`, [
    voteIds,
    [...QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SESSIONS],
    QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER,
  ]);
  const metadataByEvent = new Map(metadataResult.rows.map((row) => [row.vote_event_id, row]));
  if (metadataByEvent.size !== replayable.length) {
    throw new Error(`Committee-rollcall manifest resolved ${metadataByEvent.size}/${replayable.length} event metadata rows`);
  }

  const membershipIds = [...new Set(replayable.flatMap((event) =>
    event.memberPredictions.map((member) => member.membershipId)))];
  const memberResult = await pool.query<MemberMetadataRow>(`
    SELECT m.id AS membership_id,
           m.legislator_id,
           l.name AS member_name,
           m.district,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           m.title
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
     WHERE m.id = ANY($1::uuid[])`, [membershipIds]);
  const memberByMembership = new Map(memberResult.rows.map((row) => [row.membership_id, row]));

  const cases = replayable.map((event): QuickEvidenceCommitteeRollcallManifestCase => {
    const metadata = metadataByEvent.get(event.voteEventId);
    if (!metadata) throw new Error(`Committee-rollcall event metadata missing for ${event.voteEventId}`);
    if (
      metadata.session_slug !== event.session
      || metadata.chamber_slug !== event.chamber
      || metadata.occurred_on !== event.occurredOn
    ) {
      throw new Error(`Committee-rollcall manifest lineage mismatch for ${event.voteEventId}`);
    }
    const members = event.memberPredictions.map((prediction): QuickEvidenceCommitteeRollcallManifestMember => {
      const member = memberByMembership.get(prediction.membershipId);
      if (!member) throw new Error(`Committee-rollcall member metadata missing for ${prediction.membershipId}`);
      return {
        membershipId: prediction.membershipId,
        legislatorId: prediction.legislatorId,
        memberName: member.member_name,
        district: member.district ?? undefined,
        party: prediction.party,
        title: member.title ?? undefined,
        yesProbability: prediction.yesProbability,
        cannotPredictReason: prediction.cannotPredictReason,
        evidenceQuality: historicalQuickEvidenceQuality(prediction.support),
        support: prediction.support,
      };
    });
    return {
      stableKey: stableEventKey(metadata),
      voteEventId: event.voteEventId,
      externalKey: metadata.external_key,
      billId: metadata.bill_id,
      identifier: metadata.identifier,
      title: metadata.title,
      session: metadata.session_slug,
      partition: partitionForSession(metadata.session_slug),
      chamberId: metadata.chamber_id,
      chamber: metadata.chamber_slug,
      occurredOn: metadata.occurred_on,
      asOf: strictPreVoteCutoff(metadata.occurred_on),
      targetVersionId: event.targetVersionId,
      quickModelVersion: event.modelVersion,
      members,
    };
  }).sort((left, right) => left.occurredOn.localeCompare(right.occurredOn)
    || left.stableKey.localeCompare(right.stableKey));

  const uniqueStableKeys = new Set(cases.map((item) => item.stableKey));
  if (uniqueStableKeys.size !== cases.length) throw new Error('Committee-rollcall manifest contains duplicate stable event keys');

  const casesBySession = Object.fromEntries(
    QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SESSIONS.map((session) => [
      session,
      cases.filter((item) => item.session === session).length,
    ]),
  ) as Record<SessionSlug, number>;

  return {
    schemaVersion: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_MANIFEST_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'outcome-blind full-House historical Quick target manifest for broad official committee-minute source discovery under frozen plan quick-evidence-committee-rollcall-screen-plan-v1',
      outcomeBoundary: 'Floor passed/yea/nay/member-choice fields are never queried for this manifest. Historical Quick is used only for its pre-vote probability/support state; member actualOutcome is omitted from every emitted object.',
      sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1',
      sessions: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SESSIONS,
      chamber: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CHAMBER,
      cases: cases.length,
      memberCasePairs: cases.reduce((sum, item) => sum + item.members.length, 0),
      casesBySession,
    },
    cases,
  };
}
