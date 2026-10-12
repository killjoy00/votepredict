/**
 * #864 Track B V6 — targeted 2022 candidate-expenditure original-byte
 * reauthentication and aggregate-only Senate stored-provenance parity.
 *
 * Independent first-party PUBLIC source run #38285676317 already fetched the
 * exact immutable 2022-06-06 archival original, matched original CDX SHA1,
 * and SHA256-hashed 41,138,871 raw bytes. This script RE-FETCHES and re-hashes
 * the full raw body against BOTH of those fixed reviewed public fingerprints
 * before even discovering protected Neon credentials. It does NOT freshly
 * query CDX. A network error, date-changing redirect, digest mismatch or
 * parser-count drift is a HOLD, never absent records or eligibility repair.
 *
 * No DB writes, row keys/people/donors/amounts/raw CSV in logs or receipts.
 */
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {sha1Base32} from './prove-cfb-864-public-archived-csv-source-v1.js';
import {
 PINNED_CFB_ORIGINALS,validReplayRedirect,
} from './prove-cfb-864-pinned-public-originals-v4.js';
import {parseCfbCandidateExpenditureCsv}
 from '../src/evidence/cfb-candidate-finance-history.js';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 FIXED_CFB_PARITY_V5_SQL,validateParityGroups,
} from './audit-cfb-864-authenticated-original-parity-v5.js';
import type {ParityGroup}
 from './audit-cfb-864-authenticated-original-parity-v5.js';

export const CFB_864_EXP_V6_MARKER='SENATE_864_CFB_EXPENDITURE_ANCHORED_V6_20261012' as const;
export const CFB_864_EXP_V6_SCHEMA='cfb-864-candidate-expenditure-frozen-original-v6' as const;
export const ANCHOR_ID='cand_expend_2022' as const;
export const ANCHOR_TIMESTAMP='20220606103037' as const;
export const ANCHOR_ORIGINAL_SHA256='6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b' as const;
export const ANCHOR_ORIGINAL_CDX_SHA1='GMF33XY3X4LNADGCPU52JWEDWRHXE23V' as const;
export const ANCHOR_ORIGINAL_BYTES=41138871;
export const ANCHOR_ROWS_2021=18497;
export const ANCHOR_ROWS_2022=3241;
export const ANCHOR_DISTINCT_ROW_KEYS=21495;
export const ANCHOR_MAX_BYTES=120000000;

const source=PINNED_CFB_ORIGINALS.find(x=>x.id===ANCHOR_ID)!;
if(!source||source.timestamp!==ANCHOR_TIMESTAMP
 ||source.stream!=='candidate_expenditures'
 ||new URL(source.original).hostname!=='cfb.mn.gov'
 ||new URL(source.original).searchParams.get('download')!=='-1890073264')
 throw Error('Reviewed 2022 candidate expenditure source identity changed');

export type AnchorHoldReason=
 |'replay_network_hold'|'replay_http_hold'|'replay_redirect_hold'
 |'replay_over_cap'|'replay_original_hash_hold'|'parser_identity_hold';
type AnchorProof={status:'verified';sha256:typeof ANCHOR_ORIGINAL_SHA256;
 cdxSha1:typeof ANCHOR_ORIGINAL_CDX_SHA1;bytes:number;
 rows2021:number;rows2022:number;distinctRowKeys:number;
 rowKeys:Set<string>};
type AnchorHold={status:AnchorHoldReason;rowKeys?:never};
export type AnchorResult=AnchorProof|AnchorHold;
export type CandidateV6Receipt={
 schema:typeof CFB_864_EXP_V6_SCHEMA;issue:864;
 sourceId:typeof ANCHOR_ID;captureDay:'2022-06-06';
 independentPublicV4CDXAnchorRun:38285676317;
 priorPublicOriginalSha256:typeof ANCHOR_ORIGINAL_SHA256;
 priorPublicOriginalCdxSha1:typeof ANCHOR_ORIGINAL_CDX_SHA1;
 liveCdxIndexQueried:false;
 result:'held_at_original'|'authenticated_original_and_protected_parity';
 heldReason:AnchorHoldReason|null;
 freshFullOriginalSha1AndSha256Match:boolean;
 protectedReadOnlyConnectionEstablished:boolean;
 explicitRollbackComplete:boolean;
 sourcePrefixSelectionNotFrozen:true;
 sampleSourceCap:500;perSourceEvidenceCap:64;
 storedCandidateEvidenceChanged:false;productionWrites:0;
 firstPublicDateEstablished:false;
 originalReportPdfHistoricalPublicByProven:false;
 legalFilingDutyDenominatorEstablished:false;
 productionBindingVerified:false;
 privateKeysPeopleDonorsAmountsAndRawUrlsExported:false;
 parity:ParityGroup|null;
};

