/**
 * #864 V9: strictly protected ephemeral source-person identity diagnostic.
 * Exact 21 pinned official-source artifacts + one original mismatched 2024 PDF;
 * 3 existing SELECTs and one parameterized 30-row membership probe; explicit
 * ROLLBACK BEFORE any output. No private names, URLs, choice hashes, IDs,
 * original PDF text or membership rows ever leave process memory.
 * NOTE: does NOT infer ingestion root cause merely from a missing choice.
 */
import {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {readFileSync,appendFileSync} from 'node:fs';
import {sourceShaPinnedMerged} from './audit-senate-864-2025-judiciary-full-source-neon-v5.js';
import {DOC_SQL,EVENT_SQL,CHOICE_SQL} from './audit-senate-864-protected-source-db-parity.js';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {compareOriginalSenateCommitteeToStored,type CommitteeStoredDoc,
 type CommitteeStoredEvent,type CommitteeStoredChoice} from
 '../src/evidence/senate-864-source-db-sanitized-compare.js';
import {fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {serializeApprovedYeaV9SafeScalars} from
 '../src/evidence/senate-864-2024-yea-v9-safe-scalars.js';

export const ONE_YEA_2024_V9_MARKER=
 'SENATE_864_2024_MISSING_YEA_EXACT_SAFE_OUTPUT_20261012_V9' as const;
const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const MAX_BYTES=12_000_000;
export const MEMBERSHIP_SQL=[
 'SELECT m.id::text AS membership_id, l.normalized_name AS person_name,',
 'm.starts_on::text AS starts_on,m.ends_on::text AS ends_on,',
 'a.normalized_name AS alias_name',
 'FROM legislators l JOIN memberships m ON m.legislator_id=l.id',
 'LEFT JOIN membership_source_aliases a ON a.membership_id=m.id',
 "WHERE (lower(l.normalized_name)=lower($1) OR lower(a.normalized_name)=lower($1))",
 'ORDER BY m.id,a.normalized_name LIMIT 31',
].join(' ');

type OriginalVote={externalKey:string;yeaCount:number;nayCount:number;
 individualVotesAvailable:boolean;namedMemberChoicesInPdf:number;
 choiceIdentitySha256:string[]};
type SourcePdf={document:{year:number;meetingDate:string;committeeName:string;
 sourceUrl:string;originalRawPdfSha256:string;extractedTextSha256?:string};
 voteObservations:OriginalVote[]};
type Choice=CommitteeStoredChoice;
type SourceReport=ReturnType<typeof sourceShaPinnedMerged>;
export type MissingOriginal={
 source:SourcePdf;event:CommitteeStoredEvent;missingChoiceSha:string;
 originalCount:number;storedCount:number;intersection:number;
};
function exactly<T>(rows:T[],limit:number):T[]{
 if(!Array.isArray(rows)||rows.length>=limit)throw Error('Protected SELECT truncated');
 return rows;
}
/** Matches an existing stored event by immutable original key + source hash;
 * never searches by name alone and never yields its name in a public report.
 */
export function findUniqueMissing2024Choice(
 source:SourceReport['years'],
 rows:{documents:CommitteeStoredDoc[];events:CommitteeStoredEvent[];choices:Choice[]},
):MissingOriginal{
 const counts=compareOriginalSenateCommitteeToStored(source,rows);
 const d=counts.originalVsPersistedNamedChoiceDigestDiscrepancy;
 if(counts.sourceOriginalPdfUrlReferences!==1452||
  counts.originalPdfsWithIndependentRawPdfSha!==1452||
  counts.sourceExactUrlOneToOne!==1452||counts.sourceParsedRawPdfShaMatches!==1452||
  counts.persistedCommitteeVoteEvents!==153||counts.persistedCommitteeMemberVoteRows!==988||
  counts.sourceCandidateRollCallEvents!==153||counts.sourceCandidateNamedChoiceTokens!==989||
  d.sourceRollEventsWithNamedChoiceMismatch!==1||
  d.oneOriginalTokenYeaDeficit!==1||d.oneOriginalTokenNayDeficit!==0||
  d.originalNamedTokensInThoseRolls!==10||
  d.persistedNamedTokensInThoseRolls!==9||
  d.exactChoiceDigestIntersectionTokensInThoseRolls!==9||
  d.originalNamedChoiceTokensAbsentFromPersistedDigestSet!==1||
  d.storedNamedChoiceTokensNotInOriginalDigestSet!==0)
  throw Error('Historical V6 immutable single-original-YEA source cohort changed');
 const candidates:MissingOriginal[]=[];
 for(const y of source.filter(x=>x.auditedYear===2024))
  for(const doc of y.documentProofs as SourcePdf[]){
   const drows=rows.documents.filter(x=>x.source_url===doc.document.sourceUrl);
   if(drows.length!==1||drows[0]!.source_sha!==doc.document.originalRawPdfSha256)
    throw Error('Pinned original PDF storage identity changed');
   for(const v of doc.voteObservations){
    if(!v.individualVotesAvailable)continue;
    const events=rows.events.filter(x=>x.source_document_id===drows[0]!.id
      &&x.external_key===v.externalKey);
    if(events.length!==1)throw Error('Original event external key is not one-to-one');
    const event=events[0]!;
    const crows=rows.choices.filter(x=>x.vote_event_id===event.id);
    const digests=crows.map(x=>sha(x.choice+':'+x.normalized_member_name)).sort();
    const original=[...v.choiceIdentitySha256].sort();
    const overlap=original.filter(x=>digests.includes(x));
    if(overlap.length!==original.length ||original.length!==digests.length){
     if(original.length!==10||digests.length!==9||overlap.length!==9||
       v.yeaCount+v.nayCount!==10||
       new Set(original).size!==10||new Set(digests).size!==9)
      throw Error('More than expected 2024 source/stored named-choice difference');
     const missing=original.filter(x=>!digests.includes(x));
     if(missing.length!==1)throw Error('Missing 2024 original choice fingerprint not unique');
     candidates.push({source:doc,event,missingChoiceSha:missing[0]!,
      originalCount:10,storedCount:9,intersection:9});
    }
   }
  }
 if(candidates.length!==1)throw Error('Exactly one discrepant 2024 roll must be found');
 return candidates[0]!;
}
/** No access to SQL data; verify a source person's YEA choice ONLY within
 * an independently raw-PDF-hash authenticated original named vote slate.
 */
export function recognizeMissing2024YeaNameInMemory(
 missingSha:string,rawText:string,source:SourcePdf,
){
 if(!/^[0-9a-f]{64}$/.test(missingSha)||rawText.length<40||rawText.length>1_000_000)
  throw Error('Missing original YEA source proof bounds failed');
 const named=parseSenateCommitteeMinuteVotes(rawText)
  .filter(x=>x.individualVotesAvailable&&x.yeaCount+x.nayCount===10);
 const matches=named.filter(x=>x.memberVotes.length===10
  &&JSON.stringify(x.memberVotes.map(c=>sha(c.choice+':'+c.normalizedName)).sort())
    ===JSON.stringify([...source.voteObservations.filter(z=>
      z.individualVotesAvailable&&z.choiceIdentitySha256.includes(missingSha))[0]!
       .choiceIdentitySha256].sort()));
 if(matches.length<1)throw Error('Unmatched original current-parser member list');
 const names=new Set(matches.flatMap(v=>v.memberVotes.filter(c=>
  c.choice==='yea'&&sha('yea:'+c.normalizedName)===missingSha)
    .map(c=>c.normalizedName)));
 if(names.size!==1)throw Error('Missing original 2024 YEA person not uniquely source identified');
 return [...names][0]!;
}
async function exactOriginalPdf(source:SourcePdf){
 const url=source.document.sourceUrl;const u=new URL(url);
 if(u.protocol!=='https:'||!['lrl.mn.gov','www.lrl.mn.gov'].includes(u.hostname)||
   !/^\/archive\/minutes\/senate\/2024\//.test(u.pathname)||
   !/_Minutes\.pdf$/i.test(u.pathname)||u.search||u.hash)
  throw Error('Original 2024 source URL outside pinned LRL boundary');
 return fetchSenateCommitteeMinutePdf({url,
  fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
   const target=input instanceof Request?input.url:String(input);
   if(target!==url)throw Error('Source URL changed');
   return (async()=>{
    const response=await fetch(target,{...init,redirect:'manual'});
    if(response.status!==200||response.url!==url)
     throw Error('Original 2024 PDF transport unexpectedly changed');
    const length=response.headers.get('content-length');
    if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))
     throw Error('Original PDF size claims exceed cap');
    const reader=response.body?.getReader();if(!reader)throw Error('Original PDF stream absent');
    const data:Uint8Array[]=[];let size=0;
    try{for(;;){
     const part=await reader.read();if(part.done)break;
     size+=part.value.byteLength;
     if(size>MAX_BYTES)throw Error('Original PDF streaming byte cap');
     data.push(part.value);
    }}finally{reader.releaseLock()}
    const bytes=new Uint8Array(size);let offset=0;
    for(const part of data){bytes.set(part,offset);offset+=part.length}
    if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-'||
      sha(bytes)!==source.document.originalRawPdfSha256)
     throw Error('Original source raw PDF SHA mismatch');
    return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
   })();
  }) as typeof fetch,
 });
}
export const YEA_V9_SAFE_PHASES=[
 'original_source_sha_preflight','protected_authorization_gate',
 'neon_connection_discovery','readonly_connection',
 'readonly_transaction_identity','bounded_documents_select',
 'bounded_events_select','bounded_choices_select',
 'original_2024_mismatch_resolve','original_2024_pdf_rehydration',
 'original_2024_extracted_text_check','original_2024_source_person_match',
 'membership_alias_parameterized_select','explicit_rollback',
 'final_scalar_output_safety',
] as const;
export type SafeYeaV9Phase=typeof YEA_V9_SAFE_PHASES[number];
/** Only static stage codes may leave the protected process; exceptions can
 * contain original URLs, member IDs and data. Never pass through error text.
 */
