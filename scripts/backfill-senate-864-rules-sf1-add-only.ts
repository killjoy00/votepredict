/**
 * Explicitly authorized #864 original SF1 two-vote add-only protected deploy.
 * Source: Minnesota LRL official 2023-01-24 Rules Minutes SHA-bound, Senate
 * Resolution 7 officer titles, 2023 hearing-day Senate memberships.
 *
 * Exactly two NEW motion vote_events and their 20 explicitly printed member
 * sides, or zero changes on ANY failed invariant. Old importer remains
 * forbidden: no positional keys, UPDATE, UPSERT, DELETE or model writes.
 * Two-stage read-only preflight and independent postcommit read-only parity.
 */
import {createHash} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.js';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {senateCommitteeHearingTiming} from '../src/evidence/senate-committee-meeting-timing.js';
import {runProtectedRulesSF1Parity,DOC_SQL,EVENT_SQL,CHOICE_SQL,
 ROSTER_SQL,ALIAS_SQL,assertSafeRulesSF1AggregateReceipt} from
 './audit-senate-864-rules-sf1-protected-neon-readonly.js';
import {validateOriginalRulesSF1,
 type RulesStoredEvent,type RulesSourceDoc,type RulesStoredChoice} from
 '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
import {prepareOfficialSF1Motions,assertEligibleSF1AdditionReport,
 assertPostwriteSF1Parity,planApprovedTwoSF1OriginalKeys,
 SF1_SOURCE,SF1_DAY,SF1_COMMITTEE,SF1_PDF_SHA,SF1_TEXT_SHA,SF1_BYTES} from
 '../src/evidence/senate-864-rules-sf1-add-only.js';
import type {MembershipCandidate} from '../src/sources/minnesota/member-reconciliation.js';

export const SF1_WRITE_ONESHOT_MARKER=
 'SENATE_864_2023_RULES_SF1_GUARDED_ADD_ONLY_20261015_V1';
export const SF1_BILL_SQL=[
 'SELECT s.id::text AS session_id,c.id::text AS chamber_id,b.id::text AS bill_id',
 'FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id',
 "JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug='senate'",
 "JOIN bills b ON b.session_id=s.id AND upper(b.identifier)='SF1'",
 "WHERE j.slug='us-mn' AND s.slug='2023-2024' LIMIT 3",
].join(' ');
export const SF1_DATE_EVENT_SQL=[
 'SELECT ve.id::text FROM vote_events ve JOIN chambers c ON c.id=ve.chamber_id',
 'LEFT JOIN bills b ON b.id=ve.bill_id',
 "WHERE c.slug='senate' AND ve.occurred_on=$1::date",
 'AND (ve.source_document_id=$2::uuid OR',
 "(b.identifier IS NOT NULL AND upper(b.identifier)='SF1'))",
 'LIMIT 3',
].join(' ');
export const SF1_ANY_SOURCE_EVENT_SQL=
 'SELECT id::text FROM vote_events WHERE source_document_id=$1::uuid LIMIT 3';
export const SF1_ANY_STABLE_EVENT_SQL=
 'SELECT id::text FROM vote_events WHERE session_id=$1::uuid AND chamber_id=$2::uuid AND external_key=ANY($3::text[]) LIMIT 3';
export const SF1_LINK_SQL=
 'SELECT session_id::text AS session_id,chamber_id::text AS chamber_id FROM source_documents WHERE id=$1::uuid LIMIT 2';
export const SF1_INSERT_EVENT_SQL=`
 INSERT INTO vote_events(
  session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,
  motion_text,amendment_ref,occurred_on,yea_count,nay_count,other_count,
  passed,is_passage,metadata
 ) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::date,
          $10,$11,0,$12,false,$13::jsonb)
 RETURNING id::text AS id`;
export const SF1_INSERT_MEMBER_SQL=`
 INSERT INTO member_votes(
  vote_event_id,membership_id,source_member_name,normalized_member_name,
  choice,source_ordinal,metadata
 ) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb)
 RETURNING id::text AS id`;
