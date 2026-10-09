/**
 * P8 daily CAPTURE PROTOTYPE, intentionally offline and outcome-blind.
 *
 * Does not query a database, acquire credentials, collect sources, fit models,
 * score outcomes, or activate a future-session capture cadence. The real 2027
 * capture/serving adapter requires separate operational authorization.
 */
import { createHash } from 'node:crypto';
import {
  deriveLifecycleState,
  type LifecycleP3Event,
  type LifecycleP3Snapshot,
} from './lifecycle-p3-snapshot-dataset';
import { LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256 } from './lifecycle-p8-prospective';
import { REVISOR_PROCESS_PARSER_VERSION } from '../sources/minnesota/revisor-process';

export const P8_DAILY_CAPTURE_SCHEMA = 'lifecycle-p8-daily-asof-v1' as const;
export const P8_DAILY_CAPTURE_SESSION = '2027-2028' as const;
export const P8_DAILY_CAPTURE_TIMEZONE = 'America/Chicago' as const;

type Chamber = 'house' | 'senate';

export interface P8ObservedProcessEvent {
  eventKey: string;
  occurredOn: string;
  observedAt: string;
  chamber: Chamber;
  stageKind: string;
  sourceUrl: string;
  sourceSha256: string;
  companionIdentifiers: string[];
}

export interface P8ObservedBillVersion {
  id: string;
  versionKey: string;
  publishedOn: string;
  observedAt: string;
  sourceUrl: string;
  sourceSha256: string;
  textHash: string | null;
  textLengthChars: number | null;
}

export interface P8DailyBillInput {
  billId: string;
  session: typeof P8_DAILY_CAPTURE_SESSION;
  chamber: Chamber;
  identifier: string;
  introducedOn: string;
  adjournmentOn: string;
  firstObservedAt: string;
  sourceUrl: string;
  sourceSha256: string;
  /** Required for official-receipt input, optional for original synthetic fixtures. */
  calendarEvidence?: {
    sourceUrl: string;
    sourceSha256: string;
    observedAt: string;
    adjournmentOn: string;
  };
  process: {
    status: 'parsed' | 'source_deferred';
    observedAt: string | null;
    parserVersion: typeof REVISOR_PROCESS_PARSER_VERSION | null;
    events: P8ObservedProcessEvent[];
  };
  billVersions: P8ObservedBillVersion[];
}

export type P8DailyCaptureFeatures = LifecycleP3Snapshot['features'];

export interface P8DailyCaptureRow {
  schemaVersion: typeof P8_DAILY_CAPTURE_SCHEMA;
  rowId: string;
  bill: {
    billId: string;
    session: typeof P8_DAILY_CAPTURE_SESSION;
    chamber: Chamber;
    identifier: string;
  };
  cutoff: {
    asOfDateExclusive: string;
    timezone: typeof P8_DAILY_CAPTURE_TIMEZONE;
    sameDayExcluded: true;
  };
  features: P8DailyCaptureFeatures;
  lineage: {
    billSourceSha256: string;
    billSourceUrl: string;
    introducedOn: string;
    adjournmentOn: string;
    firstObservedAt: string;
    calendarEvidence: {
      sourceUrl: string;
      sourceSha256: string;
      observedAt: string;
      adjournmentOn: string;
    } | null;
    processStatus: 'parsed' | 'source_deferred' | 'not_observable_by_cutoff';
    processSourceEligible: boolean;
    processObservedAt: string | null;
    processParserVersion: typeof REVISOR_PROCESS_PARSER_VERSION | null;
    eligibleProcessEvents: Array<{
      eventKey: string;
      occurredOn: string;
      observedAt: string;
      stageKind: string;
      chamber: Chamber;
      sourceUrl: string;
      sourceSha256: string;
    }>;
    eligibleBillVersions: Array<{
      id: string;
      versionKey: string;
      publishedOn: string;
      observedAt: string;
      sourceUrl: string;
      sourceSha256: string;
    }>;
    observedProcessSourceSha256: string[];
    observedVersionSourceSha256: string[];
    observedProcessUrls: string[];
    observedVersionUrls: string[];
    externalEvidence: 'not_collected';
    authorship: 'not_reconstructed';
  };
  model: {
    frozenModelContentSha256Reference: typeof LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256;
    predictionsComputed: false;
  };
  memberVoteLabel: null;
  contentSha256: string;
}

