import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const decisions=JSON.parse(readFileSync('data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-8-decisions-v1.json','utf8'));

test('pinned canonical 202-candidate input, strict target ranks and all 17 per-bill rationales',()=>{
 assert.equal(decisions.schemaVersion,'historical-density-2025-house-applicability-cohort-2-tranche-8-decisions-v1');
 assert.equal(decisions.issue,718);assert.equal(decisions.session,'2025-2026');
 const f=decisions.frozenCandidateArtifact;
 assert.equal(f.runId,37823971961);assert.equal(f.artifactId,11569574820);
 assert.equal(f.digest,'sha256:a1394fc20a1849dc7a793652eadb102beeef494069db11a28b5ababcacd327cb');
 assert.equal(f.contentSha256WithoutSelfField,'33b0b3a5e6cc2fb048602327ddf8c1871f9b23a8ace41043e973b41ef751b47e');
 assert.equal(f.reviewKeySha256,'b2fc7027148305840b5ed147f37b8ac849af10e0a9f3ec2c779e22f58262fcd2');
 assert.equal(f.targetTrancheIndex,8);assert.equal(f.targetRankStart,176);assert.equal(f.targetRankEnd,200);
 assert.equal(f.targetEventKeySha256,'107c41146c0359bc186012674f663db64b4f791bb4fc4b7ac96e5d9dc90e3916');
 assert.equal(f.eligibleClaimEventPairs,1050);assert.equal(f.candidatePairs,202);
 assert.equal(f.candidateBills,17);assert.equal(f.candidatePublicMembers,42);assert.equal(f.candidateSemanticGroups,42);
 assert.deepEqual(Object.keys(decisions.defaultBillRationales).sort(),["HF3131","HF3295","HF3298","HF3682","HF4102","HF4195","HF4240","HF4348","HF4546","HF82","SF3432","SF3637","SF4244","SF4476","SF4612","SF476","SF856"]);
 for(const x of Object.values(decisions.defaultBillRationales))assert.ok(typeof x==='string'&&x.length>100);
});
test('exactly two substantive positives and five justified semantic fail-closed keys',()=>{
 assert.equal(decisions.defaultDecision,'not_applicable');
 assert.equal(decisions.overrides.length,7);
 const pick=(d:string)=>decisions.overrides.filter((x:any)=>x.decision===d).map((x:any)=>x.reviewKey).sort();
 assert.deepEqual(pick('applicable'),["robbins_state_fraud_oversight_transparency|HF3682|2026-05-07|351337d5d9ac24b4854df3fcbb1ec9b936f7e9a754931e7d3a428446b5565bdf","robbins_state_fraud_oversight_transparency|SF856|2026-05-07|c0d7ecb994fe0b30b768f27eb54caf88d21b75e4e01f427519bc05686a1417dc"]);
 assert.deepEqual(pick('ambiguous_fail_closed'),["harder_conservation_programs|HF3298|2026-05-07|48fb7d0cbfbae373980cae10b6ee9001e3d5ebae9142afc988c906d7febd496a","rarick_state_agency_fraud_reporting|SF856|2026-05-07|c0d7ecb994fe0b30b768f27eb54caf88d21b75e4e01f427519bc05686a1417dc","robbins_state_fraud_oversight_transparency|SF4476|2026-05-11|f34f7c2c6c1b3fd6b3310ff41fe054163f1d795bf727556f0ac8d56a71da4327","robbins_state_fraud_oversight_transparency|SF4612|2026-05-07|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e","scott_childcare_abuse_safeguards|SF4612|2026-05-07|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e"]);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='aligns').length,2);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='conflicts').length,0);
 for(const row of decisions.overrides){
  assert.ok(row.reason?.length>120);
  if(row.decision==='applicable'){assert.equal(row.alignmentDirection,'aligns');assert.ok(row.billPolicyDirection?.length>30);}
  else{assert.equal(row.billPolicyDirection,null);assert.equal(row.alignmentDirection,null);}
 }
});
test('no outcomes or serving/model writes; immutable source cannot resolve internal identity',()=>{
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
