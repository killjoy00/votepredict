import assert from 'node:assert/strict';
import test from 'node:test';
import {
 MN_ORIGINAL_RULE1210_THREE as SOURCES,
 inspectOriginalThreeRule1210CommitteeRoll,
 inspectFictionalThreeRule1210CommitteeRoll
} from '../src/evidence/senate-2021-22-rule1210-three-original-journal-rolls.js';
import type {ThreeRule1210Target} from '../src/evidence/senate-2021-22-rule1210-three-original-journal-rolls.js';

const originalMotions={
 sf1:'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the motion that S.F. No. 1, as amended, be recommended to pass.',
 sf2909:'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the motion that S.F. No. 2909, be recommended to pass.',
 sf9ss1:'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the second portion of the Marty division of the Pratt amendment to S.F. No. 9.'
};
const yes=['FictionalAlpha','FictionalBravo','FictionalCharlie','FictionalDelta','FictionalEcho','FictionalFoxtrot'];
const no=['FictionalGolf','FictionalHotel','FictionalIndia','FictionalJuliet'];
function source(key:ThreeRule1210Target){
 const spec=SOURCES[key];
 const yea=yes.slice(0,spec.yea),nay=no.slice(0,spec.nay);
 const lead='JOURNAL OF THE SENATE '+spec.printedDay+' '+
  ('Unrelated Senate Journal opening lines. ').repeat(36);
 const bill='Senator '+spec.reporter+' from the Committee on '+spec.committee+
  ', to which was re-referred S.F. No. '+spec.billNo+
  ': A bill for an act relating to a fictional project. '+
  'Reports the same back with a recommendation. Report adopted. ';
 const page=key==='sf9ss1'?'156 JOURNAL OF THE SENATE [7TH DAY] ':'';
 const names=(items:string[])=>items.slice(0,-1).join(', ')+', and '+items[items.length-1];
 return {
  text:lead+bill+'REPORT OF VOTE IN COMMITTEE '+
   originalMotions[key]+' There were yeas '+spec.yea+' and nays '+spec.nay+', as follows: '+
   page+'Those who voted in the affirmative were: Senators '+names(yea)+
   '. Those who voted in the negative were: Senators '+names(nay)+'. The '+
   (key==='sf9ss1'?'amendment was adopted.':'motion prevailed.')+
   (' Postlude unrelated. ').repeat(30),
  yea,nay
 };
}
for(const key of ['sf1','sf2909','sf9ss1'] as ThreeRule1210Target[]){
 test(key+' exact fictional names and independently attributed COMMITTEE motion',()=>{
  const x=source(key),result=inspectFictionalThreeRule1210CommitteeRoll(key,x.text,x.yea,x.nay);
  assert.equal(result.bill,SOURCES[key].bill);
  assert.equal(result.sourceJournalReportDate,SOURCES[key].reportDay);
  assert.equal(result.printedYea,SOURCES[key].yea);
  assert.equal(result.printedNay,SOURCES[key].nay);
  assert.equal(result.printedAbsent,null);
  assert.equal(result.sourceIsSpecialSessionOutsideRegularIndex,key==='sf9ss1');
  assert.equal(result.recordedActionIsAmendmentNotPassage,key==='sf9ss1');
  assert.equal(result.noMemberVoteImport,true);
  assert.equal(result.noPrivateDatabaseReadOrReconciliation,true);
  assert.match(result.individualOriginalNamesSHA256Only.yea,/^[a-f0-9]{64}$/);
  assert.match(result.motionContextSHA256,/^[a-f0-9]{64}$/);
  assert.ok(result.resultNormalizedTextOffset>result.motionNormalizedTextOffset);
 });
 test(key+' authentic side digest rejects fabricated fictional senators',()=>{
  assert.throws(()=>inspectOriginalThreeRule1210CommitteeRoll(key,source(key).text),
   /original individual senator-side SHA/);
 });
 test(key+' fail closed on wrong bill context, committee, report date, motion identity, totals and result',()=>{
  const x=source(key),base=x.text,otherBill=key==='sf1'?'2':key==='sf2909'?'2908':'10';
  for(const invalid of [
   base.replace('S.F. No. '+SOURCES[key].billNo+':','S.F. No. '+otherBill+':'),
   base.replace('Committee on '+SOURCES[key].committee,'Committee on Some Other Panel'),
   base.replace('Senator '+SOURCES[key].reporter,'Senator SomeOtherMember'),
   base.replace(SOURCES[key].printedDay,'MONDAY, MARCH 29, 2021'),
   base.replace('REPORT OF VOTE IN COMMITTEE','REPORT OF SENATE FLOOR VOTE'),
   base.replace('Pursuant to Rule 12.10','Pursuant to Rule 12.11'),
   base.replace('There were yeas '+SOURCES[key].yea,'There were yeas 99'),
   base.replace(key==='sf9ss1'?'The amendment was adopted':'The motion prevailed','The motion failed'),
   base.replace('Senators '+x.yea[0],'Senators FictionalZulu'),
   base.replace('and '+x.nay[x.nay.length-1],'and '+x.yea[0])
  ])assert.throws(()=>inspectFictionalThreeRule1210CommitteeRoll(key,invalid,x.yea,x.nay));
 });
 test(key+' duplicated identical named committee motion is not counted twice',()=>{
  const x=source(key),start=x.text.indexOf('Pursuant to Rule 12.10');
  assert.throws(()=>inspectFictionalThreeRule1210CommitteeRoll(
   key,x.text+' '+x.text.slice(start),x.yea,x.nay),/missing or duplicated/);
 });
}
test('2021 First Special Session SF9 source p156 to p157 seam bound',()=>{
 const key='sf9ss1',x=source(key);
 assert.equal(inspectFictionalThreeRule1210CommitteeRoll(key,x.text,x.yea,x.nay).printedYea,6);
 assert.throws(()=>inspectFictionalThreeRule1210CommitteeRoll(
  key,x.text.replace('[7TH DAY]','[8TH DAY]'),x.yea,x.nay));
});
test('special session SF9 is not a whole-bill floor passage or the regular-session index',()=>{
 const x=source('sf9ss1'),data=inspectFictionalThreeRule1210CommitteeRoll('sf9ss1',x.text,x.yea,x.nay);
 assert.equal(data.exactRecordedMotion,'second portion of Marty division of Pratt amendment to SF9');
 assert.equal(data.recordedActionIsAmendmentNotPassage,true);
 assert.equal(data.sourceJournalPage,156);
 assert.equal(data.noHearingActionTimeOrFirstPublicDateProven,true);
});
