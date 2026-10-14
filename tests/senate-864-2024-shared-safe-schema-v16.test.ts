import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serializeApprovedYeaV15SafeScalars,V15_SAFE_SCHEMA_VERSION,
 V15_OFFICIAL_SOURCE_KEYS} from
 '../src/evidence/senate-864-2024-yea-v15-lrl-semantic-safe-scalars.js';
import {SENATE_864_YEA_V9_SAFE_KEYS} from
 '../src/evidence/senate-864-2024-yea-v9-safe-scalars.js';
import {YEA_V10_SAFE_ROSTER_KEYS} from
 '../src/evidence/senate-864-2024-yea-v10-roster-safe-scalars.js';
import {YEA_V16_SAFE_PHASES,safeYeaV16Phase} from
 '../scripts/audit-senate-864-2024-one-yea-shared-safe-schema-v16.js';

function fixture(){
 return {
  schemaVersion:V15_SAFE_SCHEMA_VERSION,issue:864,
  sourceOriginalPDFHashAuthenticated:true,
  originalMissingSourceYeaFingerprints:1,
  storedExactChoiceIntersection:9,
  originalNamedRollChoices:10,
  storedNamedRollChoices:9,
  uniqueSourceNameInProtectedMemory:true,
  directMembershipOrAliasCandidateCount:0,
  membershipsWithBothDateBoundsCoveringHearingDay:0,
  exactActualServiceDateIndependentlyProven:false,
  rootCauseProven:false,
  storedRowRepairAuthorized:false,
  protectedReadOnlyTransaction:true,
  explicitRollback:true,
  noMemberNameSourceURLRowIDOrFingerprintExported:true,
  existingDefaultBranchNotVerifiedDeployedProductionBinding:true,
  print2021Print2022And141NoPdfMeetingsUnresolved:true,
  officialCompleteCommitteeVoteUniverseNotCertified:true,
  issue864Open:true,
  historicalBackfillRosterCount:68,
  historicalBackfillActiveCount:67,
  historicalBackfillResolverStatus:'unmatched',
  historicalBackfillResolverReason:'no_conservative_roster_match',
  uniqueOriginalBackfillSourceFormInProtectedMemory:true,
  officialLrl2024YearServiceCandidateCount:68,
  officialLrl2024YearResolverStatus:'matched',
  officialLrl2024YearResolverReason:'unique_surname_form',
  officialLrl2024ServiceDigestMatchedPresecret:true,
  separateLrlOriginalBytesAuthenticated:true,
  originalLrlRawHtmlByteEqualityNotClaimed:true,
  officialDirectoryYearServiceNotExactHearingDay:true,
  officialDirectoryObservedIn2026NotContemporaneous2024:true,
 };
}
test('V15 exact 33-field scalar output honestly labels service digest, not original raw HTML equality',()=>{
 const value=fixture();
 const result=JSON.parse(serializeApprovedYeaV15SafeScalars(value));
 assert.deepEqual(result,value);
 assert.equal(Object.keys(value).length,33);
 assert.equal(V15_OFFICIAL_SOURCE_KEYS.length,8);
 assert.equal(result.officialLrl2024ServiceDigestMatchedPresecret,true);
 assert.equal(result.originalLrlRawHtmlByteEqualityNotClaimed,true);
 assert.equal(result.exactActualServiceDateIndependentlyProven,false);
 assert.equal(result.rootCauseProven,false);
});
test('V15 fails closed on old raw-SHA-equivalence claim, private names, unsupported rights or changed V10 cohort',()=>{
 const invalid:Record<string,unknown>[]=[
  {originalLrlDirectoryShaIndependentlyVerified:true},
  {memberIdentity:'SYNTHETIC PRIVATE TEST'},
  {sourceUrl:'https://not-allowed.invalid/2024.pdf'},
  {choiceSha256:'1'.repeat(64)},
  {officialLrl2024ServiceDigestMatchedPresecret:false},
  {separateLrlOriginalBytesAuthenticated:false},
  {originalLrlRawHtmlByteEqualityNotClaimed:false},
  {officialDirectoryYearServiceNotExactHearingDay:false},
  {officialDirectoryObservedIn2026NotContemporaneous2024:false},
  {historicalBackfillRosterCount:67},
  {historicalBackfillActiveCount:68},
  {historicalBackfillResolverStatus:'matched'},
  {officialLrl2024YearServiceCandidateCount:99},
  {officialLrl2024YearResolverStatus:'ambiguous',officialLrl2024YearResolverReason:'no_conservative_roster_match'},
  {officialLrl2024YearResolverStatus:'uncertain'},
  {explicitRollback:false},
  {rootCauseProven:true},
  {storedRowRepairAuthorized:true},
  {exactActualServiceDateIndependentlyProven:true},
  {schemaVersion:'senate-864-2024-one-yea-lrl-original-year-roster-v11'},
 ];
 for(const changes of invalid)assert.throws(()=>serializeApprovedYeaV15SafeScalars({
  ...fixture(),...changes,
 }));
});
test('V15 keyless and protected strict allowlists use the same 33 fields and fixed 20 phases',()=>{
 const workflow=readFileSync(
  '.github/workflows/senate-864-2024-single-yea-shared-safe-schema-v16.yml','utf8');
 const keys=workflow.match(/const allowed=\('([^']+)'\)\.split\(' '\);/);
 assert.ok(keys);
 assert.deepEqual(keys[1]!.split(' ').sort(),
  [...SENATE_864_YEA_V9_SAFE_KEYS,...YEA_V10_SAFE_ROSTER_KEYS,
   ...V15_OFFICIAL_SOURCE_KEYS].sort());
 const phases=workflow.match(/const approvedPhases=\('([^']+)'\)\.split\(' '\);/);
 assert.ok(phases);
 assert.deepEqual(phases[1]!.split(' '),[...YEA_V16_SAFE_PHASES]);
 assert.ok(phases[1]!.includes('original_lrl_2024_semantic_bound_recheck'));
 assert.equal(safeYeaV16Phase('original_lrl_2024_semantic_bound_recheck'),
  'original_lrl_2024_semantic_bound_recheck');
 assert.throws(()=>safeYeaV16Phase('private member leak'));
 assert.equal(workflow.includes("approvedPhases.includes(raw)?raw:'unclassified'"),true);
});
test('V16 script uses two public originals, exact canonical SHA and existing SHA-pinned private PDF/rollback',()=>{
 const script=readFileSync(
  'scripts/audit-senate-864-2024-one-yea-shared-safe-schema-v16.ts','utf8');
 assert.match(script,/const first=await acquireOriginalLrl2024SenateYearServiceSemanticV14\(\)/);
 assert.match(script,/const second=await acquireOriginalLrl2024SenateYearServiceSemanticV14\(\)/);
 assert.match(script,/first\.semantic2024ServiceSha256!==second\.semantic2024ServiceSha256/);
 assert.match(script,/acquireOriginalLrl2024SenateYearServiceSemanticV14\(directoryExpected\)/);
 assert.match(script,/rehydrateShaPinned2024Original/);
 assert.match(script,/await client\.query\('ROLLBACK'\)/);
 assert.doesNotMatch(script,/insert into vote_events|update memberships|delete from member_votes/i);
 assert.equal(script.includes('originalLrlDirectoryShaIndependentlyVerified'),false);
});

