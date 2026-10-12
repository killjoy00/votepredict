import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-v5-protected-neon-seven-family-baseline.json','utf8',
)) as Record<string,any>;
const year=(kind:string,y:string)=>proof.groups[kind].find((x:{year:string})=>x.year===y);
const sum=(kind:string,field:string,years?:string[])=>proof.groups[kind]
 .filter((r:{year:string})=>!years||years.includes(r.year))
 .reduce((n:number,r:Record<string,string>)=>n+Number(r[field]??0),0);

test('V5 successful protected READ ONLY audit is exact run/commit/receipt pinned',()=>{
 assert.equal(proof.schemaVersion,'mn-864-2021-25-neon-v5-protected-verified-baseline-v1');
 assert.equal(proof.issue,864);
 assert.equal(proof.sourceReceiptId,6116826026);
 assert.equal(proof.run.id,38196817626);
 assert.equal(proof.run.mainCommit,'1b02981cfd204911c2834816dfe777222725f791');
 assert.match(proof.run.runnerFileBlobSha,/^[a-f0-9]{40}$/);
 assert.match(proof.run.workflowFileBlobSha,/^[a-f0-9]{40}$/);
 assert.equal(proof.run.conclusion,'success');
 assert.equal(proof.transaction.readOnly,true);
 assert.equal(proof.transaction.isolation,'REPEATABLE READ');
 assert.equal(proof.transaction.allSevenSourceFamilyQueriesSucceeded,true);
 assert.equal(proof.transaction.sqlSavepointsUsed,true);
 assert.equal(proof.transaction.explicitRollbackSucceeded,true);
 assert.equal(proof.transaction.productionMutations,0);
 assert.deepEqual(proof.limits.sourceFamilyHolds,[]);
 assert.deepEqual(Object.keys(proof.groups),[
  'roster','finance','committeeSources','committeeVotes','committeeChoices','campaign','media',
 ]);
});

test('committee raw stored counts equal independently enumerated PDF link count ONLY numerically',()=>{
 for(const [y,docs,events,choices] of [
  ['2022','325','38','259'],['2023','454','33','197'],
  ['2024','258','49','227'],['2025','415','33','305'],
 ]){
  assert.equal(year('committeeSources',y)?.source_document_rows,docs);
  assert.equal(year('committeeSources',y)?.unique_source_urls,docs);
  assert.equal(year('committeeSources',y)?.missing_source_sha,'0');
  assert.equal(year('committeeVotes',y)?.committee_vote_events,events);
  assert.equal(year('committeeChoices',y)?.member_vote_rows,choices);
 }
 assert.equal(sum('committeeSources','source_document_rows'),1452);
 assert.equal(sum('committeeVotes','committee_vote_events'),153);
 assert.equal(sum('committeeChoices','member_vote_rows'),988);
 assert.equal(proof.limits.committeeOriginalIndependentPdfReferenceCount,1452);
 assert.equal(proof.limits.committeeOriginalPdfReferencesIdentitiesMatched,false);
 assert.equal(proof.limits.exactOriginalSourceToDatabaseIdentityProven,false);
 assert.equal(proof.limits.sourceOriginalEventDenominatorComplete,false);
 assert.equal(proof.limits.committee2021OfficialPrintMinutesCollected,false);
});

test('finance registry is NOT Senate report/evidence/predictability denominator',()=>{
 assert.equal(sum('finance','source_document_rows'),308);
 assert.deepEqual([...new Set(proof.groups.finance.map((r:{year:string})=>r.year))],
  ['unknown_or_outside']);
 assert.equal(sum('finance','documents_without_stored_chamber'),308);
 assert.equal(sum('finance','documents_without_stored_session'),308);
 assert.equal(proof.limits.financeSourceDocumentsAllChambers,true);
 assert.equal(proof.limits.financeCandidateEvidenceItemsAudited,false);
 assert.equal(proof.limits.historicalAsOfEligibilityCertified,false);
});

test('campaign and media remain evidence/context rows, not authenticated senator statements',()=>{
 assert.equal(sum('campaign','campaign_evidence_rows',['2021','2022','2023','2024','2025']),1074);
 assert.equal(sum('media','context_rows',['2021','2022','2023','2024','2025']),794);
 assert.equal(sum('media','context_rows'),948);
 assert.equal(proof.limits.campaignRowsAreNotSenatePromiseCount,true);
 assert.equal(proof.limits.mediaRowsAreNotAttributedQuoteCount,true);
 assert.equal(proof.limits.deployedProductionBindingIndependentlyVerified,false);
 assert.equal(proof.limits.noDataRepairOrForecastPromotion,true);
});