export function assertExpenditureV6Main(e:Record<string,string|undefined>):void{
 const comment=e.GITHUB_EVENT_NAME==='issue_comment'
  &&e.CFB_864_EXP_V6_OWNER_COMMENT_VERIFIED==='true';
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
  ||e.CFB_864_EXP_V6_MAIN_MARKER_VERIFIED!=='true'
  ||e.CFB_864_EXP_V6_FULL_CI_GREEN!=='true'
  ||e.CFB_864_EXP_V6_APPROVAL!=='FROZEN_PUBLIC_CDX_AND_FULL_RAW_SHA256_COUNT_ONLY'
  ||!(e.GITHUB_EVENT_NAME==='push'||comment))
  throw Error('Unapproved candidate expenditure protected V6 one-shot');
}
function held(reason:AnchorHoldReason):AnchorHold{return{status:reason}}
async function bounded(response:Response):Promise<Uint8Array>{
 const length=response.headers.get('content-length');
 if(length!==null){
  if(!/^[0-9]+$/.test(length)||Number(length)>ANCHOR_MAX_BYTES)
   throw Error('body cap');
 }
 if(!response.body)throw Error('missing stream');
 const reader=response.body.getReader();let bytes=0;
 const chunks:Uint8Array[]=[];
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>ANCHOR_MAX_BYTES)throw Error('body cap');
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const out=new Uint8Array(bytes);let offset=0;
 for(const c of chunks){out.set(c,offset);offset+=c.byteLength}
 return out;
}
export async function reauthenticateFrozen2022CandidateExpenditure(
 fetchPublic:typeof fetch=fetch,
):Promise<AnchorResult>{
 const base='https://web.archive.org/web/'+source.timestamp+'id_/'+source.original;
 let current=base;
 for(let hop=0;hop<=2;hop++){
  let response:Response;
  try{
   response=await fetchPublic(current,{
    redirect:'manual',
    headers:{'user-agent':'VotePredict/2.0 cfb-864-exp-v6-original'},
    signal:AbortSignal.timeout(180000),
   });
  }catch{return held('replay_network_hold')}
  try{
   if(!response.url)throw Error('missing final replay URL');
   const effective=new URL(response.url),requested=new URL(current);
   if(effective.origin!=='https://web.archive.org'
    ||effective.pathname!==requested.pathname
    ||effective.search!==requested.search)
    throw Error('changed capture');
  }catch{return held('replay_redirect_hold')}
  if(response.status>=300&&response.status<=399){
   if(hop===2)return held('replay_redirect_hold');
   try{
    current=validReplayRedirect(
     current,response.headers.get('location')??'',source);
   }catch{return held('replay_redirect_hold')}
   continue;
  }
  if(response.status!==200)return held('replay_http_hold');
  if((response.headers.get('content-type')??'').toLowerCase().includes('text/html'))
   return held('parser_identity_hold');
  let bytes:Uint8Array;
  try{bytes=await bounded(response)}catch(e){
   return held(e instanceof Error&&/cap/.test(e.message)
    ?'replay_over_cap':'replay_network_hold');
  }
  if(bytes.byteLength!==ANCHOR_ORIGINAL_BYTES
    ||sha1Base32(bytes)!==ANCHOR_ORIGINAL_CDX_SHA1
    ||createHash('sha256').update(bytes).digest('hex')!==ANCHOR_ORIGINAL_SHA256)
   return held('replay_original_hash_hold');
  try{
   const text=Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,'');
   if(!/\bYear\b/i.test(text.slice(0,500)))
    return held('parser_identity_hold');
   const rows=parseCfbCandidateExpenditureCsv(text,{fromYear:2021,toYear:2022});
   const n21=rows.filter(r=>r.year===2021).length;
   const n22=rows.filter(r=>r.year===2022).length;
   const keys=new Set(rows.map(r=>r.rowKey));
   if(n21!==ANCHOR_ROWS_2021||n22!==ANCHOR_ROWS_2022
    ||keys.size!==ANCHOR_DISTINCT_ROW_KEYS
    ||[...keys].some(k=>!/^[a-f0-9]{64}$/.test(k)))
    return held('parser_identity_hold');
   return {status:'verified',sha256:ANCHOR_ORIGINAL_SHA256,
    cdxSha1:ANCHOR_ORIGINAL_CDX_SHA1,bytes:bytes.length,
    rows2021:n21,rows2022:n22,distinctRowKeys:keys.size,rowKeys:keys};
  }catch{return held('parser_identity_hold')}
 }
 return held('replay_redirect_hold');
}
export async function auditAnchoredExpenditureV6(
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchPublic:typeof fetch=fetch,
 fetchNeon:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(options:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  options=>new Pool(options),
 phase:(name:string)=>void=()=>{},
):Promise<CandidateV6Receipt>{
 // No private Neon discovery before the full previously independently
 // CDX-authenticated raw original hashes and parses to their frozen values.
 const original=await reauthenticateFrozen2022CandidateExpenditure(fetchPublic);
 phase('anchored_original_rehash_checked');
 const base={
  schema:CFB_864_EXP_V6_SCHEMA,issue:864 as const,sourceId:ANCHOR_ID,
  captureDay:'2022-06-06' as const,
  independentPublicV4CDXAnchorRun:38285676317 as const,
  priorPublicOriginalSha256:ANCHOR_ORIGINAL_SHA256,
  priorPublicOriginalCdxSha1:ANCHOR_ORIGINAL_CDX_SHA1,
  liveCdxIndexQueried:false as const,
  sourcePrefixSelectionNotFrozen:true as const,
  sampleSourceCap:500 as const,perSourceEvidenceCap:64 as const,
  storedCandidateEvidenceChanged:false as const,productionWrites:0 as const,
  firstPublicDateEstablished:false as const,
  originalReportPdfHistoricalPublicByProven:false as const,
  legalFilingDutyDenominatorEstablished:false as const,
  productionBindingVerified:false as const,
  privateKeysPeopleDonorsAmountsAndRawUrlsExported:false as const,
 };
 if(original.status!=='verified'){
  phase('original_hold_no_neon_contact');
  return {...base,result:'held_at_original',heldReason:original.status,
   freshFullOriginalSha1AndSha256Match:false,
   protectedReadOnlyConnectionEstablished:false,explicitRollbackComplete:false,
   parity:null};
 }
 phase('original_fingerprints_and_canonical_rows_verified');
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchNeon);
 phase('existing_neon_default_branch_confirmed');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:8000,
  query_timeout:40000,statement_timeout:35000,
  application_name:'votepredict-864-candidate-expenditure-anchored-parity-v6',
  options:'-c default_transaction_read_only=on -c statement_timeout=35000 -c lock_timeout=3000',
 });
 try{
  const client=(await pool.connect()) as Pick<PoolClient,'query'|'release'>;
  let active=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   active=true;
   const id=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(id.rows.length!==1||id.rows[0].db!==selected.database
    ||id.rows[0].role!==selected.role||id.rows[0].ro!=='on')
    throw Error('Read-only archive V6 DB identity mismatch');
   phase('protected_read_only_identity_verified');
   const family='campaign_finance_candidate_expenditure_bulk';
   const values=[
    source.original,ANCHOR_ORIGINAL_CDX_SHA1,'2022-06-06',
    [...original.rowKeys],family,
   ];
   const group=await client.query(FIXED_CFB_PARITY_V5_SQL,values);
   if(group.rows.length!==1
    ||Object.keys(group.rows[0]).length!==13)
    throw Error('Unexpected protected aggregate shape');
   const safe={
    sourceId:ANCHOR_ID,family,captureDay:'2022-06-06',
    publicOriginalSha256:ANCHOR_ORIGINAL_SHA256,
    publicParsedUniqueKeys:ANCHOR_DISTINCT_ROW_KEYS,
    ...group.rows[0],
   } as ParityGroup;
   validateParityGroups([safe]);
   phase('aggregate_sanitized');
   await client.query('ROLLBACK');active=false;
   phase('read_only_explicit_rollback_complete');
   return {...base,result:'authenticated_original_and_protected_parity',
    heldReason:null,freshFullOriginalSha1AndSha256Match:true,
    protectedReadOnlyConnectionEstablished:true,explicitRollbackComplete:true,
    parity:safe};
  }finally{
   if(active){try{await client.query('ROLLBACK')}catch{}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No arbitrary sources or SQL accepted');
 assertExpenditureV6Main(process.env);
 let phase='reviewed_main';
 try{
  const result=await auditAnchoredExpenditureV6({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,fetch,undefined,p=>{phase=p});
  const text=JSON.stringify(result);
  if(text.length>12000)throw Error('Oversized protected receipt');
  console.log('CFB_864_EXP_ANCHORED_V6_COUNTS_ONLY '+text);
 }catch{
  console.error('CFB_864_EXP_ANCHORED_V6_HELD_AT='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/')
 .endsWith('/audit-cfb-864-expenditure-anchored-v6.ts'))void main();
