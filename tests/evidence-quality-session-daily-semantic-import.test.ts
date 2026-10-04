import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SESSION_DAILY_REVIEW_CONTENT_MODE,
  SESSION_DAILY_REVIEW_MODEL,
  SESSION_DAILY_REVIEW_PROVIDER,
  sessionDailyReviewAnnotation,
  sessionDailyReviewSemanticFingerprint,
  validateSessionDailyReviewFile,
  type SessionDailySemanticReviewFile,
} from '../src/evidence/evidence-quality-session-daily-review.js';

const paths = [
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-v1.json',
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-supplement-02-v1.json',
] as const;

function load() {
  return paths.map((path) => {
    const file = JSON.parse(readFileSync(path, 'utf8')) as SessionDailySemanticReviewFile;
    validateSessionDailyReviewFile(file);
    return file;
  });
}

test('Session Daily review converter preserves excerpt-only safety boundary', () => {
  const files = load();
  const rows = files.flatMap((file) => file.reviews);
  assert.equal(rows.length, 37);
  assert.equal(new Set(rows.map((row) => row.sourceDocumentId)).size, 37);
  assert.equal(SESSION_DAILY_REVIEW_PROVIDER, 'manual-openai');
  assert.equal(SESSION_DAILY_REVIEW_MODEL, 'GPT-5.6 Sol');
  assert.equal(SESSION_DAILY_REVIEW_CONTENT_MODE, 'excerpt_only');

  const converted = rows.map((row) => ({
    row,
    annotation: sessionDailyReviewAnnotation(row),
  }));
  assert.ok(converted.every(({ annotation }) => annotation.claims.length === 1));
  assert.ok(converted.every(({ annotation }) =>
    annotation.document.contentType === 'official_reporting'
    && annotation.document.novelty === 'unknown'
    && annotation.document.corroboration === 'unknown'));

  const directional = converted.filter(({ annotation }) =>
    ['supports', 'opposes', 'mixed'].includes(annotation.claims[0].stance)
    && annotation.claims[0].memberNames.length > 0);
  assert.equal(directional.length, 20);
  assert.equal(converted.filter(({ row }) => row.decision === 'exact_member_bill_directional').length, 10);
  assert.equal(converted.filter(({ row }) => row.decision === 'member_issue_directional').length, 10);
  assert.equal(converted.filter(({ row }) =>
    row.decision === 'third_party_bill_directional_not_member_stance').length, 1);

  const exact = converted.filter(({ row }) => row.decision === 'exact_member_bill_directional');
  assert.ok(exact.every(({ annotation }) =>
    annotation.claims[0].linkage === 'exact_member_bill'
    && annotation.claims[0].billIdentifiers.length === 1
    && annotation.claims[0].attributionType === 'target_member'));

  const issue = converted.filter(({ row }) => row.decision === 'member_issue_directional');
  assert.ok(issue.every(({ annotation }) =>
    annotation.claims[0].linkage === 'member_issue'
    && annotation.claims[0].billIdentifiers.length === 0
    && annotation.claims[0].attributionType === 'target_member'));

  const thirdParty = converted.find(({ row }) =>
    row.decision === 'third_party_bill_directional_not_member_stance');
  assert.ok(thirdParty);
  assert.equal(thirdParty.annotation.claims[0].memberNames.length, 0);
  assert.equal(thirdParty.annotation.claims[0].linkage, 'bill_only');
  assert.notEqual(thirdParty.annotation.claims[0].attributionType, 'target_member');

  const humanChecks = converted.filter(({ row }) => row.decision.includes('human_check'));
  assert.equal(humanChecks.length, 5);
  assert.ok(humanChecks.every(({ annotation }) =>
    !['supports', 'opposes', 'mixed'].includes(annotation.claims[0].stance)
    && annotation.claims[0].extractionConfidence === 0.5));
});

test('Session Daily semantic fingerprints are deterministic and unique by frozen review', () => {
  const rows = load().flatMap((file) => file.reviews);
  const fingerprints = rows.map((row) => {
    const annotation = sessionDailyReviewAnnotation(row);
    const first = sessionDailyReviewSemanticFingerprint(row, annotation);
    const second = sessionDailyReviewSemanticFingerprint(row, annotation);
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(first, second);
    return first;
  });
  assert.equal(new Set(fingerprints).size, 37);
});
