/**
 * #864 Track B V3. Bound source prefix identical to V1/V2 (selection rule, NOT
 * independently immutable ID cohort). Aggregate only; labels and presence
 * are never original archive-byte authentication or historical PDF proof.
 * No freeform SQL, private rows, people, IDs, amounts, URLs or digests exported.
 */
import {appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';

export const CFB_864_ARCHIVE_V3_MARKER='SENATE_864_CFB_ARCHIVE_READONLY_20261012_V3' as const;
export const DOCUMENT_CAP=500;
export const ROW_CAP=64;
export const FAMILIES=[
 'campaign_finance_candidate_contribution_bulk',
 'campaign_finance_candidate_expenditure_bulk',
 'campaign_finance_independent_expenditure_bulk',
 'campaign_finance_bulk',
] as const;
export const POLICIES=[
 'v8','v7','v1_to_v6','missing','other_or_unrecognized',
] as const;
export const METRICS=[
 "senate_rows",
 "eligible_claims",
 "archive_exact_row_claim",
 "candidate_archive_status",
 "ie_archive_status",
 "candidate_upperbound_marker",
 "ie_upperbound_marker",
 "archive_captured_at",
 "archive_digest",
 "available_at",
 "archive_proof_url",
 "archived_source_url",
 "upper_bound_flag",
 "first_publication_not_known",
 "complete_archive_keyset",
 "archive_day_agrees_with_stored",
 "transaction_day_matches_published",
 "transaction_day_after_published",
 "filing_derived_claim"
] as const;
const familySet=new Set<string>(FAMILIES);
const policySet=new Set<string>(POLICIES);
export const FIXED_ARCHIVE_V3_SQL=[
 "SELECT year, family, policy_bucket,",
 "count(*) FILTER (WHERE TRUE)::text AS senate_rows,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true')::text AS eligible_claims,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'availabilityProof'='independent_archive_capture_exact_row')::text AS archive_exact_row_claim,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'availabilityStatus'='proven_by_archived_official_bulk_upper_bound')::text AS candidate_archive_status,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'availabilityStatus'='proven_by_archived_official_ie_bulk_upper_bound')::text AS ie_archive_status,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'cfbCandidateBulkUpperBoundVersion','') IS NOT NULL)::text AS candidate_upperbound_marker,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'cfbIeLegacyBulkUpperBoundVersion','') IS NOT NULL)::text AS ie_upperbound_marker,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'archiveCapturedAt','') IS NOT NULL)::text AS archive_captured_at,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'archiveDigest','') IS NOT NULL)::text AS archive_digest,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'availableAt','') IS NOT NULL)::text AS available_at,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'availabilityProofUrl','') IS NOT NULL)::text AS archive_proof_url,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND NULLIF(m->>'availabilitySourceUrl','') IS NOT NULL)::text AS archived_source_url,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'availabilityBoundKind'='conservative_upper_bound')::text AS upper_bound_flag,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'exactFirstPublicationKnown'='false')::text AS first_publication_not_known,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'availabilityProof'='independent_archive_capture_exact_row' AND m->>'availabilityBoundKind'='conservative_upper_bound' AND NULLIF(m->>'archiveCapturedAt','') IS NOT NULL AND NULLIF(m->>'archiveDigest','') IS NOT NULL AND NULLIF(m->>'availableAt','') IS NOT NULL AND NULLIF(m->>'availabilityProofUrl','') IS NOT NULL AND (NULLIF(m->>'cfbCandidateBulkUpperBoundVersion','') IS NOT NULL OR NULLIF(m->>'cfbIeLegacyBulkUpperBoundVersion','') IS NOT NULL))::text AS complete_archive_keyset,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'availabilityProof'='independent_archive_capture_exact_row' AND published_at IS NOT NULL AND LEFT(m->>'archiveCapturedAt',10)=to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD') AND LEFT(m->>'availableAt',10)=LEFT(m->>'archiveCapturedAt',10))::text AS archive_day_agrees_with_stored,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'transactionDate' ~ '^202[1-5]-[0-1][0-9]-[0-3][0-9]$' AND published_at IS NOT NULL AND LEFT(m->>'transactionDate',10)=to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD'))::text AS transaction_day_matches_published,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND m->>'transactionDate' ~ '^202[1-5]-[0-1][0-9]-[0-3][0-9]$' AND published_at IS NOT NULL AND LEFT(m->>'transactionDate',10)>to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD'))::text AS transaction_day_after_published,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND (m->>'filingDateDerivedAvailability'='true' OR m->>'availabilityProofKind'='cfb_report_filing'))::text AS filing_derived_claim",
 "FROM (SELECT",
 " CASE WHEN e.metadata->>'year' ~ '^202[1-5]$'",
 " THEN e.metadata->>'year' ELSE 'unknown_or_outside' END AS year,",
 " sd.source_kind AS family,",
 " CASE WHEN NULLIF(e.metadata->>'availabilityPolicyVersion','') IS NULL THEN 'missing'",
 " WHEN e.metadata->>'availabilityPolicyVersion'='mn-cfb-report-availability-v8' THEN 'v8'",
 " WHEN e.metadata->>'availabilityPolicyVersion'='mn-cfb-report-availability-v7' THEN 'v7'",
 " WHEN e.metadata->>'availabilityPolicyVersion' ~ '^mn-cfb-report-availability-v[1-6]$' THEN 'v1_to_v6'",
 " ELSE 'other_or_unrecognized' END AS policy_bucket,",
 " e.metadata AS m, e.published_at, c.slug AS chamber",
 " FROM (SELECT id,source_kind FROM source_documents",
 " WHERE source_kind IN ('campaign_finance_candidate_contribution_bulk',",
 " 'campaign_finance_candidate_expenditure_bulk',",
 " 'campaign_finance_independent_expenditure_bulk','campaign_finance_bulk')",
 " ORDER BY source_kind,id LIMIT 500) sd",
 " JOIN LATERAL (SELECT ei.membership_id,ei.metadata,ei.published_at FROM evidence_items ei",
 " WHERE ei.source_document_id=sd.id ORDER BY ei.created_at,ei.id LIMIT 64) e ON true",
 " LEFT JOIN memberships members ON members.id=e.membership_id",
 " LEFT JOIN chambers c ON c.id=members.chamber_id",
 ") sample WHERE chamber='senate'",
 "GROUP BY 1,2,3 ORDER BY 1,2,3",
].join(' ');

export type ArchiveV3Row={
 year:string;family:string;policy_bucket:string;
} & Record<(typeof METRICS)[number],string>;

export function validateArchiveV3Aggregates(rows:unknown):ArchiveV3Row[]{
 if(!Array.isArray(rows)||rows.length>120)throw Error('Unsafe archive V3 aggregate group count');
 const out:ArchiveV3Row[]=[],seen=new Set<string>();
 for(const item of rows){
  if(!item||typeof item!=='object'||Array.isArray(item))
   throw Error('Unsafe archive V3 shape');
  const row=item as Record<string,unknown>;
  if(typeof row.year!=='string'||!(/^(?:202[1-5]|unknown_or_outside)$/.test(row.year))
    ||typeof row.family!=='string'||!familySet.has(row.family)
    ||typeof row.policy_bucket!=='string'||!policySet.has(row.policy_bucket))
   throw Error('Unsafe archive V3 policy/family/year');
  const keys=['year','family','policy_bucket',...METRICS];
  if(Object.keys(row).length!==keys.length||Object.keys(row).some(k=>!keys.includes(k)))
   throw Error('Unexpected private archive V3 field');
  const group=row.year+'|'+row.family+'|'+row.policy_bucket;
  if(seen.has(group))throw Error('Repeated archive V3 group');
  seen.add(group);
  for(const key of METRICS){
   const value=row[key];
   if(typeof value!=='string'||!/^[0-9]+$/.test(value)||Number(value)>32000)
    throw Error('Unsafe archive V3 count');
  }
  const total=Number(row.senate_rows),eligible=Number(row.eligible_claims);
  if(eligible>total)throw Error('Archive V3 eligible exceeds sampled Senate count');
  for(const key of METRICS.slice(2)){
   if(Number(row[key])>eligible)throw Error('Archive V3 eligible-subset count out of bounds');
  }
  if(Number(row.complete_archive_keyset)>Number(row.archive_exact_row_claim)
    ||Number(row.archive_day_agrees_with_stored)>Number(row.archive_exact_row_claim))
   throw Error('Archive V3 impossible archive subset');
  out.push(row as ArchiveV3Row);
 }
 return out;
}
export function assertArchiveV3MainOnly(e:Record<string,string|undefined>):void{
 const approvedEvent=e.GITHUB_EVENT_NAME==='push'
  ||(e.GITHUB_EVENT_NAME==='issue_comment'
    &&e.VOTEPREDICT_864_CFB_ARCHIVE_V3_OWNER_COMMENT_VERIFIED==='true');
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||!approvedEvent
   ||e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'
   ||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
   ||e.VOTEPREDICT_864_CFB_ARCHIVE_V3_APPROVAL!=='ARCHIVE_METADATA_KEY_PRESENCE_COUNTS_ONLY'
   ||e.VOTEPREDICT_864_CFB_ARCHIVE_V3_CI_GREEN!=='true'
   ||e.VOTEPREDICT_864_CFB_ARCHIVE_V3_MARKER_PRESENT!=='true')
   throw Error('Protected reviewed first-attempt main-only archive V3 approval required');
}
export async function auditCfbFinanceArchiveV3(
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchApi:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(options:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  options=>new Pool(options),
 phase:(value:string)=>void=()=>{},
){
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchApi);
 phase('existing_default_branch_confirmed');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:20000,statement_timeout:19000,
  application_name:'votepredict-864-cfb-v3-archive-counts',
  options:'-c default_transaction_read_only=on -c statement_timeout=19000 -c lock_timeout=3000',
 });
 try{
  const client=(await pool.connect()) as Pick<PoolClient,'query'|'release'>;
  let transaction=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   transaction=true;
   const id=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(id.rows.length!==1||id.rows[0].db!==selected.database
      ||id.rows[0].role!==selected.role||id.rows[0].ro!=='on')
    throw Error('Archive V3 selected identity mismatch');
   phase('read_only_identity_verified');
   const result=await client.query(FIXED_ARCHIVE_V3_SQL);
   const rows=validateArchiveV3Aggregates(result.rows);
   phase('aggregate_sanitized');
   await client.query('ROLLBACK');transaction=false;
   phase('rolled_back');
   return {
    schema:'cfb-864-senate-archive-upperbound-metadata-v3',
    issue:864,years:'2021-2025_plus_unknown_or_outside',
    readOnlyRepeatableReadVerified:true,mandatoryRollbackComplete:true,
    selectedExistingNeonDefaultBranch:true,
    deployedProductionBindingUnverified:true,
    samePrefixSelectionRuleAsV2NotFrozenIdentities:true,
    sourceDocumentCap:DOCUMENT_CAP,perSourceEvidenceCap:ROW_CAP,
    archiveOriginalBytesIndependentlyAuthenticated:false,
    officialPdfPublicationProven:false,
    archiveExactRowContentIndependentlyReconciled:false,
    officialFilingDutyDenominatorEstablished:false,
    noPrivateRowsDonorDataUrlsOrDigestsExported:true,
    availabilityNotRepaired:true,productionWrites:0,
    issue864Open:true,rows,
   } as const;
  }finally{
   if(transaction){try{await client.query('ROLLBACK')}catch{/* close */}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No arbitrary CLI args or SQL allowed');
 assertArchiveV3MainOnly(process.env);
 let phase='approved_main_only';
 try{
  const result=await auditCfbFinanceArchiveV3({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,undefined,value=>{phase=value});
  const b64=Buffer.from(JSON.stringify(result),'utf8').toString('base64');
  if(b64.length>120000)throw Error('Oversized safe archive V3 receipt');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_archive_v3_b64='+b64+'\n');
  console.log('CFB_864_ARCHIVE_V3_SAFE_AGGREGATE',{
   groups:result.rows.length,rollback:result.mandatoryRollbackComplete,
  });
 }catch{
  console.error('CFB_864_ARCHIVE_V3_HELD_AT='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,70}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'held_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-cfb-864-neon-finance-archive-upperbound-v3.ts'))
 void main();
