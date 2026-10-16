import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MAR30_2022_SF3882_COMMITTEE_SOURCE as S,
 inspectOriginalMar30SF3882SubcommitteeMinutes,
 inspectFictionalMar30SF3882OnlineMinutes
} from '../evidence/senate-2022-propertytaxes-mar30-sf3882-online-roll.js';
const yes=['FictionalAlpha','FictionalBravo'];
const no=['FictionalDelta','FictionalEcho'];
const mock=()=>{
 const filler='<p>'+('Other meeting notes without roll-call names. ').repeat(45)+'</p>';
 return '<!doctype html><html><head><title>Minnesota Senate official-looking TEST ONLY</title></head><body>'+
  '<h1>Subcommittee on Property Taxes</h1><p>Wednesday, March 30, 2022</p>'+
  '<p>8:30 AM, Room G-15, Capitol</p><div>Minutes</div>'+
  '<p>Present: Senator FictionalAlpha, Senator FictionalBravo, Senator FictionalDelta, Senator FictionalEcho</p>'+
  '<p>Absent: Senator FictionalOther</p>'+
  filler+
  '<p>S.F. 3882: Senator FictionalSponsor: Fictional cities levy limit rules.</p>'+
  '<p>Senator FictionalSponsor presented S.F. 3882</p>'+
  '<p>Senator FictionalCharlie requested Roll call to refer S.F. 3882 to Local Government</p>'+
  '<ul><li>Senator FictionalDelta voted no</li><li>Senator FictionalAlpha voted yes</li>'+
  '<li>Senator FictionalBravo voted yes</li><li>Senator FictionalEcho voted no</li></ul>'+
  '<p>2-2 Motion did not prevail</p><p>Discussion</p>'+
  '<p>Senator FictionalSponsor moved that S.F. 3882 be laid over</p>'+
  filler+'</body></html>';
};
const parse=(html=mock())=>inspectFictionalMar30SF3882OnlineMinutes(
 html,'FictionalCharlie',yes,no);
test('original SF3882 2-2 failed referral distinct from subsequent layover and not floor',()=>{
 const x=parse();
 assert.equal(x.bill,'SF3882');
 assert.equal(x.originalMeetingDate,'2022-03-30');
 assert.equal(x.subcommittee,'Subcommittee on Property Taxes');
 assert.equal(x.recordedMotion,'refer SF3882 to Local Government');
 assert.deepEqual([x.sourcePrintedYea,x.sourcePrintedNay,x.sourcePrintedMotionAbsent],[2,2,null]);
 assert.equal(x.originalRollOutcome,'motion did not prevail');
 assert.equal(x.exactOriginalNamedRollMotionCount,1);
 assert.equal(x.laterSF3882LayoverIsDifferentMotionNotSecondRoll,true);
 assert.equal(x.meetingAttendanceAbsentDoesNotInferMotionSpecificAbsence,true);
 assert.equal(x.noLRL2022PrintElectronicEquivalenceClaim,true);
 assert.equal(x.noPrivateStoredVoteRowsOrImport,true);
 assert.equal(x.issue864RemainsOpen,true);
 assert.match(x.originalRollPassageSHA256,/^[a-f0-9]{64}$/);
 assert.match(x.individualSenatorSidesSHA256Only.yea,/^[a-f0-9]{64}$/);
 assert.match(x.individualSenatorSidesSHA256Only.nay,/^[a-f0-9]{64}$/);
 assert.ok(x.originalResultNormalizedTextOffset>x.motionNormalizedTextOffset);
 assert.doesNotMatch(JSON.stringify(x),/FictionalAlpha|FictionalDelta|FictionalEcho/);
});
test('authentic original inspector refuses the fake requester rather than treating a fixture as official',()=>{
 assert.throws(()=>inspectOriginalMar30SF3882SubcommitteeMinutes(mock()),
  /Exact SF3882 referral motion and roll requester not uniquely found/i);
 assert.equal(S.meetingDate,'2022-03-30');
 assert.equal(S.originalExpectedYeaSideSHA256.length,64);
});
test('fail closed on other year, wrong bill, other body, wrong vote, changed outcome, missing context',()=>{
 const source=mock();
 for(const altered of [
  source.replace('Wednesday, March 30, 2022','Thursday, March 31, 2022'),
  source.replace('Subcommittee on Property Taxes','Senate Floor Committee'),
  source.replace('S.F. 3882: Senator','S.F. 3883: Senator'),
  source.replace('Roll call to refer S.F. 3882 to Local Government','voice vote on SF 3882'),
  source.replace('FictionalDelta voted no','FictionalDelta voted yes'),
  source.replace('FictionalBravo voted yes','FictionalDelta voted yes'),
  source.replace('2-2 Motion did not prevail','3-1 Motion prevailed'),
  source.replace('2-2 Motion did not prevail','2-2 Motion prevailed'),
  source.replace('<p>Discussion</p>','<p>Subsequent business</p>'),
  source.replace('Absent: Senator FictionalOther','Other: FictionalOther')
 ])assert.throws(()=>parse(altered));
});
test('duplicate exact roll-call motion is not double certified',()=>{
 const source=mock().replace(
  '<p>2-2 Motion did not prevail</p>',
  '<p>2-2 Motion did not prevail</p>'+
  '<p>Senator FictionalCharlie requested Roll call to refer S.F. 3882 to Local Government</p>');
 assert.throws(()=>parse(source),/not uniquely found/);
});
