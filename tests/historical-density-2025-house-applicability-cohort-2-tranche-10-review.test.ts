import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const decisions = JSON.parse(readFileSync('data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-10-decisions-v1.json', 'utf8'));

test('strictly pinned 174-candidate universe, genuine mixed-rank chronology and 19 exhaustive bill rationales', () => {
 assert.equal(decisions.schemaVersion, 'historical-density-2025-house-applicability-cohort-2-tranche-10-decisions-v1');
 assert.equal(decisions.issue, 718);assert.equal(decisions.session, '2025-2026');
 const f=decisions.frozenCandidateArtifact;
 assert.equal(f.runId,37836795789);assert.equal(f.artifactId,11575244373);
 assert.equal(f.digest,'sha256:7f4e038d45793474c4e46196c7fb06cc916ac533e271280c1cb307e406a6fd3f');
 assert.equal(f.contentSha256WithoutSelfField,'64b9217e6f9c01edc7e3742b992d47f77f7fc1a5939d778b828cef8a2f9af089');
 assert.equal(f.reviewKeySha256,'73700085a7053d976965283a38268929a219bd70512e2aa3b7c5cb3b8bdd5ee5');
 assert.equal(f.targetTrancheIndex,10);assert.equal(f.targetRankStart,226);assert.equal(f.targetRankEnd,250);
 assert.equal(f.targetEventKeySha256,'87cfaaec13743d7c7d97f2ea3b69f5f2cfb389320e356a4893991827ba023848');
 assert.equal(f.eligibleClaimEventPairs,858);
 assert.equal(f.ineligibleSourceNotYetAvailablePairs,192);
 assert.deepEqual(f.eligibleClaimEventPairsByTargetYear,{'2025':270,'2026':588});
 assert.equal(f.candidatePairs,174);assert.equal(f.candidateBills,19);
 assert.equal(f.candidatePublicMembers,42);assert.equal(f.candidateSemanticGroups,42);
 assert.deepEqual(Object.keys(decisions.defaultBillRationales).sort(),["HF124","HF129","HF13","HF20","HF21","HF23","HF2438","HF2484","HF286","HF289","HF3629","HF4591","HF719","SF1943","SF2077","SF4401","SF4476","SF4612","SF5200"]);
 for(const reason of Object.values(decisions.defaultBillRationales))assert.ok(typeof reason==='string' && reason.length>120);
});
test('four exact scoped positives, five deliberate source-meaning ambiguities and no decision by keyword', () => {
 assert.equal(decisions.defaultDecision,'not_applicable');assert.equal(decisions.overrides.length,9);
 const ofType=(d:string)=>decisions.overrides.filter((x:any)=>x.decision===d).map((x:any)=>x.reviewKey).sort();
 assert.deepEqual(ofType('applicable'),["harder_conservation_programs|SF2077|2026-05-17|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7","niska_attorney_general_data_transparency|HF20|2025-02-20|98e1e48b9758410a625b6dbf0b39515ef14096504adccc5670287b97b6b48ddd","robbins_state_fraud_oversight_transparency|HF23|2025-03-10|5e1311515995e16ecae919f370906498e2717cbef63d08b975910019f6f4566d","robbins_state_fraud_oversight_transparency|HF3629|2026-05-17|cd76ef81ad166a5167b9e6bea12386da8535303cc24043981f1d9bd7ada4a37d"]);
 assert.deepEqual(ofType('ambiguous_fail_closed'),["rarick_state_agency_fraud_reporting|HF3629|2026-05-17|cd76ef81ad166a5167b9e6bea12386da8535303cc24043981f1d9bd7ada4a37d","robbins_state_fraud_oversight_transparency|SF2077|2026-05-17|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7","robbins_state_fraud_oversight_transparency|SF4476|2026-05-17|f34f7c2c6c1b3fd6b3310ff41fe054163f1d795bf727556f0ac8d56a71da4327","robbins_state_fraud_oversight_transparency|SF4612|2026-05-17|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e","scott_childcare_abuse_safeguards|SF4612|2026-05-17|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e"]);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='aligns').length,4);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='conflicts').length,0);
 for(const x of decisions.overrides){
  assert.ok(x.reason.length>130);
  if(x.decision==='applicable'){assert.equal(x.alignmentDirection,'aligns');assert.ok(x.billPolicyDirection?.length>30);}
  else{assert.equal(x.billPolicyDirection,null);assert.equal(x.alignmentDirection,null);}
 }
});
test('no future sources, target outcomes, internal-identity inference or any production model/serving action', () => {
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
