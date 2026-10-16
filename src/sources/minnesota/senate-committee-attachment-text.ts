/**
 * Bounded first-party attachment retrieval for ALREADY INDEXED Minnesota Senate URLs.
 * No schedule discovery, stance inference, identity checks, or forecast writes.
 * Full raw text is retained; statuses distinguish unavailable files from non-text scans.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);
const MAX_BYTES = 24_000_000;
const MAX_REDIRECTS = 3;
const ACCEPTED = new Set(['senate.mn', 'www.senate.mn', 'assets.senate.mn']);
export type AttachmentStatus = 'extracted' | 'empty' | 'scanned' | 'unsupported' | 'unavailable' | 'failed';
export type AttachmentMethod = 'pdf-parse' | 'pdf-ocr' | 'docx-unzip' | 'doc-antiword' | 'plain-text' | 'html-text' | 'rtf-unrtf' | 'none';

export interface SenateAttachmentCapture {
  sourceUrl: string;
  finalUrl: string | null;
  snapshotKey: string;
  fetchedAt: string;
  responseStatus: number | null;
  sourceContentType: string | null;
  byteSize: number | null;
  contentSha256: string | null;
  extractionStatus: AttachmentStatus;
  extractionMethod: AttachmentMethod;
  rawText: string | null;
  publicationDate: null;
  originalFileRef: string;
  failureKind: string | null;
}

function sha(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function verifiedUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !ACCEPTED.has(parsed.hostname)
    || parsed.username || parsed.password || parsed.port) throw Error('outside_senate_hosts');
  return parsed.toString();
}

function textFromXml(xml: string): string {
  return xml.replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:lt|gt|quot|apos|amp);|&#(?:x[0-9a-f]+|\d+);/gi, match => {
      const names: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' };
      if (names[match]) return names[match];
      const hex = match[2]?.toLowerCase() === 'x';
      const number = Number.parseInt(match.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return Number.isInteger(number) && number > 0 && number <= 0x10ffff
        ? String.fromCodePoint(number) : match;
    });
}

function htmlText(value: string): string {
  // Preserve all visible paragraphs and boilerplate; remove markup, not prose.
  return textFromXml(value.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '')
    .replace(/<br\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n'));
}

async function limitedBody(response: Response): Promise<Buffer> {
  const claimed = Number(response.headers.get('content-length') || 0);
  if (claimed > MAX_BYTES) throw Error('oversize');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw Error('oversize'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

async function unzipDocx(data: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'senate-docx-'));
  try {
    const file = join(dir, 'source.docx');
    await writeFile(file, data);
    const { stdout: listing } = await exec('unzip', ['-Z', '-1', file], { timeout: 15000, maxBuffer: 2_000_000 });
    const names = listing.split(/\r?\n/).filter(name =>
      /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name));
    if (!names.includes('word/document.xml')) throw Error('docx_missing_document_xml');
    const outputs: string[] = [];
    for (const name of names.sort((a, b) => a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b))) {
      const { stdout } = await exec('unzip', ['-p', file, name], { timeout: 15000, maxBuffer: 24_000_000 });
      outputs.push(textFromXml(stdout));
    }
    return outputs.join('\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function antiword(data: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'senate-doc-'));
  try {
    const file = join(dir, 'source.doc');
    await writeFile(file, data);
    const { stdout } = await exec('antiword', ['-w', '0', file], { timeout: 30000, maxBuffer: 24_000_000 });
    return stdout;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function rtfText(data: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'senate-rtf-'));
  try {
    const file = join(dir, 'source.rtf');
    await writeFile(file, data);
    const { stdout } = await exec('unrtf', ['--text', '--nopict', file], { timeout: 30000, maxBuffer: 24_000_000 });
    return stdout;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function pdfOcr(data: Buffer): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), 'senate-ocr-'));
  try {
    const file = join(dir, 'source.pdf');
    await writeFile(file, data);
    // Never store partial OCR as full document text. Skip documents exceeding
    // the bounded all-pages OCR budget; preserve their scanned status.
    const { stdout: info } = await exec('pdfinfo', [file], { timeout: 10000, maxBuffer: 80000 });
    const pages = Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
    if (!Number.isInteger(pages) || pages < 1 || pages > 24) return null;
    const prefix = join(dir, 'page');
    await exec('pdftoppm', ['-f', '1', '-l', String(pages), '-r', '125', '-png', file, prefix],
      { timeout: 90000, maxBuffer: 100000 });
    const names = (await readdir(dir)).filter(name => /^page-\d+\.png$/.test(name)).sort((a,b) =>
      Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    if (names.length !== pages) return null;
    const pageText: string[] = [];
    for (const name of names) {
      const { stdout } = await exec('tesseract', [join(dir, name), 'stdout', '-l', 'eng'],
        { timeout: 12000, maxBuffer: 5_000_000 });
      pageText.push(stdout);
    }
    return pageText.join('\n\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function pdfText(data: Buffer, allowOcr: boolean): Promise<{ text: string; method: AttachmentMethod; scanned: boolean }> {
  const { PDFParse } = await import('pdf-parse');
  const pdf = new PDFParse({ data: new Uint8Array(data) });
  let text: string;
  try { text = (await pdf.getText()).text ?? ''; }
  finally { await pdf.destroy(); }
  if (text.trim()) return { text, method: 'pdf-parse', scanned: false };
  if (!allowOcr) return { text: '', method: 'none', scanned: true };
  try {
    const ocr = await pdfOcr(data);
    if (ocr?.trim()) return { text: ocr, method: 'pdf-ocr', scanned: false };
  } catch { /* OCR is optional; retain scanned rather than fabricating text. */ }
  return { text: '', method: 'none', scanned: true };
}

