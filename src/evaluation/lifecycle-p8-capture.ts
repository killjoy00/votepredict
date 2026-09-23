import { createHash } from 'node:crypto';
import {
  authorshipMembershipIdsAsOf,
  type StoredRevisorAuthorship,
} from '../forecasting/quick-evidence-authorship';
import {
  deriveLifecycleState,
  lifecycleDateEligibleBeforeCutoff,
  type LifecycleP3BillVersion,
  type LifecycleP3Event,
  type LifecycleState,
} from './lifecycle-p3-snapshot-dataset';
import { REVISOR_PROCESS_PARSER_VERSION } from '../sources/minnesota/revisor-process';

export const LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION = 'lifecycle-p8-daily-capture-v1' as const;
export const LIFECYCLE_P8_CAPTURE_TIME_ZONE = 'America/Chicago' as const;

export interface LifecycleP8CaptureEvidence {
  evidenceKind: string;
  fetchedOn: string;
  publishedOn: string | null;
}

export interface LifecycleP8CaptureBillInput {
  billId: string;
  sessionId: string;
  sessionSlug: '2027-2028';
  chamber: 'house' | 'senate';
  identifier: string;
  title: string;
  introducedOn: string;
  adjournmentOn: string;
  introductionParserVersion: string | null;
  processParserVersion: string | null;
  processAuditVersion: string | null;
  processStatus: string | null;
  authorship: StoredRevisorAuthorship | null;
  events: LifecycleP3Event[];
  versions: LifecycleP3BillVersion[];
  evidence: LifecycleP8CaptureEvidence[];
}

export interface LifecycleP8FeatureSnapshot {
  snapshotId: string;
  bill: {
    billId: string;
    session: '2027-2028';
    chamber: 'house' | 'senate';
    identifier: string;
  };
  cutoff: {
    asOfDateExclusive: string;
    granularity: 'date';
    sameDayExcluded: true;
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
  lineage: {
    introductionParserVersion: string | null;
    processParserVersion: string | null;
    processAuditVersion: string | null;
    processStatus: string | null;
    priorProcessSourceDocumentSha256: string[];
    priorProcessSourceUrls: string[];
  };
}

function datePart(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error('Expected ISO date: ' + value);
  return match[1];
}

function dayNumber(value: string): number {
  const parsed = Date.parse(datePart(value) + 'T00:00:00Z');
  if (!Number.isFinite(parsed)) throw new Error('Invalid date: ' + value);
  return Math.floor(parsed / 86_400_000);
}

function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

function stageCounts(events: readonly LifecycleP3Event[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.stageKind] = (counts[event.stageKind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function latestVersion(
  versions: readonly LifecycleP3BillVersion[],
  cutoffDateExclusive: string,
) {
  return [...versions]
    .filter((version) => lifecycleDateEligibleBeforeCutoff(version.publishedOn, cutoffDateExclusive))
    .sort((a, b) =>
      b.publishedOn.localeCompare(a.publishedOn) || b.versionKey.localeCompare(a.versionKey))[0] ?? null;
}

function evidenceCounts(
  rows: readonly LifecycleP8CaptureEvidence[],
  cutoffDateExclusive: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const availableOn = row.publishedOn && row.publishedOn > row.fetchedOn
      ? row.publishedOn
      : row.fetchedOn;
    if (!lifecycleDateEligibleBeforeCutoff(availableOn, cutoffDateExclusive)) continue;
    counts[row.evidenceKind] = (counts[row.evidenceKind] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function lifecycleP8ChicagoCutoffDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIFECYCLE_P8_CAPTURE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function buildLifecycleP8FeatureSnapshot(
  input: LifecycleP8CaptureBillInput,
  cutoffDateExclusive: string,
): LifecycleP8FeatureSnapshot {
  const introducedOn = datePart(input.introducedOn);
  const cutoff = datePart(cutoffDateExclusive);
  const adjournmentOn = datePart(input.adjournmentOn);
  if (introducedOn >= cutoff) {
    throw new Error(input.identifier + ': daily P8 capture requires introduction strictly before cutoff');
  }
  const priorEvents = input.events
    .filter((event) => lifecycleDateEligibleBeforeCutoff(event.occurredOn, cutoff))
    .sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn)
      || a.stageKind.localeCompare(b.stageKind)
      || a.eventKey.localeCompare(b.eventKey));
  const lifecycleState = deriveLifecycleState(priorEvents, input.chamber, cutoff);
  const transitionDates = input.events
    .filter((event) => lifecycleDateEligibleBeforeCutoff(event.occurredOn, cutoff))
    .filter((event) => {
      const before = deriveLifecycleState(input.events, input.chamber, event.occurredOn);
      const afterCutoff = new Date((dayNumber(event.occurredOn) + 1) * 86_400_000)
        .toISOString().slice(0, 10);
      const after = deriveLifecycleState(input.events, input.chamber, afterCutoff);
      return before !== after;
    })
    .map((event) => datePart(event.occurredOn))
    .sort();
  const previousTransition = transitionDates.at(-1) ?? introducedOn;
  const version = latestVersion(input.versions, cutoff);
  const authorIds = authorshipMembershipIdsAsOf(input.authorship, cutoff);
  const priorHashes = [...new Set(priorEvents
    .map((event) => event.sourceContentSha256)
    .filter((value): value is string => Boolean(value)))].sort();
  const priorUrls = [...new Set(priorEvents
    .map((event) => event.sourceUrl)
    .filter((value): value is string => Boolean(value)))].sort();
  const companions = [...new Set(priorEvents.flatMap((event) => event.companionIdentifiers))].sort();
  const snapshotId = createHash('sha256')
    .update(LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION + '|' + input.billId + '|' + cutoff)
    .digest('hex').slice(0, 24);

  return {
    snapshotId,
    bill: {
      billId: input.billId,
      session: input.sessionSlug,
      chamber: input.chamber,
      identifier: input.identifier,
    },
    cutoff: { asOfDateExclusive: cutoff, granularity: 'date', sameDayExcluded: true },
    features: {
      lifecycleState,
      daysSinceIntroduction: Math.max(0, daysBetween(introducedOn, cutoff)),
      daysSincePreviousTransition: Math.max(0, daysBetween(previousTransition, cutoff)),
      daysRemainingInBiennium: Math.max(0, daysBetween(cutoff, adjournmentOn)),
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
        reconstructable: authorIds !== undefined,
        membershipIds: authorIds ? [...authorIds].sort() : null,
        parserVersion: input.authorship?.parserVersion ?? null,
      },
      evidenceFamilyCounts: evidenceCounts(input.evidence, cutoff),
    },
    lineage: {
      introductionParserVersion: input.introductionParserVersion,
      processParserVersion: input.processParserVersion,
      processAuditVersion: input.processAuditVersion,
      processStatus: input.processStatus,
      priorProcessSourceDocumentSha256: priorHashes,
      priorProcessSourceUrls: priorUrls,
    },
  };
}

export function lifecycleP8ProcessSourceCovered(snapshot: LifecycleP8FeatureSnapshot): boolean {
  return snapshot.lineage.processParserVersion === REVISOR_PROCESS_PARSER_VERSION;
}

export function lifecycleP8CaptureContentSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
