/**
 * #864 Track B: bounded READ ONLY pilot of existing VotePredict finance
 * evidence_items metadata. Never export private rows, donors, URLs, source
 * keys, identities, amounts or per-person statistics. This is a deterministic
 * 500-source-document / 64-evidence-rows-per-document PREFIX SAMPLE, and
 * is emphatically NOT a source-to-report or statewide completion count.
 */
import {appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';

export const CFB_864_ROW_PILOT_MARKER='SENATE_864_CFB_ROWS_READONLY_20261011_V1' as const;
export const SOURCE_DOCUMENT_CAP=500;
export const PER_SOURCE_EVIDENCE_CAP=64;
export const FINANCE_FAMILIES=[
 'campaign_finance_candidate_contribution_bulk',
 'campaign_finance_candidate_expenditure_bulk',
 'campaign_finance_independent_expenditure_bulk',
 'campaign_finance_bulk',
] as const;
const FAMILY_SET=new Set<string>(FINANCE_FAMILIES);
const METRICS=[
 'sampled_evidence_rows',
 'sampled_source_documents_with_rows',
 'senate_linked_rows',
 'senate_metadata_only_rows',
 'senate_eligible_claims',
 'senate_eligible_missing_due_on',
 'senate_eligible_missing_disclosed_on',
 'senate_eligible_filing_derived_flag',
] as const;
export const FIXED_FINANCE_SAMPLE_SQL=[
 'SELECT CASE WHEN e.metadata->>\'year\' ~ \'^202[1-5]$\'',
 'THEN e.metadata->>\'year\' ELSE \'unknown_or_outside\' END AS year,',
 'sd.source_kind AS family,',
 'count(*)::text AS sampled_evidence_rows,',
 'count(DISTINCT sd.id)::text AS sampled_source_documents_with_rows,',
 "count(*) FILTER (WHERE c.slug='senate')::text AS senate_linked_rows,",
 "count(*) FILTER (WHERE c.slug IS NULL AND e.metadata->>'chamber'='senate')::text",
 'AS senate_metadata_only_rows,',
 "count(*) FILTER (WHERE c.slug='senate' AND e.metadata->>'asOfEligible'='true')::text",
 'AS senate_eligible_claims,',
 "count(*) FILTER (WHERE c.slug='senate' AND e.metadata->>'asOfEligible'='true'",
 "AND NULLIF(e.metadata->>'reportDueOn','') IS NULL)::text AS senate_eligible_missing_due_on,",
 "count(*) FILTER (WHERE c.slug='senate' AND e.metadata->>'asOfEligible'='true'",
 "AND NULLIF(e.metadata->>'disclosedOn','') IS NULL)::text AS senate_eligible_missing_disclosed_on,",
 "count(*) FILTER (WHERE c.slug='senate' AND e.metadata->>'asOfEligible'='true'",
 "AND (e.metadata->>'filingDateDerivedAvailability'='true'",
 "OR e.metadata->>'availabilityProofKind'='cfb_report_filing'))::text",
 'AS senate_eligible_filing_derived_flag,',
 'FROM (SELECT id,source_kind FROM source_documents',
 "WHERE source_kind IN ('campaign_finance_candidate_contribution_bulk',",
 "'campaign_finance_candidate_expenditure_bulk',",
 "'campaign_finance_independent_expenditure_bulk','campaign_finance_bulk')",
 'ORDER BY source_kind,id LIMIT 500) sd',
 'JOIN LATERAL (SELECT ei.membership_id,ei.metadata FROM evidence_items ei',
 'WHERE ei.source_document_id=sd.id',
 'ORDER BY ei.created_at,ei.id LIMIT 64) e ON true',
 'LEFT JOIN memberships m ON m.id=e.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 'GROUP BY 1,2 ORDER BY 1,2',
].join(' ');

export type SafeFinancePilotRow={
 year:string;family:string;
 sampled_evidence_rows:string;sampled_source_documents_with_rows:string;
 senate_linked_rows:string;senate_metadata_only_rows:string;
 senate_eligible_claims:string;senate_eligible_missing_due_on:string;
 senate_eligible_missing_disclosed_on:string;senate_eligible_filing_derived_flag:string;
};
export function validateCfbPilotAggregateRows(rows:unknown):SafeFinancePilotRow[]{
 if(!Array.isArray(rows)||rows.length>24)throw Error('Invalid finance aggregate group count');
 const out:SafeFinancePilotRow[]=[],seen=new Set<string>();
 for(const item of rows){
  if(!item||typeof item!=='object'||Array.isArray(item))
   throw Error('Invalid finance aggregate shape');
  const x=item as Record<string,unknown>;
  if(typeof x.year!=='string'||!(/^202[1-5]$/.test(x.year)||x.year==='unknown_or_outside')
   ||typeof x.family!=='string'||!FAMILY_SET.has(x.family))
   throw Error('Unrecognized finance year or family');
  if(Object.keys(x).length!==10||Object.keys(x).some(k=>
     !(['year','family',...METRICS] as string[]).includes(k)))
   throw Error('Unapproved private column in aggregate result');
  const key=x.year+'|'+x.family;
  if(seen.has(key))throw Error('Repeated year/family group');
  seen.add(key);
  for(const k of METRICS){
   const v=x[k];
   if(typeof v!=='string'||!/^[0-9]+$/.test(v)||Number(v)>32000)
    throw Error('Unsafe finance aggregate count');
  }
  const count=Number(x.sampled_evidence_rows);
  if(Number(x.sampled_source_documents_with_rows)>500
    ||Number(x.sampled_source_documents_with_rows)>count)
   throw Error('Invalid sampled-document count');
  for(const k of METRICS.slice(2))
   if(Number(x[k])>count)throw Error('Finance subset metric exceeds scoped sample');
  out.push(x as SafeFinancePilotRow);
 }
 return out;
}
export function assertCfbPilotProtectedEnv(e:Record<string,string|undefined>):void{
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
   ||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'
   ||e.GITHUB_RUN_ATTEMPT!=='1'||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
   ||e.VOTEPREDICT_864_CFB_ROW_PILOT_APPROVAL!=='METADATA_AGGREGATE_PREFIX_SAMPLE_ONLY'
   ||e.VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED!=='true'
   ||e.VOTEPREDICT_864_CFB_ROW_PILOT_MARKER_PRESENT!=='true')
  throw Error('Protected reviewed first-attempt main-only CFB aggregate pilot required');
}
export async function auditCfbNeonHistoricalFinanceRowPilot(
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
  application_name:'vote-predict-864-cfb-prefix-aggregate-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=19000 -c lock_timeout=3000',
 });
 try{
  const client=(await pool.connect()) as Pick<PoolClient,'query'|'release'>;
  let transaction=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   transaction=true;
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(identity.rows.length!==1||identity.rows[0].db!==selected.database
     ||identity.rows[0].role!==selected.role||identity.rows[0].ro!=='on')
    throw Error('Verified existing VotePredict read-only session identity mismatch');
   phase('read_only_session_verified');
   const result=await client.query(FIXED_FINANCE_SAMPLE_SQL);
   const counts=validateCfbPilotAggregateRows(result.rows);
   phase('bounded_finance_sample_aggregated');
   await client.query('ROLLBACK');transaction=false;
   phase('rolled_back');
   return {
    schema:'cfb-864-existing-neon-bounded-finance-row-metadata-prefix-pilot-v1',
    issue:864,reportScope:'2021-2025_minnesota_senate_track_b',
    selectedExistingNeonDefaultBranch:true,
    selectedDatabaseDeploymentBindingUnverified:true,
    readOnlyRepeatableReadTransactionVerified:true,
    mandatoryRollbackComplete:true,
    producerWasReadOnly:true,
    privateRowsNamesDonorsAndAmountsExported:false,
    candidateTransactionVersionContainmentAudited:false,
    actualHistoricalPublicByIndependentlyVerified:false,
    sampledOnlyNotCensus:true,
    notStatewideReportingDutyDenominator:true,
    noPersistedAvailabilityCorrection:true,
    sourceDocumentsMaximum:SOURCE_DOCUMENT_CAP,
    perSourceEvidencePrefixMaximum:PER_SOURCE_EVIDENCE_CAP,
    sampleMayOmitLaterEvidenceRows:true,
    metadataYearMayBeMissing:true,
    membershipScopeDerivedFromPersistedLinkNotIndependentHistoricalService:true,
    fullSourceToPersistedRowReconciliationCompleted:false,
    productionMutations:0,issue864RemainsOpen:true,
    rows:counts,
   } as const;
  }finally{
   if(transaction){try{await client.query('ROLLBACK')}catch{/* connection is closed */}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No freeform SQL or CLI parameters');
 assertCfbPilotProtectedEnv(process.env);
 let phase='approved_main_only';
 try{
  const audit=await auditCfbNeonHistoricalFinanceRowPilot({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,undefined,value=>{phase=value});
  if(process.env.GITHUB_OUTPUT){
   const b64=Buffer.from(JSON.stringify(audit),'utf8').toString('base64');
   if(b64.length>35000)throw Error('Overlong safe aggregate');
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_finance_pilot_b64='+b64+'\n');
  }
  console.log('VOTEPREDICT_864_SAFE_CFB_FINANCE_PREFIX_COUNTS='+JSON.stringify(audit));
 }catch{
  console.error('VOTEPREDICT_864_CFB_PILOT_HELD_AT='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,70}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'held_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-cfb-864-neon-senate-finance-row-pilot.ts'))
 void main();
