import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PATH='data/evaluation/evidence-quality/historical-density-p2-remaining-applicability-decisions-v1.json';
const EXPECTED_APPLICABLE=[
'coleman_parental_education_control|SF2575|2022-03-03|83db51b7fa5e3a6353e230e1ed06f53a575dea3799b84e1db96c98e212ab4b08',
'coleman_parental_education_control|SF2666|2022-03-10|b77450cd3d4f5aef808ccfecae2d8f450720c914fee4b5128d17991a76cba157',
'duckworth_parental_education_choice|SF2575|2022-03-03|83db51b7fa5e3a6353e230e1ed06f53a575dea3799b84e1db96c98e212ab4b08',
'utke_law_enforcement_resources|SF2848|2022-02-14|3cca18a4ee2165800bb297f006f77a0f740fc73a9c9030c09f6a4b33cf66aacb',
].sort();

test('remaining P2 gate freezes the exact reviewed candidate set and fail-closed decisions',()=>{
 const gate=JSON.parse(readFileSync(PATH,'utf8')) as any;
 assert.equal(gate.schemaVersion,'historical-density-p2-remaining-applicability-decision-gate-v1'); assert.equal(gate.issue,718);
 assert.deepEqual(gate.frozenCandidateArtifact,{runId:37490027592,artifactId:11424703301,digest:'sha256:2d8e9b48f654febbd4e027d626fde3696eb6f8c055eeba40ad2007332f69abf1'});
 assert.equal(gate.candidateReviewKeySha256,'4fd8d5aa6821a4e548482f27749d5ff2f4e11c511a72d06e5426be78dd7a5900'); assert.equal(gate.candidateReviewGroups,124);
 const defaults=Object.values(gate.defaultDecisionBySemanticKey) as any[]; assert.equal(defaults.length,14); for(const d of defaults){assert.equal(d.decision,'not_applicable');assert.ok(d.reasonCode);assert.equal(d.billPolicyDirection,null);assert.equal(d.alignmentDirection,null);}
 assert.equal(gate.overrides.length,21); assert.equal(new Set(gate.overrides.map((x:any)=>x.reviewKey)).size,21);
 const applicable=gate.overrides.filter((x:any)=>x.decision==='applicable'); const ambiguous=gate.overrides.filter((x:any)=>x.decision==='ambiguous_fail_closed'); assert.deepEqual(applicable.map((x:any)=>x.reviewKey).sort(),EXPECTED_APPLICABLE); assert.equal(ambiguous.length,17);
 for(const d of applicable){assert.ok(d.reasonCode);assert.ok(d.billPolicyDirection);assert.equal(d.alignmentDirection,'position_aligns_with_bill');} for(const d of ambiguous){assert.ok(d.reasonCode);assert.equal(d.billPolicyDirection,null);assert.equal(d.alignmentDirection,null);}
 assert.deepEqual(gate.policy,{unlistedCandidateGroup:'pending_review_fail_closed_unavailable',onlyApplicableMayReachMatrix:true,outcomeUse:'none',sameDayVersionEligible:false,productionDatabaseQueried:false,productionWrites:false,vercelUsed:false,modelFitting:'none',servingChanged:false});
});
