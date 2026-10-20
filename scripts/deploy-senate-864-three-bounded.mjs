/** Owner-authorized fixed production patch; no bulk replay or eligibility rewrite. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {verifyThreeBoundedOriginals} from './verify-senate-864-three-bounded-originals.mjs';
import {DOCS,EVENTS,CHOICES,ROSTER,ALIASES,MEDIA,FINANCE,VERSIONS,CAPTURE} from './audit-senate-864-three-bounded-evidence.mjs';
import {sha,assertSafeThreeReceipt,MEDIA_FRAGMENTS} from '../src/evidence/senate-864-three-bounded-evidence.mjs';
import {productionPlan,state,VERSION,MARKER,METHOD,REPORT} from '../src/evidence/senate-864-three-bounded-plan.mjs';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {COMMITTEE_YEAR_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
export const WRITE_DOCS=DOCS.replace('sd.content_sha256 FROM',"sd.content_sha256,sd.session_id::text,sd.chamber_id::text,sd.jurisdiction_id::text,sd.metadata->>'meetingDate' AS meeting_date,sd.metadata->>'committeeName' AS committee_name FROM");
export const WRITE_EVENTS=EVENTS.replace('v.id::text,','v.id::text,v.session_id::text,v.chamber_id::text,v.bill_id::text,v.external_key,v.occurred_on::text,v.metadata,');
export const WRITE_CHOICES=CHOICES.replace('mv.vote_event_id::text,','mv.id::text,mv.source_member_name,mv.normalized_member_name,mv.source_ordinal,mv.metadata,mv.vote_event_id::text,');
export const WRITE_MEDIA=MEDIA.replace('ei.excerpt,','ei.id::text,ei.membership_id::text,ei.bill_id::text,ei.claim,ei.stance,ei.source_quality,ei.relevance,ei.freshness,ei.extraction_method,ei.extraction_version,ei.excerpt,')
 .replace("WHERE sd.content_sha256",'WHERE (ei.excerpt LIKE ANY($2::text[])) OR sd.content_sha256');
export const WRITE_FINANCE=FINANCE.replace('ei.metadata,','ei.id::text,to_jsonb(ei) AS preserved_item,ei.metadata,');
export const WRITE_LINKS=`SELECT family,canonical_row_key,match_status,possible_entry_count,matching_method,entry_id::text FROM cfb_finance_report_transaction_links WHERE committee_registration='16891' AND transaction_year=2024 AND report_version_id='16891:24:pcc:YE:0:0' ORDER BY family,canonical_row_key LIMIT 101`;
export const ENTRIES=`SELECT id::text,page_number,line_number,raw_schedule_line,printed_transaction_date::text,printed_amount_cents::text,printed_counterparty,schedule_family,entry_extractor_version FROM cfb_finance_report_schedule_entries WHERE report_version_id='16891:24:pcc:YE:0:0' ORDER BY page_number,line_number LIMIT 301`;
export const BILLS=`SELECT b.id::text,b.identifier,b.session_id::text,b.originating_chamber_id::text AS chamber_id,s.slug AS session_slug FROM bills b JOIN legislative_sessions s ON s.id=b.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id JOIN chambers c ON c.id=b.originating_chamber_id WHERE j.slug='us-mn' AND c.slug='senate' AND ((s.slug='2023-2024' AND b.identifier='SF5337') OR (s.slug='2025-2026' AND b.identifier IN ('SF2149','SF2255','SF2669'))) ORDER BY b.id LIMIT 6`;
export const CONTEXT=`SELECT j.id::text AS jurisdiction_id,s.id::text AS session_id,c.id::text AS chamber_id FROM jurisdictions j JOIN legislative_sessions s ON s.jurisdiction_id=j.id JOIN chambers c ON c.jurisdiction_id=j.id WHERE j.slug='us-mn' AND s.slug='2021-2022' AND c.slug='senate' LIMIT 3`;
export const READ_QUERIES=[WRITE_DOCS,WRITE_EVENTS,WRITE_CHOICES,ROSTER,ALIASES,WRITE_MEDIA,WRITE_FINANCE,VERSIONS,WRITE_LINKS,CAPTURE,ENTRIES,BILLS,CONTEXT];
export async function privateSnapshot(db,proof){
 const bounded=async(sql,params,max)=>{const r=(await db.query(sql,params)).rows;if(r.length>=max)throw Error('Snapshot truncation');return r;};
 const params=[proof.documents.map(d=>d.sourceUrl),proof.documents.map(d=>d.originalRawPdfSha256)];
 const docs=await bounded(WRITE_DOCS,params,21),events=await bounded(WRITE_EVENTS,params,201),choices=await bounded(WRITE_CHOICES,params,2001);
 const people=await bounded(ROSTER,[],451),aliases=await bounded(ALIASES,[],2401);
 const roster=people.map(p=>({...p,aliases:aliases.filter(a=>a.membership_id===p.membership_id).map(a=>a.source_name)}));
 const media=await bounded(WRITE_MEDIA,[proof.media.pins.map(p=>p.sha256),MEDIA_FRAGMENTS.map(x=>'%'+x+'%')],1001);
 const finance=await bounded(WRITE_FINANCE,[],2001),versions=await bounded(VERSIONS,[],21),links=await bounded(WRITE_LINKS,[],101),capture=await bounded(CAPTURE,[],3),entries=await bounded(ENTRIES,[],301),bills=await bounded(BILLS,[],6),context=await bounded(CONTEXT,[],3);
 return {docs,events,choices,roster,media,finance,versions,links,capture,entries,bills,context};
}
export async function readOnly(pool,target,proof){
 const db=await pool.connect();try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');try{
  const w=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(w?.db!==target.database||w.role!==target.role||w.ro!=='on'||w.isolation!=='repeatable read')throw Error('Read-only identity mismatch');
  const ledger=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
  if(JSON.stringify(ledger)!==JSON.stringify((await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows))throw Error('Schema ledger mismatch');
  const snapshot=await privateSnapshot(db,proof),years=(await db.query(COMMITTEE_YEAR_SQL)).rows;
  if(years.length>5)throw Error('Year aggregate truncation');return {snapshot,years};
 }finally{await db.query('ROLLBACK')}}finally{db.release()}
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyPreserved(before,after){
 if(!same(before.finance,after.finance)||!same(before.versions,after.versions)||!same(before.capture,after.capture)||!same(before.docs,after.docs)||!same(before.roster,after.roster)||!same(before.bills,after.bills))throw Error('Immutable finance/source/identity state changed');
 for(const v of before.choices)if(!same(v,after.choices.find(x=>x.id===v.id)))throw Error('Pre-existing choice modified');
 for(const e of before.events){const a=after.events.find(x=>x.id===e.id);if(!a||a.external_key!==e.external_key||a.source_document_id!==e.source_document_id||a.session_id!==e.session_id||a.chamber_id!==e.chamber_id)throw Error('Original event identity changed');}
 for(const e of before.entries)if(!same(e,after.entries.find(x=>x.id===e.id)))throw Error('Pre-existing source entry changed');
}
export async function applyProduction(pool,proof,before){
 const plan=productionPlan(proof,before),counts={insertedEvents:plan.committee.add.length,insertedChoices:plan.committee.add.reduce((n,p)=>n+p.votes.length,0),updatedExistingEvents:plan.committee.update.length,insertedMedia:plan.media.filter(p=>!p.stored).length,insertedFinanceLinks:plan.finance.filter(p=>!p.stored).length};
 if(!Object.values(counts).some(x=>x))return counts;
 const db=await pool.connect();try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');try{
  await db.query('LOCK TABLE vote_events,member_votes,source_documents,evidence_items,memberships,membership_source_aliases,legislators,bills,legislative_sessions,chambers,jurisdictions,cfb_official_senate_pdf_versions,cfb_finance_pdf_body_captures,cfb_finance_report_schedule_captures,cfb_finance_report_schedule_pages,cfb_finance_report_schedule_entries,cfb_finance_report_transaction_links,cfb_finance_bulk_archive_row_observations IN SHARE ROW EXCLUSIVE MODE');
  if(state(await privateSnapshot(db,proof))!==state(before))throw Error('Concurrent state drift; rollback without retry');
  for(const p of plan.committee.update){const r=await db.query(`UPDATE vote_events SET bill_id=$2,vote_kind=$3,motion_text=$4,amendment_ref=$5,passed=$6,metadata=metadata||$7::jsonb WHERE id=$1 RETURNING id`,[p.existing.id,p.context.id,p.kind,p.m.literal,p.ref,p.m.passed,JSON.stringify({...p.meta,legacyMotionTextSha256:sha(p.existing.motion_text)})]);if(r.rows.length!==1)throw Error('Exact event update');}
  for(const p of plan.committee.add){const r=await db.query(SF1_INSERT_EVENT,[p.context.session_id,p.context.chamber_id,p.context.id,p.sourceId,p.key,p.kind,p.m.literal,p.ref,p.d.meetingDate,p.m.yea,p.m.nay,p.m.passed,JSON.stringify(p.meta)]);if(r.rows.length!==1)throw Error('Anchored event collision');for(const [i,v] of p.votes.entries()){const c=await db.query(SF1_INSERT_CHOICE,[r.rows[0].id,v.membershipId,v.sourceName,v.normalizedName,v.choice,i,JSON.stringify({...p.meta,sourceIdentity:'printed_full_header_historical_session_and_explicit_membership_bounds'})]);if(c.rows.length!==1)throw Error('Explicit choice collision');}}
  for(const p of plan.media.filter(p=>!p.stored)){
   if(before.context.length!==1)throw Error('Media jurisdiction/session context');const c=before.context[0];
   const source=await db.query(`INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,'wayback_local_trade_news',$4,$5,200,$6::jsonb) ON CONFLICT(source_url,content_sha256) DO NOTHING RETURNING id::text`,[c.jurisdiction_id,c.session_id,c.chamber_id,p.sourceUrl,p.pin.sha256,JSON.stringify(p.meta)]);
   let sourceId=source.rows[0]?.id;
   if(!sourceId){const old=(await db.query('SELECT id::text,metadata FROM source_documents WHERE source_url=$1 AND content_sha256=$2 LIMIT 2',[p.sourceUrl,p.pin.sha256])).rows;if(old.length!==1||Object.entries(p.meta).some(([k,v])=>!same(old[0].metadata[k],v)))throw Error('Media original collision');sourceId=old[0].id;}
   const r=await db.query(`INSERT INTO evidence_items(source_document_id,membership_id,evidence_kind,stance,claim,excerpt,published_at,source_quality,relevance,freshness,extraction_method,extraction_version,metadata) VALUES($1,$2,'direct_statement','neutral','Attributable printed interview fragment; no vote stance inferred.',$3,$4,'reputable_secondary','low','stale',$5,$5,$6::jsonb) RETURNING id`,[sourceId,p.person.membership_id,p.literal,p.pin.utc,VERSION,JSON.stringify({...p.meta,ingestionIdentityKey:p.key,durableIngestion:true})]);if(r.rows.length!==1)throw Error('Media append cardinality');
  }
  for(const p of plan.finance.filter(p=>!p.stored)){
   let id=p.entry?.id;if(!id){const e=await db.query(`INSERT INTO cfb_finance_report_schedule_entries(report_version_id,page_number,line_number,raw_schedule_line,printed_transaction_date,printed_amount_cents,printed_counterparty,schedule_family,entry_extractor_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(report_version_id,page_number,line_number) DO NOTHING RETURNING id::text`,[REPORT,p.row.page,p.row.line,p.row.rawBlock,p.row.date,p.row.cents,p.row.party,p.family,METHOD]);if(e.rows.length!==1)throw Error('Printed entry coordinate collision');id=e.rows[0].id;}
   const r=await db.query(`INSERT INTO cfb_finance_report_transaction_links(report_version_id,family,committee_registration,transaction_year,canonical_row_key,match_status,entry_id,possible_entry_count,matching_method) VALUES($1,$2,'16891',2024,$3,'exact',$4,1,$5) ON CONFLICT DO NOTHING RETURNING report_version_id`,[REPORT,p.family,p.key,id,METHOD]);if(r.rows.length!==1)throw Error('Mechanical link collision');
  }
  const after=await privateSnapshot(db,proof),replay=productionPlan(proof,after);verifyPreserved(before,after);
  if(replay.committee.add.length||replay.committee.update.length||replay.committee.verified.length!==19||replay.media.some(p=>!p.stored)||replay.finance.some(p=>!p.stored)||after.choices.length!==211)throw Error('In-transaction exact readback incomplete');
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e}}finally{db.release()}
 return counts;
}
async function main(){
 let phase='protected_main_gate',pool;
 try{
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(process.argv.length!==2||!event.head_commit.message.includes(MARKER))throw Error('Exact reviewed write marker required');
  phase='fresh_seven_original_authentication';const proof=await verifyThreeBoundedOriginals();
  phase='existing_primary_discovery';const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,statement_timeout:45000,query_timeout:50000,options:'-c lock_timeout=4000',application_name:VERSION});
  phase='verified_readonly_before';const before=await readOnly(pool,target,proof);
  phase='guarded_atomic_production';const counts=await applyProduction(pool,proof,before.snapshot);
  phase='independent_postcommit_readonly';const after=await readOnly(pool,target,proof),replay=productionPlan(proof,after.snapshot);verifyPreserved(before.snapshot,after.snapshot);
  if(replay.committee.add.length||replay.committee.update.length||replay.committee.verified.length!==19||after.snapshot.choices.length!==211||replay.media.some(p=>!p.stored)||replay.finance.some(p=>!p.stored))throw Error('Independent postcommit mismatch');
  const receipt=assertSafeThreeReceipt({schema:VERSION,reviewedCommit:e.GITHUB_SHA,verifiedAt:new Date().toISOString(),...counts,verifiedCommitteeRolls:19,verifiedCommitteeChoices:211,verifiedMediaFragments:3,mediaArticleCount:1,mediaPersonCount:1,mediaAuthenticatedCopies:2,earliestMediaObservation:'2022-10-05T01:59:37Z',verifiedFinanceLinks:25,financeContributionLinks:18,financeExpenditureLinks:7,financeFullPurposeHolds:3,financeHistoricalPublicBy:'UNKNOWN',financeEvidenceAndEligibilityUnchanged:true,oldCommitteeChoiceRowsAndEventKeysPreserved:true,idempotentReplayWouldWrite:0,verifiedRepeatableReadReadOnlyBeforeAfter:true,explicitRollbacks:true,schemaLedgerVerified:true,defaultPrimaryIdentityVerified:true,serializableLockedFingerprintVerified:true,hearingDateAvailability:true,sameDayEligible:false,sourceFixtureSha256:sha(readFileSync('tests/fixtures/senate-864-four-original-questions.json')),committeeYears:after.years,noFloorModelServingTrainingFreezeOrSchedulerChanges:true});
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-three-bounded-production.json',JSON.stringify(receipt,null,2)+'\n');console.log('SENATE864_THREE_BOUNDED_PRODUCTION_VERIFIED='+JSON.stringify(receipt));
 }catch(error){
  // Only our literal guard labels may be printed; never SQL errors or row data.
  const labels=new Set(['scripts/deploy-senate-864-three-bounded.mjs','src/evidence/senate-864-three-bounded-plan.mjs'].flatMap(f=>[...readFileSync(f,'utf8').matchAll(/throw Error\('([^']+)'\)/g)].map(m=>m[1])));
  console.error('SENATE864_THREE_BOUNDED_PRODUCTION_HOLD_AT='+phase+(labels.has(error?.message)?';guard='+error.message:''));process.exitCode=1;
 }finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/deploy-senate-864-three-bounded.mjs'))void main();
