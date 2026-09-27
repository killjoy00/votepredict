import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cfbCandidateReportsTabForm,
  cfbCandidateSegmentEndYear,
  parseCfbCandidateReportsTabResponse,
} from '../src/evidence/cfb-candidate-report-history.js';

test('maps finance years to official two-year candidate viewer segments', () => {
  assert.equal(cfbCandidateSegmentEndYear(2021), 2022);
  assert.equal(cfbCandidateSegmentEndYear(2022), 2022);
  assert.equal(cfbCandidateSegmentEndYear(2023), 2024);
  assert.equal(cfbCandidateSegmentEndYear(2024), 2024);
  assert.equal(cfbCandidateSegmentEndYear(2025), 2026);
  assert.equal(cfbCandidateSegmentEndYear(2026), 2026);
  assert.equal(cfbCandidateSegmentEndYear(2020), null);
});

test('builds the exact candidate reports_data tab form contract', () => {
  const form = cfbCandidateReportsTabForm('15677', 2024);
  assert.equal(form.get('id'), '15677');
  assert.equal(form.get('year'), '2024');
  assert.equal(form.get('year_data[ElectionSegmentEndDate]'), '2024');
  assert.equal(form.get('year_data[ElectionSegmentStartDate]'), '2023');
  assert.equal(form.get('tabname'), 'reports_data');
});

test('parses historical candidate tabcontent into report viewer references', () => {
  const response = {
    tabcontent:
      '<a title="Year-End Report" href="javascript:viewPDF(\'24\',\'pcc\',\'A\',\'0\',\'15677\',0)">Year-End Report</a>'
      + '<a title="Pre-General Report" href="javascript:viewPDF(\'24\',\'pcc\',\'C\',\'0\',\'15677\',0)">Pre-General Report</a>',
  };
  const refs = parseCfbCandidateReportsTabResponse(response, '15677', 2024);
  assert.equal(refs.length, 2);
  assert.deepEqual(
    refs.map(ref => [ref.reportName, ref.year, ref.type, ref.period, ref.registrationNumber]),
    [
      ['Pre-General Report', '24', 'pcc', 'C', '15677'],
      ['Year-End Report', '24', 'pcc', 'A', '15677'],
    ],
  );
});

test('historical candidate tab parser fails closed on wrong registration references', () => {
  const response = {
    tabcontent:
      '<a title="Year-End Report" href="javascript:viewPDF(\'24\',\'pcc\',\'A\',\'0\',\'99999\',0)">Year-End Report</a>',
  };
  assert.deepEqual(parseCfbCandidateReportsTabResponse(response, '15677', 2024), []);
});
