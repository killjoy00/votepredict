import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCfbIndependentExpenditureCsv,sessionForIndependentExpenditureYear } from '../src/evidence/cfb-independent-expenditure-history.js';
import {
  CFB_SPECIFIC_LOBBYING_SUBJECT_FIRST_REPORT_YEAR,
  buildCfbLargeContributionNoticeProof,
  buildCfbLobbyistActivityDisclosureProof,
  buildCfbReportDisclosureProof,
  cfbElectronicReportAvailableOn,
} from '../src/evidence/cfb-report-availability.js';

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

test('CFB report availability rejects impossible calendar dates',()=>{
  assert.throws(()=>cfbElectronicReportAvailableOn('2024-02-30'),/Invalid CFB filing date/);
});

test('large-contribution notice proof requires separately proven filing and publication dates',()=>{
  const proof=buildCfbLargeContributionNoticeProof({
    registrationNumber:'40001',
    filedOn:'2024-07-22',
    publishedOn:'2024-07-22',
    proofUrl:'https://cfb.mn.gov/notice/40001',
  });
  assert.equal(proof.filedOn,'2024-07-22');
  assert.equal(proof.availableOn,'2024-07-22');
  assert.equal(proof.proofKind,'cfb_large_contribution_notice');
});

test('large-contribution notice proof fails closed if only an event/notice date is supplied',()=>{
  assert.throws(()=>buildCfbLargeContributionNoticeProof({
    registrationNumber:'40001',
    noticeDate:'2024-07-20',
    proofUrl:'https://cfb.mn.gov/notice/40001',
  } as never),/CFB notice filing date must be YYYY-MM-DD/);
});

test('large-contribution notice publication cannot predate filing',()=>{
  assert.throws(()=>buildCfbLargeContributionNoticeProof({
    registrationNumber:'40001',
    filedOn:'2024-07-22',
    publishedOn:'2024-07-21',
    proofUrl:'https://cfb.mn.gov/notice/40001',
  }),/cannot precede filing date/);
});

test('specific lobbying subject history begins with 2024 activity reports',()=>{
  assert.equal(CFB_SPECIFIC_LOBBYING_SUBJECT_FIRST_REPORT_YEAR,2024);
});

test('lobbyist activity proof requires separately proven filing and publication dates',()=>{
  const proof=buildCfbLobbyistActivityDisclosureProof({
    registrationNumber:'1234',
    reportName:'2024 Jan-May lobbyist activity report',
    filedOn:'2024-06-14',
    publishedOn:'2024-06-18',
    proofUrl:'https://register.cfb.mn.gov/example/lobbyist-report',
  });
  assert.equal(proof.filedOn,'2024-06-14');
  assert.equal(proof.availableOn,'2024-06-18');
  assert.equal(proof.proofKind,'cfb_lobbyist_activity_report');
});

test('lobbyist activity proof fails closed when only report/activity timing is supplied',()=>{
  assert.throws(()=>buildCfbLobbyistActivityDisclosureProof({
    registrationNumber:'1234',
    reportName:'2024 Jan-May lobbyist activity report',
    reportPeriodEnd:'2024-05-31',
    dueOn:'2024-06-17',
    proofUrl:'https://register.cfb.mn.gov/example/lobbyist-report',
  } as never),/CFB lobbyist report filing date must be YYYY-MM-DD/);
});

test('lobbyist activity publication cannot predate filing',()=>{
  assert.throws(()=>buildCfbLobbyistActivityDisclosureProof({
    registrationNumber:'1234',
    reportName:'2024 Jan-May lobbyist activity report',
    filedOn:'2024-06-18',
    publishedOn:'2024-06-17',
    proofUrl:'https://register.cfb.mn.gov/example/lobbyist-report',
  }),/cannot precede filing date/);
});
