import test from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignFinanceSnapshotInfo,
  getCampaignFinanceContextForMember,
  resolveCampaignFinanceMember,
} from '../src/evidence/campaign-finance-snapshot.js';

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

test('current roster aliases resolve deterministically to active CFB committees', () => {
  const cases = [
    { memberName: 'Bjorn Olson', chamber: 'house', candidate: /Olson/i },
    { memberName: 'Liz Lee', chamber: 'house', candidate: /Lee/i },
    { memberName: 'Scott Van Binsbergen', chamber: 'house', candidate: /Van Binsbergen/i },
    { memberName: 'Jim Carlson', chamber: 'senate', candidate: /Carlson/i },
    { memberName: 'Jr. Michael Holmstrom', chamber: 'senate', candidate: /Holmstrom/i },
    { memberName: 'Steve Drazkowski', chamber: 'senate', candidate: /Drazkowski/i },
  ] as const;

  for (const item of cases) {
    const resolution = resolveCampaignFinanceMember({
      membershipId: `test-${item.memberName}`,
      memberName: item.memberName,
      chamber: item.chamber,
    });
    assert.equal(resolution.status, 'resolved_with_activity', `${item.memberName} should resolve to an activity-bearing CFB committee`);
    assert.match(resolution.candidateName ?? '', item.candidate);
    assert.ok(resolution.context);
  }
});

test('absence from the activity-derived snapshot is not reported as an identity failure', () => {
  const resolution = resolveCampaignFinanceMember({
    membershipId: 'test-no-row',
    memberName: 'Definitely No Such Minnesota Legislator',
    chamber: 'house',
  });
  assert.equal(resolution.status, 'not_in_activity_snapshot');
  assert.equal(resolution.context, undefined);
});
