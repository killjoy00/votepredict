import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHouseJournalOutcomes } from '../src/sources/minnesota/house-outcomes.js';
const vote = (outcome:string, question='passage of the bill') => `<p>H. F. No. 123, A bill for an act relating to taxes.</p><p>The question was taken on the ${question} and the roll was called. There were 65 yeas and 60 nays as follows:</p><p>Those who voted in the affirmative were: A B C</p><p>${outcome}</p>`;
test('House recovery requires explicit journal result, not majority of votes cast', () => {
  assert.equal(parseHouseJournalOutcomes(vote('The bill was not passed.'))[0].passed,false);
  assert.equal(parseHouseJournalOutcomes(vote('The bill was passed and its title agreed to.'))[0].passed,true);
  assert.equal(parseHouseJournalOutcomes(vote('The bill did not pass.'))[0].passed,false);
  assert.equal(parseHouseJournalOutcomes(vote('')).length,0);
  assert.equal(parseHouseJournalOutcomes(vote('The bill was passed.','Smith motion')).length,0);
});
test('House recovery cannot borrow an outcome from the next bill', () => {
  assert.equal(parseHouseJournalOutcomes(vote('')+vote('The bill was passed.').replace('123','124')).length,1);
  assert.equal(parseHouseJournalOutcomes(vote('')+vote('The bill was passed.').replace('123','124'))[0].identifier,'HF124');
});


test('House recovery accepts singular yea/nay grammar in explicit journal rolls', () => {
  const html = '<p>H. F. No. 944, A bill for an act relating to natural resources.</p>'
    + '<p>The question was taken on the passage of the bill and the roll was called. There were 131 yeas and 1 nay as follows:</p>'
    + '<p>Those who voted in the affirmative were: A B C</p>'
    + '<p>The bill was passed and its title agreed to.</p>';
  const outcomes = parseHouseJournalOutcomes(html);
  assert.equal(outcomes.length, 1);
  assert.deepEqual(outcomes[0], {
    identifier: 'HF944',
    yeaCount: 131,
    nayCount: 1,
    passed: true,
    resultText: 'The bill was passed and its title agreed to.',
    journalPage: undefined,
  });
});

test('House recovery recognizes memorial resolutions only with explicit result text', () => {
  const html = '<p>H. F. No. 475, A memorial resolution requesting congressional action.</p>'
    + '<p>The question was taken on the passage of the bill and the roll was called. There were 85 yeas and 44 nays as follows:</p>'
    + '<p>Those who voted in the affirmative were: A B C</p>'
    + '<p>The bill was passed and its title agreed to.</p>';
  const outcomes = parseHouseJournalOutcomes(html);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].identifier, 'HF475');
  assert.equal(outcomes[0].yeaCount, 85);
  assert.equal(outcomes[0].nayCount, 44);
  assert.equal(outcomes[0].passed, true);
});
