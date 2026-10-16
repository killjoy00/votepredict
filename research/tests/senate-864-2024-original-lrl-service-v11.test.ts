import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeApprovedYeaV11SafeScalars,V11_SAFE_SCHEMA_VERSION,
 V11_OFFICIAL_SOURCE_KEYS} from
 '../../src/evidence/senate-864-2024-yea-v11-lrl-safe-scalars.js';
import {acquireOriginalLrl2024SenateYearService,
 ORIGINAL_864_LRL_2024_DIRECTORY_URL} from
 '../../src/evidence/senate-864-2024-lrl-year-service-directory.js';
import {YEA_V11_SAFE_PHASES} from
 '../../scripts/audit-senate-864-2024-one-yea-lrl-service-v11.js';

function sample(){
 return {
  schemaVersion:V11_SAFE_SCHEMA_VERSION,
  issue:864,
  sourceOriginalPDFHashAuthenticated:true,
  originalMissingSourceYeaFingerprints:1,
  storedExactChoiceIntersection:9,
  originalNamedRollChoices:10,storedNamedRollChoices:9,
  uniqueSourceNameInProtectedMemory:true,
  directMembershipOrAliasCandidateCount:0,
  membershipsWithBothDateBoundsCoveringHearingDay:0,
  exactActualServiceDateIndependentlyProven:false,
  rootCauseProven:false,storedRowRepairAuthorized:false,
  protectedReadOnlyTransaction:true,explicitRollback:true,
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
  originalLrlDirectoryShaIndependentlyVerified:true,
  officialDirectoryYearServiceNotExactHearingDay:true,
  officialDirectoryObservedIn2026NotContemporaneous2024:true,
 };
}
test('V11 accepts only exact source-safe enum and counts, retains 2026-vs-2024 temporal boundary',()=>{
 const raw=sample();const str=serializeApprovedYeaV11SafeScalars(raw);
 assert.deepEqual(JSON.parse(str),raw);
 assert.equal(Object.keys(raw).length,31);
 assert.equal(V11_OFFICIAL_SOURCE_KEYS.length,6);
 assert.equal(raw.exactActualServiceDateIndependentlyProven,false);
 assert.equal(raw.rootCauseProven,false);
});
test('V11 unknown source identity, alternate 2024 assumption, bad status or private fields fail closed',()=>{
 const alter=[
  {officialLrl2024YearResolverStatus:'found privately'},
  {officialLrl2024YearResolverStatus:'unmatched',officialLrl2024YearResolverReason:'unique_surname_form'},
  {officialLrl2024YearServiceCandidateCount:66},
  {officialLrl2024YearServiceCandidateCount:91},
  {officialLrl2024YearServiceCandidateCount:NaN},
  {originalLrlDirectoryShaIndependentlyVerified:false},
  {officialDirectoryYearServiceNotExactHearingDay:false},
  {officialDirectoryObservedIn2026NotContemporaneous2024:false},
  {historicalBackfillRosterCount:69},
  {historicalBackfillResolverStatus:'matched'},
  {directMembershipOrAliasCandidateCount:1},
  {exactActualServiceDateIndependentlyProven:true},
  {rootCauseProven:true},
  {privateOriginalName:'Should never serialize'},
  {sourceUrl:'https://example.private.invalid/source'},
 ];
 for(const row of alter)
  assert.throws(()=>serializeApprovedYeaV11SafeScalars({...sample(),...row}));
 assert.throws(()=>serializeApprovedYeaV11SafeScalars([]));
 assert.throws(()=>serializeApprovedYeaV11SafeScalars(null));
});
test('V11 government-original scope enforces exact URL, status, redirects and byte cap',async()=>{
 assert.equal(ORIGINAL_864_LRL_2024_DIRECTORY_URL,
  'https://www.lrl.mn.gov/legdb/senate_dir');
 assert.ok(YEA_V11_SAFE_PHASES.includes('original_lrl_sha_bound_recheck'));
 assert.ok(YEA_V11_SAFE_PHASES.includes('official_2024_year_service_reconciliation'));
 const missing=async()=>new Response('',{status:404,headers:{'content-type':'text/html'}});
 await assert.rejects(acquireOriginalLrl2024SenateYearService(undefined,missing as typeof fetch));
 const moved=async()=>new Response('',{status:200,headers:{'content-type':'text/html'}});
 await assert.rejects(acquireOriginalLrl2024SenateYearService(undefined,moved as typeof fetch));
 const tooBig=async()=>new Response('x',{status:200,headers:{
  'content-type':'text/html','content-length':'6000000',
 }});
 await assert.rejects(acquireOriginalLrl2024SenateYearService(undefined,tooBig as typeof fetch));
 await assert.rejects(acquireOriginalLrl2024SenateYearService('not-sha'));
});
