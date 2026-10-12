/**
 * #864 Track B: V2 of the historical finance-only, existing-Neon-key prefix audit.
 * Fixed READ ONLY SQL returns aggregate COUNTS ONLY for 2021-25 and unknown-year
 * buckets, family and strictly allowlisted policy-generation bucket. Never
 * export policy strings, row values, identity keys, donors, amounts or URLs.
 * The same deterministic 500 x 64 SOURCE PREFIX as V1 is used for comparability.
 * This cannot establish historical PDF publication or official filing duties.
 */
import {appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';

export const CFB_864_KEYS_V2_MARKER='SENATE_864_CFB_KEYS_READONLY_20261012_V2' as const;
export const SOURCE_DOCUMENT_CAP=500;
export const PER_SOURCE_EVIDENCE_CAP=64;
export const FINANCE_FAMILIES=[
 'campaign_finance_candidate_contribution_bulk',
 'campaign_finance_candidate_expenditure_bulk',
 'campaign_finance_independent_expenditure_bulk',
 'campaign_finance_bulk',
] as const;
export const POLICY_BUCKETS=[
 'v8','v7','v1_to_v6','missing','other_or_unrecognized',
] as const;
export const COUNT_KEYS=[
 "senate_rows",
 "eligible_claims",
 "eligible_published_at",
 "eligible_metadata_available_on",
 "eligible_published_and_available_on",
 "eligible_date_disagreement",
 "eligible_neither_timing_field",
 "eligible_report_due_on",
 "eligible_legacy_due_on",
 "eligible_filed_on",
 "eligible_disclosed_on",
 "eligible_filing_derived",
 "eligible_source_label_direct_disclosure",
 "eligible_any_report_locator",
 "eligible_any_proof_url",
 "eligible_any_proof_digest",
 "eligible_row_key"
] as const;
const FAMILY_SET=new Set<string>(FINANCE_FAMILIES);
const VERSION_SET=new Set<string>(POLICY_BUCKETS);

/** No input interpolation, no raw metadata projection, no private GROUP BY. */
export const FIXED_FINANCE_V2_SQL=[ 
 "SELECT year, family, version_bucket,",
 "count(*) FILTER (WHERE TRUE)::text AS senate_rows,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true')::text AS eligible_claims,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND published_at IS NOT NULL)::text AS eligible_published_at,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND NULLIF(meta->>'availableOn','') IS NOT NULL)::text AS eligible_metadata_available_on,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND published_at IS NOT NULL AND NULLIF(meta->>'availableOn','') IS NOT NULL)::text AS eligible_published_and_available_on,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND published_at IS NOT NULL AND NULLIF(meta->>'availableOn','') IS NOT NULL AND LEFT(meta->>'availableOn',10)<>published_at::date::text)::text AS eligible_date_disagreement,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND published_at IS NULL AND NULLIF(meta->>'availableOn','') IS NULL)::text AS eligible_neither_timing_field,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND NULLIF(meta->>'reportDueOn','') IS NOT NULL)::text AS eligible_report_due_on,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND NULLIF(meta->>'dueOn','') IS NOT NULL)::text AS eligible_legacy_due_on,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND NULLIF(meta->>'filedOn','') IS NOT NULL)::text AS eligible_filed_on,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND NULLIF(meta->>'disclosedOn','') IS NOT NULL)::text AS eligible_disclosed_on,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND (meta->>'filingDateDerivedAvailability'='true' OR meta->>'availabilityProofKind'='cfb_report_filing'))::text AS eligible_filing_derived,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND meta->>'availabilityProofKind'='cfb_public_disclosure')::text AS eligible_source_label_direct_disclosure,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND (NULLIF(meta->>'reportId','') IS NOT NULL OR NULLIF(meta->>'sourceReportId','') IS NOT NULL OR NULLIF(meta->>'reportName','') IS NOT NULL))::text AS eligible_any_report_locator,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND (NULLIF(meta->>'availabilityProofUrl','') IS NOT NULL OR NULLIF(meta->>'proofUrl','') IS NOT NULL))::text AS eligible_any_proof_url,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND (NULLIF(meta->>'availabilityProofContentSha256','') IS NOT NULL OR NULLIF(meta->>'proofContentSha256','') IS NOT NULL OR NULLIF(meta->>'reportSha256','') IS NOT NULL))::text AS eligible_any_proof_digest,",
 "count(*) FILTER (WHERE meta->>'asOfEligible'='true' AND NULLIF(meta->>'rowKey','') IS NOT NULL)::text AS eligible_row_key",
 "FROM (",
 " SELECT CASE WHEN e.metadata->>'year' ~ '^202[1-5]$'",
 "   THEN e.metadata->>'year' ELSE 'unknown_or_outside' END AS year,",
 " sd.source_kind AS family,",
 " CASE",
 "   WHEN NULLIF(e.metadata->>'availabilityPolicyVersion','') IS NULL THEN 'missing'",
 "   WHEN e.metadata->>'availabilityPolicyVersion'='mn-cfb-report-availability-v8' THEN 'v8'",
 "   WHEN e.metadata->>'availabilityPolicyVersion'='mn-cfb-report-availability-v7' THEN 'v7'",
 "   WHEN e.metadata->>'availabilityPolicyVersion' ~ '^mn-cfb-report-availability-v[1-6]$' THEN 'v1_to_v6'",
 "   ELSE 'other_or_unrecognized' END AS version_bucket,",
 " e.metadata AS meta, e.published_at, c.slug AS chamber",
 " FROM (SELECT id,source_kind FROM source_documents",
 " WHERE source_kind IN ('campaign_finance_candidate_contribution_bulk',",
 " 'campaign_finance_candidate_expenditure_bulk',",
 " 'campaign_finance_independent_expenditure_bulk','campaign_finance_bulk')",
 " ORDER BY source_kind,id LIMIT 500) sd",
 " JOIN LATERAL (SELECT ei.membership_id,ei.metadata,ei.published_at",
 " FROM evidence_items ei WHERE ei.source_document_id=sd.id",
 " ORDER BY ei.created_at,ei.id LIMIT 64) e ON true",
 " LEFT JOIN memberships m ON m.id=e.membership_id",
 " LEFT JOIN chambers c ON c.id=m.chamber_id",
 ") sample",
 "WHERE chamber='senate'",
 "GROUP BY 1,2,3 ORDER BY 1,2,3",
].join(' ');

export type SafeFinanceV2Row={
 year:string;family:string;version_bucket:string;
} & Record<(typeof COUNT_KEYS)[number],string>;

export function validateFinanceV2Rows(value:unknown):SafeFinanceV2Row[]{
 if(!Array.isArray(value)||value.length>120)throw Error('Unsafe finance V2 aggregate groups');
 const out:SafeFinanceV2Row[]=[],seen=new Set<string>();
 for(const item of value){
  if(!item||typeof item!=='object'||Array.isArray(item))
   throw Error('Unsafe finance V2 row shape');
  const row=item as Record<string,unknown>;
  if(typeof row.year!=='string'
   || !(/^(?:202[1-5]|unknown_or_outside)$/.test(row.year))
   ||typeof row.family!=='string'||!FAMILY_SET.has(row.family)
   ||typeof row.version_bucket!=='string'||!VERSION_SET.has(row.version_bucket))
   throw Error('Unknown year, source family or version bucket');
  const allowed=['year','family','version_bucket',...COUNT_KEYS];
  if(Object.keys(row).length!==allowed.length
   ||Object.keys(row).some(k=>!allowed.includes(k)))
   throw Error('Private or unexpected finance V2 field');
  const group=[row.year,row.family,row.version_bucket].join('|');
  if(seen.has(group))throw Error('Repeated finance V2 count group');
  seen.add(group);
  for(const k of COUNT_KEYS){
   const num=row[k];
   if(typeof num!=='string'|| !/^[0-9]+$/.test(num)||Number(num)>32000)
    throw Error('Unsafe finance V2 integer value');
  }
  const total=Number(row.senate_rows),eligible=Number(row.eligible_claims);
  if(eligible>total)throw Error('Finance V2 eligible exceeds sample');
  for(const k of COUNT_KEYS.slice(2))
   if(Number(row[k])>eligible)throw Error('Finance V2 subset exceeds eligible');
  if(Number(row.eligible_date_disagreement)>Number(row.eligible_published_and_available_on))
   throw Error('Finance V2 date disagreement exceeds both-dates count');
  out.push(row as SafeFinanceV2Row);
 }
 return out;
}
export function assertFinanceV2ProtectedEnv(e:Record<string,string|undefined>):void{
 // GitHub may suppress push workflows for token-caused merges. A separately
 // reviewed owner-comment route is permitted ONLY after exact issue/owner/
 // one-shot-command checks in Actions and an explicit positive guard below.
 const approvedEvent=e.GITHUB_EVENT_NAME==='push'
   ||(e.GITHUB_EVENT_NAME==='issue_comment'
      &&e.VOTEPREDICT_864_CFB_KEYS_V2_OWNER_COMMENT_VERIFIED==='true');
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
   ||!approvedEvent||e.GITHUB_REF!=='refs/heads/main'
   ||e.GITHUB_RUN_ATTEMPT!=='1'||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
   ||e.VOTEPREDICT_864_CFB_KEYS_V2_APPROVAL!=='METADATA_KEY_PRESENCE_AGGREGATE_ONLY'
   ||e.VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED!=='true'
   ||e.VOTEPREDICT_864_CFB_KEYS_V2_MARKER_PRESENT!=='true')
  throw Error('Protected first-attempt main-only finance V2 approval required');
}
export async function auditCfbNeonFinanceMetadataV2(
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
  application_name:'votepredict-864-cfb-v2-count-only',
  options:'-c default_transaction_read_only=on -c statement_timeout=19000 -c lock_timeout=3000',
 });
 try{
  const client=(await pool.connect()) as Pick<PoolClient,'query'|'release'>;
  let open=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   open=true;
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(identity.rows.length!==1||identity.rows[0].db!==selected.database
     ||identity.rows[0].role!==selected.role||identity.rows[0].ro!=='on')
    throw Error('Finance V2 existing default-branch database identity mismatch');
   phase('read_only_session_verified');
   const observed=await client.query(FIXED_FINANCE_V2_SQL);
   const rows=validateFinanceV2Rows(observed.rows);
   phase('aggregate_counts_verified');
   await client.query('ROLLBACK');open=false;
   phase('rolled_back');
   return {
    schema:'cfb-864-existing-neon-metadata-key-presence-v2',
    issue:864,
    years:'2021-2025_plus_unknown_or_outside',
    selectedExistingNeonDefaultBranch:true,
    deployedDatabaseBindingNotProven:true,
    readOnlyRepeatableRead:true,
    rollbackComplete:true,
    noPrivateRowsDonorsAmountsOrKeysExported:true,
    noReportVersionPublicationProven:true,
    noTransactionRowContainmentProven:true,
    noFilingDutyDenominatorEstablished:true,
    storedEligibilityNotRepaired:true,
    sourcePrefixSampleNotCensus:true,
    sampleMembershipLinksNotIndependentRoster:true,
    sourceDocumentCap:SOURCE_DOCUMENT_CAP,
    perSourceEvidenceCap:PER_SOURCE_EVIDENCE_CAP,
    productionWrites:0,
    parentIssueOpen:true,
    rows,
   } as const;
  }finally{
   if(open){try{await client.query('ROLLBACK')}catch{/* connection closes */}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No parameters or arbitrary SQL accepted');
 assertFinanceV2ProtectedEnv(process.env);
 let phase='approved_main_only';
 try{
  const outcome=await auditCfbNeonFinanceMetadataV2({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,undefined,value=>{phase=value});
  const b64=Buffer.from(JSON.stringify(outcome),'utf8').toString('base64');
  if(b64.length>120000)throw Error('Finance V2 aggregate too large; fail closed');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_finance_v2_b64='+b64+'\n');
  console.log('VOTEPREDICT_864_CFB_KEYS_V2_AGGREGATE_COUNTS_ONLY='+JSON.stringify({
   safeValidatedGroups:outcome.rows.length,readOnlyRollback:outcome.rollbackComplete,
   sourcePrefixNotCensus:outcome.sourcePrefixSampleNotCensus,
  }));
 }catch{
  console.error('VOTEPREDICT_864_CFB_KEYS_V2_HELD_AT='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,70}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'held_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-cfb-864-neon-finance-proof-metadata-v2.ts'))
 void main();
