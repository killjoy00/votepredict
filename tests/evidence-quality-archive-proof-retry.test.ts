import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeArchiveProofRetry,
  type ArchiveProofReport,
} from '../src/evidence/evidence-quality-archive-proof-retry.js';

function report(classifications: string[]): ArchiveProofReport {
  return {
    schemaVersion: 'evidence-quality-pre-vote-archive-proof-v1',
    sources: [{
      sourceDocumentId: 'source-1',
      sourceKind: 'house_session_daily',
      sourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/1',
      sourceContentSha256: 'a'.repeat(64),
      sessions: ['2023-2024'],
      potentialNewRows: classifications.length,
      classification: 'ambiguous_snapshot',
      targets: classifications.map((classification, index) => ({
        rowKey: 'row-' + index,
        classification: classification as never,
        marker: classification + '-' + index,
      })),
    }],
  };
}

test('retry replaces only first-run ambiguous targets', () => {
  const first = report([
    'verified_pre_vote_archive_match',
    'archive_only_after_vote',
    'archive_exists_but_excerpt_not_found',
    'ambiguous_snapshot',
    'ambiguous_snapshot',
  ]);
  const retry = report([
    'ambiguous_snapshot',
    'ambiguous_snapshot',
    'ambiguous_snapshot',
    'verified_pre_vote_archive_match',
    'archive_only_after_vote',
  ]);

  const merged = mergeArchiveProofRetry(first, retry);
  assert.deepEqual(
    merged.sources[0].targets.map((target) => target.classification),
    [
      'verified_pre_vote_archive_match',
      'archive_only_after_vote',
      'archive_exists_but_excerpt_not_found',
      'verified_pre_vote_archive_match',
      'archive_only_after_vote',
    ],
  );
  assert.deepEqual(
    merged.sources[0].targets.map((target) => target.canonicalSourceRun),
    ['first', 'first', 'first', 'retry', 'retry'],
  );
  assert.equal(merged.sources[0].targets[0].retryRunClassification, 'ambiguous_snapshot');
  assert.equal(merged.sources[0].targets[3].firstRunClassification, 'ambiguous_snapshot');
  assert.deepEqual(merged.transitionsFromFirstAmbiguous, {
    archive_only_after_vote: 1,
    verified_pre_vote_archive_match: 1,
  });
});

test('retry merge fails when target identity drifts', () => {
  const first = report(['ambiguous_snapshot']);
  const retry: ArchiveProofReport = {
    ...report(['verified_pre_vote_archive_match']),
    sources: [{
      sourceDocumentId: 'source-1',
      sourceKind: 'house_session_daily',
      sourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/1',
      sourceContentSha256: 'a'.repeat(64),
      sessions: ['2023-2024'],
      potentialNewRows: 1,
      classification: 'verified_pre_vote_archive_match',
      targets: [{ rowKey: 'different-row', classification: 'verified_pre_vote_archive_match' }],
    }],
  };
  assert.throws(
    () => mergeArchiveProofRetry(first, retry),
    /missing from retry/,
  );
});

test('retry merge retains ambiguity when retry is still ambiguous', () => {
  const first = report(['ambiguous_snapshot']);
  const retry = report(['ambiguous_snapshot']);
  const merged = mergeArchiveProofRetry(first, retry);
  assert.equal(merged.sources[0].targets[0].classification, 'ambiguous_snapshot');
  assert.equal(merged.sources[0].targets[0].canonicalSourceRun, 'retry');
  assert.deepEqual(merged.transitionsFromFirstAmbiguous, { ambiguous_snapshot: 1 });
});
