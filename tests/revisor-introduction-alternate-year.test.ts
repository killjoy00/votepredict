import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRevisorIntroductionForBackfill } from '../src/operations/revisor-introduction-backfill.js';

const row = {
  bill_id: '00000000-0000-0000-0000-000000004277',
  session_id: '00000000-0000-0000-0000-000000000001',
  chamber_id: '00000000-0000-0000-0000-000000000002',
  identifier: 'HF4277',
  bill_number: 4277,
  existing_introduced_at: null,
};

const incomplete2023 = `
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>4277</FILE_NUMBER>
</BILL>`;

const complete2024 = `
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>4277</FILE_NUMBER>
  <ACTIONS>
    <HOUSE>
      <ACTION>
        <ACTION_DATE>02/26/2024</ACTION_DATE>
        <ACTION_DESCRIPTION>Introduction and first reading, referred to committee</ACTION_DESCRIPTION>
      </ACTION>
    </HOUSE>
  </ACTIONS>
  <TEXT_VERSION_LIST>
    <DOCUMENT>
      <DOCUMENT_NAME>2024.0-HF4277-0</DOCUMENT_NAME>
      <DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT>
      <DATE_INSERT>2024-02-23 12:00:00</DATE_INSERT>
      <HTML_URI>https://www.revisor.mn.gov/bills/93/2024/0/HF/4277/versions/0/</HTML_URI>
    </DOCUMENT>
  </TEXT_VERSION_LIST>
</BILL>`;

test('introduction backfill falls through a valid but pre-introduction alternate-year XML record', async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/93/2023/0/HF/4277/')) {
      return new Response(incomplete2023, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    if (url.includes('/93/2024/0/HF/4277/')) {
      return new Response(complete2024, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  try {
    const result = await fetchRevisorIntroductionForBackfill(row, '2023-2024');
    assert.equal(result.sourceFormat, 'xml');
    assert.equal(result.sourceYear, 2024);
    assert.equal(result.metadata.introducedOn, '2024-02-26');
    assert.equal(result.metadata.initialDocument?.insertedOn, '2024-02-23');
    assert.equal(result.metadata.initialDocumentKnownByIntroduction, true);
    assert.equal(urls.length, 2);
    assert.match(urls[0], /\/2023\/0\/HF\/4277\//);
    assert.match(urls[1], /\/2024\/0\/HF\/4277\//);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('introduction backfill still hard-fails an official XML bill identity mismatch', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('<BILL><FILE_TYPE>HF</FILE_TYPE><FILE_NUMBER>9999</FILE_NUMBER></BILL>', {
      status: 200,
      headers: { 'content-type': 'application/xml' },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      fetchRevisorIntroductionForBackfill(row, '2023-2024'),
      /Revisor bill mismatch: expected HF4277, found HF9999/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
