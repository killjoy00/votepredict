import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCfbCurrentReportGrid } from '../src/evidence/cfb-current-report-acquisition.js';
import {
  cfbReportTextDemonstratesFinanceRow,
  parseCfbReportPdfAvailability,
  type CfbReportViewerReference,
} from '../src/evidence/cfb-report-pdf-proof.js';
import { firstProvenCfbFinanceAvailability } from '../src/evidence/cfb-report-finance-mapper.js';

test('parses official current-report grid into viewer references', () => {
  const payload = {
    cols: ['FilingYear', 'RegisteredEntityFullName', 'ReportType', 'RegisteredEntityID'],
    data: {
      '17653': [[
        '2026',
        'Example Candidate Committee',
        '<ul><li><a class="amendment-0" title="September Report" href="javascript:viewPDF(\'26\',\'pcc\',\'D\',\'0\',\'17653\',0)">September Report</a><dl><dd><a class="amendment-1" title="September Report - Amendment #1" href="javascript:viewPDF(\'26\',\'pcc\',\'D\',\'0\',\'17653\',1)">Amendment #1</a></dd></dl></li></ul>',
        '17653',
      ]],
    },
  };
  const grid = parseCfbCurrentReportGrid(payload);
  assert.equal(grid.entityCount, 1);
  assert.equal(grid.references.length, 2);
  assert.equal(grid.references[0]?.registrationNumber, '17653');
  assert.equal(grid.references[0]?.amendment, 0);
  assert.equal(grid.references[1]?.amendment, 1);
});

test('parses CFB report coverage and derives next-day availability from received date', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2026,
    reportName: 'September Report',
    year: '26',
    type: 'pcc',
    period: 'D',
    se: '0',
    registrationNumber: '17653',
    amendment: 0,
  };
  const text = [
    'Registration Number: 17653',
    'Period Covered: 01/01/2026 through 09/15/2026',
    'Received by the Board September 22, 2026',
  ].join(' ');
  const proof = parseCfbReportPdfAvailability(reference, text);
  assert.ok(proof);
  assert.equal(proof.filedOn, '2026-09-22');
  assert.equal(proof.window.coverageStartOn, '2026-01-01');
  assert.equal(proof.window.coverageEndOn, '2026-09-15');
  assert.equal(proof.window.availableOn, '2026-09-23');
  assert.equal(proof.window.proofKind, 'cfb_report_filing');
});

test('rejects CFB report windows whose proven availability predates coverage end', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2026,
    reportName: 'Malformed Report',
    year: '26',
    type: 'pcc',
    period: 'D',
    se: '0',
    registrationNumber: '17653',
    amendment: 0,
  };
  const text = [
    'Registration Number: 17653',
    'Period Covered: 01/01/2026 through 09/30/2026',
    'Received by the Board September 20, 2026',
  ].join(' ');
  assert.equal(parseCfbReportPdfAvailability(reference, text), null);
});

test('rejects CFB report windows whose coverage end predates coverage start', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2026,
    reportName: 'Malformed Report',
    year: '26',
    type: 'pcc',
    period: 'D',
    se: '0',
    registrationNumber: '17653',
    amendment: 0,
  };
  const text = [
    'Registration Number: 17653',
    'Period Covered: 09/30/2026 through 01/01/2026',
    'Received by the Board October 10, 2026',
  ].join(' ');
  assert.equal(parseCfbReportPdfAvailability(reference, text), null);
});

test('parses legacy CFB committee registration header from historical reports', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2022,
    reportName: 'Pre-General Report',
    year: '22',
    type: 'pcc',
    period: 'E',
    se: '0',
    registrationNumber: '15677',
    amendment: 0,
  };
  const text = [
    'Report of Receipts and Expenditures for Principal Campaign Committee',
    'Period Covered: 1/1/2022 through 10/24/2022',
    'Hortman, Melissa A House Dist.34B Committee 15677',
    'Registration number: Committee name: Candidate name:',
    'Received by the Board October 31, 2022',
  ].join(' ');
  const proof = parseCfbReportPdfAvailability(reference, text);
  assert.ok(proof);
  assert.equal(proof.filedOn, '2022-10-31');
  assert.equal(proof.window.coverageStartOn, '2022-01-01');
  assert.equal(proof.window.coverageEndOn, '2022-10-24');
  assert.equal(proof.window.availableOn, '2022-11-01');
});

test('parses legacy CFB candidate header when PDF text places registration before its label', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2022,
    reportName: '2021 Year-End Report',
    year: '21',
    type: 'pcc',
    period: 'YE',
    se: '0',
    registrationNumber: '18443',
    amendment: 0,
  };
  const text = [
    'Report of Receipts and Expenditures for Principal Campaign Committee',
    'Period Covered: 1/1/2021 through 12/31/2021',
    'Erin Murphy for Senate 18443 Murphy, Erin Senate District: 64',
    'Manning, Schyler Committee Information: St Paul MN 55116',
    'Registration number: Committee name: Candidate name: Office and District:',
    'Received by the Board January 28, 2022',
  ].join(' ');
  const proof = parseCfbReportPdfAvailability(reference, text);
  assert.ok(proof);
  assert.equal(proof.filedOn, '2022-01-28');
  assert.equal(proof.window.coverageStartOn, '2021-01-01');
  assert.equal(proof.window.coverageEndOn, '2021-12-31');
  assert.equal(proof.window.availableOn, '2022-01-29');
});

