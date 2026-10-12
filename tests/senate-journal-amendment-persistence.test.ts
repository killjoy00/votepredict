import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';

test('Senate ingester SQL preserves the parser amendment identity without changing roll-call keys', () => {
  // Non-executing contract test: no DB connection, source replay, or accepted
  // roll-call rewrite. An ingester change must retain this mapping.
  const script = readFileSync(new URL('../scripts/ingest-senate-history.ts', import.meta.url), 'utf8');
  assert.match(script, /motion_text,amendment_ref,\s*occurred_on/);
  assert.match(script, /amendment_ref=EXCLUDED\.amendment_ref/);
  assert.match(script, /event\.motionText,\s*event\.amendmentRef\s*\?\?\s*null,\s*event\.occurredOn/);
  assert.match(script, /ON CONFLICT \(session_id,chamber_id,external_key\)/);
  assert.match(script, /DELETE FROM member_votes WHERE vote_event_id/);
});

test('parsed amendment motion has distinct stable event identity and source-specific A-7 reference', () => {
  const journal = [
    'SPECIAL ORDERS',
    'H.F. No. 2563 was reported to the Senate.',
    'Senator Drazkowski moved to amend H.F. No. 2563 as follows (A-7):',
    'The question was taken on the adoption of the amendment.',
    'The roll was called, and there were yeas 1 and nays 1, as follows:',
    'Those who voted in the affirmative were:',
    'Abeler',
    'Those who voted in the negative were:',
    'Carlson',
    'The motion did not prevail. So the amendment was not adopted.',
    'H.F. No. 2563 was read the third time and placed on its final passage.',
    'The question was taken on the passage of the bill.',
    'The roll was called, and there were yeas 2 and nays 0, as follows:',
    'Those who voted in the affirmative were:',
    'Abeler',
    'Carlson',
    'So the bill passed and its title was agreed to.',
  ].join('\n');
  const events = parseSenateJournalText({
    text: journal, sessionKey: '303', occurredOn: '2025-04-30',
    sourceUrl: 'https://www.senate.mn/journals/2025-2026/20250430073.pdf',
    knownMemberNames: ['Abeler', 'Carlson'],
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].voteKind, 'amendment');
  assert.equal(events[0].amendmentRef, 'A-7');
  assert.equal(events[0].isPassage, false);
  assert.match(events[0].externalKey, /:senate:roll:/);
  assert.equal(events[1].voteKind, 'passage');
  assert.equal(events[1].externalKey, '303:HF2563:2025-04-30:senate:1');
});
