import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseSenateCommitteeMinuteVotes} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {MEMBERSHIP_SQL,V10_HISTORICAL_ROSTER_SQL,YEA_V10_SAFE_PHASES,safeYeaV10Phase,recognizeMissing2024YeaNameInMemory,
  findUniqueMissing2024Choice} from
 '../scripts/audit-senate-864-2024-one-yea-backfill-roster-v10.js';

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

test('V10 protected errors expose only fixed phase labels, not raw names or exception details',()=>{
 assert.equal(YEA_V10_SAFE_PHASES.length,18);
 for(const phase of YEA_V10_SAFE_PHASES){
  assert.equal(safeYeaV10Phase(phase),phase);
  assert.match(phase,/^[a-z0-9_]{6,60}$/);
  assert.doesNotMatch(phase,/https?:|normalized_name|membership_id|choice_sha|person_name/);
 }
 for(const bad of ['https://private.example/one','stage SENATOR_A',
  'ROLLBACK;SELECT name FROM legislators','','one choice sha digest',null,0]){
  assert.throws(()=>safeYeaV10Phase(bad));
 }
});

import {YEA_V10_SAFE_SCHEMA_VERSION,YEA_V10_SAFE_ROSTER_KEYS,
 YEA_V10_SAFE_RESOLVER_REASONS,mapActualRosterResolverReason,
 serializeApprovedYeaV10SafeScalars} from
 '../src/evidence/senate-864-2024-yea-v10-roster-safe-scalars.js';

const exactlyAllowed={
 schemaVersion:YEA_V10_SAFE_SCHEMA_VERSION,
 issue:864,
 sourceOriginalPDFHashAuthenticated:true,
 originalMissingSourceYeaFingerprints:1,
 storedExactChoiceIntersection:9,
 originalNamedRollChoices:10,storedNamedRollChoices:9,
 uniqueSourceNameInProtectedMemory:true,
 directMembershipOrAliasCandidateCount:2,
 membershipsWithBothDateBoundsCoveringHearingDay:1,
 historicalBackfillRosterCount:68,
 historicalBackfillActiveCount:67,
 historicalBackfillResolverStatus:'matched',
 historicalBackfillResolverReason:'unique_surname_form',
 uniqueOriginalBackfillSourceFormInProtectedMemory:true,
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
test('V10 exact reviewed serializer accepts safety boolean name containing SourceURL',()=>{
 const data=serializeApprovedYeaV10SafeScalars(exactlyAllowed);
 const parsed=JSON.parse(data);
 assert.deepEqual(parsed,exactlyAllowed);
 assert.equal(Object.keys(parsed).length,25);
 assert.deepEqual(Object.keys(parsed).slice(-5),[...YEA_V10_SAFE_ROSTER_KEYS]);
 assert.equal(parsed.noMemberNameSourceURLRowIDOrFingerprintExported,true);
 assert.equal(parsed.rootCauseProven,false);
});
test('V10 exact reviewed serializer rejects all nonallowlisted or private fields',()=>{
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
  {...exactlyAllowed,historicalBackfillRosterCount:151},
  {...exactlyAllowed,historicalBackfillActiveCount:69},
  {...exactlyAllowed,historicalBackfillResolverStatus:'maybe'},
  {...exactlyAllowed,historicalBackfillResolverReason:'person name redacted'},
  {...exactlyAllowed,uniqueOriginalBackfillSourceFormInProtectedMemory:false},
  {...exactlyAllowed,historicalBackfillResolverStatus:'unmatched'},
  {...exactlyAllowed,storedNamedRollChoices:10},
  {...exactlyAllowed,schemaVersion:'senate-864-2024-single-yea-private-person-source-v9'},
 ];
 for(const input of samples){
  assert.throws(()=>serializeApprovedYeaV10SafeScalars(input));
 }
 const missing={...exactlyAllowed};
 delete (missing as Partial<typeof exactlyAllowed>).noMemberNameSourceURLRowIDOrFingerprintExported;
 assert.throws(()=>serializeApprovedYeaV10SafeScalars(missing));
 for(const bad of [null,[],false,'{}',Object.create(null)]){
  assert.throws(()=>serializeApprovedYeaV10SafeScalars(bad));
 }
});

import {activeMembershipCandidates,reconcileHouseMemberName} from
 '../src/sources/minnesota/member-reconciliation.js';

test('V10 roster SQL reproduces historical 2023-2024 Senate scope, bounded and SELECT-only',()=>{
 assert.match(V10_HISTORICAL_ROSTER_SQL,/^SELECT /);
 assert.match(V10_HISTORICAL_ROSTER_SQL,/s.slug=\$1/);
 assert.match(V10_HISTORICAL_ROSTER_SQL,/j.slug='us-mn'/);
 assert.match(V10_HISTORICAL_ROSTER_SQL,/c.slug='senate'/);
 assert.match(V10_HISTORICAL_ROSTER_SQL,/LIMIT 151$/);
 assert.doesNotMatch(V10_HISTORICAL_ROSTER_SQL,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|GRANT)\b/i);
});
test('exact string lookup zero cannot prove historical conservative surname match zero',()=>{
 const roster=[{membershipId:'mock1',legislatorId:'mock1',name:'Alice Cedar',
   normalizedName:'alice cedar',aliases:[],startsOn:'2023-01-01',endsOn:'2024-12-31'},
  {membershipId:'mock2',legislatorId:'mock2',name:'Bob Maple',
   normalizedName:'bob maple',aliases:[],startsOn:'2023-01-01',endsOn:'2024-12-31'}];
 const date='2024-02-14';
 const active=activeMembershipCandidates(roster,date);
 assert.equal(active.length,2);
 assert.equal(active.filter(x=>x.normalizedName==='cedar').length,0);
 const actual=reconcileHouseMemberName('Cedar',active);
 assert.equal(actual.status,'matched');
 assert.equal(mapActualRosterResolverReason(actual.reason),'unique_surname_form');
});
test('V10 reviewed reason enum maps precisely known original backfill reasons',()=>{
 const mapping=[
 ['exact normalized name or alias match','exact_normalized_or_alias'],
 ['surname and given-initial match','surname_given_initials'],
 ['unique surname-form match','unique_surname_form'],
 ['empty normalized source name','empty_normalized_source'],
 ['no conservative roster match','no_conservative_roster_match'],
 ] as const;
 assert.equal(YEA_V10_SAFE_RESOLVER_REASONS.length,mapping.length);
 for(const [reason,expected] of mapping)assert.equal(mapActualRosterResolverReason(reason),expected);
 assert.throws(()=>mapActualRosterResolverReason('untrusted data here'));
});
