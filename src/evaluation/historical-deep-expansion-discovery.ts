import type { Pool } from 'pg';
import type { DeepResearchRequest } from '../evidence/provider';
import { strictPreVoteCutoff } from './deep-replay';
import type {
  HistoricalDeepExpansionCohort,
  HistoricalDeepExpansionSelectedCase,
} from './historical-deep-expansion-cohort';
import { historicalDeepExpansionEventKey, outcomeBlindExpansionEvent } from './historical-deep-expansion-cohort';
import { historicalQuickEvidenceQuality, type HistoricalQuickEvidenceQuality } from './historical-deep-targets';
import { selectHistoricalDeepTargetsByStrategy } from './historical-deep-target-strategies';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';
import { evaluateHistoricalQuickReplay } from './historical-quick-runtime';

export const HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCHEMA = 'historical-deep-expansion-discovery-manifest-v1' as const;

export interface HistoricalDeepExpansionDiscoveryMember {
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
  selectedForCandidateDeep: boolean;
}

export interface HistoricalDeepExpansionDiscoveryCase {
  stableKey: string;
  caseKey: string;
  externalKey: string;
  tranche: HistoricalDeepExpansionSelectedCase['tranche'];
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
  members: HistoricalDeepExpansionDiscoveryMember[];
  currentDeepTargetIds: string[];
  candidateDeepTargetIds: string[];
  discoveryRequest: DeepResearchRequest;
}

export interface HistoricalDeepExpansionDiscoveryManifest {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    databaseSource: string | null;
    purpose: string;
    selectionGuard: string;
    cohortGeneratedAt: string;
    cohortCodeSha: string | null;
    cases: number;
    memberCasePairs: number;
    currentDeepTargetLimit: number;
    candidateStrategy: 'need-only';
  };
  cases: HistoricalDeepExpansionDiscoveryCase[];
}

type EventMetadataRow = {
  vote_event_id: string;
  external_key: string;
  bill_id: string;
  identifier: string;
  title: string;
  session_slug: string;
  chamber_id: string;
  chamber_slug: string;
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

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateFrozenCohort(cohort: HistoricalDeepExpansionCohort): void {
  if (cohort.schemaVersion !== 'historical-deep-expansion-cohort-v1') {
    throw new Error(`Unsupported expansion cohort schema: ${String(cohort.schemaVersion)}`);
  }
  if (!Array.isArray(cohort.cases) || cohort.cases.length !== 24) {
    throw new Error(`Expected frozen 24-event expansion cohort, got ${cohort.cases?.length ?? 'unknown'}`);
  }
  const stableKeys = new Set<string>();
  const voteIds = new Set<string>();
  for (const item of cohort.cases) {
    if (stableKeys.has(item.stableKey)) throw new Error(`Duplicate frozen stable key: ${item.stableKey}`);
    if (voteIds.has(item.voteEventId)) throw new Error(`Duplicate frozen vote event: ${item.voteEventId}`);
    stableKeys.add(item.stableKey);
    voteIds.add(item.voteEventId);
    if (item.chamber !== 'house') throw new Error(`Expansion discovery currently supports House only: ${item.stableKey}`);
    if (item.currentDeepTargetIds.length !== 12 || item.needOnlyTargetIds.length !== 12) {
      throw new Error(`Frozen target budget is not 12 for ${item.stableKey}`);
    }
  }
}

function buildDiscoveryRequest(
  input: Pick<HistoricalDeepExpansionDiscoveryCase, 'voteEventId' | 'billId' | 'chamberId' | 'asOf' | 'identifier' | 'title' | 'members'>,
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
      rationale: 'Outcome-blind chamber-wide pre-vote discovery candidate for the already-frozen historical Deep expansion cohort.',
    })),
  };
}

function validateEventLineage(
  frozen: HistoricalDeepExpansionSelectedCase,
  metadata: EventMetadataRow,
  replay: HistoricalQuickReplayEventResult,
): void {
  if (metadata.vote_event_id !== frozen.voteEventId || replay.voteEventId !== frozen.voteEventId) {
    throw new Error(`Expansion discovery vote ID mismatch for ${frozen.stableKey}`);
  }
  if (
    metadata.external_key !== frozen.externalKey
    || metadata.identifier !== frozen.identifier
    || metadata.session_slug !== frozen.session
    || metadata.chamber_slug !== frozen.chamber
    || metadata.occurred_on !== frozen.occurredOn
  ) throw new Error(`Expansion discovery frozen metadata mismatch for ${frozen.stableKey}`);
  const derivedStableKey = historicalDeepExpansionEventKey({
    session: metadata.session_slug,
    chamber: metadata.chamber_slug,
    externalKey: metadata.external_key,
  });
  if (derivedStableKey !== frozen.stableKey) throw new Error(`Expansion discovery stable-key mismatch for ${frozen.stableKey}`);
  if (replay.session !== frozen.session || replay.chamber !== frozen.chamber || replay.occurredOn !== frozen.occurredOn) {
    throw new Error(`Expansion discovery Quick natural-key mismatch for ${frozen.stableKey}`);
  }
  if (replay.targetVersionId !== frozen.targetVersionId || replay.modelVersion !== frozen.quickModelVersion) {
    throw new Error(`Expansion discovery Quick lineage drift for ${frozen.stableKey}`);
  }
}

