import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseSenateCommitteeMinuteVotes} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {MEMBERSHIP_SQL,YEA_V9_SAFE_PHASES,safeYeaV9Phase,recognizeMissing2024YeaNameInMemory,
  findUniqueMissing2024Choice} from
 '../scripts/audit-senate-864-2024-one-yea-exact-output-v9.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const text='S.F. 100 was before the committee.\n'+
 'Senator Mock requested a roll call vote for the adoption of 10 amendment.\n'+
 '4/6 (Ayes: Alpha, Beta, Gamma, Delta; Nays: Epsilon, Zeta, Eta, Theta, Iota, Kappa) MOTION FAILED.';
const row=parseSenateCommitteeMinuteVotes(text)[0]!;
const all=row.memberVotes.map(x=>sha(x.choice+':'+x.normalizedName)).sort();
const pdf={document:{year:2024,committeeName:'Mock',meetingDate:'2024-02-01',
 sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2024/mock/20240201/mock_Minutes.pdf',
 originalRawPdfSha256:'a'.repeat(64)},
 voteObservations:[{externalKey:'test',yeaCount:4,nayCount:6,
  individualVotesAvailable:true,namedMemberChoicesInPdf:10,choiceIdentitySha256:all}],
};
test('unique YEA source name is reconstructed only from matching original choices',()=>{
 assert.equal(row.memberVotes.length,10);
 const fingerprint=sha('yea:'+row.memberVotes[0]!.normalizedName);
 assert.equal(recognizeMissing2024YeaNameInMemory(fingerprint,text,pdf),
  row.memberVotes[0]!.normalizedName);
 assert.throws(()=>recognizeMissing2024YeaNameInMemory(sha('yea:AbsentMock'),text,pdf));
});
test('same original number with altered original choice set fails closed',()=>{
 const mutated={...pdf,voteObservations:pdf.voteObservations.map(x=>({
  ...x,choiceIdentitySha256:[sha('yea:Unexpected'),...x.choiceIdentitySha256.slice(1)]
 }))};
 assert.throws(()=>recognizeMissing2024YeaNameInMemory(sha('yea:'+row.memberVotes[0]!.normalizedName),text,mutated));
});
test('protected-only membership SQL is SELECT-only and parameter bound',()=>{
 assert.match(MEMBERSHIP_SQL,/^SELECT /);
 assert.match(MEMBERSHIP_SQL,/lower\(\$1\)/);
 assert.match(MEMBERSHIP_SQL,/LIMIT 31$/);
 assert.doesNotMatch(MEMBERSHIP_SQL,/insert|update|delete|create|alter|drop|grant/i);
 assert.throws(()=>findUniqueMissing2024Choice([],{documents:[],events:[],choices:[]}));
});

test('V9 protected errors expose only fixed phase labels, not raw names or exception details',()=>{
 assert.equal(YEA_V9_SAFE_PHASES.length,15);
 for(const phase of YEA_V9_SAFE_PHASES){
  assert.equal(safeYeaV9Phase(phase),phase);
  assert.match(phase,/^[a-z0-9_]{6,60}$/);
  assert.doesNotMatch(phase,/https?:|normalized_name|membership_id|choice_sha|person_name/);
 }
 for(const bad of ['https://private.example/one','stage SENATOR_A',
  'ROLLBACK;SELECT name FROM legislators','','one choice sha digest',null,0]){
  assert.throws(()=>safeYeaV9Phase(bad));
 }
});

import {SENATE_864_YEA_V9_SAFE_KEYS,V9_SAFE_SCHEMA_VERSION,
 serializeApprovedYeaV9SafeScalars} from
 '../src/evidence/senate-864-2024-yea-v9-safe-scalars.js';

const exactlyAllowed={
 schemaVersion:V9_SAFE_SCHEMA_VERSION,
 issue:864,
 sourceOriginalPDFHashAuthenticated:true,
 originalMissingSourceYeaFingerprints:1,
 storedExactChoiceIntersection:9,
 originalNamedRollChoices:10,storedNamedRollChoices:9,
 uniqueSourceNameInProtectedMemory:true,
 directMembershipOrAliasCandidateCount:2,
 membershipsWithBothDateBoundsCoveringHearingDay:1,
 exactActualServiceDateIndependentlyProven:false,
 rootCauseProven:false,
 storedRowRepairAuthorized:false,
 protectedReadOnlyTransaction:true,explicitRollback:true,
 noMemberNameSourceURLRowIDOrFingerprintExported:true,
 existingDefaultBranchNotVerifiedDeployedProductionBinding:true,
 print2021Print2022And141NoPdfMeetingsUnresolved:true,
 officialCompleteCommitteeVoteUniverseNotCertified:true,
 issue864Open:true,
};
test('V9 exact reviewed serializer accepts safety boolean name containing SourceURL',()=>{
 const data=serializeApprovedYeaV9SafeScalars(exactlyAllowed);
 const parsed=JSON.parse(data);
 assert.deepEqual(parsed,exactlyAllowed);
 assert.equal(Object.keys(parsed).length,20);
 assert.deepEqual(Object.keys(parsed),[...SENATE_864_YEA_V9_SAFE_KEYS]);
 assert.equal(parsed.noMemberNameSourceURLRowIDOrFingerprintExported,true);
 assert.equal(parsed.rootCauseProven,false);
});
test('V9 exact reviewed serializer rejects all nonallowlisted or private fields',()=>{
 const samples=[
  {...exactlyAllowed,sourceUrl:'https://fake.private.invalid/minutes.pdf'},
  {...exactlyAllowed,privateMemberName:'UNSAFE TEST PERSON'},
  {...exactlyAllowed,choiceIdentitySha256:'a'.repeat(64)},
  {...exactlyAllowed,anotherObject:{fullSourceText:'private'}},
  {...exactlyAllowed,issue:863},
  {...exactlyAllowed,sourceOriginalPDFHashAuthenticated:false},
  {...exactlyAllowed,explicitRollback:false},
  {...exactlyAllowed,rootCauseProven:true},
  {...exactlyAllowed,directMembershipOrAliasCandidateCount:31},
  {...exactlyAllowed,directMembershipOrAliasCandidateCount:-1},
  {...exactlyAllowed,directMembershipOrAliasCandidateCount:NaN},
  {...exactlyAllowed,membershipsWithBothDateBoundsCoveringHearingDay:3},
  {...exactlyAllowed,membershipsWithBothDateBoundsCoveringHearingDay:'1'},
  {...exactlyAllowed,storedNamedRollChoices:10},
  {...exactlyAllowed,schemaVersion:'senate-864-2024-single-yea-private-person-source-v8'},
 ];
 for(const input of samples){
  assert.throws(()=>serializeApprovedYeaV9SafeScalars(input));
 }
 const missing={...exactlyAllowed};
 delete (missing as Partial<typeof exactlyAllowed>).noMemberNameSourceURLRowIDOrFingerprintExported;
 assert.throws(()=>serializeApprovedYeaV9SafeScalars(missing));
 for(const bad of [null,[],false,'{}',Object.create(null)]){
  assert.throws(()=>serializeApprovedYeaV9SafeScalars(bad));
 }
});
