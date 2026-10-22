/** Reviewed source plan -> protected main -> bounded RR/ROLLBACK -> SERIALIZABLE
 * add-only repair -> independent RR/ROLLBACK and zero-write replay. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {VERSION,MARKER,sha,norm,extractRowRollQuestions,reconcileRowQuestion} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {extractSenateMinutesText,fetchSenateMinutesHtml} from '../src/sources/minnesota/senate-schedule.ts';
import {normalizeMemberName} from '../src/sources/minnesota/house-votes.ts';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.ts';
import {senateCommitteeHearingTiming} from '../src/evidence/senate-committee-meeting-timing.ts';
import {COMMITTEE_YEAR_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
export const PLAN_PATH='docs/evaluation/source-proof/senate-864-population-row-repair-plan.json';
export const planSource=()=>JSON.parse(readFileSync(PLAN_PATH,'utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function freshOriginals(fetcher=fetchSenateMinutesHtml){
 const pins=planSource(),docs=[];
 if(pins.expectedQuestions!==14||pins.expectedChoices!==181||pins.sourceDocuments.length!==10||pins.questions.length!==14)throw Error('Reviewed source bounds changed');
 for(const p of pins.sourceDocuments){
  const u=new URL(p.url);
  if(u.origin!=='https://www.senate.mn'||u.pathname!=='/schedule/hearing_minutes.html'||!/^202[34]-0[1-4]-\d\d$/.test(p.date)||!['Elections','Taxes'].includes(p.committee)||p.session_slug!=='2023-2024')throw Error('Reviewed original source scope changed');
  const text=extractSenateMinutesText(await fetcher(p.url));
  if(sha(text)!==p.sha256)throw Error('Independently fetched original text SHA drift');
  const doc={...p,source_url:p.url,content_sha256:p.sha256,text,authenticated:true};
  const questions=extractRowRollQuestions(text,doc);
  for(const spec of pins.questions.filter(q=>q.sourceUrl===p.url)){
   const actual=questions.filter(q=>q.questionKey===spec.questionKey&&q.confidence==='source_proven_question');
   if(actual.length!==1||['motionText','billIdentifier','amendmentRef','voteKind','passed','yea','nay'].some(k=>!same(actual[0][k],spec[k])))throw Error('Generic question extractor differs from reviewed population source plan');
  }
  docs.push(doc);
 }
 return {docs,pins};
}
export const SNAPSHOT_SQL={
 documents:`SELECT sd.id::text,sd.source_url,sd.content_sha256,sd.session_id::text,sd.chamber_id::text,
 s.slug AS session_slug,sd.metadata->'rawPrepassageVotes'->>'sourceDate' AS date,
 sd.metadata->'rawPrepassageVotes'->'hearing'->>'committeeName' AS committee
 FROM source_documents sd JOIN legislative_sessions s ON s.id=sd.session_id
 WHERE sd.source_url=ANY($1::text[]) ORDER BY sd.id LIMIT 21`,
 events:`SELECT v.id::text,v.source_document_id::text,v.session_id::text,v.chamber_id::text,v.bill_id::text,
 v.external_key,v.vote_kind,v.motion_text,v.amendment_ref,v.occurred_on::text,v.yea_count,v.nay_count,
 v.passed,v.is_passage,v.metadata,v.created_at::text,b.identifier AS bill_identifier,s.slug AS session_slug
 FROM vote_events v JOIN legislative_sessions s ON s.id=v.session_id LEFT JOIN bills b ON b.id=v.bill_id
 WHERE v.metadata->>'committeeVote'='true' AND v.occurred_on>=DATE '2022-01-01' AND v.occurred_on<DATE '2026-01-01'
 ORDER BY v.id LIMIT 601`,
 choices:`SELECT m.id::text,m.vote_event_id::text,m.membership_id::text,m.source_member_name,m.normalized_member_name,
 m.choice,m.source_ordinal,m.metadata,m.created_at::text FROM member_votes m JOIN vote_events v ON v.id=m.vote_event_id
 WHERE v.metadata->>'committeeVote'='true' AND v.occurred_on>=DATE '2022-01-01' AND v.occurred_on<DATE '2026-01-01'
 ORDER BY m.id LIMIT 4001`,
 roster:`SELECT m.id::text AS membership_id,l.name,l.normalized_name,m.starts_on::text,m.ends_on::text,s.slug AS session_slug
 FROM memberships m JOIN legislators l ON l.id=m.legislator_id JOIN legislative_sessions s ON s.id=m.session_id
 JOIN chambers c ON c.id=m.chamber_id JOIN jurisdictions j ON j.id=s.jurisdiction_id
 WHERE c.slug='senate' AND j.slug='us-mn' AND s.slug IN ('2021-2022','2023-2024','2025-2026') ORDER BY m.id LIMIT 401`,
 bills:`SELECT b.id::text,b.identifier,b.session_id::text,b.originating_chamber_id::text AS chamber_id,s.slug AS session_slug
 FROM bills b JOIN legislative_sessions s ON s.id=b.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id
 WHERE j.slug='us-mn' AND s.slug='2023-2024' AND b.identifier=ANY($1::text[]) ORDER BY b.id LIMIT 21`,
};
async function snapshot(db,o){
 const bounded=async(sql,args,max)=>{const r=(await db.query(sql,args)).rows;if(r.length>=max)throw Error('Snapshot truncated');return r;};
 const docs=await bounded(SNAPSHOT_SQL.documents,[o.docs.map(d=>d.url)],21);
 for(const original of o.docs){const matches=docs.filter(d=>d.source_url===original.url&&d.content_sha256===original.sha256&&d.date===original.date&&d.committee===original.committee&&d.session_slug===original.session_slug);if(matches.length!==1)throw Error('Exact stored original provenance missing or duplicated');}
 return {docs,events:await bounded(SNAPSHOT_SQL.events,[],601),choices:await bounded(SNAPSHOT_SQL.choices,[],4001),roster:await bounded(SNAPSHOT_SQL.roster,[],401),bills:await bounded(SNAPSHOT_SQL.bills,[[...new Set(o.pins.questions.map(q=>q.billIdentifier))]],21),year:await bounded(COMMITTEE_YEAR_SQL,[],6)};
}
async function schemaCheck(db){
 const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
 const observed=(await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows;
 if(!same(expected,observed))throw Error('Schema ledger drift');
}
async function readOnly(pool,target,o){
 const db=await pool.connect();try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');try{
 const who=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
 if(who.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Read-only identity not verified');
 await schemaCheck(db);return await snapshot(db,o);
 }finally{await db.query('ROLLBACK');}}finally{db.release(true);}
}
export function correctionPlan(o,s){
 const work=[];
 for(const spec of o.pins.questions){
  const original=o.docs.find(d=>d.url===spec.sourceUrl),d=s.docs.find(d=>d.source_url===original.url);
  const doc={...original,...d,text:original.text,authenticated:true};
  const q=extractRowRollQuestions(doc.text,doc).find(q=>q.questionKey===spec.questionKey);
  if(!q)throw Error('Reviewed question missing');
  const result=reconcileRowQuestion(q,doc,s);
  if(!['missing_event','exact'].includes(result.status))throw Error('Original-to-production question held: '+result.status);
  const bills=s.bills.filter(b=>b.identifier===q.billIdentifier&&b.session_id===doc.session_id&&b.session_slug===doc.session_slug&&b.chamber_id===doc.chamber_id);
  if(bills.length!==1)throw Error('Bill/session/chamber identity hold');
  work.push({q,doc,bill:bills[0],result});
 }
 if(new Set(work.map(x=>x.q.questionKey)).size!==14||work.reduce((n,x)=>n+x.q.choices.length,0)!==181)throw Error('Bounded reviewed questions drift');
 return work;
}
export async function runProduction(pool,target,o){
 const before=await readOnly(pool,target,o),plan=correctionPlan(o,before),add=plan.filter(x=>x.result.status==='missing_event');
 if(add.length!==0&&add.length!==14)throw Error('Partial population repair state held');
 let insertedEvents=0,insertedChoices=0;
 if(add.length){const db=await pool.connect();try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');try{
 await db.query('LOCK TABLE vote_events,member_votes,source_documents,memberships,legislators,bills,legislative_sessions,chambers,jurisdictions IN SHARE ROW EXCLUSIVE MODE');
 await schemaCheck(db);const locked=await snapshot(db,o);if(!same(before,locked)||!same(plan,correctionPlan(o,locked)))throw Error('Concurrent source or production drift');
 for(const x of add){const {q,doc,bill,result}=x;
 const metadata={committeeVote:true,committeeName:doc.committee,individualVotesAvailable:true,sourceQuestionKey:q.questionKey,
 sourceQuestion:q.motionText,sourceTextSha256:doc.sha256,issue864SourceRepair:VERSION,finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,...senateCommitteeHearingTiming(doc.date).metadata};
 const e=await db.query(SF1_INSERT_EVENT,[bill.session_id,bill.chamber_id,bill.id,doc.id,'senate-committee-source-v1:'+q.questionKey,q.voteKind,q.motionText,q.amendmentRef,doc.date,q.yea,q.nay,q.passed,JSON.stringify(metadata)]);
 if(e.rows.length!==1)throw Error('Event concurrent conflict');insertedEvents++;
 for(const v of result.choices){const r=await db.query(SF1_INSERT_CHOICE,[e.rows[0].id,v.membershipId,v.name,normalizeMemberName(v.name),v.choice,null,JSON.stringify({committeeVote:true,issue864SourceRepair:VERSION,fullHistoricalNameFromOriginalHeader:true})]);if(r.rows.length!==1)throw Error('Choice concurrent conflict');insertedChoices++;}
 }
 await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e}}finally{db.release(true);}}
 const after=await readOnly(pool,target,o),replay=correctionPlan(o,after);
 if(replay.some(x=>x.result.status!=='exact'))throw Error('Independent question/choice readback failed');
 for(const field of ['docs','roster','bills'])if(!same(before[field],after[field]))throw Error('Existing context changed');
 for(const field of ['events','choices'])for(const old of before[field])if(!same(old,after[field].find(x=>x.id===old.id)))throw Error('Previously valid record mutated');
 const ids=replay.map(x=>{const e=after.events.find(e=>e.id===x.result.eventId);if(!e.created_at||e.metadata?.sourceQuestionKey!==x.q.questionKey||e.metadata?.sameDayEligible!==false||e.metadata?.availableOn!==x.doc.date)throw Error('Exact new event/timestamp/timing readback failed');return {questionKey:x.q.questionKey,eventId:e.id,createdAt:e.created_at,choices:x.q.choices.length};});
 return {sourceOriginals:10,sourceProvenQuestions:14,sourceProvenChoices:181,previousExact:plan.filter(x=>x.result.status==='exact').length,insertedEvents,insertedChoices,verifiedExact:14,verifiedChoices:181,zeroWriteReplay:true,yearCountsBefore:before.year,yearCountsAfter:after.year,existingEventIdsAndChoicesPreserved:true,verifiedRepeatableReadReadOnlyAndRollback:true,serializableWrites:true,recoveredEvents:ids};
}
async function main(){let phase='main_push_guard',pool;try{
 if(process.argv.length===3&&process.argv[2]==='--source-only'){const o=await freshOriginals();console.log('SENATE864_POPULATION_ROW_SOURCE_OK='+JSON.stringify({originals:o.docs.length,questions:14,choices:181,productionWrites:0}));return;}
 if(process.argv.length!==2)throw Error('Fixed modes only');const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH||''));
 assertHistoricalMainPush({...env,VOTEPREDICT_864_72_INDEPENDENT_CI:env.SENATE864_INDEPENDENT_MAIN},event);if(!event.head_commit.message.includes(MARKER))throw Error('Reviewed marker absent');
 phase='independent_originals';const o=await freshOriginals();phase='existing_primary';
 const target=await discoverExistingVotePredictNeonConnection({apiKey:env.NEON_API_KEY||'',projectId:env.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
 pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,query_timeout:60000,statement_timeout:55000,options:'-c lock_timeout=4000',application_name:VERSION});
 phase='protected_repair_and_independent_readback';const result=await runProduction(pool,target,o);
 const receipt={version:VERSION,reviewedCommit:env.GITHUB_SHA,verifiedAt:new Date().toISOString(),...result};
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-population-row-readback.json',JSON.stringify(receipt,null,2)+'\n');console.log('SENATE864_POPULATION_ROW_PRODUCTION='+JSON.stringify(receipt));
 }catch(e){console.error('SENATE864_POPULATION_ROW_HOLD_AT='+phase);if(e?.code&&/^[A-Z0-9]{5}$/.test(e.code))console.error('SQLSTATE='+e.code);process.exitCode=1;}finally{if(pool)await pool.end();}}
if(process.argv[1]?.endsWith('/deploy-senate-864-population-row-rolls.mjs'))void main();
