import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { captureSenateAttachment } from '../src/sources/minnesota/senate-committee-attachment-text.js';
import { senateSqlSafeText, decodeSenateRawStorageText } from '../src/sources/minnesota/senate-committee-testimony.js';

const URL = 'https://assets.senate.mn/committees/2025-2026/3140/written_testimony.txt';
const response = (text: string, type = 'text/plain') => new Response(text, {
  status: 200, headers: { 'content-type': type, 'last-modified': 'Tue, 12 May 2026 00:00:00 GMT' },
});

function pdfWithText(text: string): Uint8Array {
  const stream = 'BT /F1 12 Tf 50 700 Td (' + text.replace(/[\\()]/g, '\\$&') + ') Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + 'endstream',
  ];
  let file = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(file));
    file += (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n';
  }
  const start = Buffer.byteLength(file);
  file += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  file += offsets.slice(1).map(offset => String(offset).padStart(10,'0') + ' 00000 n \n').join('');
  file += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF\n';
  return Buffer.from(file);
}

test('raw attachment keeps whole plain text, true response hash, date separation and repeatable source identity', async () => {
  const full = 'WRITTEN TESTIMONY\nFor the committee\n\nPage footer and ordinary boilerplate\n';
  let calls = 0;
  const opts = {
    fetcher: async () => { calls++; return response(full); },
    now: () => '2026-10-16T03:00:00Z',
  };
  const first = await captureSenateAttachment(URL, opts);
  const again = await captureSenateAttachment(URL, opts);
  assert.equal(calls, 2);
  assert.equal(first.rawText, full);
  assert.equal(first.extractionStatus, 'extracted');
  assert.equal(first.extractionMethod, 'plain-text');
  assert.equal(first.contentSha256, createHash('sha256').update(full).digest('hex'));
  assert.equal(first.snapshotKey, again.snapshotKey);
  assert.equal(first.fetchedAt, '2026-10-16T03:00:00Z');
  assert.equal(first.publicationDate, null); // Last-Modified is not a printed publication date.
  assert.equal(first.originalFileRef, URL);
  const altered = await captureSenateAttachment(URL, { ...opts, fetcher: async () => response(full + 'Updated\n') });
  assert.notEqual(first.snapshotKey, altered.snapshotKey);
});

test('genuine PDF parser retains the source text, without summarizing', async () => {
  const bytes = pdfWithText('Senate PDF testimony and ordinary footer');
  const url = 'https://assets.senate.mn/committees/2025-2026/3140/sample.pdf';
  const result = await captureSenateAttachment(url, {
    fetcher: async () => new Response(bytes, { headers: { 'content-type': 'application/pdf' } }),
    allowOcr: false,
  });
  assert.equal(result.extractionStatus, 'extracted');
  assert.equal(result.extractionMethod, 'pdf-parse');
  assert.match(result.rawText ?? '', /Senate PDF testimony/);
  assert.match(result.rawText ?? '', /ordinary footer/);
  assert.equal(result.contentSha256, createHash('sha256').update(bytes).digest('hex'));
});

test('HTML text preserves document prose and remains distinct from an unsupported file', async () => {
  const html = '<html><body><h1>Committee Letter</h1><p>All written testimony.</p><p>Footer</p></body></html>';
  const result = await captureSenateAttachment('https://www.senate.mn/committees/letter', {
    fetcher: async () => response(html, 'text/html'),
  });
  assert.equal(result.extractionStatus, 'extracted');
  assert.equal(result.extractionMethod, 'html-text');
  assert.match(result.rawText ?? '', /Footer/);
  assert.match(result.rawText ?? '', /All written testimony/);
  const unsupported = await captureSenateAttachment('https://assets.senate.mn/file.doc', {
    fetcher: async () => response('not a real Word file','application/msword'),
  });
  assert.equal(unsupported.extractionStatus, 'unsupported');
  assert.equal(unsupported.rawText, null);
});

test('empty body, unavailable HTTP, hostile redirects and extraction errors have distinct bounded statuses', async () => {
  const empty = await captureSenateAttachment(URL, { fetcher: async () => response('') });
  assert.equal(empty.extractionStatus, 'empty');
  const missing = await captureSenateAttachment(URL, { fetcher: async () => new Response('', { status:404 }) });
  assert.equal(missing.extractionStatus, 'unavailable');
  assert.equal(missing.responseStatus, 404);
  assert.equal(missing.contentSha256, null);
  let called = 0;
  const hostile = await captureSenateAttachment(URL, {
    fetcher: async () => { called++; return new Response('', { status:302, headers: { location:'https://unrelated.example/doc.pdf' } }); },
  });
  assert.equal(called, 1);
  assert.equal(hostile.extractionStatus, 'failed');
  assert.equal(hostile.failureKind, 'outside_senate_hosts');
  const failed = await captureSenateAttachment(URL, { fetcher: async () => { throw Error('network offline'); } });
  assert.equal(failed.extractionStatus, 'failed');
  assert.equal(failed.failureKind, 'extraction_or_network_error');
});

test('SQL-safe storage round trips byte-decoder oddities without replacing raw prose', () => {
  const raw = 'Testimony text\0 all characters ' + String.fromCharCode(0xd800);
  const storage = senateSqlSafeText(raw);
  assert.ok(storage?.startsWith('raw-utf16le-base64:'));
  assert.equal(decodeSenateRawStorageText(storage!), raw);
});

test('Neon/Postgres capture snapshot identity is idempotent and preserves earlier content hashes', async t => {
  const connectionString = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL
    ?? process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) return t.skip('No disposable Postgres configured');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max:1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const table = await client.query<{ name: string | null }>(
      "SELECT to_regclass('public.senate_committee_attachment_text_captures')::text AS name");
    if (!table.rows[0]?.name) return t.skip('Additive migration not installed in this test database');
    const url = 'https://assets.senate.mn/committees/2025-2026/raw-test-fixture.txt';
    const insert = [
      'INSERT INTO senate_committee_attachment_text_captures',
      '(source_url,snapshot_key,fetched_at,last_checked_at,response_status,source_content_type,',
      'byte_size,content_sha256,extraction_status,extraction_method,raw_text,original_file_ref)',
      "VALUES ($1,$2,'2026-10-15','2026-10-15',200,'text/plain',10,$2,'extracted','plain-text',$3,$1)",
      'ON CONFLICT (source_url,snapshot_key) DO NOTHING',
    ].join(' ');
    const hashA = 'a'.repeat(64), hashB = 'b'.repeat(64);
    await client.query(insert, [url, hashA, 'complete original testimony']);
    await client.query(insert, [url, hashA, 'mutated text must not replace the first capture']);
    await client.query(insert, [url, hashB, 'changed original content']);
    const result = await client.query<{ snapshot_key: string; raw_text: string }>(
      'SELECT snapshot_key,raw_text FROM senate_committee_attachment_text_captures WHERE source_url=$1 ORDER BY snapshot_key',
      [url]);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].raw_text, 'complete original testimony');
    assert.equal(result.rows[1].raw_text, 'changed original content');
    await assert.rejects(client.query(insert, [url, 'c'.repeat(64), null]));
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
