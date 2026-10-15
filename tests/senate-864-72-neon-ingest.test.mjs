import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRecoveryPlan} from '../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
import {assertVerified72Proof} from '../scripts/check-senate-864-72-neon-import-proof.mjs';
import {VERIFIED} from '../scripts/verify-senate-864-72-original-artifact-bytes.mjs';
import {sourcePlan} from '../src/evidence/senate-864-72-historical-source-ingest-plan.mjs';
import {historicalOriginalDraft} from '../src/evidence/senate-864-72-original-neon-draft.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {assertStoredOriginalReceipts} from '../src/evidence/senate-864-72-neon-readback.mjs';

const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json','utf8'));
const original=buildRecoveryPlan();
const uuid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const roster=manifest.people.map((person,i)=>({
 name:person.officialName,legislatorId:uuid(i+1),
 membershipId:uuid(i+501),sessionSlug:'2021-2022'
}));
const receipts=sourcePlan(manifest,original.witnesses,roster);

test('fixed public research pages uniquely map 72 authenticated originals to 34 served persons',()=>{
 assert.equal(receipts.length,72);
 assert.equal(new Set(receipts.map(x=>x.key)).size,72);
 assert.equal(new Set(receipts.map(x=>x.ordinal)).size,34);
 for(const item of receipts){
  const {source,drafts}=historicalOriginalDraft(item);
  assert.equal(source.contentSha256,item.originalSha);
  assert.equal(drafts[0].target.membershipId,item.membershipId);
  assert.equal(drafts[0].publishedAt,undefined);
  assert.equal(drafts[0].kind,'context');
  assert.equal(drafts[0].metadata.asOfEligible,false);
  assert.equal(drafts[0].metadata.modelWeight,0);
  assert.equal(drafts[0].metadata.originalFirstAuthoredDateKnown,false);
 }
});
test('archive-year attribution selects a serving session without inventing a publication date',()=>{
 const page=original.witnesses.find(w=>w.originalArchiveCapturedAtUtc.startsWith('2025-'));
 assert.ok(page);
 const first=roster[page.senatorOrdinal-1];
 const extended=[...roster,{
  name:page.officialName,legislatorId:first.legislatorId,
  membershipId:uuid(4000),sessionSlug:'2025-2026'
 }];
 const targeted=sourcePlan(manifest,original.witnesses,extended);
 const found=targeted.find(x=>x.ordinal===page.senatorOrdinal&&x.originalSha===page.originalHtmlSha256);
 assert.equal(found.membershipId,uuid(4000));
 assert.equal(historicalOriginalDraft(found).drafts[0].publishedAt,undefined);
});
test('pinned CDX+original byte proof envelope never tolerates a single held or wrong source',()=>{
 const proof={
  schema:'senate-864-95-72-historic-original-html-cdx-verified-v1',
  senators:34,originalPages:72,neonWrites:0,
  readOnlyOriginalPublicSourceArtifactVerification:true,
  noProductionForecastOrSourcePromotion:true,statuses:{[VERIFIED]:72},
  results:original.witnesses.map(w=>({...w,status:VERIFIED}))
 };
 assert.equal(assertVerified72Proof(proof,original).length,72);
 const held=structuredClone(proof);held.results[0].status='HOLD_SHA_MISMATCH';
 assert.throws(()=>assertVerified72Proof(held,original));
 const tampered=structuredClone(proof);tampered.results[0].originalUrl+='bad';
 assert.throws(()=>assertVerified72Proof(tampered,original));
 const duplicate=structuredClone(proof);duplicate.results[1]=duplicate.results[0];
 assert.throws(()=>assertVerified72Proof(duplicate,original));
});
test('stored Neon receipts prove exact hashes, canonical links and model-ineligibility',()=>{
 const rows=receipts.map(item=>{
  const draft=historicalOriginalDraft(item);
  return {
   membershipId:item.membershipId,kind:'context',stance:'neutral',publishedAt:null,
   sourceUrl:draft.source.sourceUrl,sourceSha:item.originalSha,
   sourceMetadata:draft.source.metadata,
   itemMetadata:{...draft.drafts[0].metadata,durableIngestion:true,ingestionKey:'verified'}
  };
 });
 assert.equal(assertStoredOriginalReceipts(rows,receipts),72);
 assert.throws(()=>assertStoredOriginalReceipts(rows.slice(1),receipts));
 const unsafe=structuredClone(rows);unsafe[0].itemMetadata.asOfEligible=true;
 assert.throws(()=>assertStoredOriginalReceipts(unsafe,receipts));
 const altered=structuredClone(rows);altered[0].sourceSha='0'.repeat(64);
 assert.throws(()=>assertStoredOriginalReceipts(altered,receipts));
});
test('protected run requires exact main first-attempt independently verified GitHub push',()=>{
 const sha='a'.repeat(40);
 const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:sha,VOTEPREDICT_864_72_INDEPENDENT_CI:'true'};
 const event={ref:'refs/heads/main',after:sha,head_commit:{id:sha},
  repository:{full_name:'killjoy00/votepredict'},deleted:false,forced:false};
 assert.equal(assertHistoricalMainPush(env,event),true);
 assert.throws(()=>assertHistoricalMainPush({...env,GITHUB_RUN_ATTEMPT:'2'},event));
 assert.throws(()=>assertHistoricalMainPush(env,{...event,forced:true}));
 assert.throws(()=>assertHistoricalMainPush({...env,GITHUB_EVENT_NAME:'pull_request'},event));
});
