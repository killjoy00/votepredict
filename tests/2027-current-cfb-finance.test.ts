import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {financeRoster,parseFinanceRegistry,matchFinanceRoster,currentFinanceReference,selectCurrentFinanceReference,reviewFinanceSummary,selectFinancePilot} from '../src/evidence/2027-current-cfb-finance.js';
const ref={filingYear:2026,reportName:'2026 Pre-General Report',year:'26',type:'pcc',period:'PG',se:'0',registrationNumber:'12345',amendment:0};
test('registry requires exact projected full/election name, office and seat; ambiguity is held',()=>{
  const cols=['RegisteredEntityID','CandidateFullName','OfficeSoughtFullName','District','RegistrationDate','TerminationDate'];
  const member={lrlId:'1',seat:'house:3B',name:'Jane Example',electionName:'Jane Example',cohort:'incoming' as const};
  const row=['12345','Example, Jane','House','03B','2026-01-01 00:00:00.000',''];
  const p=parseFinanceRegistry({cols,data:{a:[row],b:[['23456','Example, Jane','Senate','3','2026-01-01','']]}});
  assert.equal(matchFinanceRoster([member],p.rows).matches[0].registration.registrationNumber,'12345');
  assert.equal(matchFinanceRoster([member],[...p.rows,{...p.rows[0],registrationNumber:'34567'}]).gaps[0].reason,'ambiguous_committee');
  assert.equal(matchFinanceRoster([{...member,seat:'house:4B'}],p.rows).matches.length,0);
  assert.throws(()=>parseFinanceRegistry({cols:cols.slice(0,-1),data:{a:[row]}}));
});
test('current list uses maximum explicitly indexed amendment of unique pre-general period',()=>{
 const link=(n:number,title='2026 Pre-General Report')=>`<a title="${title}" href="javascript:viewPDF('26','pcc','PG','0','12345',${n})">PDF</a>`;
 const html=link(0)+link(2);
 const raw={cols:['FilingYear','ReportType','RegisteredEntityID'],data:{a:[[2026,html,'12345']]}};
 assert.equal(currentFinanceReference(raw,'12345').reference?.amendment,2);
 assert.equal(currentFinanceReference(raw,'23456').reference,null);
});
test('exact report summary cells, dates and registration; no donor lines in output',()=>{
 const text=['Report of Receipts and Expenditures for Principal Campaign Committee','Registration Number: 12345','Period Covered: 01/01/2026 through 10/19/2026','Received by the Board October 26, 2026','Committee Transaction Summary','10 Total Receipts 100.00 20.00 120.00','19 Total Expenditures and Disbursements 50.00 20.00 70.00','20 Ending cash balance on 10/19/2026 50.00','21C Total outstanding balance of all loans 0.00','Schedule A1 donor fixture excluded'].join('\n');
 const r=reviewFinanceSummary(text,ref,'2026-11-27T04:00:00Z');
 assert.equal(r.totalReceiptsCents,12000);assert.equal(r.totalDisbursementsCents,7000);assert.equal(r.endingCashBalanceCents,5000);assert.equal(r.exactHistoricalPublicBy,null);
 assert.ok(!JSON.stringify(r).includes('donor'));
 assert.equal(reviewFinanceSummary(text.replace('120.00','999.00'),ref,'2026-11-27T04:00:00Z').totalReceiptsCents,null);
 assert.throws(()=>reviewFinanceSummary(text.replace('10/19/2026','10/18/2026'),ref,'2026-11-27T04:00:00Z'));
 assert.throws(()=>reviewFinanceSummary(text,{...ref,registrationNumber:'23456'},'2026-11-27T04:00:00Z'));
});
test('frozen 201 identities and balanced bounded pilot',()=>{
 const root='docs/evaluation/source-proof/';
 const members=financeRoster(readFileSync(root+'2027-preseason-roster-20261126.json','utf8'),JSON.parse(readFileSync(root+'2027-incoming-evidence-pilot-20261126-part1.json','utf8')));
 assert.equal(members.filter(m=>m.cohort==='incoming').length,51);
 assert.equal(members.filter(m=>m.cohort==='returning').length,150);
 const p=selectFinancePilot(members.map(member=>({member,reference:ref})));
 assert.equal(p.length,24);assert.equal(p.filter(x=>x.member.cohort==='incoming').length,12);
});

test('candidate viewer tab references use same exact period and version checks',()=>{
 const old={...ref,year:'25',filingYear:2026,reportName:'2025 Year-End'};
 const latest={...ref,amendment:3};
 assert.equal(selectCurrentFinanceReference([old,ref,latest],ref.registrationNumber).reference?.amendment,3);
 assert.equal(selectCurrentFinanceReference([{...ref,reportName:'2026 Year-End'},ref],ref.registrationNumber).reason,'later_or_final_report_requires_review');
});
