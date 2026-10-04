import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Review = {
  row: number;
  sourceDocumentId: string;
  reviewTextSha256: string;
  decision: string;
  memberNames: string[];
  billIdentifiers: string[];
  stance: string;
  claimType: string;
  specificity: string;
  normalizedClaim: string;
  supportingExcerpt: string;
  notes: string[];
};

type ReviewFile = {
  batchId: string;
  schemaVersion: string;
  evidenceQualitySchemaVersion: string;
  evidenceQualityPromptVersion: string;
  sourceCohort: {
    runId: number;
    artifactId: number;
    artifactDigest: string;
    cohortIdentitySha256: string;
  };
  summary: Record<string, unknown>;
  policy: Record<string, unknown>;
  reviews: Review[];
};

const path = 'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-v1.json';

test('Session Daily archive-verified semantic review is frozen and conservative', () => {
  const payload = JSON.parse(readFileSync(path, 'utf8')) as ReviewFile;
  assert.equal(payload.batchId, 'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-001-SEMANTIC-REVIEW');
  assert.equal(payload.schemaVersion, 'evidence-quality-session-daily-semantic-review-v1');
  assert.equal(payload.evidenceQualitySchemaVersion, 'evidence-quality-v1');
  assert.equal(payload.evidenceQualityPromptVersion, 'evidence-quality-prompt-v1');
  assert.equal(payload.sourceCohort.runId, 37233894771);
  assert.equal(payload.sourceCohort.artifactId, 11314817215);
  assert.equal(
    payload.sourceCohort.artifactDigest,
    'sha256:203e98ddf610af528cac0fd7d697737983ee1a6affa45437d2a688c83ca7ee46',
  );
  assert.equal(
    payload.sourceCohort.cohortIdentitySha256,
    '4586c3acd5f0e954e4a7d6795e08cdf25d7ae6347f71c393db2c8eadf0fd9e61',
  );

  assert.equal(payload.reviews.length, 22);
  assert.deepEqual(payload.reviews.map((row) => row.row), Array.from({ length: 22 }, (_, index) => index + 1));
  assert.equal(new Set(payload.reviews.map((row) => row.sourceDocumentId)).size, 22);
  assert.ok(payload.reviews.every((row) => /^[0-9a-f]{64}$/.test(row.reviewTextSha256)));
  assert.ok(payload.reviews.every((row) => row.supportingExcerpt.length > 0 && row.supportingExcerpt.length <= 500));
  assert.ok(payload.reviews.every((row) => row.normalizedClaim.length > 0));

  const targetMemberDirectional = payload.reviews.filter((row) =>
    ['supports', 'opposes', 'mixed'].includes(row.stance) && row.memberNames.length > 0);
  const exactDirectional = targetMemberDirectional.filter((row) => row.decision.startsWith('exact_member_bill_directional'));
  const issueDirectional = targetMemberDirectional.filter((row) => row.decision === 'member_issue_directional');
  const thirdPartyDirectional = payload.reviews.filter((row) => row.decision === 'third_party_bill_directional_not_member_stance');

  assert.equal(targetMemberDirectional.length, 10);
  assert.equal(exactDirectional.length, 5);
  assert.equal(issueDirectional.length, 5);
  assert.equal(thirdPartyDirectional.length, 1);
  assert.ok(targetMemberDirectional.every((row) => ['explicit_position', 'quoted_position'].includes(row.claimType)));
  assert.ok(exactDirectional.every((row) => row.billIdentifiers.length === 1 && row.specificity === 'exact_bill'));
  assert.ok(issueDirectional.every((row) => row.billIdentifiers.length === 0));
  assert.ok(thirdPartyDirectional.every((row) => row.memberNames.length === 0));

  assert.deepEqual(
    payload.reviews.filter((row) => row.decision.includes('human_check')).map((row) => row.row),
    [8, 15, 20],
  );

  assert.equal(payload.summary.documentsReviewed, 22);
  assert.equal(payload.summary.targetMemberDirectionalClaims, 10);
  assert.equal(payload.summary.exactMemberBillDirectionalClaims, 5);
  assert.equal(payload.summary.memberIssueDirectionalClaims, 5);
  assert.equal(payload.summary.exactMemberBillDirectionalUniquePotentialRows, 7);
  assert.deepEqual(payload.summary.humanAdjudicationRecommendedRows, [8, 15, 20]);

  assert.equal(payload.policy.outcomeBlind, true);
  assert.equal(payload.policy.contextOnly, true);
  assert.equal(payload.policy.mechanicallyActionable, false);
  assert.equal(payload.policy.modelWeight, 0);
  assert.equal(payload.policy.reviewUsesFrozenExcerptOnly, true);
  assert.equal(payload.policy.verifiedFullTextClaimed, false);
  assert.equal(payload.policy.sourceByteHashMatchClaimed, false);
  assert.equal(payload.policy.sponsorshipAuthorshipProcedureDirectionalByDefault, false);
  assert.equal(payload.policy.individualProvisionSupportPromotedToWholeBillSupport, false);
  assert.equal(payload.policy.candidateMemberStanceInferredFromThirdPartySupport, false);
  assert.equal(payload.policy.modelFitting, 'none');
  assert.equal(payload.policy.servingChanged, false);
});
