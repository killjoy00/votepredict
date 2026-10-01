import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLifecycleP8FeatureSnapshot,
  lifecycleP8CaptureContentSha256,
} from '../src/evaluation/lifecycle-p8-capture.js';

const base = {
  billId: 'bill-1',
  sessionId: 'session-1',
  sessionSlug: '2027-2028' as const,
  chamber: 'house' as const,
  identifier: 'HF1',
  title: 'Example',
  introducedOn: '2027-01-05',
  adjournmentOn: '2028-12-31',
  introductionParserVersion: 'revisor-introduction-v1',
  processParserVersion: 'revisor-process-v2',
  processAuditVersion: 'revisor-process-audit-v1',
  processStatus: 'parsed',
  authorship: null,
  evidence: [],
};

test('P8 daily capture excludes same-day process events and bill versions', () => {
  const snapshot = buildLifecycleP8FeatureSnapshot({
    ...base,
    events: [
      {
        eventKey: 'prior',
        occurredOn: '2027-01-06',
        chamber: 'house',
        stageKind: 'committee_referral',
        outcome: null,
        sourceUrl: 'https://example.test/prior',
        sourceDocumentId: 'doc-prior',
        sourceContentSha256: 'sha-prior',
        parserVersion: 'revisor-process-v2',
        companionIdentifiers: [],
      },
      {
        eventKey: 'same-day',
        occurredOn: '2027-01-07',
        chamber: 'house',
        stageKind: 'second_reading',
        outcome: null,
        sourceUrl: 'https://example.test/same',
        sourceDocumentId: 'doc-same',
        sourceContentSha256: 'sha-same',
        parserVersion: 'revisor-process-v2',
        companionIdentifiers: [],
      },
    ],
    versions: [
      { id: 'v1', versionKey: '0', publishedOn: '2027-01-06', textHash: 'a', textLengthChars: 1000 },
      { id: 'v2', versionKey: '1', publishedOn: '2027-01-07', textHash: 'b', textLengthChars: 2000 },
    ],
  }, '2027-01-07');
  assert.equal(snapshot.features.lifecycleState, 'committee_process_engagement');
  assert.equal(snapshot.features.priorProcessEventCount, 1);
  assert.equal(snapshot.features.latestEligibleBillVersion?.billVersionId, 'v1');
  assert.deepEqual(snapshot.lineage.priorProcessSourceDocumentSha256, ['sha-prior']);
});

test('P8 content hash is deterministic and changes with captured content', () => {
  const left = lifecycleP8CaptureContentSha256({ a: 1, b: ['x'] });
  const right = lifecycleP8CaptureContentSha256({ a: 1, b: ['x'] });
  const changed = lifecycleP8CaptureContentSha256({ a: 2, b: ['x'] });
  assert.equal(left, right);
  assert.notEqual(left, changed);
});
