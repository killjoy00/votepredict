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
