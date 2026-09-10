import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisorBillSearchUrl,
  parseRevisorBillSearchXml,
  REVISOR_SEARCH_RESULT_LIMIT,
  revisorSearchSessionValue,
} from '../src/sources/minnesota/revisor-bill-search.js';

test('builds Revisor search session keys from canonical VotePredict sessions', () => {
  assert.equal(revisorSearchSessionValue('2021-2022'), '0922021');
  assert.equal(revisorSearchSessionValue('2023-2024'), '0932023');
  assert.equal(revisorSearchSessionValue('2025-2026'), '0942025');
});

test('builds the documented Revisor bill-status XML search shape', () => {
  const url = new URL(buildRevisorBillSearchUrl({
    sessionKey: '2025-2026',
    body: 'House',
    firstBill: 1,
    lastBill: REVISOR_SEARCH_RESULT_LIMIT,
  }));
  assert.equal(url.origin, 'https://www.revisor.mn.gov');
  assert.equal(url.pathname, '/bills/status_result.php');
  assert.equal(url.searchParams.get('session'), '0942025');
  assert.equal(url.searchParams.get('body'), 'House');
  assert.equal(url.searchParams.get('location'), 'House');
  assert.equal(url.searchParams.get('bill'), '1-500');
  assert.equal(url.searchParams.get('format'), 'xml');
});

test('refuses ranges larger than the Revisor 500-result cap', () => {
  assert.throws(() => buildRevisorBillSearchUrl({
    sessionKey: '2025-2026',
    body: 'House',
    firstBill: 1,
    lastBill: 501,
  }), /cannot exceed 500/);
});

test('parses Revisor BILL_RESULT rows without fuzzy identifiers', () => {
  const xml = `<?xml version="1.0"?>
  <SEARCH_RESULTS>
    <BILL_RESULT>
      <FILE_TYPE>HF</FILE_TYPE>
      <FILE_NUMBER>10</FILE_NUMBER>
      <STATUS_XML_URI>api.revisor.mn.gov/bills/v1/94/2025/0/HF/10/</STATUS_XML_URI>
      <LATEST_TEXT_HTML_URI>www.revisor.mn.gov/bills/94/2025/0/HF/10/latest/</LATEST_TEXT_HTML_URI>
      <DESCRIPTION>Consumer &amp; privacy protections expanded.</DESCRIPTION>
    </BILL_RESULT>
    <BILL_RESULT>
      <FILE_TYPE>SF</FILE_TYPE>
      <FILE_NUMBER>7</FILE_NUMBER>
      <STATUS_XML_URI>https://api.revisor.mn.gov/bills/v1/94/2025/0/SF/7/</STATUS_XML_URI>
      <DESCRIPTION>Second bill.</DESCRIPTION>
    </BILL_RESULT>
  </SEARCH_RESULTS>`;

  assert.deepEqual(parseRevisorBillSearchXml(xml), [
    {
      identifier: 'HF10',
      fileType: 'HF',
      fileNumber: 10,
      description: 'Consumer & privacy protections expanded.',
      statusXmlUrl: 'https://api.revisor.mn.gov/bills/v1/94/2025/0/HF/10/',
      latestTextHtmlUrl: 'https://www.revisor.mn.gov/bills/94/2025/0/HF/10/latest/',
    },
    {
      identifier: 'SF7',
      fileType: 'SF',
      fileNumber: 7,
      description: 'Second bill.',
      statusXmlUrl: 'https://api.revisor.mn.gov/bills/v1/94/2025/0/SF/7/',
      latestTextHtmlUrl: undefined,
    },
  ]);
});
