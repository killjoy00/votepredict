import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSenatePrintMinuteSemanticReviewBundle,
  type SenatePrintMinuteSemanticReviewManifest,
} from '../src/evaluation/historical-density-2021-senate-print-minute-semantic-review.js';
import type {
  SenatePrintMinuteIntakeBundle,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

const INTAKE_SHA = 'a'.repeat(64);
const CONTENT_SHA = 'b'.repeat(64);

function intakeBundle(): SenatePrintMinuteIntakeBundle {
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
      candidateTargetEvents: 1,
      candidateBills: 1,
    },
    documents: [{
      id: 'senate-print-minute-fixture',
      sourceClass: 'senate_print_committee_minute',
      committeeEventId: '23837-0-s',
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
      candidateTargets: [{
        voteEventId: 'event-1',
        billId: 'bill-1',
        identifier: 'SF694',
        targetVoteDate: '2021-03-01',
        requestWindowStart: '2021-02-17',
        requestWindowEndExclusive: '2021-03-01',
        referralDates: ['2021-02-17'],
      }],
      candidateTargetEventIds: ['event-1'],
      candidateBillIdentifiers: ['SF694'],
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

function manifest(): SenatePrintMinuteSemanticReviewManifest {
  return {
    schemaVersion:
      'historical-density-2021-senate-print-minute-semantic-review-manifest-v1',
    batchId: 'SENATE-MINUTE-TEST-001',
    intakeBundleSha256: INTAKE_SHA,
    reviewedOn: '2026-10-07',
    reviewMethod: 'human_manual_full_document',
    reviews: [{
      documentId: 'senate-print-minute-fixture',
      sourceContentSha256: CONTENT_SHA,
      fullDocumentReviewed: true,
      decision: 'directional_claims',
      notes: [],
      claims: [{
        sourcePage: 1,
        billIdentifier: 'SF694',
        memberName: 'Jane Doe',
        attributedMemberText: 'Sen. Jane Doe',
        stance: 'supports',
        claimType: 'quoted_position',
        explicitness: 'direct_quote',
        scope: 'whole_bill',
        normalizedClaim: 'Jane Doe supports SF694 as a whole.',
        supportingExcerpt: 'Sen. Jane Doe said, "I support SF694."',
        extractionConfidence: 0.95,
        transcriptionVerifiedAgainstSourcePage: true,
      }],
    }],
    policy: {
      outcomeUse: 'none',
      targetVoteOutcomesConsulted: false,
      partyOrIdeologyUsed: false,
      committeeMembershipUsedAsStance: false,
      attendanceUsedAsStance: false,
      proceduralActionUsedAsDirectionalStance: false,
      exactBillMentionRequired: true,
      explicitNamedMemberAttributionRequired: true,
      wholeBillPositionRequired: true,
    },
  };
}

test('accepts explicit exact-member exact-bill whole-bill review only as context', () => {
  const review = buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: manifest(),
    generatedAt: '2026-10-07T00:00:00.000Z',
  });
  assert.equal(review.summary.documentsReviewed, 1);
  assert.equal(review.summary.semanticClaims, 1);
  assert.equal(review.semanticClaims[0]?.billIdentifier, 'SF694');
  assert.deepEqual(review.semanticClaims[0]?.candidateTargetEventIds, ['event-1']);
  assert.equal(review.semanticClaims[0]?.internalMembershipIdentityResolved, false);
  assert.equal(review.semanticClaims[0]?.mechanicallyActionable, false);
  assert.equal(review.policy.featureRowsWritten, false);
});

test('rejects non-candidate bill identifiers', () => {
  const value = manifest();
  value.reviews[0]!.claims[0]!.billIdentifier = 'SF999';
  value.reviews[0]!.claims[0]!.supportingExcerpt =
    'Sen. Jane Doe said, "I support SF999."';
  assert.throws(() => buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: value,
  }), /non-candidate bill/);
});

test('requires bill and named-member grounding in the transcribed excerpt', () => {
  const missingBill = manifest();
  missingBill.reviews[0]!.claims[0]!.supportingExcerpt =
    'Sen. Jane Doe said, "I support this proposal."';
  assert.throws(() => buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: missingBill,
  }), /does not contain exact bill identifier/);

  const missingMember = manifest();
  missingMember.reviews[0]!.claims[0]!.supportingExcerpt =
    'The chair said, "I support SF694."';
  assert.throws(() => buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: missingMember,
  }), /does not contain attributedMemberText/);
});

test('does not permit procedural action as directional stance', () => {
  const value = manifest() as any;
  value.reviews[0].claims[0].claimType = 'legislative_action';
  value.reviews[0].claims[0].explicitness = 'attributed_paraphrase';
  assert.throws(() => buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: value,
  }), /Unsupported directional semantics/);
});

test('requires fail-closed reason for non-directional documents', () => {
  const value = manifest();
  value.reviews[0] = {
    documentId: 'senate-print-minute-fixture',
    sourceContentSha256: CONTENT_SHA,
    fullDocumentReviewed: true,
    decision: 'no_directional_claims',
    notes: [],
    claims: [],
  };
  assert.throws(() => buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: value,
  }), /lacks fail-closed reason/);

  value.reviews[0]!.reasonCode = 'administrative_or_procedural_only';
  const review = buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: value,
  });
  assert.equal(review.summary.nonDirectionalDocuments, 1);
  assert.equal(review.summary.semanticClaims, 0);
});

test('requires every intake document exactly once', () => {
  const value = manifest();
  value.reviews = [];
  assert.throws(() => buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: intakeBundle(),
    intakeBundleSha256: INTAKE_SHA,
    manifest: value,
  }), /review every intake document exactly once/);
});
