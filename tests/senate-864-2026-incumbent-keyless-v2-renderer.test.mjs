import test from 'node:test';
import assert from 'node:assert/strict';
import c from '../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json' with {type:'json'};
import d from '../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json' with {type:'json'};
import raw from '../data/evaluation/senate-864-2026-duckworth-four-live-publisher-original-sha-receipts-v1.json' with {type:'json'};
import {compare49IncumbentSourcesV2} from '../src/evidence/senate-864-2026-incumbent-source-parity.mjs';
import {renderSanitizedIncumbentIssueComment} from '../scripts/render-senate-864-2026-49-incumbent-parity-v2-issue.mjs';

const members=c.rows.map(x=>({district:String(x.district),senatorName:x.senator,
 membershipId:'member'+String(x.district).padStart(3,'0')}));
const agg=members.map(m=>({membershipId:m.membershipId,
 campaignIssueRowsCurrentMembership:0,campaignDistinctDocumentsCurrentMembership:0,
 campaignIssueRowsRecorded2026:0,campaignIssueRowsRecordedPre2026:0,campaignIssueRowsUndated:0,
 allSourceIssueRowsRecorded2026:0,allSourceIssueRowsCurrentMembership:0}));
const data=compare49IncumbentSourcesV2(c,d,members,[],agg,raw);
const safe={...data,currentTransactionReadOnly:true,transactionRollbackCompleted:true,
 productionMutations:0};
const params={verifyResult:'success',readOnlyResult:'success',
 safeCandidateReportB64:Buffer.from(JSON.stringify(safe),'utf8').toString('base64'),
 runUrl:'https://github.com/killjoy00/votepredict/actions/runs/99999999',
 mainSha:'a'.repeat(40)};
test('keyless renderer names all 49 PUBLIC people, zero URL observed does not become no issue evidence',()=>{
 const body=renderSanitizedIncumbentIssueComment(params);
 assert.match(body,/\| 1 \| Mark T\. Johnson \|/);
 assert.match(body,/\| 29 \| Michael Holmstrom Jr \|/);
 assert.match(body,/\| 57 \| Zach Duckworth \|/);
 assert.match(body,/\| 67 \| Foung Hawj \|/);
 assert.equal((body.match(/^\| (?:[0-9]{1,2}) \|/gm)||[]).length,49);
 assert.match(body,/a missing selected URL is NOT proof/i);
 assert.match(body,/read ONLY REPEATABLE READ/i);
 assert.doesNotMatch(body,/member001|source-doc|evidence-item|NEON_API_KEY|private\.neon\.tech/);
});
test('keyless reporter refuses private source URLs, unbounded counts and missing per-public-person rows',()=>{
 for(const malicious of [
  {...safe,secretPrivateUrl:'https://private.example.org/source'},
  {...safe,perPublicDistrict:safe.perPublicDistrict.slice(1)},
  {...safe,perPublicDistrict:safe.perPublicDistrict.map((x,i)=>i===0?
   {...x,currentMembershipCampaignIssueRows:10000000}:x)},
  {...safe,groupedStatusCounts:{source_url_not_observed_in_bounded_lookup:48}},
 ]){
  assert.throws(()=>renderSanitizedIncumbentIssueComment({...params,
   safeCandidateReportB64:Buffer.from(JSON.stringify(malicious)).toString('base64')}));
 }
});
test('presecret or protected HOLD reports no invented zero membership/source evidence',()=>{
 const hold=renderSanitizedIncumbentIssueComment({...params,
  verifyResult:'failure',readOnlyResult:'skipped',safeCandidateReportB64:''});
 assert.match(hold,/HOLD:/);
 assert.doesNotMatch(hold,/result: SUCCESS/i);
 const blocked=renderSanitizedIncumbentIssueComment({...params,
  readOnlyResult:'failure',safeCandidateReportB64:'',
  safeFailureStage:'bounded_2026_memberships_in_memory'});
 assert.match(blocked,/PROTECTED HOLD/);
 assert.match(blocked,/bounded_2026_memberships_in_memory/);
 assert.throws(()=>renderSanitizedIncumbentIssueComment({...params,
  readOnlyResult:'failure',safeCandidateReportB64:'',
  safeFailureStage:'postgresql://secret.private.example'}));
});
test('denies false claimed rollback, wrong deployed DB equivalence or fabricated per-person original date proof',()=>{
 for(const bogus of [
  {...safe,currentTransactionReadOnly:false},
  {...safe,transactionRollbackCompleted:false},
  {...safe,deployedProductionDbBindingProven:true},
  {...safe,calendarYearIsStoredPublishedAtMetadataNotIndependentOriginalPublication:false},
  {...safe,election2026EligibleStatementCompletenessProven:true}
 ]){
  assert.throws(()=>renderSanitizedIncumbentIssueComment({...params,
   safeCandidateReportB64:Buffer.from(JSON.stringify(bogus),'utf8').toString('base64')}));
 }
});
