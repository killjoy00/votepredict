import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEvidenceQualitySnapshotSourceIds } from '../src/evidence/evidence-quality-snapshot-selection.js';

test('parses and deduplicates UUIDs from issue-comment text', () => {
  assert.deepEqual(
    parseEvidenceQualitySnapshotSourceIds(
      '[evidence-quality-snapshot-source] 42ed87aa-f850-4d2b-bebc-2b4c25f14b7c\n'
      + 'again 42ED87AA-F850-4D2B-BEBC-2B4C25F14B7C '
      + 'and 11111111-2222-4333-8444-555555555555',
    ),
    [
      '11111111-2222-4333-8444-555555555555',
      '42ed87aa-f850-4d2b-bebc-2b4c25f14b7c',
    ],
  );
});

test('ignores non-UUID text and invalid UUID variants', () => {
  assert.deepEqual(parseEvidenceQualitySnapshotSourceIds('[evidence-quality-snapshot-source] no ids'), []);
  assert.deepEqual(
    parseEvidenceQualitySnapshotSourceIds('42ed87aa-f850-0d2b-bebc-2b4c25f14b7c'),
    [],
  );
});
