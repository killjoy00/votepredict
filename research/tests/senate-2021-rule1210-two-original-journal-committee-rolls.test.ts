import assert from 'node:assert/strict';
import test from 'node:test';
import {
 ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS,
 inspectSynthetic2021SenateJournalCommitteeRoll,
 inspectAuthentic2021SenateJournalCommitteeRoll
} from '../../src/evidence/senate-2021-rule1210-two-original-journal-committee-rolls.js';

const fakeYea173=['Alpha','Bravo','Charlie','Delta','Echo'] as const;
const fakeNay173=['Foxtrot','Golf','Hotel','India'] as const;
const fakeYea1470=['Alpha','Bravo','Charlie','Delta'] as const;
const fakeNay1470=['Echo','Foxtrot','Golf'] as const;
function source(bill:'SF173'|'SF1470'){
 const sf173=bill==='SF173';
 const reportDate=sf173?'MONDAY, FEBRUARY 8, 2021':'THURSDAY, MARCH 4, 2021';
 const yes=sf173?fakeYea173:fakeYea1470;
 const no=sf173?fakeNay173:fakeNay1470;
 const nums=sf173?'173':'1470';
 const names=(v:readonly string[])=>v.slice(0,-1).join(', ')+', and '+v.at(-1);
 const head=('Journal printed introductory senator floor and other business. ').repeat(24);
 return 'JOURNAL OF THE SENATE '+reportDate+' '+head+
  'REPORT OF VOTE IN COMMITTEE Pursuant to Rule 12.10, upon the request of three members, '+
  'a roll call was taken on the motion that S.F. No. '+nums+', '+
  (sf173?'':'as amended, ')+'be recommended to pass and be re-referred. '+
  'There were yeas '+yes.length+' and nays '+no.length+', as follows: '+
  'Those who voted in the affirmative were: Senators '+names(yes)+'. '+
  'Those who voted in the negative were: Senators '+names(no)+'. '+
  'The motion prevailed. '+
  'The Senate floor then called a 65 to 2 floor roll on some different procedural matter. '+
  ('Other journal sections unrelated to this committee motion. ').repeat(20);
}
const mock=(bill:'SF173'|'SF1470',value=source(bill))=>
 bill==='SF173'?
  inspectSynthetic2021SenateJournalCommitteeRoll(value,bill,[...fakeYea173],[...fakeNay173]):
  inspectSynthetic2021SenateJournalCommitteeRoll(value,bill,[...fakeYea1470],[...fakeNay1470]);
test('two separate Senate Journal publication dates are NOT original committee meeting dates',()=>{
 const a=ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS;
 assert.equal(a.length,2);
 assert.deepEqual(a.map(s=>[s.bill,s.reportDate,s.committee,s.journalPage]),
  [['SF173','2021-02-08','Transportation Finance and Policy',272],
   ['SF1470','2021-03-04','Housing Finance and Policy',666]]);
 assert.ok(a.every(s=>s.document.startsWith('https://www.senate.mn/journals/2021-2022/')));
 assert.ok(a.every(s=>s.revisor.startsWith('https://www.revisor.mn.gov/bills/92/2021')));
});
test('SF173 Rule12.10 original committee named choices are 5 yes 4 no not Senate floor',()=>{
 const a=mock('SF173');
 assert.equal(a.bill,'SF173');
 assert.equal(a.senateJournalReportDate,'2021-02-08');
 assert.deepEqual([a.yes,a.no,a.absentPrinted],[5,4,null]);
 assert.equal(a.sourceMotionReportedPassed,true);
 assert.equal(a.exactBillSpecificRollFoundOnce,true);
 assert.equal(a.senateFloorRollVoteExcluded,true);
 assert.equal(a.actualCommitteeHearingDateIndependentlyEstablished,false);
 assert.equal(a.officialLRL2021PrintedCommitteeMinutesCompared,false);
 assert.equal(a.sourceSideMemberHashesOnly.yea.length,5);
 assert.equal(a.sourceSideMemberHashesOnly.nay.length,4);
 assert.equal(a.noStatewide2021To2025RecordedVoteDenominatorCertified,true);
 assert.equal(a.noMemberVoteImportOrPrivateDatabaseRead,true);
 assert.ok(a.originalResultTextOffset>a.originalSourceMotionTextOffset);
});
test('SF1470 as amended Rule12.10 original committee 4/3 names remain separate',()=>{
 const a=mock('SF1470');
 assert.deepEqual([a.bill,a.yes,a.no,a.absentPrinted],['SF1470',4,3,null]);
 assert.equal(a.originalReportedMotion,'As amended recommend pass and re-refer');
 assert.equal(a.printedJournalPage,666);
 assert.equal(a.selectedOnlyOnRule1210ThreeMemberRequest,true);
 assert.equal(a.senateFloorRollVoteExcluded,true);
});
test('never certify a fictional Senate Journal mock with real historical identity roster',()=>{
 assert.throws(()=>inspectAuthentic2021SenateJournalCommitteeRoll(source('SF173'),'SF173'),
  /does not match printed committee roster/);
 assert.throws(()=>inspectAuthentic2021SenateJournalCommitteeRoll(source('SF1470'),'SF1470'),
  /does not match printed committee roster/);
 assert.throws(()=>inspectSynthetic2021SenateJournalCommitteeRoll(source('SF173'),'SF173',
  ['Coleman',...fakeYea173.slice(1)],[...fakeNay173]),/purely fictional/);
});
test('reject floor-only prose, duplicate committee Roll12.10 paragraph or wrong bill',()=>{
 for(const bill of ['SF173','SF1470'] as const){
  assert.throws(()=>mock(bill,source(bill).replace('REPORT OF VOTE IN COMMITTEE','SENATE FLOOR ROLL')),/source type absent|not in journal committee-vote report/);
  assert.throws(()=>mock(bill,source(bill).replace('Pursuant to Rule 12.10,','Pursuant to Senate Floor Order,')),/not unique/);
  assert.throws(()=>mock(bill,source(bill).replace('The motion prevailed. ','The motion failed. ')),/report.*missing/);
  assert.throws(()=>mock(bill,source(bill)+' '+source(bill)),/not unique/);
 }
});
test('reject mutated named sides, invalid tally, absent report and incorrect journal date',()=>{
 const s=source('SF173');
 for(const x of [
  s.replace('Senators Alpha, Bravo, Charlie','Senators Alpha, Alpha, Charlie'),
  s.replace('Senators Foxtrot, Golf, Hotel','Senators Foxtrot, Golf, Unlisted'),
  s.replace('There were yeas 5 and nays 4','There were yeas 4 and nays 5'),
  s.replace('FEBRUARY 8, 2021','FEBRUARY 9, 2021'),
  s.replace('a roll call was taken','an informational committee discussion was held')
 ])assert.throws(()=>mock('SF173',x));
});