function kindOf(data: Buffer, url: string, contentType: string): 'pdf' | 'docx' | 'doc' | 'rtf' | 'html' | 'text' | 'unsupported' {
  if (data.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (data.subarray(0, 4).toString('hex') === '504b0304' && /\.docx(?:[?#]|$)/i.test(url)) return 'docx';
  if (data.subarray(0, 4).toString('hex') === 'd0cf11e0') return 'doc';
  if (data.subarray(0, 5).toString('ascii') === '{\\rtf') return 'rtf';
  if (/\.pdf(?:[?#]|$)/i.test(url) || /\.docx?(?:[?#]|$)/i.test(url)) return 'unsupported';
  if (contentType.includes('html') || /^\s*(?:<!doctype html|<html)\b/i.test(data.subarray(0, 200).toString('utf8'))) return 'html';
  if (contentType.startsWith('text/') || /\.txt(?:[?#]|$)/i.test(url)) return 'text';
  return 'unsupported';
}

export async function captureSenateAttachment(
  sourceUrl: string,
  options: { fetcher?: typeof fetch; allowOcr?: boolean; now?: () => string } = {},
): Promise<SenateAttachmentCapture> {
  const now = options.now ?? (() => new Date().toISOString());
  const fetchedAt = now();
  const base: SenateAttachmentCapture = {
    sourceUrl, finalUrl: null, snapshotKey: '', fetchedAt, responseStatus: null,
    sourceContentType: null, byteSize: null, contentSha256: null,
    extractionStatus: 'failed', extractionMethod: 'none',
    rawText: null, publicationDate: null, originalFileRef: sourceUrl, failureKind: null,
  };
  let statusKind: string | null = null;
  try {
    let url = verifiedUrl(sourceUrl);
    const fetcher = options.fetcher ?? fetch;
    let response: Response | null = null;
    for (let n = 0; n <= MAX_REDIRECTS; n++) {
      response = await fetcher(url, {
        redirect: 'manual',
        headers: { 'User-Agent': 'VotePredict/2.0 (Minnesota Senate raw attachment text)',
          Accept: 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,*/*' },
        signal: AbortSignal.timeout(45000),
      });
      if (![301,302,303,307,308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location || n === MAX_REDIRECTS) throw Error('invalid_redirect');
      url = verifiedUrl(new URL(location, url).toString());
    }
    if (!response) throw Error('no_response');
    base.finalUrl = url;
    base.responseStatus = response.status;
    base.sourceContentType = response.headers.get('content-type');
    if (!response.ok) {
      base.extractionStatus = [403,404,410,429].includes(response.status) ? 'unavailable' : 'failed';
      statusKind = 'http_' + String(response.status);
    } else {
      const data = await limitedBody(response);
      base.byteSize = data.byteLength;
      base.contentSha256 = sha(data);
      const type = kindOf(data, url, (base.sourceContentType ?? '').toLowerCase());
      if (!data.length) {
        base.extractionStatus = 'empty';
      } else if (type === 'unsupported') {
        base.extractionStatus = 'unsupported';
      } else {
        let text = '';
        let method: AttachmentMethod = 'none';
        if (type === 'pdf') {
          const pdf = await pdfText(data, options.allowOcr !== false);
          text = pdf.text;
          method = pdf.method;
          if (pdf.scanned) base.extractionStatus = 'scanned';
        } else if (type === 'docx') { text = await unzipDocx(data); method = 'docx-unzip'; }
        else if (type === 'doc') { text = await antiword(data); method = 'doc-antiword'; }
        else if (type === 'rtf') { text = await rtfText(data); method = 'rtf-unrtf'; }
        else if (type === 'html') { text = htmlText(data.toString('utf8')); method = 'html-text'; }
        else { text = data.toString('utf8'); method = 'plain-text'; }
        if (text.trim()) {
          base.rawText = text;
          base.extractionStatus = 'extracted';
          base.extractionMethod = method;
        } else if (base.extractionStatus !== 'scanned') {
          base.extractionStatus = 'empty';
          base.extractionMethod = method;
        }
      }
    }
  } catch (error) {
    const category = error instanceof Error && /^(?:oversize|outside_senate_hosts|invalid_redirect|no_response)$/.test(error.message)
      ? error.message : 'extraction_or_network_error';
    const helperMissing = (error as { code?: unknown } | null)?.code === 'ENOENT';
    statusKind = helperMissing ? 'local_extractor_unavailable' : category;
    base.extractionStatus = category === 'oversize' || helperMissing ? 'unsupported' : 'failed';
  }
  base.failureKind = statusKind;
  // Source bytes key versions; failures without bytes are idempotent by error category.
  base.snapshotKey = sha(sourceUrl + '\n' + (base.contentSha256 ?? 'no-response:' + base.extractionStatus + ':' + (statusKind ?? 'unknown')));
  return base;
}
