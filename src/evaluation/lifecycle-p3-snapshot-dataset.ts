import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import {
  authorshipMembershipIdsAsOf,
  type StoredRevisorAuthorship,
} from '@/forecasting/quick-evidence-authorship';
import { MIN_REVISOR_PROCESS_RESEARCH_COVERAGE } from '@/operations/revisor-process-source-policy';
import {
  REVISOR_PROCESS_AUDIT_VERSION,
  REVISOR_PROCESS_PARSER_VERSION,
} from '@/sources/minnesota/revisor-process';

export const LIFECYCLE_P3_SNAPSHOT_SCHEMA_VERSION = 'lifecycle-p3-snapshot-v1' as const;
export const LIFECYCLE_P3_DATASET_VERSION = 'mn-2021-2026-event-time-v1' as const;
export const LIFECYCLE_P3_EXPECTED_BILLS = 31_010;

export type LifecycleState =
  | 'introduced'
  | 'committee_process_engagement'
  | 'floor_eligibility_or_scheduling'
  | 'source_chamber_passage_vote_reached';

export type LifecycleTerminalOutcome =
  | 'source_chamber_passed'
  | 'source_chamber_passage_vote_failed'
  | 'session_expired_without_source_chamber_passage';

export interface LifecycleP3Event {
  eventKey: string;
  occurredOn: string;
  chamber: 'house' | 'senate' | null;
  stageKind: string;
  outcome: boolean | null;
  sourceUrl: string | null;
  sourceDocumentId: string | null;
  sourceContentSha256: string | null;
  parserVersion: string | null;
  companionIdentifiers: string[];
  terminalOutcomeAfterEvent?: LifecycleTerminalOutcome | null;
}

export interface LifecycleP3BillVersion {
  id: string;
  versionKey: string;
  publishedOn: string;
  textHash: string | null;
  textLengthChars: number | null;
}

export interface LifecycleP3EvidenceItem {
  evidenceKind: string;
  availableOn: string;
}

export interface LifecycleP3BillInput {
  billId: string;
  sessionSlug: string;
  chamber: 'house' | 'senate';
  identifier: string;
  introducedOn: string;
  adjournmentOn: string;
  authoritativePassage: boolean;
  passageLabelVersion: string;
  introductionParserVersion: string | null;
  processParserVersion: string | null;
  processAuditVersion: string | null;
  processStatus: string | null;
  processSourceUrl: string | null;
  processContentSha256: string | null;
  sourceChamberPassageOn: string | null;
  sourceChamberFailureOn: string | null;
  authorship: StoredRevisorAuthorship | null;
  events: LifecycleP3Event[];
  billVersions: LifecycleP3BillVersion[];
  evidence: LifecycleP3EvidenceItem[];
}

export interface LifecycleP3Snapshot {
  schemaVersion: typeof LIFECYCLE_P3_SNAPSHOT_SCHEMA_VERSION;
  datasetVersion: typeof LIFECYCLE_P3_DATASET_VERSION;
  snapshotId: string;
  bill: {
    billId: string;
    session: string;
    chamber: 'house' | 'senate';
    identifier: string;
  };
  cutoff: {
    asOfDateExclusive: string;
    granularity: 'date';
    sameDayExcluded: true;
    reason: 'introduction' | 'before_transition' | 'before_terminal';
  };
  features: {
    lifecycleState: LifecycleState;
    daysSinceIntroduction: number;
    daysSincePreviousTransition: number;
    daysRemainingInBiennium: number;
    priorProcessEventCount: number;
    priorProcessStageCounts: Record<string, number>;
    priorCompanionIdentifiers: string[];
    latestEligibleBillVersion: {
      billVersionId: string;
      versionKey: string;
      publishedOn: string;
      textHash: string | null;
      textLengthChars: number | null;
    } | null;
    authorship: {
      reconstructable: boolean;
      membershipIds: string[] | null;
      parserVersion: string | null;
    };
    evidenceFamilyCounts: Record<string, number>;
  };
  targets: {
    transitionOnCutoffDate: {
      stageKinds: string[];
      toState: LifecycleState | null;
      terminalOutcome: LifecycleTerminalOutcome | null;
    };
    eventualSourceChamberPassage: boolean;
    eventualReachesSourceChamberPassageVote: boolean;
    terminalOutcome: LifecycleTerminalOutcome;
    memberVoteLabel: null;
  };
  lineage: {
    introductionParserVersion: string | null;
    processParserVersion: string | null;
    processAuditVersion: string | null;
    processStatus: string | null;
    passageLabelVersion: string;
    priorProcessSourceDocumentSha256: string[];
    priorProcessSourceUrls: string[];
  };
}

