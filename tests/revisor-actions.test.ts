import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditRevisorSourceChamberPassage,
  normalizeRevisorStatusXmlUrl,
  parseRevisorOfficialActions,
} from '../src/sources/minnesota/revisor-actions.js';

const xml = `<?xml version="1.0"?>
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>4591</FILE_NUMBER>
  <ACTIONS>
    <ACTION>
      <ACTION_BODY>House</ACTION_BODY>
      <ACTION_DATE>05/07/2026</ACTION_DATE>
      <ACTION_DESCRIPTION>Third reading as amended</ACTION_DESCRIPTION>
    </ACTION>
    <ACTION>
      <ACTION_BODY>House</ACTION_BODY>
      <ACTION_DATE>05/07/2026</ACTION_DATE>
      <ACTION_DESCRIPTION>Bill was passed as amended</ACTION_DESCRIPTION>
    </ACTION>
    <ACTION>
      <ACTION_BODY>Senate</ACTION_BODY>
      <ACTION_DATE>05/16/2026</ACTION_DATE>
      <ACTION_DESCRIPTION>Third reading Passed</ACTION_DESCRIPTION>
    </ACTION>
  </ACTIONS>
</BILL>`;

test('Revisor action parser preserves fields, chamber, date, and descriptions', () => {
  const actions = parseRevisorOfficialActions(xml);
  assert.equal(actions.length, 3);
  assert.deepEqual(actions[1], {
    chamber: 'house',
    occurredOn: '2026-05-07',
    description: 'Bill was passed as amended',
    fields: {
      ACTION_BODY: 'House',
      ACTION_DATE: '05/07/2026',
      ACTION_DESCRIPTION: 'Bill was passed as amended',
    },
  });
});

test('source-chamber passage audit does not confuse second-chamber passage', () => {
  const result = auditRevisorSourceChamberPassage({ xml, identifier: 'HF4591' });
  assert.equal(result.sourceChamber, 'house');
  assert.equal(result.sourceChamberPassed, true);
  assert.equal(result.sourceChamberFailed, false);
  assert.equal(result.passageActions.length, 1);
  assert.equal(result.passageActions[0].description, 'Bill was passed as amended');
});

test('explicit failed final-passage language is classified separately', () => {
  const failed = `<BILL><ACTIONS><ACTION><BODY>Senate</BODY><DATE>2024-05-10</DATE><DESCRIPTION>Third reading failed</DESCRIPTION></ACTION></ACTIONS></BILL>`;
  const result = auditRevisorSourceChamberPassage({ xml: failed, identifier: 'SF99' });
  assert.equal(result.sourceChamberPassed, false);
  assert.equal(result.sourceChamberFailed, true);
});

test('status-page URLs are normalized to the official Bill Status API endpoint', () => {
  assert.equal(
    normalizeRevisorStatusXmlUrl('https://www.revisor.mn.gov/bills/94/2025/0/SF/856/'),
    'https://api.revisor.mn.gov/bills/v1/94/2025/0/SF/856/',
  );
  assert.equal(
    normalizeRevisorStatusXmlUrl('api.revisor.mn.gov/bills/v1/93/2023/0/HF/10/'),
    'https://api.revisor.mn.gov/bills/v1/93/2023/0/HF/10/',
  );
});

test('namespaced ACTION elements are parsed namespace-insensitively', () => {
  const namespaced = `<r:BILL xmlns:r="urn:mn"><r:ACTIONS><r:ACTION><r:ACTION_BODY>House</r:ACTION_BODY><r:ACTION_DATE>03/23/2021</r:ACTION_DATE><r:ACTION_DESCRIPTION>Bill was passed</r:ACTION_DESCRIPTION></r:ACTION></r:ACTIONS></r:BILL>`;
  const result = auditRevisorSourceChamberPassage({ xml: namespaced, identifier: 'HF1064' });
  assert.equal(result.actions.length, 1);
  assert.equal(result.sourceChamberPassed, true);
});
