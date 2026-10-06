import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_ATTACHMENT_ARCHIVE_RETRY_EXPECTED,
  selectHouseAttachmentArchiveAmbiguousRetryRows,
  type HouseAttachmentArchiveProbePriorReport,
} from '../src/evidence/house-attachment-historical-density-archive-retry.js';

function report(): HouseAttachmentArchiveProbePriorReport {
  const noCapture = Array.from({ length: 22 }, (_, index) => ({
    attachmentUrl: 'https://www.house.mn.gov/comm/docs/no-' + index + '.pdf',
    attachmentNames: ['No capture ' + index],
    attachmentKinds: ['testimony_handout'],
    billIds: ['bill-' + index],
    billIdentifiers: ['HF' + (2000 + index)],
    firstOfficialPostedOn: '2021-02-01',
    lastOfficialPostedOn: '2021-02-01',
    firstTargetVoteOn: '2021-03-01',
    lastTargetVoteOn: '2021-04-01',
    potentialRows: 100,
    classification: 'no_archive_pdf_capture',
    discoveryError: null,
    captureCount: 0,
    eligibleCaptureCount: 0,
  }));
  const ambiguous = HOUSE_ATTACHMENT_ARCHIVE_RETRY_EXPECTED.map((expected, index) => ({
    attachmentUrl: expected.attachmentUrl,
    attachmentNames: [expected.billIdentifier + ' testimony.pdf'],
    attachmentKinds: ['testimony_handout'],
    billIds: ['retry-bill-' + index],
    billIdentifiers: [expected.billIdentifier],
    firstOfficialPostedOn: '2021-02-01',
    lastOfficialPostedOn: '2021-02-01',
    firstTargetVoteOn: '2021-03-01',
    lastTargetVoteOn: '2021-04-01',
    potentialRows: expected.potentialRows,
    classification: 'ambiguous_discovery_failure',
    discoveryError: index === 0 ? 'TimeoutError: operation timed out' : 'TypeError: fetch failed',
    captureCount: 0,
    eligibleCaptureCount: 0,
  }));
  return {
    schemaVersion: 'historical-density-house-attachment-archive-probe-v1',
    selectorLineage: {
      runId: 37390453287,
      artifactId: 11381216160,
      artifactDigest: 'sha256:e6f795c501db56ec9e009ee14afad54e172604d052914eafbe50778d3f6cec20',
      candidateInputSha256: '7b643fc6cf11648163609a07b1619c1984597f70063b0acfe9ae01dc451217fe',
      pilotSize: 24,
      potentialRows: 5628,
    },
    currentMatrix: {
      artifactId: 11380755983,
      artifactDigest: 'sha256:fe2254fc9d2ed0ea00712feab384958e4942cf387e442c29515b3a75183692d7',
      exactBillCoveredRows: 38,
      trainingExactBillCoveredRows: 3,
      frozenPilotRowsAlreadyCovered: 0,
    },
    summary: {
      probedPdfs: 24,
      classificationCounts: {
        ambiguous_discovery_failure: 2,
        no_archive_pdf_capture: 22,
      },
      verifiedPdfs: 0,
      verifiedBills: 0,
      verifiedPotentialRows: 0,
      verifiedEvents: 0,
      verifiedMemberships: 0,
    },
    rows: [...noCapture, ...ambiguous],
  };
}

test('selects only the two exact transient discovery failures', () => {
  const selected = selectHouseAttachmentArchiveAmbiguousRetryRows(report());
  assert.equal(selected.length, 2);
  assert.deepEqual(
    selected.map((row) => row.billIdentifiers[0]).sort(),
    ['HF109', 'HF1952'],
  );
  assert.equal(selected.reduce((sum, row) => sum + row.potentialRows, 0), 268);
});

test('fails closed on changed classification counts or retry identity', () => {
  const countDrift = report();
  countDrift.summary.classificationCounts.no_archive_pdf_capture = 21;
  assert.throws(
    () => selectHouseAttachmentArchiveAmbiguousRetryRows(countDrift),
    /result contract drifted/,
  );

  const identityDrift = report();
  identityDrift.rows.find((row) => row.billIdentifiers[0] === 'HF109')!.attachmentUrl =
    'https://www.house.mn.gov/comm/docs/other.pdf';
  assert.throws(
    () => selectHouseAttachmentArchiveAmbiguousRetryRows(identityDrift),
    /identity\/reason drifted/,
  );
});

test('fails closed when the prior ambiguity is no longer a transient discovery error', () => {
  const drift = report();
  drift.rows.find((row) => row.billIdentifiers[0] === 'HF1952')!.discoveryError =
    'Wayback returned a permanent malformed response';
  assert.throws(
    () => selectHouseAttachmentArchiveAmbiguousRetryRows(drift),
    /identity\/reason drifted/,
  );
});
