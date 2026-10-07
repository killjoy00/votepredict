import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSenatePrintMinuteReviewCompletionTemplate,
  finalizeSenatePrintMinuteReview,
  SENATE_PRINT_MINUTE_PACKET_DECISIONS,
  type SenatePrintMinuteReviewCompletionManifest,
  type SenatePrintMinuteReviewPacket,
} from '../src/evaluation/historical-density-2021-senate-print-minute-review-handoff.js';
import type {
  SenatePrintMinuteIntakeBundle,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

const CONTENT_SHA = 'b'.repeat(64);
const INTAKE_SHA = 'c'.repeat(64);
const LEDGER_SHA = 'd'.repeat(64);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function setSha(values: readonly string[]): string {
  return sha256([...values].sort().join('\n') + '\n');
}

function intake(): SenatePrintMinuteIntakeBundle {
  return {
    schemaVersion: 'historical-density-2021-senate-print-minute-intake-bundle-v1',
    generatedAt: '2026-10-07T00:00:00.000Z',
    requestPackage: {
      artifactId: 11496898656,
      artifactDigest:
        'sha256:c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e',
      sourceCommitSha: '39360a45fa9f8856e26001e4b005246c51467bcf',
      requestAssociationProofSha256:
        '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0',
    },
    summary: {
      documents: 1,
      committees: 1,
      candidateTargetEvents: 2,
      candidateBills: 2,
    },
    documents: [{
      id: 'doc-1',
      sourceClass: 'senate_print_committee_minute',
      committeeEventId: 'committee-1',
      committeeName: 'Finance',
      documentDate: '2021-02-20',
      fileName: 'fixture.pdf',
      mimeType: 'application/pdf',
      bytes: 100,
      contentSha256: CONTENT_SHA,
      pageCount: 2,
      title: 'Fixture',
      provenance: {
        repository: 'Minnesota Legislative Reference Library',
        acquisitionMethod: 'lrl_supplied_copy',
        lrlReference: 'fixture',
        acquiredOn: '2026-10-07',
      },
      candidateTargets: [
        {
          voteEventId: 'event-1',
          billId: 'bill-1',
          identifier: 'SF694',
          targetVoteDate: '2021-03-01',
          requestWindowStart: '2021-02-17',
          requestWindowEndExclusive: '2021-03-01',
          referralDates: ['2021-02-17'],
        },
        {
          voteEventId: 'event-2',
          billId: 'bill-2',
          identifier: 'SF173',
          targetVoteDate: '2021-03-05',
          requestWindowStart: '2021-02-17',
          requestWindowEndExclusive: '2021-03-05',
          referralDates: ['2021-02-17'],
        },
      ],
      candidateTargetEventIds: ['event-1', 'event-2'],
      candidateBillIdentifiers: ['SF173', 'SF694'],
      semanticStatus: 'unreviewed',
      evidenceStatus: 'not_evidence',
      mechanicallyActionable: false,
      modelWeight: 0,
    }],
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      documentDateMustBeStrictPreVote: true,
      committeeAndDateMatchCreatesCandidateOnly: true,
      billMentionRequiredBeforeSemanticApplicability: true,
      memberAttributionRequiredBeforeDirectionalEvidence: true,
      returnedMinuteAutomaticallyEvidence: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };
}

function packet(): SenatePrintMinuteReviewPacket {
  const rows = [
    {
      row: 1,
      reviewKey: `${CONTENT_SHA}|event-1|bill-1`,
      documentId: 'doc-1',
      sourceContentSha256: CONTENT_SHA,
      archivedRelativePath: 'sources/fixture.pdf',
      committeeEventId: 'committee-1',
      committeeName: 'Finance',
      documentDate: '2021-02-20',
      sourceTitle: 'Fixture',
      lrlReference: 'fixture',
      acquisitionMethod: 'lrl_supplied_copy',
      candidateTarget: {
        voteEventId: 'event-1',
        billId: 'bill-1',
        identifier: 'SF694',
        targetVoteDate: '2021-03-01',
        requestWindowStart: '2021-02-17',
        requestWindowEndExclusive: '2021-03-01',
        referralDates: ['2021-02-17'],
      },
      review: {
        decision: null,
        reasonCode: null,
        billMentionExcerpt: null,
        billMentionPage: null,
        attributedMemberName: null,
        memberStance: null,
        normalizedClaim: null,
        supportingExcerpt: null,
        supportingPage: null,
        notes: null,
      },
    },
    {
      row: 2,
      reviewKey: `${CONTENT_SHA}|event-2|bill-2`,
      documentId: 'doc-1',
      sourceContentSha256: CONTENT_SHA,
      archivedRelativePath: 'sources/fixture.pdf',
      committeeEventId: 'committee-1',
      committeeName: 'Finance',
      documentDate: '2021-02-20',
      sourceTitle: 'Fixture',
      lrlReference: 'fixture',
      acquisitionMethod: 'lrl_supplied_copy',
      candidateTarget: {
        voteEventId: 'event-2',
        billId: 'bill-2',
        identifier: 'SF173',
        targetVoteDate: '2021-03-05',
        requestWindowStart: '2021-02-17',
        requestWindowEndExclusive: '2021-03-05',
        referralDates: ['2021-02-17'],
      },
      review: {
        decision: null,
        reasonCode: null,
        billMentionExcerpt: null,
        billMentionPage: null,
        attributedMemberName: null,
        memberStance: null,
        normalizedClaim: null,
        supportingExcerpt: null,
        supportingPage: null,
        notes: null,
      },
    },
  ];
  const reviewKeySha256 = setSha(rows.map((row) => row.reviewKey));
  const value: SenatePrintMinuteReviewPacket = {
    schemaVersion:
      'historical-density-2021-senate-print-minute-semantic-review-packet-v1',
    issue: 718,
    sourceIntake: {
      requestPackageArtifactId: 11496898656,
      documents: 1,
      sourceLedgerProofSha256: LEDGER_SHA,
      sourceContentSha256Set: [CONTENT_SHA],
    },
    summary: {
      reviewRows: 2,
      documents: 1,
      committees: 1,
      candidateTargetEvents: 2,
      candidateBills: 2,
      completedDecisions: 0,
    },
    reviewKeySha256,
    allowedDecisionValues: [...SENATE_PRINT_MINUTE_PACKET_DECISIONS],
    requiredForDirectionalDecision: [
      'billMentionExcerpt',
      'attributedMemberName',
      'memberStance',
      'normalizedClaim',
      'supportingExcerpt',
    ],
    rows,
    policy: {
      sourceDocumentContentReadByGenerator: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      decisionsAutoFilled: false,
      billApplicabilityInferred: false,
      memberAttributionInferred: false,
      memberStanceInferred: false,
      ambiguousDefaultsToFailClosed: true,
      reviewOutputCreatesEvidence: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
    reviewPacketProofSha256: '',
  };
  value.reviewPacketProofSha256 = sha256(JSON.stringify({
    issue: value.issue,
    sourceIntake: value.sourceIntake,
    summary: value.summary,
    reviewKeySha256: value.reviewKeySha256,
    allowedDecisionValues: value.allowedDecisionValues,
    requiredForDirectionalDecision: value.requiredForDirectionalDecision,
    rows: value.rows,
    policy: value.policy,
  }));
  return value;
}

function completed(): SenatePrintMinuteReviewCompletionManifest {
  const template = buildSenatePrintMinuteReviewCompletionTemplate({
    packet: packet(),
    intakeBundle: intake(),
    intakeBundleSha256: INTAKE_SHA,
  }) as {
    manifestSkeleton: SenatePrintMinuteReviewCompletionManifest;
  };
  const value = structuredClone(template.manifestSkeleton);
  value.batchId = 'SENATE-MINUTE-TEST-001';
  value.reviewedOn = '2026-10-07';
  value.documentAttestations[0]!.fullDocumentReviewed = true;

  const sf694 = value.decisions.find(
    (row) => row.candidateBillIdentifier === 'SF694',
  )!;
  sf694.decision = 'directional_member_statement';
  sf694.billMentionExcerpt = 'Sen. Jane Doe said, "I support SF694."';
  sf694.billMentionPage = 1;
  sf694.memberName = 'Jane Doe';
  sf694.attributedMemberText = 'Sen. Jane Doe';
  sf694.memberStance = 'supports';
  sf694.claimType = 'quoted_position';
  sf694.explicitness = 'direct_quote';
  sf694.scope = 'whole_bill';
  sf694.normalizedClaim = 'Jane Doe supports SF694 as a whole.';
  sf694.supportingExcerpt = 'Sen. Jane Doe said, "I support SF694."';
  sf694.supportingPage = 1;
  sf694.extractionConfidence = 0.95;
  sf694.transcriptionVerifiedAgainstSourcePage = true;

  const sf173 = value.decisions.find(
    (row) => row.candidateBillIdentifier === 'SF173',
  )!;
  sf173.decision = 'not_applicable_to_candidate_bill';
  sf173.reasonCode = 'synthetic_not_present';
  return value;
}

test('completion template retains every packet row and document attestation', () => {
  const value = buildSenatePrintMinuteReviewCompletionTemplate({
    packet: packet(),
    intakeBundle: intake(),
    intakeBundleSha256: INTAKE_SHA,
  }) as any;
  assert.equal(value.manifestSkeleton.documentAttestations.length, 1);
  assert.equal(value.manifestSkeleton.decisions.length, 2);
  assert.equal(value.manifestSkeleton.decisions[0].decision, null);
});

test('finalization preserves row decisions and passes directional claims through canonical reviewer', () => {
  const result = finalizeSenatePrintMinuteReview({
    packet: packet(),
    intakeBundle: intake(),
    intakeBundleSha256: INTAKE_SHA,
    completion: completed(),
    generatedAt: '2026-10-07T00:00:00.000Z',
  });
  assert.equal(result.finalization.summary.reviewRows, 2);
  assert.equal(result.finalization.summary.directionalRows, 1);
  assert.equal(result.finalization.summary.notApplicableRows, 1);
  assert.equal(result.finalization.summary.documentsReviewed, 1);
  assert.equal(result.semanticReview.summary.semanticClaims, 1);
  assert.equal(result.semanticReview.semanticClaims[0]?.billIdentifier, 'SF694');
  assert.equal(
    result.semanticReview.semanticClaims[0]?.internalMembershipIdentityResolved,
    false,
  );
  assert.equal(result.finalization.policy.mechanicallyActionable, false);
});

test('requires full-document attestation before any finalization', () => {
  const value = completed();
  value.documentAttestations[0]!.fullDocumentReviewed = false;
  assert.throws(() => finalizeSenatePrintMinuteReview({
    packet: packet(),
    intakeBundle: intake(),
    intakeBundleSha256: INTAKE_SHA,
    completion: value,
  }), /Invalid document review attestation/);
});

test('directional completion must ground the exact packet bill', () => {
  const value = completed();
  const row = value.decisions.find(
    (decision) => decision.decision === 'directional_member_statement',
  )!;
  row.supportingExcerpt = 'Sen. Jane Doe said, "I support this proposal."';
  assert.throws(() => finalizeSenatePrintMinuteReview({
    packet: packet(),
    intakeBundle: intake(),
    intakeBundleSha256: INTAKE_SHA,
    completion: value,
  }), /Incomplete directional completion row/);
});

test('non-directional packet decisions cannot smuggle member stance fields', () => {
  const value = completed();
  const row = value.decisions.find(
    (decision) => decision.decision === 'not_applicable_to_candidate_bill',
  )!;
  row.memberName = 'Jane Doe';
  assert.throws(() => finalizeSenatePrintMinuteReview({
    packet: packet(),
    intakeBundle: intake(),
    intakeBundleSha256: INTAKE_SHA,
    completion: value,
  }), /Invalid fail-closed completion row/);
});
