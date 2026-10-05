import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isSessionDailyHumanCheck,
  sessionDailyReviewLinkage,
  sessionDailyReviewSemanticFingerprint,
  sessionDailyReviewText,
  sessionDailyReviewTextSha256,
  sessionDailyReviewToAnnotation,
  type SessionDailyReviewRow,
} from '../src/evidence/evidence-quality-session-daily-review.js';
import { validateEvidenceQualityAnnotation } from '../src/evidence/evidence-quality.js';

const paths = [
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-v1.json',
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-supplement-02-v1.json',
] as const;

test('Session Daily excerpt reviews transform conservatively and exclude human-check rows', () => {
  let reviewed = 0;
  let importable = 0;
  let humanChecks = 0;
  let targetDirectional = 0;
  let thirdPartyDirectional = 0;
  let nonDirectional = 0;
  let exactMemberBillDirectional = 0;
  let memberIssueDirectional = 0;
  const sourceIds = new Set<string>();
  const fingerprints = new Set<string>();

  for (const path of paths) {
    const batch = JSON.parse(readFileSync(path, 'utf8')) as {
      batchId: string;
      reviews: SessionDailyReviewRow[];
    };

    for (const row of batch.reviews) {
      reviewed += 1;
      assert.equal(sessionDailyReviewTextSha256(row), row.reviewTextSha256);
      if (isSessionDailyHumanCheck(batch.batchId, row.row)) {
        humanChecks += 1;
        assert.equal(row.decision, 'non_directional_human_check');
        continue;
      }

      importable += 1;
      assert.equal(row.sourceKind, 'house_session_daily');
      assert.equal(sourceIds.has(row.sourceDocumentId), false);
      sourceIds.add(row.sourceDocumentId);

      const annotation = sessionDailyReviewToAnnotation(row);
      validateEvidenceQualityAnnotation(annotation, {
        sourceKind: row.sourceKind,
        sourceUrl: row.sourceUrl,
        contentMode: 'excerpt_only',
        text: sessionDailyReviewText(row),
        candidateMemberNames: row.candidateMemberNames,
        candidateBillIdentifiers: row.candidateBillIdentifiers,
      });

      const claim = annotation.claims[0];
      if (['supports', 'opposes', 'mixed'].includes(claim.stance)) {
        if (row.decision === 'third_party_bill_directional_not_member_stance') {
          thirdPartyDirectional += 1;
          assert.equal(claim.linkage, 'bill_only');
          assert.deepEqual(claim.memberNames, []);
          assert.equal(claim.attributionType, 'official_record');
        } else {
          targetDirectional += 1;
          if (claim.claimType === 'sponsorship') {
            assert.equal(claim.attributionType, 'official_record');
          } else {
            assert.equal(claim.attributionType, 'target_member');
          }
          if (claim.linkage === 'exact_member_bill') exactMemberBillDirectional += 1;
          if (claim.linkage === 'member_issue') memberIssueDirectional += 1;
        }
      } else {
        nonDirectional += 1;
      }

      assert.equal(sessionDailyReviewLinkage(row), claim.linkage);
      const fingerprint = sessionDailyReviewSemanticFingerprint(row);
      assert.match(fingerprint, /^[a-f0-9]{64}$/);
      fingerprints.add(fingerprint);
    }
  }

  assert.equal(reviewed, 37);
  assert.equal(humanChecks, 3);
  assert.equal(importable, 34);
  assert.equal(sourceIds.size, 34);
  assert.equal(fingerprints.size, 34);
  assert.equal(targetDirectional, 26);
  assert.equal(thirdPartyDirectional, 1);
  assert.equal(nonDirectional, 7);
  assert.equal(exactMemberBillDirectional, 16);
  assert.equal(memberIssueDirectional, 10);
});
