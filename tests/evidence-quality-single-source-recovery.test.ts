import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORICAL_DENSITY_SINGLE_SOURCE_AVAILABLE_ON,
  HISTORICAL_DENSITY_SINGLE_SOURCE_ID,
  HISTORICAL_DENSITY_SINGLE_SOURCE_INVENTORY_SCHEMA,
  HISTORICAL_DENSITY_SINGLE_SOURCE_KIND,
  HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION,
  HISTORICAL_DENSITY_SINGLE_SOURCE_SHA256,
  HISTORICAL_DENSITY_SINGLE_SOURCE_URL,
  resolveHistoricalDensitySingleTarget,
  selectHistoricalDensitySingleSourceCandidate,
} from '../src/evidence/evidence-quality-single-source-recovery.js';

function inventory() {
  return {
    schemaVersion: HISTORICAL_DENSITY_SINGLE_SOURCE_INVENTORY_SCHEMA,
    targetUniverse: { rows: 135457, currentCoveredRows: 29 },
    recommendedTrainingOrdinaryCohort: {
      session: HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION,
      sources: 1,
      potentialNewRows: 1,
      rows: [{
        sourceDocumentId: HISTORICAL_DENSITY_SINGLE_SOURCE_ID,
        sourceKind: HISTORICAL_DENSITY_SINGLE_SOURCE_KIND,
        sourceUrl: HISTORICAL_DENSITY_SINGLE_SOURCE_URL,
        contentSha256: HISTORICAL_DENSITY_SINGLE_SOURCE_SHA256,
        availableOn: HISTORICAL_DENSITY_SINGLE_SOURCE_AVAILABLE_ON,
        sourceSession: HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION,
        sourceDocumentTextId: null,
        textReady: false,
        targetPairs: 1,
        potentialCoverageRows: 1,
        newCoverageRows: 1,
        newCoverageEvents: 1,
        newCoverageMemberships: 1,
        newCoverageBySession: { [HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION]: 1 },
        marginalRows: 1,
        cumulativeRows: 1,
      }],
    },
  };
}

test('selects only the exact frozen v1.4 ordinary 2021-22 candidate', () => {
  const selected = selectHistoricalDensitySingleSourceCandidate(inventory());
  assert.equal(selected.sourceDocumentId, HISTORICAL_DENSITY_SINGLE_SOURCE_ID);
  assert.equal(selected.textReady, false);

  const drifted = structuredClone(inventory());
  drifted.recommendedTrainingOrdinaryCohort.rows[0].contentSha256 = '0'.repeat(64);
  assert.throws(() => selectHistoricalDensitySingleSourceCandidate(drifted), /identity drifted/);
});

test('resolves exactly one strict pre-vote uncovered target from source evidence pairs', () => {
  const candidate = selectHistoricalDensitySingleSourceCandidate(inventory());
  const result = resolveHistoricalDensitySingleTarget({
    candidate,
    targets: [
      {
        voteEventId: 'vote-before',
        membershipId: 'member-1',
        session: '2021-2022',
        chamber: 'house',
        occurredOn: '2021-02-05',
        billId: 'bill-1',
        identifier: 'HF1',
      },
      {
        voteEventId: 'vote-after',
        membershipId: 'member-1',
        session: '2021-2022',
        chamber: 'house',
        occurredOn: '2021-03-01',
        billId: 'bill-1',
        identifier: 'HF1',
      },
      {
        voteEventId: 'already-covered',
        membershipId: 'member-2',
        session: '2021-2022',
        chamber: 'house',
        occurredOn: '2021-03-02',
        billId: 'bill-2',
        identifier: 'HF2',
      },
    ],
    contexts: [
      { evidenceId: 'e1', membershipId: 'member-1', billId: 'bill-1', excerpt: 'A sufficiently substantive frozen excerpt from the historical source that will later be checked exactly in an archive snapshot.' },
      { evidenceId: 'e2', membershipId: 'member-2', billId: 'bill-2', excerpt: 'Another sufficiently substantive frozen excerpt for a covered row.' },
    ],
    coveredRowKeys: new Set(['already-covered|member-2']),
  });

  assert.equal(result.target.voteEventId, 'vote-after');
  assert.deepEqual(result.evidenceIds, ['e1']);
  assert.equal(result.excerpts.length, 1);
});

test('fails closed when the source maps to zero or multiple uncovered targets', () => {
  const candidate = selectHistoricalDensitySingleSourceCandidate(inventory());
  const context = {
    evidenceId: 'e1',
    membershipId: 'member-1',
    billId: 'bill-1',
    excerpt: 'A sufficiently substantive frozen excerpt from the historical source for exact archive matching.',
  };
  assert.throws(() => resolveHistoricalDensitySingleTarget({
    candidate,
    targets: [],
    contexts: [context],
    coveredRowKeys: new Set(),
  }), /exactly one/);

  assert.throws(() => resolveHistoricalDensitySingleTarget({
    candidate,
    targets: [
      { voteEventId: 'v1', membershipId: 'member-1', session: '2021-2022', chamber: 'house', occurredOn: '2021-03-01', billId: 'bill-1', identifier: 'HF1' },
      { voteEventId: 'v2', membershipId: 'member-1', session: '2021-2022', chamber: 'house', occurredOn: '2021-03-02', billId: 'bill-1', identifier: 'HF1' },
    ],
    contexts: [context],
    coveredRowKeys: new Set(),
  }), /found 2/);
});
