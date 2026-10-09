import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fetchAndSealP8RevisorReceipt,
  sealP8RevisorReceipt,
  verifyP8RevisorReceipt,
  persistP8RevisorReceipt,
  buildP8BillInputsFromOfficialReceipts,
  buildVerifiedP8OfflineReceiptCapture,
  type P8RevisorReceipt,
  type P8SessionCalendarDatum,
} from '../src/evaluation/lifecycle-p8-revisor-receipts.js';
import { buildOfflineP8DailyCapture } from '../src/evaluation/lifecycle-p8-daily-capture.js';
import { verifyOfflineP8BatchIntegrity } from '../src/evaluation/lifecycle-p8-offline-store.js';
import {
  inspectP8ModelDocument,
  verifyPinnedP8FrozenModelJson,
  P8_FROZEN_MODEL_JSON_RAW_SHA256,
} from '../src/evaluation/lifecycle-p8-frozen-model-verify.js';

const URL_2027 = 'https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/42/';
const RAW_1 = [
  '<?xml version="1.0"?><BILL><FILE_TYPE>HF</FILE_TYPE><FILE_NUMBER>42</FILE_NUMBER>',
  '<TEXT_VERSION_LIST><DOCUMENT><DOCUMENT_NAME>2027.0-HF0042-0</DOCUMENT_NAME>',
  '<DOCUMENT_TYPE>official</DOCUMENT_TYPE><DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT>',
  '<DATE_INSERT>2027-01-04 12:00:00</DATE_INSERT>',
  '<HTML_URI>https://www.revisor.mn.gov/bills/95/HF/42/versions/0/</HTML_URI>',
  '</DOCUMENT></TEXT_VERSION_LIST>',
  '<ACTIONS><HOUSE><ACTION><ACTION_DATE>2027-01-04 00:00:00</ACTION_DATE>',
  '<ACTION_TEXT>Introduction and first reading, referred to Transportation</ACTION_TEXT>',
  '</ACTION></HOUSE></ACTIONS></BILL>',
].join('\n');
const RAW_2 = RAW_1.replace(
  '</TEXT_VERSION_LIST>',
  '<DOCUMENT><DOCUMENT_NAME>2027.0-HF0042-1</DOCUMENT_NAME>' +
  '<DOCUMENT_TYPE>official</DOCUMENT_TYPE><DOCUMENT_ENGROSSMENT>1</DOCUMENT_ENGROSSMENT>' +
  '<DATE_INSERT>2027-01-09 12:00:00</DATE_INSERT>' +
  '<HTML_URI>https://www.revisor.mn.gov/bills/95/HF/42/versions/1/</HTML_URI>' +
  '</DOCUMENT></TEXT_VERSION_LIST>',
).replace('</HOUSE></ACTIONS>',
  '<ACTION><ACTION_DATE>2027-01-09 00:00:00</ACTION_DATE>' +
  '<ACTION_TEXT>Second reading</ACTION_TEXT></ACTION></HOUSE></ACTIONS>');
const CALENDAR: P8SessionCalendarDatum = {
  // Synthetic fixture datum; this SHA is not a real verified calendar capture.
  sourceUrl: 'https://www.revisor.mn.gov',
  sourceSha256: 'c'.repeat(64),
  observedAt: '2027-01-02T15:00:00.000Z',
  adjournmentOn: '2028-05-20',
};
const receive = (xml: string, observedAt: string): P8RevisorReceipt =>
  sealP8RevisorReceipt({ sourceUrl: URL_2027, identifier: 'HF42', xml, observedAt });
const first = receive(RAW_1, '2027-01-05T16:00:00.000Z');
const later = receive(RAW_2, '2027-01-10T16:00:00.000Z');
const books = [{ billId: 'authoritative-fixture-42', identifier: 'HF42',
  receipts: [first, later] }];

test('mocked official HTTPS response stamps acquisition on receipt, independently of action dates', async () => {
  const requests: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, options?: RequestInit) => {
    requests.push(String(input));
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store');
    return new Response(RAW_1, { status: 200, headers: { 'content-type': 'application/xml' } });
  }) as typeof fetch;
  const receipt = await fetchAndSealP8RevisorReceipt(URL_2027, 'HF42', {
    fetcher, receivedClock: () => new Date('2027-01-05T16:00:00.000Z'),
  });
  assert.deepEqual(receipt, first);
  assert.deepEqual(requests, [URL_2027]);
  verifyP8RevisorReceipt(receipt);
  assert.equal(receipt.sourceSha256, createHash('sha256').update(RAW_1).digest('hex'));
});

