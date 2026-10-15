/**
 * One raw, Senate-only collector for the official hearing schedule, its agenda
 * attachments and explicitly listed testifiers. No stance inference, fact
 * checking, forecast feature extraction or bill creation.
 *
 * The official schedule is a JavaScript app; its published /api/schedule/daily
 * payload is retained verbatim for each hearing. Linked PDFs retain their
 * original URL as a permanent raw-binary pointer. Agenda/testifier-list PDFs
 * are also text-extracted when possible so their printed witnesses are kept.
 */
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { listSenateHearingDates, parseSenateDailyHearings } from './senate-schedule.js';
import type { MinnesotaHouseSession } from './sessions.js';

const ROOT = 'https://www.senate.mn';
const USER_AGENT = 'VotePredict/2.0 (Minnesota Senate raw committee testimony collection)';
const BILL = /\b([SH])\s*\.?\s*F\s*\.?\s*#?\s*0*(\d{1,5})\b/gi;
const FILE = /\.(?:pdf|docx?|txt)(?:[?#]|$)/i;

export type StatedPosition = 'for' | 'against' | 'neutral';

export interface RawSenateTestimonyRecord {
  recordKey: string;
  session: string;
  hearingId: number;
  sourceType: 'hearing' | 'witness' | 'document';
  sourceUrl: string;
  fetchedAt: string;
  hearingDate: string;
  sourceContentType: string;
  rawContent: string | null;
  rawContentUrl: string | null;
  committee: string | null;
  billIdentifier: string | null;
  witnessName: string | null;
  organization: string | null;
  statedPosition: StatedPosition | null;
  documentName: string | null;
  documentKind: 'agenda' | 'witness_list' | 'written_testimony' | 'other' | null;
}

export interface RawSenateTestimonySummary {
  session: string;
  from: string;
  to: string;
  hearings: number;
  witnesses: number;
  documents: number;
  witnessListsParsed: number;
  failedUrls: string[];
}

export interface SenateTestimonyOptions {
  session: MinnesotaHouseSession;
  from: string;
  to: string;
  committee?: string;
  limit?: number;
  delayMs?: number;
  /** Turn off PDF fetching; document URLs are still retained. */
  parsePdfLists?: boolean;
  onRecord: (record: RawSenateTestimonyRecord) => Promise<void>;
}

interface HearingContext {
  session: string;
  hearingId: number;
  hearingDate: string;
  committee: string | null;
  hearingUrl: string;
  fetchedAt: string;
}

interface Attachment {
  url: string;
  name: string;
  billIdentifier: string | null;
}

interface Witness {
  name: string;
  organization: string | null;
  position: StatedPosition | null;
  sourceText: string;
  billIdentifier: string | null;
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizedBill(value: string): string | null {
  const match = [...value.matchAll(new RegExp(BILL.source, 'gi'))];
  const identifiers = [...new Set(match.map((item) => `${item[1].toUpperCase()}F${Number(item[2])}`))];
  return identifiers.length === 1 ? identifiers[0] : null;
}

function decode(value: string): string {
  return value.replace(/&(?:amp|quot|apos|nbsp|lt|gt);|&#(?:x[\da-f]+|\d+);/gi, (entity) => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const number = entity.slice(2, -1);
    const code = number[0]?.toLowerCase() === 'x' ? Number.parseInt(number.slice(1), 16) : Number.parseInt(number, 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function textOnly(value: string): string {
  return decode(value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|li|div)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

/** Positions are captured only if an individual/list entry expressly says so. */
export function statedPosition(value: string): StatedPosition | null {
  if (/\b(?:neutral|neither\s+support\s+nor\s+oppose)\b/i.test(value)) return 'neutral';
  if (/\b(?:against|opposition|opposed|oppose|con)\b/i.test(value)) return 'against';
  if (/\b(?:in\s+favor|in\s+support|supporting|support|proponent|pro)\b/i.test(value)) return 'for';
  return null;
}

function hearingRecord(context: HearingContext, event: unknown): RawSenateTestimonyRecord {
  return record(context, 'hearing', context.hearingUrl, 'application/json', JSON.stringify(event), null, null, 'hearing');
}

function record(
  context: HearingContext,
  sourceType: RawSenateTestimonyRecord['sourceType'],
  sourceUrl: string,
  sourceContentType: string,
  rawContent: string | null,
  rawContentUrl: string | null,
  billIdentifier: string | null,
  identity: string,
): RawSenateTestimonyRecord {
  return {
    recordKey: sha([context.hearingId, sourceType, sourceUrl, billIdentifier ?? '', identity].join('|')),
    session: context.session,
    hearingId: context.hearingId,
    sourceType,
    sourceUrl,
    fetchedAt: context.fetchedAt,
    hearingDate: context.hearingDate,
    sourceContentType,
    rawContent,
    rawContentUrl,
    committee: context.committee,
    billIdentifier,
    witnessName: null,
    organization: null,
    statedPosition: null,
    documentName: null,
    documentKind: null,
  };
}

function resolveDocumentUrl(value: string): string | null {
  if (!value || /^(?:data:|javascript:|mailto:)/i.test(value)) return null;
  const trimmed = decode(value.trim());
  const base = /^\/?committees\//i.test(trimmed) ? 'https://assets.senate.mn/' : ROOT + '/';
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'https:' || !['senate.mn', 'www.senate.mn', 'assets.senate.mn'].includes(url.hostname)) return null;
    return FILE.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}

function attachmentName(url: string): string {
  try { return decode(decodeURIComponent(new URL(url).pathname.split('/').at(-1) ?? url)); }
  catch { return url; }
}

function documentKind(name: string): NonNullable<RawSenateTestimonyRecord['documentKind']> {
  if (/testifier[-_\s]*list|witness[-_\s]*list/i.test(name)) return 'witness_list';
  if (/\bagenda\b|[_-]agenda\b/i.test(name)) return 'agenda';
  if (/testimon|letter|statement|comment|\bsupport\b|\boppos|\bpro\b|\bcon\b|position/i.test(name)) return 'written_testimony';
  return 'other';
}

function extractHrefs(value: string): Array<{ url: string; name: string }> {
  const found: Array<{ url: string; name: string }> = [];
  for (const match of value.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = resolveDocumentUrl(match[1]);
    if (url) found.push({ url, name: textOnly(match[2]) || attachmentName(url) });
  }
  return found;
}

/** Walk actual schedule JSON generically; never manufacture agenda/file paths. */
export function parseAgendaAttachments(agenda: unknown): Attachment[] {
  const found = new Map<string, Attachment>();
  function add(url: string, name: string, billIdentifier: string | null): void {
    const key = [url, billIdentifier ?? ''].join('|');
    if (!found.has(key)) found.set(key, { url, name: name || attachmentName(url), billIdentifier });
  }
  function visit(node: unknown, inheritedBill: string | null, depth: number): void {
    if (depth > 16 || node === null) return;
    if (typeof node === 'string') {
      const text = textOnly(node);
      const bill = normalizedBill(text) ?? inheritedBill;
      for (const a of extractHrefs(node)) add(a.url, a.name, bill);
      // Some API fields are a direct URL string with no surrounding HTML.
      const direct = resolveDocumentUrl(node);
      if (direct) add(direct, attachmentName(direct), inheritedBill);
      return;
    }
    if (Array.isArray(node)) { for (const child of node) visit(child, inheritedBill, depth + 1); return; }
    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const directStrings = Object.entries(obj)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string] as const);
    const ownBill = normalizedBill(directStrings
      .filter(([key]) => /bill|file|title|subject|description|text|label|name|number/i.test(key))
      .map(([, value]) => textOnly(value)).join(' ')) ?? inheritedBill;
    const name = directStrings.find(([key]) => /^(?:file_?name|document_?name|attachment_?name|title|label|name)$/i.test(key))?.[1];
    for (const [key, value] of directStrings) {
      for (const a of extractHrefs(value)) add(a.url, a.name, ownBill);
      if (/url|href|link|path|filename|file_name/i.test(key)) {
        const url = resolveDocumentUrl(value);
        if (url) add(url, name && !FILE.test(name) ? name : attachmentName(url), ownBill);
      }
    }
    for (const value of Object.values(obj)) visit(value, ownBill, depth + 1);
  }
  visit(agenda, null, 0);
  return [...found.values()];
}

function parseWitnessLine(line: string, billIdentifier: string | null): Witness | null {
  const clean = textOnly(line)
    .replace(/^(?:[•*]|[-–]|\d+[.)])\s*/, '')
    .replace(/^\s*(?:testifiers?|witnesses?)\s*:\s*/i, '')
    .trim();
  const parts = clean.split(/,\s*/).map((part) => part.trim()).filter(Boolean);
  let name = parts[0]?.replace(/^(?:Commissioner|Dr\.?|Rev\.?|Mr\.?|Ms\.?)\s+/i, '').trim() ?? '';
  // Require a plausible full name, not a generic "testimony requests" instruction.
  if (!/^[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+)+$/u.test(name) || name.split(/\s+/).length > 5) return null;
  if (/^(?:testimony|members|call|approval|information)\b/i.test(name)) return null;
  const organization = parts.length > 1
    ? parts.slice(1).filter((part) => !/^(?:in support|in opposition|against|neutral|remote|in person)$/i.test(part)).at(-1) ?? null
    : null;
  return { name, organization, position: statedPosition(parts.slice(1).join(', ')), sourceText: line.trim(), billIdentifier };
}

/** Witness names must occur under an explicit "Testifier(s)" or "Witness(es)" label. */
export function parseWitnesses(text: string, inheritedBill: string | null = null): Witness[] {
  const lines = textOnly(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const witnesses: Witness[] = [];
  let inList = false;
  let bill = inheritedBill;
  for (const line of lines) {
    const explicitBill = normalizedBill(line);
    if (explicitBill) bill = explicitBill;
    const label = line.match(/\b(?:remote\s+)?(?:testifiers?|witnesses?)\s*:\s*(.*)$/i);
    if (label) {
      inList = true;
      // Hearing notes often put "- Person, Org - Person, Org" on one line.
      const entries = label[1].trim().split(/\s+[-–]\s+(?=[A-Z])/).filter(Boolean);
      for (const entry of entries) {
        const witness = parseWitnessLine(entry, bill);
        if (witness) witnesses.push(witness);
      }
      continue;
    }
    if (/^(?:\d+[.)]\s*(?!testif)|adjourn|agenda\b|call to order|committee staff|members\b)/i.test(line)) {
      inList = false;
      continue;
    }
    if (!inList) continue;
    // On PDF agendas a wrapped organization/role line has no bullet; keep
    // the visible witness line without guessing from the continuation.
    if (!/^(?:[•*]|[-–])\s+/.test(line)) continue;
    const witness = parseWitnessLine(line, bill);
    if (witness) witnesses.push(witness);
  }
  return witnesses;
}

/** Read explicitly labeled testifiers embedded in agenda item JSON strings. */
export function parseAgendaWitnesses(agenda: unknown): Witness[] {
  const found: Witness[] = [];
  function visit(node: unknown, bill: string | null, depth: number): void {
    if (depth > 16 || node === null) return;
    if (typeof node === 'string') {
      if (/\b(?:testifiers?|witnesses?)\s*:/i.test(node)) found.push(...parseWitnesses(node, bill));
      return;
    }
    if (Array.isArray(node)) { for (const child of node) visit(child, bill, depth + 1); return; }
    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const ownBill = normalizedBill(Object.entries(obj)
      .filter(([key, value]) => typeof value === 'string' && /bill|number|title|text|description|label/i.test(key))
      .map(([, value]) => String(value)).join(' ')) ?? bill;
    for (const child of Object.values(obj)) visit(child, ownBill, depth + 1);
  }
  visit(agenda, null, 0);
  return found;
}

async function senateFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/pdf, */*' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Official Senate HTTP ${response.status}`);
  return response;
}

async function extractAgendaPdf(url: string): Promise<string> {
  const response = await senateFetch(url);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 12_000_000) throw new Error('agenda PDF exceeds 12 MB cap');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 12_000_000 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('not a bounded PDF');
  }
  const { PDFParse } = await import('pdf-parse');
  const pdf = new PDFParse({ data: bytes });
  try { return (await pdf.getText()).text ?? ''; }
  finally { await pdf.destroy(); }
}

function witnessRecord(context: HearingContext, witness: Witness, sourceUrl: string, sourceKind: string): RawSenateTestimonyRecord {
  const row = record(context, 'witness', sourceUrl, sourceKind, witness.sourceText, null, witness.billIdentifier,
    [witness.name, witness.organization ?? '', witness.sourceText].join('|'));
  row.witnessName = witness.name;
  row.organization = witness.organization;
  row.statedPosition = witness.position;
  return row;
}

function documentRecord(context: HearingContext, attachment: Attachment, text: string | null): RawSenateTestimonyRecord {
  const row = record(context, 'document', attachment.url, 'application/pdf', text, attachment.url,
    attachment.billIdentifier, attachment.url);
  row.documentName = attachment.name;
  row.documentKind = documentKind(attachment.name);
  // A position on a PDF label belongs to the document, not to a live witness.
  row.statedPosition = statedPosition(attachment.name);
  return row;
}

export async function collectSenateCommitteeTestimony(options: SenateTestimonyOptions): Promise<RawSenateTestimonySummary> {
  if (options.from > options.to || options.from < options.session.startsOn || options.to > options.session.endsOn) {
    throw new Error('Date range must be ordered and within the requested biennium');
  }
  const summary: RawSenateTestimonySummary = {
    session: options.session.slug, from: options.from, to: options.to,
    hearings: 0, witnesses: 0, documents: 0, witnessListsParsed: 0, failedUrls: [],
  };
  const pause = () => sleep(Math.max(200, options.delayMs ?? 350));
  const dates = await listSenateHearingDates(options.from, options.to);
  for (const date of dates) {
    if (options.limit && summary.hearings >= options.limit) break;
    const apiUrl = `${ROOT}/api/schedule/daily?date=${date}`;
    let json: { events?: unknown[] };
    try { json = await (await senateFetch(apiUrl)).json() as { events?: unknown[] }; }
    catch (error) {
      summary.failedUrls.push(`${apiUrl}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const parsed = parseSenateDailyHearings(json, date);
    const events = Array.isArray(json.events) ? json.events : [];
    for (const hearing of parsed) {
      if (options.limit && summary.hearings >= options.limit) break;
      if (!hearing.committeeId || !hearing.committeeName || !/^\d{4}-\d{2}-\d{2}$/.test(hearing.date)) continue;
      if (options.committee && ![String(hearing.committeeId), hearing.committeeName.toLowerCase()].some((name) =>
        name.includes(options.committee!.toLowerCase()))) continue;
      // Match raw API object by ID; never replace it with the normalized slice.
      const event = events.find((item) => item && typeof item === 'object' &&
        Number((item as Record<string, unknown>).hearing_id) === hearing.hearingId);
      if (!event) continue;
      const context: HearingContext = {
        session: options.session.slug, hearingId: hearing.hearingId, hearingDate: hearing.date,
        committee: hearing.committeeName,
        hearingUrl: `${ROOT}/schedule/individual/${hearing.hearingId}/${hearing.date.replaceAll('-', '')}`,
        fetchedAt: new Date().toISOString(),
      };
      await options.onRecord(hearingRecord(context, event));
      summary.hearings += 1;
      const written = new Set<string>();
      const witnesses = [
        ...parseAgendaWitnesses(hearing.agenda),
        ...parseWitnesses(hearing.notes ?? ''),
      ];
      for (const person of witnesses) {
        const row = witnessRecord(context, person, context.hearingUrl, 'application/json');
        if (written.has(row.recordKey)) continue;
        await options.onRecord(row);
        written.add(row.recordKey);
        summary.witnesses += 1;
      }
      // Attachments include all Senate-hosted files; agenda/testifier lists
      // are additionally text-read to recover witnesses printed only in PDFs.
      const attachments = parseAgendaAttachments(hearing.agenda);
      for (const file of attachments) {
        const kind = documentKind(file.name);
        let pdfText: string | null = null;
        if (options.parsePdfLists !== false && (kind === 'agenda' || kind === 'witness_list') &&
            /\.pdf(?:[?#]|$)/i.test(file.url)) {
          try {
            await pause();
            pdfText = await extractAgendaPdf(file.url);
            summary.witnessListsParsed += 1;
          } catch (error) {
            summary.failedUrls.push(`${file.url}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        await options.onRecord(documentRecord(context, file, pdfText));
        summary.documents += 1;
        if (pdfText) {
          for (const person of parseWitnesses(pdfText, file.billIdentifier)) {
            const row = witnessRecord(context, person, file.url, 'application/pdf');
            if (written.has(row.recordKey)) continue;
            await options.onRecord(row);
            written.add(row.recordKey);
            summary.witnesses += 1;
          }
        }
      }
    }
    await pause();
  }
  return summary;
}
