import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRevisorBillCandidateUrls, buildRevisorBillUrl, buildRevisorLatestTextUrl, parseRevisorBillStatusHtml, parseRevisorBillTextHtml } from '../src/sources/minnesota/revisor.js';

test('Revisor URLs are session-aware for all target legislatures', () => {
  assert.equal(buildRevisorBillUrl('302', 'HF 4252'), 'https://www.revisor.mn.gov/bills/94/2025/0/HF/4252/');
  assert.equal(buildRevisorBillUrl('300', 'SF1'), 'https://www.revisor.mn.gov/bills/93/2023/0/SF/1/');
  assert.equal(buildRevisorBillUrl('257', 'HF 10'), 'https://www.revisor.mn.gov/bills/92/2021/0/HF/10/');
  assert.equal(buildRevisorLatestTextUrl('300', 'HF1'), 'https://www.revisor.mn.gov/bills/93/2023/0/HF/1/versions/latest/');
});

test('Revisor candidates include both calendar years of a biennium', () => {
  assert.deepEqual(buildRevisorBillCandidateUrls('302', 'HF4252'), [
    'https://www.revisor.mn.gov/bills/94/2025/0/HF/4252/',
    'https://www.revisor.mn.gov/bills/94/2026/0/HF/4252/',
  ]);
});

test('Revisor status parser reads current version, companion, and dated historical versions', () => {
  const html = `<html><body>
    <h1>HF 4252</h1>
    <p>Current bill text: <a href="versions/latest/">4th Engrossment</a></p>
    <p>Companion: <a href="/bills/94/2026/0/SF/4020/">SF4020</a></p>
    <h2>Bill Text Versions</h2>
    <a href="versions/0/">Introduction</a> <a href="versions/0.pdf">PDF</a> | Posted on 02/10/2026 |
    <a href="versions/1/">1st Engrossment</a> <a href="versions/1.pdf">PDF</a> | Posted on 03/01/2026 |
    <h2>Description</h2><p>Omnibus Higher Education policy bill</p>
  </body></html>`;
  const sourceUrl = 'https://www.revisor.mn.gov/bills/94/2026/0/HF/4252/';
  const result = parseRevisorBillStatusHtml({ html, sessionKey: '302', billIdentifier: 'HF4252', sourceUrl });
  assert.equal(result.identifier, 'HF4252');
  assert.equal(result.legislature, 94);
  assert.equal(result.currentVersion, '4th Engrossment');
  assert.equal(result.companionIdentifier, 'SF4020');
  assert.equal(result.description, 'Omnibus Higher Education policy bill');
  assert.equal(result.sourceUrl, sourceUrl);
  assert.equal(result.latestTextUrl, `${sourceUrl}versions/latest/`);
  assert.deepEqual(result.versions, [
    { versionKey: 'Introduction', ordinal: 0, postedOn: '2026-02-10', textUrl: `${sourceUrl}versions/0/` },
    { versionKey: '1st Engrossment', ordinal: 1, postedOn: '2026-03-01', textUrl: `${sourceUrl}versions/1/` },
  ]);
});

test('Revisor bill text parser extracts the document and hashes normalized text', () => {
  const repeated = 'A bill for an act relating to public policy; '.repeat(5);
  const html = `<main><div id="document"><p>${repeated}</p><p>BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA:</p></div></main>`;
  const result = parseRevisorBillTextHtml(html);
  assert.match(result.text, /BE IT ENACTED/);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});
