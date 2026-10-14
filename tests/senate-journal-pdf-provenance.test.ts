import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { snapshotSenateJournalPdfIntegrity } from '../src/sources/minnesota/senate-journals.js';

test('journal PDF raw bytes retain original SHA and length before the PDF worker detaches them', () => {
  const raw = new TextEncoder().encode('%PDF-1.7\n' + 'expected original source bytes\n'.repeat(72));
  const expectedHash = createHash('sha256').update(raw).digest('hex');
  const byteLength = raw.byteLength;
  const verified = snapshotSenateJournalPdfIntegrity(raw);
  assert.equal(verified.byteLength, byteLength);
  assert.equal(verified.pdfSha256, expectedHash);
  assert.notEqual(verified.pdfSha256, createHash('sha256').update('').digest('hex'));

  // Simulates the transfer that caused the real zero-byte integrity receipt.
  structuredClone(raw.buffer, { transfer: [raw.buffer] });
  assert.equal(raw.byteLength, 0);
  assert.deepEqual(verified, { pdfSha256: expectedHash, byteLength });
  assert.throws(() => snapshotSenateJournalPdfIntegrity(raw), /nonempty/);
});

test('invalid or empty PDF body fails closed, rather than returning SHA256(empty)', () => {
  assert.throws(() => snapshotSenateJournalPdfIntegrity(new Uint8Array()), /nonempty/);
  assert.throws(() => snapshotSenateJournalPdfIntegrity(new TextEncoder().encode('not a PDF'.repeat(110))), /nonempty/);
});

test('production Senate PDF fetcher snapshots raw source identity BEFORE creating PDFParse worker', () => {
  const source = readFileSync(
    new URL('../src/sources/minnesota/senate-journals.ts', import.meta.url), 'utf8',
  );
  const fetcher = source.slice(source.indexOf('export async function fetchSenateJournal('));
  const shaCapture = fetcher.indexOf('snapshotSenateJournalPdfIntegrity(bytes)');
  const workerCreation = fetcher.indexOf('new PDFParse({ data: bytes');
  assert.ok(shaCapture >= 0 && workerCreation >= 0 && shaCapture < workerCreation,
    'The original body must be SHA-hashed before pdf-parse worker transfers/detaches the input');
  assert.match(fetcher, /return \{\s*text: result\.text,\s*pdfSha256,\s*byteLength\s*\}/);
});

test('House Research legislative summary PDFs likewise must be hashed before parser-worker detachment', () => {
  const source = readFileSync(
    new URL('../src/operations/historical-house-research-summary-backfill.ts', import.meta.url), 'utf8',
  );
  const snippet = source.slice(source.indexOf('const bytes = new Uint8Array(await response.arrayBuffer())'));
  const hashBeforeParser = snippet.indexOf("const sourcePdfSha256 = createHash('sha256').update(bytes).digest('hex')");
  const parser = snippet.indexOf('new PDFParse({ data: bytes, CanvasFactory })');
  const savedReceipt = snippet.indexOf('sha256: sourcePdfSha256');
  assert.ok(hashBeforeParser >= 0 && parser >= 0 && savedReceipt >= 0 && hashBeforeParser < parser,
    'House legislative research document sha must identify raw PDF bytes, not the detached worker buffer');
});
