import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisorRegularSessionStatusXmlUrl,
  parseRevisorCurrentCompanionIdentifier,
  parseRevisorInitialDocument,
  parseRevisorIntroductionMetadata,
} from '../src/sources/minnesota/revisor-introduction.js';

const xml = `<?xml version="1.0"?>
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>10</FILE_NUMBER>
  <COMPANION_TYPE>SF</COMPANION_TYPE>
  <COMPANION_NUMBER>690</COMPANION_NUMBER>
  <TEXT_VERSION_LIST>
    <DOCUMENT>
      <HTML_URI>www.revisor.mn.gov/bills/94/HF/10/versions/0/</HTML_URI>
      <DATE_INSERT>2025-02-06 11:26:33</DATE_INSERT>
      <DOCUMENT_NAME>2025.0-HF0010-0</DOCUMENT_NAME>
      <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
      <DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT>
    </DOCUMENT>
    <DOCUMENT>
      <HTML_URI>www.revisor.mn.gov/bills/94/HF/10/versions/1/</HTML_URI>
      <DATE_INSERT>2025-03-06 15:41:02</DATE_INSERT>
      <DOCUMENT_NAME>2025.0-HF0010-1</DOCUMENT_NAME>
      <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
      <DOCUMENT_ENGROSSMENT>1</DOCUMENT_ENGROSSMENT>
    </DOCUMENT>
  </TEXT_VERSION_LIST>
  <AUTHORS>
    <HOUSE><AUTHOR><AUTHOR_NAME>Later Added Author</AUTHOR_NAME></AUTHOR></HOUSE>
  </AUTHORS>
  <ACTIONS>
    <HOUSE>
      <ACTION>
        <ACTION_NUMBER>1</ACTION_NUMBER>
        <ACTION_TEXT>Introduction and first reading, referred to Taxes</ACTION_TEXT>
        <ACTION_DATE>2025-02-10 00:00:00</ACTION_DATE>
      </ACTION>
      <ACTION>
        <ACTION_NUMBER>2</ACTION_NUMBER>
        <ACTION_TEXT>Author added Later Added Author</ACTION_TEXT>
        <ACTION_DATE>2025-02-20 00:00:00</ACTION_DATE>
      </ACTION>
    </HOUSE>
  </ACTIONS>
</BILL>`;

test('canonical regular-session API URL is derived from audited session and bill identifier', () => {
  assert.equal(
    buildRevisorRegularSessionStatusXmlUrl('2025-2026', 'HF10'),
    'https://api.revisor.mn.gov/bills/v1/94/2025/0/HF/10/',
  );
  assert.equal(
    buildRevisorRegularSessionStatusXmlUrl('2021-2022', 'SF1064'),
    'https://api.revisor.mn.gov/bills/v1/92/2021/0/SF/1064/',
  );
});

test('initial official document is the zero-engrossment document', () => {
  assert.deepEqual(parseRevisorInitialDocument(xml), {
    documentName: '2025.0-HF0010-0',
    insertedAt: '2025-02-06 11:26:33',
    insertedOn: '2025-02-06',
    htmlUrl: 'https://www.revisor.mn.gov/bills/94/HF/10/versions/0/',
    engrossment: 0,
  });
});

test('introduction metadata uses the source-chamber first-reading action and marks current companion ineligible', () => {
  const metadata = parseRevisorIntroductionMetadata({ xml, identifier: 'HF10' });
  assert.equal(metadata.introducedOn, '2025-02-10');
  assert.equal(metadata.initialDocumentKnownByIntroduction, true);
  assert.equal(metadata.currentCompanionIdentifier, 'SF690');
  assert.equal(metadata.companionModelEligible, false);
});

test('later author additions do not enter introduction metadata', () => {
  const metadata = parseRevisorIntroductionMetadata({ xml, identifier: 'HF10' });
  assert.equal('authors' in metadata, false);
  assert.equal(JSON.stringify(metadata).includes('Later Added Author'), false);
});

test('current companion parser rejects empty and invalid companion values', () => {
  assert.equal(parseRevisorCurrentCompanionIdentifier('<BILL><COMPANION_TYPE/><COMPANION_NUMBER/></BILL>'), null);
  assert.equal(parseRevisorCurrentCompanionIdentifier('<BILL><COMPANION_TYPE>HF</COMPANION_TYPE><COMPANION_NUMBER>0</COMPANION_NUMBER></BILL>'), null);
});

test('namespaced status XML is parsed namespace-insensitively', () => {
  const namespaced = `<r:BILL xmlns:r="urn:mn">
    <r:FILE_TYPE>SF</r:FILE_TYPE><r:FILE_NUMBER>42</r:FILE_NUMBER>
    <r:TEXT_VERSION_LIST><r:DOCUMENT><r:HTML_URI>www.revisor.mn.gov/bills/94/SF/42/versions/0/</r:HTML_URI><r:DATE_INSERT>2025-01-15 08:00:00</r:DATE_INSERT><r:DOCUMENT_NAME>2025.0-SF0042-0</r:DOCUMENT_NAME><r:DOCUMENT_ENGROSSMENT>0</r:DOCUMENT_ENGROSSMENT></r:DOCUMENT></r:TEXT_VERSION_LIST>
    <r:ACTIONS><r:SENATE><r:ACTION><r:ACTION_TEXT>Introduction and first reading</r:ACTION_TEXT><r:ACTION_DATE>2025-01-16 00:00:00</r:ACTION_DATE></r:ACTION></r:SENATE></r:ACTIONS>
  </r:BILL>`;
  const metadata = parseRevisorIntroductionMetadata({ xml: namespaced, identifier: 'SF42' });
  assert.equal(metadata.introducedOn, '2025-01-16');
  assert.equal(metadata.initialDocument?.insertedOn, '2025-01-15');
  assert.equal(metadata.initialDocumentKnownByIntroduction, true);
});
