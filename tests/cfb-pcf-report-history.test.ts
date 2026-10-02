import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cfbPcfReportsTabForm,
  cfbPcfSegmentEndYear,
  parseCfbPcfReportsTabResponse,
} from '../src/evidence/cfb-pcf-report-history.js';

test('maps IE years to the governing CFB two-year segment',()=>{
  assert.equal(cfbPcfSegmentEndYear(2021),2022);
  assert.equal(cfbPcfSegmentEndYear(2022),2022);
  assert.equal(cfbPcfSegmentEndYear(2023),2024);
  assert.equal(cfbPcfSegmentEndYear(2024),2024);
  assert.equal(cfbPcfSegmentEndYear(2025),2026);
  assert.equal(cfbPcfSegmentEndYear(2026),2026);
  assert.equal(cfbPcfSegmentEndYear(2020),null);
});

test('builds the committee/fund reports-data form for a historical segment',()=>{
  const form=cfbPcfReportsTabForm('40712',2024);
  assert.equal(form.get('id'),'40712');
  assert.equal(form.get('year'),'2024');
  assert.equal(form.get('year_data[ElectionSegmentStartDate]'),'2023');
  assert.equal(form.get('year_data[ElectionSegmentEndDate]'),'2024');
  assert.equal(form.get('tabname'),'reports_data');
});

test('parses only references for the requested committee/fund registration and segment',()=>{
  const payload={
    tabcontent:[
      '<a title="2023 Year-End Report" href="javascript:viewPDF(\'23\',\'pcf\',\'YE\',\'0\',\'40712\',0)">2023</a>',
      '<a title="2024 Pre-General Report" href="javascript:viewPDF(\'24\',\'pcf\',\'E\',\'0\',\'40712\',0)">2024</a>',
      '<a title="2022 Year-End Report" href="javascript:viewPDF(\'22\',\'pcf\',\'YE\',\'0\',\'40712\',0)">old</a>',
      '<a title="Other filer" href="javascript:viewPDF(\'24\',\'pcf\',\'E\',\'0\',\'99999\',0)">other</a>',
    ].join(' '),
  };
  const refs=parseCfbPcfReportsTabResponse(payload,'40712',2024);
  assert.deepEqual(refs.map(row=>[row.year,row.registrationNumber,row.reportName]),[
    ['23','40712','2023 Year-End Report'],
    ['24','40712','2024 Pre-General Report'],
  ]);
});
