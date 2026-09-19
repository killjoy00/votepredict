import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRevisorAuthorship,
  parseRevisorAuthorActions,
  parseRevisorCurrentAuthors,
  revisorAuthorNamesAsOf,
  splitRevisorAuthorNames,
} from '../src/sources/minnesota/revisor-authorship.js';

const xml = `<?xml version="1.0"?>
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>1001</FILE_NUMBER>
  <AUTHORS>
    <HOUSE>
      <AUTHOR><AUTHOR_NAME>Virnig</AUTHOR_NAME></AUTHOR>
      <AUTHOR><AUTHOR_NAME>Anderson, P. H.</AUTHOR_NAME></AUTHOR>
      <AUTHOR><AUTHOR_NAME>Nelson</AUTHOR_NAME></AUTHOR>
      <AUTHOR><AUTHOR_NAME>Rehrauer</AUTHOR_NAME></AUTHOR>
      <AUTHOR><AUTHOR_NAME>Youakim</AUTHOR_NAME></AUTHOR>
      <AUTHOR><AUTHOR_NAME>Anderson, P. E.</AUTHOR_NAME></AUTHOR>
      <AUTHOR><AUTHOR_NAME>Gander</AUTHOR_NAME></AUTHOR>
    </HOUSE>
  </AUTHORS>
  <ACTIONS>
    <HOUSE>
      <ACTION>
        <ACTION_DATE>2025-02-17 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Introduction and first reading, referred to Education Finance</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2025-02-20 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Author added Youakim</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2025-02-26 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Authors added Anderson, P. E.; and Gander</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2025-03-01 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Author added Hanson, J. as Chief Author</ACTION_TEXT>
      </ACTION>
      <ACTION>
        <ACTION_DATE>2025-03-02 00:00:00</ACTION_DATE>
        <ACTION_TEXT>Author stricken Nelson</ACTION_TEXT>
      </ACTION>
    </HOUSE>
  </ACTIONS>
</BILL>`;

test('current Revisor authors preserve chamber and display names', () => {
  assert.deepEqual(parseRevisorCurrentAuthors({ xml, identifier: 'HF1001' }), [
    { chamber: 'house', name: 'Virnig' },
    { chamber: 'house', name: 'Anderson, P. H.' },
    { chamber: 'house', name: 'Nelson' },
    { chamber: 'house', name: 'Rehrauer' },
    { chamber: 'house', name: 'Youakim' },
    { chamber: 'house', name: 'Anderson, P. E.' },
    { chamber: 'house', name: 'Gander' },
  ]);
});

test('dated author additions and strikes are parsed without splitting comma initials', () => {
  assert.deepEqual(splitRevisorAuthorNames('Anderson, P. E.; and Gander'), ['Anderson, P. E', 'Gander']);
  const actions = parseRevisorAuthorActions(xml);
  assert.deepEqual(actions.map((row) => ({
    date: row.occurredOn,
    operation: row.operation,
    names: row.names,
    chief: row.chiefAuthor,
  })), [
    { date: '2025-02-20', operation: 'add', names: ['Youakim'], chief: false },
    { date: '2025-02-26', operation: 'add', names: ['Anderson, P. E', 'Gander'], chief: false },
    { date: '2025-03-01', operation: 'add', names: ['Hanson, J'], chief: true },
    { date: '2025-03-02', operation: 'strike', names: ['Nelson'], chief: false },
  ]);
});

test('authorship can be reconstructed strictly before a forecast date from current state plus dated actions', () => {
  const record = parseRevisorAuthorship({ xml, identifier: 'HF1001' });
  const asOf = revisorAuthorNamesAsOf({
    currentAuthors: record.currentAuthors.map((row) => row.name),
    actions: record.actions,
    asOfDateExclusive: '2025-02-26',
  });
  assert.deepEqual(asOf, ['Anderson, P. H.', 'Nelson', 'Rehrauer', 'Virnig']);
});

test('same-day additions are excluded under date-only historical timing', () => {
  const asOf = revisorAuthorNamesAsOf({
    currentAuthors: ['Alpha', 'Beta'],
    actions: [{ occurredOn: '2025-03-10', operation: 'add', names: ['Beta'] }],
    asOfDateExclusive: '2025-03-10',
  });
  assert.deepEqual(asOf, ['Alpha']);
});

test('stricken authors are restored when reconstructing a date before the strike', () => {
  const asOf = revisorAuthorNamesAsOf({
    currentAuthors: ['Alpha'],
    actions: [{ occurredOn: '2025-03-10', operation: 'strike', names: ['Beta'] }],
    asOfDateExclusive: '2025-03-10',
  });
  assert.deepEqual(asOf, ['Alpha', 'Beta']);
});
