import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCfbIndependentExpenditureCsv,sessionForIndependentExpenditureYear } from '../src/evidence/cfb-independent-expenditure-history.js';
import { buildCfbReportDisclosureProof,cfbElectronicReportAvailableOn } from '../src/evidence/cfb-report-availability.js';

test('parses granular independent expenditure records',()=>{
  const csv=[
    'Year,Date,Spender,Spender Reg Num,Affected Comte Name,Affected Cmte Reg Num,For /Against,Amount,Unpaid amount',
    '2024,7/20/2024,Example PAC,40001,"Doe, Jane House Committee",19001,For,1200.50,25.00',
  ].join('\n');
  const rows=parseCfbIndependentExpenditureCsv(csv,{fromYear:2021,toYear:2026});
  assert.equal(rows.length,1);
  assert.equal(rows[0].candidateName,'Jane Doe');
  assert.equal(rows[0].chamber,'house');
  assert.equal(rows[0].direction,'for');
  assert.equal(rows[0].totalAmount,1225.5);
  assert.equal(rows[0].transactionDate,'2024-07-20');
  assert.equal(sessionForIndependentExpenditureYear(2024),'2023-2024');
});

test('CFB report availability requires filing date and publishes next day',()=>{
  assert.equal(cfbElectronicReportAvailableOn('2024-07-29'),'2024-07-30');
  const proof=buildCfbReportDisclosureProof({
    registrationNumber:'19001',reportName:'2024 Pre-Primary',filedOn:'2024-07-29',
    proofUrl:'https://cfb.mn.gov/example',
  });
  assert.equal(proof.availableOn,'2024-07-30');
  assert.equal(proof.proofKind,'cfb_report_filing');
});
