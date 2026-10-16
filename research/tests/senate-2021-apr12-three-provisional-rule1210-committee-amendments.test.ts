import assert from 'node:assert/strict';
import test from 'node:test';
import {SOURCE,probeOriginalApril12ThreeRule1210Amendments} from
 '../evidence/senate-2021-apr12-three-rule1210-original-amendments.js';
const yea=['FictionalAlpha','FictiónalBravo','FictionalCharlie','FictionalDelta'];
const nay=['FictionalEcho','FictionalFoxtrot','FictionalGolf','FictionalHotel','FictionalIndia','FictionalJuliet'];
const serialize=(rows:string[])=>
 rows.slice(0,-1).join(', ')+', and '+rows[rows.length-1];
const motion=(mover:string,bill:number,yes:string[],no:string[])=>
 'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the '+
 mover+' amendment to S.F. No. '+bill+'. '+
 'There were yeas '+yes.length+' and nays '+no.length+', as follows: '+
 'Those who voted in the affirmative were: Senators '+serialize(yes)+'. '+
 'Those who voted in the negative were: Senators '+serialize(no)+'. '+
 'The amendment was not adopted. ';
function original(){
 return 'JOURNAL OF THE SENATE MONDAY, APRIL 12, 2021 '+
  ('Other 2021 original journal text. ').repeat(330)+
  'Senator PretendReporter from the Committee on Transportation Finance and Policy, to which was referred S.F. No. 1159: '+
  'Reports the same back as amended. REPORT OF VOTE IN COMMITTEE '+
  motion('Marty',1159,yea,nay)+
  motion('Kent',1159,yea,nay)+
  ('Other report text. ').repeat(10)+
  'Senator PretendOther from the Committee on Judiciary and Public Safety Finance and Policy, S.F. No. 970: '+
  'Reports same back. REPORT OF VOTE IN COMMITTEE '+
  motion('Pappas',970,yea.slice(0,3),nay)+
  ('Unrelated report postscript. ').repeat(22);
}
test('three original Rule12.10 amendment motions are DISTINCT, side SHA-only and not final source certified',()=>{
 const x=probeOriginalApril12ThreeRule1210Amendments(original());
 assert.equal(x.schemaVersion,SOURCE.version);
 assert.equal(x.originalIndexedAmendmentMotionCount,3);
 assert.equal(x.originalProvisionalRollsFullyParsed,3);
 assert.deepEqual(x.provisionalDiscoveryErrors,[]);
 assert.deepEqual(x.originalProvisionalMotions.map(r=>r.bill),['SF1159','SF1159','SF970']);
 assert.deepEqual(x.originalProvisionalMotions.map(r=>r.billMotionOrdinal),[1,2,1]);
 assert.deepEqual(x.originalProvisionalMotions.map(r=>r.originalMotionProposer),['Marty','Kent','Pappas']);
 assert.deepEqual(x.originalProvisionalMotions.map(r=>[r.printedYea,r.printedNay,r.printedAbsent]),
   [[4,6,null],[4,6,null],[3,6,null]]);
 for(const row of x.originalProvisionalMotions){
  assert.equal(row.outcome,'amendment not adopted');
  assert.equal(row.precedingOfficialCommitteeHeadingWithin650,true);
  assert.equal(row.firstPassOnlyNotIndependentSourceCertified,true);
  assert.match(row.originalIndividualNamedSideSHA256Only!.yea,/^[a-f0-9]{64}$/);
  assert.match(row.originalIndividualNamedSideSHA256Only!.nay,/^[a-f0-9]{64}$/);
 }
 assert.notEqual(x.originalProvisionalMotions[0]!.motionNormalizedOffset,
  x.originalProvisionalMotions[1]!.motionNormalizedOffset);
 assert.deepEqual(x.originalProvisionalMotions[0]!.originalIndividualNamedSideSHA256Only,
  x.originalProvisionalMotions[1]!.originalIndividualNamedSideSHA256Only);
 assert.equal(x.distinctSF1159AmendmentsMustNotDeduplicateEvenIfSameSides,true);
 const joined=JSON.stringify(x);
 assert.doesNotMatch(joined,/FictionalAlpha|FictionalDelta|FictionalHotel/);
 assert.equal(x.namedSideDigestsNotIndependentlyAuthenticatedUntilNewOriginalRun,true);
 assert.equal(x.issue864RemainsOpen,true);
});
test('reject false original bill/rule/motion/tally and refrain from certifying incorrect sides',()=>{
 const scenarios=[
  original().replace('S.F. No. 1159.', 'S.F. No. 1160.'),
  original().replace('Pursuant to Rule 12.10','Pursuant to Rule 12.11'),
  original().replace('There were yeas 4 and nays 6','There were yeas 5 and nays 5'),
  original().replace('The amendment was not adopted.','The amendment was adopted.')
 ];
 for(const txt of scenarios){
  const x=probeOriginalApril12ThreeRule1210Amendments(txt);
  assert.ok(x.provisionalDiscoveryErrors.length>0||x.originalProvisionalRollsFullyParsed<3);
 }
});