export interface P8DailyCaptureBatch {
  schemaVersion: typeof P8_DAILY_CAPTURE_SCHEMA;
  session: typeof P8_DAILY_CAPTURE_SESSION;
  cutoffDateExclusive: string;
  capturedAt: string;
  timezone: typeof P8_DAILY_CAPTURE_TIMEZONE;
  source: 'offline_supplied_asof_fixtures' | 'offline_observed_revisor_receipts';
  frozenModelContentSha256Reference: typeof LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256;
  outcomeRead: false;
  productionCaptureActivated: false;
  servingChanged: false;
  predictionsComputed: false;
  rows: P8DailyCaptureRow[];
  contentSha256: string;
}

const OFFICIAL_HOSTS = new Set(['revisor.mn.gov', 'www.revisor.mn.gov', 'api.revisor.mn.gov']);
const NON_TERMINAL_PROCESS_KINDS = new Set([
  'committee_referral', 'committee_report', 'rules_referral',
  'second_reading', 'floor_scheduled', 'amendment_activity',
  'author_added', 'cross_chamber_received', 'companion_reference',
]);
const COMMITTEE_KINDS = new Set(['committee_referral', 'committee_report', 'rules_referral']);
const FLOOR_KINDS = new Set(['second_reading', 'floor_scheduled']);

function assertOnlyKeys(value: unknown, keys: readonly string[], label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(label + ': unexpected field ' + key);
  }
}

function dateOnly(value: string, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(label + ' must be a strict YYYY-MM-DD date');
  }
  const candidate = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' is not a valid date');
  }
  return value;
}

