/**
 * 2027-28 P8 Revisor as-of receipt adapter. No app DB or production dependency.
 *
 * The observation clock is stamped when a public HTTPS response finishes;
 * DATE_INSERT/ACTION_DATE alone are NOT proof of when that text was observed.
 * A retained raw XML receipt enables independent re-parsing/byte verification.
 * The caller must supply a separately reviewed complete bill-universe manifest
 * and a calendar datum: this module does not invent missing 2027 bills.
 */
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  parseRevisorIntroductionMetadata,
  parseRevisorTextVersions,
} from '../sources/minnesota/revisor-introduction';
import { parseRevisorProcessEvents } from '../sources/minnesota/revisor-process';
import {
  isRevisorPassageNegative,
  isRevisorPassagePositive,
} from '../sources/minnesota/revisor-actions';
import {
  buildOfflineP8DailyCapture,
  type P8DailyBillInput,
  type P8DailyCaptureBatch,
  type P8ObservedProcessEvent,
  type P8ObservedBillVersion,
} from './lifecycle-p8-daily-capture';
import {
  verifyPinnedP8FrozenModelJson,
  type VerifiedP8FrozenModel,
} from './lifecycle-p8-frozen-model-verify';

export const P8_REVISOR_OBSERVATION_SCHEMA = 'lifecycle-p8-revisor-xml-receipt-v1' as const;
const MAX_XML_BYTES = 2_000_000;

type Chamber = 'house' | 'senate';

export interface P8RevisorReceipt {
  schemaVersion: typeof P8_REVISOR_OBSERVATION_SCHEMA;
  session: '2027-2028';
  identifier: string;
  sourceUrl: string;
  observedAt: string;
  sourceSha256: string;
  xml: string;
  receiptSha256: string;
}

export interface P8RevisorBillReceiptSeries {
  billId: string; // supplied by independently verified authoritative bill-universe manifest
  identifier: string;
  receipts: readonly P8RevisorReceipt[];
}

export interface P8SessionCalendarDatum {
  adjournmentOn: string;
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  // A dated source record is required. This type does not claim the date has
  // already been independently extracted from the future official calendar.
}

function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function dateOnly(value: string, label: string): string {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error(label + ': invalid official date');
  }
  return value;
}
function chicagoDate(value: string): string {
  const parsed = Date.parse(value);
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error('P8 receipt requires a canonical UTC acquisition instant');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(x => x.type === type)?.value;
  return [part('year'), part('month'), part('day')].join('-');
}

function cleanIdentifier(identifier: string): { identifier: string; chamber: Chamber; number: string } {
  if (typeof identifier !== 'string' || !/^(HF|SF)[1-9]\d{0,5}$/.test(identifier)) {
    throw new Error('Only normalized HF/SF official bill identifiers are allowed');
  }
  return {
    identifier,
    chamber: identifier.startsWith('HF') ? 'house' : 'senate',
    number: identifier.slice(2),
  };
}

export function assertP8RevisorSourceUrl(sourceUrl: string, identifier: string): void {
  const { number, identifier: normalized } = cleanIdentifier(identifier);
  let url: URL;
  try { url = new URL(sourceUrl); } catch { throw new Error('Invalid P8 official Revisor API URL'); }
  const match = url.pathname.match(/^\/bills\/v1\/95\/(2027|2028)\/0\/(HF|SF)\/([1-9]\d{0,5})\/$/);
  if (url.protocol !== 'https:' || url.hostname !== 'api.revisor.mn.gov' ||
      url.username || url.password || url.search || url.hash ||
      !match || match[2] + match[3] !== normalized || match[3] !== number) {
    throw new Error('P8 source is not an exact 95th-legislature official Revisor XML URL');
  }
}

function assertOfficialBillXml(xml: string, identifier: string): void {
  if (typeof xml !== 'string' || Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES ||
      /<!DOCTYPE|<!ENTITY|<html\b/i.test(xml.slice(0, 1000)) ||
      !/<(?:[A-Z0-9_.-]+:)?BILL\b/i.test(xml)) {
    throw new Error('P8 Revisor receipt is not bounded official bill XML');
  }
  // Existing introduction parser validates FILE_TYPE/FILE_NUMBER when present.
  // Here require them explicitly, so a partial or foreign bill cannot pass.
  const rawType = xml.match(/<FILE_TYPE>(HF|SF)<\/FILE_TYPE>/i)?.[1]?.toUpperCase();
  const rawNum = xml.match(/<FILE_NUMBER>0*([1-9]\d*)<\/FILE_NUMBER>/i)?.[1];
  if (!rawType || !rawNum || rawType + Number(rawNum) !== identifier) {
    throw new Error('P8 Revisor source has absent or mismatched official bill identity');
  }
}

