/** Ephemeral localhost PostgreSQL only. Rolls back every synthetic provenance record. */
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
function disposable(){
 const value=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
 if(!value)throw Error('Disposable PostgreSQL URL required');
 const url=new URL(value);
 if(!['127.0.0.1','localhost'].includes(url.hostname)
   ||url.pathname!=='/votepredict'
   ||!['postgres:','postgresql:'].includes(url.protocol)
   ||!['pull_request','push'].includes(process.env.GITHUB_EVENT_NAME??''))
  throw Error('CFB SQL fixture may run only against ephemeral localhost PostgreSQL');
 return value;
}
async function main(){
 const pool=new Pool({connectionString:disposable(),max:1,connectionTimeoutMillis:5000});
 const client=await pool.connect();
 let begun=false;
 try{
  await client.query('BEGIN');begun=true;
  const before=(await client.query('SELECT count(*)::int AS n FROM evidence_items')).rows[0].n;
  const bytes=Buffer.from('%PDF-'+'.'.repeat(760));
  const sha=createHash('sha256').update(bytes).digest('hex');
  const versions=['999999:25:pcc:YE:0:0','999999:25:pcc:YE:0:1'];
  for(const [i,id] of versions.entries()){
   await client.query([
    'INSERT INTO cfb_official_senate_pdf_versions',
    '(report_version_id,committee_registration,report_year,official_viewer_url,',
    'full_original_pdf_sha256,full_original_pdf_bytes,statutory_release_floor_on,',
    'estimated_available_on,website_observed_on,dating_method,dating_confidence)',
    'VALUES($1,$2,2025,$3,$4,$5,$6,$7,$8,$9,$10)'
   ].join(' '),[
    id,'999999','https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=25&type=pcc&period=YE&se=0&regnum=999999&amend='+i,
    sha,bytes.length,'2025-01-01','2025-02-01','2025-03-01','source_fixture_official_hash','medium'
   ]);
  }
  await client.query([
   'INSERT INTO cfb_finance_pdf_body_captures',
   '(pdf_sha256,byte_length,original_pdf,verified_from_url,fetched_at)',
   'VALUES($1,$2,$3,$4,now())'
  ].join(' '),[sha,bytes.length,bytes,'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=25&type=pcc&period=YE&se=0&regnum=999999&amend=0']);
  await client.query(
   'INSERT INTO cfb_finance_report_schedule_pages(pdf_sha256,page_number,raw_page_text) VALUES($1,1,$2)',
   [sha,'SCHEDULE A1\n10/02/2025 Taylor Example $250.00']);

  // Exercise the production INSERT ... SELECT ... FROM jsonb_to_recordset
  // statements verbatim. PostgreSQL otherwise interprets bare ON after
  // SELECT/FROM ambiguously, which the earlier VALUES-only test missed.
  const duplicatePages=await client.query([
   'INSERT INTO cfb_finance_report_schedule_pages(pdf_sha256,page_number,raw_page_text)',
   'SELECT $1,x.page_number,x.raw_page_text FROM jsonb_to_recordset($2::jsonb)',
   'AS x(page_number integer,raw_page_text text) WHERE true ON CONFLICT DO NOTHING'
  ].join(' '),[sha,JSON.stringify([{page_number:1,raw_page_text:'SCHEDULE A1\\n10/02/2025 Taylor Example $250.00'}])]);
  if(duplicatePages.rowCount!==0)throw Error('Repeat source page must remain immutable');
  const ids=[];
  for(const id of versions){
   await client.query([
    'INSERT INTO cfb_finance_report_schedule_captures',
    '(report_version_id,pdf_sha256,fetched_at,page_count,raw_schedule_text,extraction_status)',
    "VALUES($1,$2,now(),1,$3,'machine_readable')"
   ].join(' '),[id,sha,'SCHEDULE A1\n10/02/2025 Taylor Example $250.00']);
   const r=await client.query([
    'INSERT INTO cfb_finance_report_schedule_entries',
    '(report_version_id,page_number,line_number,raw_schedule_line,printed_transaction_date,',
    'printed_amount_cents,printed_counterparty,schedule_family)',
    "VALUES($1,1,2,$2,'2025-10-02',25000,'Taylor Example','candidate_contribution')",
    'RETURNING id'
   ].join(' '),[id,'10/02/2025 Taylor Example $250.00']);
   ids.push(r.rows[0].id);
  }

  // Idempotent JSONB schedule entry replay must not insert duplicate rows.
  const existingEntry=await client.query([
   'INSERT INTO cfb_finance_report_schedule_entries',
   '(report_version_id,page_number,line_number,raw_schedule_line,printed_transaction_date,',
   'printed_amount_cents,printed_counterparty,schedule_family)',
   'SELECT $1,e.page_number,e.line_number,e.raw_schedule_line,',
   'e.printed_transaction_date::date,e.printed_amount_cents,e.printed_counterparty,',
   'e.schedule_family FROM jsonb_to_recordset($2::jsonb)',
   'AS e(page_number integer,line_number integer,raw_schedule_line text,',
   'printed_transaction_date text,printed_amount_cents bigint,',
   'printed_counterparty text,schedule_family text) WHERE true ON CONFLICT DO NOTHING'
  ].join(' '),[versions[0],JSON.stringify([{
   page_number:1,line_number:2,raw_schedule_line:'10/02/2025 Taylor Example $250.00',
   printed_transaction_date:'2025-10-02',printed_amount_cents:25000,
   printed_counterparty:'Taylor Example',schedule_family:'candidate_contribution'
  }])]);
  if(existingEntry.rowCount!==0)throw Error('Repeat extracted entry must remain immutable');
  const key='a'.repeat(64);
  for(let i=0;i<versions.length;i++){
   const insert=[
    'INSERT INTO cfb_finance_report_transaction_links',
    '(report_version_id,family,committee_registration,transaction_year,',
    'canonical_row_key,match_status,entry_id,possible_entry_count)',
    "VALUES($1,'candidate_contribution','999999',2025,$2,'exact',$3,1)",
    'ON CONFLICT DO NOTHING'
   ].join(' ');
   await client.query(insert,[versions[i],key,ids[i]]);
   await client.query(insert,[versions[i],key,ids[i]]);
  }

  // Distinct report versions may reference the same canonical key, while
  // exact JSONB replay must never create duplicate links.
  const duplicateLinks=await client.query([
   'INSERT INTO cfb_finance_report_transaction_links',
   '(report_version_id,family,committee_registration,transaction_year,canonical_row_key,',
   'match_status,entry_id,possible_entry_count)',
   'SELECT $1,x.family,x.reg,x.yr,x.row_key,x.status,',
   'x.line_id::bigint,x.candidate_count FROM jsonb_to_recordset($2::jsonb)',
   'AS x(family text,reg text,yr integer,row_key text,status text,',
   'line_id text,candidate_count integer) WHERE true ON CONFLICT DO NOTHING'
  ].join(' '),[versions[0],JSON.stringify([{
   family:'candidate_contribution',reg:'999999',yr:2025,row_key:key,
   status:'exact',line_id:String(ids[0]),candidate_count:1
  }])]);
  if(duplicateLinks.rowCount!==0)throw Error('Repeat canonical version link must be idempotent');
  const ambiguousKey='b'.repeat(64),unmatchedKey='c'.repeat(64);
  await client.query([
   'INSERT INTO cfb_finance_report_transaction_links',
   '(report_version_id,family,committee_registration,transaction_year,',
   'canonical_row_key,match_status,entry_id,possible_entry_count)',
   "VALUES($1,'candidate_contribution','999999',2025,$2,'ambiguous',NULL,2),",
   "($1,'candidate_contribution','999999',2025,$3,'unmatched',NULL,0)"
  ].join(' '),[versions[0],ambiguousKey,unmatchedKey]);
  const check=(await client.query([
   'SELECT count(*)::int AS observations,',
   "count(*) FILTER (WHERE match_status='exact')::int AS exact,",
   "count(*) FILTER (WHERE match_status='ambiguous')::int AS ambiguous,",
   "count(*) FILTER (WHERE match_status='unmatched')::int AS unmatched",
   'FROM cfb_finance_report_transaction_links',
   'WHERE committee_registration=$1'
  ].join(' '),['999999'])).rows[0];
  if(JSON.stringify(check)!==JSON.stringify({observations:4,exact:2,ambiguous:1,unmatched:1}))
   throw Error('Local SQL amendment/duplicate/ambiguity provenance fixture failed');
  await client.query('SAVEPOINT invalid_link');
  let blocked=false;
  try{
   await client.query([
    'INSERT INTO cfb_finance_report_transaction_links',
    '(report_version_id,family,committee_registration,transaction_year,',
    'canonical_row_key,match_status,entry_id,possible_entry_count)',
    "VALUES($1,'independent_expenditure','999999',2025,$2,'exact',$3,1)"
   ].join(' '),[versions[0],'d'.repeat(64),ids[0]]);
  }catch(e){blocked=e.code==='23514';}
  await client.query('ROLLBACK TO SAVEPOINT invalid_link');
  if(!blocked)throw Error('Independent expenditures were permitted to inherit candidate report');
  await client.query('SAVEPOINT cross_version');
  blocked=false;
  try{
   await client.query([
    'INSERT INTO cfb_finance_report_transaction_links',
    '(report_version_id,family,committee_registration,transaction_year,',
    'canonical_row_key,match_status,entry_id,possible_entry_count)',
    "VALUES($1,'candidate_contribution','999999',2025,$2,'exact',$3,1)"
   ].join(' '),[versions[0],'e'.repeat(64),ids[1]]);
  }catch(e){blocked=e.code==='23503';}
  await client.query('ROLLBACK TO SAVEPOINT cross_version');
  if(!blocked)throw Error('Cross-version schedule line FK did not block false report proof');
  const after=(await client.query('SELECT count(*)::int AS n FROM evidence_items')).rows[0].n;
  if(before!==after)throw Error('Existing finance/evidence rows changed during SQL fixture');
  await client.query('ROLLBACK');begun=false;
  console.log('CFB_RAW_SCHEDULE_LOCAL_SQL_ROLLBACK_FIXTURE_SUCCESS');
 }finally{
  if(begun)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
main().catch(()=>{
 console.error('CFB_RAW_SCHEDULE_LOCAL_SQL_ROLLBACK_FIXTURE_FAILED');
 process.exitCode=1;
});
