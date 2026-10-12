/**
 * #864 Track B V6: candidate-original source-to-stored parity only.
 * Expenditure raw bytes must freshly match both public independently verified
 * V4 immutable digests. Contributions still require fresh original CDX SHA1.
 * No source proof => NO protected database contact. On proof: exactly one
 * verified repeatable-read READ ONLY transaction, integer counts, ROLLBACK.
 *
 * This DOES NOT modify preexisting as-of eligibility or any serving data.
 */
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 FIXED_CFB_PARITY_V5_SQL,PARITY_METRICS,validateParityGroups,
} from './audit-cfb-864-authenticated-original-parity-v5.js';
import type {ParityGroup}
 from './audit-cfb-864-authenticated-original-parity-v5.js';
import {
 collectCandidateOriginalsV6,V6_CANDIDATE_SOURCES,
 V4_EXPENDITURE_CHECKPOINT,CFB_864_CANDIDATE_V6_MARKER,
} from './prove-cfb-864-candidate-originals-v6.js';
import type {
 AuthenticatedPinnedRows,PinnedResult,
} from './prove-cfb-864-pinned-public-originals-v4.js';

export {CFB_864_CANDIDATE_V6_MARKER,FIXED_CFB_PARITY_V5_SQL};
export const CFB_864_CANDIDATE_V6_APPROVAL=
 'PRIOR_V4_DUAL_DIGEST_AND_FRESH_CDX_CANDIDATE_ROW_PARITY_COUNTS_ONLY' as const;
