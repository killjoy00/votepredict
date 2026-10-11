import assert from 'node:assert/strict';
import test from 'node:test';
import {APR12_2021_RULE1210,discoverOriginalApril12Rule1210Leads} from
 '../src/evidence/senate-2021-apr12-rule1210-sf1159-sf970-lead-probe.js';

function example(){
 const header='JOURNAL OF THE SENATE MONDAY, APRIL 12, 2021 '+
  ('This is fictional source-page filler. ').repeat(300);
 const rolls=APR12_2021_RULE1210.leads.map(row=>
  'Senator '+row.reporter+' from the Committee on '+row.committee+
  ', to which was re-referred S.F. No. '+row.number+
  ': A fictional bill report. Report adopted. REPORT OF VOTE IN COMMITTEE '+
  'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken on the motion that S.F. No. '+
  row.number+', as amended, be recommended to pass and be re-referred. '+
  'There were yeas 5 and nays 3, as follows: '+
  'Those who voted in the affirmative were: Senators FictionalAlpha, FictionalBravo, FictionalCharlie, FictionalDelta, and FictionalEcho. '+
  'Those who voted in the negative were: Senators FictionalFoxtrot, FictionalGolf, and FictionalHotel. '+
  'The motion prevailed. ');
 return header+rolls.join(' ')+('Other unrelated journal content. ').repeat(35);
}
test('two independent bill and committee leads do not collapse identical named sides',()=>{
 const output=discoverOriginalApril12Rule1210Leads(example());
 assert.deepEqual(output.committeeLeads.map(x=>x.bill),['SF1159','SF970']);
 assert.deepEqual(output.committeeLeads.map(x=>x.motionContextValid),[true,true]);
 assert.deepEqual(output.committeeLeads.map(x=>x.printedYea),[5,5]);
 assert.deepEqual(output.committeeLeads.map(x=>x.printedNay),[3,3]);
 for(const row of output.committeeLeads){
  assert.equal(row.provisionalOnlyNotIndependentCertified,true);
  assert.equal(row.printedAbsent,null);
  assert.match(row.sourceMotionTextSHA256!,/^[a-f0-9]{64}$/);
  assert.match(row.provisionalSideCommitment!.yea,/^[a-f0-9]{64}$/);
  assert.match(row.provisionalSideCommitment!.nay,/^[a-f0-9]{64}$/);
 }
 assert.equal(output.noOriginalNamesEmitted,true);
 assert.equal(output.sourceProvisionalSideSHAIsNotSecondPassCertified,true);
});
test('missing, wrong committee, wrong bill or floor section not accepted as original committee rolls',()=>{
 const base=example();
 for(const bad of [
  base.replace('MONDAY, APRIL 12, 2021','TUESDAY, APRIL 13, 2021'),
  base.replace('Committee on Transportation Finance and Policy','Committee on Education Finance'),
  base.replace('Senator Newman','Senator SomePerson'),
  base.replace('S.F. No. 1159:','S.F. No. 1158:'),
  base.replace('REPORT OF VOTE IN COMMITTEE','REPORT OF VOTE ON SENATE FLOOR'),
  base.replace('Pursuant to Rule 12.10','Pursuant to Rule 12.11')
 ]){
  if(bad.includes('TUESDAY'))assert.throws(()=>discoverOriginalApril12Rule1210Leads(bad));
  else {
   const result=discoverOriginalApril12Rule1210Leads(bad);
   assert.equal(result.committeeLeads[0].motionContextValid,false);
  }
 }
});
test('explicit absent remains null and tallies cannot be inferred from invalid fake member sides',()=>{
 const bad=example().replace('There were yeas 5 and nays 3','There were yeas 6 and nays 3');
 const rows=discoverOriginalApril12Rule1210Leads(bad).committeeLeads;
 assert.equal(rows[0].motionContextValid,true);
 assert.equal(rows[0].printedYea,null);
 assert.equal(rows[0].provisionalSideCommitment,null);
 assert.equal(rows[0].printedAbsent,null);
});