type BillRow = {
  bill_id: string;
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  introduced_on: string | null;
  adjournment_on: string | null;
  authoritative_passage: boolean | null;
  passage_label_version: string | null;
  introduction_parser_version: string | null;
  process_parser_version: string | null;
  process_audit_version: string | null;
  process_status: string | null;
  process_source_url: string | null;
  process_content_sha256: string | null;
  passage_on: string | null;
  failure_on: string | null;
  authorship: StoredRevisorAuthorship | null;
};

type EventRow = {
  id: string;
  bill_id: string;
  occurred_on: string;
  chamber_slug: 'house' | 'senate' | null;
  stage_kind: string;
  outcome: boolean | null;
  source_url: string | null;
  source_document_id: string | null;
  content_sha256: string | null;
  parser_version: string | null;
  companion_identifiers: unknown;
};

type VersionRow = {
  bill_id: string;
  id: string;
  version_key: string;
  published_on: string;
  text_hash: string | null;
  text_length_chars: number | null;
};

type EvidenceRow = {
  bill_id: string;
  evidence_kind: string;
  fetched_on: string;
  published_on: string | null;
};

const COMMITTEE_STATE_KINDS = new Set([
  'committee_referral',
  'committee_report',
  'rules_referral',
]);
const FLOOR_STATE_KINDS = new Set([
  'second_reading',
  'floor_scheduled',
]);
const PASSAGE_STATE_KINDS = new Set([
  'house_floor_passage',
  'senate_floor_passage',
  'source_chamber_passage_action',
  'source_chamber_failed_passage_action',
]);

function isoDate(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`Expected ISO calendar date, received ${value}`);
  return match[1];
}

export function lifecycleDateEligibleBeforeCutoff(
  availableOn: string,
  cutoffDateExclusive: string,
): boolean {
  return isoDate(availableOn) < isoDate(cutoffDateExclusive);
}

function dayNumber(value: string): number {
  const parsed = Date.parse(`${isoDate(value)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid lifecycle date ${value}`);
  return Math.floor(parsed / 86_400_000);
}

function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

function stateRank(state: LifecycleState): number {
  switch (state) {
    case 'introduced': return 0;
    case 'committee_process_engagement': return 1;
    case 'floor_eligibility_or_scheduling': return 2;
    case 'source_chamber_passage_vote_reached': return 3;
  }
}

function stateFromRank(rank: number): LifecycleState {
  if (rank >= 3) return 'source_chamber_passage_vote_reached';
  if (rank === 2) return 'floor_eligibility_or_scheduling';
  if (rank === 1) return 'committee_process_engagement';
  return 'introduced';
}

function eventStateRank(event: LifecycleP3Event, sourceChamber: 'house' | 'senate'): number | null {
  if (event.chamber !== sourceChamber) return null;
  if (COMMITTEE_STATE_KINDS.has(event.stageKind)) return 1;
  if (FLOOR_STATE_KINDS.has(event.stageKind)) return 2;
  if (PASSAGE_STATE_KINDS.has(event.stageKind)) return 3;
  return null;
}