test('official XML receipt requires 95th-legislature exact bill, rejects tampering and SSRF', async () => {
  for (const url of [
    'https://www.example.com/bills/v1/95/2027/0/HF/42/',
    'https://api.revisor.mn.gov/bills/v1/94/2027/0/HF/42/',
    'https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/43/',
    'https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/42/?download=1',
    'http://api.revisor.mn.gov/bills/v1/95/2027/0/HF/42/',
  ]) {
    assert.throws(() => sealP8RevisorReceipt({
      identifier: 'HF42', sourceUrl: url, xml: RAW_1,
      observedAt: '2027-01-05T16:00:00.000Z',
    }), /official Revisor XML URL/);
  }
  assert.throws(() => receive(RAW_1.replace('<FILE_NUMBER>42</FILE_NUMBER>',
    '<FILE_NUMBER>43</FILE_NUMBER>'), '2027-01-05T16:00:00.000Z'), /mismatched/);
  assert.throws(() => receive('<!DOCTYPE BILL [<!ENTITY xxe "unsafe">]><BILL></BILL>',
    '2027-01-05T16:00:00.000Z'), /official bill XML/);
  assert.throws(() => receive(RAW_1, '2027-01-05T16:00:00'), /canonical UTC acquisition/);
  assert.throws(() => verifyP8RevisorReceipt({ ...first, xml: RAW_1 + ' ' }), /Modified Revisor/);
  assert.throws(() => verifyP8RevisorReceipt({ ...first, actualPassed: true } as P8RevisorReceipt),
    /unrecognized or outcome-bearing/);
  const fetcher = (async () => new Response(RAW_1, { status: 500 })) as typeof fetch;
  await assert.rejects(() => fetchAndSealP8RevisorReceipt(URL_2027, 'HF42',
    { fetcher }), /failed/);
});

test('as-of conversion never imports later-fetched prior-dated stage or version', () => {
  const on10 = buildP8BillInputsFromOfficialReceipts({
    cutoffDateExclusive: '2027-01-10', calendar: CALENDAR, bills: books,
  });
  assert.equal(on10.length, 1);
  assert.equal(on10[0].firstObservedAt, first.observedAt);
  assert.equal(on10[0].sourceSha256, first.sourceSha256);
  assert.equal(on10[0].process.events.length, 1);
  assert.equal(on10[0].process.events[0].observedAt, first.observedAt);
  assert.equal(on10[0].process.events[0].occurredOn, '2027-01-04');
  assert.equal(on10[0].billVersions.length, 1);
  assert.equal(on10[0].billVersions[0].textHash, null);
  assert.equal(on10[0].billVersions[0].versionKey, '2027.0-HF0042-0');

  const on11 = buildP8BillInputsFromOfficialReceipts({
    cutoffDateExclusive: '2027-01-11', calendar: CALENDAR, bills: books,
  });
  assert.equal(on11[0].process.events.length, 2);
  assert.equal(on11[0].process.events.find(e => e.stageKind === 'second_reading')?.observedAt,
    later.observedAt);
  assert.equal(on11[0].billVersions.length, 2);
  assert.equal(on11[0].billVersions.find(v => v.versionKey.endsWith('-1'))?.observedAt,
    later.observedAt);

  const today = buildOfflineP8DailyCapture({
    cutoffDateExclusive: '2027-01-10',
    capturedAt: '2027-01-10T18:00:00.000Z',
    source: 'offline_observed_revisor_receipts', bills: on10,
  });
  const tomorrow = buildOfflineP8DailyCapture({
    cutoffDateExclusive: '2027-01-11',
    capturedAt: '2027-01-11T18:00:00.000Z',
    source: 'offline_observed_revisor_receipts', bills: on11,
  });
  verifyOfflineP8BatchIntegrity(today);
  verifyOfflineP8BatchIntegrity(tomorrow);
  assert.equal(today.rows[0].features.lifecycleState, 'committee_process_engagement');
  assert.equal(tomorrow.rows[0].features.lifecycleState, 'floor_eligibility_or_scheduling');
  assert.equal(today.rows[0].lineage.calendarEvidence?.observedAt, CALENDAR.observedAt);
  assert.equal(today.rows[0].features.latestEligibleBillVersion?.versionKey, '2027.0-HF0042-0');
  assert.equal(tomorrow.rows[0].features.latestEligibleBillVersion?.versionKey, '2027.0-HF0042-1');
  assert.equal(today.rows[0].memberVoteLabel, null);
  assert.equal(tomorrow.predictionsComputed, false);
});