export interface CandidateV6Receipt{
 schema:'cfb-864-candidate-original-to-stored-v6';issue:864;
 sourcePrefixSelectionNotFrozen:true;sampleSourceCap:500;
 perSourceEvidenceCap:64;sourceCount:3;
 freshAuthenticatedSources:number;heldSourceCount:number;
 allSourcesHoldNotMissingRows:boolean;
 protectedReadOnlyConnectionEstablished:boolean;explicitRollbackComplete:boolean;
 priorV4Sha1AndSha256RequiredForExpenditures:true;
 freshCdxRequiredForContributions:true;
 noSourceVersionDoubleCounting:true;
 zeroDatabaseWrites:true;deployedProductionBindingUnverified:true;
 oldFilingDerivedClaimsUnmodified:true;
 earliestOriginalPublicationKnown:false;
 officialFilingDutyDenominatorEstablished:false;
 privateKeysDonorsAmountsAndRawUrlsExported:false;
 results:ParityGroup[];
 heldSources:Array<{sourceId:string;status:PinnedResult['status']}>;
}
function candidateFamily(stream:AuthenticatedPinnedRows['source']['stream']):ParityGroup['family']{
 if(stream==='candidate_contributions')
  return 'campaign_finance_candidate_contribution_bulk';
 if(stream==='candidate_expenditures')
  return 'campaign_finance_candidate_expenditure_bulk';
 throw Error('Non-candidate source cannot be audited by V6');
}
function vettedPrivateOriginal(original:AuthenticatedPinnedRows):string[]{
 const source=V6_CANDIDATE_SOURCES.find(s=>s.id===original.source.id);
 if(!source||source.original!==original.source.original
  ||source.timestamp!==original.source.timestamp
  ||source.stream!==original.source.stream
  ||original.proof.id!==source.id||original.proof.stream!==source.stream
  ||original.proof.capturedOn!==source.timestamp.slice(0,4)+'-'
   +source.timestamp.slice(4,6)+'-'+source.timestamp.slice(6,8)
  ||!(/^[A-Z2-7]{32}$/.test(original.proof.cdxSha1Base32))
  ||!(/^[a-f0-9]{64}$/.test(original.proof.originalSha256))
  ||original.rowKeys.size!==original.proof.distinctRowKeys
  ||original.rowKeys.size<1||original.rowKeys.size>250000)
  throw Error('Untrusted candidate source original');
 if(source.id===V4_EXPENDITURE_CHECKPOINT.sourceId
  &&(original.proof.cdxSha1Base32!==V4_EXPENDITURE_CHECKPOINT.cdxSha1Base32
   ||original.proof.originalSha256!==V4_EXPENDITURE_CHECKPOINT.originalSha256
   ||original.proof.originalBytes!==V4_EXPENDITURE_CHECKPOINT.originalBytes
   ||original.proof.rows2021!==V4_EXPENDITURE_CHECKPOINT.rows2021
   ||original.proof.rows2022!==V4_EXPENDITURE_CHECKPOINT.rows2022
   ||original.proof.distinctRowKeys!==V4_EXPENDITURE_CHECKPOINT.distinctRowKeys))
  throw Error('V4 expenditure original failed previously certified digest/checkpoint');
 const keys=[...original.rowKeys];
 if(keys.some(k=>!(/^[a-f0-9]{64}$/.test(k))))
  throw Error('Untrusted private original row key');
 return keys;
}
export function assertCandidateV6MainOnly(env:Record<string,string|undefined>){
 const owner=env.GITHUB_EVENT_NAME==='issue_comment'
  &&env.CFB_864_CANDIDATE_V6_OWNER_COMMENT_VERIFIED==='true';
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))
  ||env.CFB_864_CANDIDATE_V6_MARKER_VERIFIED!=='true'
  ||env.CFB_864_CANDIDATE_V6_FULL_CI_GREEN!=='true'
  ||env.CFB_864_CANDIDATE_V6_APPROVAL!==CFB_864_CANDIDATE_V6_APPROVAL
  ||!(env.GITHUB_EVENT_NAME==='push'||owner))
  throw Error('Not an owner/reviewed first-attempt main-only candidate finance read-only run');
}
export async function auditCandidateOriginalParityV6(
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchPublic:typeof fetch=fetch,
 fetchNeon:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(opts:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  opts=>new Pool(opts),
 phase:(value:string)=>void=()=>{},
):Promise<CandidateV6Receipt>{
 const originals:AuthenticatedPinnedRows[]=[];
 const publicReceipt=await collectCandidateOriginalsV6(
  fetchPublic,async original=>{
   vettedPrivateOriginal(original);
   originals.push(original);
  });
 phase('candidate_original_source_validation_finished');
 const heldSources=publicReceipt.results.filter(r=>r.status!=='verified')
  .map(r=>({sourceId:r.id,status:r.status}));
 if(publicReceipt.results.length!==3
  ||heldSources.length+originals.length!==3
  ||originals.some((o,i)=>originals.slice(0,i).some(p=>p.source.id===o.source.id)))
  throw Error('Unsafe candidate source enumeration');
 const core={
  schema:'cfb-864-candidate-original-to-stored-v6' as const,
  issue:864 as const,sourcePrefixSelectionNotFrozen:true as const,
  sampleSourceCap:500 as const,perSourceEvidenceCap:64 as const,
  sourceCount:3 as const,freshAuthenticatedSources:originals.length,
  heldSourceCount:heldSources.length,allSourcesHoldNotMissingRows:originals.length===0,
  priorV4Sha1AndSha256RequiredForExpenditures:true as const,
  freshCdxRequiredForContributions:true as const,
  noSourceVersionDoubleCounting:true as const,
  zeroDatabaseWrites:true as const,
  deployedProductionBindingUnverified:true as const,
  oldFilingDerivedClaimsUnmodified:true as const,
  earliestOriginalPublicationKnown:false as const,
  officialFilingDutyDenominatorEstablished:false as const,
  privateKeysDonorsAmountsAndRawUrlsExported:false as const,
  heldSources,
 };
 if(!originals.length){
  phase('all_candidate_originals_hold_no_neon_contact');
  return {...core,protectedReadOnlyConnectionEstablished:false,
   explicitRollbackComplete:false,results:[]};
 }
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchNeon);
 phase('existing_neon_default_branch_confirmed');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:8000,query_timeout:40000,statement_timeout:35000,
  application_name:'votepredict-864-cfb-candidate-parity-v6',
  options:'-c default_transaction_read_only=on -c statement_timeout=35000 -c lock_timeout=3000',
 });
 const results:ParityGroup[]=[];
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
    throw Error('Protected DB session identity/read-only mismatch');
   phase('protected_read_only_identity_verified');
   for(const original of originals){
    const keys=vettedPrivateOriginal(original);
    const family=candidateFamily(original.source.stream);
    const args=[original.source.original,original.proof.cdxSha1Base32,
     original.proof.capturedOn,keys,family];
    const response=await client.query(FIXED_CFB_PARITY_V5_SQL,args);
    if(response.rows.length!==1)throw Error('Unexpected protected aggregate row count');
    const row=response.rows[0] as Record<string,unknown>;
    if(Object.keys(row).length!==PARITY_METRICS.length
     ||Object.keys(row).some(k=>!PARITY_METRICS.includes(k as typeof PARITY_METRICS[number])))
     throw Error('Non-count private SQL column');
    const safe={
     sourceId:original.source.id,family,
     captureDay:original.proof.capturedOn,
     publicOriginalSha256:original.proof.originalSha256,
     publicParsedUniqueKeys:original.proof.distinctRowKeys,...row,
    } as ParityGroup;
    validateParityGroups([safe]);
    results.push(safe);
   }
   validateParityGroups(results);
   phase('candidate_parity_counts_only_validated');
   await client.query('ROLLBACK');active=false;
   phase('protected_rollback_complete');
   return {...core,protectedReadOnlyConnectionEstablished:true,
    explicitRollbackComplete:true,results};
  }finally{
   if(active){try{await client.query('ROLLBACK')}catch{}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No freeform protected audit options');
 assertCandidateV6MainOnly(process.env);
 let phase='reviewed_candidate_v6_main';
 try{
  const receipt=await auditCandidateOriginalParityV6({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,fetch,undefined,s=>{phase=s});
  const safe=JSON.stringify(receipt);
  if(safe.length>9000)throw Error('Unexpected oversized numeric-only candidate parity receipt');
  console.log('CFB_864_CANDIDATE_V6_COUNTS_ONLY '+safe);
 }catch{
  console.error('CFB_864_CANDIDATE_V6_HELD_AT='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/')
 .endsWith('/audit-cfb-864-candidate-parity-v6.ts'))
 void main();