test('V16 protected producer and approved serializer share the EXACT version constant (V15 bug regression)',()=>{
 const script=readFileSync(
  'scripts/audit-senate-864-2024-one-yea-shared-safe-schema-v16.ts','utf8');
 const workflow=readFileSync(
  '.github/workflows/senate-864-2024-single-yea-shared-safe-schema-v16.yml','utf8');
 assert.match(script,/import \{serializeApprovedYeaV15SafeScalars,V15_SAFE_SCHEMA_VERSION\} from/);
 assert.match(script,/return\{\s*schemaVersion:V15_SAFE_SCHEMA_VERSION,/);
 assert.match(script,/serializeApprovedYeaV15SafeScalars\(safe\)/);
 assert.doesNotMatch(script,/schemaVersion:'senate-864-2024-single-yea-private-person-source-v16'/);
 assert.match(workflow,/x\.schemaVersion!=='senate-864-2024-one-yea-lrl-original-year-roster-v15'/);
 assert.equal(V15_SAFE_SCHEMA_VERSION,'senate-864-2024-one-yea-lrl-original-year-roster-v15');
 assert.equal(JSON.parse(serializeApprovedYeaV15SafeScalars(fixture())).schemaVersion,
  V15_SAFE_SCHEMA_VERSION);
 assert.match(workflow,/SENATE_864_2024_MISSING_YEA_SHARED_SAFE_SCHEMA_V16_20261013/);
 assert.match(script,/SENATE_864_2024_MISSING_YEA_SHARED_SAFE_SCHEMA_V16_20261013/);
});
