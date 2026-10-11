import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {
 APR12_TWO_AMENDMENTS as SOURCE,
 discoverOriginalApril12AmendmentSideCommitments as discover
} from '../src/evidence/senate-2021-apr12-rule1210-two-amendment-side-discovery.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const yes4=['FictionalAlpha','FictionalBravo','FictionalCharlie','FictionalDelta'];
const no6=['FictionalEcho','FictionalFoxtrot','FictionalGolf','FictionalHotel','FictionalIndia','FictionalJuliet'];
const yes3=['FictionalKilo','FictionalLima','FictionalMike'];
const secondNo6=['FictionalNovember','FictionalOscar','FictionalPapa','FictionalQuebec','FictionalRomeo','FictionalSierra'];
function joined(names:string[]){
 return names.slice(0,-1).join(', ')+', and '+names[names.length-1];
}
function roll(number:1159|970,sponsor:string,yes:string[],no:string[]){
 return 'REPORT OF VOTE IN COMMITTEE '+
  'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the '+
  sponsor+' amendment to S.F. No. '+number+'. '+
  'There were yeas '+yes.length+' and nays '+no.length+', as follows: '+
  'Those who voted in the affirmative were: Senators '+joined(yes)+'. '+
  'Those who voted in the negative were: Senators '+joined(no)+'. '+
  'The amendment was not adopted. ';
}
function originalFixture(){
 return 'JOURNAL OF THE SENATE MONDAY, APRIL 12, 2021 '+
  ('Official fictional 2021 daily Senate Journal filler. ').repeat(250)+
  'Senator FictionalAlpha from Committee Transportation Finance, S.F. No. 1159: '+
  roll(1159,'FictionalSponsor',yes4,no6)+
  ('Unrelated Senate business. ').repeat(10)+
  'Senator FictionalCharlie from Judiciary and Public Safety, S.F. No. 970: '+
  roll(970,'FictionalMovant',yes3,secondNo6)+
  ('Unrelated business and journal text. ').repeat(20);
}
function mockedExpectedWindows(original:string){
 const flat=original.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
 const base='Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on ';
 const a=flat.indexOf(base),b=flat.indexOf(base,a+1);
 assert.ok(a>=0&&b>a);
 return {sf1159:sha(flat.slice(a,a+450)),sf970:sha(flat.slice(b,b+450))};
}
function inspect(text=originalFixture(),original=originalFixture()){
 return discover(text,{fictionalSourceWindowSHA256:mockedExpectedWindows(original)});
}
test('strict TWO separate original April12 amendment windows do not leak member voting names',()=>{
 assert.equal(SOURCE.originalURL,
  'https://www.senate.mn/journals/2021-2022/20210412036.pdf');
 const report=inspect();
 const rows=report.originalCommitteeAmendmentSideCommitmentDiscoveryOnly;
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.bill),['SF1159','SF970']);
 assert.deepEqual(rows.map(x=>[x.printedYea,x.printedNay,x.printedAbsent]),
  [[4,6,null],[3,6,null]]);
 assert.deepEqual(rows.map(x=>x.amendmentSponsorLabel),['FictionalSponsor','FictionalMovant']);
 assert.equal(rows[0]!.printedOutcome,'amendment not adopted');
 assert.equal(rows[1]!.printedOutcome,'amendment not adopted');
 for(const row of rows){
  assert.equal(row.originalNamedRollStrictlyIndependentlyAuthenticated,false);
  assert.equal(row.differentBillsAndAmendmentMotionsNotDeduplicated,true);
  assert.match(row.originalNamedSideSHA256ProvisionalOnly.yea,/^[a-f0-9]{64}$/);
  assert.match(row.originalNamedSideSHA256ProvisionalOnly.nay,/^[a-f0-9]{64}$/);
 }
 const json=JSON.stringify(report);
 for(const actualName of [...yes4,...no6,...yes3,...secondNo6])
  assert.doesNotMatch(json,new RegExp('\\b'+actualName+'\\b'));
 assert.equal(report.noReadableOriginalMemberBySideNamesEmitted,true);
 assert.equal(report.pendingIndependentExpectedSideSHAAuthentication,true);
 assert.equal(report.noPrivateStoredVoteComparisonOrImport,true);
 assert.equal(report.issue864MustRemainOpen,true);
});
test('misattributed second bill, floor, duplicated motion and wrong edition all fail closed',()=>{
 const fixture=originalFixture();
 const invalid=[
  fixture.replace('MONDAY, APRIL 12, 2021','MONDAY, APRIL 19, 2021'),
  fixture.replace('REPORT OF VOTE IN COMMITTEE','REPORT OF SENATE FLOOR VOTE'),
  fixture.replace('Rule 12.10','Rule 12.11'),
  fixture.replace('No. 1159. There','No. 970. There'),
  fixture.replace('There were yeas 4 and nays 6','There were yeas 5 and nays 5'),
  fixture.replace('The amendment was not adopted.','The amendment prevailed.'),
  fixture.replace('FictionalDelta','FictionalZulu'),
  fixture.replace('FictionalEcho','FictionalAlpha'),
  fixture+fixture.slice(fixture.indexOf('Pursuant to Rule 12.10'),
   fixture.indexOf('The amendment was not adopted.')+30)
 ];
 for(const bad of invalid)assert.throws(()=>inspect(bad,fixture));
});
test('source-bound original motion SHA rejects altered statement and names',()=>{
 const fixture=originalFixture();
 assert.throws(()=>inspect(fixture.replace('FictionalSponsor','OtherSponsor'),fixture),
  /window SHA mismatch/);
 assert.throws(()=>inspect(fixture.replace('FictionalKilo','FictionalZulu'),fixture),
  /window SHA mismatch/);
 assert.equal(SOURCE.sf1159.journalPage,2086);
 assert.equal(SOURCE.sf970.journalPage,2147);
 assert.notEqual(SOURCE.sf1159.original450CharMotionWindowSHA256,
  SOURCE.sf970.original450CharMotionWindowSHA256);
});
