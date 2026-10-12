/**
 * #864 — ONE-SHOT protected Neon exact original-PDF to persisted-row parity.
 * Reuse EXISTING GitHub Neon management key, no new project/branch/role.
 * Read only: fixed bounded SELECTs, REPEATABLE READ READ ONLY, ROLLBACK.
 * Original verified SHA-pinned 2022–25 public LRL artifacts are loaded before
 * credentials; comparison in memory only; emit SANITIZED numerical counts.
 */
import {Pool} from 'pg';
import {readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {
 compareOriginalSenateCommitteeToStored,
 type CommitteeStoredDoc,type CommitteeStoredEvent,type CommitteeStoredChoice,
} from '../src/evidence/senate-864-source-db-sanitized-compare.js';
import type {OriginalSenateCommitteeYearAudit} from
 '../src/evidence/senate-committee-source-to-db-reconciliation.js';

export const SOURCE_PARITY_ONESHOT_MARKER=
 'SENATE_864_SOURCE_TO_DB_PARITY_ONESHOT_20261011_V1' as const;
const SOURCES=[
 {year:2022,artifact:11674729430,count:325,parsed:204,unparsed:121,
  sha:'23be57a94c4c9dcb3641dca450b335c81fca9fbd25867d94658d77937b847372'},
 {year:2023,artifact:11674568363,count:454,parsed:432,unparsed:22,
  sha:'ee719ddc1b6ce7aad631d6d4d9ca635c49e607bb69cf5cdbd17c4725d4698974'},
 {year:2024,artifact:11675315164,count:258,parsed:245,unparsed:13,
  sha:'c461c82a8f3be64b863783b1c4d02bc2b055f37fc0ecb39ec542ee5560ec4085'},
 {year:2025,artifact:11675014092,count:415,parsed:364,unparsed:51,
  sha:'e611f2b7a7225d7c62e8bbae960db60c50793ffca7cb3928e62d578a809c5dea'},
] as const;
export const ORIGINAL_ARTIFACT_SOURCE_RUN=38066441841 as const;
export const DOC_SQL=[
 'SELECT sd.id::text AS id, sd.source_url,sd.content_sha256 AS source_sha,',
 "sd.metadata->>'meetingDate' AS meeting_date,",
 "sd.metadata->>'committeeName' AS committee_name",
 'FROM source_documents sd',
 "WHERE sd.source_kind='senate_committee_minutes'",
 'ORDER BY sd.id LIMIT 2201',
].join(' ');
export const EVENT_SQL=[
 'SELECT ve.id::text AS id,ve.source_document_id::text AS source_document_id,',
 've.external_key,ve.occurred_on::text AS occurred_on,',
 've.yea_count,ve.nay_count FROM vote_events ve',
 "WHERE ve.metadata->>'committeeVote'='true'",
 "AND ve.occurred_on>=DATE '2022-01-01'",
 "AND ve.occurred_on<DATE '2026-01-01'",
 'ORDER BY ve.id LIMIT 601',
].join(' ');
export const CHOICE_SQL=[
 'SELECT mv.vote_event_id::text AS vote_event_id,mv.normalized_member_name,',
 'mv.choice,mv.membership_id::text AS membership_id',
 'FROM member_votes mv JOIN vote_events ve ON ve.id=mv.vote_event_id',
 "WHERE ve.metadata->>'committeeVote'='true'",
 "AND ve.occurred_on>=DATE '2022-01-01'",
 "AND ve.occurred_on<DATE '2026-01-01'",
 'ORDER BY mv.vote_event_id,mv.normalized_member_name,mv.choice LIMIT 4001',
].join(' ');
export const COMMITTEE_PARITY_QUERIES=[DOC_SQL,EVENT_SQL,CHOICE_SQL] as const;

export function verifyPinnedOfficialSourceManifests(
 read:(path:string)=>Buffer=path=>readFileSync(path),
):OriginalSenateCommitteeYearAudit[]{
 const result:OriginalSenateCommitteeYearAudit[]=[];
 for(const s of SOURCES){
  const path='artifacts/senate-committee-'+s.year+'-original-pdf-actions.json';
  const bytes=read(path);
  if(bytes.byteLength>22_000_000
    ||createHash('sha256').update(bytes).digest('hex')!==s.sha)
   throw Error('Pinned government source artifact SHA/bound failed');
  const proof=JSON.parse(bytes.toString('utf8')) as OriginalSenateCommitteeYearAudit&{
   schemaVersion?:string;scopeAndSafety?:Record<string,unknown>;
  };
  if(proof.auditedYear!==s.year
    ||proof.schemaVersion!=='senate-committee-original-2022-25-pdf-actions-v1'
    ||proof.independentlyDiscoveredOriginalMinutesPdfLinks!==s.count
    ||proof.originalPdfsFetchedAndParsed!==s.parsed
    ||proof.originalPdfsFailedOrUnparsed!==s.unparsed
    ||!Array.isArray(proof.documentProofs)
    ||!Array.isArray(proof.unresolvedOriginalDocuments)
    ||proof.documentProofs.length!==s.parsed
    ||proof.unresolvedOriginalDocuments.length!==s.unparsed
    ||proof.scopeAndSafety?.pdfFilesOrFullExtractedTextStored!==false
    ||proof.scopeAndSafety?.noProductionDatabaseAccess!==true
    ||proof.scopeAndSafety?.noOfficialFullMeetingOrVoteDenominatorCertified!==true)
   throw Error('Official original PDF metadata source validation failed');
  result.push(proof);
 }
 // Pre-secret source parser compatibility gate: independently audit all pinned
 // original URL/year/choice-token structures against the exact comparator.
 // An empty synthetic stored cohort is deliberately NOT a DB observation;
 // only the source totals/validation are consumed from this preflight.
 const dry=compareOriginalSenateCommitteeToStored(result,{
  documents:[],events:[],choices:[],
 });
 if(dry.sourceOriginalPdfUrlReferences!==1452
   ||dry.originalPdfsWithIndependentRawPdfSha!==1245
   ||dry.originalPdfsWithoutIndependentRawPdfSha!==207
   ||dry.sourceExactUrlOneToOne!==0)
  throw Error('Pinned source manifests fail strict pre-secret comparator validation');
 return result;
}
function checkRows<T>(rows:unknown,limit:number):T[]{
 if(!Array.isArray(rows)||rows.length>=limit)throw Error('Bounded protected SQL query was truncated');
 return rows as T[];
}
export async function protectedCommitteeSourceParity(
 sourceReports:readonly OriginalSenateCommitteeYearAudit[],
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchApi:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(opts:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  opts=>new Pool(opts),
 onPhase:(phase:string)=>void=()=>{},
){
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchApi);
 onPhase('existing_project_and_branch_verified');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:16000,statement_timeout:15000,
  application_name:'votepredict-864-original-senate-source-parity-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000',
 });
 try{
  const client=await pool.connect();let begun=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   begun=true;
   const ident=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(ident.rows.length!==1||ident.rows[0].db!==selected.database
     ||ident.rows[0].role!==selected.role||ident.rows[0].ro!=='on')
    throw Error('Transaction or project identity not proven read only');
   onPhase('transaction_readonly_verified');
   const docs=checkRows<CommitteeStoredDoc>(
    (await client.query(DOC_SQL)).rows,2201);
   onPhase('bounded_original_source_documents_queried');
   const events=checkRows<CommitteeStoredEvent>(
    (await client.query(EVENT_SQL)).rows,601);
   onPhase('bounded_committee_vote_events_queried');
   const choices=checkRows<CommitteeStoredChoice>(
    (await client.query(CHOICE_SQL)).rows,4001);
   onPhase('bounded_named_member_choices_queried');
   const counts=compareOriginalSenateCommitteeToStored(sourceReports,{
    documents:docs,events,choices,
   });
   // Explicit ROLLBACK before emitting even the sanitized result.
   await client.query('ROLLBACK');begun=false;
   onPhase('rolled_back');
   return{
    ...counts,
    status:'verified_default_neon_branch_original_to_stored_source_audit',
    pinnedOfficialOriginalSourceRun:ORIGINAL_ARTIFACT_SOURCE_RUN,
    pinnedOriginalMetadataArtifacts:SOURCES.map(x=>x.artifact),
    authenticatedNeonDefaultBranch:true,
    deployedProductionBindingIndependentlyVerified:false,
    protectedTransactionReadOnly:true,transactionRollbackCompleted:true,
    noDatabaseMutations:true,noPrivateRawRowExports:true,
   };
  }finally{
   if(begun)try{await client.query('ROLLBACK')}catch{/* fail closed */}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 const mode=process.argv[2];
 if(process.argv.length!==3||!['--source-preflight','--protected'].includes(mode))
  throw Error('Fixed source-preflight or protected mode only');
 let phase='source_preflight';
 try{
  const proofs=verifyPinnedOfficialSourceManifests();
  if(mode==='--source-preflight'){
   console.log('VOTEPREDICT_864_PINNED_FOUR_OFFICIAL_SOURCE_ARTIFACTS_VERIFIED=4');
   return;
  }
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_SOURCE_PARITY_MARKER_PRESENT!=='true')
   throw Error('Independent reviewed source parity marker absent');
  phase='protected_neon_query';
  const counts=await protectedCommitteeSourceParity(proofs,{
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,opts=>new Pool(opts),p=>{phase=p});
  const body=JSON.stringify(counts);
  // The report must remain exclusively fixed booleans/counts and known enums.
  if(body.length>22000 || /https?:\/\/|postgresql:|neondb_owner|normalized_member_name|source_url/i.test(body))
   throw Error('Unsafe protected parity aggregate output');
  if(process.env.GITHUB_OUTPUT){
   appendFileSync(process.env.GITHUB_OUTPUT,
    'public_parity_b64='+Buffer.from(body,'utf8').toString('base64')+'\n');
  }
  console.log('VOTEPREDICT_864_SANITIZED_ORIGINAL_DB_PARITY='+body);
 }catch{
  console.error('VOTEPREDICT_864_ORIGINAL_DB_PARITY_FAILED_CLOSED phase='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-protected-source-db-parity.ts'))
 void main();
