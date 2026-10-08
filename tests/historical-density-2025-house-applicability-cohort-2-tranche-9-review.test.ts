import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const decisions = JSON.parse(readFileSync('data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-9-decisions-v1.json','utf8'));

test('canonical 249-candidate provenance, target ranks, and 18 per-bill false-positive rationales',()=>{
 assert.equal(decisions.schemaVersion,'historical-density-2025-house-applicability-cohort-2-tranche-9-decisions-v1');
 assert.equal(decisions.issue,718);assert.equal(decisions.session,'2025-2026');
 const f=decisions.frozenCandidateArtifact;
 assert.equal(f.runId,37832386938);assert.equal(f.artifactId,11574520636);
 assert.equal(f.digest,'sha256:be7841eb4a8e674dbfccfe1c0ad812ffb8b879788f62fb74fac92140b6878ee5');
 assert.equal(f.contentSha256WithoutSelfField,'94075055e81b5ffca109b31ef8a8359b3dfe3599ad2464476b3d45f649b6da00');
 assert.equal(f.reviewKeySha256,'8711d9c01aad8ba7b2d26d3ca89f294dfee6b9cc9769abc12e66e31aa2471de1');
 assert.equal(f.targetTrancheIndex,9);assert.equal(f.targetRankStart,201);assert.equal(f.targetRankEnd,225);
 assert.equal(f.targetEventKeySha256,'ee804ad6c0d65f64848a96c716e000146ca09e74ac00e31ca4a2be9d08896c3e');
 assert.equal(f.eligibleClaimEventPairs,1050);assert.equal(f.candidatePairs,249);
 assert.equal(f.candidateBills,18);assert.equal(f.candidatePublicMembers,41);assert.equal(f.candidateSemanticGroups,41);
 assert.deepEqual(Object.keys(decisions.defaultBillRationales).sort(),["HF1141","HF2433","HF3067","HF3426","HF3489","HF3900","HF4017","HF4074","HF4138","HF4188","HF4239","HF4240","HF4252","SF2373","SF3210","SF3432","SF4282","SF4760"]);
 for(const reason of Object.values(decisions.defaultBillRationales)){assert.ok(typeof reason==='string'&&reason.length>120);}
});
test('eight accepted exact bill versions and four explicit source-scope ambiguities',()=>{
 assert.equal(decisions.defaultDecision,'not_applicable');assert.equal(decisions.overrides.length,12);
 const pick=(d: string)=>decisions.overrides.filter((x:any)=>x.decision===d).map((x:any)=>x.reviewKey).sort();
 assert.deepEqual(pick('applicable'),["harder_conservation_programs|HF3426|2026-05-14|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd","hussein_well_resourced_public_schools|HF2433|2026-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4","hussein_well_resourced_public_schools|HF3900|2026-05-16|451f0b67f59f91d992043bf8e9b284fe1644cdb68e5f25f775467667211526fd","kresha_career_pathway_education_reform|HF2433|2026-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4","robbins_state_fraud_oversight_transparency|HF3426|2026-05-14|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd","robbins_state_fraud_oversight_transparency|HF4252|2026-05-16|a26de8c86d73a0aa59b5d63a3cdcb089bf8d3140d907eb480d2197bf87ed85e3","robbins_state_fraud_oversight_transparency|SF4760|2026-05-12|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f","wolgamott_teacher_workplace_pay_pension|HF4074|2026-05-13|279143937a67360ab8a6a8797b67771e1bb886afb89b758c23c3510bd020d4fb"]);
 assert.deepEqual(pick('ambiguous_fail_closed'),["kresha_career_pathway_education_reform|HF3426|2026-05-14|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd","kresha_career_pathway_education_reform|HF4252|2026-05-16|a26de8c86d73a0aa59b5d63a3cdcb089bf8d3140d907eb480d2197bf87ed85e3","rarick_state_agency_fraud_reporting|SF4760|2026-05-12|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f","wolgamott_teacher_workplace_pay_pension|HF2433|2026-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4"]);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='aligns').length,8);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='conflicts').length,0);
 for(const x of decisions.overrides){
  assert.ok(x.reason?.length>135);
  if(x.decision==='applicable'){assert.equal(x.alignmentDirection,'aligns');assert.ok(x.billPolicyDirection?.length>30);}
  else{assert.equal(x.billPolicyDirection,null);assert.equal(x.alignmentDirection,null);}
 }
});
test('locked out of target vote outcomes, internal-identity inference and all production/model writes',()=>{
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