export function safeYeaV9Phase(value:unknown):SafeYeaV9Phase{
 if(!YEA_V9_SAFE_PHASES.includes(value as SafeYeaV9Phase))
  throw Error('Unreviewed diagnostic phase');
 return value as SafeYeaV9Phase;
}

async function protectedCheck(original:SourceReport,
 onPhase:(phase:SafeYeaV9Phase)=>void=()=>{},
){
 onPhase('neon_connection_discovery');
 const selected=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY?.trim()??'',
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
 });
 onPhase('readonly_connection');
 const pool=new Pool({host:selected.host,port:selected.port,user:selected.role,
  password:selected.password,database:selected.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:8000,query_timeout:16000,
  statement_timeout:15000,application_name:'votepredict-864-2024-yea-v9-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000'});
 let rolledBack=false;
 try{
  const client=await pool.connect();let began=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   began=true;
   onPhase('readonly_transaction_identity');
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
   if(identity.rows.length!==1||identity.rows[0].db!==selected.database||
    identity.rows[0].role!==selected.role||identity.rows[0].ro!=='on')
    throw Error('Protected SELECT-only transaction identity unverified');
   onPhase('bounded_documents_select');
   const docs=exactly<CommitteeStoredDoc>((await client.query(DOC_SQL)).rows,2201);
   onPhase('bounded_events_select');
   const events=exactly<CommitteeStoredEvent>((await client.query(EVENT_SQL)).rows,601);
   onPhase('bounded_choices_select');
   const choices=exactly<CommitteeStoredChoice>((await client.query(CHOICE_SQL)).rows,4001);
   onPhase('original_2024_mismatch_resolve');
   const match=findUniqueMissing2024Choice(original.years,{documents:docs,events,choices});
   onPhase('original_2024_pdf_rehydration');
   const pdf=await exactOriginalPdf(match.source);
   onPhase('original_2024_extracted_text_check');
   if(match.source.document.extractedTextSha256&&
      sha(pdf.text)!==match.source.document.extractedTextSha256)
    throw Error('Original extracted text differs from independent source artifact');
   onPhase('original_2024_source_person_match');
   const missingPerson=recognizeMissing2024YeaNameInMemory(
    match.missingChoiceSha,pdf.text,match.source);
   onPhase('membership_alias_parameterized_select');
   const membershipRows=exactly<{membership_id:string;person_name:string;
    starts_on:string|null;ends_on:string|null;alias_name:string|null}>(
    (await client.query(MEMBERSHIP_SQL,[missingPerson])).rows,31);
   const membershipIds=new Set(membershipRows.map(x=>x.membership_id));
   const day=match.source.document.meetingDate;
   const activeMatches=new Set(membershipRows.filter(x=>
    x.starts_on!==null&&x.ends_on!==null&&x.starts_on<=day&&x.ends_on>=day)
      .map(x=>x.membership_id));
   onPhase('explicit_rollback');
   await client.query('ROLLBACK');began=false;rolledBack=true;
   return{
    schemaVersion:'senate-864-2024-single-yea-private-person-source-v9',
    issue:864,
    sourceOriginalPDFHashAuthenticated:true,
    originalMissingSourceYeaFingerprints:1,
    storedExactChoiceIntersection:9,
    originalNamedRollChoices:10,storedNamedRollChoices:9,
    uniqueSourceNameInProtectedMemory:true,
    directMembershipOrAliasCandidateCount:membershipIds.size,
    membershipsWithBothDateBoundsCoveringHearingDay:activeMatches.size,
    exactActualServiceDateIndependentlyProven:false,
    rootCauseProven:false,
    storedRowRepairAuthorized:false,
    protectedReadOnlyTransaction:true,explicitRollback:rolledBack,
    noMemberNameSourceURLRowIDOrFingerprintExported:true,
    existingDefaultBranchNotVerifiedDeployedProductionBinding:true,
    print2021Print2022And141NoPdfMeetingsUnresolved:true,
    officialCompleteCommitteeVoteUniverseNotCertified:true,
    issue864Open:true,
   };
  }finally{
   if(began)try{await client.query('ROLLBACK')}catch{/* fail closed */}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==3||!['--source-preflight','--protected'].includes(process.argv[2]))
  throw Error('Fixed source-preflight or protected-only mode required');
 let phase:SafeYeaV9Phase='original_source_sha_preflight';
 try{
  const original=sourceShaPinnedMerged();
  if(process.argv[2]==='--source-preflight'){
   console.log('SENATE_864_YEA_V9_21_ORIGINAL_SOURCE_METADATA_PROOFS=VERIFIED');return;
  }
  phase='protected_authorization_gate';
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_YEA_V9_MARKER_PRESENT!=='true')
   throw Error('First-attempt V9 marker not independently authorized');
  const safe=await protectedCheck(original,p=>{phase=safeYeaV9Phase(p)});
  phase='final_scalar_output_safety';
  // Strict exact field-and-value schema: the prior substring test matched
  // the *name* of an approved safety boolean (SourceURL), falsely holding V8.
  const data=serializeApprovedYeaV9SafeScalars(safe);
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
   'safe_yea_v9_b64='+Buffer.from(data).toString('base64')+'\n');
  console.log('SENATE_864_2024_YEA_V9_SCALAR='+data);
 }catch{
  console.error('SENATE_864_2024_YEA_V9_HOLD='+safeYeaV9Phase(phase));
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
   'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.endsWith('/audit-senate-864-2024-one-yea-exact-output-v9.ts'))
 void main();
