import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const paths = [
  'data/evaluation/evidence-quality/manual-annotations/batch-01.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-02.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-03.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-04.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-01.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-02.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-03.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-01.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-02.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-03.json',
] as const;

test('reviewed sponsorship claims follow sponsorship-support-v1', () => {
  const sponsorship: Array<{ sourceDocumentId: string; claim: any }> = [];
  const documents: any[] = [];

  for (const path of paths) {
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    documents.push(...payload.documents);
    for (const document of payload.documents) {
      for (const claim of document.annotation.claims) {
        if (claim.claimType === 'sponsorship') {
          sponsorship.push({ sourceDocumentId: document.sourceDocumentId, claim });
        }
      }
    }
  }

  assert.equal(sponsorship.length, 24);
  for (const { claim } of sponsorship) {
    assert.equal(claim.stance, 'supports');
    assert.equal(claim.linkage, 'exact_member_bill');
    assert.equal(claim.specificity, 'exact_bill');
    assert.ok(claim.memberNames.length > 0);
    assert.ok(claim.billIdentifiers.length > 0);
  }

  const pursell = documents.find((document) =>
    document.sourceDocumentId === '3fccb9f4-ed6f-4b7c-8a8d-79a299de3c1f');
  assert.ok(pursell);
  const hf3793 = pursell.annotation.claims.find((claim: any) =>
    claim.billIdentifiers.includes('HF 3793') || claim.billIdentifiers.includes('HF3793'));
  assert.ok(hf3793);
  assert.equal(hf3793.claimType, 'procedural_action');
  assert.equal(hf3793.stance, 'none');
});
