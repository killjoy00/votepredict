import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {financeRoster,parseFinanceRegistry,matchFinanceRoster,currentFinanceReference,selectCurrentFinanceReference,reviewFinanceSummary,selectFinancePilot,financeCollectionHistory,FINANCE_ROSTER_SHA} from '../src/evidence/2027-current-cfb-finance.js';
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


test('collection history excludes verified originals and specific reviewed holds, but not unmatched registry candidates',()=>{
 const members=Array.from({length:30},(_,i)=>({lrlId:String(i+1),seat:'house:'+String(i+1)+'A',name:'Example '+i,electionName:'Example '+i,cohort:'incoming' as const}));
 const common={session:'2027-2028',servingEligible:false,canonicalWriteAllowed:false,modelWeight:0};
 const identity=(i:number)=>({lrlId:members[i].lrlId,seat:members[i].seat,cohort:members[i].cohort,registrationNumber:'12345'});
 const report={sha:'a'.repeat(64),sourceVerified:true,value:{...common,...identity(0),schemaVersion:'2027-preseason-finance-report-review-v1',rosterSha256:FINANCE_ROSTER_SHA,rosterStatus:'projected_not_activation_verified',rawBodyRetained:true,reviewRequired:true,runId:'42:1',reference:ref,summary:{registrationNumber:'12345'},sourceReceipt:{bodySha256:'c'.repeat(64),bodyBytes:500}}};
 const failed={...identity(1),reason:'finance_http_404'},held={...identity(2),reason:'no_2026_pre_general_reference'};
 const event={sha:'b'.repeat(64),value:{...common,schemaVersion:'2027-preseason-finance-collection-v1',state:'committed',day:'2026-11-27',runId:'42:1',inventory:{rosterSha256:FINANCE_ROSTER_SHA,referenceGaps:[held],gaps:[{...identity(3),reason:'no_exact_name_and_district'}]},summary:{mode:'--archive',canonicalWrites:0,modelChanges:0,selected:{incoming:2,returning:0},verifiedReports:1,failures:1},failures:[failed]}};
 const h=financeCollectionHistory(members,[report],[event],'2026-11-28');
 assert.equal(h.archived.size,1);assert.deepEqual([...h.attempted],['1','2','3']);assert.equal(h.days.has('2026-11-27'),true);assert.equal(h.days.has('2026-11-28'),false);
 const next=selectFinancePilot(members.map(member=>({member})),h.attempted);
 assert.equal(next.length,12);assert.equal(next[0].member.lrlId,'4');assert.ok(next.every(x=>!h.attempted.has(x.member.lrlId)));
 assert.throws(()=>financeCollectionHistory(members,[{...report,sourceVerified:false}],[event],'2026-11-28'),/finance_history_report/);
 assert.throws(()=>financeCollectionHistory(members,[report],[],'2026-11-28'),/finance_history_unbound/);
 assert.throws(()=>financeCollectionHistory(members,[report],[event],'2026-11-26'),/finance_history_event/);
 assert.throws(()=>financeCollectionHistory(members,[report],[{...event,value:{...event.value,failures:[{...identity(0),reason:'duplicate'}]}}],'2026-11-28'),/finance_history_duplicate_attempt/);
 assert.throws(()=>financeCollectionHistory(members,[report],[{...event,value:{...event.value,summary:{...event.value.summary,verifiedReports:0}}}],'2026-11-28'),/finance_history_event_counts/);
});
