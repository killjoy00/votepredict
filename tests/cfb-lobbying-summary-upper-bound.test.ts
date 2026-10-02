import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cfbLobbyingDisbursementSummaryUrl,
  lobbyingSummaryDemonstratesPrincipalRow,
  lobbyingSummaryIdentityProven,
  normalizeLobbyingSummaryText,
} from '../src/evidence/cfb-lobbying-summary-upper-bound.js';

test('builds exact official CFB lobbying summary URLs', () => {
  assert.equal(
    cfbLobbyingDisbursementSummaryUrl(2022),
    'https://cfb.mn.gov/pdf/publications/reports/lobbyist_disbursement_summaries/lbsm_2022.pdf',
  );
  assert.throws(() => cfbLobbyingDisbursementSummaryUrl(2020));
});

test('summary identity requires lobbying-principal context and repeated report year', () => {
  const text = [
    'Lobbyist Principal Disbursements 2018 - 2022',
    'Calendar Year 2022',
    'As Reported in 2022',
  ].join(' ');
  assert.equal(lobbyingSummaryIdentityProven(text, 2022), true);
  assert.equal(lobbyingSummaryIdentityProven('Calendar Year 2022 2022 2022', 2022), false);
});

test('strict principal-row proof requires exact normalized name and nearby amount', () => {
  const text = [
    'Lobbyist Principal Disbursements 2018 - 2022',
    'Calendar Year 2022',
    'As Reported in 2022',
    'Principals with Disbursements Over $250,000',
    'MN Chamber of Commerce $1,840,000',
    'Another Principal $900,000',
  ].join(' ');
  assert.equal(lobbyingSummaryDemonstratesPrincipalRow({
    principal: 'MN Chamber of Commerce',
    reportYear: 2022,
    totalSpent: 1_840_000,
  }, text), true);
  assert.equal(lobbyingSummaryDemonstratesPrincipalRow({
    principal: 'MN Chamber of Commerce',
    reportYear: 2022,
    totalSpent: 900_000,
  }, text), false);
  assert.equal(lobbyingSummaryDemonstratesPrincipalRow({
    principal: 'Different Chamber',
    reportYear: 2022,
    totalSpent: 1_840_000,
  }, text), false);
  assert.equal(lobbyingSummaryDemonstratesPrincipalRow({
    principal: 'MN Chamber of Commerce',
    reportYear: 2022,
    totalSpent: 840_000,
  }, text), false);
  assert.equal(lobbyingSummaryDemonstratesPrincipalRow({
    principal: 'MN Chamber of Commerce Foundation',
    reportYear: 2022,
    totalSpent: 1_840_000,
  }, text), false);
});

test('normalization is punctuation tolerant but does not invent identity', () => {
  assert.equal(
    normalizeLobbyingSummaryText('Xcel Energy Services, Inc. & Affiliates'),
    'xcel energy services, inc. and affiliates',
  );
});