export async function evaluateHistoricalDeepExpansionDiscoveryManifest(
  pool: Pool,
  cohort: HistoricalDeepExpansionCohort,
  options: { codeSha?: string | null; databaseSource?: string | null } = {},
): Promise<HistoricalDeepExpansionDiscoveryManifest> {
  validateFrozenCohort(cohort);
  const quick = await evaluateHistoricalQuickReplay(pool, {
    includeMembers: true,
    codeSha: options.codeSha ?? null,
    databaseSource: options.databaseSource ?? null,
  });
  const replayById = new Map(runtimeEvents(quick).map((event) => [event.voteEventId, event]));
  const voteIds = cohort.cases.map((item) => item.voteEventId);

  // No passage result, yea/nay totals, or member choices are selected here. Outcomes are
  // never emitted into this manifest and are not passed to either target selector.
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
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
     WHERE ve.id = ANY($1::uuid[])`, [voteIds]);
  const metadataById = new Map(metadataResult.rows.map((row) => [row.vote_event_id, row]));
  if (metadataById.size !== cohort.cases.length) {
    throw new Error(`Expansion discovery resolved ${metadataById.size}/${cohort.cases.length} frozen vote rows`);
  }

  const planned = cohort.cases.map((frozen) => {
    const replay = replayById.get(frozen.voteEventId);
    if (!replay) throw new Error(`Expansion discovery vote is missing from Quick replay: ${frozen.stableKey}`);
    if (replay.status !== 'replayable') throw new Error(`Expansion discovery vote is not replayable: ${frozen.stableKey}`);
    const metadata = metadataById.get(frozen.voteEventId);
    if (!metadata) throw new Error(`Expansion discovery vote metadata is missing: ${frozen.stableKey}`);
    validateEventLineage(frozen, metadata, replay);

    const blinded = outcomeBlindExpansionEvent(replay);
    const currentDeepTargetIds = selectHistoricalDeepTargetsByStrategy(blinded, 'live-current', 12);
    const candidateDeepTargetIds = selectHistoricalDeepTargetsByStrategy(blinded, 'need-only', 12);
    if (!sameIds(currentDeepTargetIds, frozen.currentDeepTargetIds)) {
      throw new Error(`Expansion discovery current-target drift for ${frozen.stableKey}`);
    }
    if (!sameIds(candidateDeepTargetIds, frozen.needOnlyTargetIds)) {
      throw new Error(`Expansion discovery candidate-target drift for ${frozen.stableKey}`);
    }
    return { frozen, metadata, replay, currentDeepTargetIds, candidateDeepTargetIds };
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
  const memberByMembership = new Map(memberResult.rows.map((row) => [row.membership_id, row]));

  const cases: HistoricalDeepExpansionDiscoveryCase[] = planned.map(({
    frozen,
    metadata,
    replay,
    currentDeepTargetIds,
    candidateDeepTargetIds,
  }) => {
    const currentSet = new Set(currentDeepTargetIds);
    const candidateSet = new Set(candidateDeepTargetIds);
    const members = replay.memberPredictions.map((prediction): HistoricalDeepExpansionDiscoveryMember => {
      const member = memberByMembership.get(prediction.membershipId);
      if (!member) throw new Error(`Expansion discovery member metadata missing: ${prediction.membershipId}`);
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
        selectedForCurrentDeep: currentSet.has(prediction.membershipId),
        selectedForCandidateDeep: candidateSet.has(prediction.membershipId),
      };
    });
    const base = {
      stableKey: frozen.stableKey,
      caseKey: frozen.caseKey,
      externalKey: frozen.externalKey,
      tranche: frozen.tranche,
      voteEventId: frozen.voteEventId,
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
      candidateDeepTargetIds,
    };
    return { ...base, discoveryRequest: buildDiscoveryRequest(base) };
  });

  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'evaluation-only outcome-blind chamber-wide Quick manifest for the already-frozen historical Deep expansion cohort; no source discovery, research calls, evidence application, outcome scoring, database writes, or serving changes',
      selectionGuard: 'The cohort vote IDs and both 12-person target sets were frozen first. Quick is replayed at the strict prior-day cutoff; member actualOutcome is stripped before selector verification; the metadata query loads no floor outcome fields; the emitted manifest contains no floor outcome.',
      cohortGeneratedAt: cohort.generatedAt,
      cohortCodeSha: cohort.metadata.codeSha,
      cases: cases.length,
      memberCasePairs: cases.reduce((sum, item) => sum + item.members.length, 0),
      currentDeepTargetLimit: 12,
      candidateStrategy: 'need-only',
    },
    cases,
  };
}
