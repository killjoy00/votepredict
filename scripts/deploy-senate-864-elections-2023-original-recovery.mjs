/**
 * Protected #864: seven SHA-pinned 2023 Elections original Minutes -> exact
 * questions/persons -> bounded RR read-only parity -> serializable add-only
 * correction -> independent RR read-only verification. No legacy parser replay.
 */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.ts';
import {sourceQueue,verifyOriginals,recoveryPlan,eventMetadata,VERSION,MARKER,SPECS,HELD} from
 '../src/evidence/senate-864-elections-2023-original-recovery.mjs';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {COMMITTEE_YEAR_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';

const sha=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const MAX={docs:31,events:301,choices:1501,roster:151,aliases:801,bills:21,year:6};
const DOCS=[
 'SELECT id::text,source_url,content_sha256,session_id::text,chamber_id::text,',
 " metadata->>'meetingDate' AS meeting_date,metadata->>'committeeName' AS committee_name",
 ' FROM source_documents WHERE source_url=ANY($1::text[]) OR content_sha256=ANY($2::text[])',
 ' ORDER BY id LIMIT 31'
].join('');
const EVENTS=[
 'SELECT v.id::text,v.source_document_id::text,v.session_id::text,v.chamber_id::text,',
 ' v.bill_id::text,v.external_key,b.identifier AS bill_identifier,',
 ' v.motion_text,v.vote_kind,v.amendment_ref,v.occurred_on::text,v.yea_count,v.nay_count,',
 ' v.passed,v.is_passage,v.metadata FROM vote_events v LEFT JOIN bills b ON b.id=v.bill_id',
 ' WHERE v.occurred_on=ANY($3::date[]) AND',
 ' (v.source_document_id IN (SELECT id FROM source_documents',
 ' WHERE source_url=ANY($1::text[]) OR content_sha256=ANY($2::text[]))',
 " OR v.metadata->>'committeeName' IN ('Elections','Committee on Elections')",
 " OR (v.metadata->>'committeeVote'='true' AND b.identifier=ANY($4::text[])))",
 ' ORDER BY v.id LIMIT 301'
].join('');
const CHOICES=[
 'SELECT mv.id::text,mv.vote_event_id::text,mv.membership_id::text,',
 ' mv.source_member_name,mv.normalized_member_name,mv.choice,mv.source_ordinal,mv.metadata',
 ' FROM member_votes mv WHERE mv.vote_event_id=ANY($1::uuid[])',
 ' ORDER BY mv.id LIMIT 1501'
].join('');
const ROSTER=[
 'SELECT m.id::text AS membership_id,l.id::text AS legislator_id,s.slug AS session_slug,',
 'l.name,l.normalized_name,m.starts_on::text,m.ends_on::text',
 ' FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
 ' JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id',
 " JOIN chambers c ON c.id=m.chamber_id WHERE j.slug='us-mn' AND c.slug='senate'",
 " AND s.slug='2023-2024' ORDER BY m.id LIMIT 151"
].join('');
const ALIASES=[
 'SELECT a.membership_id::text,a.source_name FROM membership_source_aliases a',
 ' JOIN memberships m ON m.id=a.membership_id',
 ' JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id',
 " JOIN chambers c ON c.id=m.chamber_id WHERE j.slug='us-mn' AND c.slug='senate'",
 " AND s.slug='2023-2024' ORDER BY a.membership_id,a.source_name LIMIT 801"
].join('');
const BILLS=[
 'SELECT b.id::text,b.identifier,b.session_id::text,',
 ' b.originating_chamber_id::text AS chamber_id,s.slug AS session_slug FROM bills b',
 ' JOIN legislative_sessions s ON s.id=b.session_id',
 ' JOIN jurisdictions j ON j.id=s.jurisdiction_id',
 ' JOIN chambers c ON c.id=b.originating_chamber_id',
 " WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug='2023-2024'",
 ' AND b.identifier=ANY($1::text[]) ORDER BY b.id LIMIT 21'
].join('');

export async function freshOriginals(fetcher=fetchSenateCommitteeMinutePdf){
 const pins=sourceQueue(),docs=[];
 for(const p of pins){
  if(!/^2023-0[1-3]-\d\d$/.test(p.hearingDate))
   throw Error('Original cohort hearing date outside fixed bounds');
  const pdf=await fetcher({url:p.officialSourcePdfUrl});
  if(pdf.contentSha256!==p.originalSourcePdfSha256||
     sha(pdf.text)!==p.originalEmbeddedTextSha256||pdf.bytes<500)
   throw Error('Official original PDF byte or text fingerprint changed');
  docs.push({date:p.hearingDate,url:p.officialSourcePdfUrl,
   rawSha:pdf.contentSha256,bytes:pdf.bytes,text:pdf.text});
 }
 const proof=verifyOriginals(docs);
 return {docs,proof};
}
async function bounded(db,sql,params,max){
 const rows=(await db.query(sql,params)).rows;
 if(rows.length>=max)throw Error('Bounded protected snapshot truncated');
 return rows;
}
export function snapshotBindings(originals){
 return {
  documents:[originals.docs.map(x=>x.url),originals.docs.map(x=>x.rawSha)],
  events:[originals.docs.map(x=>x.url),originals.docs.map(x=>x.rawSha),
   originals.docs.map(x=>x.date),[...new Set(SPECS.map(x=>x.bill))]],
  bills:[[...new Set(SPECS.map(x=>x.bill))]]
 };
}
async function privateSnapshot(db,originals){
 const params=snapshotBindings(originals);
 const docs=await bounded(db,DOCS,params.documents,MAX.docs);
 const events=await bounded(db,EVENTS,params.events,MAX.events);
 const choices=await bounded(db,CHOICES,[events.map(x=>x.id)],MAX.choices);
 const members=await bounded(db,ROSTER,[],MAX.roster);
 const aliases=await bounded(db,ALIASES,[],MAX.aliases);
 const bills=await bounded(db,BILLS,params.bills,MAX.bills);
 const year=await bounded(db,COMMITTEE_YEAR_SQL,[],MAX.year);
 const roster=members.map(p=>({...p,aliases:aliases.filter(a=>
   a.membership_id===p.membership_id).map(a=>a.source_name)}));
 return {docs,events,choices,roster,bills,year};
}
async function verifySchema(db){
 const expected=readdirSync('migrations').filter(n=>/^\d{4}_[\w-]+\.sql$/.test(n))
  .sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
 const got=(await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows;
 if(!same(expected,got))throw Error('Production schema migration ledger drift');
}
async function readOnly(pool,target,originals){
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
   const who=(await db.query([
    'SELECT current_database() AS db,current_user AS role,',
    " current_setting('transaction_read_only') AS ro,",
    " current_setting('transaction_isolation') AS isolation"
   ].join(''))).rows[0];
   if(who?.db!==target.database||who.role!==target.role||
      who.ro!=='on'||who.isolation!=='repeatable read')
    throw Error('Protected read-only primary identity check failed');
   await verifySchema(db);
   return await privateSnapshot(db,originals);
  }finally{await db.query('ROLLBACK')}
 }finally{db.release(true)}
}
function retained(before,after,plan){
 if(!same(before.docs,after.docs)||!same(before.roster,after.roster)||
   !same(before.bills,after.bills))
  throw Error('Existing original document, roster or bill mutated');
 for(const c of before.choices)if(!same(c,after.choices.find(x=>x.id===c.id)))
  throw Error('An existing choice was changed or deleted');
 const updates=new Set(plan.updates.map(x=>x.event.id));
 for(const e of before.events){
  const a=after.events.find(x=>x.id===e.id);
  if(!a)throw Error('Original historical event deleted');
  if(updates.has(e.id)){
   for(const k of ['id','source_document_id','session_id','chamber_id','bill_id',
    'external_key','occurred_on','yea_count','nay_count','is_passage'])
    if(!same(a[k],e[k]))throw Error('Original event parliamentary identity changed');
  }else if(!same(e,a))throw Error('Unreviewed historical event changed');
 }
}
async function apply(pool,originals,before,planned){
 const count={insertedEvents:0,insertedChoices:0,correctedEventClassification:0};
 if(!planned.add.length&&!planned.addChoices.length&&!planned.updates.length)return count;
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  try{
   await db.query('LOCK TABLE vote_events,member_votes,source_documents,memberships,'
    +'membership_source_aliases,legislators,bills,legislative_sessions,chambers,jurisdictions'
    +' IN SHARE ROW EXCLUSIVE MODE');
   const current=await privateSnapshot(db,originals);
   if(!same(before,current))throw Error('Concurrent pre-write historical evidence drift');
   const locked=recoveryPlan(originals.proof,current);
   if(!same(planned,locked))throw Error('Unsafe concurrent question or membership drift');
   for(const u of locked.updates){
    const r=await db.query(
     'UPDATE vote_events SET vote_kind=$2,amendment_ref=$3,passed=$4,'
     +'metadata=metadata||$5::jsonb WHERE id=$1 AND source_document_id=$6 RETURNING id::text',
     [u.event.id,u.q.kind,u.q.ref,u.q.passed,
      JSON.stringify(eventMetadata(u.q)),u.event.source_document_id]);
    if(r.rows.length!==1)throw Error('Exact historical classification update conflicted');
    count.correctedEventClassification++;
   }
   for(const p of locked.add){
    const q=p.q,yea=p.votes.filter(x=>x.choice==='yea').length;
    const nay=p.votes.length-yea;
    const r=await db.query(SF1_INSERT_EVENT,[p.b.session_id,p.b.chamber_id,
     p.b.id,p.doc.id,q.key,q.kind,q.question,q.ref,q.date,yea,nay,
     q.passed,JSON.stringify(eventMetadata(q))]);
    if(r.rows.length!==1)throw Error('Unique stable original event conflict');
    count.insertedEvents++;
    for(const v of p.votes){
     const a=await db.query(SF1_INSERT_CHOICE,[r.rows[0].id,v.membershipId,
      v.sourceName,v.normalizedName,v.choice,null,JSON.stringify(eventMetadata(q))]);
     if(a.rows.length!==1)throw Error('Named choice conflict inside original event');
     count.insertedChoices++;
    }
   }
   for(const x of locked.addChoices){
    const r=await db.query(SF1_INSERT_CHOICE,[x.eventId,x.v.membershipId,
     x.v.sourceName,x.v.normalizedName,x.v.choice,null,JSON.stringify(eventMetadata(x.q))]);
    if(r.rows.length!==1)throw Error('Existing event named choice conflict');
    count.insertedChoices++;
   }
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
 }finally{db.release(true)}
 return count;
}
export async function runProduction(pool,target,originals){
 console.log('SENATE864_2023_ELECTIONS_STAGE=prewrite_rr_readonly');
 const before=await readOnly(pool,target,originals);
 console.log('SENATE864_2023_ELECTIONS_BOUNDED='+JSON.stringify({
  docs:before.docs.length,events:before.events.length,choices:before.choices.length,
  roster:before.roster.length,bills:before.bills.length,
  exactDocuments:originals.docs.map(o=>before.docs.filter(d=>
   d.source_url===o.url&&d.content_sha256===o.rawSha).length)
 }));
 const plan=recoveryPlan(originals.proof,before);
 const addition=plan.add.reduce((n,x)=>n+x.votes.length,0)+plan.addChoices.length;
 const safe={originalMinutes:originals.docs.length,sourceNamedRolls:10,
  sourceNamedYeaNayChoices:133,selectedProvenQuestions:originals.proof.length,
  selectedNamedChoices:106,fixedSourceQuestionHolds:HELD.length,
  fixedSourceChoicesHeld:27,
  previouslyExactQuestions:plan.exact.length,toAddEvents:plan.add.length,
  toAddChoices:addition,toCorrectClassification:plan.updates.length,
  unresolvedLiveQuestions:plan.holds.length,
  holdReasons:plan.holds.reduce((r,x)=>(r[x.reason]=(r[x.reason]||0)+1,r),{})};
 console.log('SENATE864_2023_ELECTIONS_PLAN='+JSON.stringify(safe));
 console.log('SENATE864_2023_ELECTIONS_STAGE=serializable_guarded_write');
 const count=await apply(pool,originals,before,plan);
 if(!same(count,{insertedEvents:plan.add.length,insertedChoices:addition,
   correctedEventClassification:plan.updates.length}))
  throw Error('Post-write insert/update expected row counts disagree');
 console.log('SENATE864_2023_ELECTIONS_STAGE=independent_rr_readonly_postwrite');
 const after=await readOnly(pool,target,originals);
 retained(before,after,plan);
 const replay=recoveryPlan(originals.proof,after);
 if(replay.add.length||replay.addChoices.length||replay.updates.length||
   replay.exact.length+replay.holds.length!==originals.proof.length)
  throw Error('Production original named-choice independent readback not exact');
 return {...safe,...count,independentVerifiedQuestions:replay.exact.length,
  independentHeldQuestions:replay.holds.length,
  yearCountsBefore:before.year,yearCountsAfter:after.year,
  previouslyExistingChoicesAndEventsPreserved:true,
  independentlyAuthenticatedOriginalBytesAndExtractedTexts:true,
  productionReadbackReadOnlyRepeatableReadAndRolledBack:true,
  writesSerializable:true,
  idempotentReplayWouldWrite:0,
  originalQuestionKeysNeverUsePositions:true,
  sourceChoiceOrdinalUnknownStoredNull:true,
  originalHearingDateConvention:true,sameDayEligibilityExcluded:true,
  servingFloorWeightsModelsTrainingAndSchedulesUnchanged:true};
}
async function main(){
 let stage='reviewed_original_main_gate',pool;
 try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--source-only'){
   stage='keyless_independent_public_original_source_checks';
   const o=await freshOriginals();
   console.log('SENATE864_2023_ELECTIONS_SOURCE_VERIFIED='+JSON.stringify({
    officialOriginalMinutes:o.docs.length,sourceQuestionRolls:10,
    sourceNamedChoices:133,selectedSafeSourceQuestions:o.proof.length,
    selectedSafeChoiceOccurrences:o.proof.reduce((n,q)=>n+q.choices.length,0),
    heldQuestions:HELD.length,heldNamedChoices:27,productionWrites:0}));
   return;
  }
  if(args.length)throw Error('Only keyless source verification or protected production');
  const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH||'','utf8'));
  assertHistoricalMainPush({...env,VOTEPREDICT_864_72_INDEPENDENT_CI:env.SENATE864_INDEPENDENT_MAIN},event);
  if(!event.head_commit.message.includes(MARKER))
   throw Error('Exact protected original recovery merge marker missing');
  stage='independent_original_source_sha_before_credentials';
  const originals=await freshOriginals();
  stage='resolve_authentic_existing_neon_default_primary';
  const target=await discoverExistingVotePredictNeonConnection({
   apiKey:env.NEON_API_KEY||'',projectId:env.VOTEPREDICT_NEON_PROJECT_ID||'',
   preferredDatabase:env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,
   database:target.database,ssl:{rejectUnauthorized:true},max:1,
   connectionTimeoutMillis:10000,statement_timeout:55000,
   query_timeout:60000,options:'-c lock_timeout=4000',application_name:VERSION});
  stage='protected_source_to_production_question_reconciliation';
  const result=await runProduction(pool,target,originals);
  const receipt={schema:VERSION,reviewedCommit:env.GITHUB_SHA,
   verifiedAt:new Date().toISOString(),...result};
  const body=JSON.stringify(receipt,null,2);
  if(body.length>45000||/(?:postgres(?:ql)?:\/\/|password|membership_id|normalized_member_name|source_url)/i.test(body))
   throw Error('Public numeric-only production receipt constraint failed');
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/senate864-elections-2023-production-readback.json',body+'\n');
  console.log('SENATE864_2023_ELECTIONS_PRODUCTION_VERIFIED='+JSON.stringify(receipt));
 }catch(e){
  const known=new Set(['Production schema migration ledger drift',
   'Protected read-only primary identity check failed','Bounded protected snapshot truncated',
   'Concurrent pre-write historical evidence drift',
   'Unsafe concurrent question or membership drift',
   'Production original named-choice independent readback not exact',
   'Post-write insert/update expected row counts disagree',
   'Official original PDF byte or text fingerprint changed',
   'Original exact-offset roll / source tally mismatch',
   'Original source result disagrees with selected parliamentary question',
   'Original named vote lacks one locally bound printed tally and motion result',
   'Original question bill identity not separately proven',
   'Original numbered amendment identity not proven',
   'Original oral amendment identity not proven',
   'Original committee recommendation identity not proven',
   'Original printed surname/side not proved by roster',
   'Original named-choice source is incomplete',
   'Original vote roster and explicitly printed side totals disagree',
   'Selected original exact question and choice totals not certified',
   'Original 2023 Elections roll denominator drift',
   'Authenticated original official Senate PDF or text SHA drift',
   'Exactly seven independent 2023 original Minutes required',
   'Unaccounted source-only held motion']);
  const label=e instanceof Error&&(known.has(e.message)||/^Original source tally\/disposition unbound on 2023-0[1-3]-\d\d offset \d{3,5}$/.test(e.message))?e.message:'fail_closed_original_source_or_private_database_guard';
  const sqlstate=e&&typeof e==='object'&&typeof e.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)
   ?e.code:'none';
  console.error('SENATE864_2023_ELECTIONS_SAFE_FAILURE='+JSON.stringify({label,sqlstate,stage}));
  process.exitCode=1;
 }finally{if(pool)await pool.end()}
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/deploy-senate-864-elections-2023-original-recovery.mjs'))
 void main();
