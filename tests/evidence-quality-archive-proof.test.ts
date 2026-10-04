import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveCapturePredatesVote,
  archiveProofExcerptFingerprint,
  archiveTextContainsFrozenExcerpt,
  normalizeArchiveProofText,
  strictVoteDateCutoff,
} from '../src/evidence/evidence-quality-archive-proof.js';

test('archive proof normalization preserves substantive text while ignoring typography', () => {
  const excerpt = 'Rep. Jane Doe said, “I support HF 123 — strongly.” The proposal expands access for working families.';
  const snapshot = 'REP. JANE DOE said: "I support HF 123 - strongly."  The proposal expands access for working families.';
  assert.equal(archiveTextContainsFrozenExcerpt(snapshot, excerpt), true);
  assert.equal(
    archiveProofExcerptFingerprint(excerpt),
    archiveProofExcerptFingerprint(snapshot),
  );
});

test('archive proof matching rejects short incidental fragments', () => {
  assert.equal(archiveTextContainsFrozenExcerpt('HF 123 is here.', 'HF 123'), false);
});

test('archive proof matching requires the full normalized frozen excerpt', () => {
  const excerpt = 'Representative Jane Doe said the bill would expand access for working families and lower costs across the state.';
  const snapshot = 'Representative Jane Doe discussed the bill and lower costs, but the exact frozen statement is not present.';
  assert.equal(archiveTextContainsFrozenExcerpt(snapshot, excerpt), false);
});

test('strict vote cutoff excludes captures on the vote date', () => {
  assert.equal(strictVoteDateCutoff('2024-05-10'), '2024-05-10T00:00:00.000Z');
  assert.equal(archiveCapturePredatesVote('2024-05-09T23:59:59.000Z', '2024-05-10'), true);
  assert.equal(archiveCapturePredatesVote('2024-05-10T00:00:00.000Z', '2024-05-10'), false);
  assert.equal(archiveCapturePredatesVote('2024-05-10T12:00:00.000Z', '2024-05-10'), false);
});

test('normalization is deterministic across whitespace and punctuation', () => {
  assert.equal(
    normalizeArchiveProofText('  Alpha\n beta—gamma.  '),
    'alpha beta gamma',
  );
});
