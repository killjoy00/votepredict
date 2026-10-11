import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APR08_COMMITTEE_ACTION_CROSSCHECK as crosscheck,
  inspectOriginalApril08BillLog
} from '../src/evidence/senate-2021-apr08-rule1210-hearing-action-crosscheck.js';
import {APR12_THREE_STRICT_ORIGINAL as journal} from
  '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

type Spec=(typeof crosscheck.cases)[number];
const mockHtml=(spec:Spec,actionDay:string=spec.committeeActionDay,actionResult:string=spec.recordedResult)=>`
<html><head><title>Original Senate Committee Bill Log</title></head>
<body>
<h1>Committee on ${spec.committee}</h1>
<p>Other bill heading S.F.0001: DATE UNOFFICIAL STATUS FOR SF0001
 04/08/2021 Meeting scheduled for eleven Discussion only</p>
<section><h2>S.F.${spec.bill.slice(2).padStart(4,'0')}: (AUTHORS: Fictional Senator)</h2>
<p>Historical committee bill discussion and action ledger.</p>
<div>DATE&nbsp; UNOFFICIAL STATUS FOR SF${spec.bill.slice(2).padStart(4,'0')}</div>
<p>${spec.discussionDay} Meeting scheduled for thirteen in Room Livestream YouTube</p>
<p>Discussion only</p>
<p>${actionDay} Meeting scheduled for thirteen in Room Livestream YouTube</p>
<p>${actionResult}</p>
</section>
<section><h2>S.F.9999:</h2><p>04/08/2021 Motion prevailed on unrelated bill</p></section>
</body></html>`;

test('separate April 8 action records for TWO bills, not motion-level vote-date proof',()=>{
 const parsed=crosscheck.cases.map(spec=>inspectOriginalApril08BillLog(mockHtml(spec),spec));
 assert.deepEqual(parsed.map(r=>r.bill),['SF1159','SF970']);
 assert.deepEqual(parsed.map(r=>r.originallyPrintedCommitteeBillActionDay),
  ['04/08/2021','04/08/2021']);
 assert.deepEqual(parsed.map(r=>r.originallyPrintedDiscussionDay),
  ['04/06/2021','04/07/2021']);
 assert.deepEqual(parsed.map(r=>r.originalJournalSeparateAmendmentMovers),
  [['Dibble','McEwen'],['Pappas']]);
 assert.equal(parsed.reduce((n,r)=>n+r.originalJournalSeparateAmendments,0),3);
 for(const r of parsed){
  assert.equal(r.candidateHearingDay,'2021-04-08');
  assert.equal(r.journalReportDay,'2021-04-12');
  assert.equal(r.exactAmendmentMotionDayProvenByBillLog,false);
  assert.equal(r.verifiedMotionOccurredOn,null);
  assert.equal(r.independentlyProvenHistoricalPublicBy,null);
  assert.equal(r.archivedHearingAudioIdentifiedButNotListened,true);
  assert.equal(r.noProductionSourceOrMemberVoteReconciliation,true);
 }
});

test('only exact original bill-local official action text can establish an April 8 bill action',()=>{
 for(const spec of crosscheck.cases){
  assert.throws(()=>inspectOriginalApril08BillLog(
   mockHtml(spec,'04/12/2021'),spec),/action date identities/);
  assert.throws(()=>inspectOriginalApril08BillLog(
   mockHtml(spec,spec.committeeActionDay,'Discussion only'),spec),
   /committee action result/);
  assert.throws(()=>inspectOriginalApril08BillLog(
   mockHtml(spec).replace('Committee on '+spec.committee,
    'Committee on Unrelated Committee'),spec),/Wrong original Senate committee/);
  assert.throws(()=>inspectOriginalApril08BillLog(
   mockHtml(spec).replace('DATE&nbsp; UNOFFICIAL STATUS FOR SF'+spec.bill.slice(2).padStart(4,'0'),
    'DATE&nbsp; UNOFFICIAL STATUS FOR SF9998'),spec),/Target committee status/);
  assert.throws(()=>inspectOriginalApril08BillLog(
   mockHtml(spec).replace('DATE&nbsp; UNOFFICIAL STATUS FOR SF'+spec.bill.slice(2).padStart(4,'0'),
    'DATE&nbsp; UNOFFICIAL STATUS FOR SF'+spec.bill.slice(2).padStart(4,'0')+' 04/08/2021'),spec),
   /missing or nonunique/);
 }
});

test('the distinct Dibble/McEwen/Pappas strict Journal motions are not coalesced',()=>{
 assert.equal(journal.journalReportDay,'2021-04-12');
 assert.equal(journal.motions.length,3);
 assert.deepEqual(journal.motions.map(m=>[m.bill,m.mover]),
  [['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']]);
 const [a,b]=journal.motions;
 assert.notEqual(a.originalMotionNormalizedOffset,b.originalMotionNormalizedOffset);
 assert.equal(a.originalYeaNamesSHA256,b.originalYeaNamesSHA256);
 assert.equal(a.originalNayNamesSHA256,b.originalNayNamesSHA256);
 assert.notEqual(a.originalMotionNeighborhoodSHA256,b.originalMotionNeighborhoodSHA256);
 assert.equal(crosscheck.candidateHearingDay,'2021-04-08');
 assert.equal(crosscheck.journalReportDay,'2021-04-12');
 assert.equal(crosscheck.cases.length,2);
 assert.equal(crosscheck.cases[0]!.hearingAgenda.includes('6934'),true);
 assert.equal(crosscheck.cases[1]!.hearingAgenda.includes('6938'),true);
 assert.equal(crosscheck.cases[1]!.continuedHearingAgenda.includes('6939'),true);
});