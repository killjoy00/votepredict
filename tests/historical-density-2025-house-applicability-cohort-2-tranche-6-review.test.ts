import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const decisions = JSON.parse(readFileSync('data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-6-decisions-v1.json','utf8'));

test('exact canonical 148-pair candidate proof and all 16 bill rationales', () => {
 assert.equal(decisions.schemaVersion,'historical-density-2025-house-applicability-cohort-2-tranche-6-decisions-v1');
 assert.equal(decisions.issue,718); assert.equal(decisions.session,'2025-2026');
 const a=decisions.frozenCandidateArtifact;
 assert.equal(a.runId,37810812989); assert.equal(a.artifactId,11564384052);
 assert.equal(a.digest,'sha256:5229e7cea919d127de0ded4e229d60ec7dcd6f3e0daa45f9c81758a4ac0cf3cf');
 assert.equal(a.contentSha256WithoutSelfField,'cd51b25e85453493374074c94d16b6c89c7f9aad8aa62221016b701f81ff41e1');
 assert.equal(a.reviewKeySha256,'a4b50b76692e36d6e8e15af11eeb832ae7d8329b819220a008670be21fb412b2');
 assert.equal(a.targetTrancheIndex,6); assert.equal(a.targetRankStart,126); assert.equal(a.targetRankEnd,150);
 assert.equal(a.targetEventKeySha256,'eafb3980bdbe20a94da1150e673e8d9218753bcea7f696863fc598f9b4abc072');
 assert.equal(a.eligibleClaimEventPairs,1050); assert.equal(a.candidatePairs,148);
 assert.equal(a.candidateBills,16); assert.equal(a.candidatePublicMembers,37); assert.equal(a.candidateSemanticGroups,37);
 const expectedBills=["HF3426","HF3489","HF3766","HF3875","HF3970","HF4052","HF4075","HF4146","HF4188","HF4224","HF4455","HF4493","SF3622","SF3868","SF3887","SF3958"];
 assert.deepEqual(Object.keys(decisions.defaultBillRationales).sort(),expectedBills);
 for (const rationale of Object.values(decisions.defaultBillRationales)) assert.ok(typeof rationale === 'string' && rationale.length > 40);
});

test('three exact applicable candidates and one explicit fail-closed ambiguity', () => {
 assert.equal(decisions.defaultDecision,'not_applicable');
 assert.equal(decisions.overrides.length,4);
 assert.deepEqual(decisions.overrides.filter((v: any)=>v.decision==='applicable').map((v: any)=>v.reviewKey).sort(),["bahner_hoa_cic_consumer_protection_reform|SF3622|2026-04-23|9613c6bf2bbd355d16a71fc55391e09ddbca14ba0a7c97fe28b6b6d83868bddc","harder_conservation_programs|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd","robbins_state_fraud_oversight_transparency|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd"]);
 assert.deepEqual(decisions.overrides.filter((v: any)=>v.decision==='ambiguous_fail_closed').map((v: any)=>v.reviewKey).sort(),["kresha_career_pathway_education_reform|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd"]);
 assert.equal(decisions.overrides.filter((v: any)=>v.alignmentDirection==='aligns').length,3);
 assert.equal(decisions.overrides.filter((v: any)=>v.alignmentDirection==='conflicts').length,0);
 for (const row of decisions.overrides) {
   assert.ok(row.reason && row.reason.length>90);
   if(row.decision==='applicable'){assert.ok(row.billPolicyDirection);assert.equal(row.alignmentDirection,'aligns');}
   else {assert.equal(row.billPolicyDirection,null);assert.equal(row.alignmentDirection,null);}
 }
});

test('outcome blind and integration-blocked; no production/model side-effects', () => {
 const p=decisions.policy;
 assert.equal(p.everyCandidateReviewed,true);
 assert.equal(p.applicableRequiresExplicitOverride,true);
 assert.equal(p.unlistedCandidateDecision,'unavailable_fail_closed');
 assert.equal(p.outcomeUse,'none'); assert.equal(p.targetVoteOutcomesRead,false);
 assert.equal(p.productionDatabaseQueried,false); assert.equal(p.productionWrites,false);
 assert.equal(p.vercelUsed,false); assert.equal(p.publicLrlIdentityOnly,true);
 assert.equal(p.internalMembershipIdentityResolved,false); assert.equal(p.internalIdentityRequiredBeforeFeatureIntegration,true);
 assert.equal(p.contextOnly,true); assert.equal(p.mechanicallyActionable,false); assert.equal(p.modelWeight,0);
 assert.equal(p.featureRowsWritten,false); assert.equal(p.modelFitting,'none'); assert.equal(p.servingChanged,false);
});
