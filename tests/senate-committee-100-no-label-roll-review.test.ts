import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NO_LABEL_ROLL_EXPECTED,selectOriginalNoLabelRollPdfCandidates,triageOriginalNoLabelRollText,
} from '../src/evidence/senate-committee-100-no-label-roll-review.js';

test('the remaining 100 originally unparsed embedded-text roll-cue PDFs are not treated as 100 missing votes',()=>{
  assert.deepEqual(NO_LABEL_ROLL_EXPECTED,{2022:15,2023:60,2024:13,2025:12});
  assert.equal(Object.values(NO_LABEL_ROLL_EXPECTED).reduce((n,x)=>n+x,0),100);
  for(const y of [2022,2023,2024,2025] as const)
    assert.throws(()=>selectOriginalNoLabelRollPdfCandidates(y,'{}'),/source artifact hash differs/);
});
test('attendance roll only is distinct from a motion-related recorded vote',()=>{
  const src='The chair called the meeting to order. Roll call was taken. Quorum present. '+
    'Committee members present at this meeting were noted in the roster.';
  const r=triageOriginalNoLabelRollText(src);
  assert.equal(r.highestReviewCategory,'likely_attendance_roll');
  assert.equal(r.possibleNumericallyCountedRollCues,0);
  assert.equal(r.noNamedMemberChoicesDerived,true);
  assert.equal(r.noActualRecordedVoteDenominatorCertified,true);
  assert.ok(r.temporarySourceExcerptsForHumanAudit.length<=3);
});
test('source numeric tally is a possible count-only roll, never individually named choices',()=>{
  const src='A senator moved the amendment to SF 100. A roll call vote 6-5 was requested '+
    'and the amendment did not prevail. The chair noted the committee had voted.';
  const r=triageOriginalNoLabelRollText(src);
  assert.equal(r.highestReviewCategory,'possible_numbered_vote_or_division');
  assert.equal(r.possibleNumericallyCountedRollCues,1);
  assert.equal(r.noNamedMemberChoicesDerived,true);
  assert.equal(r.cueDetails[0]?.categoryNotVerifiedActualVote,true);
});
test('motion wording alone without numbered or named results remains a review cue',()=>{
  const src='A senator moved for a roll call vote on the amendment. The committee met in the hearing room.';
  const r=triageOriginalNoLabelRollText(src);
  assert.equal(r.highestReviewCategory,'motion_related_roll_language');
  assert.equal(r.possibleNumericallyCountedRollCues,0);
});
test('blank or unbounded original minute text fails closed',()=>{
  assert.throws(()=>triageOriginalNoLabelRollText('short'),/bounded source-only review/);
  assert.throws(()=>triageOriginalNoLabelRollText('X'.repeat(1_000_001)),/bounded source-only review/);
  assert.throws(()=>triageOriginalNoLabelRollText('This meeting involved only ordinary non-voting committee introductions and opening statements.'),/No roll-call phrase/);
});