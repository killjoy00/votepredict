import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const decisions = JSON.parse(readFileSync('data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-11-decisions-v1.json','utf8'));

test('final ranked 14 targets and exact frozen candidate evidence with future sources excluded',()=>{
 assert.equal(decisions.schemaVersion,'historical-density-2025-house-applicability-cohort-2-tranche-11-decisions-v1');
 assert.equal(decisions.issue,718);assert.equal(decisions.session,'2025-2026');
 const f=decisions.frozenCandidateArtifact;
 assert.equal(f.runId,37839924268);assert.equal(f.artifactId,11576828710);
 assert.equal(f.digest,'sha256:b6ff18a1c4dd93bac6179ebc454a160db7ac68b7840aa4713523e056bc7d169b');
 assert.equal(f.contentSha256WithoutSelfField,'072b44fdc09980bbee25b1f807164361af612113d1f3551bc59ef9efc4397ecd');
 assert.equal(f.reviewKeySha256,'b6eb850b70a1d50beb3f5e343b0444c09b479169b27abec1140e477ee50653bc');
 assert.equal(f.targetTrancheIndex,11);assert.equal(f.targetRankStart,251);assert.equal(f.targetRankEnd,264);
 assert.equal(f.targetEventKeySha256,'3d4d83276928f170726e2a499c2422eac2ede373f711bcdcfdca29c542e95242');
 assert.equal(f.eligibleClaimEventPairs,474);assert.equal(f.ineligibleSourceNotYetAvailablePairs,114);
 assert.deepEqual(f.eligibleClaimEventPairsByTargetYear,{'2025':432,'2026':42});
 assert.equal(f.candidatePairs,29);assert.equal(f.candidateBills,10);
 assert.equal(f.candidatePublicMembers,18);assert.equal(f.candidateSemanticGroups,18);
 assert.deepEqual(Object.keys(decisions.defaultBillRationales).sort(),["HF1034","HF1401","HF1443","HF24","HF25","HF3826","HF4","HF438","HF747","SF1552"]);
 for(const reason of Object.values(decisions.defaultBillRationales))assert.ok(typeof reason==='string'&&reason.length>120);
});
test('two exact positive sources, two explicit semantic ambiguities, and no transfer by topic-only nomination',()=>{
 assert.equal(decisions.defaultDecision,'not_applicable');assert.equal(decisions.overrides.length,4);
 const choose=(d:string)=>decisions.overrides.filter((x:any)=>x.decision===d).map((x:any)=>x.reviewKey).sort();
 assert.deepEqual(choose('applicable'),["perryman_surplus_taxpayer_refunds|HF4|2025-03-17|2d8bc31c73f5eca6b3f775a670597b3a7e97dd1098199f4b9b7cfa71dc5e6cb5","robbins_state_fraud_oversight_transparency|HF3826|2026-04-20|ad53562ff7410b899f9cd34ecb296233ed98852b70d45beb0c4b1d5428e92e6c"]);
 assert.deepEqual(choose('ambiguous_fail_closed'),["hortman_protect_abortion_access_transgender_minnesotans|HF25|2025-03-13|109baa6835ed45ccd9f091a7800dc35fe235ce247d54275698ee8c68349ed8ce","rarick_state_agency_fraud_reporting|HF3826|2026-04-20|ad53562ff7410b899f9cd34ecb296233ed98852b70d45beb0c4b1d5428e92e6c"]);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='aligns').length,2);
 assert.equal(decisions.overrides.filter((x:any)=>x.alignmentDirection==='conflicts').length,0);
 for(const x of decisions.overrides){assert.ok(x.reason.length>140);
  if(x.decision==='applicable'){assert.equal(x.alignmentDirection,'aligns');assert.ok(x.billPolicyDirection?.length>35);}
  else{assert.equal(x.billPolicyDirection,null);assert.equal(x.alignmentDirection,null);}
 }
});
test('public identity unresolved: no outcomes, production database, Vercel, feature, model or serving effects',()=>{
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
