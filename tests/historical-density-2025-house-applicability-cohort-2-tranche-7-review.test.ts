import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const decisions = JSON.parse(readFileSync('data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-7-decisions-v1.json','utf8'));

test('canonical 169-pair tranche-7 pins, source manifest and all 17 bill rationales', () => {
 assert.equal(decisions.schemaVersion,'historical-density-2025-house-applicability-cohort-2-tranche-7-decisions-v1');
 assert.equal(decisions.issue,718); assert.equal(decisions.session,'2025-2026');
 const f=decisions.frozenCandidateArtifact;
 assert.equal(f.runId,37818931593); assert.equal(f.artifactId,11569180060);
 assert.equal(f.digest,'sha256:1a80f0d5fabe6526a8b34e1dfc3ca01cab5236439ac02019499d0d1c82d5986d');
 assert.equal(f.contentSha256WithoutSelfField,'1d8265f8d9f67ca35d1f46c369d84f07b7262984c880000fd0b2fc2d31d967e3');
 assert.equal(f.reviewKeySha256,'795b2caffcc871bde906213ca2557b62a49d84def52d4ce7e2c5d112a9ef526c');
 assert.equal(f.targetTrancheIndex,7); assert.equal(f.targetRankStart,151); assert.equal(f.targetRankEnd,175);
 assert.equal(f.targetEventKeySha256,'3d994198b510f648867bb0804b25ff201328c6dd0628d901ff33579b43f1378f');
 assert.equal(f.eligibleClaimEventPairs,1050); assert.equal(f.candidatePairs,169);
 assert.equal(f.candidateBills,17); assert.equal(f.candidatePublicMembers,39); assert.equal(f.candidateSemanticGroups,39);
 assert.deepEqual(Object.keys(decisions.defaultBillRationales).sort(),["HF1082","HF1141","HF1270","HF3532","HF3684","HF3732","HF3900","HF3919","HF3972","HF4063","HF4151","HF4252","HF4462","SF1750","SF3888","SF4760","SF4807"]);
 for(const s of Object.values(decisions.defaultBillRationales)) assert.ok(typeof s==='string' && s.length>100);
});

test('five grounded applicable and two explicit fail-closed ambiguity keys', () => {
 assert.equal(decisions.defaultDecision,'not_applicable');assert.equal(decisions.overrides.length,7);
 const matching=(label: string)=>decisions.overrides.filter((x: any)=>x.decision===label).map((x: any)=>x.reviewKey).sort();
 assert.deepEqual(matching('applicable'),["bahner_hoa_cic_consumer_protection_reform|SF1750|2026-04-30|507c078c9b020f046b73d0f1ebb112d01049c907abb5a0696c4a16cf7b1ada86","hussein_well_resourced_public_schools|HF3900|2026-05-04|f355b5a1454a31f95ed4abf0128b08687f76d84ba19e5968d2643fc98ad6d5d2","robbins_state_fraud_oversight_transparency|HF3684|2026-05-04|221715130568be0e8d320d4bc36881b88f90e5e6c99f18a13a4f7033748a33cb","robbins_state_fraud_oversight_transparency|HF4252|2026-05-04|3f8ce2b77740c67ba6e55aca1889ceed08b0486520ef83d1de43a3f1f6a30033","robbins_state_fraud_oversight_transparency|SF4760|2026-04-30|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f"]);
 assert.deepEqual(matching('ambiguous_fail_closed'),["kresha_career_pathway_education_reform|HF3732|2026-05-04|d63e816a16cae41548b817b23d984b7aec1ee38d986ab1a8cbbb751f2b844a8e","rarick_state_agency_fraud_reporting|SF4760|2026-04-30|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f"]);
 assert.equal(decisions.overrides.filter((x: any)=>x.alignmentDirection==='aligns').length,5);
 assert.equal(decisions.overrides.filter((x: any)=>x.alignmentDirection==='conflicts').length,0);
 for(const row of decisions.overrides){
  assert.ok(row.reason?.length>100);
  if(row.decision==='applicable'){assert.equal(row.alignmentDirection,'aligns');assert.ok(row.billPolicyDirection?.length>30);}
  else {assert.equal(row.billPolicyDirection,null);assert.equal(row.alignmentDirection,null);}
 }
});

test('strictly context-only outcomes-blind non-serving and identity unresolved', () => {
 const p=decisions.policy;
 assert.equal(p.everyCandidateReviewed,true);assert.equal(p.applicableRequiresExplicitOverride,true);
 assert.equal(p.ambiguousRequiresExplicitOverride,true);assert.equal(p.unlistedCandidateDecision,'unavailable_fail_closed');
 assert.equal(p.outcomeUse,'none');assert.equal(p.targetVoteOutcomesRead,false);
 assert.equal(p.productionDatabaseQueried,false);assert.equal(p.productionWrites,false);assert.equal(p.vercelUsed,false);
 assert.equal(p.publicLrlIdentityOnly,true);assert.equal(p.internalMembershipIdentityResolved,false);
 assert.equal(p.internalIdentityRequiredBeforeFeatureIntegration,true);assert.equal(p.contextOnly,true);
 assert.equal(p.mechanicallyActionable,false);assert.equal(p.modelWeight,0);assert.equal(p.featureRowsWritten,false);
 assert.equal(p.modelFitting,'none');assert.equal(p.servingChanged,false);
});
