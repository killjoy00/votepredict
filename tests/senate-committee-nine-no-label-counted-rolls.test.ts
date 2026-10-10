import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractNineSourceIndividualRolls,selectNinePinnedSourceRollOriginals,
} from '../src/evidence/senate-committee-nine-no-label-counted-rolls.js';

test('exact original nine source manifests reject absent immutable source artifact SHA',()=>{
  for(const year of [2023,2024] as const)
    assert.throws(()=>selectNinePinnedSourceRollOriginals(year,'{}'),/original source artifact hash differs/);
});
test('reversed source numeric tally counts explicit Yea/Nay and never classifies Absent or Pass as Nay',()=>{
  const text=[
    'Senator Koran moved the A2 amendment to SF 100 and requested a roll call vote.',
    'A roll call was granted.',
    'Senator Carlson – Nay Senator Westlin – Nay Senator Koran – Yea',
    'Senator Anderson – Yea Senator Bahr – Pass Senator Marty – Nay',
    'Senator Mathews – Yea Senator Port – Absent Senator Rest – Nay',
    'With a roll call vote of 4 Nays and 3 Yeas and 1 Pass and 1 Absence the motion failed.',
  ].join('\n');
  const r=extractNineSourceIndividualRolls(text,2023,'Elections');
  assert.equal(r.length,1);
  assert.equal(r[0]?.sourceYeaCount,3);
  assert.equal(r[0]?.sourceNayCount,4);
  assert.equal(r[0]?.explicitlyNamedYeas,3);
  assert.equal(r[0]?.explicitlyNamedNays,4);
  assert.equal(r[0]?.explicitlyListedAbsent,1);
  assert.equal(r[0]?.explicitlyListedPass,1);
  assert.equal(r[0]?.namedYeaNayTallyMatchesSource,true);
  assert.equal(r[0]?.sourceChoiceFingerprintSha256.length,9);
  assert.equal(r[0]?.noAutomaticIndividualVoteImport,true);
});
test('same-sided and opposite-sided name collision remains provisional with explicit failed parity',()=>{
  const text='Senator Koran requested a roll call on a motion. A roll call is granted. '+
    'Senator Koran - Yea Senator Westlin - Yea Senator Koran - Nay '+
    'By a roll call vote of 2 Yeas and 1 Nay the motion failed.';
  const r=extractNineSourceIndividualRolls(text,2023,'Elections');
  assert.equal(r.length,1);
  assert.equal(r[0]?.explicitNamesAreUniqueWithinRoll,false);
  assert.equal(r[0]?.namedYeaNayTallyMatchesSource,false);
  assert.equal(r[0]?.candidateNeedsIndependentMotionAndRosterCheck,true);
});
test('ethics subcommittee explicitly records four named Nays on 0/4 complaint motion, not a bill stance',()=>{
  const text='Senator Mathews moves a motion regarding an ethics complaint. '+
    'Senator Mathews requests a roll call vote, a roll call is granted. '+
    'Chair, Senator Champion: Nay Senator Kunesh: Nay Senator Mathews: Nay Senator Miller: Nay '+
    'With 0 Ayes and 4 Nays, the motion does not prevail.';
  const r=extractNineSourceIndividualRolls(text,2024,'Rules and Administration - Subcommittee on Ethical Conduct');
  assert.equal(r.length,1);
  assert.equal(r[0]?.sourceYeaCount,0);
  assert.equal(r[0]?.sourceNayCount,4);
  assert.equal(r[0]?.explicitlyNamedNays,4);
  assert.equal(r[0]?.namedYeaNayTallyMatchesSource,true);
  assert.equal(r[0]?.committeeEthicsActionNeverBillStance,true);
});
test('original 2024 Rules separate AYES NAYS first/last roster must not be confused with attendance',()=>{
  const text=[
    'Present: MURPHY, Erin - Chair; REST, Ann - Vice Chair; JOHNSON, Mark - Ranking Member',
    'Senator Johnson moved the A2 amendment. Senator Johnson requested a roll call on the A2 amendment.',
    'The clerk took the roll:',
    'AYES',
    'JOHNSON, Mark – Ranking Member',
    'EICHORN, Justin',
    'LIMMER, Warren',
    'MILLER, Jeremy',
    'NAYS',
    'MURPHY, Erin – Chair',
    'REST, Anne – Vice Chair',
    'FRENTZ, Nick',
    'CHAMPION, Bobby Joe',
    'MARTY, John',
    'PAPPAS, Sandra',
    'There being 4 ayes and 6 nays. THE MOTION DID NOT PREVAIL.',
  ].join('\n');
  const r=extractNineSourceIndividualRolls(text,2024,'Rules and Administration');
  assert.equal(r.length,1);
  assert.equal(r[0]?.sourcePattern,'clerk_named_side_columns');
  assert.equal(r[0]?.explicitlyNamedYeas,4);
  assert.equal(r[0]?.explicitlyNamedNays,6);
  assert.equal(r[0]?.namedYeaNayTallyMatchesSource,true);
  assert.equal(r[0]?.sourceChoiceFingerprintSha256.length,10);
});
test('plain presence/attendance roll and voice vote cannot produce named yea nay candidates',()=>{
  const text='Senator Johnson called the meeting to order. The clerk took the roll. '+
    'Senator Carlson present. Senator Koran absent. A voice motion prevailed.';
  assert.deepEqual(extractNineSourceIndividualRolls(text,2023,'Elections'),[]);
  assert.throws(()=>extractNineSourceIndividualRolls('hi',2023,'Elections'),/fixed review bounds/);
});
test('two motions with identical member tallies remain independent source observations',()=>{
  const vote=(bill:string)=>'Senator Koran moved an amendment on '+bill+'. Senator Koran requested a roll call. '+
    'Senator Carlson - Yea Senator Koran - Nay By a roll call vote of 1 Yea and 1 Nay the motion failed.';
  const r=extractNineSourceIndividualRolls(vote('SF100')+'\n'+vote('SF200'),2023,'Elections');
  assert.equal(r.length,2);
  assert.notEqual(r[0]?.sourceOffset,r[1]?.sourceOffset);
});