function dateFromInstant(value: string, label: string): string {
  if (typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(label + ' must be an offset-aware ISO instant');
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error(label + ' is not a valid instant');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: P8_DAILY_CAPTURE_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (kind: string) => parts.find(part => part.type === kind)?.value;
  return [get('year'), get('month'), get('day')].join('-');
}

function dayIndex(value: string): number {
  return Date.parse(value + 'T00:00:00Z') / 86_400_000;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateSource(url: string, contentHash: string, label: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(label + ' has invalid official URL'); }
  if (parsed.protocol !== 'https:' || !OFFICIAL_HOSTS.has(parsed.hostname)
      || parsed.username || parsed.password) {
    throw new Error(label + ' must link to the official HTTPS Revisor source');
  }
  if (typeof contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new Error(label + ' must retain a SHA-256 source hash');
  }
}

function validateBill(input: P8DailyBillInput): void {
  assertOnlyKeys(input,
    ['billId', 'session', 'chamber', 'identifier', 'introducedOn', 'adjournmentOn',
      'firstObservedAt', 'sourceUrl', 'sourceSha256', 'calendarEvidence',
      'process', 'billVersions'], 'bill');
  if (input.session !== P8_DAILY_CAPTURE_SESSION ||
      (input.chamber !== 'house' && input.chamber !== 'senate') ||
      typeof input.billId !== 'string' || !input.billId.trim() ||
      typeof input.identifier !== 'string' ||
      !/^(HF|SF)\d+$/i.test(input.identifier) ||
      (input.chamber === 'house' && !/^HF/i.test(input.identifier)) ||
      (input.chamber === 'senate' && !/^SF/i.test(input.identifier))) {
    throw new Error('Invalid P8 session, bill identity, or source chamber');
  }
  dateOnly(input.introducedOn, 'introducedOn');
  dateOnly(input.adjournmentOn, 'adjournmentOn');
  if (input.introducedOn > input.adjournmentOn) throw new Error('Introduction after adjournment');
  dateFromInstant(input.firstObservedAt, 'bill firstObservedAt');
  validateSource(input.sourceUrl, input.sourceSha256, 'bill');
  if (input.calendarEvidence !== undefined) {
    const calendar = input.calendarEvidence;
    assertOnlyKeys(calendar, ['sourceUrl', 'sourceSha256', 'observedAt', 'adjournmentOn'], 'calendarEvidence');
    dateOnly(calendar.adjournmentOn, 'calendar adjournmentOn');
    if (calendar.adjournmentOn !== input.adjournmentOn) {
      throw new Error('Official calendar evidence conflicts with bill adjournment date');
    }
    const observedOn = dateFromInstant(calendar.observedAt, 'calendar observedAt');
    if (observedOn > input.introducedOn && observedOn > input.adjournmentOn) {
      throw new Error('Calendar observation is after the recorded adjournment');
    }
    validateSource(calendar.sourceUrl, calendar.sourceSha256, 'calendar');
  }
  assertOnlyKeys(input.process, ['status', 'observedAt', 'parserVersion', 'events'], 'process');
  if (!Array.isArray(input.process.events) || !Array.isArray(input.billVersions)) {
    throw new Error('process events and bill versions must be arrays');
  }
  if (input.process.status === 'source_deferred') {
    if (input.process.parserVersion !== null || input.process.observedAt !== null ||
        input.process.events.length !== 0) throw new Error('Deferred process must not imply observed data');
  } else if (input.process.status === 'parsed') {
    if (input.process.parserVersion !== REVISOR_PROCESS_PARSER_VERSION ||
        input.process.observedAt === null) {
      throw new Error('Process must have a timestamp and the exact frozen parser version');
    }
    dateFromInstant(input.process.observedAt, 'process observedAt');
  } else {
    throw new Error('Unsupported process source status');
  }

  const seen = new Set<string>();
  for (const event of input.process.events) {
    assertOnlyKeys(event,
      ['eventKey', 'occurredOn', 'observedAt', 'chamber', 'stageKind', 'sourceUrl',
        'sourceSha256', 'companionIdentifiers'], 'event');
    if (typeof event.eventKey !== 'string' || !event.eventKey.trim() ||
        seen.has(event.eventKey)) throw new Error('Process event key missing or duplicated');
    seen.add(event.eventKey);
    dateOnly(event.occurredOn, 'event occurredOn');
    if (event.occurredOn < input.introducedOn) {
      throw new Error('Process event predates official bill introduction');
    }
    const observedOn = dateFromInstant(event.observedAt, 'event observedAt');
    if (observedOn < event.occurredOn) throw new Error('Process event observed before occurrence');
    if (!NON_TERMINAL_PROCESS_KINDS.has(event.stageKind) ||
      (event.chamber !== 'house' && event.chamber !== 'senate')) {
      throw new Error('Terminal, outcome or unknown process stage forbidden in P8 capture');
    }
    if (!Array.isArray(event.companionIdentifiers) ||
        event.companionIdentifiers.some(x => typeof x !== 'string')) {
      throw new Error('Invalid process companion identifiers');
    }
    validateSource(event.sourceUrl, event.sourceSha256, 'event');
  }
  for (const version of input.billVersions) {
    assertOnlyKeys(version, ['id', 'versionKey', 'publishedOn', 'observedAt', 'sourceUrl',
      'sourceSha256', 'textHash', 'textLengthChars'], 'version');
    if (typeof version.id !== 'string' || !version.id ||
        typeof version.versionKey !== 'string' || !version.versionKey) {
      throw new Error('Missing official version identity');
    }
    dateOnly(version.publishedOn, 'version publishedOn');
    if (dateFromInstant(version.observedAt, 'version observedAt') < version.publishedOn) {
      throw new Error('Official version observed before publication');
    }
    if (version.textHash !== null && typeof version.textHash !== 'string') {
      throw new Error('Invalid version text hash');
    }
    if (version.textLengthChars !== null &&
        (!Number.isSafeInteger(version.textLengthChars) || version.textLengthChars < 0)) {
      throw new Error('Invalid version text length');
    }
    validateSource(version.sourceUrl, version.sourceSha256, 'version');
  }
}

function sourceEarlierThanCutoff(observedAt: string, cutoff: string): boolean {
  return dateFromInstant(observedAt, 'source observedAt') < cutoff;
}

function rowForBill(bill: P8DailyBillInput, cutoff: string): P8DailyCaptureRow {
  const processSourceEligible = bill.process.status === 'parsed' &&
    sourceEarlierThanCutoff(bill.process.observedAt!, cutoff);
  const events = (processSourceEligible ? bill.process.events : [])
    .filter(event => event.occurredOn < cutoff && sourceEarlierThanCutoff(event.observedAt, cutoff))
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) ||
      a.stageKind.localeCompare(b.stageKind) || a.eventKey.localeCompare(b.eventKey));
  const versions = bill.billVersions
    .filter(version => version.publishedOn < cutoff &&
      sourceEarlierThanCutoff(version.observedAt, cutoff))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) ||
      b.versionKey.localeCompare(a.versionKey) || b.id.localeCompare(a.id));
  let lastTransitionDate = bill.introducedOn;
  let stateRank = 0;
  for (const event of events) {
    if (event.chamber !== bill.chamber) continue;
    const rank = COMMITTEE_KINDS.has(event.stageKind) ? 1 :
      FLOOR_KINDS.has(event.stageKind) ? 2 : null;
    if (rank !== null && rank > stateRank) {
      stateRank = rank;
      lastTransitionDate = event.occurredOn;
    }
  }

  const p3Events: LifecycleP3Event[] = events.map(event => ({
    eventKey: event.eventKey,
    occurredOn: event.occurredOn,
    chamber: event.chamber,
    stageKind: event.stageKind,
    outcome: null,
    sourceUrl: event.sourceUrl,
    sourceDocumentId: null,
    sourceContentSha256: event.sourceSha256,
    parserVersion: REVISOR_PROCESS_PARSER_VERSION,
    companionIdentifiers: event.companionIdentifiers,
  }));
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.stageKind] = (counts[event.stageKind] ?? 0) + 1;
  const version = versions[0] ?? null;
  const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort();
  const processStatus: P8DailyCaptureRow['lineage']['processStatus'] =
    bill.process.status === 'source_deferred' ? 'source_deferred'
    : processSourceEligible ? 'parsed' : 'not_observable_by_cutoff';
  const content = {
    schemaVersion: P8_DAILY_CAPTURE_SCHEMA,
    rowId: sha256([P8_DAILY_CAPTURE_SCHEMA, bill.billId, cutoff]).slice(0, 32),
    bill: {
      billId: bill.billId,
      session: P8_DAILY_CAPTURE_SESSION,
      chamber: bill.chamber,
      identifier: bill.identifier,
    },
    cutoff: {
      asOfDateExclusive: cutoff,
      timezone: P8_DAILY_CAPTURE_TIMEZONE,
      sameDayExcluded: true as const,
    },
    features: {
      lifecycleState: deriveLifecycleState(p3Events, bill.chamber, cutoff),
      daysSinceIntroduction: dayIndex(cutoff) - dayIndex(bill.introducedOn),
      daysSincePreviousTransition: dayIndex(cutoff) - dayIndex(lastTransitionDate),
      daysRemainingInBiennium: dayIndex(bill.adjournmentOn) - dayIndex(cutoff),
      priorProcessEventCount: events.length,
      priorProcessStageCounts: Object.fromEntries(Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))),
      priorCompanionIdentifiers: uniqueSorted(events.flatMap(event => event.companionIdentifiers)),
      latestEligibleBillVersion: version ? {
        billVersionId: version.id,
        versionKey: version.versionKey,
        publishedOn: version.publishedOn,
        textHash: version.textHash,
        textLengthChars: version.textLengthChars,
      } : null,
      authorship: { reconstructable: false, membershipIds: null, parserVersion: null },
      evidenceFamilyCounts: {},
    } satisfies P8DailyCaptureFeatures,
    lineage: {
      billSourceSha256: bill.sourceSha256,
      billSourceUrl: bill.sourceUrl,
      introducedOn: bill.introducedOn,
      adjournmentOn: bill.adjournmentOn,
      firstObservedAt: bill.firstObservedAt,
      calendarEvidence: bill.calendarEvidence ? { ...bill.calendarEvidence } : null,
      processStatus,
      processSourceEligible,
      processObservedAt: processSourceEligible ? bill.process.observedAt : null,
      processParserVersion: processSourceEligible ? REVISOR_PROCESS_PARSER_VERSION : null,
      eligibleProcessEvents: events.map(event => ({
        eventKey: event.eventKey,
        occurredOn: event.occurredOn,
        observedAt: event.observedAt,
        stageKind: event.stageKind,
        chamber: event.chamber,
        sourceUrl: event.sourceUrl,
        sourceSha256: event.sourceSha256,
      })),
      eligibleBillVersions: versions.map(version => ({
        id: version.id,
        versionKey: version.versionKey,
        publishedOn: version.publishedOn,
        observedAt: version.observedAt,
        sourceUrl: version.sourceUrl,
        sourceSha256: version.sourceSha256,
      })),
      observedProcessSourceSha256: uniqueSorted(events.map(event => event.sourceSha256)),
      observedVersionSourceSha256: uniqueSorted(versions.map(v => v.sourceSha256)),
      observedProcessUrls: uniqueSorted(events.map(event => event.sourceUrl)),
      observedVersionUrls: uniqueSorted(versions.map(v => v.sourceUrl)),
      externalEvidence: 'not_collected' as const,
      authorship: 'not_reconstructed' as const,
    },
    model: {
      frozenModelContentSha256Reference: LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256,
      predictionsComputed: false as const,
    },
    memberVoteLabel: null,
  };
  return { ...content, contentSha256: sha256(content) };
}