test('legacy CFB candidate header fallback requires the exact viewer registration near the label', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2022,
    reportName: '2021 Year-End Report',
    year: '21',
    type: 'pcc',
    period: 'YE',
    se: '0',
    registrationNumber: '18443',
    amendment: 0,
  };
  const text = [
    'Report of Receipts and Expenditures for Principal Campaign Committee',
    'Period Covered: 1/1/2021 through 12/31/2021',
    'Different Candidate for Senate 99999 Candidate, Different Senate District: 64',
    'Committee Information: St Paul MN 55116',
    'Registration number: Committee name: Candidate name: Office and District:',
    'Received by the Board January 28, 2022',
  ].join(' ');
  assert.equal(parseCfbReportPdfAvailability(reference, text), null);
});

test('legacy CFB committee registration fallback must match the report reference', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2022,
    reportName: 'Pre-General Report',
    year: '22',
    type: 'pcc',
    period: 'E',
    se: '0',
    registrationNumber: '15677',
    amendment: 0,
  };
  const text = [
    'Period Covered: 1/1/2022 through 10/24/2022',
    'Example Candidate Committee 99999',
    'Received by the Board October 31, 2022',
  ].join(' ');
  assert.equal(parseCfbReportPdfAvailability(reference, text), null);
});

test('finance row mapping requires the report to demonstrate the specific row', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2026,
    reportName: 'September Report',
    year: '26',
    type: 'pcc',
    period: 'D',
    se: '0',
    registrationNumber: '17653',
    amendment: 0,
  };
  const reportText = [
    'Registration Number: 17653',
    'Period Covered: 01/01/2026 through 09/15/2026',
    'Received by the Board September 22, 2026',
    '08/15/2026 Example Donor 500.00',
  ].join(' ');
  const proof = parseCfbReportPdfAvailability(reference, reportText);
  assert.ok(proof);

  const row = {
    registrationNumber: '17653',
    transactionDate: '2026-08-15',
    kind: 'contribution',
    amount: 500,
    contributor: 'Example Donor',
  };
  assert.equal(cfbReportTextDemonstratesFinanceRow(row, reportText), true);
  const match = firstProvenCfbFinanceAvailability(row, [{ proof, text: reportText }]);
  assert.ok(match);
  assert.equal(match.window.availableOn, '2026-09-23');

  assert.equal(cfbReportTextDemonstratesFinanceRow({
    ...row,
    contributor: 'Different Donor',
  }, reportText), false);
  assert.equal(firstProvenCfbFinanceAvailability({
    ...row,
    contributor: 'Different Donor',
  }, [{ proof, text: reportText }]), null);
});

test('finance row mapping accepts exact legacy numeric date spellings', () => {
  const row = {
    transactionDate: '2021-08-05',
    kind: 'contribution',
    amount: 500,
    contributor: 'Example Donor',
  };
  for (const date of ['08/05/2021', '8/5/2021', '08/05/21', '8/5/21']) {
    assert.equal(cfbReportTextDemonstratesFinanceRow(
      row,
      date + ' Example Donor 500.00',
    ), true, date);
  }
  assert.equal(cfbReportTextDemonstratesFinanceRow(
    row,
    '08/06/21 Example Donor 500.00',
  ), false);
  assert.equal(cfbReportTextDemonstratesFinanceRow(
    { ...row, transactionDate: '2021-01-05' },
    '11/5/21 Example Donor 500.00',
  ), false, 'short-year date tokens must not match inside a different numeric date');
});

test('finance row mapping fails closed outside the report coverage window', () => {
  const reference: CfbReportViewerReference = {
    filingYear: 2026,
    reportName: 'September Report',
    year: '26',
    type: 'pcc',
    period: 'D',
    se: '0',
    registrationNumber: '17653',
    amendment: 0,
  };
  const reportText = [
    'Registration Number: 17653',
    'Period Covered: 01/01/2026 through 09/15/2026',
    'Received by the Board September 22, 2026',
    '10/01/2026 Example Donor 500.00',
  ].join(' ');
  const proof = parseCfbReportPdfAvailability(reference, reportText);
  assert.ok(proof);
  const match = firstProvenCfbFinanceAvailability({
    registrationNumber: '17653',
    transactionDate: '2026-10-01',
    kind: 'contribution',
    amount: 500,
    contributor: 'Example Donor',
  }, [{ proof, text: reportText }]);
  assert.equal(match, null);
});
