import assert from 'node:assert/strict';
import test from 'node:test';
import {
 APR08_A11_SOURCE_SCHEMA,SOURCE,inspectOriginalApr08A11Motion,
 inspectSyntheticApr08A11MotionTextCore
} from '../src/evidence/senate-2025-elections-apr08-a11-source.js';

// FICTIONAL fixture people only. Not an original source-side member list.
const fictionalRoster=[
 'Alpha','Bravo','Charlie','Delta','Echo','Foxtrot',
 'Golf','Hotel','India','Juliet','Kilo'
];
function synthetic(){
 return ('Synthetic Elections Committee hearing. ').repeat(75)
 +'Senator Alpha moved the A11 Amendment to S.F. 2384. '
 +'Senator Bravo requested a roll call vote to adopt the A11 Amendment. '
 +'With a vote of 10/0/1, the motion prevailed. '
 +'Ayes: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliet '
 +'Nays: Absent: Kilo '
 +'Senator Alpha moved the A10 Amendment to S.F. 2384.';
}
const inspect=(s:string)=>inspectSyntheticApr08A11MotionTextCore(
 s,fictionalRoster,'Kilo');

test('only the exact official original April 8 SF2384 PDF/text can enter source runner',()=>{
 assert.equal(APR08_A11_SOURCE_SCHEMA,
  'senate-2025-elections-apr08-sf2384-a11-original-10-0-1-motion-source-review-v1');
 assert.equal(SOURCE.date,'2025-04-08');
 assert.equal(SOURCE.originalPdfBytes,99628);
 assert.equal(SOURCE.originalPdfSHA256,
  'd26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(SOURCE.originalTextSHA256,
  '6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 assert.throws(()=>inspectOriginalApr08A11Motion(synthetic()),
  /Original April8 full PDF extracted-text SHA changed/);
});

test('synthetic single A11 motion with explicit empty Nay list partitions 10/0/1',()=>{
 const m=inspect(synthetic());
 assert.deepEqual([m.hearingDate,m.bill,m.committee,m.originalMotionLabel],
  ['2025-04-08','SF2384','Elections','A11 Amendment']);
 assert.equal(m.originalPrintedMover,'Alpha');
 assert.deepEqual([m.printedYeaCount,m.printedNayCount,m.printedAbsentCount],[10,0,1]);
 assert.equal(m.printedAbsentMember,'Kilo');
 assert.deepEqual(
  Object.values(m.sourceSideIdentityHashOnly).map(x=>x.length),
  [10,0,1]);
 assert.equal(new Set(Object.values(m.sourceSideIdentityHashOnly).flat()).size,11);
 assert.ok(!m.sourceMotionOnlyShortPreview.includes('Ayes:'));
 assert.equal(m.absentCannotBecomeYeaOrNay,true);
 assert.equal(m.noAutomaticDistinctRecordedVoteCertificate,true);
 assert.equal(m.neverSameDayForecastEligibleWithoutMotionTime,true);
});

test('roll-only A11 mention is not a formally introduced motion',()=>{
 const bad=synthetic().replace(
  'Senator Alpha moved the A11 Amendment to S.F. 2384. ','');
 assert.throws(()=>inspect(bad),/motion introduction missing/);
});

test('multiple A11 motion introductions remain held as ambiguous',()=>{
 const bad=synthetic().replace(
  'Senator Bravo requested a roll call vote',
  'Senator Bravo moved the A11 Amendment. Senator Bravo requested a roll call vote');
 assert.throws(()=>inspect(bad),/No unique A11 motion/);
});

test('altered bill, tallies, committee member roster, or absence fails closed',()=>{
 const changes=[
  (s:string)=>s.replace('S.F. 2384.','S.F. 2385.').replace('S.F. 2384.','S.F. 2385.'),
  (s:string)=>s.replace('10/0/1','9/1/1'),
  (s:string)=>s.replace('Ayes: Alpha, Bravo','Ayes: Alpha, Alpha'),
  (s:string)=>s.replace('Absent: Kilo','Absent: Juliet'),
  (s:string)=>s.replace('Absent: Kilo','Absent: SomeoneElse'),
  (s:string)=>s.replace('Senator Alpha moved the A11','Senator Unlisted moved the A11'),
 ];
 for(const change of changes)assert.throws(()=>inspect(change(synthetic())));
});

test('identical 10/0/1 outcome on later DIFFERENT motion is not an A11 duplicate',()=>{
 const anotherResultOnA10=synthetic()
  +' With a vote of 10/0/1, the motion prevailed.';
 const r=inspect(anotherResultOnA10);
 assert.equal(r.originalScopedA11TenZeroOneResultCandidates,1);
 assert.equal(r.originalWholeMeetingTenZeroOneResultCandidates,2);
 assert.deepEqual([r.printedYeaCount,r.printedNayCount,r.printedAbsentCount],[10,0,1]);
});

test('duplicated result WITHIN one A11 motion is held, no synthetic roster may pose as official',()=>{
 const duplicatedWithinA11=synthetic().replace(
  'Senator Alpha moved the A10 Amendment',
  'With a vote of 10/0/1, the motion prevailed. Senator Alpha moved the A10 Amendment');
 assert.throws(()=>inspect(duplicatedWithinA11),
  /scoped 10\/0\/1 result absent or repeated/);
 assert.throws(()=>inspectSyntheticApr08A11MotionTextCore(
  synthetic(),['Westlin',...fictionalRoster.slice(1)],'Kilo'),
  /Invalid explicitly fictional synthetic roster/);
 assert.throws(()=>inspectSyntheticApr08A11MotionTextCore(
  synthetic(),fictionalRoster,'Lucero'),
  /Invalid explicitly fictional synthetic roster/);
});
