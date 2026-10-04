import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

type Review = {
  row: number;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  reviewTextSha256: string;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  frozenReviewText: string;
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
const expectedSourceIds = ["239175bd-042d-4b55-b47e-e320842f472e","27334b25-76cb-44fe-87ab-fb337deacc4b","2c3275ba-a42d-44fb-99e9-84e5fcb33071","3274e867-e1c4-4997-af56-7a147e44cdfe","42bf58a4-a339-4483-a7a8-ae4997aaadea","42fbe9b8-d1f5-4a03-b828-368f5256c28a","4307d70f-baab-40e9-912e-8f0a62feb279","54f469b2-88aa-4559-abda-9fac40bc096c","5eb1786d-4f22-4685-a8e9-61959604c68c","7421d4a3-a149-49bc-9216-6f89397443fa","7d39ee4b-5ea5-45c0-b853-e3864ee70373","b03dc4c9-f81c-438e-8c1c-ec5dd4fbb3e1","b1f294d5-268f-455d-8e8f-a3ac44125de1","bea8f1f2-f54b-4204-acce-f426988e6298","c0a3ac40-70a6-432c-b8e5-5394df7925f2","c9eb1334-317b-4202-bf7d-6b84cbaf5a13","d4bda984-3375-4c71-b9fe-9be4116d58e3","ee2ce278-11be-4214-8033-aef0ad82aa70","ee6f3cd6-fcfa-494d-a6e1-096b5feb485d","f2dd9a4c-d921-4b1e-a055-42459b9f257d","f80d09e1-230e-4a62-8e38-b197b82c1772","fd4b7c5e-4cd2-4d40-a8e7-0f933a76f994"];

test('Session Daily archive-verified semantic review is frozen, grounded, and conservative', () => {
  const payload = JSON.parse(readFileSync(path, 'utf8')) as ReviewFile;
  assert.equal(payload.batchId, 'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-001-SEMANTIC-REVIEW');
  assert.equal(payload.schemaVersion, 'evidence-quality-session-daily-semantic-review-v1');
  assert.equal(payload.evidenceQualitySchemaVersion, 'evidence-quality-v1');
  assert.equal(payload.evidenceQualityPromptVersion, 'evidence-quality-prompt-v1');
  assert.equal(payload.sourceCohort.runId, 37233894771);
  assert.equal(payload.sourceCohort.artifactId, 11314817215);
  assert.equal(payload.sourceCohort.artifactDigest, 'sha256:203e98ddf610af528cac0fd7d697737983ee1a6affa45437d2a688c83ca7ee46');
  assert.equal(payload.sourceCohort.cohortIdentitySha256, '4586c3acd5f0e954e4a7d6795e08cdf25d7ae6347f71c393db2c8eadf0fd9e61');

  assert.equal(payload.reviews.length, 22);
  assert.deepEqual(payload.reviews.map((row) => row.row), Array.from({ length: 22 }, (_, index) => index + 1));
  assert.deepEqual(payload.reviews.map((row) => row.sourceDocumentId), expectedSourceIds);
  assert.equal(new Set(payload.reviews.map((row) => row.sourceDocumentId)).size, 22);

  for (const row of payload.reviews) {
    assert.equal(row.sourceKind, 'house_session_daily');
    assert.match(row.sourceUrl, /^https:\/\/www\.house\.mn\.gov\/SessionDaily\/Story\/\d+$/);
    assert.equal(createHash('sha256').update(row.frozenReviewText).digest('hex'), row.reviewTextSha256);
    assert.ok(row.supportingExcerpt.length > 0 && row.supportingExcerpt.length <= 500);
    assert.ok(row.frozenReviewText.includes(row.supportingExcerpt), `row ${row.row} excerpt must occur verbatim in frozen review text`);
    assert.ok(row.normalizedClaim.length > 0 && row.normalizedClaim.length <= 500);
    assert.ok(row.memberNames.every((name) => row.candidateMemberNames.includes(name)), `row ${row.row} member restriction`);
    assert.ok(row.billIdentifiers.every((bill) => row.candidateBillIdentifiers.includes(bill)), `row ${row.row} bill restriction`);
  }

  const targetDirectional = payload.reviews.filter((row) =>
    ['supports', 'opposes', 'mixed'].includes(row.stance) && row.memberNames.length > 0);
  const exactDirectional = targetDirectional.filter((row) => row.decision === 'exact_member_bill_directional');
  const issueDirectional = targetDirectional.filter((row) => row.decision === 'member_issue_directional');
  const thirdPartyDirectional = payload.reviews.filter((row) => row.decision === 'third_party_bill_directional_not_member_stance');

  assert.equal(targetDirectional.length, 10);
  assert.equal(exactDirectional.length, 4);
  assert.equal(issueDirectional.length, 6);
  assert.equal(thirdPartyDirectional.length, 1);
  assert.ok(targetDirectional.every((row) => ['explicit_position', 'quoted_position'].includes(row.claimType)));
  assert.ok(exactDirectional.every((row) => row.billIdentifiers.length === 1 && row.specificity === 'exact_bill'));
  assert.ok(issueDirectional.every((row) => row.billIdentifiers.length === 0));
  assert.ok(thirdPartyDirectional.every((row) => row.memberNames.length === 0));

  const row5 = payload.reviews.find((row) => row.row === 5)!;
  assert.equal(row5.decision, 'member_issue_directional');
  assert.deepEqual(row5.memberNames, ['Paul Torkelson']);
  assert.deepEqual(row5.billIdentifiers, []);

  const row20 = payload.reviews.find((row) => row.row === 20)!;
  assert.equal(row20.decision, 'non_directional_human_check');
  assert.equal(row20.stance, 'unclear');
  assert.equal(row20.claimType, 'policy_discussion');

  assert.deepEqual(payload.reviews.filter((row) => row.decision.includes('human_check')).map((row) => row.row), [8, 15, 20]);

  assert.equal(payload.summary.documentsReviewed, 22);
  assert.equal(payload.summary.targetMemberDirectionalClaims, 10);
  assert.equal(payload.summary.exactMemberBillDirectionalClaims, 4);
  assert.equal(payload.summary.memberIssueDirectionalClaims, 6);
  assert.equal(payload.summary.exactMemberBillDirectionalUniquePotentialRows, 6);
  assert.deepEqual(payload.summary.humanAdjudicationRecommendedRows, [8, 15, 20]);
  assert.equal(payload.summary.validationFailures, 0);

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
  assert.equal(payload.policy.frozenCandidateListsPreserved, true);
  assert.equal(payload.policy.frozenReviewTextEmbeddedForMechanicalValidation, true);
  assert.equal(payload.policy.modelFitting, 'none');
  assert.equal(payload.policy.servingChanged, false);
});
