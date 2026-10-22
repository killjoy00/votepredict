/** Issue #864: original-pinned Minutes -> exact live source/choice parity -> guarded add-only
 * or in-place classification repair -> independent read-back. Run only from protected
 * main push after independent source/CI verification. Source-only mode uses no secrets.
 */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.ts';
import {verifyFourOriginalTexts,recoveryPlan,sourceLedger,meta,VERSION,MARKER} from
 '../src/evidence/senate-864-elections-original-recovery.mjs';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {COMMITTEE_YEAR_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
const DOCS=`SELECT id::text,source_url,content_sha256,session_id::text,chamber_id::text,
 metadata->>'meetingDate' AS meeting_date,metadata->>'committeeName' AS committee_name
 FROM source_documents WHERE source_url=ANY($1::text[]) OR content_sha256=ANY($2::text[])
 ORDER BY id LIMIT 21`;
const EVENTS=`SELECT v.id::text,v.source_document_id::text,v.session_id::text,v.chamber_id::text,
 v.bill_id::text,v.external_key,b.identifier AS bill_identifier,
 v.motion_text,v.vote_kind,v.amendment_ref,v.occurred_on::text,v.yea_count,v.nay_count,
 v.passed,v.is_passage,v.metadata
 FROM vote_events v LEFT JOIN bills b ON b.id=v.bill_id
 WHERE v.occurred_on=ANY($3::date[]) AND
 (v.source_document_id IN (SELECT id FROM source_documents WHERE source_url=ANY($1::text[])
    OR content_sha256=ANY($2::text[]))
  OR v.metadata->>'committeeName' IN ('Elections','Committee on Elections')
  OR (v.metadata->>'committeeVote'='true' AND b.identifier IN ('SF529','SF569','SF1812','SF2384')))
 ORDER BY v.id LIMIT 201`;
const CHOICES=`SELECT mv.id::text,mv.vote_event_id::text,mv.membership_id::text,
 mv.source_member_name,mv.normalized_member_name,mv.choice,mv.source_ordinal,mv.metadata
 FROM member_votes mv JOIN vote_events v ON v.id=mv.vote_event_id
 WHERE v.occurred_on=ANY($3::date[]) AND
 (v.source_document_id IN (SELECT id FROM source_documents WHERE source_url=ANY($1::text[])
 OR content_sha256=ANY($2::text[])) OR v.metadata->>'committeeName'='Elections')
 ORDER BY mv.id LIMIT 601`;
const ROSTER=`SELECT m.id::text AS membership_id,l.id::text AS legislator_id,
 s.slug AS session_slug,l.name,l.normalized_name,m.starts_on::text,m.ends_on::text
 FROM memberships m JOIN legislators l ON l.id=m.legislator_id
 JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id
 JOIN chambers c ON c.id=m.chamber_id
 WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug='2025-2026'
 ORDER BY m.id LIMIT 151`;
const ALIASES=`SELECT a.membership_id::text,a.source_name
 FROM membership_source_aliases a JOIN memberships m ON m.id=a.membership_id
 JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id
 JOIN chambers c ON c.id=m.chamber_id
 WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug='2025-2026'
 ORDER BY a.membership_id,a.source_name LIMIT 801`;
const BILLS=`SELECT b.id::text,b.identifier,b.session_id::text,
 b.originating_chamber_id::text AS chamber_id,s.slug AS session_slug
 FROM bills b JOIN legislative_sessions s ON s.id=b.session_id
 JOIN jurisdictions j ON j.id=s.jurisdiction_id
 JOIN chambers c ON c.id=b.originating_chamber_id
 WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug='2025-2026'
 AND b.identifier IN ('SF529','SF569','SF1812','SF2384')
 ORDER BY b.id LIMIT 10`;
const YEAR=COMMITTEE_YEAR_SQL;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const MAX={docs:21,events:201,choices:601,roster:151,aliases:801,bills:10,year:6};
export async function freshOriginals(){
 const pins=sourceLedger();
 if(pins.sourceRecords.length!==4)throw Error('Original four-source cohort changed');
 const docs=[];
 for(const p of pins.sourceRecords){
  if(!/^2025-0[234]-\d\d$/.test(p.indexedHearingDate))throw Error('Outside fixed hearing dates');
  const pdf=await fetchSenateCommitteeMinutePdf({url:p.officialOriginalPDFUrl});
  if(pdf.contentSha256!==p.shaPinnedOriginalPDF||pdf.bytes!==p.shaPinnedOriginalPdfBytes)
    throw Error('Original official Minutes bytes changed');
  docs.push({date:p.indexedHearingDate,url:p.officialOriginalPDFUrl,rawSha:pdf.contentSha256,
    bytes:pdf.bytes,text:pdf.text});
 }
 const proof=verifyFourOriginalTexts(docs);
 if(proof.length!==9||new Set(proof.map(x=>x.key)).size!==9)throw Error('Original parliamentary identity proof');
 return {docs,proof};
}
const bounded=async(db,sql,params,max)=>{const rows=(await db.query(sql,params)).rows;
 if(rows.length>=max)throw Error('Bounded SQL snapshot truncated');return rows;};
/** Bind counts are part of the SQL contract: DOCS uses $1/$2; EVENT/CHOICE use $1/$2/$3.
 * Passing the three event arguments to DOCS triggers PostgreSQL 08P01 and prevents
 * any source-to-store audit; keep this pure mapping independently testable.
 */
export function sourceSnapshotBindings(originals){
 const urls=originals.docs.map(x=>x.url),hashes=originals.docs.map(x=>x.rawSha),
       dates=originals.docs.map(x=>x.date);
 return {documents:[urls,hashes],events:[urls,hashes,dates],choices:[urls,hashes,dates]};
}
async function privateSnapshot(db,originals){
 const bind=sourceSnapshotBindings(originals);
 const docs=await bounded(db,DOCS,bind.documents,MAX.docs);
 const events=await bounded(db,EVENTS,bind.events,MAX.events);
 const choices=await bounded(db,CHOICES,bind.choices,MAX.choices);
 const people=await bounded(db,ROSTER,[],MAX.roster);
 const aliases=await bounded(db,ALIASES,[],MAX.aliases);
 const bills=await bounded(db,BILLS,[],MAX.bills);
 const roster=people.map(p=>({...p,aliases:aliases.filter(a=>a.membership_id===p.membership_id).map(a=>a.source_name)}));
 const year=await bounded(db,YEAR,[],MAX.year);
 return {docs,events,choices,roster,bills,year};
}
async function schemaCheck(db){
 const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f))
 .sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
 const observed=(await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows;
 if(!same(expected,observed))throw Error('Production schema ledger drift');
}
async function readOnly(pool,target,originals){
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
   const w=(await db.query(`SELECT current_database() AS db,current_user AS role,
    current_setting('transaction_read_only') AS ro,
    current_setting('transaction_isolation') AS isolation`)).rows[0];
   if(w?.db!==target.database||w.role!==target.role||w.ro!=='on'||w.isolation!=='repeatable read')
    throw Error('Read-only primary identity proof failed');
   await schemaCheck(db);
   return await privateSnapshot(db,originals);
  }finally{await db.query('ROLLBACK')}
 }finally{db.release(true)}
}
function preserved(before,after,plan){
 if(!same(before.docs,after.docs)||!same(before.roster,after.roster)||!same(before.bills,after.bills))
  throw Error('Historical source/bill/roster mutated');
 for(const v of before.choices)if(!same(v,after.choices.find(x=>x.id===v.id)))
  throw Error('Pre-existing named side modified');
 const changing=new Set(plan.updates.map(x=>x.event.id));
 for(const e of before.events){
  const a=after.events.find(x=>x.id===e.id);
  if(!a)throw Error('Existing event deleted');
  if(changing.has(e.id)){
   for(const key of ['id','source_document_id','session_id','chamber_id','bill_id','external_key','occurred_on','yea_count','nay_count','is_passage'])
    if(!same(a[key],e[key]))throw Error('Existing parliamentary identity mutated');
  }else if(!same(e,a))throw Error('Unreviewed original event changed');
 }
}
async function apply(pool,originals,before,planned){
 const count={insertedEvents:0,insertedChoices:0,correctedEventClassification:0};
 if(!planned.add.length&&!planned.addChoices.length&&!planned.updates.length)return count;
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  try{
   await db.query(`LOCK TABLE vote_events,member_votes,source_documents,memberships,
    membership_source_aliases,legislators,bills,legislative_sessions,chambers,jurisdictions
    IN SHARE ROW EXCLUSIVE MODE`);
   const current=await privateSnapshot(db,originals);
   if(!same(before,current))throw Error('Concurrent historical record drift');
   const lockedPlan=recoveryPlan(originals.proof,current);
   if(!same(planned,lockedPlan))throw Error('Unsafe concurrent source reconciliation');
   for(const u of lockedPlan.updates){
    const r=await db.query(`UPDATE vote_events SET vote_kind=$2,amendment_ref=$3,
     passed=$4,metadata=metadata||$5::jsonb WHERE id=$1
     AND source_document_id=$6 RETURNING id::text`,
     [u.event.id,u.kind,u.ref,u.passed,JSON.stringify(meta(u.proof)),u.event.source_document_id]);
    if(r.rows.length!==1)throw Error('Exact in-place question correction failed');
    count.correctedEventClassification++;
   }
   for(const p of lockedPlan.add){
    const q=p.q;
    const inserted=await db.query(SF1_INSERT_EVENT,[p.b.session_id,p.b.chamber_id,p.b.id,
     p.doc.id,q.key,q.kind,q.question,q.ref,q.date,q.yea,q.nay,q.passed,JSON.stringify(meta(q))]);
    if(inserted.rows.length!==1)throw Error('Duplicate event; serializable rollback');
    count.insertedEvents++;
    for(const [i,v] of p.votes.entries()){
     const x=await db.query(SF1_INSERT_CHOICE,[inserted.rows[0].id,v.membershipId,
       v.name,v.normalizedName,v.choice,i,JSON.stringify(meta(q))]);
     if(x.rows.length!==1)throw Error('Named member choice insert conflict');
     count.insertedChoices++;
    }
   }
   for(const c of lockedPlan.addChoices){
    const x=await db.query(SF1_INSERT_CHOICE,[c.eventId,c.v.membershipId,
     c.v.name,c.v.normalizedName,c.v.choice,
     originals.proof.find(q=>q.key===c.q.key)?.choices.findIndex(v=>v.name===c.v.name)??-1,
     JSON.stringify(meta(c.q))]);
    if(x.rows.length!==1)throw Error('Existing event missing choice conflict');
    count.insertedChoices++;
   }
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
 }finally{db.release(true)}
 return count;
}
export async function runProduction(pool,target,originals){
 console.log('SENATE864_ELECTIONS_STAGE=before_rr_readonly');
 const before=await readOnly(pool,target,originals);
 console.log('SENATE864_ELECTIONS_SAFE_SNAPSHOT='+JSON.stringify({
   documents:before.docs.length,events:before.events.length,choices:before.choices.length,
   historicalMembers:before.roster.length,historicalBills:before.bills.length,
   sourceMatches:originals.docs.map(x=>before.docs.filter(d=>d.source_url===x.url&&d.content_sha256===x.rawSha).length)
 }));
 console.log('SENATE864_ELECTIONS_STAGE=independent_parliamentary_reconciliation');
 const plan=recoveryPlan(originals.proof,before);
 console.log('SENATE864_ELECTIONS_SAFE_PLAN='+JSON.stringify({
  verifiedSourceQuestions:originals.proof.length,
  toAddEvents:plan.add.length,toAddChoices:plan.add.reduce((n,x)=>n+x.votes.length,0)+plan.addChoices.length,
  toCorrectClassification:plan.updates.length,
  preExistingExact:plan.exact.length,held:plan.holds.length,
  holdCategories:plan.holds.reduce((a,x)=>(a[x.reason]=(a[x.reason]||0)+1,a),{})
 }));
 const expected={insertedEvents:plan.add.length,
   insertedChoices:plan.add.reduce((n,x)=>n+x.votes.length,0)+plan.addChoices.length,
   correctedEventClassification:plan.updates.length};
 console.log('SENATE864_ELECTIONS_STAGE=guarded_serializable_apply');
 const count=await apply(pool,originals,before,plan);
 if(!same(expected,count))throw Error('Production row count drift');
 console.log('SENATE864_ELECTIONS_STAGE=post_write_rr_readonly');
 const after=await readOnly(pool,target,originals);
 preserved(before,after,plan);
 const replay=recoveryPlan(originals.proof,after);
 if(replay.add.length||replay.addChoices.length||replay.updates.length||
    replay.exact.length+replay.holds.length!==originals.proof.length)
  throw Error('Independent post-write original question/choice read-back failed');
 const yearCount=y=>after.year.find(x=>Number(x.year)===y)??null;
 return {sourceOriginalDocuments:originals.docs.length,selectedSupplementalPrintedRolls:13,
  selectedSupplementalPrintedChoices:143,fullOriginalRollDenominatorCertified:false,
  reviewedMotionQuestions:originals.proof.length,
  preExistingExact:plan.exact.length,preExistingQuestionCorrections:plan.updates.length,
  preExistingNamedChoiceGaps:plan.addChoices.length,unrepresentedVerifiedQuestions:plan.add.length,
  ...count,heldSourceQuestions:4,heldLiveQuestions:plan.holds.length,
  heldReasonCounts:plan.holds.reduce((m,x)=>(m[x.reason]=(m[x.reason]||0)+1,m),{}),
  yearlyStoredBefore:before.year,yearlyStoredAfter:after.year,
  independentVerifiedQuestions:replay.exact.length,independentHeldLive:replay.holds.length,
  originalSourceUnchanged:true,existingEventIdsAndChoicesPreserved:true,
  replayWouldWrite:0,sourceOnlyNoServingWeightsModelTrainingFreeze:true,
  verifiedPrimaryReadOnlyRepeatableReadBeforeAfter:true,explicitRollbacks:true,
  serializableOriginalPlanRechecked:true,hearingDateAvailability:true,sameDayEligible:false,
  year2025:yearCount(2025)};
}
async function main(){
 let phase='reviewed_main_gate';let pool;
 try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--source-only'){
   phase='fresh_original_no_credentials';
   const originals=await freshOriginals();
   console.log('SENATE864_ELECTIONS_SOURCE_VERIFIED='+JSON.stringify({
    authenticatedOriginalMinutes:originals.docs.length,selectedSourceQuestions:originals.proof.length,
    sourceNamedChoices:originals.proof.reduce((n,q)=>n+q.choices.length,0),
    sourceHeldQuestions:4,sourceHeldChoices:44,productionWrites:0}));
   return;
  }
  if(args.length)throw Error('Only source-only or protected production');
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(!event.head_commit.message.includes(MARKER))throw Error('Exact reviewed production marker missing');
  phase='fresh_exact_original_minutes_before_credentials';
  const originals=await freshOriginals();
  phase='authenticated_existing_default_neon_primary';
  const target=await discoverExistingVotePredictNeonConnection({
   apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',
   preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,
   database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,
   statement_timeout:55000,query_timeout:60000,options:'-c lock_timeout=4000',application_name:VERSION});
  phase='read_proven_original_reconcile_write_and_readback';
  const result=await runProduction(pool,target,originals);
  const receipt={schema:VERSION,reviewedCommit:e.GITHUB_SHA,verifiedAt:new Date().toISOString(),...result};
  const body=JSON.stringify(receipt,null,2);
  if(body.length>50000||/(?:postgres(?:ql)?:\/\/|password|membership_id|normalized_member_name|source_url)/i.test(body))
   throw Error('Receipt privacy constraint failed');
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/senate864-elections-production-readback.json',body+'\n');
  console.log('SENATE864_ELECTIONS_PRODUCTION_VERIFIED='+JSON.stringify(receipt));
 }catch(error){
  // Exact static guard labels and driver SQLSTATE only; no raw error strings,
  // credentials, query text, private source rows, or names may leave the runner.
  const safe=new Set([
    'Production schema ledger drift','Read-only primary identity proof failed',
    'Authenticated stored original document absent or duplicated',
    'Exact historical bill/session/chamber context absent',
    'Historical exact full name/alias and service session unresolved',
    'Original given/family proof','Bounded SQL snapshot truncated',
    'Duplicate original named-choice source','Concurrent historical record drift',
    'Unsafe concurrent source reconciliation','Independent post-write original question/choice read-back failed',
    'Production row count drift'
  ]);
  const label=error instanceof Error&&safe.has(error.message)?error.message:'unclassified_guard_or_database_error';
  const sqlstate=error&&typeof error==='object'&&typeof error.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code)
    ?error.code:'none';
  console.error('SENATE864_ELECTIONS_SAFE_FAILURE='+JSON.stringify({label,sqlstate}));
  console.error('SENATE864_ELECTIONS_PRODUCTION_HOLD_AT='+phase);process.exitCode=1;
 }finally{if(pool)await pool.end()}
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/deploy-senate-864-elections-original-recovery.mjs'))
 void main();
