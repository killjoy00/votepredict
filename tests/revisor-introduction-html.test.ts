import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisorRegularSessionStatusHtmlUrls,
  parseRevisorIntroductionStatusHtml,
} from '../src/sources/minnesota/revisor-introduction-html.js';

const hf265Html = `<!doctype html>
<html>
  <head><title>HF 265 Status in the House - 92nd Legislature (2021 - 2022)</title></head>
  <body>
    <h1>HF 265</h1>
    <div>92nd Legislature (2021 - 2022)</div>
    <section>
      <h2>Bill Text Versions</h2>
      <div><a href="/bills/92/2021/0/HF/265/versions/0/">Introduction</a> <a href="/bills/92/2021/0/HF/265/versions/0/pdf/">PDF</a> Posted on 01/21/2021</div>
    </section>
    <section>
      <h2>Actions</h2>
      <div>01/21/2021</div><div>Introduction and first reading, referred to Housing Finance and Policy</div>
      <div>02/22/2021</div><div>Committee report, to adopt and re-refer to Judiciary Finance and Civil Law</div>
    </section>
  </body>
</html>`;

test('regular-session official status HTML candidates cover both calendar years in a biennium', () => {
  assert.deepEqual(
    buildRevisorRegularSessionStatusHtmlUrls('2021-2022', 'HF265'),
    [
      'https://www.revisor.mn.gov/bills/92/2021/0/HF/265/?body=House&list=open',
      'https://www.revisor.mn.gov/bills/92/2022/0/HF/265/?body=House&list=open',
    ],
  );
  assert.deepEqual(
    buildRevisorRegularSessionStatusHtmlUrls('2025-2026', 'SF42'),
    [
      'https://www.revisor.mn.gov/bills/94/2025/0/SF/42/?body=Senate&list=open',
      'https://www.revisor.mn.gov/bills/94/2026/0/SF/42/?body=Senate&list=open',
    ],
  );
});

test('official status HTML proves HF265 introduction timing and zero-engrossment initial document', () => {
  const metadata = parseRevisorIntroductionStatusHtml({
    html: hf265Html,
    identifier: 'HF265',
    session: '2021-2022',
    sourceYear: 2021,
  });

  assert.equal(metadata.identifier, 'HF265');
  assert.equal(metadata.sourceChamber, 'house');
  assert.equal(metadata.introducedOn, '2021-01-21');
  assert.deepEqual(metadata.initialDocument, {
    documentName: '2021.0-HF0265-0',
    insertedAt: null,
    insertedOn: '2021-01-21',
    htmlUrl: 'https://www.revisor.mn.gov/bills/92/2021/0/HF/265/versions/0/',
    engrossment: 0,
  });
  assert.equal(metadata.initialDocumentKnownByIntroduction, true);
  assert.equal(metadata.currentCompanionIdentifier, null);
  assert.equal(metadata.companionModelEligible, false);
});

test('official status HTML supports bills introduced in the second calendar year', () => {
  const html = `<!doctype html><html><body>
    <h1>SF 42</h1><div>92nd Legislature (2021 - 2022)</div>
    <div>Introduction PDF Posted on 02/01/2022</div>
    <div>02/02/2022 Introduction and first reading, referred to Rules</div>
  </body></html>`;

  const metadata = parseRevisorIntroductionStatusHtml({
    html,
    identifier: 'SF42',
    session: '2021-2022',
    sourceYear: 2022,
  });

  assert.equal(metadata.sourceChamber, 'senate');
  assert.equal(metadata.introducedOn, '2022-02-02');
  assert.equal(metadata.initialDocument?.documentName, '2022.0-SF0042-0');
  assert.equal(metadata.initialDocument?.insertedOn, '2022-02-01');
  assert.equal(metadata.initialDocument?.htmlUrl, 'https://www.revisor.mn.gov/bills/92/2022/0/SF/42/versions/0/');
  assert.equal(metadata.initialDocumentKnownByIntroduction, true);
});

test('official status HTML rejects the wrong bill identity', () => {
  assert.throws(
    () => parseRevisorIntroductionStatusHtml({
      html: hf265Html.replaceAll('HF 265', 'HF 266'),
      identifier: 'HF265',
      session: '2021-2022',
      sourceYear: 2021,
    }),
    /does not identify the requested bill/,
  );
});

test('official status HTML rejects a page from the wrong legislature or biennium', () => {
  const wrongSession = hf265Html
    .replaceAll('92nd Legislature (2021 - 2022)', '93rd Legislature (2023 - 2024)')
    .replaceAll('/bills/92/2021/', '/bills/93/2023/');

  assert.throws(
    () => parseRevisorIntroductionStatusHtml({
      html: wrongSession,
      identifier: 'HF265',
      session: '2021-2022',
      sourceYear: 2021,
    }),
    /does not identify the expected legislature\/biennium/,
  );
});

test('official status HTML requires introduction year to match the resolved status year', () => {
  assert.throws(
    () => parseRevisorIntroductionStatusHtml({
      html: hf265Html,
      identifier: 'HF265',
      session: '2021-2022',
      sourceYear: 2022,
    }),
    /introduction year 2021 does not match status year 2022/,
  );
});

test('official status HTML does not mark a later-posted initial document as introduction-visible', () => {
  const metadata = parseRevisorIntroductionStatusHtml({
    html: hf265Html.replace('Posted on 01/21/2021', 'Posted on 01/22/2021'),
    identifier: 'HF265',
    session: '2021-2022',
    sourceYear: 2021,
  });

  assert.equal(metadata.introducedOn, '2021-01-21');
  assert.equal(metadata.initialDocument?.insertedOn, '2021-01-22');
  assert.equal(metadata.initialDocumentKnownByIntroduction, false);
});