export function sealP8RevisorReceipt(input: {
  sourceUrl: string;
  identifier: string;
  xml: string;
  observedAt: string;
}): P8RevisorReceipt {
  assertP8RevisorSourceUrl(input.sourceUrl, input.identifier);
  assertOfficialBillXml(input.xml, input.identifier);
  chicagoDate(input.observedAt);
  const content = {
    schemaVersion: P8_REVISOR_OBSERVATION_SCHEMA,
    session: '2027-2028' as const,
    identifier: input.identifier,
    sourceUrl: input.sourceUrl,
    observedAt: input.observedAt,
    sourceSha256: sha256(Buffer.from(input.xml, 'utf8')),
    xml: input.xml,
  };
  return { ...content, receiptSha256: sha256(JSON.stringify(content)) };
}

export function verifyP8RevisorReceipt(receipt: P8RevisorReceipt): void {
  if (!receipt || typeof receipt !== 'object' ||
      Object.keys(receipt).sort().join('|') !==
        ['schemaVersion','session','identifier','sourceUrl','observedAt',
         'sourceSha256','xml','receiptSha256'].sort().join('|')) {
    throw new Error('P8 receipt has missing, unrecognized or outcome-bearing fields');
  }
  if (receipt.schemaVersion !== P8_REVISOR_OBSERVATION_SCHEMA ||
      receipt.session !== '2027-2028') {
    throw new Error('P8 receipt version/session mismatch');
  }
  const expected = sealP8RevisorReceipt({
    sourceUrl: receipt.sourceUrl,
    identifier: receipt.identifier,
    xml: receipt.xml,
    observedAt: receipt.observedAt,
  });
  if (receipt.sourceSha256 !== expected.sourceSha256 ||
      receipt.receiptSha256 !== expected.receiptSha256) {
    throw new Error('Modified Revisor source bytes or acquisition receipt');
  }
}

/**
 * Explicitly invoked PUBLIC fetch; no scheduling, retries, credentials or DB.
 * The observedAt clock is taken only AFTER the full response is acquired.
 * Tests pass a mocked fetch and clock; a mock cannot attest historical public
 * availability. Never backdate a receipt to an official ACTION_DATE.
 */
