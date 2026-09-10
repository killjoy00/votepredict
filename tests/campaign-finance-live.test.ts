import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCampaignFinanceSnapshotFromTexts,
  candidateIdentityFromCommitteeName,
} from '../src/evidence/campaign-finance-live.js';
import { resolveCampaignFinanceMemberAgainstSnapshot } from '../src/evidence/campaign-finance-snapshot.js';

test('CFB committee parser accepts standard comma and natural-order committee names', () => {
  assert.deepEqual(candidateIdentityFromCommitteeName('Maye Quade, Erin Senate Committee'), {
    candidateName: 'Erin Maye Quade',
    chamber: 'senate',
    matchKey: 'erin|quade',
    lastNameKey: 'quade',
  });
  assert.deepEqual(candidateIdentityFromCommitteeName('Steve Drazkowski Senate Committee'), {
    candidateName: 'Steve Drazkowski',
    chamber: 'senate',
    matchKey: 'steve|drazkowski',
    lastNameKey: 'drazkowski',
  });
});

test('live CFB snapshot parser preserves activity for Drazkowski and Erin Maye Quade aliases', () => {
  const contributionsText = [
    'Recipient reg num,Recipient,Amount,Receipt date,Year,Contributor,Contrib type,Contrib Employer name',
    '12345,Steve Drazkowski Senate Committee,500,2026-06-01,2026,Example Donor,Individual,Example Employer',
    '18724,"Maye Quade, Erin Senate Committee",250,2026-05-15,2026,Another Donor,Individual,',
  ].join('\n');
  const independentText = [
    'Affected Cmte Reg Num,Affected Comte Name,Amount,Unpaid amount,For /Against,Date,Year,Spender',
    '12345,Steve Drazkowski Senate Committee,300,0,For,2026-07-01,2026,Example IE Committee',
  ].join('\n');
  const snapshot = buildCampaignFinanceSnapshotFromTexts({
    contributionsText,
    independentExpendituresText: independentText,
    contributionsUrl: 'https://example.test/contributions.csv',
    independentExpendituresUrl: 'https://example.test/ie.csv',
    generatedAt: '2026-09-10T00:00:00.000Z',
  });

  const drazkowski = resolveCampaignFinanceMemberAgainstSnapshot(snapshot, {
    membershipId: 'drazkowski',
    memberName: 'Steve Drazkowski',
    chamber: 'senate',
  });
  assert.equal(drazkowski.status, 'resolved_with_activity');
  assert.equal(drazkowski.context?.contributions?.transactionCount, 1);
  assert.equal(drazkowski.context?.independentExpenditures?.transactionCount, 1);

  const mayeQuade = resolveCampaignFinanceMemberAgainstSnapshot(snapshot, {
    membershipId: 'maye-quade',
    memberName: 'Erin K. Maye Quade',
    chamber: 'senate',
  });
  assert.equal(mayeQuade.status, 'resolved_with_activity');
  assert.equal(mayeQuade.method, 'explicit_alias');
  assert.equal(mayeQuade.context?.contributions?.transactionCount, 1);
});

test('zero activity remains different from identity ambiguity', () => {
  const snapshot = buildCampaignFinanceSnapshotFromTexts({
    contributionsText: 'Recipient reg num,Recipient,Amount,Receipt date,Year,Contributor,Contrib type,Contrib Employer name\n',
    independentExpendituresText: 'Affected Cmte Reg Num,Affected Comte Name,Amount,Unpaid amount,For /Against,Date,Year,Spender\n',
    contributionsUrl: 'https://example.test/contributions.csv',
    independentExpendituresUrl: 'https://example.test/ie.csv',
    generatedAt: '2026-09-10T00:00:00.000Z',
  });
  const mann = resolveCampaignFinanceMemberAgainstSnapshot(snapshot, {
    membershipId: 'mann',
    memberName: 'Alice Mann',
    chamber: 'senate',
  });
  assert.equal(mann.status, 'not_in_activity_snapshot');
  assert.notEqual(mann.status, 'ambiguous');
});
