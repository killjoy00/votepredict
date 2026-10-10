import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HIGH_SIGNAL_PDF_EXPECTED,
  loadStrongRollSourceManifest,
  triageOriginalRollCueText,
} from '../src/evidence/senate-committee-41-strong-roll-original-review.js';

test('pinned source proof denominators do not include attendance-only or 2021 print records',()=>{
  assert.deepEqual(HIGH_SIGNAL_PDF_EXPECTED,{2022:2,2023:14,2024:13,2025:12});
  assert.equal(Object.values(HIGH_SIGNAL_PDF_EXPECTED).reduce((a,b)=>a+b,0),41);
  for(const year of [2022,2023,2024,2025] as const){
    assert.throws(()=>loadStrongRollSourceManifest(year,'{}'),
      /candidate source JSON digest differs/);
    assert.throws(()=>loadStrongRollSourceManifest(year,'[]'),
      /candidate source JSON digest differs/);
  }
});

test('attendance roll and YEA/NAY text anywhere else must not be inferred as a documented vote',()=>{
  const source='The chair called the committee to order. Roll call was taken. Members were present.\n'.repeat(6)
    +'Ayes: Senator Anderson\nNays: Senator Becker\n'.repeat(2);
  const stats=triageOriginalRollCueText(source);
  assert.equal(stats.rollCallPhraseCount,6);
  assert.equal(stats.ayeNayTextLabelCount,4);
  assert.equal(stats.cuesWithBothMotionAndAyeNayLabel,0);
  assert.equal(stats.motionAndLabelsRequireExactSourceVerification,true);
  assert.equal(stats.keywordIsNotVerifiedVote,true);
  assert.ok(stats.boundedEphemeralOfficialSourcePreview.length<=3);
  for(const s of stats.boundedEphemeralOfficialSourcePreview)
    assert.ok(s.text.length<=220);
});

test('concurrent words of motion, roll call and labels remain candidates not votes',()=>{
  const source=[
    'A bill was reviewed and a motion made regarding SF 55.',
    'A roll call vote was ordered on the amendment.',
    'Ayes: Chair Smith, Senator Jones.',
    'Nays: Senator Brown.',
    'The motion prevailed.',
  ].join('\n');
  const x=triageOriginalRollCueText(source);
  assert.equal(x.rollCallPhraseCount,1);
  assert.equal(x.ayeNayTextLabelCount,2);
  assert.ok(x.cuesWithBothMotionAndAyeNayLabel>=1);
  assert.equal(x.keywordIsNotVerifiedVote,true);
  assert.equal(x.cueStats.length,1);
  assert.equal(x.nearLabel.length,2);
  assert.match(x.textSha256,/^[a-f0-9]{64}$/);
  assert.ok(x.boundedEphemeralOfficialSourcePreview.every(
    s=>s.text.length<=220));
});

test('unbounded raw source text is refused',()=>{
  assert.throws(()=>triageOriginalRollCueText('short'),/outside bounded/);
  assert.throws(()=>triageOriginalRollCueText('x'.repeat(1_000_001)),/outside bounded/);
});
