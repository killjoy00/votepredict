import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignFinanceSnapshotInfo, getCampaignFinanceContextForMember } from '../src/evidence/campaign-finance-snapshot.js';

test('bundled CFB snapshot contains a substantive 2025-26 corpus', () => {
  const info = campaignFinanceSnapshotInfo();
  assert.equal(info.schemaVersion, 'mn-cfb-2025-2026-v1');
  assert.ok(info.candidateCommitteeCount >= 400);
  assert.ok(info.contributionRows >= 10_000);
  assert.ok(info.independentExpenditureRows >= 100);
});

test('current legislator names can resolve to campaign-finance context without exact punctuation', () => {
  const context = getCampaignFinanceContextForMember({
    membershipId: 'test-membership',
    memberName: 'Brad Tabke',
    chamber: 'house',
  });
  assert.ok(context);
  assert.match(context.committeeName, /Tabke/i);
  assert.ok(context.contributions || context.independentExpenditures);
});
