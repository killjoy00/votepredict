/**
 * #864 V2. One independently approved owner-comment-triggered READ ONLY
 * existing VotePredict Neon snapshot, in-memory 49 public district-level
 * issue evidence summary, never raw private row/export. Three bounded SELECTs.
 * Existing v1 25/23/1 receipt remains a distinct previous snapshot.
 */
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import candidates from '../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json' with {type:'json'};
import duckworth from '../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json' with {type:'json'};
import verifiedDuckworth2026RawHtml from '../data/evaluation/senate-864-2026-duckworth-four-live-publisher-original-sha-receipts-v1.json' with {type:'json'};
import {
 compare49IncumbentSourcesV2
} from '../src/evidence/senate-864-2026-incumbent-source-parity.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {
 MEMBERSHIPS_SQL,CATALOG_SQL,IDENTITY_SQL,REQUIRED,sourceVariants
} from './audit-senate-864-2026-49-incumbent-existing-neon-parity.mjs';

export const ONE_SHOT_COMMENT_V2='[campaign-864-2026-49-incumbents-detail-readonly-20261013-v2]';
const DISTRICTS=candidates.rows.map(p=>String(p.district));
export const SOURCE_SQL_V2=[
 'SELECT sd.id::text AS "sourceDocumentId",',
 'sd.source_url::text AS "sourceUrl",',
 'sd.source_kind::text AS "sourceKind",',
 'sd.content_sha256::text AS "contentSha256",',
 'ei.id::text AS "sourceEvidenceId",ei.membership_id::text AS "membershipId",',
 "LEFT(COALESCE(ei.excerpt,''),4000)::text AS excerpt,",
 "ei.metadata->>'contextType' AS \"contextType\",",
 "ei.metadata->>'sourceSubtype' AS \"sourceSubtype\",",
 'ei.published_at::text AS "publishedAt"',
 'FROM source_documents sd LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id',
 'WHERE sd.source_url=ANY($1::text[])',
 'ORDER BY sd.source_url,sd.id,ei.id LIMIT 1201'
].join(' ');

const CAMPAIGN="ei.metadata->>'contextType'='issue_position' AND ei.metadata->>'sourceSubtype'='campaign_site_page'";
const ISSUE="ei.metadata->>'contextType'='issue_position'";
export const MEMBER_CAMPAIGN_COUNTS_SQL=[
 'SELECT m.id::text AS "membershipId",',
 'count(ei.id) FILTER (WHERE '+CAMPAIGN+')::integer AS "campaignIssueRowsCurrentMembership",',
 'count(DISTINCT ei.source_document_id) FILTER (WHERE '+CAMPAIGN+')::integer AS "campaignDistinctDocumentsCurrentMembership",',
 "count(ei.id) FILTER (WHERE "+CAMPAIGN+" AND ei.published_at>=TIMESTAMPTZ '2026-01-01T00:00:00Z' AND ei.published_at<TIMESTAMPTZ '2026-10-14T00:00:00Z')::integer AS \"campaignIssueRowsRecorded2026\",",
 "count(ei.id) FILTER (WHERE "+CAMPAIGN+" AND ei.published_at<TIMESTAMPTZ '2026-01-01T00:00:00Z')::integer AS \"campaignIssueRowsRecordedPre2026\",",
 'count(ei.id) FILTER (WHERE '+CAMPAIGN+' AND ei.published_at IS NULL)::integer AS "campaignIssueRowsUndated",',
 "count(ei.id) FILTER (WHERE "+ISSUE+" AND ei.published_at>=TIMESTAMPTZ '2026-01-01T00:00:00Z' AND ei.published_at<TIMESTAMPTZ '2026-10-14T00:00:00Z')::integer AS \"allSourceIssueRowsRecorded2026\",",
 'count(ei.id) FILTER (WHERE '+ISSUE+')::integer AS "allSourceIssueRowsCurrentMembership"',
 'FROM memberships m',
 'JOIN chambers c ON c.id=m.chamber_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 'LEFT JOIN evidence_items ei ON ei.membership_id=m.id',
 "WHERE c.slug='senate' AND s.slug='2025-2026'",
 'AND m.district::text=ANY($1::text[])',
 "AND COALESCE(m.starts_on,s.starts_on)<=DATE '2026-10-13'",
 "AND (COALESCE(m.ends_on,s.ends_on) IS NULL OR COALESCE(m.ends_on,s.ends_on)>=DATE '2026-10-13')",
 'GROUP BY m.id,m.district',
 'ORDER BY m.district,m.id LIMIT 211'
].join(' ');

