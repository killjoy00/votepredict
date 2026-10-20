/** Evidence gathering only. Four original Minutes, one printed Q&A, one recipient/year.
 * Raw rows stay in runner memory; all database reads RR READ ONLY + ROLLBACK.
 */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {verifyThreeBoundedOriginals} from './verify-senate-864-three-bounded-originals.mjs';
import {sha,compareCommittee,compareMedia,compareFinance,assertSafeThreeReceipt} from '../src/evidence/senate-864-three-bounded-evidence.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
export const MARKER='SENATE864_THREE_BOUNDED_EVIDENCE_READONLY_V1';
export const DOCS=`SELECT sd.id::text,sd.source_url,sd.content_sha256 FROM source_documents sd WHERE sd.source_url=ANY($1::text[]) OR sd.content_sha256=ANY($2::text[]) ORDER BY sd.id LIMIT 21`;
export const EVENTS=`SELECT v.id::text,v.source_document_id::text,b.identifier AS bill_identifier,v.motion_text,v.vote_kind,v.amendment_ref,v.yea_count,v.nay_count,v.passed,v.is_passage FROM vote_events v JOIN source_documents sd ON sd.id=v.source_document_id LEFT JOIN bills b ON b.id=v.bill_id WHERE sd.source_url=ANY($1::text[]) OR sd.content_sha256=ANY($2::text[]) ORDER BY v.id LIMIT 201`;
export const CHOICES=`SELECT mv.vote_event_id::text,mv.membership_id::text,mv.choice FROM member_votes mv JOIN vote_events v ON v.id=mv.vote_event_id JOIN source_documents sd ON sd.id=v.source_document_id WHERE sd.source_url=ANY($1::text[]) OR sd.content_sha256=ANY($2::text[]) ORDER BY mv.vote_event_id,mv.id LIMIT 2001`;
export const ROSTER=`SELECT m.id::text AS membership_id,l.id::text AS legislator_id,s.slug AS session_slug,l.name,l.normalized_name,m.starts_on::text,m.ends_on::text FROM memberships m JOIN legislators l ON l.id=m.legislator_id JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id JOIN chambers c ON c.id=m.chamber_id WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026') ORDER BY m.id LIMIT 451`;
export const ALIASES=`SELECT a.membership_id::text,a.source_name FROM membership_source_aliases a JOIN memberships m ON m.id=a.membership_id JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id JOIN chambers c ON c.id=m.chamber_id WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026') ORDER BY a.membership_id,a.source_name LIMIT 2401`;
export const MEDIA=`SELECT ei.excerpt,ei.evidence_kind AS kind,ei.metadata,ei.published_at,sd.source_url,sd.content_sha256 AS source_sha,sd.metadata AS source_metadata,l.id::text AS person_id,l.name AS person_name,m.starts_on::text,m.ends_on::text FROM source_documents sd LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id LEFT JOIN memberships m ON m.id=ei.membership_id LEFT JOIN legislators l ON l.id=m.legislator_id WHERE sd.content_sha256=ANY($1::text[]) OR sd.source_url LIKE '%enterpriseminnesota.org/articles/winter-2021/valuable-legislative-support%' OR sd.metadata->>'originalUrl'='https://www.enterpriseminnesota.org/articles/winter-2021/valuable-legislative-support/' OR ei.metadata->>'seedId'='2021-miller-enterprise-manufacturing-qa' ORDER BY sd.id,ei.id LIMIT 1001`;
export const FINANCE=`SELECT ei.metadata,sd.content_sha256 AS source_sha FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id WHERE ei.metadata->>'filerRegistrationNumber'='16891' AND ei.metadata->>'year'='2024' AND ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record') AND sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk') ORDER BY ei.id LIMIT 2001`;
export const VERSIONS=`SELECT report_version_id,full_original_pdf_sha256,full_original_pdf_bytes,board_received_on::text,report_due_on::text,statutory_release_floor_on::text,estimated_available_on::text,website_observed_on::text,historical_exact_version_public_by_proven,(SELECT count(DISTINCT (o.family,o.canonical_row_key))::int FROM cfb_finance_bulk_archive_row_observations o WHERE o.committee_registration='16891' AND o.transaction_year=2024 AND o.independently_observed_at<TIMESTAMPTZ '2026-01-01T00:00:00Z') AS historical_bulk_canonical_proofs FROM cfb_official_senate_pdf_versions WHERE committee_registration='16891' AND report_year=2024 ORDER BY report_version_id LIMIT 21`;
export const LINKS=`SELECT canonical_row_key,match_status,possible_entry_count,matching_method FROM cfb_finance_report_transaction_links WHERE committee_registration='16891' AND transaction_year=2024 AND report_version_id='16891:24:pcc:YE:0:0' ORDER BY family,canonical_row_key LIMIT 2001`;
export const CAPTURE=`SELECT b.pdf_sha256,b.byte_length,encode(sha256(b.original_pdf),'hex') AS actual_sha,c.page_count,c.extraction_status,(SELECT count(*)::int FROM cfb_finance_report_schedule_pages p WHERE p.pdf_sha256=b.pdf_sha256) AS stored_pages FROM cfb_finance_pdf_body_captures b LEFT JOIN cfb_finance_report_schedule_captures c ON c.pdf_sha256=b.pdf_sha256 AND c.report_version_id='16891:24:pcc:YE:0:0' WHERE b.pdf_sha256='e5d5d82d46ec7ac2c573c0cc4158541e06d2846e16573d748c0d052f7648b0a3' LIMIT 3`;
export const QUERIES=[DOCS,EVENTS,CHOICES,ROSTER,ALIASES,MEDIA,FINANCE,VERSIONS,LINKS,CAPTURE];
export async function boundedSnapshot(client,proof,target){
 let snapshot;
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const who=(await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Unverified transaction identity');
  const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
  if(JSON.stringify(expected)!==JSON.stringify((await client.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows))throw Error('Schema ledger mismatch');
  const bounded=async(sql,params,max)=>{const rows=(await client.query(sql,params)).rows;if(rows.length>=max)throw Error('Truncated bounded snapshot');return rows;};
  const params=[proof.documents.map(d=>d.sourceUrl),proof.documents.map(d=>d.originalRawPdfSha256)];
  const docs=await bounded(DOCS,params,21),events=await bounded(EVENTS,params,201),choices=await bounded(CHOICES,params,2001),people=await bounded(ROSTER,[],451),aliases=await bounded(ALIASES,[],2401);
  const roster=people.map(p=>({...p,aliases:aliases.filter(a=>a.membership_id===p.membership_id).map(a=>a.source_name)}));
  const media=await bounded(MEDIA,[proof.media.pins.map(p=>p.sha256)],1001),finance=await bounded(FINANCE,[],2001),versions=await bounded(VERSIONS,[],21),links=await bounded(LINKS,[],2001),capture=await bounded(CAPTURE,[],3);
  const certifiedVersion=versions.length===1&&versions[0].report_version_id===proof.finance.report.id&&versions[0].full_original_pdf_sha256===proof.finance.report.sha&&versions[0].full_original_pdf_bytes===proof.finance.report.bytes;
  snapshot={committee:proof.documents.map(d=>compareCommittee(d,docs,events,choices,roster)),media:{selectedArticleStoredRows:media.filter(r=>r.kind).length,sourceHashMatchedStoredRows:media.filter(r=>proof.media.pins.some(p=>p.sha256===r.source_sha)).length,fragments:compareMedia(proof.media,media,roster),displayed2021PublicationNotAuthenticated:true,observationVersionsAreNotSeparateStatementEvents:true},finance:{recipientRegistration:'16891',reportYear:2024,registryVersions:versions.length,exactSourceVersionReadBack:certifiedVersion,rawBodyCaptureReadBack:capture.length===1&&capture[0].actual_sha===proof.finance.report.sha&&capture[0].byte_length===proof.finance.report.bytes,storedPages:capture[0]?.stored_pages??0,storedExactVersionHistoricalProofs:versions.filter(v=>v.historical_exact_version_public_by_proven===true).length,existingHistoricalBulkCanonicalProofs:versions[0]?.historical_bulk_canonical_proofs??0,sourceReportReceivedOn:proof.finance.report.received_on,statutoryReleaseFloorOn:proof.finance.report.release_floor,practicalEstimatedAvailableOn:proof.finance.report.estimated_on,historicalExactVersionPublicBy:'UNKNOWN',families:compareFinance(proof.finance.rows,finance,links),nonItemizedSummariesNotIndividualTransactions:true,nonCampaignItemizedRows:0,independentExpenditures:'outside_candidate_report_scope',containmentDoesNotEstablishHistoricalPublicBy:true}};
 }finally{await client.query('ROLLBACK')}
 return snapshot;
}
async function main(){
 let phase='reviewed_main_gate',pool;
 try{
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(process.argv.length!==2||!event.head_commit.message.includes(MARKER))throw Error('Exact reviewed main audit marker missing');
  phase='fresh_exact_seven_original_bodies';const proof=await verifyThreeBoundedOriginals();
  phase='existing_primary_discovery';const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,statement_timeout:45000,query_timeout:50000,options:'-c default_transaction_read_only=on -c lock_timeout=2500',application_name:'senate864-three-bounded-evidence-readonly'});
  phase='verified_rr_readonly_source_store_reconciliation';const db=await pool.connect();let result;try{result=await boundedSnapshot(db,proof,target)}finally{db.release(true)}
  const receipt=assertSafeThreeReceipt({schema:'senate864-three-bounded-evidence-readonly-v1',reviewedCommit:e.GITHUB_SHA,verifiedAt:new Date().toISOString(),...result,verifiedRepeatableReadReadOnly:true,explicitRollbackCompleted:true,schemaLedgerVerified:true,defaultPrimaryIdentityVerified:true,sourceFixtureSha256:sha(readFileSync('tests/fixtures/senate-864-four-original-questions.json')),noDatabaseWrites:true,noServingModelTrainingFreezeOrSchedulerChanges:true});
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-three-bounded-evidence.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('SENATE864_THREE_BOUNDED_EVIDENCE_READBACK='+JSON.stringify(receipt));
 }catch{console.error('SENATE864_THREE_BOUNDED_EVIDENCE_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/audit-senate-864-three-bounded-evidence.mjs'))void main();
