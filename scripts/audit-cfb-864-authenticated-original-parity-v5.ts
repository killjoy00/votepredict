/**
 * #864 Track B V5: original archived 2021-22 CFB CSV to persisted source
 * claims. Only fresh pinned CDX-SHA1/raw-original authentications may
 * enter SQL. Exactly first 500 finance documents and first 64 evidence
 * items/document, membership-chamber senate. SQL selects COUNTS ONLY;
 * rowKey arrays remain in protected process memory/bound PG parameters.
 * Mandatory transaction READ ONLY REPEATABLE READ and explicit ROLLBACK.
 */
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 collectPinnedCfbOriginals,PINNED_CFB_ORIGINALS,
} from './prove-cfb-864-pinned-public-originals-v4.js';
import type {
 AuthenticatedPinnedRows,PinnedStream,PinnedResult,
} from './prove-cfb-864-pinned-public-originals-v4.js';

export const CFB_864_PARITY_V5_MARKER='SENATE_864_CFB_ORIGINAL_PARITY_READONLY_V5_20261012' as const;
export const FIXED_CFB_PARITY_V5_SQL=[
 "WITH trusted_keys AS (SELECT DISTINCT unnest($4::text[]) AS row_key),",
 "prefix_sources AS (SELECT sd.id,sd.source_kind FROM source_documents sd",
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk',",
 "'campaign_finance_candidate_expenditure_bulk','campaign_finance_independent_expenditure_bulk',",
 "'campaign_finance_bulk') ORDER BY sd.source_kind,sd.id LIMIT 500),",
 "sample AS (SELECT sd.source_kind,e.metadata AS m,e.published_at,c.slug AS chamber",
 "FROM prefix_sources sd",
 "JOIN LATERAL (SELECT ei.membership_id,ei.metadata,ei.published_at",
 "FROM evidence_items ei WHERE ei.source_document_id=sd.id",
 "ORDER BY ei.created_at,ei.id LIMIT 64) e ON true",
 "LEFT JOIN memberships membership ON membership.id=e.membership_id",
 "LEFT JOIN chambers c ON c.id=membership.chamber_id),",
 "verified AS (SELECT s.source_kind,s.m,s.published_at,",
 "regexp_replace(coalesce(s.m->>'availabilitySourceUrl',''),'^http:','https:')=$1::text AS same_source,",
 "s.m->>'archiveDigest'=$2::text AS same_digest,",
 "LEFT(coalesce(s.m->>'archiveCapturedAt',''),10)=$3::text AS same_day,",
 "t.row_key IS NOT NULL AS has_original_row,",
 "s.published_at IS NOT NULL AND",
 "to_char(s.published_at AT TIME ZONE 'UTC','YYYY-MM-DD')=$3::text AS same_published_day",
 "FROM sample s LEFT JOIN trusted_keys t ON t.row_key=s.m->>'rowKey'",
 "WHERE s.chamber='senate' AND s.source_kind=$5::text",
 "AND s.m->>'year' IN ('2021','2022')",
 "AND s.m->>'asOfEligible'='true'",
 "AND s.m->>'availabilityProof'='independent_archive_capture_exact_row')",
 "SELECT",
 "count(*)::text AS family_archived_claims,",
 "count(*) FILTER (WHERE same_source)::text AS same_source_claims,",
 "count(*) FILTER (WHERE same_source AND same_digest)::text AS same_source_digest,",
 "count(*) FILTER (WHERE same_source AND same_day)::text AS same_source_capture_day,",
 "count(*) FILTER (WHERE same_source AND has_original_row)::text AS same_source_original_row,",
 "count(*) FILTER (WHERE same_source AND same_digest AND same_day)::text AS version_claims,",
 "count(*) FILTER (WHERE same_source AND same_digest AND same_day AND has_original_row)::text AS verified_full_observations,",
 "count(DISTINCT m->>'rowKey') FILTER",
 "(WHERE same_source AND same_digest AND same_day AND has_original_row)::text AS verified_distinct_row_keys,",
 "count(*) FILTER (WHERE same_source AND same_digest AND same_day AND NOT has_original_row)::text AS matching_version_row_not_in_original,",
 "count(*) FILTER (WHERE same_source AND has_original_row AND same_digest AND NOT same_day)::text AS row_digest_match_other_capture_day,",
 "count(*) FILTER (WHERE same_source AND has_original_row AND same_day AND NOT same_digest)::text AS row_date_match_other_digest,",
 "count(*) FILTER (WHERE same_source AND same_digest AND same_day AND has_original_row AND same_published_day)::text AS verified_full_published_day_agrees,",
 "count(*) FILTER (WHERE m->>'rowKey' IS NULL OR m->>'rowKey'='')::text AS archived_missing_row_key",
 "FROM verified",
].join(' ');

