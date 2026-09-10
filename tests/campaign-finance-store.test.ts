import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignFinanceContextFromStoredEvidence, type StoredCampaignFinanceEvidenceRow } from '../src/evidence/campaign-finance-store.js';

function row(subtype: string, metadata: Record<string, unknown>, createdAt = '2026-09-10T18:48:34.000Z'): StoredCampaignFinanceEvidenceRow {
  return {
    source_url: `https://cfb.example/${subtype}`,
    created_at: createdAt,
    metadata: {
      contextType: 'campaign_finance',
      subtype,
      cycleYears: [2025, 2026],
      committeeName: 'Example Candidate Committee',
      candidateName: 'Example Candidate',
      registrationNumber: '12345',
      ...metadata,
    },
  };
}

test('reconstructs all current campaign-finance subtypes from durable evidence', () => {
  const context = campaignFinanceContextFromStoredEvidence(
    { membershipId: 'member-1', memberName: 'Example Candidate' },
    [
      row('candidate_contributions', {
        totalAmount: 12500,
        transactionCount: 20,
        latestReceiptDate: '2026-07-01',
        topContributors: [{ name: 'Contributor A', amount: 1000, count: 1, type: 'Individual' }],
        byContributorType: [{ name: 'Individual', amount: 10000, count: 18 }],
        topEmployers: [{ name: 'Employer A', amount: 3000, count: 4 }],
      }),
      row('candidate_expenditures', {
        totalAmount: 8000,
        transactionCount: 15,
        latestDate: '2026-07-02',
        topPayees: [{ name: 'Printer A', amount: 2500, count: 2, type: 'Campaign Expenditure' }],
        byPurpose: [{ name: 'Advertising', amount: 5000, count: 8 }],
        byType: [{ name: 'Campaign Expenditure', amount: 8000, count: 15 }],
      }),
      row('independent_expenditures', {
        totalAmount: 4000,
        transactionCount: 3,
        forAmount: 3000,
        againstAmount: 1000,
        latestDate: '2026-06-15',
        topSpenders: [{ name: 'Outside Group', amount: 4000, count: 3, direction: 'for' }],
      }),
    ],
  );

  assert.ok(context);
  assert.equal(context.committeeName, 'Example Candidate Committee');
  assert.equal(context.contributions?.totalAmount, 12500);
  assert.equal(context.expenditures?.totalAmount, 8000);
  assert.equal(context.expenditures?.topPayees[0]?.name, 'Printer A');
  assert.equal(context.independentExpenditures?.againstAmount, 1000);
});

test('expenditure-only durable evidence still produces a usable finance context', () => {
  const context = campaignFinanceContextFromStoredEvidence(
    { membershipId: 'alice-membership', memberName: 'Alice Mann' },
    [row('candidate_expenditures', {
      candidateName: 'Alice Mann',
      committeeName: 'Mann, Alice Senate Committee',
      totalAmount: 3664.87,
      transactionCount: 5,
      latestDate: '2025-10-20',
      topPayees: [{ name: 'MN DFL Senate Caucus', amount: 2500, count: 1, type: 'Contribution' }],
      byPurpose: [],
      byType: [],
    })],
  );

  assert.ok(context);
  assert.equal(context.memberName, 'Alice Mann');
  assert.equal(context.contributions, undefined);
  assert.equal(context.expenditures?.totalAmount, 3664.87);
  assert.equal(context.independentExpenditures, undefined);
});

test('prefers the newest cycle over an older durable finance series', () => {
  const older = row('candidate_contributions', {
    cycleYears: [2023, 2024],
    totalAmount: 999999,
    transactionCount: 99,
    topContributors: [],
    byContributorType: [],
    topEmployers: [],
  }, '2026-09-11T00:00:00.000Z');
  const current = row('candidate_contributions', {
    totalAmount: 5000,
    transactionCount: 5,
    topContributors: [],
    byContributorType: [],
    topEmployers: [],
  }, '2026-09-10T00:00:00.000Z');

  const context = campaignFinanceContextFromStoredEvidence(
    { membershipId: 'member-1', memberName: 'Example Candidate' },
    [older, current],
  );

  assert.equal(context?.contributions?.totalAmount, 5000);
});
