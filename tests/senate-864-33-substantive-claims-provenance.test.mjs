import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=JSON.parse(readFileSync('data/evaluation/senate-864-historically-authenticated-and-current-primary-substantive-claims-v1.json','utf8'));
const claims=source.claims;
const sha=/^[a-f0-9]{64}$/, indexed=/^[A-Z2-7]{32}$/;
test('33 selected claim rows are 24 *inherited* original source claims plus 9 new 2026-only leads',()=>{
 assert.equal(source.schema,'senate-864-research-only-bounded-claims-v1');
 assert.equal(claims.length,33);
 assert.equal(source.summary.archivalAnchorClaimsInSelectedNewLedger,24);
 assert.equal(source.summary.newlyFoundCurrentPublisherStatementLeadRows,9);
 assert.equal(new Set(claims.map(x=>x.claimId)).size,33);
 assert.equal(source.summary.selectedOwnedSiteExcerpts,1285);
 assert.equal(source.summary.people,95);
});
test('all original historical source-capture claims pin SHA1+SHA256 but NEVER first publisher minute or production eligibility',()=>{
 for (const q of claims.slice(0,24)){
  assert.match(q.sourceOriginalHtmlSha256,sha,q.claimId);
  assert.match(q.archivalIndexedOriginalSha1Base32,indexed,q.claimId);
  assert.match(q.independentlyEstablishedHistoricalPublicByUtc,/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(q.sourceIntegrity,'independently_archived_full_body_sha1_sha256');
  assert.equal(q.originalFullStatementHumanApproved,false);
  assert.equal(q.asOfPredictionUsable,false);
  assert.equal(q.productionAsOfSourcePresenceVerified,false);
  assert.equal(q.historicalSourceCutoffAndIngestionReconciled,false);
 }
});
test('newly found live publisher quotes cannot masquerade as archive-authenticated',()=>{
 for (const q of claims.slice(24)){
  assert.equal(q.independentlyEstablishedHistoricalPublicByUtc,null);
  assert.equal(q.sourceOriginalHtmlSha256,null);
  assert.equal(q.archivalIndexedOriginalSha1Base32,null);
  assert.equal(q.sourceIntegrity,'currently_retrievable_first_party_lead_historical_original_unverified');
  assert.equal(q.asOfPredictionUsable,false);
  assert.equal(q.productionAsOfSourcePresenceVerified,false);
 }
});
test('historically authenticated 2022/2023 named official member votes never promote own quotes as labels',()=>{
 const c=claims.filter(x=>x.relatedOfficialPersonalVote!==null);
 assert.equal(c.length,5);
 for (const q of c){
  assert.ok(['SF2666','SF2575','SF2729','HF100'].includes(q.relatedOfficialPersonalVote.bill));
  assert.ok(['YEA','NAY'].includes(q.relatedOfficialPersonalVote.choice));
  assert.equal(q.relatedOfficialPersonalVote.official,true);
  assert.equal(q.relatedOfficialPersonalVote.notTrainingLabel,true);
  assert.match(q.relatedOfficialVotePdfSha256,sha);
  assert.equal(q.asOfPredictionUsable,false);
 }
});
test('repeated 2023 SF551/SF862 quote and shared 2022 source remain explicitly same event',()=>{
 const k=claims.filter(x=>x.claimId.startsWith('current-lead-2023-kreun-sf'));
 assert.equal(k.length,2);
 assert.equal(new Set(k.map(x=>x.underlyingStatementKey)).size,1);
 assert.equal(k.filter(x=>x.sourceQuoteOrPassage!==null).length,1);
 const parent=claims.slice(0,4);
 assert.equal(new Set(parent.map(x=>x.sourceUrl)).size,1);
});
test('2020 Newman statements not relabeled as contemporaneous 2021 legislative claims',()=>{
 const n=claims.filter(x=>x.sourceStatementDate?.startsWith('2020-'));
 assert.equal(n.length,5);
 assert.ok(n.every(x=>x.substantiveCalendarYear===2020));
 assert.ok(n.every(x=>x.asOfPredictionUsable===false));
});
test('a cited issue position does not imply bill position or exact text version',()=>{
 assert.ok(claims.every(x=>x.exactFloorAmendedVersionCertified===false));
 assert.ok(claims.every(x=>x.positionDoesNotImplyVote===true));
 assert.ok(claims.some(x=>x.stance==='ambiguous'));
 assert.ok(claims.some(x=>x.stance==='conditional'));
});
