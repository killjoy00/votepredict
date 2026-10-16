import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseSenateCommitteeMinuteVotes} from '../../src/evidence/minnesota-senate-committee-minutes.js';
import {
  EDUCATION_2024_REPEATED_ROLL_SOURCE,
  audit2024EducationRepeatedAmendmentRolls,
  selectPinned2024EducationSource,
} from '../evidence/senate-2024-education-repeated-amendment-rolls.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const slate='4/6 (Ayes: Alpha, Bravo, Charlie, Delta; Nays: Echo, Foxtrot, Golf, Hotel, India, Juliet) MOTION FAILED';
const original=parseSenateCommitteeMinuteVotes(slate);
assert.equal(original.length,1);
const tokenSet=original[0]!.memberVotes
  .map(v=>sha(v.choice+':'+v.normalizedName)).sort();
const candidates=()=>[0,1].map(()=>({
  yeaCount:4,nayCount:6,namedMemberChoicesInPdf:10,
  individualVotesAvailable:true,
  choiceIdentitySha256:[...tokenSet],
}));
const amended=['10','2','3','5','6','9'];
const mockText=()=>[
  'Minnesota State Senate Education Policy Committee - Wednesday February 14, 2024.',
  'Present: Ten synthetic names. The source records six separate amendment motions.',
  ...amended.map(n=>
    'Senator Mock requested a roll call vote for the adoption of '+n+
    ' amendment. '+slate),
  'Senator Mock moved that the bill be recommended to pass. MOTION ADOPTED.',
].join('\n');

test('six distinct amendment motions retain all 60 choice occurrences despite identical slates',()=>{
  const result=audit2024EducationRepeatedAmendmentRolls(mockText(),candidates());
  assert.equal(result.originalRecordedAmendmentRolls,6);
  assert.equal(result.originallyParserRecognizedRollCandidates,2);
  assert.equal(result.candidateRollUndercountWithinThisOnePdf,4);
  assert.equal(result.distinctAmendmentMotionNumbersVerified,6);
  assert.equal(result.originalNamedChoiceOccurrencesAcrossActions,60);
  assert.equal(result.sameTenIndividualChoicesSourceAuthenticatedOnEachRoll,true);
  assert.equal(result.noSourceToDatabaseParityDeterminedForTheseSixActions,true);
  assert.equal(result.noDatabaseReadOrWrite,true);
  assert.ok(result.currentParserRecognizedRollCandidates>=1);
  assert.ok(result.currentParserRecognizedRollCandidates<=6);
  assert.equal(
    Object.keys(result).some(k=>/url|member_name|normalizedName|choiceIdentitySha256/i.test(k)),false);
  assert.equal(
    /Alpha|Bravo|Juliet|senate-committee:|https:/.test(JSON.stringify(result)),false);
});

test('the original 2024 SHA-pinned source metadata cannot be replaced or retargeted',()=>{
  assert.equal(EDUCATION_2024_REPEATED_ROLL_SOURCE.originalSourceRunId,38066441841);
  assert.equal(EDUCATION_2024_REPEATED_ROLL_SOURCE.originalArtifactId,11675315164);
  assert.equal(EDUCATION_2024_REPEATED_ROLL_SOURCE.originalPdfBytes,131315);
  assert.match(EDUCATION_2024_REPEATED_ROLL_SOURCE.originalMetadataSha256,/^[a-f0-9]{64}$/);
  assert.match(EDUCATION_2024_REPEATED_ROLL_SOURCE.originalPdfSha256,/^[a-f0-9]{64}$/);
  assert.match(EDUCATION_2024_REPEATED_ROLL_SOURCE.originalEmbeddedTextSha256,/^[a-f0-9]{64}$/);
  for(const corrupt of ['{}','[]','{"year":2024}','invalid']) {
    assert.throws(()=>selectPinned2024EducationSource(corrupt),
      /metadata SHA did not match/);
  }
});

test('fail closed on an additional unobserved roll-call request, not falsely count six',()=>{
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(
    mockText()+'\nSenator Extra requested a roll call vote.',candidates(),
  ),/Every original roll-call request/);
});

test('fail closed on duplicate or changed motion identity rather than collapsing slates',()=>{
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(
    mockText().replace('adoption of 9 amendment','adoption of 6 amendment'),candidates(),
  ),/separate numbered amendment/);
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(
    mockText().replace('adoption of 5 amendment','adoption of A5 amendment'),candidates(),
  ),/Every original roll-call request/);
});

test('changed tally, individual name choice or outcome invalidates original source audit',()=>{
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(
    mockText().replace('4/6 (Ayes:','3/7 (Ayes:'),candidates(),
  ),/individual motion result/);
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(
    mockText().replace('Nays: Echo,','Nays: Kilo,'),candidates(),
  ),/fingerprinted choices/);
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(
    mockText().replace('MOTION FAILED','MOTION PASSED'),candidates(),
  ),/individual motion result/);
});

test('historical manifest candidate identity drifts must never produce a pass',()=>{
  const changed=candidates();
  changed[0]!.choiceIdentitySha256[0]='0'.repeat(64);
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(mockText(),changed),
    /fingerprint baseline/);
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls(mockText(),[]),
    /baseline unverified/);
  assert.throws(()=>audit2024EducationRepeatedAmendmentRolls('',candidates()),
    /baseline unverified/);
});

test('attendance and context-only motion cannot become an extra individually recorded roll',()=>{
  const withAttendance=mockText().replace(
    'Present: Ten synthetic names.',
    'Present: Ten synthetic names; attendance roll called, all present.',
  );
  const result=audit2024EducationRepeatedAmendmentRolls(withAttendance,candidates());
  assert.equal(result.originalRecordedAmendmentRolls,6);
  assert.equal(result.originalNamedChoiceOccurrencesAcrossActions,60);
  assert.equal(result.noOfficialFullMeetingOrVoteDenominatorCertified,true);
});
