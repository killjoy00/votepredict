import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRevisorProcessActions, parseRevisorProcessEvents } from '../src/sources/minnesota/revisor-process.js';

const xml = `<?xml version="1.0"?>
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>42</FILE_NUMBER>
  <COMPANION_TYPE>SF</COMPANION_TYPE>
  <COMPANION_NUMBER>999</COMPANION_NUMBER>
  <AUTHORS><AUTHOR><NAME>Current Author</NAME></AUTHOR></AUTHORS>
  <ACTIONS>
    <HOUSE>
      <ACTION>
        <ACTION_DATE>2023-02-01 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Introduction and first reading, referred to Transportation Finance and Policy</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2023-03-01 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Committee report, to adopt as amended and re-refer to Ways and Means</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2023-03-09 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Second reading</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2023-03-20 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Placed on the Calendar for the Day</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2023-03-21 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Authors added Smith and Jones</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2023-03-22 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Referred to Rules and Administration for comparison with SF3857</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_TEXT>Committee report with no date</ACTION_TEXT>
      </ACTION>
    </HOUSE>
    <SENATE>
      <ACTION>
        <ACTION_DATE>2023-04-05 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Received from the House</ACTION_TEXT>
      </ACTION>
    </SENATE>
  </ACTIONS>
</BILL>`;

test('dated Revisor actions are classified into process-history signals', () => {
  const events = parseRevisorProcessEvents({ xml, identifier: 'HF42' });
  const kinds = events.map((event) => `${event.occurredOn}:${event.chamber}:${event.stageKind}`);

  assert.ok(kinds.includes('2023-02-01:house:committee_referral'));
  assert.ok(kinds.includes('2023-03-01:house:committee_report'));
  assert.ok(kinds.includes('2023-03-01:house:committee_referral'));
  assert.ok(kinds.includes('2023-03-01:house:amendment_activity'));
  assert.ok(kinds.includes('2023-03-09:house:second_reading'));
  assert.ok(kinds.includes('2023-03-20:house:floor_scheduled'));
  assert.ok(kinds.includes('2023-03-21:house:author_added'));
  assert.ok(kinds.includes('2023-03-22:house:rules_referral'));
  assert.ok(kinds.includes('2023-03-22:house:companion_reference'));
  assert.ok(kinds.includes('2023-04-05:senate:cross_chamber_received'));

  const companion = events.find((event) => event.stageKind === 'companion_reference');
  assert.deepEqual(companion?.companionIdentifiers, ['SF3857']);
});

test('undated current author and companion state never become model process events', () => {
  const events = parseRevisorProcessEvents({ xml, identifier: 'HF42' });
  assert.equal(events.some((event) => event.description.includes('Current Author')), false);
  assert.equal(events.some((event) => event.companionIdentifiers.includes('SF999')), false);
  assert.equal(events.some((event) => event.description === 'Committee report with no date'), false);
});

test('an explicitly dated substitute reference can prove historical companion context', () => {
  const substitute = `<BILL><ACTIONS><SENATE><ACTION><ACTION_DATE>2024-04-01</ACTION_DATE><ACTION_TEXT>Substituted HF123 for SF77</ACTION_TEXT></ACTION></SENATE></ACTIONS></BILL>`;
  const events = parseRevisorProcessEvents({ xml: substitute, identifier: 'SF77' });
  const companion = events.find((event) => event.stageKind === 'companion_reference');
  assert.deepEqual(companion?.companionIdentifiers, ['HF123']);
});


test('process action audit separates known boundaries from genuinely unclassified dated actions', () => {
  const auditXml = `<BILL>
    <ACTIONS>
      <HOUSE>
        <ACTION><ACTION_DATE>2023-01-10</ACTION_DATE><ACTION_TEXT>Introduction and first reading, referred to Judiciary</ACTION_TEXT></ACTION>
        <ACTION><ACTION_DATE>2023-02-10</ACTION_DATE><ACTION_TEXT>Committee report, to adopt as amended</ACTION_TEXT></ACTION>
        <ACTION><ACTION_DATE>2023-03-10</ACTION_DATE><ACTION_TEXT>Bill was passed as amended</ACTION_TEXT></ACTION>
        <ACTION><ACTION_DATE>2023-03-11</ACTION_DATE><ACTION_TEXT>Administrative status notation</ACTION_TEXT></ACTION>
        <ACTION><ACTION_TEXT>Undated current status note</ACTION_TEXT></ACTION>
      </HOUSE>
    </ACTIONS>
  </BILL>`;

  const audit = auditRevisorProcessActions({ xml: auditXml, identifier: 'HF42' });

  assert.equal(audit.officialActions, 5);
  assert.equal(audit.datedOfficialActions, 4);
  assert.equal(audit.undatedOfficialActions, 1);
  assert.equal(audit.processClassifiedDatedActions, 3);
  assert.equal(audit.introductionActions, 1);
  assert.equal(audit.sourceChamberPassageActions, 1);
  assert.equal(audit.sourceChamberFailedPassageActions, 0);
  assert.equal(audit.sourceChamberPassed, true);
  assert.equal(audit.sourceChamberPassageOn, '2023-03-10');
  assert.equal(audit.otherUnclassifiedDatedActions, 1);
  assert.deepEqual(audit.otherUnclassifiedDatedActionDescriptions, ['Administrative status notation']);
});

test('failed source-chamber passage is retained as a terminal audit fact without becoming a positive passage', () => {
  const auditXml = `<BILL><ACTIONS><SENATE>
    <ACTION><ACTION_DATE>2024-05-01</ACTION_DATE><ACTION_TEXT>Third reading failed</ACTION_TEXT></ACTION>
  </SENATE></ACTIONS></BILL>`;
  const audit = auditRevisorProcessActions({ xml: auditXml, identifier: 'SF77' });

  assert.equal(audit.sourceChamberPassed, false);
  assert.equal(audit.sourceChamberFailed, true);
  assert.equal(audit.sourceChamberFailedPassageActions, 1);
  assert.equal(audit.sourceChamberFailureOn, '2024-05-01');
  assert.equal(audit.otherUnclassifiedDatedActions, 0);
});
