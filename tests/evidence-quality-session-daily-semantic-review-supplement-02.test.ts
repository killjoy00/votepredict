import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const path='data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-supplement-02-v1.json';
test('supplemental Session Daily semantic review is frozen and conservative',()=>{
 const p=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(p.batchId,'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-002-SEMANTIC-REVIEW');
 assert.equal(p.sourceCohort.runId,37237250762); assert.equal(p.sourceCohort.artifactId,11315647956);
 assert.equal(p.sourceCohort.artifactDigest,'sha256:4869f0313294e5dcf230a56a29a21da24a5c466dbf030a146a4aaf599db788b9');
 assert.equal(p.sourceCohort.cohortIdentitySha256,'fff46e7dd351ebaae2389a401b1f21140904f263bcd42fb1a8068d751a91bc60');
 assert.equal(p.reviews.length,15); assert.equal(new Set(p.reviews.map((r:any)=>r.sourceDocumentId)).size,15);
 for(const r of p.reviews){
  assert.equal(createHash('sha256').update(r.reviewText).digest('hex'),r.reviewTextSha256);
  assert.ok(r.reviewText.includes(r.supportingExcerpt)); assert.ok(r.supportingExcerpt.length<=500);
  assert.ok(r.memberNames.every((x:string)=>r.candidateMemberNames.includes(x)));
  assert.ok(r.billIdentifiers.every((x:string)=>r.candidateBillIdentifiers.includes(x)));
 }
 const d=p.reviews.filter((r:any)=>['supports','opposes','mixed'].includes(r.stance)&&r.memberNames.length>0);
 assert.equal(d.length,13); assert.equal(p.reviews.filter((r:any)=>r.decision==='exact_member_bill_directional').length,9);
 assert.equal(p.reviews.filter((r:any)=>r.decision==='member_issue_directional').length,4);
 assert.ok(d.every((r:any)=>['explicit_position','quoted_position','sponsorship'].includes(r.claimType)));
 assert.deepEqual(p.reviews.filter((r:any)=>r.decision.includes('human_check')).map((r:any)=>r.row),[]);
 const row5=p.reviews.find((r:any)=>r.row===5); assert.equal(row5.stance,'supports'); assert.equal(row5.claimType,'sponsorship'); assert.deepEqual(row5.memberNames,['Lindsey Port','Zack Stephenson']);
 const row9=p.reviews.find((r:any)=>r.row===9); assert.equal(row9.stance,'none'); assert.equal(row9.decision,'non_directional');
 assert.equal(p.summary.exactMemberBillDirectionalUniquePotentialRows,12);
 assert.equal(p.policy.verifiedSponsorshipDirectionalSupportByPolicy,true);
 assert.equal(p.policy.semanticPolicyVersion,'evidence-quality-sponsorship-support-v1');
 assert.equal(p.summary.validationFailures,0); assert.equal(p.policy.outcomeBlind,true); assert.equal(p.policy.modelWeight,0); assert.equal(p.policy.servingChanged,false);
});
