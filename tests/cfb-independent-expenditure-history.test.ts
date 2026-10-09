import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCfbIndependentExpenditureCsv,sessionForIndependentExpenditureYear } from '../src/evidence/cfb-independent-expenditure-history.js';
import {
  CFB_SPECIFIC_LOBBYING_SUBJECT_FIRST_REPORT_YEAR,
  buildCfbLargeContributionNoticeProof,
  buildCfbLobbyistActivityDisclosureProof,
  buildCfbPublicDisclosureProof,
  buildCfbReportDisclosureProof,
  cfbElectronicReportAvailableOn,
  firstCfbReportAvailabilityForTransaction,
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
  assert.equal(rows[0].disclosedOn,null);
  assert.equal(rows[0].filedOn,null);
  assert.equal(sessionForIndependentExpenditureYear(2024),'2023-2024');
});

test('parses official CFB disclosure timing separately from transaction timing',()=>{
  const csv=[
    'Year,Date,Report Name,Filed Date,Report Due Date,Disclosure Date,Spender,Spender Reg Num,Affected Comte Name,Affected Cmte Reg Num,For /Against,Amount,Unpaid amount',
    '2024,7/20/2024,2024 Pre-Primary,7/29/2024,7/29/2024,7/30/2024,Example PAC,40001,"Doe, Jane House Committee",19001,For,1200.50,25.00',
  ].join('\n');
  const rows=parseCfbIndependentExpenditureCsv(csv,{fromYear:2021,toYear:2026});
  assert.equal(rows.length,1);
  assert.equal(rows[0].transactionDate,'2024-07-20');
  assert.equal(rows[0].reportName,'2024 Pre-Primary');
  assert.equal(rows[0].filedOn,'2024-07-29');
  assert.equal(rows[0].dueOn,'2024-07-29');
  assert.equal(rows[0].disclosedOn,'2024-07-30');
});


test('CFB ordinary reports cannot become public before 8 AM after the DUE date',()=>{
  assert.equal(cfbElectronicReportAvailableOn('2024-07-25','2024-07-29'),'2024-07-30');
  assert.equal(cfbElectronicReportAvailableOn('2024-07-29','2024-07-29'),'2024-07-30');
  assert.equal(cfbElectronicReportAvailableOn('2024-08-02','2024-07-29'),'2024-08-03');
  assert.equal(cfbElectronicReportAvailableOn('2024-02-28','2024-02-29'),'2024-03-01');
  const proof=buildCfbReportDisclosureProof({
    registrationNumber:'19001',reportName:'2024 Pre-Primary',
    filedOn:'2024-07-25',dueOn:'2024-07-29',
    proofUrl:'https://cfb.mn.gov/example',
  });
  assert.equal(proof.availableOn,'2024-07-30');
  assert.equal(proof.filedOn,'2024-07-25');
  assert.equal(proof.dueOn,'2024-07-29');
  assert.equal(proof.statutoryReleaseAtLocal,'2024-07-30T08:00:00[America/Chicago]');
  assert.equal(proof.proofKind,'cfb_report_filing');
  assert.throws(()=>buildCfbReportDisclosureProof({
    registrationNumber:'19001',reportName:'2024 Pre-Primary',filedOn:'2024-07-25',
    proofUrl:'https://cfb.mn.gov/example',
  } as never),/CFB report due date must be YYYY-MM-DD/);
});

test('official CFB disclosure date is sufficient without an exact filing timestamp',()=>{
  const proof=buildCfbPublicDisclosureProof({
    registrationNumber:'40001',
    reportName:'2024 Pre-Primary',
    disclosedOn:'2024-07-30',
    proofUrl:'https://register.cfb.mn.gov/reports/example',
  });
  assert.equal(proof.disclosedOn,'2024-07-30');
  assert.equal(proof.availableOn,'2024-07-30');
  assert.equal(proof.proofKind,'cfb_public_disclosure');
});


test('transaction becomes available on the first covering disclosed report',()=>{
  const report=firstCfbReportAvailabilityForTransaction({
    registrationNumber:'19001',
    occurredOn:'2024-10-01',
  },[
    {
      registrationNumber:'19001',
      reportName:'2024 Pre-General',
      coverageStartOn:'2024-01-01',
      coverageEndOn:'2024-10-19',
      availableOn:'2024-10-27',
      proofUrl:'https://register.cfb.mn.gov/reports/pre-general',
      proofKind:'cfb_public_disclosure',
    },
    {
      registrationNumber:'19001',
      reportName:'2024 Year-End',
      coverageStartOn:'2024-01-01',
      coverageEndOn:'2024-12-31',
      availableOn:'2025-01-30',
      proofUrl:'https://register.cfb.mn.gov/reports/year-end',
      proofKind:'cfb_public_disclosure',
    },
  ]);
  assert.equal(report?.reportName,'2024 Pre-General');
  assert.equal(report?.availableOn,'2024-10-27');
});