export function buildOfflineP8DailyCapture(input: {
  cutoffDateExclusive: string;
  capturedAt: string;
  bills: readonly P8DailyBillInput[];
  source?: P8DailyCaptureBatch['source'];
}): P8DailyCaptureBatch {
  assertOnlyKeys(input, ['cutoffDateExclusive', 'capturedAt', 'bills', 'source'], 'capture');
  const cutoff = dateOnly(input.cutoffDateExclusive, 'cutoffDateExclusive');
  if (cutoff < '2027-01-01' || cutoff > '2028-12-31') {
    throw new Error('P8 daily capture accepts only 2027-2028 dates');
  }
  if (dateFromInstant(input.capturedAt, 'capturedAt') !== cutoff) {
    throw new Error('Captured instant must be on the declared America/Chicago calendar day');
  }
  if (!Array.isArray(input.bills)) throw new Error('Capture bills must be an array');
  if (input.source !== undefined && input.source !== 'offline_supplied_asof_fixtures' &&
      input.source !== 'offline_observed_revisor_receipts') {
    throw new Error('Unsupported offline P8 observation source');
  }
  if (input.source === 'offline_observed_revisor_receipts' &&
      input.bills.some(bill => !bill.calendarEvidence)) {
    throw new Error('Receipt-based P8 capture requires timestamped calendar evidence per bill');
  }
  const seen = new Set<string>();
  const rows: P8DailyCaptureRow[] = [];
  for (const bill of input.bills) {
    validateBill(bill);
    if (seen.has(bill.billId)) throw new Error('Duplicate bill in daily capture');
    seen.add(bill.billId);
    // Date-exclusive rule applies to discovery and introduction, not just process.
    // Do not create retroactively backfilled rows from today's first observation.
    if (bill.introducedOn >= cutoff || bill.adjournmentOn < cutoff ||
        !sourceEarlierThanCutoff(bill.firstObservedAt, cutoff)) continue;
    rows.push(rowForBill(bill, cutoff));
  }
  rows.sort((a, b) => a.bill.billId.localeCompare(b.bill.billId));
  const content = {
    schemaVersion: P8_DAILY_CAPTURE_SCHEMA,
    session: P8_DAILY_CAPTURE_SESSION,
    cutoffDateExclusive: cutoff,
    capturedAt: input.capturedAt,
    timezone: P8_DAILY_CAPTURE_TIMEZONE,
    source: input.source ?? 'offline_supplied_asof_fixtures' as const,
    frozenModelContentSha256Reference: LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256,
    outcomeRead: false as const,
    productionCaptureActivated: false as const,
    servingChanged: false as const,
    predictionsComputed: false as const,
    rows,
  };
  // The first capturedAt is preserved in the append-only file. Later identical
  // reruns may have a different wall-clock time without becoming data drift.
  const { capturedAt: _firstCaptureTime, ...immutableContent } = content;
  return { ...content, contentSha256: sha256(immutableContent) };
}

/** Date-exclusive evaluation selection, without joining or reading future targets. */
export function latestP8CaptureBeforeEvent(
  rows: readonly P8DailyCaptureRow[],
  billId: string,
  eventDate: string,
): P8DailyCaptureRow | null {
  dateOnly(eventDate, 'event date');
  return rows.filter(row => row.bill.billId === billId &&
      row.cutoff.asOfDateExclusive < eventDate)
    .sort((a, b) => b.cutoff.asOfDateExclusive.localeCompare(a.cutoff.asOfDateExclusive))[0] ?? null;
}
