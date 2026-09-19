import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVISOR_AUTHORSHIP_PARSER_VERSION,
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

const liveShapeXml = `<?xml version="1.0"?>
<BILL>
  <FILE_TYPE>HF</FILE_TYPE>
  <FILE_NUMBER>39</FILE_NUMBER>
  <AUTHORS>
    <HOUSE>
      <AUTHOR>
        <AUTHOR_KEY></AUTHOR_KEY>
        <LEGISLATOR_KEY>15459</LEGISLATOR_KEY>
        <MEMBER_NAME>Carlson</MEMBER_NAME>
      </AUTHOR>
      <AUTHOR>
        <AUTHOR_KEY></AUTHOR_KEY>
        <LEGISLATOR_KEY>15520</LEGISLATOR_KEY>
        <MEMBER_NAME>Xiong, T.</MEMBER_NAME>
      </AUTHOR>
      <AUTHOR>
        <AUTHOR_KEY></AUTHOR_KEY>
        <LEGISLATOR_KEY>12282</LEGISLATOR_KEY>
        <MEMBER_NAME>Hansen, R.</MEMBER_NAME>
      </AUTHOR>
    </HOUSE>
  </AUTHORS>
  <ACTIONS>
    <HOUSE>
      <ACTION>
        <ACTION_TEXT>Authors added</ACTION_TEXT>
        <ACTION_DATE>2021-01-19 00:00:00</ACTION_DATE>
        <ACTION_DESCRIPTION>Reyer and Olson, L.</ACTION_DESCRIPTION>
      </ACTION>
      <ACTION>
        <ACTION_TEXT>Authors added</ACTION_TEXT>
        <ACTION_DATE>2021-02-04 00:00:00</ACTION_DATE>
        <ACTION_DESCRIPTION>Hansen, R.; Klevorn; Lee; Sundin; Noor; Jordan; Feist, and Long</ACTION_DESCRIPTION>
      </ACTION>
      <ACTION>
        <ACTION_TEXT>Authors added</ACTION_TEXT>
        <ACTION_DATE>2021-02-08 00:00:00</ACTION_DATE>
        <ACTION_DESCRIPTION>Her, Frederick</ACTION_DESCRIPTION>
      </ACTION>
      <ACTION>
        <ACTION_TEXT>Authors added</ACTION_TEXT>
        <ACTION_DATE>2021-02-09 00:00:00</ACTION_DATE>
        <ACTION_DESCRIPTION>Feist, Lippert, and Keeler</ACTION_DESCRIPTION>
      </ACTION>
      <ACTION>
        <ACTION_TEXT>Author stricken</ACTION_TEXT>
        <ACTION_DATE>2021-02-10 00:00:00</ACTION_DATE>
        <ACTION_DESCRIPTION>Eichorn</ACTION_DESCRIPTION>
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

test('live Revisor v1 payload shape uses MEMBER_NAME and split action text/detail fields', () => {
  assert.equal(REVISOR_AUTHORSHIP_PARSER_VERSION, 'revisor-authorship-v2');
  assert.deepEqual(parseRevisorCurrentAuthors({ xml: liveShapeXml, identifier: 'HF39' }), [
    { chamber: 'house', name: 'Carlson' },
    { chamber: 'house', name: 'Xiong, T.' },
    { chamber: 'house', name: 'Hansen, R.' },
  ]);

  assert.deepEqual(parseRevisorAuthorActions(liveShapeXml).map((row) => ({
    date: row.occurredOn,
    operation: row.operation,
    names: row.names,
    description: row.description,
  })), [
    {
      date: '2021-01-19',
      operation: 'add',
      names: ['Reyer', 'Olson, L'],
      description: 'Authors added Reyer and Olson, L.',
    },
    {
      date: '2021-02-04',
      operation: 'add',
      names: ['Hansen, R', 'Klevorn', 'Lee', 'Sundin', 'Noor', 'Jordan', 'Feist', 'Long'],
      description: 'Authors added Hansen, R.; Klevorn; Lee; Sundin; Noor; Jordan; Feist, and Long',
    },
    {
      date: '2021-02-08',
      operation: 'add',
      names: ['Her', 'Frederick'],
      description: 'Authors added Her, Frederick',
    },
    {
      date: '2021-02-09',
      operation: 'add',
      names: ['Feist', 'Lippert', 'Keeler'],
      description: 'Authors added Feist, Lippert, and Keeler',
    },
    {
      date: '2021-02-10',
      operation: 'strike',
      names: ['Eichorn'],
      description: 'Author stricken Eichorn',
    },
  ]);
});

test('plural comma lists split while comma-initial names stay intact', () => {
  assert.deepEqual(splitRevisorAuthorNames('Her, Frederick', { plural: true }), ['Her', 'Frederick']);
  assert.deepEqual(
    splitRevisorAuthorNames('Feist, Lippert, and Keeler', { plural: true }),
    ['Feist', 'Lippert', 'Keeler'],
  );
  assert.deepEqual(
    splitRevisorAuthorNames('Hansen, R.; Klevorn; Feist, and Long', { plural: true }),
    ['Hansen, R', 'Klevorn', 'Feist', 'Long'],
  );
  assert.deepEqual(splitRevisorAuthorNames('Xiong, J.', { plural: true }), ['Xiong, J']);
});

test('authorship can be reconstructed strictly before a forecast date from current state plus dated actions', () => {
  const record = parseRevisorAuthorship({ xml, identifier: 'HF1001' });
  const asOf = revisorAuthorNamesAsOf({
    currentAuthors: record.currentAuthors.map((row) => row.name),
    actions: record.actions,
    asOfDateExclusive: '2025-02-26',
  });
  assert.deepEqual(asOf, ['Anderson, P. H.', 'Nelson', 'Rehrauer', 'Virnig', 'Youakim']);
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