test('october donation disclosed by year-end report is available in january, not october',()=>{
  const report=firstCfbReportAvailabilityForTransaction({
    registrationNumber:'19001',
    occurredOn:'2024-10-25',
  },[
    {
      registrationNumber:'19001',
      reportName:'2024 Pre-General',
      coverageStartOn:'2024-01-01',
      coverageEndOn:'2024-10-19',
      availableOn:'2024-10-27',
      proofUrl:'https://register.cfb.mn.gov/reports/pre-general',
      proofKind:'cfb_public_disclosure',
    },
    {
      registrationNumber:'19001',
      reportName:'2024 Year-End',
      coverageStartOn:'2024-01-01',
      coverageEndOn:'2024-12-31',
      availableOn:'2025-01-30',
      proofUrl:'https://register.cfb.mn.gov/reports/year-end',
      proofKind:'cfb_public_disclosure',
    },
  ]);
  assert.equal(report?.availableOn,'2025-01-30');
});

test('report mapper fails closed when no proven report covers the transaction',()=>{
  const report=firstCfbReportAvailabilityForTransaction({
    registrationNumber:'19001',
    occurredOn:'2024-10-25',
  },[
    {
      registrationNumber:'19001',
      reportName:'2024 Pre-General',
      coverageStartOn:'2024-01-01',
      coverageEndOn:'2024-10-19',
      availableOn:'2024-10-27',
      proofUrl:'https://register.cfb.mn.gov/reports/pre-general',
      proofKind:'cfb_public_disclosure',
    },
  ]);
  assert.equal(report,null);
});

test('CFB disclosure proofs require an official CFB provenance URL',()=>{
  assert.throws(()=>buildCfbReportDisclosureProof({
    registrationNumber:'19001',
    reportName:'2024 Pre-Primary',
    filedOn:'2024-07-29',
    dueOn:'2024-07-29',
    proofUrl:'https://example.com/cfb-report',
  }),/official https CFB URL/);
  assert.throws(()=>buildCfbLargeContributionNoticeProof({
    registrationNumber:'40001',
    filedOn:'2024-07-22',
    publishedOn:'2024-07-22',
    proofUrl:'https://example.com/notice/40001',
  }),/official https CFB URL/);
  assert.throws(()=>buildCfbLobbyistActivityDisclosureProof({
    registrationNumber:'1234',
    reportName:'2024 Jan-May lobbyist activity report',
    filedOn:'2024-06-14',
    publishedOn:'2024-06-18',
    proofUrl:'https://example.com/lobbyist-report',
  }),/official https CFB URL/);
});

test('CFB report availability rejects impossible calendar dates',()=>{
  assert.throws(()=>cfbElectronicReportAvailableOn('2024-02-30','2024-07-29'),/Invalid CFB filing date/);
  assert.throws(()=>cfbElectronicReportAvailableOn('2024-07-25','2024-02-30'),/Invalid CFB report due date/);
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

test('filing-derived report windows require independent due-date proof and cannot predate the bound',()=>{
  const base={
    registrationNumber:'19001',
    reportName:'2024 Pre-Primary',
    coverageStartOn:'2024-01-01',
    coverageEndOn:'2024-07-20',
    proofUrl:'https://register.cfb.mn.gov/report/19001',
    proofKind:'cfb_report_filing' as const,
  };
  const tx={registrationNumber:'19001',occurredOn:'2024-07-01'};
  assert.equal(firstCfbReportAvailabilityForTransaction(tx,[{
    ...base,availableOn:'2024-07-26',filedOn:'2024-07-25',
  }]),null,'legacy filing-only window is not an eligibility proof');
  assert.equal(firstCfbReportAvailabilityForTransaction(tx,[{
    ...base,availableOn:'2024-07-26',filedOn:'2024-07-25',dueOn:'2024-07-29',
  }]),null,'an early filing cannot authorize pre-due public availability');
  assert.equal(firstCfbReportAvailabilityForTransaction(tx,[{
    ...base,availableOn:'2024-07-30',filedOn:'2024-07-25',dueOn:'2024-07-29',
  }])?.availableOn,'2024-07-30');
});