function isTransitionCandidate(event: LifecycleP3Event, sourceChamber: 'house' | 'senate'): boolean {
  return eventStateRank(event, sourceChamber) !== null
    || event.stageKind === 'session_expiration';
}

export function deriveLifecycleState(
  events: readonly LifecycleP3Event[],
  sourceChamber: 'house' | 'senate',
  cutoffDateExclusive: string,
): LifecycleState {
  let rank = 0;
  for (const event of events) {
    if (!lifecycleDateEligibleBeforeCutoff(event.occurredOn, cutoffDateExclusive)) continue;
    const candidate = eventStateRank(event, sourceChamber);
    if (candidate !== null) rank = Math.max(rank, candidate);
  }
  return stateFromRank(rank);
}

function sourceChamberFloorKind(chamber: 'house' | 'senate'): string {
  return chamber === 'house' ? 'house_floor_passage' : 'senate_floor_passage';
}

function normalizedCompanions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort();
}

function addVirtualAuditEvents(input: LifecycleP3BillInput): LifecycleP3Event[] {
  const events = [...input.events];
  const floorKind = sourceChamberFloorKind(input.chamber);
  const hasSourceFloorOn = (on: string) => events.some((event) =>
    event.chamber === input.chamber
    && event.stageKind === floorKind
    && event.occurredOn === on);

  if (input.sourceChamberPassageOn && !hasSourceFloorOn(input.sourceChamberPassageOn)) {
    events.push({
      eventKey: `process-audit-passage:${input.billId}:${input.sourceChamberPassageOn}`,
      occurredOn: input.sourceChamberPassageOn,
      chamber: input.chamber,
      stageKind: 'source_chamber_passage_action',
      outcome: true,
      sourceUrl: input.processSourceUrl,
      sourceDocumentId: null,
      sourceContentSha256: input.processContentSha256,
      parserVersion: input.processParserVersion,
      companionIdentifiers: [],
    });
  }
  if (input.sourceChamberFailureOn && !hasSourceFloorOn(input.sourceChamberFailureOn)) {
    events.push({
      eventKey: `process-audit-failure:${input.billId}:${input.sourceChamberFailureOn}`,
      occurredOn: input.sourceChamberFailureOn,
      chamber: input.chamber,
      stageKind: 'source_chamber_failed_passage_action',
      outcome: false,
      sourceUrl: input.processSourceUrl,
      sourceDocumentId: null,
      sourceContentSha256: input.processContentSha256,
      parserVersion: input.processParserVersion,
      companionIdentifiers: [],
    });
  }
  return events.sort((left, right) =>
    left.occurredOn.localeCompare(right.occurredOn)
    || left.stageKind.localeCompare(right.stageKind)
    || left.eventKey.localeCompare(right.eventKey));
}

function assignTerminalEvents(input: LifecycleP3BillInput, rawEvents: LifecycleP3Event[]): {
  events: LifecycleP3Event[];
  terminalOutcome: LifecycleTerminalOutcome;
  eventualReachesVote: boolean;
} {
  const events = rawEvents.map((event) => ({ ...event, terminalOutcomeAfterEvent: null }));
  const sourceFloorKind = sourceChamberFloorKind(input.chamber);
  const sourceVoteEvents = events.filter((event) =>
    event.chamber === input.chamber
    && (
      event.stageKind === sourceFloorKind
      || event.stageKind === 'source_chamber_passage_action'
      || event.stageKind === 'source_chamber_failed_passage_action'
    ));
  const expirationEvents = events
    .filter((event) => event.stageKind === 'session_expiration')
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  const positiveEvents = sourceVoteEvents
    .filter((event) => event.outcome === true || event.stageKind === 'source_chamber_passage_action')
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  const failedEvents = sourceVoteEvents
    .filter((event) => event.outcome === false || event.stageKind === 'source_chamber_failed_passage_action')
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  let terminalOutcome: LifecycleTerminalOutcome;
  let terminalEvent: LifecycleP3Event | undefined;

  if (input.authoritativePassage) {
    terminalOutcome = 'source_chamber_passed';
    terminalEvent = positiveEvents[0] ?? sourceVoteEvents[0];
  } else if (expirationEvents.length > 0) {
    terminalOutcome = 'session_expired_without_source_chamber_passage';
    terminalEvent = expirationEvents[0];
  } else {
    terminalOutcome = 'source_chamber_passage_vote_failed';
    terminalEvent = failedEvents[0];
  }

  if (!terminalEvent) {
    throw new Error(`${input.sessionSlug}/${input.identifier}: no terminal lifecycle evidence is available`);
  }
  terminalEvent.terminalOutcomeAfterEvent = terminalOutcome;

  return {
    events,
    terminalOutcome,
    eventualReachesVote: sourceVoteEvents.length > 0,
  };
}