export async function fetchAndSealP8RevisorReceipt(
  sourceUrl: string,
  identifier: string,
  options: { fetcher?: typeof fetch; receivedClock?: () => Date } = {},
): Promise<P8RevisorReceipt> {
  assertP8RevisorSourceUrl(sourceUrl, identifier);
  const response = await (options.fetcher ?? fetch)(sourceUrl, {
    headers: {
      'User-Agent': 'VotePredict/2.0 P8 offline official-source receipt audit',
      Accept: 'application/xml,text/xml;q=0.9',
    },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok ||
      Number(response.headers.get('content-length') ?? 0) > MAX_XML_BYTES) {
    throw new Error('P8 official Revisor XML response failed or exceeds the audit size limit');
  }
  const xml = await response.text();
  if (Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES) {
    throw new Error('P8 source response exceeded the audit size limit');
  }
  const received = (options.receivedClock ?? (() => new Date()))();
  if (!(received instanceof Date) || !Number.isFinite(received.getTime())) {
    throw new Error('Invalid P8 source collection clock');
  }
  return sealP8RevisorReceipt({
    sourceUrl, identifier, xml, observedAt: received.toISOString(),
  });
}

export async function persistP8RevisorReceipt(
  receipt: P8RevisorReceipt,
  directory: string,
): Promise<{ path: string; result: 'created' | 'already_present'; receiptSha256: string }> {
  verifyP8RevisorReceipt(receipt);
  const dir = resolve(directory);
  await mkdir(dir, { recursive: true });
  const basename = receipt.identifier + '-' + receipt.observedAt.replace(/\D/g, '') +
    '-' + receipt.receiptSha256.slice(0, 12) + '.json';
  const path = join(dir, basename);
  const temp = join(dir, '.' + randomUUID() + '.tmp');
  await writeFile(temp, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
  try {
    try {
      await link(temp, path);
      return { path, result: 'created', receiptSha256: receipt.receiptSha256 };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const stored = JSON.parse(await readFile(path, 'utf8')) as P8RevisorReceipt;
      verifyP8RevisorReceipt(stored);
      if (stored.receiptSha256 !== receipt.receiptSha256) {
        throw new Error('Existing official P8 receipt differs; overwrite forbidden');
      }
      return { path, result: 'already_present', receiptSha256: receipt.receiptSha256 };
    }
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

function eventIdentity(event: {
  chamber: Chamber; stageKind: string; occurredOn: string;
  description: string; companionIdentifiers: string[];
}): string {
  return JSON.stringify([
    event.chamber, event.occurredOn, event.stageKind,
    event.description.trim().replace(/\s+/g, ' '),
    [...event.companionIdentifiers].sort(),
  ]);
}

function eligibleSnapshotEvents(receipt: P8RevisorReceipt) {
  return parseRevisorProcessEvents({ xml: receipt.xml, identifier: receipt.identifier })
    .filter(event => !isRevisorPassagePositive(event.description) &&
      !isRevisorPassageNegative(event.description));
}

function validateCalendar(input: P8SessionCalendarDatum, cutoff: string): void {
  dateOnly(input.adjournmentOn, 'P8 calendar adjournment date');
  if (chicagoDate(input.observedAt) >= cutoff) {
    throw new Error('Session-calendar datum was not observed before P8 cutoff');
  }
  // Revisor-legislature session/calendar materials are acceptable source links
  // but a source SHA alone cannot prove the claimed adjournment date.
  const url = new URL(input.sourceUrl);
  if (url.protocol !== 'https:' || !['www.revisor.mn.gov','revisor.mn.gov'].includes(url.hostname) ||
      url.username || url.password ||
      !/^[a-f0-9]{64}$/.test(input.sourceSha256)) {
    throw new Error('P8 session-calendar provenance must be an official dated source');
  }
}

/**
 * Offline as-of reconstruction from REAL CAPTURE-TIME receipts only.
 * Recency is determined from collection timestamps, not XML action dates.
 * No later receipts can contribute a process event or official version.
 *
 * The series is an externally provided subset. This cannot certify that the
 * all-introduced-bill universe was enumerated completely.
 */
export function buildP8BillInputsFromOfficialReceipts(input: {
  cutoffDateExclusive: string;
  calendar: P8SessionCalendarDatum;
  bills: readonly P8RevisorBillReceiptSeries[];
}): P8DailyBillInput[] {
  const cutoff = dateOnly(input.cutoffDateExclusive, 'P8 receipt cutoff');
  if (cutoff < '2027-01-01' || cutoff > '2028-12-31') {
    throw new Error('P8 official receipt adapter accepts the 2027-28 session only');
  }
  validateCalendar(input.calendar, cutoff);
  const seen = new Set<string>();
  const adapted: P8DailyBillInput[] = [];
  for (const series of input.bills) {
    const { chamber } = cleanIdentifier(series.identifier);
    if (!series.billId || typeof series.billId !== 'string' || seen.has(series.billId)) {
      throw new Error('P8 bill universe must provide unique stable bill IDs');
    }
    seen.add(series.billId);
    if (!Array.isArray(series.receipts)) throw new Error('P8 requires immutable receipt lists');
    const snapshots = series.receipts.map(receipt => {
      verifyP8RevisorReceipt(receipt);
      if (receipt.identifier !== series.identifier) {
        throw new Error('Bill-universe identifier does not match Revisor receipt');
      }
      const introduction = parseRevisorIntroductionMetadata({
        xml: receipt.xml, identifier: receipt.identifier,
      });
      return {
        receipt,
        introduction,
        events: eligibleSnapshotEvents(receipt),
        versions: parseRevisorTextVersions(receipt.xml),
      };
    }).filter(entry => chicagoDate(entry.receipt.observedAt) < cutoff)
      .sort((a, b) => a.receipt.observedAt.localeCompare(b.receipt.observedAt) ||
        a.receipt.receiptSha256.localeCompare(b.receipt.receiptSha256));
    if (!snapshots.length) continue;
    const introduced = snapshots
      .filter(entry => entry.introduction.introducedOn !== null);
    if (!introduced.length) continue;
    const introducedOn = introduced[0].introduction.introducedOn!;
    if (introduced.some(entry => entry.introduction.introducedOn !== introducedOn)) {
      throw new Error('Official bill introduction date changed between sealed observations');
    }
    const first = introduced[0];
    const latest = introduced[introduced.length - 1];
    const firstEvent = new Map<string, { receipt: P8RevisorReceipt; event: typeof latest.events[number] }>();
    const firstVersion = new Map<string, { receipt: P8RevisorReceipt; version: typeof latest.versions[number] }>();
    for (const entry of introduced) {
      for (const event of entry.events) {
        const key = eventIdentity(event);
        if (!firstEvent.has(key)) firstEvent.set(key, { receipt: entry.receipt, event });
      }
      for (const version of entry.versions) {
        if (!version.documentName || !version.insertedOn || !version.htmlUrl) continue;
        if (!firstVersion.has(version.documentName)) {
          firstVersion.set(version.documentName, { receipt: entry.receipt, version });
        }
      }
    }
    const occurrences = new Map<string, number>();
    const events: P8ObservedProcessEvent[] = latest.events.map(event => {
      const key = eventIdentity(event);
      const earliest = firstEvent.get(key)!;
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      return {
        eventKey: sha256(JSON.stringify([series.identifier, key, occurrence])).slice(0, 32),
        occurredOn: event.occurredOn,
        observedAt: earliest.receipt.observedAt,
        chamber: event.chamber,
        stageKind: event.stageKind,
        sourceUrl: earliest.receipt.sourceUrl,
        sourceSha256: earliest.receipt.sourceSha256,
        companionIdentifiers: [...event.companionIdentifiers],
      };
    });
    const versions: P8ObservedBillVersion[] = latest.versions.flatMap(version => {
      if (!version.documentName || !version.insertedOn || !version.htmlUrl) return [];
      const earliest = firstVersion.get(version.documentName)!;
      return [{
        id: sha256(JSON.stringify([series.identifier, version.documentName])).slice(0, 32),
        versionKey: version.documentName,
        publishedOn: version.insertedOn,
        observedAt: earliest.receipt.observedAt,
        sourceUrl: earliest.receipt.sourceUrl,
        sourceSha256: earliest.receipt.sourceSha256,
        textHash: null, // Status XML does not contain verified bill-text bytes.
        textLengthChars: null,
      }];
    });

    adapted.push({
      billId: series.billId,
      session: '2027-2028',
      chamber,
      identifier: series.identifier,
      introducedOn,
      adjournmentOn: input.calendar.adjournmentOn,
      firstObservedAt: first.receipt.observedAt,
      sourceUrl: first.receipt.sourceUrl,
      sourceSha256: first.receipt.sourceSha256,
      calendarEvidence: { ...input.calendar },
      process: {
        status: 'parsed',
        observedAt: first.receipt.observedAt,
        parserVersion: 'revisor-process-v2',
        events,
      },
      billVersions: versions,
    });
  }
  return adapted;
}

/** Fail-closed rehearsal bridge; verification does NOT enable model scoring. */
export function buildVerifiedP8OfflineReceiptCapture(input: {
  modelJsonBytes: Uint8Array;
  cutoffDateExclusive: string;
  capturedAt: string;
  calendar: P8SessionCalendarDatum;
  bills: readonly P8RevisorBillReceiptSeries[];
}): { batch: P8DailyCaptureBatch; verifiedModel: VerifiedP8FrozenModel['verification'] } {
  const verifiedModel = verifyPinnedP8FrozenModelJson(input.modelJsonBytes);
  const bills = buildP8BillInputsFromOfficialReceipts(input);
  const batch = buildOfflineP8DailyCapture({
    cutoffDateExclusive: input.cutoffDateExclusive,
    capturedAt: input.capturedAt,
    bills,
    source: 'offline_observed_revisor_receipts',
  });
  return { batch, verifiedModel: verifiedModel.verification };
}
