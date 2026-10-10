import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractSupplementalNamedSenateRollCandidates,
} from '../src/evidence/senate-committee-supplemental-named-roll-review.js';

test('explicit ordered AYES/NAYS names and source 6/5 roll tally generate provisional candidate only',()=>{
  const sample=[
    'Senator Boldon requested a roll call vote on the motion that SF 101 be recommended to pass.',
    'With a vote of 6/5, the motion prevailed.',
    'Ayes: Carlson, Westlin, Boldon, Cwodzinski, Marty, Port',
    'Nays: Koran, Bahr, Limmer, Lucero, Mathews',
    'The meeting was adjourned.',
  ].join('\n');
  const x=extractSupplementalNamedSenateRollCandidates(sample);
  assert.equal(x.length,1);
  assert.equal(x[0]?.pattern,'opposing_named_lists');
  assert.equal(x[0]?.namedYeaCount,6);
  assert.equal(x[0]?.namedNayCount,5);
  assert.equal(x[0]?.sourceReportedYeaCount,6);
  assert.equal(x[0]?.sourceReportedNayCount,5);
  assert.equal(x[0]?.numericTallyMatchesExplicitNamedList,true);
  assert.equal(x[0]?.choiceIdentitySha256.length,11);
  assert.equal(x[0]?.candidateNotVerifiedVote,true);
  assert.equal(x[0]?.finalFloorStanceInferred,false);
});

test('reverse Nays then Ayes and absent attendees do not create implied direction',()=>{
  const sample=[
    'Senator Koran requested a roll call on the amendment. The motion was considered.',
    'Nays: Senator Howe, Senator Jasinski',
    'Ayes: Vice Chair Seeberger, Senator Frentz, Chair Klein',
    'Absent: Senator Nelson, Senator Miller',
  ].join('\n');
  const x=extractSupplementalNamedSenateRollCandidates(sample);
  assert.equal(x.length,1);
  assert.equal(x[0]?.namedYeaCount,3);
  assert.equal(x[0]?.namedNayCount,2);
  assert.equal(x[0]?.numericTallyMatchesExplicitNamedList,null);
  assert.equal(x[0]?.choiceIdentitySha256.length,5);
});

test('explicit senator-by-senator vote directions are tentative even if motion present',()=>{
  const sample=[
    'Chair moved to amend SF 100. Senator Koran requested a roll call vote.',
    'Senator Carlson - Nay Senator Westlin - Nay Senator Koran - Yea',
    'Senator Anderson - Yea Senator Bahr - Nay Senator Marty - Yea',
    'By a roll call vote of 3 Yeas and 3 Nays, the amendment failed.',
  ].join('\n');
  const x=extractSupplementalNamedSenateRollCandidates(sample);
  assert.ok(x.some(r=>r.pattern==='individual_named_directions'));
  assert.ok(x.some(r=>r.namedYeaCount===3 && r.namedNayCount===3));
  assert.ok(x.every(r=>r.candidateNotVerifiedVote));
});

test('attendance roll and voice action cannot create named member choices',()=>{
  const txt='Chair called the meeting to order. Roll call was taken for attendance. '
    +'Senator Latz present Senator Nelson absent. Motion passed on a voice vote.';
  assert.deepEqual(extractSupplementalNamedSenateRollCandidates(txt),[]);
});

test('same source name on both sides is rejected rather than fabricated vote',()=>{
  const txt='Senator Koran moved an amendment and requested a roll call vote. '
    +'Yes: Carlson, Marty No: Carlson, Limmer. Motion failed.';
  assert.deepEqual(extractSupplementalNamedSenateRollCandidates(txt),[]);
});

test('unbounded text fails closed and result never implies publication date or floor vote',()=>{
  assert.throws(()=>extractSupplementalNamedSenateRollCandidates('Hi'),/not bounded/);
  assert.throws(()=>extractSupplementalNamedSenateRollCandidates('a'.repeat(1_000_001)),/not bounded/);
});