function stageCounts(events: readonly LifecycleP3Event[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.stageKind] = (counts[event.stageKind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function latestEligibleBillVersion(
  versions: readonly LifecycleP3BillVersion[],
  cutoffDateExclusive: string,
): LifecycleP3BillVersion | null {
  return [...versions]
    .filter((version) => lifecycleDateEligibleBeforeCutoff(version.publishedOn, cutoffDateExclusive))
    .sort((left, right) =>
      right.publishedOn.localeCompare(left.publishedOn)
      || right.versionKey.localeCompare(left.versionKey))[0] ?? null;
}

function evidenceFamilyCounts(
  rows: readonly LifecycleP3EvidenceItem[],
  cutoffDateExclusive: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!lifecycleDateEligibleBeforeCutoff(row.availableOn, cutoffDateExclusive)) continue;
    counts[row.evidenceKind] = (counts[row.evidenceKind] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function snapshotId(billId: string, cutoffDateExclusive: string): string {
  return createHash('sha256')
    .update(`${LIFECYCLE_P3_DATASET_VERSION}|${billId}|${cutoffDateExclusive}`)
    .digest('hex')
    .slice(0, 24);
}

export function buildLifecycleSnapshotsForBill(input: LifecycleP3BillInput): LifecycleP3Snapshot[] {
  const introducedOn = isoDate(input.introducedOn);
  const adjournmentOn = isoDate(input.adjournmentOn);
  if (introducedOn > adjournmentOn) {
    throw new Error(`${input.sessionSlug}/${input.identifier}: introduction occurs after adjournment`);
  }

  const withAuditEvents = addVirtualAuditEvents(input);
  const terminal = assignTerminalEvents(input, withAuditEvents);
  const events = terminal.events;
  const candidateDates = [...new Set([
    introducedOn,
    ...events
      .filter((event) => isTransitionCandidate(event, input.chamber))
      .map((event) => isoDate(event.occurredOn))
      .filter((date) => date >= introducedOn),
  ])].sort();

  const snapshots: LifecycleP3Snapshot[] = [];
  let previousTransitionOn = introducedOn;

  for (const cutoffDateExclusive of candidateDates) {
    const priorEvents = events.filter((event) =>
      lifecycleDateEligibleBeforeCutoff(event.occurredOn, cutoffDateExclusive));
    const currentState = deriveLifecycleState(events, input.chamber, cutoffDateExclusive);
    const sameDay = events.filter((event) =>
      isoDate(event.occurredOn) === cutoffDateExclusive
      && isTransitionCandidate(event, input.chamber));
    const currentRank = stateRank(currentState);
    const targetRank = sameDay.reduce((rank, event) => {
      const candidate = eventStateRank(event, input.chamber);
      return candidate === null ? rank : Math.max(rank, candidate);
    }, currentRank);
    const transitionTo = targetRank > currentRank ? stateFromRank(targetRank) : null;
    const terminalOutcome = sameDay
      .map((event) => event.terminalOutcomeAfterEvent ?? null)
      .find((value): value is LifecycleTerminalOutcome => value !== null) ?? null;

    if (cutoffDateExclusive !== introducedOn && !transitionTo && !terminalOutcome) continue;

    const version = latestEligibleBillVersion(input.billVersions, cutoffDateExclusive);
    const authorshipIds = authorshipMembershipIdsAsOf(input.authorship, cutoffDateExclusive);
    const priorSourceHashes = [...new Set(priorEvents
      .map((event) => event.sourceContentSha256)
      .filter((value): value is string => Boolean(value)))].sort();
    const priorSourceUrls = [...new Set(priorEvents
      .map((event) => event.sourceUrl)
      .filter((value): value is string => Boolean(value)))].sort();
    const companions = [...new Set(priorEvents.flatMap((event) => event.companionIdentifiers))].sort();

    const reason: LifecycleP3Snapshot['cutoff']['reason'] = cutoffDateExclusive === introducedOn
      ? 'introduction'
      : terminalOutcome
        ? 'before_terminal'
        : 'before_transition';

    snapshots.push({
      schemaVersion: LIFECYCLE_P3_SNAPSHOT_SCHEMA_VERSION,
      datasetVersion: LIFECYCLE_P3_DATASET_VERSION,
      snapshotId: snapshotId(input.billId, cutoffDateExclusive),
      bill: {
        billId: input.billId,
        session: input.sessionSlug,
        chamber: input.chamber,
        identifier: input.identifier,
      },
      cutoff: {
        asOfDateExclusive: cutoffDateExclusive,
        granularity: 'date',
        sameDayExcluded: true,
        reason,
      },
      features: {
        lifecycleState: currentState,
        daysSinceIntroduction: Math.max(0, daysBetween(introducedOn, cutoffDateExclusive)),
        daysSincePreviousTransition: Math.max(0, daysBetween(previousTransitionOn, cutoffDateExclusive)),
        daysRemainingInBiennium: Math.max(0, daysBetween(cutoffDateExclusive, adjournmentOn)),
        priorProcessEventCount: priorEvents.length,
        priorProcessStageCounts: stageCounts(priorEvents),
        priorCompanionIdentifiers: companions,
        latestEligibleBillVersion: version ? {
          billVersionId: version.id,
          versionKey: version.versionKey,
          publishedOn: version.publishedOn,
          textHash: version.textHash,
          textLengthChars: version.textLengthChars,
        } : null,
        authorship: {
          reconstructable: authorshipIds !== undefined,
          membershipIds: authorshipIds ? [...authorshipIds].sort() : null,
          parserVersion: input.authorship?.parserVersion ?? null,
        },
        evidenceFamilyCounts: evidenceFamilyCounts(input.evidence, cutoffDateExclusive),
      },
      targets: {
        transitionOnCutoffDate: {
          stageKinds: [...new Set(sameDay.map((event) => event.stageKind))].sort(),
          toState: transitionTo,
          terminalOutcome,
        },
        eventualSourceChamberPassage: input.authoritativePassage,
        eventualReachesSourceChamberPassageVote: terminal.eventualReachesVote,
        terminalOutcome: terminal.terminalOutcome,
        memberVoteLabel: null,
      },
      lineage: {
        introductionParserVersion: input.introductionParserVersion,
        processParserVersion: input.processParserVersion,
        processAuditVersion: input.processAuditVersion,
        processStatus: input.processStatus,
        passageLabelVersion: input.passageLabelVersion,
        priorProcessSourceDocumentSha256: priorSourceHashes,
        priorProcessSourceUrls,
      },
    });

    if (transitionTo) previousTransitionOn = cutoffDateExclusive;
    if (terminalOutcome) break;
  }

  if (snapshots.length === 0 || snapshots[0].cutoff.reason !== 'introduction') {
    throw new Error(`${input.sessionSlug}/${input.identifier}: introduction snapshot was not produced`);
  }
  if (!snapshots.some((snapshot) => snapshot.targets.transitionOnCutoffDate.terminalOutcome !== null)) {
    throw new Error(`${input.sessionSlug}/${input.identifier}: terminal snapshot was not produced`);
  }
  return snapshots;
}

function groupByBill<T extends { bill_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.bill_id) ?? [];
    bucket.push(row);
    grouped.set(row.bill_id, bucket);
  }
  return grouped;
}

function laterDate(left: string, right: string | null): string {
  if (!right) return left;
  return left > right ? left : right;
}

export async function buildLifecycleP3SnapshotDataset(codeSha: string | null = null) {
  const [billResult, eventResult, versionResult, evidenceResult] = await Promise.all([
    pool.query<BillRow>(`
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             b.identifier,
             COALESCE(
               b.metadata #>> '{revisorIntroduction,introducedOn}',
               b.introduced_at::date::text
             ) AS introduced_on,
             b.metadata #>> '{sourceChamberPassage,officialAdjournmentDate}' AS adjournment_on,
             (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS authoritative_passage,
             b.metadata #>> '{sourceChamberPassage,labelVersion}' AS passage_label_version,
             b.metadata #>> '{revisorIntroduction,parserVersion}' AS introduction_parser_version,
             b.metadata #>> '{revisorProcessHistory,parserVersion}' AS process_parser_version,
             b.metadata #>> '{revisorProcessHistory,auditVersion}' AS process_audit_version,
             b.metadata #>> '{revisorProcessHistory,status}' AS process_status,
             b.metadata #>> '{revisorProcessHistory,sourceUrl}' AS process_source_url,
             b.metadata #>> '{revisorProcessHistory,contentSha256}' AS process_content_sha256,
             b.metadata #>> '{revisorProcessHistory,sourceChamberPassageOn}' AS passage_on,
             b.metadata #>> '{revisorProcessHistory,sourceChamberFailureOn}' AS failure_on,
             b.metadata -> 'revisorAuthorship' AS authorship
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
       ORDER BY s.starts_on,c.slug,b.identifier`),
    pool.query<EventRow>(`
      SELECT se.id::text,
             se.bill_id::text,
             se.occurred_at::date::text AS occurred_on,
             c.slug AS chamber_slug,
             se.stage_kind,
             se.outcome,
             se.source_url,
             se.source_document_id::text,
             sd.content_sha256,
             se.metadata ->> 'parserVersion' AS parser_version,
             se.metadata -> 'companionIdentifiers' AS companion_identifiers
        FROM legislative_stage_events se
        JOIN bills b ON b.id=se.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        LEFT JOIN chambers c ON c.id=se.chamber_id
        LEFT JOIN source_documents sd ON sd.id=se.source_document_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
         AND (
           se.metadata ->> 'parserVersion' = $1
           OR se.stage_kind IN ('session_expiration','house_floor_passage','senate_floor_passage')
         )
       ORDER BY se.bill_id,se.occurred_at,se.stage_kind,se.id`, [REVISOR_PROCESS_PARSER_VERSION]),
    pool.query<VersionRow>(`
      SELECT bv.bill_id::text,
             bv.id::text,
             bv.version_key,
             bv.published_at::date::text AS published_on,
             bv.text_hash,
             CASE WHEN bv.raw_text IS NULL THEN NULL ELSE length(bv.raw_text) END::int AS text_length_chars
        FROM bill_versions bv
        JOIN bills b ON b.id=bv.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
         AND bv.published_at IS NOT NULL
       ORDER BY bv.bill_id,bv.published_at,bv.version_key`),
    pool.query<EvidenceRow>(`
      SELECT ei.bill_id::text,
             ei.evidence_kind,
             sd.fetched_at::date::text AS fetched_on,
             ei.published_at::date::text AS published_on
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN bills b ON b.id=ei.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
         AND COALESCE(ei.metadata ->> 'asOfEligible','true') <> 'false'
       ORDER BY ei.bill_id,sd.fetched_at,ei.published_at,ei.evidence_kind`),
  ]);

  if (billResult.rows.length !== LIFECYCLE_P3_EXPECTED_BILLS) {
    throw new Error(
      `Lifecycle P3 population drift: ${billResult.rows.length}/${LIFECYCLE_P3_EXPECTED_BILLS} frozen bills`,
    );
  }

  const parsedBills = billResult.rows.filter((row) =>
    row.process_parser_version === REVISOR_PROCESS_PARSER_VERSION).length;
  const parserCoverage = parsedBills / billResult.rows.length;
  if (parserCoverage < MIN_REVISOR_PROCESS_RESEARCH_COVERAGE) {
    throw new Error(
      `Lifecycle P3 refuses to build below the frozen process coverage gate: ${(parserCoverage * 100).toFixed(2)}%`,
    );
  }

  const eventsByBill = groupByBill(eventResult.rows);
  const versionsByBill = groupByBill(versionResult.rows);
  const evidenceByBill = groupByBill(evidenceResult.rows);
  const snapshots: LifecycleP3Snapshot[] = [];

  for (const bill of billResult.rows) {
    if (!bill.introduced_on) throw new Error(`${bill.session_slug}/${bill.identifier}: missing introduction date`);
    if (!bill.adjournment_on) throw new Error(`${bill.session_slug}/${bill.identifier}: missing official adjournment date`);
    if (bill.authoritative_passage === null) throw new Error(`${bill.session_slug}/${bill.identifier}: missing authoritative passage label`);
    if (!bill.passage_label_version) throw new Error(`${bill.session_slug}/${bill.identifier}: missing passage label version`);

    const events: LifecycleP3Event[] = (eventsByBill.get(bill.bill_id) ?? []).map((row) => ({
      eventKey: row.id,
      occurredOn: row.occurred_on,
      chamber: row.chamber_slug,
      stageKind: row.stage_kind,
      outcome: row.outcome,
      sourceUrl: row.source_url,
      sourceDocumentId: row.source_document_id,
      sourceContentSha256: row.content_sha256,
      parserVersion: row.parser_version,
      companionIdentifiers: normalizedCompanions(row.companion_identifiers),
    }));
    const billVersions: LifecycleP3BillVersion[] = (versionsByBill.get(bill.bill_id) ?? []).map((row) => ({
      id: row.id,
      versionKey: row.version_key,
      publishedOn: row.published_on,
      textHash: row.text_hash,
      textLengthChars: row.text_length_chars,
    }));
    const evidence: LifecycleP3EvidenceItem[] = (evidenceByBill.get(bill.bill_id) ?? []).map((row) => ({
      evidenceKind: row.evidence_kind,
      availableOn: laterDate(row.fetched_on, row.published_on),
    }));

    snapshots.push(...buildLifecycleSnapshotsForBill({
      billId: bill.bill_id,
      sessionSlug: bill.session_slug,
      chamber: bill.chamber_slug,
      identifier: bill.identifier,
      introducedOn: bill.introduced_on,
      adjournmentOn: bill.adjournment_on,
      authoritativePassage: bill.authoritative_passage,
      passageLabelVersion: bill.passage_label_version,
      introductionParserVersion: bill.introduction_parser_version,
      processParserVersion: bill.process_parser_version,
      processAuditVersion: bill.process_audit_version,
      processStatus: bill.process_status,
      processSourceUrl: bill.process_source_url,
      processContentSha256: bill.process_content_sha256,
      sourceChamberPassageOn: bill.passage_on,
      sourceChamberFailureOn: bill.failure_on,
      authorship: bill.authorship,
      events,
      billVersions,
      evidence,
    }));
  }

  snapshots.sort((left, right) =>
    left.bill.session.localeCompare(right.bill.session)
    || left.bill.chamber.localeCompare(right.bill.chamber)
    || left.bill.identifier.localeCompare(right.bill.identifier)
    || left.cutoff.asOfDateExclusive.localeCompare(right.cutoff.asOfDateExclusive));

  const digest = createHash('sha256');
  for (const snapshot of snapshots) digest.update(`${JSON.stringify(snapshot)}\n`);

  const bySession: Record<string, { bills: number; snapshots: number }> = {};
  for (const bill of billResult.rows) {
    const bucket = bySession[bill.session_slug] ?? { bills: 0, snapshots: 0 };
    bucket.bills += 1;
    bySession[bill.session_slug] = bucket;
  }
  for (const snapshot of snapshots) bySession[snapshot.bill.session].snapshots += 1;

  const byState = Object.fromEntries(
    [...new Set(snapshots.map((snapshot) => snapshot.features.lifecycleState))]
      .sort()
      .map((state) => [state, snapshots.filter((snapshot) => snapshot.features.lifecycleState === state).length]),
  );
  const terminalCounts = Object.fromEntries(
    [...new Set(snapshots.map((snapshot) => snapshot.targets.terminalOutcome))]
      .sort()
      .map((terminalOutcome) => [
        terminalOutcome,
        billResult.rows.filter((row) => {
          if (terminalOutcome === 'source_chamber_passed') return row.authoritative_passage === true;
          const billSnapshots = snapshots.filter((snapshot) => snapshot.bill.billId === row.bill_id);
          return billSnapshots[0]?.targets.terminalOutcome === terminalOutcome;
        }).length,
      ]),
  );

  const manifest = {
    schemaVersion: LIFECYCLE_P3_SNAPSHOT_SCHEMA_VERSION,
    datasetVersion: LIFECYCLE_P3_DATASET_VERSION,
    generatedAt: new Date().toISOString(),
    codeSha,
    population: {
      targetBills: billResult.rows.length,
      parsedProcessBills: parsedBills,
      pendingProcessBills: billResult.rows.length - parsedBills,
      parserCoverage,
      minimumParserCoverage: MIN_REVISOR_PROCESS_RESEARCH_COVERAGE,
      authoritativePassageLabels: billResult.rows.filter((row) => row.authoritative_passage !== null).length,
      snapshots: snapshots.length,
      bySession,
    },
    cutoffPolicy: {
      calendarDateExclusive: true,
      sameDayExcludedWhenOrderingIsNotProvable: true,
      mutableCurrentBillStateForbidden: true,
      processEventsRequireOccurredOnBeforeCutoff: true,
      billVersionsRequirePublishedOnBeforeCutoff: true,
      evidenceRequiresFetchedAndPublishedAvailabilityBeforeCutoff: true,
      authorshipRequiresCompleteAsOfReconstruction: true,
    },
    targetPolicy: {
      strictBillNumberSourceChamberPassage: true,
      memberVoteLabelsManufactured: 0,
      nonVoteBillsRemainLifecycleObservations: true,
    },
    lineage: {
      processParserVersion: REVISOR_PROCESS_PARSER_VERSION,
      processAuditVersion: REVISOR_PROCESS_AUDIT_VERSION,
      snapshotSchemaVersion: LIFECYCLE_P3_SNAPSHOT_SCHEMA_VERSION,
      datasetVersion: LIFECYCLE_P3_DATASET_VERSION,
    },
    diagnostics: {
      byState,
      terminalCounts,
      snapshotsWithEligibleBillText: snapshots.filter((snapshot) => snapshot.features.latestEligibleBillVersion !== null).length,
      snapshotsWithReconstructableAuthorship: snapshots.filter((snapshot) => snapshot.features.authorship.reconstructable).length,
      snapshotsWithEligibleEvidence: snapshots.filter((snapshot) =>
        Object.values(snapshot.features.evidenceFamilyCounts).some((count) => count > 0)).length,
    },
    snapshotContentSha256: digest.digest('hex'),
  } as const;

  return { manifest, snapshots };
}
