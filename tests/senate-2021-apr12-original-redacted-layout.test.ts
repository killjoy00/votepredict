import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOriginalApril12SourceLayout} from '../src/evidence/senate-2021-apr12-original-committee-redacted-layout.js';
function make(){
 return 'JOURNAL OF THE SENATE MONDAY, APRIL 12, 2021 '+('Unrelated context and journal entries. ').repeat(270)+
  'Senator PretendReporter from the Committee on Transportation Finance and Policy, S.F. No. 1159: '+
  'REPORT OF VOTE IN COMMITTEE Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on '+
  'the Johnson amendment to S.F. No. 1159. There were yeas 4 and nays 3, as follows: '+
  '[36TH DAY JOURNAL OF THE SENATE 2086 Those who voted in the affirmative were: '+
  'Senators FictionalAlpha, FictionalBravo, FictionalCharlie and FictionalDelta. '+
  'Those who voted in the negative were: Senators FictionalEcho, FictionalFoxtrot, FictionalGolf. '+
  'The amendment was not adopted. '+('Other entries. ').repeat(30)+
  'Senator PretendReporter from the Committee on Judiciary and Public Safety Finance and Policy, S.F. No. 970: '+
  'REPORT OF VOTE IN COMMITTEE Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on '+
  'the Pappas amendment to S.F. No. 970. There were yeas 4 and nays 5, as follows: '+
  '[36TH DAY JOURNAL OF THE SENATE 2147 Those who voted in the affirmative were: '+
  'Senators FictionalHotel, FictionalIndia, FictionalJuliet, FictionalKilo. '+
  'Those who voted in the negative were: Senators FictionalLima, FictionalMike, FictionalNovember, FictionalOscar and FictionalPapa. '+
  'The amendment was not adopted. '+('Unrelated postscript. ').repeat(20);
}
test('original two committee Rule12.10 leads have report offsets, side names are always redacted',()=>{
 const result=inspectOriginalApril12SourceLayout(make());
 assert.equal(result.journalPublicationDay,'2021-04-12');
 assert.equal(result.namedSectionAnchorsInWholeOriginalJournal,2);
 assert.deepEqual(result.indexedRule1210Candidates.map(x=>x.bill),['SF1159','SF970']);
 for(const bill of result.indexedRule1210Candidates){
  assert.equal(bill.exactIndexedRule1210BillMotionCount,1);
  assert.equal(bill.matchingRule1210Candidates.length,1);
  assert.equal(bill.printedJournalPageHeaderFound,true);
  assert.equal(bill.matchingRule1210Candidates[0]!.printedTallyCandidates.length,1);
  assert.match(bill.matchingRule1210Candidates[0]!.originalMotionContextSHA256,/^[a-f0-9]{64}$/);
  const rows=JSON.stringify(bill.matchingRule1210Candidates);
  assert.doesNotMatch(rows,/Fictional|PretendReporter|Pappas|Johnson/);
  assert.match(rows,/\[REDACTED\]/);
  assert.equal(bill.thisLayoutDiagnosticDoesNotCertifyNamedRolls,true);
 }
 assert.equal(result.noOriginalMemberBySideNamesEmitted,true);
 assert.equal(result.noMeetingDateOrSameDayHistoricalCutoffInferred,true);
});
test('wrong original issue day or truncated/duplicated source cannot be represented as certified rolls',()=>{
 assert.throws(()=>inspectOriginalApril12SourceLayout(make().replace('MONDAY, APRIL 12, 2021',
  'TUESDAY, APRIL 13, 2021')),/Wrong original/);
 const input=make().replace('Pursuant to Rule 12.10','Pursuant to Floor Rule');
 const data=inspectOriginalApril12SourceLayout(input);
 assert.equal(data.indexedRule1210Candidates[0]!.exactIndexedRule1210BillMotionCount,0);
 assert.equal(data.noOriginalMemberBySideNamesEmitted,true);
 assert.equal(data.issue864RemainsOpen,true);
});

test('one indexed committee motion cannot inherit the next bill different motion roll tally',()=>{
 const changed=make().replace('There were yeas 4 and nays 3, as follows:',
  'A voice vote was recorded here, no named roll printed:');
 const result=inspectOriginalApril12SourceLayout(changed);
 assert.equal(result.indexedRule1210Candidates[0]!.matchingRule1210Candidates[0]!.printedTallyCandidates.length,0);
 assert.equal(result.indexedRule1210Candidates[1]!.matchingRule1210Candidates[0]!.printedTallyCandidates.length,1);
 assert.equal(result.noOriginalMemberBySideNamesEmitted,true);
});
