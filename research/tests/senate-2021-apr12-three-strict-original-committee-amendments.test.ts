import test from 'node:test';
import assert from 'node:assert/strict';
import {
 APR12_THREE_STRICT_ORIGINAL as S,
 inspectFictionalThreeApril12CommitteeAmendments,
 verifyThreeOriginalApril12CommitteeAmendmentRolls
} from '../../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';
const YES=['FictionalAble','FictionalBravo','FictionalCedar','FictionalDelta'];
const NO=['FictionalEcho','FictionalFoxtrot','FictionalGolf','FictionalHotel','FictionalIndia','FictionalJuliet'];
const fixtures=[
 {mover:'FictionalMoverAlpha',bill:'SF1159' as const,yes:YES,no:NO},
 {mover:'FictionalMoverBeta',bill:'SF1159' as const,yes:YES,no:NO},
 {mover:'FictionalMoverGamma',bill:'SF970' as const,yes:YES.slice(0,3),no:NO}
];
function format(list:readonly string[]){
 return list.slice(0,-1).join(', ')+', and '+list[list.length-1]+'.';
}
function fictitiousJournal(){
 let txt='JOURNAL OF THE SENATE MONDAY, APRIL 12, 2021 '+
  ('Unrelated synthetic earlier edition material. ').repeat(245);
 for(let i=0;i<fixtures.length;i++){
  const row=fixtures[i]!,count=row.yes.length;
  if(i!==1)txt+=' REPORT OF VOTE IN COMMITTEE ';
  txt+='Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the '+
    row.mover+' amendment to S.F. No. '+row.bill.slice(2)+'. '+
    'There were yeas '+count+' and nays '+row.no.length+', as follows: '+
    'Those who voted in the affirmative were: Senators '+format(row.yes)+' '+
    'Those who voted in the negative were: Senators '+format(row.no)+' '+
    'The amendment was not adopted. ';
 }
 return txt+('Final fictional journal material. ').repeat(25);
}
const fake=(text=fictitiousJournal())=>inspectFictionalThreeApril12CommitteeAmendments(text,fixtures);
test('three distinct fictional committee amendments, identical SF1159 sides not deduplicated',()=>{
 const original=fictitiousJournal();
 const x=fake(original);
 assert.equal(x.independentlyPinnedExactOriginalCommitteeNamedRolls,0);
 assert.equal(x.distinctOriginalCommitteeAmendmentMotions.length,3);
 assert.deepEqual(x.distinctOriginalCommitteeAmendmentMotions.map(m=>m.bill),
  ['SF1159','SF1159','SF970']);
 assert.deepEqual(x.distinctOriginalCommitteeAmendmentMotions.map(m=>m.originalPrintedYea),[4,4,3]);
 assert.deepEqual(x.distinctOriginalCommitteeAmendmentMotions.map(m=>m.originalPrintedNay),[6,6,6]);
 assert.deepEqual(x.distinctOriginalCommitteeAmendmentMotions.map(m=>m.originalPrintedAbsent),[null,null,null]);
 assert.notEqual(x.distinctOriginalCommitteeAmendmentMotions[0]!.originalMotionNormalizedTextOffset,
  x.distinctOriginalCommitteeAmendmentMotions[1]!.originalMotionNormalizedTextOffset);
 assert.deepEqual(x.distinctOriginalCommitteeAmendmentMotions[0]!.originalIndividualSenatorSideSHA256Only,
  x.distinctOriginalCommitteeAmendmentMotions[1]!.originalIndividualSenatorSideSHA256Only);
 assert.equal(x.sameNameSidesOnSeparateBillsOrAmendmentsAreNotDuplicates,true);
 assert.equal(x.noPrivateStoredVotesReconciliation,true);
 assert.equal(x.issue864RemainsOpen,true);
 for(const m of x.distinctOriginalCommitteeAmendmentMotions){
  assert.equal(m.outcome,'amendment not adopted');
  assert.match(m.originalMotionNeighborhoodSHA256,/^[0-9a-f]{64}$/);
  assert.match(m.originalIndividualSenatorSideSHA256Only.yea,/^[0-9a-f]{64}$/);
  assert.match(m.originalIndividualSenatorSideSHA256Only.nay,/^[0-9a-f]{64}$/);
 }
 assert.doesNotMatch(JSON.stringify(x),/FictionalAble|FictionalEcho/);
});
test('fictitious source does not certify itself as the original Senate Journal',()=>{
 assert.throws(()=>verifyThreeOriginalApril12CommitteeAmendmentRolls(fictitiousJournal()),
  /SHA commitment mismatch/);
 assert.equal(S.originalPDFBytes,11063699);
 assert.equal(S.originalPDFSHA256,'8dd34868badade8d3d4cd77ce11c6a632705bdd99a59509a5e4d23544f2d3d75');
 assert.equal(S.motions[0].mover,'Dibble');
 assert.equal(S.motions[1].mover,'McEwen');
 assert.equal(S.motions[2].mover,'Pappas');
 assert.notEqual(S.motions[0].originalMotionNeighborhoodSHA256,
  S.motions[1].originalMotionNeighborhoodSHA256);
 assert.equal(S.motions[0].originalYeaNamesSHA256,S.motions[1].originalYeaNamesSHA256);
});
test('reject any fake original committee document mutation, side, bill, result or report date',()=>{
 const base=fictitiousJournal();
 for(const change of [
  base.replace('MONDAY, APRIL 12, 2021','TUESDAY, APRIL 13, 2021'),
  base.replace('Pursuant to Rule 12.10','Pursuant to Rule 12.11'),
  base.replace('REPORT OF VOTE IN COMMITTEE','REPORT OF VOTE ON SENATE FLOOR'),
  base.replace('FictionalMoverBeta amendment','FictionalMoverAlpha amendment'),
  base.replace('FictionalMoverGamma amendment to S.F. No. 970','FictionalMoverGamma amendment to S.F. No. 1159'),
  base.replace('There were yeas 4 and nays 6','There were yeas 3 and nays 7'),
  base.replace('FictionalAble, FictionalBravo','FictionalAble, FictionalAble'),
  base.replace('The amendment was not adopted.','The amendment was adopted.'),
  base.replace('Those who voted in the negative','Those who voted in the affirmative')
 ])assert.throws(()=>fake(change));
});
test('test-only inspector refuses to accept actual senator names or wrong aggregate member count',()=>{
 assert.throws(()=>inspectFictionalThreeApril12CommitteeAmendments(fictitiousJournal(),
  [{...fixtures[0],yes:['Dibble',...YES.slice(1)]},fixtures[1],fixtures[2]]));
 assert.throws(()=>inspectFictionalThreeApril12CommitteeAmendments(fictitiousJournal(),
  [{...fixtures[0],no:NO.slice(1)},fixtures[1],fixtures[2]]));
});
