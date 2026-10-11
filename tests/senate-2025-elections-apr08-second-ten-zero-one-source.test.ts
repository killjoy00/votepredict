import assert from 'node:assert/strict';
import test from 'node:test';
import {
 SECOND_TEN_ZERO_ONE_VERSION,inspectSyntheticOtherTenZeroOne,
 inspectOriginalApr08OtherTenZeroOne
} from '../src/evidence/senate-2025-elections-apr08-second-ten-zero-one-source.js';

const FAKE=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf',
 'Hotel','India','Juliet','Kilo'] as const; // not real MN senators
function example(){
 const head=('Synthetic committee introductory language. ').repeat(55);
 const a8='Senator Alpha moved the A8 Amendment to S.F. 2384. '+
  'Senator Alpha requested a roll call vote on the A8 Amendment. '+
  'With a vote of 10/0/1, the motion prevailed. '+
  'Ayes: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliet '+
  'Nays: Absent: Kilo ';
 const a11='Senator Bravo moved the A11 Amendment to S.F. 2384. '+
  'Senator Bravo requested a roll call vote on the A11 Amendment. '+
  'With a vote of 10/0/1, the motion prevailed. '+
  'Ayes: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliet '+
  'Nays: Absent: Kilo ';
 const a10='Senator Charlie moved the A10 Amendment to S.F. 2384.';
 const text=head+a8+a11+a10;
 const a11MotionOffset=text.indexOf('Senator Bravo moved the A11');
 const a11ResultOffset=text.indexOf('With a vote of 10/0/1',a11MotionOffset);
 return {text,a11MotionOffset,a11ResultOffset};
}
function reanchor(f:ReturnType<typeof example>){
 f.a11MotionOffset=f.text.indexOf('Senator Bravo moved the A11');
 f.a11ResultOffset=f.text.indexOf('With a vote of 10/0/1',f.a11MotionOffset);
 return f;
}
function inspect(input=example()){
 return inspectSyntheticOtherTenZeroOne(input.text,[...FAKE],
  input.a11ResultOffset,input.a11MotionOffset);
}
test('two separate 10/0/1 motion sections remain distinct despite same totals',()=>{
 const x=inspect();
 assert.equal(SECOND_TEN_ZERO_ONE_VERSION,
  'senate-2025-elections-apr08-other-10-0-1-original-neighborhood-v1');
 assert.deepEqual(x.allOriginalTenZeroOnePrevailTextOffsets.length,2);
 assert.equal(x.independentlyPriorAuthenticatedA11MotionOffset,
  example().a11MotionOffset);
 assert.equal(x.independentlyPriorAuthenticatedA11ResultOffset,
  example().a11ResultOffset);
 assert.equal(x.closestIntroducedAmendmentLabel,'A8');
 assert.equal(x.closestPrintedMotionMover,'Alpha');
 assert.equal(x.otherTenZeroOneResultOffset<x.independentlyPriorAuthenticatedA11ResultOffset,true);
 assert.equal(x.candidateBillExplicitlyPrintedBetweenMotionAndResult,true);
 assert.equal(x.candidateMotionOwnSectionContainsOneMatchingResult,true);
 assert.equal(x.sourcePrintedNamedTenYesZeroNoOneAbsentRosterExact,true);
 assert.equal(x.printedAbsentIndividualOnlyWhenExactlyValidated,'Kilo');
 assert.deepEqual(Object.values(x.sourceSideIdentitySHA256OnlyWhenExactlyValidated)
  .map(a=>a.length),[10,0,1]);
 assert.ok(!x.candidateMotionWordingForHumanReview?.includes('Ayes:'));
 assert.equal(x.sourceCandidateWorthSeparateMotionReview,true);
 assert.equal(x.samePreviouslyAuthenticatedA11MotionSection,false);
 assert.equal(x.noNewDistinctVoteDenominatorCertified,true);
 assert.equal(x.noIndividualMemberSideImport,true);
 assert.equal(x.noStoredMemberVoteParityVerified,true);
});
test('original-source-only entry refuses arbitrary synthetic text without exact full SHA',()=>{
 assert.throws(()=>inspectOriginalApr08OtherTenZeroOne(example().text),
  /exact original full extracted text SHA changed/);
});
test('A11 anchor must match previous independently authenticated source proof',()=>{
 const fixture=example();
 assert.throws(()=>inspectSyntheticOtherTenZeroOne(fixture.text,[...FAKE],
  fixture.a11ResultOffset+10,fixture.a11MotionOffset),/A11 result anchor/);
 assert.throws(()=>inspectSyntheticOtherTenZeroOne(fixture.text,[...FAKE],
  fixture.a11ResultOffset,fixture.a11MotionOffset+1),/A11 motion anchor/);
});
test('a third identical printed result is an unresolved extra, not silently dropped',()=>{
 const fixture=example();
 fixture.text+=' With a vote of 10/0/1, the motion prevailed.';
 assert.throws(()=>inspect(fixture),/expected exactly two/);
});
test('fake/tampered 10 yes zero no one absent sides never become a member choice',()=>{
 for(const change of [
  (s:string)=>s.replace('Ayes: Alpha, Bravo','Ayes: Alpha, Alpha'),
  (s:string)=>s.replace('Absent: Kilo','Absent: Juliet'),
  (s:string)=>s.replace('Absent: Kilo','Absent: Unauthorized'),
 ]) {
  const fixture=example();
  fixture.text=change(fixture.text);
  const r=inspect(reanchor(fixture));
  assert.equal(r.sourcePrintedNamedTenYesZeroNoOneAbsentRosterExact,false);
  assert.equal(r.sourceSideIdentitySHA256OnlyWhenExactlyValidated,null);
  assert.equal(r.sourceCandidateWorthSeparateMotionReview,false);
 }
});
test('without real motion introduction preceding other tally, candidate held',()=>{
 const f=example();
 f.text=f.text.replace('Senator Alpha moved the A8 Amendment to S.F. 2384. ','');
 // First 10/0/1 is still present but has no actual introduced amendment.
 const r=inspect(reanchor(f));
 assert.equal(r.closestIntroducedAmendmentLabel,null);
 assert.equal(r.sourceCandidateWorthSeparateMotionReview,false);
});
test('fake roster cannot include real official Elections member or duplicate name',()=>{
 const f=example();
 assert.throws(()=>inspectSyntheticOtherTenZeroOne(f.text,
  ['Westlin',...FAKE.slice(1)],f.a11ResultOffset,f.a11MotionOffset),
  /fictional distinct/);
 assert.throws(()=>inspectSyntheticOtherTenZeroOne(f.text,
  ['Alpha',...FAKE.slice(1,10),'Alpha'],f.a11ResultOffset,f.a11MotionOffset),
  /fictional distinct/);
});