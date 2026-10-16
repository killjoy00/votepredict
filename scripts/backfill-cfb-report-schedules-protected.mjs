/**
 * Protected GitHub-to-existing-Neon CFB raw schedule backfill.
 * Append-only report bodies, pages, schedule entries, and canonical provenance.
 * Does not change source_documents/evidence_items/publication/serving/forecasts.
 * No donor names, transactions, URLs, keys or DB credentials in public output.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {registry830} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {
 EXTRACTOR_VERSION,fetchVerifiedReportPdf,parseVerifiedPdfPages,
 extractScheduleEntries,classifyReportMatches,parseReportPeriod
} from '../src/evidence/cfb-report-schedule-raw.mjs';

export const DEPLOY_MARKER='SENATE_864_CFB_RAW_SCHEDULE_LINKS_V1';
const MIGRATION='0028_cfb_finance_report_schedule_provenance.sql';
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const txKey=x=>[x.family,x.reg,x.year,x.rowKey].join('|');
function sha(value){return createHash('sha256').update(value).digest('hex')}
function assertGuard(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||e.GITHUB_EVENT_NAME!=='push'
  ||e.GITHUB_REF!=='refs/heads/main'
  ||e.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
  ||e.VOTEPREDICT_CFB_SCHEDULE_KEYLESS_PASSED!=='true'
  ||e.VOTEPREDICT_CFB_SCHEDULE_MARKER!=='true')
  throw Error('Protected first-attempt reviewed main CFB source job required');
}
function migrationHashes(){
 return new Map(readdirSync('migrations').filter(s=>/^\d{4}_[\w-]+\.sql$/.test(s))
  .map(filename=>[filename,sha(readFileSync('migrations/'+filename))]));
}
async function ensureMigration(client){
 const expected=migrationHashes();
 if(!expected.has(MIGRATION))throw Error('Missing pinned CFB provenance migration');
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
 try{
  const rows=(await client.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows;
  if(rows.length<14||rows.length>100)throw Error('Migration ledger is outside recognized bounds');
  for(const row of rows){
   if(expected.get(row.filename)!==row.checksum)
    throw Error('Migration checksum mismatch or untracked existing migration');
  }
  if(!rows.some(x=>x.filename==='0014_cfb_official_senate_pdf_versions.sql'))
   throw Error('Official CFB registry prerequisite missing');
  if(!rows.some(x=>x.filename===MIGRATION)){
   await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
   await client.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
     [MIGRATION,expected.get(MIGRATION)]);
  }
  const registry=(await client.query('SELECT count(*)::int AS versions,count(DISTINCT full_original_pdf_sha256)::int AS bodies FROM cfb_official_senate_pdf_versions')).rows[0];
  if(registry?.versions!==830||registry?.bodies!==813)
   throw Error('830/813 authenticated CFB official registry not present');
  await client.query('COMMIT');
 }catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  throw error;
 }
}
const ROW_SQL=[
 'SELECT sd.id::text AS source_document_id,',
 'sd.content_sha256 AS source_sha256,sd.fetched_at::text AS source_fetched_at,',
 "ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS reg,",
 "ei.metadata->>'year' AS year,",
 "ei.metadata->>'transactionDate' AS transaction_date,",
 "ei.metadata->>'amount' AS amount,",
 "ei.metadata->>'contributor' AS contributor,",
 "ei.metadata->>'vendorName' AS vendor_name,",
 "ei.metadata->>'availabilityProof' AS availability_proof,",
 "ei.metadata->>'availabilityProofContentSha256' AS availability_sha,",
 "CASE WHEN ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "THEN 'candidate_contribution'",
 "WHEN ei.metadata->>'subtype'='candidate_expenditure_record'",
 "AND sd.source_kind IN ('campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')",
 "THEN 'candidate_expenditure' ELSE NULL END AS family",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk',",
 "'campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND ei.metadata->>'filerRegistrationNumber'=ANY($1::text[])",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'"
].join(' ');
async function loadCanonicalRows(client,records){
 const regs=[...new Set(records.map(x=>x.reg))];
 const raw=(await client.query(ROW_SQL,[regs])).rows;
 const unique=new Map(),byYear=new Map(),archive=[];
 const candidateFamilyCopies={candidate_contribution:0,candidate_expenditure:0};
 const candidateFamilyUnique={candidate_contribution:0,candidate_expenditure:0};
 let evidenceCopies=0;
 for(const r of raw){
  if(!['candidate_contribution','candidate_expenditure'].includes(r.family))continue;
  if(!/^202[1-5]$/.test(r.year)||!/^[0-9]{3,8}$/.test(r.reg))continue;
  evidenceCopies++;
  candidateFamilyCopies[r.family]++;
  const data={family:r.family,reg:r.reg,year:Number(r.year),rowKey:r.row_key,
   transactionDate:r.transaction_date,amount:Number(r.amount),
   contributor:r.contributor,vendorName:r.vendor_name};
  const key=txKey(data);
  const old=unique.get(key);
  if(old){
   if(JSON.stringify([old.transactionDate,old.amount,old.contributor,old.vendorName])
     !==JSON.stringify([data.transactionDate,data.amount,data.contributor,data.vendorName]))
    old.conflicting=true;
  }else unique.set(key,data);
  // An independently source-identified archive is a *separate* observation.
  // Never infer it from a PDF period, transaction date or receipt-date estimate.
  if(r.availability_proof==='independent_archive_capture_exact_row'
   &&r.availability_sha===r.source_sha256
   &&/^[a-f0-9]{64}$/.test(r.source_sha256??'')
   &&!Number.isNaN(Date.parse(r.source_fetched_at))){
    archive.push({family:r.family,committee_registration:r.reg,
     transaction_year:Number(r.year),canonical_row_key:r.row_key,
     source_document_id:r.source_document_id,source_sha256:r.source_sha256,
     independently_observed_at:r.source_fetched_at});
  }
 }
 for(const row of unique.values()){
  candidateFamilyUnique[row.family]++;
  const key=row.reg+'|'+row.year;
  if(!byYear.has(key))byYear.set(key,[]);
  byYear.get(key).push(row);
 }
 return {byYear,uniqueTransactions:unique.size,evidenceCopies,archive,
   candidateFamilyCopies,candidateFamilyUnique};
}
const BULK_ARCHIVE_SQL=[
 'INSERT INTO cfb_finance_bulk_archive_row_observations',
 '(family,committee_registration,transaction_year,canonical_row_key,source_document_id,',
 'source_sha256,independently_observed_at,proof_kind)',
 "SELECT x.family,x.reg,x.yr,x.key,x.source_id::uuid,x.sha,x.seen::timestamptz,",
 "'independent_archive_capture_exact_row' FROM jsonb_to_recordset($1::jsonb)",
 'AS x(family text,reg text,yr int,key text,source_id text,sha text,seen text)',
 'WHERE true ON CONFLICT DO NOTHING'
].join(' ');

async function existingPages(client,sha256){
 const result=await client.query(
  'SELECT page_number,raw_page_text FROM cfb_finance_report_schedule_pages WHERE pdf_sha256=$1 ORDER BY page_number',
  [sha256]);
 if(!result.rows.length)return null;
 for(let i=0;i<result.rows.length;i++)
  if(result.rows[i].page_number!==i+1)throw Error('Existing PDF page cache is not contiguous');
 return result.rows.map(x=>x.raw_page_text);
}
async function loadSourceBodyAndPages(client,record,sessionCache){
 if(sessionCache.has(record.sha))return sessionCache.get(record.sha);
 let original=await client.query(
  'SELECT original_pdf,byte_length,fetched_at::text AS fetched_at FROM cfb_finance_pdf_body_captures WHERE pdf_sha256=$1',
  [record.sha]);
 let bytes,fetchedAt,downloaded=false;
 if(original.rows.length){
  bytes=new Uint8Array(original.rows[0].original_pdf);
  fetchedAt=original.rows[0].fetched_at;
  if(bytes.length!==record.bytes||sha(bytes)!==record.sha)
   throw Error('Stored CFB whole-PDF cache SHA mismatch');
 }else{
  const fetched=await fetchVerifiedReportPdf(record);
  bytes=fetched.bytes;fetchedAt=fetched.fetchedAt;downloaded=true;
  // Cache verified bytes before parsing; unreadable bodies need not be fetched again.
  await client.query([
   'INSERT INTO cfb_finance_pdf_body_captures',
   '(pdf_sha256,byte_length,original_pdf,verified_from_url,fetched_at)',
   'VALUES($1,$2,$3,$4,$5::timestamptz) ON CONFLICT DO NOTHING'
  ].join(' '),[record.sha,record.bytes,Buffer.from(bytes),record.url,fetchedAt]);
 }
 const pages=await existingPages(client,record.sha)??await parseVerifiedPdfPages(bytes);
 const cached={bytes,pages,fetchedAt,downloaded};
 sessionCache.set(record.sha,cached);
 return cached;
}
function safeDateText(value){
 return typeof value==='string'&&/^20\d\d-\d\d-\d\d/.test(value)?value:null;
}
async function persistReport(client,record,source,canonicalRows){
 let transaction=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE');
  transaction=true;
  // Hash verified on first network acquisition and again when cache was read.
  await client.query([
   'INSERT INTO cfb_finance_pdf_body_captures',
   '(pdf_sha256,byte_length,original_pdf,verified_from_url,fetched_at)',
   'VALUES ($1,$2,$3,$4,$5::timestamptz) ON CONFLICT DO NOTHING'
  ].join(' '),[record.sha,record.bytes,Buffer.from(source.bytes),record.url,source.fetchedAt]);
  const pages=source.pages;
  const pagePayload=pages.map((raw_page_text,i)=>({page_number:i+1,raw_page_text}));
  await client.query([
   'INSERT INTO cfb_finance_report_schedule_pages(pdf_sha256,page_number,raw_page_text)',
   'SELECT $1,x.page_number,x.raw_page_text FROM jsonb_to_recordset($2::jsonb)',
   'AS x(page_number integer,raw_page_text text) WHERE true ON CONFLICT DO NOTHING'
  ].join(' '),[record.sha,JSON.stringify(pagePayload)]);
  const entries=extractScheduleEntries(pages,record.year);
  const readable=pages.some(s=>s.trim().length>100);
  const period=parseReportPeriod(pages);
  const status=!readable?'ocr_needed':entries.length?'machine_readable':'no_schedule_text';
  const designation=Number(record.id.split(':').at(-1))>0?'amended':'original';
  await client.query([
   'INSERT INTO cfb_finance_report_schedule_captures',
   '(report_version_id,pdf_sha256,fetched_at,extractor_version,page_count,',
   'raw_schedule_text,report_period_start,report_period_end,',
   'printed_report_designation,extraction_status)',
   'VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7::date,$8::date,$9,$10)',
   'ON CONFLICT DO NOTHING'
  ].join(' '),[
   record.id,record.sha,source.fetchedAt,EXTRACTOR_VERSION,pages.length,
   pages.map((text,i)=>'PAGE '+(i+1)+'\n'+text).join('\n\n'),
   period.start,period.end,designation,status
  ]);
  if(entries.length){
   await client.query([
    'INSERT INTO cfb_finance_report_schedule_entries',
    '(report_version_id,page_number,line_number,raw_schedule_line,',
    'printed_transaction_date,printed_amount_cents,printed_counterparty,schedule_family)',
    'SELECT $1,e.page_number,e.line_number,e.raw_schedule_line,',
    'e.printed_transaction_date::date,e.printed_amount_cents,e.printed_counterparty,',
    'e.schedule_family FROM jsonb_to_recordset($2::jsonb)',
    'AS e(page_number integer,line_number integer,raw_schedule_line text,',
    'printed_transaction_date text,printed_amount_cents bigint,',
    'printed_counterparty text,schedule_family text) WHERE true ON CONFLICT DO NOTHING'
   ].join(' '),[record.id,JSON.stringify(entries)]);
  }
  const storedEntries=(await client.query([
   'SELECT id,page_number,line_number,raw_schedule_line,',
   'printed_transaction_date::text,printed_amount_cents::text,schedule_family',
   'FROM cfb_finance_report_schedule_entries',
   'WHERE report_version_id=$1 ORDER BY page_number,line_number'
  ].join(' '),[record.id])).rows.map(x=>({...x,printed_amount_cents:Number(x.printed_amount_cents)}));
  const matches=classifyReportMatches(canonicalRows,storedEntries,record.year);
  const inputs=matches.map(m=>({
   family:m.family,reg:m.committee_registration,yr:m.transaction_year,
   row_key:m.canonical_row_key,status:m.match_status,
   line_id:m.entry_index===null?null:storedEntries[m.entry_index].id,
   candidate_count:m.possible_entry_count
  }));
  if(inputs.length){
   await client.query([
    'INSERT INTO cfb_finance_report_transaction_links',
    '(report_version_id,family,committee_registration,transaction_year,canonical_row_key,',
    'match_status,entry_id,possible_entry_count)',
    'SELECT $1,x.family,x.reg,x.yr,x.row_key,x.status,',
    'x.line_id::bigint,x.candidate_count FROM jsonb_to_recordset($2::jsonb)',
    'AS x(family text,reg text,yr integer,row_key text,status text,',
    'line_id text,candidate_count integer) WHERE true ON CONFLICT DO NOTHING'
   ].join(' '),[record.id,JSON.stringify(inputs)]);
  }
  await client.query('COMMIT');transaction=false;
  return {entries:storedEntries.length,exact:matches.filter(x=>x.match_status==='exact').length,
   ambiguous:matches.filter(x=>x.match_status==='ambiguous').length,
   unmatched:matches.filter(x=>x.match_status==='unmatched').length,status};
 }finally{
  if(transaction)await client.query('ROLLBACK').catch(()=>{});
 }
}
async function counts(client,baseline){
 // IE is a separate, non-candidate family. Census only: no attempt to
 // attribute spender/PAC activity to a candidate report.
 const ie=(await client.query([
  'SELECT count(*)::int AS copies,',
  "count(DISTINCT NULLIF(ei.metadata->>'rowKey',''))::int AS unique_keys",
  'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
  'LEFT JOIN memberships m ON m.id=ei.membership_id',
  'LEFT JOIN chambers c ON c.id=m.chamber_id',
  "WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'",
  "AND ei.metadata->>'subtype'='independent_expenditure_record'",
  "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
  "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))"
 ].join(' '))).rows[0];
 if(!safeInt(ie.copies)||!safeInt(ie.unique_keys))throw Error('IE census malformed');
 const rows=(await client.query([
  'SELECT',
  '(SELECT count(*)::int FROM cfb_finance_pdf_body_captures) AS unique_pdf_bodies,',
  '(SELECT count(*)::int FROM cfb_finance_report_schedule_captures) AS reports_with_extraction,',
  "(SELECT count(*)::int FROM cfb_finance_report_schedule_captures WHERE extraction_status='machine_readable') AS machine_readable_reports,",
  "(SELECT count(*)::int FROM cfb_finance_report_schedule_captures WHERE extraction_status='ocr_needed') AS ocr_backlog,",
  '(SELECT count(*)::int FROM cfb_finance_report_schedule_entries) AS schedule_lines,',
  "(SELECT count(*)::int FROM cfb_finance_report_transaction_links WHERE match_status='exact') AS exact_links,",
  "(SELECT count(DISTINCT (family,committee_registration,transaction_year,canonical_row_key))::int FROM cfb_finance_report_transaction_links WHERE match_status='exact') AS unique_linked_transactions,",
  "(SELECT count(*)::int FROM cfb_finance_report_transaction_links WHERE match_status='ambiguous') AS ambiguous_rows,",
  "(SELECT count(*)::int FROM cfb_finance_report_transaction_links WHERE match_status='unmatched') AS unmatched_report_row_pairs,",
  '(SELECT count(*)::int FROM cfb_finance_bulk_archive_row_observations) AS separate_archived_bulk_observations'
 ].join(' '))).rows[0];
 if(Object.values(rows).some(x=>!safeInt(x)))throw Error('Unsafe CFB aggregate');
 return {
  schema:'cfb-864-transaction-specific-raw-report-provenance-v1',
  officialRegisteredReportVersions:830,
  officialDistinctPdfHashes:813,
  evidenceCopies:baseline.evidenceCopies,
  uniqueCanonicalTransactions:baseline.uniqueTransactions,
  familyBreakdown:{
   candidate_contribution:{
    evidenceCopies:baseline.candidateFamilyCopies.candidate_contribution,
    uniqueTransactions:baseline.candidateFamilyUnique.candidate_contribution
   },
   candidate_expenditure:{
    evidenceCopies:baseline.candidateFamilyCopies.candidate_expenditure,
    uniqueTransactions:baseline.candidateFamilyUnique.candidate_expenditure
   },
   independent_expenditure:{
    evidenceCopies:ie.copies,uniqueTransactions:ie.unique_keys
   }
  },
  totalFinanceEvidenceCopies:baseline.evidenceCopies+ie.copies,
  totalUniqueFinanceTransactions:baseline.uniqueTransactions+ie.unique_keys,
  ...rows,
  reportBacklog:830-rows.reports_with_extraction,
  historicalEligibilityUnchanged:true,forecastsAndModelsUnchanged:true,
 };
}
export async function main(){
 assertGuard(process.env);
 const records=registry830();
 if(records.length!==830)throw Error('Authenticated official CFB PDF ledger missing');
 const batch=Number(process.env.VOTEPREDICT_CFB_SCHEDULE_BATCH_LIMIT??'830');
 if(!Number.isInteger(batch)||batch<1||batch>830)throw Error('Invalid bounded schedule batch size');
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:180000,
  application_name:'votepredict-cfb-864-raw-schedule-backfill',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'
 });
 const client=await pool.connect();
 try{
  const who=(await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
  )).rows[0];
  if(who?.db!==target.database||who?.role!==target.role||who?.ro!=='off')
   throw Error('Incorrect existing primary database identity');
  await ensureMigration(client);
  const already=(await client.query(
   'SELECT report_version_id FROM cfb_finance_report_schedule_captures'
  )).rows;
  const known=new Set(already.map(x=>x.report_version_id));
  const baseline=await loadCanonicalRows(client,records);
  const outstanding=records.filter(r=>!known.has(r.id));
  outstanding.sort((a,b)=>
   b.year-a.year
   ||Number(baseline.byYear.get(b.reg+'|'+b.year)?.length??0)
     -Number(baseline.byYear.get(a.reg+'|'+a.year)?.length??0)
   ||a.id.localeCompare(b.id));
  const sessionCache=new Map(),seenBodyHashes=new Set();
  let processed=0,failed=0,downloaded=0,reused=0;
  // Bounded retry. Failures remain backlog and never receive guessed provenance.
  for(const record of outstanding.slice(0,batch)){
   try{
    const source=await loadSourceBodyAndPages(client,record,sessionCache);
    if(source.downloaded&&!seenBodyHashes.has(record.sha))downloaded++;
    else reused++;
    seenBodyHashes.add(record.sha);
    await persistReport(client,record,source,baseline.byYear.get(record.reg+'|'+record.year)??[]);
    processed++;
   }catch(_error){
    failed++;
    // Do not emit a source URL, donor identity, source row or exception message.
    // A later reviewed main job retries any version missing a completed capture.
   }
  }
  // Treat independently archived exact *bulk* observations separately.
  // The SHA of a stored bulk source must agree with the explicit archive proof.
  if(baseline.archive.length){
   await client.query(BULK_ARCHIVE_SQL,[JSON.stringify(
    baseline.archive.map(x=>({
     family:x.family,reg:x.committee_registration,yr:x.transaction_year,
     key:x.canonical_row_key,source_id:x.source_document_id,
     sha:x.source_sha256,seen:safeDateText(x.independently_observed_at)
    })).filter(x=>x.seen)
   )]);
  }
  const result={...(await counts(client,baseline)),attemptedReports:Math.min(batch,outstanding.length),
   completedThisRun:processed,failedThisRun:failed,distinctBodiesDownloadedThisRun:downloaded,
   reusedBodyCapturesThisRun:reused};
  if(result.reports_with_extraction>830||result.reportBacklog<0||result.exact_links>3000000)
   throw Error('CFB provenance aggregate out of bounds');
  console.log('CFB_RAW_SCHEDULE_SAFE_COUNTS '+JSON.stringify(result));
  if(process.env.GITHUB_OUTPUT){
   const {appendFileSync}=await import('node:fs');
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_cfb_schedules_b64='+Buffer.from(JSON.stringify(result)).toString('base64')+'\n');
  }
  if(failed>0)process.exitCode=1;
 }finally{
  client.release(true);
  await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||process.argv[1]?.endsWith('/backfill-cfb-report-schedules-protected.mjs'))
 main().catch(()=>{
  console.error('CFB_RAW_SCHEDULE_BACKFILL_HELD_CHECK_PROTECTED_JOB');
  process.exitCode=1;
 });
