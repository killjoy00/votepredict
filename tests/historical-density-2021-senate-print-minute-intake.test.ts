import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSenatePrintMinuteIntakeBundle,
  collectSenatePrintMinuteIntakeDocument,
  senatePrintMinuteCandidateTargets,
  type SenatePrintMinuteRequestPackage,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

function fixture(): SenatePrintMinuteRequestPackage {
  const targets = Array.from({ length: 85 }, (_, index) => {
    const rank = Math.min(Math.floor(index / 9) + 1, 10);
    return {
      rank,
      committeeEventId: `committee-${rank}`,
      committeeName: `Committee ${rank}`,
      voteEventId: `vote-${index % 62}`,
      billId: `bill-${index % 57}`,
      identifier: `SF${(index % 57) + 1}`,
      targetVoteDate: '2021-05-20',
      uncoveredRows: 67,
      referralDates: ['2021-02-01'],
      requestWindowStart: '2021-02-01',
      requestWindowEndExclusive: '2021-05-20',
    };
  });
  const groups = Array.from({ length: 10 }, (_, index) => {
    const rank = index + 1;
    const groupTargets = targets.filter((target) => target.rank === rank);
    return {
      rank,
      committeeEventId: `committee-${rank}`,
      committeeName: `Committee ${rank}`,
      recordingPages: rank === 10 ? 28 : 20,
      requestAssociations: groupTargets.length,
      uniqueRequestBills: new Set(groupTargets.map((target) => target.billId)).size,
      targets: groupTargets,
    };
  });
  return {
    schemaVersion: 'historical-density-2021-senate-print-minute-request-package-v1',
    issue: 718,
    request: {
      committees: 10,
      targetAssociations: 85,
      uniqueTargetEvents: 62,
      uniqueTargetBills: 57,
      selectedCommitteeRecordingPages: 208,
      selectedUncoveredRows: 4154,
      requestAssociationProofSha256: 'a'.repeat(64),
      groups,
    },
    interpretation: {
      acquisitionOnly: true,
      requestDoesNotAssertMinuteExists: true,
      returnedMinuteDoesNotAutomaticallyBecomeEvidence: true,
    },
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      memberStanceInferred: false,
      referralTreatedAsEvidence: false,
      mediaPresenceTreatedAsEvidence: false,
      printMinuteContentAcquired: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      vercelUsed: false,
    },
  };
}

function document(bytes = Buffer.from('%PDF fixture')) {
  return collectSenatePrintMinuteIntakeDocument({
    request: fixture(),
    committeeEventId: 'committee-1',
    committeeName: 'Committee 1',
    documentDate: '2021-03-15',
    fileName: 'minute.pdf',
    mimeType: 'application/pdf',
    bytes,
    pageCount: 2,
    provenance: {
      repository: 'Minnesota Legislative Reference Library',
      acquisitionMethod: 'lrl_supplied_copy',
      lrlReference: 'fixture',
      acquiredOn: '2026-10-07',
    },
  });
}

test('freezes authoritative bytes as candidate-only intake', () => {
  const row = document();
  assert.match(row.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(row.semanticStatus, 'unreviewed');
  assert.equal(row.evidenceStatus, 'not_evidence');
  assert.equal(row.mechanicallyActionable, false);
  assert.equal(row.modelWeight, 0);
  assert.ok(row.candidateTargets.length > 0);
});

test('committee/date matching creates candidates without semantic inference', () => {
  const rows = senatePrintMinuteCandidateTargets(fixture(), {
    committeeEventId: 'committee-1',
    committeeName: 'Committee 1',
    documentDate: '2021-03-01',
  });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.targetVoteDate === '2021-05-20'));
});

test('fails closed on same-day/post-vote and wrong committee', () => {
  assert.throws(() => collectSenatePrintMinuteIntakeDocument({
    request: fixture(),
    committeeEventId: 'committee-1',
    committeeName: 'Committee 1',
    documentDate: '2021-05-20',
    fileName: 'same-day.pdf',
    mimeType: 'application/pdf',
    bytes: Buffer.from('same-day'),
    provenance: {
      repository: 'Minnesota Legislative Reference Library',
      acquisitionMethod: 'lrl_supplied_copy',
      lrlReference: 'fixture',
      acquiredOn: '2026-10-07',
    },
  }), /does not fall inside any frozen committee request window/);
  assert.throws(() => senatePrintMinuteCandidateTargets(fixture(), {
    committeeEventId: 'other',
    committeeName: 'Other',
    documentDate: '2021-03-01',
  }), /outside the frozen request/);
});

test('fails closed on missing provenance and duplicate bytes', () => {
  assert.throws(() => collectSenatePrintMinuteIntakeDocument({
    request: fixture(),
    committeeEventId: 'committee-1',
    committeeName: 'Committee 1',
    documentDate: '2021-03-01',
    fileName: 'bad.pdf',
    mimeType: 'application/pdf',
    bytes: Buffer.from('bad'),
    provenance: {
      repository: 'Minnesota Legislative Reference Library',
      acquisitionMethod: 'lrl_supplied_copy',
      lrlReference: '',
      acquiredOn: '2026-10-07',
    },
  }), /lrlReference is required/);
  const row = document(Buffer.from('duplicate'));
  assert.throws(() => buildSenatePrintMinuteIntakeBundle({
    request: fixture(),
    requestPackageArtifactId: 11496898656,
    requestPackageArtifactDigest: 'sha256:' + 'b'.repeat(64),
    requestPackageSourceCommitSha: 'c'.repeat(40),
    documents: [row, { ...row, id: row.id + '-copy' }],
  }), /Duplicate intake document bytes/);
});

test('bundle remains outcome-blind and non-actionable', () => {
  const bundle = buildSenatePrintMinuteIntakeBundle({
    request: fixture(),
    requestPackageArtifactId: 11496898656,
    requestPackageArtifactDigest: 'sha256:' + 'b'.repeat(64),
    requestPackageSourceCommitSha: 'c'.repeat(40),
    documents: [document()],
    generatedAt: '2026-10-07T00:00:00.000Z',
  });
  assert.equal(bundle.summary.documents, 1);
  assert.equal(bundle.policy.targetVoteOutcomesRead, false);
  assert.equal(bundle.policy.returnedMinuteAutomaticallyEvidence, false);
  assert.equal(bundle.policy.featureRowsWritten, false);
  assert.equal(bundle.policy.modelFitting, 'none');
});