const STATUS=new Set([
 'matched_exact_url_with_named_senator_evidence',
 'matched_url_alias_with_named_senator_evidence',
 'source_url_present_but_no_named_senator_evidence',
 'source_url_not_observed_in_bounded_lookup',
 'senator_membership_identity_unresolved'
]);
const HOLD=new Set([
 'none','no_active_membership_in_stored_2025_26_session',
 'active_district_membership_name_does_not_match_public_incumbent',
 'multiple_active_current_senate_membership_identity_candidates'
]);
const PRIVATE_PATTERN=/(?:https?:\/\/|postgres:|neon\.tech|@[a-z0-9]+\.[a-z]+|sourceDocumentId|sourceEvidenceId|membershipId|rawWholeHtmlSha256|sourceContentSha256|excerptBody|password|NEON_API_KEY)/i;
export function assertOwnerCommentV2(env){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_EVENT_NAME!=='issue_comment'
  ||env.GITHUB_REF!=='refs/heads/main'
  ||env.GITHUB_RUN_ATTEMPT!=='1'
  ||! /^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')
  ||env.VOTEPREDICT_864_2026_V2_APPROVAL!==ONE_SHOT_COMMENT_V2
  ||env.VOTEPREDICT_864_2026_V2_INDEPENDENT_CI!=='true')
  throw Error('New reviewed main-only owner-triggered protected V2 source audit required');
}
export function validateSanitizedV2(r){
 assert.equal(r.schema,'mn-864-2026-49-incumbent-protected-url-and-evidence-parity-v2');
 assert.equal(r.issue,864);
 assert.equal(r.currentTransactionReadOnly,true);
 assert.equal(r.transactionRollbackCompleted,true);
 assert.equal(r.productionMutations,0);
 assert.equal(r.deployedProductionDbBindingProven,false);
 assert.equal(r.calendarYearIsStoredPublishedAtMetadataNotIndependentOriginalPublication,true);
 assert.equal(r.memberRowsAreAggregateCountsOnly,true);
 assert.equal(r.outputContainsPrivateSourceRows,false);
 assert.equal(r.outputContainsPrivateUrls,false);
 assert.equal(r.outputContainsPrivatePeopleNames,false);
 assert.equal(r.outputContainsPrivateHashes,false);
 assert.equal(r.sourceUrlStatusByDistrict,undefined);
 assert.ok(Array.isArray(r.perPublicDistrict)&&r.perPublicDistrict.length===49);
 assert.ok(r.duckworth?.perSource?.length===4);
 assert.ok(Number.isInteger(r.duckworth.exactLiveWholePublisherHtmlShaMatches)
  &&r.duckworth.exactLiveWholePublisherHtmlShaMatches>=0
  &&r.duckworth.exactLiveWholePublisherHtmlShaMatches<=4);
 const ints=[
  'currentMembershipCampaignIssueRows','currentMembershipCampaignDistinctDocuments',
  'currentMembershipCampaignIssueRowsRecorded2026','currentMembershipCampaignIssueRowsRecordedPre2026',
  'currentMembershipCampaignIssueRowsUndated','currentMembershipAllSourceIssueRowsRecorded2026'
 ];
 const bools=[
  'selectedSourceEvidenceLinked','selectedSourceIssuePositionLinked',
  'selectedSourceCampaignSiteIssuePositionLinked','selectedSourceIssuePositionRecorded2026'
 ];
 const expectedKeys=['district','selectedSourceStatus','membershipHoldReason',...bools,...ints].sort();
 const grouped={};
 for(let i=0;i<49;i++){
  const row=r.perPublicDistrict[i];
  if(row.district!==candidates.rows[i].district
   ||JSON.stringify(Object.keys(row).sort())!==JSON.stringify(expectedKeys)
   ||!STATUS.has(row.selectedSourceStatus)||!HOLD.has(row.membershipHoldReason))
   throw Error('Untrusted per-public-district source result');
  for(const k of bools)if(typeof row[k]!=='boolean')throw Error('Unsafe public district source flags');
  const hold=row.selectedSourceStatus==='senator_membership_identity_unresolved';
  if((row.membershipHoldReason!=='none')!==hold)
   throw Error('Contradictory membership identity status');
  for(const k of ints){
   if(hold){if(row[k]!==null)throw Error('Missing membership must not count as zero');}
   else if(!Number.isInteger(row[k])||row[k]<0||row[k]>100000)
    throw Error('Unsafe per-member source aggregate count');
  }
  if(row.selectedSourceIssuePositionRecorded2026&&!row.selectedSourceIssuePositionLinked)
   throw Error('Source 2026 date metadata without stored issue-position attribution');
  if(row.selectedSourceIssuePositionLinked&&!row.selectedSourceEvidenceLinked)
   throw Error('Source issue without stored senator evidence');
  grouped[row.selectedSourceStatus]=(grouped[row.selectedSourceStatus]||0)+1;
 }
 if(JSON.stringify(grouped)!==JSON.stringify(r.groupedStatusCounts))
  throw Error('Per-district and source aggregate category mismatch');
 const json=JSON.stringify(r);
 if(json.length>46000||PRIVATE_PATTERN.test(json))
  throw Error('Private source metadata exposed in sanitized V2 report');
 return r;
}
export async function auditExisting49CurrentMembershipV2(
 input,
 discover=discoverExistingVotePredictNeonConnection,
 poolFactory=opts=>new Pool(opts),
 phase=()=>{},
){
 const variants=sourceVariants();
 assert.ok(variants.length>=53&&variants.length<=500);
 const target=await discover(input);
 phase('verified_existing_default_votepredict_database');
 const pool=poolFactory({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:23000,statement_timeout:22000,
  application_name:'votepredict-864-2026-49-per-district-parity-v2-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=22000 -c lock_timeout=1200'
 });
 try{
  const client=await pool.connect();let inTx=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   inTx=true;
   const identity=await client.query(IDENTITY_SQL);
   if(identity.rows.length!==1||identity.rows[0].db!==target.database
    ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='on')
    throw Error('Existing VotePredict database role or read-only transaction identity incorrect');
   const tables=await client.query(CATALOG_SQL,[REQUIRED]);
   if(tables.rows.length!==REQUIRED.length
    ||tables.rows.some(x=>!REQUIRED.includes(x.table_name)||x.present!==true||x.readable!==true))
    throw Error('Missing required existing VotePredict source relations');
   phase('tables_and_readonly_transaction_verified');
   const members=await client.query(MEMBERSHIPS_SQL,[DISTRICTS]);
   if(members.rows.length>=211)throw Error('Current Senate membership lookup truncated');
   phase('bounded_2026_memberships_in_memory');
   const sourceRows=await client.query(SOURCE_SQL_V2,[variants]);
   if(sourceRows.rows.length>=1201)throw Error('Bounded current candidate source query truncated');
   phase('bounded_53_public_source_url_rows_in_memory');
   const campaignCounts=await client.query(MEMBER_CAMPAIGN_COUNTS_SQL,[DISTRICTS]);
   if(campaignCounts.rows.length>=211)throw Error('Bounded current member aggregate truncated');
   phase('bounded_campaign_source_aggregates_in_memory');
   const calculated=compare49IncumbentSourcesV2(
    candidates,duckworth,members.rows,sourceRows.rows,campaignCounts.rows,
    verifiedDuckworth2026RawHtml);
   await client.query('ROLLBACK');inTx=false;
   phase('readonly_transaction_explicitly_rolled_back');
   return validateSanitizedV2({...calculated,currentTransactionReadOnly:true,
    transactionRollbackCompleted:true,originalSqlRoleMayHaveOtherPrivileges:true,
    verifiedExistingNeonDefaultBranch:true,productionMutations:0,
    matchedPublicSourceVariantsQueried:variants.length});
  }finally{
   if(inTx){try{await client.query('ROLLBACK')}catch{/* connection is closed */}}
   client.release(true);
  }
 }finally{await pool.end()}
}
export async function main(){
 assert.equal(process.argv.length,2);
 assertOwnerCommentV2(process.env);
 let stage='owner_comment_and_ci_approved';
 try{
  const report=await auditExisting49CurrentMembershipV2({
   apiKey:process.env.NEON_API_KEY?.trim()||'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()||'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined
  },discoverExistingVotePredictNeonConnection,undefined,s=>{stage=s});
  const payload=Buffer.from(JSON.stringify(report),'utf8').toString('base64');
  if(payload.length>64000)throw Error('Oversized sanitized payload');
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'safe_candidate_report_b64='+payload+'\n');
  console.log('SENATE_864_2026_V2_READONLY_ROLLBACK_CONFIRMED: 49 public district rows, six numeric aggregate fields each; no private data emitted');
 }catch{
  console.error('SENATE_864_2026_V2_FAIL_CLOSED_STAGE='+stage);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,90}$/.test(stage))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_stage='+stage+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
 void main();
