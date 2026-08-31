import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisorSearchParams,
  buildRevisorTextUrl,
  parseRevisorBillHtml,
  parseRevisorSearchXml,
  validateRevisorTextUrl,
} from '../src/services/revisor.js';

const XML = `<?xml version="1.0"?>
<SEARCH_RESULTS>
  <BILL_RESULT>
    <FILE_TYPE>HF</FILE_TYPE>
    <FILE_NUMBER>0010</FILE_NUMBER>
    <STATUS_XML_URI>api.revisor.mn.gov/bills/v1/94/2025/0/HF/10/</STATUS_XML_URI>
    <LATEST_TEXT_HTML_URI>www.revisor.mn.gov/bills/94/2025/0/HF/10/versions/latest/</LATEST_TEXT_HTML_URI>
    <DESCRIPTION>Taxes &amp; appropriations changed.</DESCRIPTION>
  </BILL_RESULT>
  <BILL_RESULT>
    <FILE_TYPE>SF</FILE_TYPE>
    <FILE_NUMBER>10</FILE_NUMBER>
    <STATUS_XML_URI>api.revisor.mn.gov/bills/v1/94/2025/0/SF/10/</STATUS_XML_URI>
    <LATEST_TEXT_HTML_URI>www.revisor.mn.gov/bills/94/2025/0/SF/10/versions/latest/</LATEST_TEXT_HTML_URI>
    <DESCRIPTION>Companion bill.</DESCRIPTION>
  </BILL_RESULT>
</SEARCH_RESULTS>`;

test('bill-number searches use the official XML API parameters', () => {
  const params = buildRevisorSearchParams('HF 0010');
  assert.equal(params.session, '0942025');
  assert.equal(params.bill, '10');
  assert.equal(params.format, 'xml');
  assert.equal(params.submit_bill, 'GO');
});

test('keyword searches select all useful bill fields', () => {
  const params = buildRevisorSearchParams('clean energy');
  assert.equal(params.keyword, 'clean energy');
  assert.equal(params.keyword_field_short, '1');
  assert.equal(params.keyword_field_long, '1');
  assert.equal(params.keyword_field_title, '1');
});

test('Revisor XML parser filters an explicit chamber and decodes fields', () => {
  const bills = parseRevisorSearchXml(XML, 'HF');
  assert.equal(bills.length, 1);
  assert.equal(bills[0].number, 'HF 10');
  assert.equal(bills[0].title, 'Taxes & appropriations changed.');
  assert.equal(bills[0].session, '94th Legislature (2025-2026)');
  assert.equal(bills[0].sourceUrl, 'https://www.revisor.mn.gov/bills/94/2025/0/HF/10/versions/latest/');
  assert.equal(bills[0].textUrl, bills[0].sourceUrl);
});

test('bill text URL validation prevents arbitrary upstream requests', () => {
  assert.equal(
    buildRevisorTextUrl('HF 0010'),
    'https://www.revisor.mn.gov/bills/94/2025/0/HF/10/versions/latest/',
  );
  assert.equal(
    validateRevisorTextUrl('https://www.revisor.mn.gov/bills/94/2025/0/HF/10/versions/latest/?ignored=1'),
    'https://www.revisor.mn.gov/bills/94/2025/0/HF/10/versions/latest/',
  );
  assert.throws(
    () => validateRevisorTextUrl('https://attacker.example/bills/94/2025/0/HF/10/versions/latest/'),
    /Only official/,
  );
});

test('official bill HTML parser extracts provisions and removes visual annotations', () => {
  const html = `<main><div id="document" class="col">
    <p>A bill for an act<br/>relating to testing and public services.</p>
    <span class="sr-only">new text begin</span>
    <h2>Section 1.</h2>
    <p>This section <span class="del">would have delayed but now</span> creates a detailed program for Minnesota residents and explains the eligibility rules, funding source, administration, and effective date.</p>
    <p>The commissioner must publish an annual report beginning January 1, 2027.</p>
  </div></main>`;
  const result = parseRevisorBillHtml(html);
  assert.match(result.text, /A bill for an act\nrelating to testing/);
  assert.match(result.text, /Section 1/);
  assert.doesNotMatch(result.text, /new text begin/);
  assert.doesNotMatch(result.text, /would have delayed/);
  assert.equal(result.truncated, false);
});