export const SF1_VERIFY_EVENT_SQL=`
 SELECT id::text,external_key,vote_kind,yea_count,nay_count,passed,
  source_document_id::text AS source_document_id,is_passage,occurred_on::text AS occurred_on
 FROM vote_events WHERE id=ANY($1::uuid[]) ORDER BY external_key`;
export const SF1_VERIFY_MEMBER_SQL=`
 SELECT vote_event_id::text AS vote_event_id,membership_id::text AS membership_id,
  source_member_name,normalized_member_name,choice,source_ordinal
 FROM member_votes WHERE vote_event_id=ANY($1::uuid[])
 ORDER BY vote_event_id,source_ordinal`;
const SHA=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const bounded=<T>(rows:T[],cap:number,phase:string)=> {
 if(rows.length>=cap)throw Error('Bounded SF1 '+phase+' snapshot exceeds cap');
 return rows;
};
export function assertProtectedSF1WriteEnv(e:Record<string,string|undefined>){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||
  e.VOTEPREDICT_864_SF1_WRITE_MODE!=='PROVEN_TWO_MOTIONS_ADD_ONLY'||
  e.VOTEPREDICT_864_SF1_MAIN_CI_VERIFIED!=='true'||
  e.VOTEPREDICT_864_SF1_WRITE_MARKER_PRESENT!=='true'||
  !e.NEON_API_KEY||!e.VOTEPREDICT_NEON_PROJECT_ID)
  throw Error('Source-approved protected SF1 two-motion add-only gate HOLD');
 return true;
}
async function sourceOriginal(){
 const response=await fetch(SF1_SOURCE,{redirect:'manual',
  signal:AbortSignal.timeout(45000),headers:{accept:'application/pdf'}});
 if(response.status!==200||!response.body||
  Number(response.headers.get('content-length')??0)>1000000)
  throw Error('Official original transport HOLD');
 const chunks:Uint8Array[]=[];let length=0;
 const rd=response.body.getReader();
 try{for(;;){const n=await rd.read();if(n.done)break;
  length+=n.value.length;if(length>1000000)throw Error('Original byte bound HOLD');
  chunks.push(n.value);
 }}finally{rd.releaseLock();}
 const original=new Uint8Array(length);let at=0;
 for(const b of chunks){original.set(b,at);at+=b.length;}
 if(length!==SF1_BYTES||SHA(original)!==SF1_PDF_SHA||
  new TextDecoder('latin1').decode(original.subarray(0,5))!=='%PDF-')
  throw Error('Official original PDF raw SHA HOLD');
 const parsed=await fetchSenateCommitteeMinutePdf({url:SF1_SOURCE,
  fetchImpl:(async()=>new Response(original,{status:200,
   headers:{'content-type':'application/pdf'}})) as typeof fetch});
 if(parsed.contentSha256!==SF1_PDF_SHA||SHA(parsed.text)!==SF1_TEXT_SHA)
  throw Error('Official original PDF text SHA HOLD');
 const source={verifiedRawPdfSha:true,verifiedSourceTextSha:true,
  rolls:parseSenateCommitteeMinuteVotes(parsed.text)};
 if(!validateOriginalRulesSF1(source))
  throw Error('Source no longer has exactly two recorded named SF1 motions');
 return {source,originalText:parsed.text};
}
const aliasJoin=(roster:readonly {membership_id:string;source_name:string}[])=>{
 const map=new Map<string,string[]>();
 for(const x of roster)map.set(x.membership_id,
  [...(map.get(x.membership_id)??[]),x.source_name]);
 return map;
};
export async function applyTwoOriginalSF1Motions(input:{
 apiKey:string;projectId:string;database?:string;
},phase:(name:string)=>void=()=>{}){
 phase('proven_historical_original_readonly_parity');
 const initial=await runProtectedRulesSF1Parity(input);
 if(initial.alreadyStoredExactly===2){
  assertPostwriteSF1Parity(initial);
  return {schemaVersion:'senate-864-sf1-two-original-votes-backfill-v1',
   finalStatus:'already_present_verified',insertedVoteEvents:0,
   insertedNamedChoices:0,exactSourceVotesVerified:2,exactNamedChoicesVerified:20,
   originalShaAuthenticated:true,allTransactionsScoped:true,
   originalPositionalEventsUntouched:true,modelOrForecastWrites:false};
 }
 assertEligibleSF1AdditionReport(initial);
 phase('second_independent_official_original_sha_auth');
 const {source,originalText}=await sourceOriginal();
 phase('verified_existing_votepredict_neon_default_primary');
 const selected=await discoverExistingVotePredictNeonConnection({
  apiKey:input.apiKey,projectId:input.projectId,preferredDatabase:input.database,
  requirePrimary:true
 });
 if(selected.projectId!==input.projectId)
  throw Error('Protected write database project scope mismatch');
 const pool=new Pool({host:selected.host,port:selected.port,user:selected.role,
  password:selected.password,database:selected.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:8000,statement_timeout:18000,
  query_timeout:18000,application_name:'senate-864-sf1-two-original-add-only',
  options:'-c statement_timeout=18000 -c lock_timeout=2500'});
 let client:PoolClient|null=null,inTxn=false,committed=false;
 try{
  client=await pool.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  inTxn=true;
  await client.query("SET LOCAL statement_timeout = '18000ms'");
  await client.query("SET LOCAL lock_timeout = '2500ms'");
  // NOWAIT fails closed if a parallel ingestion is changing vote_events.
  // Protect the entire absence-to-insert window without prolonged blocking.
  await client.query('LOCK TABLE vote_events IN SHARE ROW EXCLUSIVE MODE NOWAIT');
  await client.query('SELECT pg_advisory_xact_lock(864,20230124)');
  const ident=await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(ident.rows.length!==1||ident.rows[0].db!==selected.database||
   ident.rows[0].role!==selected.role||ident.rows[0].ro!=='off')
   throw Error('Protected write transaction database identity HOLD');
  phase('serializable_neon_lock_and_database_identity_checked');
  const docs=bounded<RulesSourceDoc>(
   (await client.query(DOC_SQL,[SF1_SOURCE,SF1_PDF_SHA,SF1_DAY])).rows,101,'documents');
  const events=bounded<RulesStoredEvent>(
   (await client.query(EVENT_SQL,[SF1_DAY,SF1_SOURCE,SF1_PDF_SHA])).rows,301,'events');
  const choices=bounded<RulesStoredChoice>(
   (await client.query(CHOICE_SQL,[SF1_DAY,SF1_SOURCE,SF1_PDF_SHA])).rows,3001,'choices');
  const sourceDocs=docs.filter(d=>d.source_url===SF1_SOURCE&&
   d.content_sha256===SF1_PDF_SHA&&d.meeting_date===SF1_DAY&&
   /rules(?:\s+and\s+administration)?/i.test(d.committee_name??''));
  if(sourceDocs.length!==1||
   docs.filter(d=>d.content_sha256===SF1_PDF_SHA||
    d.source_url===SF1_SOURCE).length!==1||
   events.some(e=>e.source_document_id===sourceDocs[0]!.id||
    (e.occurred_on===SF1_DAY&&e.committee_vote&&
     /rules/i.test(e.committee_name??'')&&
     e.bill_identifier?.replace(/[ .]/g,'').toUpperCase()==='SF1'))||
   choices.some(c=>events.some(e=>e.id===c.vote_event_id&&
    e.source_document_id===sourceDocs[0]!.id)))
   throw Error('Existing SF1 record/source modified after readonly snapshot');
  const docId=sourceDocs[0]!.id;
  if((await client.query(SF1_ANY_SOURCE_EVENT_SQL,[docId])).rows.length>0||
   (await client.query(SF1_DATE_EVENT_SQL,[SF1_DAY,docId])).rows.length>0)
   throw Error('Competing source or Senate SF1 same-day event HOLD');
  const roster=bounded<Array<{membership_id:string;legislator_id:string;
   name:string;normalized_name:string;starts_on:string|null;ends_on:string|null}>[number]>(
    (await client.query(ROSTER_SQL)).rows,151,'roster');
  const aliases=bounded<{membership_id:string;source_name:string}>(
    (await client.query(ALIAS_SQL)).rows,801,'aliases');
  const aliasMap=aliasJoin(aliases);
  const historicalRoster:MembershipCandidate[]=roster.map(r=>({
   membershipId:r.membership_id,legislatorId:r.legislator_id,
   name:r.name,normalizedName:r.normalized_name,
   startsOn:r.starts_on,endsOn:r.ends_on,
   aliases:aliasMap.get(r.membership_id)??[]
  }));
  const prepared=prepareOfficialSF1Motions({source,originalText,historicalRoster});
  const stableKeys=planApprovedTwoSF1OriginalKeys(
   prepared.map(x=>x.original),initial);
  const bill=bounded<{session_id:string;chamber_id:string;bill_id:string}>(
   (await client.query(SF1_BILL_SQL)).rows,3,'exact session/chamber/bill');
  if(bill.length!==1)
   throw Error('Unique historical Senate 2023 SF1 bill missing');
  const link=bounded<{session_id:string|null;chamber_id:string|null}>(
   (await client.query(SF1_LINK_SQL,[docId])).rows,2,'source identity');
  if(link.length!==1||
   (link[0]!.session_id&&link[0]!.session_id!==bill[0]!.session_id)||
   (link[0]!.chamber_id&&link[0]!.chamber_id!==bill[0]!.chamber_id))
   throw Error('Stored original document linked to different historic session');
  if((await client.query(SF1_ANY_STABLE_EVENT_SQL,[
   bill[0]!.session_id,bill[0]!.chamber_id,stableKeys])).rows.length>0)
   throw Error('Original-action key already persisted; refusing replay');
  phase('ten_ten_verified_and_source_absence_rechecked_inside_locked_transaction');
  const timing=senateCommitteeHearingTiming(SF1_DAY).metadata;
  const newIds:string[]=[];
  for(const [i,part] of prepared.entries()){
   const r=source.rolls[i]!;
   const meta={
    source:'Minnesota Legislative Reference Library committee minutes',
    committeeName:SF1_COMMITTEE,committeeVote:true,individualVotesAvailable:true,
    originalSourceSha256:SF1_PDF_SHA,originalNormalizedTextSha256:SF1_TEXT_SHA,
    originalMotionContextSha256:part!.original.originalMotionContextSha256,
    originalTextOffset:part!.original.originalTextOffset,
    originalSenateResolution7OfficeRolesValidated:true,
    originalNamedVotesOnly:true,originalActionStableKeyVersion:'original-v1',
    finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,
    ...timing
   };
   const insert=await client.query<{id:string}>(SF1_INSERT_EVENT_SQL,[
    bill[0]!.session_id,bill[0]!.chamber_id,bill[0]!.bill_id,
    docId,stableKeys[i],r.voteKind,r.motionText,r.amendmentRef??null,SF1_DAY,
    r.yeaCount,r.nayCount,r.passed,JSON.stringify(meta)
   ]);
   if(insert.rowCount!==1||insert.rows.length!==1)
    throw Error('Missing unique add-only motion insert');
   newIds.push(insert.rows[0]!.id);
   for(const [ordinal,v] of part!.printedChoices.entries()){
    const member=await client.query<{id:string}>(SF1_INSERT_MEMBER_SQL,[
     insert.rows[0]!.id,v.membershipId,v.sourceName,v.normalizedName,
     v.choice,ordinal,JSON.stringify({
      committeeVote:true,originalPrintedNamedSide:true,
      hearingDate:Sf1HearingDate(),normalizedByOfficialSenateResolution7:true,
      finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0
     })
    ]);
    if(member.rowCount!==1||member.rows.length!==1)
     throw Error('Missing individual original-member side insert');
   }
  }
  // Read back all 22 new rows in the SAME transaction before commit.
  const inserted=await client.query<{id:string;external_key:string;
   vote_kind:string;yea_count:number;nay_count:number;passed:boolean;
   source_document_id:string;is_passage:boolean;occurred_on:string}>(
    SF1_VERIFY_EVENT_SQL,[newIds]);
  const sides=await client.query<{vote_event_id:string;membership_id:string;
   source_member_name:string;normalized_member_name:string;choice:string;
   source_ordinal:number}>(SF1_VERIFY_MEMBER_SQL,[newIds]);
  if(inserted.rows.length!==2||sides.rows.length!==20)
   throw Error('Transactional readback missing a source vote or member choice');
  for(const [i,part] of prepared.entries()){
   const id=newIds[i]!,event=inserted.rows.find(x=>x.id===id)!;
   const expected=source.rolls[i]!;
   if(!event||event.external_key!==stableKeys[i]||
    event.vote_kind!==expected.voteKind||
    event.yea_count!==expected.yeaCount||event.nay_count!==expected.nayCount||
    event.passed!==expected.passed||event.source_document_id!==docId||
    event.occurred_on!==SF1_DAY||event.is_passage!==false)
    throw Error('Inserted SF1 motion readback does not match exact original');
   const actual=sides.rows.filter(x=>x.vote_event_id===id);
   if(actual.length!==10||actual.some((x,j)=>{
    const row=part!.printedChoices.find(y=>y.normalizedName===x.normalized_member_name);
    return !row||row.membershipId!==x.membership_id||
     row.sourceName!==x.source_member_name||row.choice!==x.choice||
     x.source_ordinal!==part!.printedChoices.indexOf(row);
   }))
    throw Error('Inserted SF1 member readback differs from original sides');
  }
  phase('two_original_motions_and_twenty_explicit_sides_readback_exact');
  await client.query('COMMIT');inTxn=false;committed=true;
  phase('atomic_two_motion_add_only_committed');
 }finally{
  if(inTxn&&client)try{await client.query('ROLLBACK')}catch{/*fail-closed*/}
  if(client)client.release(true);
  await pool.end();
 }
 if(!committed)throw Error('SF1 original votes not committed');
 phase('independent_post_commit_source_to_stored_readonly_parity');
 const verified=await runProtectedRulesSF1Parity(input);
 assertPostwriteSF1Parity(verified);
 return {schemaVersion:'senate-864-sf1-two-original-votes-backfill-v1',
  finalStatus:'committed_and_readonly_verified',insertedVoteEvents:2,
  insertedNamedChoices:20,exactSourceVotesVerified:2,exactNamedChoicesVerified:20,
  originalShaAuthenticated:true,allTransactionsScoped:true,
  originalPositionalEventsUntouched:true,modelOrForecastWrites:false};
}
const Sf1HearingDate=()=>SF1_DAY;
async function main(){
 if(process.argv.length!==3||!['--preflight','--apply'].includes(process.argv[2]!))
  throw Error('Supported modes: --preflight, --apply only');
 let phase='source_only_sql_and_scope_preflight';
 try{
  if(!SF1_BILL_SQL.startsWith('SELECT ')||
   !SF1_DATE_EVENT_SQL.startsWith('SELECT ')||
   !SF1_ANY_SOURCE_EVENT_SQL.startsWith('SELECT ')||
   !SF1_ANY_STABLE_EVENT_SQL.startsWith('SELECT ')||
   !SF1_LINK_SQL.startsWith('SELECT ')||
   !/^\s*INSERT INTO vote_events\(/.test(SF1_INSERT_EVENT_SQL)||
   !/^\s*INSERT INTO member_votes\(/.test(SF1_INSERT_MEMBER_SQL)||
   [SF1_INSERT_EVENT_SQL,SF1_INSERT_MEMBER_SQL].some(s=>
    /\b(?:UPDATE|DELETE|TRUNCATE|MERGE|ON\s+CONFLICT)\b/i.test(s)))
   throw Error('Source-only SQL shape failed');
  if(process.argv[2]==='--preflight'){
   console.log('SENATE864_SF1_TWO_ADD_ONLY_SQL_STATIC_PREFLIGHT_VERIFIED');
   return;
  }
  assertProtectedSF1WriteEnv(process.env);
  phase='privately_authenticated_primary_add_only';
  const output=await applyTwoOriginalSF1Motions({
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   database:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined
  },p=>{phase=p});
  const receipt=JSON.stringify(output);
  assertSafeRulesSF1AggregateReceipt(receipt);
  console.log('SENATE864_SF1_GUARDED_ADD_ONLY='+receipt);
 }catch{
  console.error('SENATE864_SF1_ADD_ONLY_HOLD='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/backfill-senate-864-rules-sf1-add-only.ts'))
 void main();