test('receipt series cannot backfill an unobserved day', () => {
  const tooRecent = buildP8BillInputsFromOfficialReceipts({
    cutoffDateExclusive: '2027-01-10', calendar: CALENDAR,
    bills: [{ billId: 'authoritative-fixture-42', identifier: 'HF42', receipts: [later] }],
  });
  assert.deepEqual(tooRecent, []);
});

test('calendar datum must have separate earlier observed provenance', () => {
  assert.throws(() => buildP8BillInputsFromOfficialReceipts({
    cutoffDateExclusive: '2027-01-10',
    calendar: { ...CALENDAR, observedAt: '2027-01-10T19:00:00.000Z' }, bills: books,
  }), /not observed before/);
  assert.throws(() => buildOfflineP8DailyCapture({
    cutoffDateExclusive: '2027-01-10',
    capturedAt: '2027-01-10T18:00:00.000Z',
    source: 'offline_observed_revisor_receipts',
    bills: [{ ...buildP8BillInputsFromOfficialReceipts({
      cutoffDateExclusive: '2027-01-10', calendar: CALENDAR, bills: books,
    })[0], calendarEvidence: undefined }],
  }), /requires timestamped calendar evidence/);
});

test('source import rejects bill-universe identity mismatch and changed introduction dates', () => {
  assert.throws(() => buildP8BillInputsFromOfficialReceipts({
    cutoffDateExclusive: '2027-01-11', calendar: CALENDAR,
    bills: [{ billId: 'fixture', identifier: 'SF42', receipts: [first] }],
  }), /identifier does not match/);
  const changedIntro = RAW_1.replace('2027-01-04 00:00:00', '2027-01-03 00:00:00');
  const different = receive(changedIntro, '2027-01-09T18:00:00.000Z');
  assert.throws(() => buildP8BillInputsFromOfficialReceipts({
    cutoffDateExclusive: '2027-01-11', calendar: CALENDAR,
    bills: [{ billId: 'fixture', identifier: 'HF42', receipts: [first,different] }],
  }), /introduction date changed/);
});

test('original official-source receipts persist as exclusive immutable local files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vp-p8-xml-receipts-'));
  try {
    const one = await persistP8RevisorReceipt(first, dir);
    const two = await persistP8RevisorReceipt(first, dir);
    assert.equal(one.result, 'created');
    assert.equal(two.result, 'already_present');
    assert.equal(one.path, two.path);
    assert.equal((await readdir(dir)).length, 1);
    assert.deepEqual(JSON.parse(await readFile(one.path,'utf8')), first);
    await assert.rejects(() => persistP8RevisorReceipt({ ...first,
      sourceSha256: 'b'.repeat(64) }, dir), /Modified/);
    assert.equal((await readdir(dir)).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('model bridge fails closed unless EXACT frozen P8 bytes are supplied', () => {
  assert.throws(() => buildVerifiedP8OfflineReceiptCapture({
    modelJsonBytes: Buffer.from('{"modelContent":{}}'),
    cutoffDateExclusive: '2027-01-10',
    capturedAt: '2027-01-10T18:00:00.000Z',
    calendar: CALENDAR, bills: books,
  }), /original file bytes/);
});

test('model-file primitive checks both independent byte and model-content digests', () => {
  const content = { sample: 'synthetic-only', noModelFit: true };
  const digest = (s: Uint8Array | string) => createHash('sha256').update(s).digest('hex');
  const payload = Buffer.from(JSON.stringify({
    modelContent: content, modelContentSha256: digest(JSON.stringify(content)),
  }));
  const checked = inspectP8ModelDocument(payload, {
    rawSha256: digest(payload), modelContentSha256: digest(JSON.stringify(content)),
  });
  assert.equal(checked.rawSha256, digest(payload));
  assert.equal(checked.modelContentSha256, digest(JSON.stringify(content)));
  assert.throws(() => inspectP8ModelDocument(Buffer.from(payload.toString()+' '), {
    rawSha256: digest(payload), modelContentSha256: digest(JSON.stringify(content)),
  }), /original file bytes/);
  const wronglyEmbedded = Buffer.from(JSON.stringify({
    modelContent: content, modelContentSha256: '0'.repeat(64),
  }));
  assert.throws(() => inspectP8ModelDocument(wronglyEmbedded, {
    rawSha256: digest(wronglyEmbedded), modelContentSha256: digest(JSON.stringify(content)),
  }), /embedded claim/);
  assert.equal(P8_FROZEN_MODEL_JSON_RAW_SHA256,
    '850aa4344bfe1635622af95c8f0871a38cbc234dc23eb9ae50085da668fcfc76');
  assert.throws(() => verifyPinnedP8FrozenModelJson(payload), /original file bytes/);
});