export const PARITY_METRICS=[
 'family_archived_claims','same_source_claims','same_source_digest',
 'same_source_capture_day','same_source_original_row','version_claims',
 'verified_full_observations','verified_distinct_row_keys',
 'matching_version_row_not_in_original','row_digest_match_other_capture_day',
 'row_date_match_other_digest','verified_full_published_day_agrees',
 'archived_missing_row_key',
] as const;
type Metric=(typeof PARITY_METRICS)[number];
export type ParityGroup={
 sourceId:(typeof PINNED_CFB_ORIGINALS)[number]['id'];
 family:'campaign_finance_candidate_contribution_bulk'
  |'campaign_finance_candidate_expenditure_bulk'
  |'campaign_finance_independent_expenditure_bulk';
 captureDay:string;
 publicOriginalSha256:string;
 publicParsedUniqueKeys:number;
} & Record<Metric,string>;
export interface ParityReceipt{
 schema:'cfb-864-authenticated-original-to-stored-v5';
 issue:864;sourcePrefixSelectionNotFrozen:true;
 sampleSourceCap:500;perSourceEvidenceCap:64;
 sourceCount:number;freshAuthenticatedSources:number;
 heldSourceCount:number;
 allSourcesHoldNotMissingRows:boolean;
 protectedReadOnlyConnectionEstablished:boolean;
 explicitRollbackComplete:boolean;
 zeroDatabaseWrites:true;
 deployedProductionBindingUnverified:true;
 oldFilingDerivedClaimsUnmodified:true;
 earliestOriginalPublicationKnown:false;
 officialFilingDutyDenominatorEstablished:false;
 privateKeysDonorsAmountsAndRawUrlsExported:false;
 results:ParityGroup[];
 heldSources:Array<{sourceId:string;status:PinnedResult['status']}>;
}
function familyOf(stream:PinnedStream):ParityGroup['family']{
 return stream==='candidate_contributions'
  ?'campaign_finance_candidate_contribution_bulk'
  :stream==='candidate_expenditures'
  ?'campaign_finance_candidate_expenditure_bulk'
  :'campaign_finance_independent_expenditure_bulk';
}
function validateAuthenticated(a:AuthenticatedPinnedRows):string[]{
 const source=PINNED_CFB_ORIGINALS.find(x=>x.id===a.source.id);
 if(!source||source.stream!==a.source.stream
   ||source.original!==a.source.original
   ||source.timestamp!==a.source.timestamp
   ||a.proof.id!==source.id||a.proof.stream!==source.stream
   ||!(/^[A-Z2-7]{32}$/.test(a.proof.cdxSha1Base32))
   ||!(/^[a-f0-9]{64}$/.test(a.proof.originalSha256))
   ||!(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(a.proof.capturedOn))
   ||a.proof.capturedOn!==source.timestamp.slice(0,4)+'-'
      +source.timestamp.slice(4,6)+'-'+source.timestamp.slice(6,8)
   ||a.rowKeys.size!==a.proof.distinctRowKeys
   ||a.rowKeys.size<1||a.rowKeys.size>250000)
   throw Error('Authenticated source cannot be used in protected SQL');
 const keys=Array.from(a.rowKeys);
 if(keys.some(x=>!(/^[a-f0-9]{64}$/.test(x))))
  throw Error('Untrusted row key from public original parser');
 return keys;
}
export function validateParityGroups(groups:unknown):ParityGroup[]{
 if(!Array.isArray(groups)||groups.length>10)throw Error('Unsafe protected group count');
 const seen=new Set<string>();
 for(const item of groups){
  if(!item||typeof item!=='object'||Array.isArray(item))
   throw Error('Unsafe parity group');
  const r=item as Record<string,unknown>;
  const keys=['sourceId','family','captureDay','publicOriginalSha256',
   'publicParsedUniqueKeys',...PARITY_METRICS];
  const source=PINNED_CFB_ORIGINALS.find(x=>x.id===r.sourceId);
  if(!source||r.family!==familyOf(source.stream)
   ||r.captureDay!==source.timestamp.slice(0,4)+'-'
      +source.timestamp.slice(4,6)+'-'+source.timestamp.slice(6,8)
   ||typeof r.publicOriginalSha256!=='string'
   ||!(/^[a-f0-9]{64}$/.test(r.publicOriginalSha256))
   ||!Number.isInteger(r.publicParsedUniqueKeys)
   ||Number(r.publicParsedUniqueKeys)<1||Number(r.publicParsedUniqueKeys)>250000
   ||Object.keys(r).length!==keys.length
   ||Object.keys(r).some(k=>!keys.includes(k))
   ||seen.has(source.id))throw Error('Unsafe parity proof label');
  seen.add(source.id);
  for(const key of PARITY_METRICS){
   if(typeof r[key]!=='string'||!(/^[0-9]+$/.test(r[key]))
    ||Number(r[key])>32000)throw Error('Private or malformed parity count');
  }
  const total=Number(r.family_archived_claims);
  if(PARITY_METRICS.slice(1).some(k=>Number(r[k])>total)
   ||Number(r.verified_distinct_row_keys)>Number(r.verified_full_observations)
   ||Number(r.verified_full_observations)>Number(r.version_claims)
   ||Number(r.verified_full_published_day_agrees)>Number(r.verified_full_observations)
   ||Number(r.matching_version_row_not_in_original)+Number(r.verified_full_observations)>Number(r.version_claims))
   throw Error('Impossible protected subset counts');
 }
 return groups as ParityGroup[];
}
export function assertParityV5MainOnly(env:Record<string,string|undefined>){
 const owner=env.GITHUB_EVENT_NAME==='issue_comment'
  &&env.CFB_864_PARITY_V5_OWNER_COMMENT_VERIFIED==='true';
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))
  ||env.CFB_864_PARITY_V5_MARKER_VERIFIED!=='true'
  ||env.CFB_864_PARITY_V5_FULL_CI_GREEN!=='true'
  ||env.CFB_864_PARITY_V5_APPROVAL!=='PINNED_RAW_CDX_AND_ORIGINAL_ROW_PARITY_COUNTS_ONLY'
  ||!(env.GITHUB_EVENT_NAME==='push'||owner))
  throw Error('Only reviewed first-attempt protected exact-main aggregate SQL');
}
export async function auditPinnedCfbOriginalParityV5(
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchPublic:typeof fetch=fetch,
 fetchNeon:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(opts:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  opts=>new Pool(opts),
 phase:(value:string)=>void=()=>{},
):Promise<ParityReceipt>{
 // First authenticate public CDX and FULL raw original bodies, before Neon
 // project discovery/DB network. Callback holds row keys in protected memory.
 const originals:AuthenticatedPinnedRows[]=[];
 const publicReceipt=await collectPinnedCfbOriginals(
  fetchPublic,async a=>{validateAuthenticated(a);originals.push(a)});
 phase('public_source_validation_finished');
 const heldSources=publicReceipt.results.filter(r=>r.status!=='verified')
  .map(r=>({sourceId:r.id,status:r.status}));
 const core={
  schema:'cfb-864-authenticated-original-to-stored-v5' as const,
  issue:864 as const,
  sourcePrefixSelectionNotFrozen:true as const,
  sampleSourceCap:500 as const,perSourceEvidenceCap:64 as const,
  sourceCount:PINNED_CFB_ORIGINALS.length,
  freshAuthenticatedSources:originals.length,heldSourceCount:heldSources.length,
  allSourcesHoldNotMissingRows:originals.length===0,
  zeroDatabaseWrites:true as const,
  deployedProductionBindingUnverified:true as const,
  oldFilingDerivedClaimsUnmodified:true as const,
  earliestOriginalPublicationKnown:false as const,
  officialFilingDutyDenominatorEstablished:false as const,
  privateKeysDonorsAmountsAndRawUrlsExported:false as const,
  heldSources,
 };
 if(originals.length===0){
  phase('all_original_sources_hold_no_neon_contact');
  return {
   ...core,protectedReadOnlyConnectionEstablished:false,
   explicitRollbackComplete:false,results:[],
  };
 }
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchNeon);
 phase('existing_neon_default_branch_confirmed');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:8000,
  query_timeout:40000,statement_timeout:35000,
  application_name:'votepredict-864-cfb-authenticated-parity-v5',
  options:'-c default_transaction_read_only=on -c statement_timeout=35000 -c lock_timeout=3000',
 });
 const result:ParityGroup[]=[];
 try{
  const client=(await pool.connect()) as Pick<PoolClient,'query'|'release'>;
  let active=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   active=true;
   const check=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(check.rows.length!==1||check.rows[0].db!==selected.database
    ||check.rows[0].role!==selected.role||check.rows[0].ro!=='on')
    throw Error('Protected DB session identity/READ ONLY mismatch');
   phase('protected_read_only_identity_verified');
   for(const original of originals){
    const keys=validateAuthenticated(original);
    const family=familyOf(original.source.stream);
    const vars=[original.source.original,original.proof.cdxSha1Base32,
     original.proof.capturedOn,keys,family];
    const response=await client.query(FIXED_CFB_PARITY_V5_SQL,vars);
    if(response.rows.length!==1)throw Error('Unsafe protected aggregate row count');
    const row=response.rows[0] as Record<string,unknown>;
    if(Object.keys(row).length!==PARITY_METRICS.length
      ||Object.keys(row).some(k=>!PARITY_METRICS.includes(k as Metric)))
      throw Error('Unexpected protected DB output');
    const safe={
     sourceId:original.source.id,family,
     captureDay:original.proof.capturedOn,
     publicOriginalSha256:original.proof.originalSha256,
     publicParsedUniqueKeys:original.proof.distinctRowKeys,
     ...row,
    } as ParityGroup;
    validateParityGroups([safe]);
    result.push(safe);
   }
   validateParityGroups(result);
   phase('all_aggregate_groups_sanitized');
   await client.query('ROLLBACK');
   active=false;phase('protected_rollback_complete');
   return {...core,protectedReadOnlyConnectionEstablished:true,
    explicitRollbackComplete:true,results:result};
  }finally{
   if(active){try{await client.query('ROLLBACK')}catch{}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No freeform arguments in protected finance audit');
 assertParityV5MainOnly(process.env);
 let phase='approved_exact_main';
 try{
  const receipt=await auditPinnedCfbOriginalParityV5({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,fetch,undefined,s=>{phase=s});
  const safe=JSON.stringify(receipt);
  if(safe.length>16000)throw Error('Oversized aggregate-only receipt');
  // Query returns only finite aggregate-count fields, and source proof hashes
  // are wholly public. Never log SQL variables, row keys or raw source bytes.
  console.log('CFB_864_PARITY_V5_AGGREGATE_ONLY '+safe);
 }catch{
  console.error('CFB_864_PARITY_V5_HELD_AT='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/')
 .endsWith('/audit-cfb-864-authenticated-original-parity-v5.ts'))
 void main();
