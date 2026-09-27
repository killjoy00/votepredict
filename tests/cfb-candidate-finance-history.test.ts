import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateFinanceContentSha256,
  parseCfbCandidateContributionCsv,
  parseCfbCandidateExpenditureCsv,
  sessionForCandidateFinanceYear,
} from '../src/evidence/cfb-candidate-finance-history.js';

test('parses candidate contributions as stable row-level finance evidence', () => {
  const csv = [
    'Recipient reg num,Recipient,Recipient type,Recipient subtype,Amount,Receipt date,Year,Contributor,Contrib Reg Num,Contrib type,Receipt type,In kind?,In-kind descr,Contrib zip,Contrib Employer name',
    '19001,"Doe, Jane House Committee",Candidate,House,500,10/25/2024,2024,Example Donor,,Individual,Contribution,No,,55101,Example Employer',
  ].join('\n');

  const rows = parseCfbCandidateContributionCsv(csv, { fromYear: 2021, toYear: 2026 });
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.kind, 'contribution');
  assert.equal(row.filerRegistrationNumber, '19001');
  assert.equal(row.candidateName, 'Jane Doe');
  assert.equal(row.chamber, 'house');
  assert.equal(row.transactionDate, '2024-10-25');
  assert.equal(row.amount, 500);
  assert.equal(row.contributor, 'Example Donor');
  assert.equal(row.employer, 'Example Employer');
  assert.equal(row.reportName, null);
  assert.equal(row.filedOn, null);
  assert.equal(row.disclosedOn, null);
  assert.match(row.rowKey, /^[a-f0-9]{64}$/);
  assert.equal(sessionForCandidateFinanceYear(2024), '2023-2024');
});

test('parses candidate expenditures and keeps unpaid amount separate', () => {
  const csv = [
    'Committee reg num,Committee name,Entity type,Entity sub-type,Vendor name,Vendor city,Vendor state,Vendor zip,Amount,Unpaid amount,Date,Purpose,Year,Type,In-kind descr,In-kind?,Affected committee name,Affected committee reg num',
    '19001,"Doe, Jane House Committee",Candidate,House,Example Vendor,St Paul,MN,55101,1200.50,25.00,11/2/2024,Campaign operations,2024,General expenditure,,No,,',
  ].join('\n');

  const rows = parseCfbCandidateExpenditureCsv(csv, { fromYear: 2021, toYear: 2026 });
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.kind, 'expenditure');
  assert.equal(row.filerRegistrationNumber, '19001');
  assert.equal(row.candidateName, 'Jane Doe');
  assert.equal(row.chamber, 'house');
  assert.equal(row.transactionDate, '2024-11-02');
  assert.equal(row.amount, 1200.5);
  assert.equal(row.unpaidAmount, 25);
  assert.equal(row.totalAmount, 1225.5);
  assert.equal(row.vendorName, 'Example Vendor');
  assert.match(row.rowKey, /^[a-f0-9]{64}$/);
});

test('candidate finance parser separates disclosure timing from transaction timing', () => {
  const csv = [
    'Recipient reg num,Recipient,Amount,Receipt date,Year,Contributor,Report Name,Filed Date,Disclosure Date',
    '19001,"Doe, Jane House Committee",500,10/25/2024,2024,Example Donor,2024 Year-End,1/29/2025,1/30/2025',
  ].join('\n');

  const [row] = parseCfbCandidateContributionCsv(csv);
  assert.equal(row.transactionDate, '2024-10-25');
  assert.equal(row.reportName, '2024 Year-End');
  assert.equal(row.filedOn, '2025-01-29');
  assert.equal(row.disclosedOn, '2025-01-30');
});

test('candidate finance row identity is deterministic and changes with material row content', () => {
  const header = 'Recipient reg num,Recipient,Amount,Receipt date,Year,Contributor';
  const one = parseCfbCandidateContributionCsv([
    header,
    '19001,"Doe, Jane House Committee",500,10/25/2024,2024,Example Donor',
  ].join('\n'))[0];
  const same = parseCfbCandidateContributionCsv([
    header,
    '19001,"Doe, Jane House Committee",500,10/25/2024,2024,Example Donor',
  ].join('\n'))[0];
  const changed = parseCfbCandidateContributionCsv([
    header,
    '19001,"Doe, Jane House Committee",600,10/25/2024,2024,Example Donor',
  ].join('\n'))[0];

  assert.equal(one.rowKey, same.rowKey);
  assert.notEqual(one.rowKey, changed.rowKey);
  assert.equal(
    candidateFinanceContentSha256([one]),
    candidateFinanceContentSha256([same]),
  );
  assert.notEqual(
    candidateFinanceContentSha256([one]),
    candidateFinanceContentSha256([changed]),
  );
});

test('candidate finance parser rejects invalid dates as availability provenance', () => {
  const csv = [
    'Recipient reg num,Recipient,Amount,Receipt date,Year,Contributor,Disclosure Date',
    '19001,"Doe, Jane House Committee",500,2/30/2024,2024,Example Donor,2/31/2024',
  ].join('\n');
  const [row] = parseCfbCandidateContributionCsv(csv);
  assert.equal(row.transactionDate, null);
  assert.equal(row.disclosedOn, null);
});
