import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareQuickEvidenceToManual,
  mergeQuickEvidenceManualAnnotationsBySource,
} from '../src/evidence/quick-evidence-v3-manual-reference.js';

test('manual reference aggregation preserves claims from every reviewed annotation for a source', () => {
  const merged = mergeQuickEvidenceManualAnnotationsBySource([
    {
      sourceDocumentId: 'source-1',
      annotation: {
        claims: [{
          memberNames: ['Example Member'],
          billIdentifiers: ['HF28'],
          stance: 'supports',
        }],
      },
    },
    {
      sourceDocumentId: 'source-1',
      annotation: {
        claims: [{
          memberNames: ['Example Member'],
          billIdentifiers: ['HF3'],
          stance: 'supports',
        }],
      },
    },
  ]);

  assert.equal(compareQuickEvidenceToManual(
    merged.get('source-1'),
    'Example Member',
    'HF28',
    'supports',
  ), 'agree');
  assert.equal(compareQuickEvidenceToManual(
    merged.get('source-1'),
    'Example Member',
    'HF3',
    'supports',
  ), 'agree');
});

test('manual reference aggregation is classification-order invariant', () => {
  const rows = [
    {
      sourceDocumentId: 'source-1',
      annotation: {
        claims: [{
          memberNames: ['Example Member'],
          billIdentifiers: ['SF10'],
          stance: 'opposes',
        }],
      },
    },
    {
      sourceDocumentId: 'source-1',
      annotation: {
        claims: [{
          memberNames: ['Example Member'],
          billIdentifiers: ['SF10'],
          stance: 'supports',
        }],
      },
    },
  ];

  for (const candidate of [rows, [...rows].reverse()]) {
    const merged = mergeQuickEvidenceManualAnnotationsBySource(candidate);
    assert.equal(compareQuickEvidenceToManual(
      merged.get('source-1'),
      'Example Member',
      'SF10',
      'supports',
    ), 'agree');
    assert.equal(compareQuickEvidenceToManual(
      merged.get('source-1'),
      'Example Member',
      'SF10',
      'opposes',
    ), 'agree');
  }
});
