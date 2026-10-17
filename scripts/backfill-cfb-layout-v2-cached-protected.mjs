/**
 * Protected append-only v2 raw-span extraction of 830 previously cached CFB PDFs.
 * It never re-downloads documents or alters v1, canonical source/evidence rows,
 * model features, forecasts, publication dates, or eligibility.
 * A candidate span is NOT exact transaction-to-report provenance.
 * Only bounded integer counts and normalized SQLSTATE codes reach logs.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool} from 'pg';
import {registry830} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {CFB_LAYOUT_SHADOW_VERSION,extractLayoutShadowCandidates}
 from '../src/evidence/cfb-report-schedule-layout-shadow-v2.mjs';

const MIGRATION='0030_cfb_finance_report_v2_raw_spans.sql';
const MARKER='SENATE_864_CFB_LAYOUT_V2_APPEND_ONLY_V1';
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const hash=x=>createHash('sha256').update(x).digest('hex');
function assertGuard(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict' ||
  e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main' ||
  e.GITHUB_RUN_ATTEMPT!=='1'||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')) ||
  e.VOTEPREDICT_CFB_LAYOUT_V2_KEYLESS_PASSED!=='true' ||
  e.VOTEPREDICT_CFB_LAYOUT_V2_MARKER!=='true')
  throw Error('Reviewed first-attempt protected main source collection required');
}
async function ensureMigration(client){
 const expected=new Map(readdirSync('migrations')
  .filter(x=>/^\d{4}_[\w-]+\.sql$/.test(x))
  .map(x=>[x,hash(readFileSync('migrations/'+x))]));
 if(!expected.has(MIGRATION))throw Error('Pinned v2 additive migration missing');
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
 try{
  const rows=(await client.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows;
  if(rows.length<20||rows.length>100)throw Error('Unexpected checked-in schema ledger');
  for(const row of rows){
   if(expected.get(row.filename)!==row.checksum)
    throw Error('Existing schema migration checksum mismatch');
  }
  if(!rows.some(x=>x.filename==='0028_cfb_finance_report_schedule_provenance.sql'))
   throw Error('Original schedule provenance migration prerequisite missing');
  if(!rows.some(x=>x.filename===MIGRATION)){
   await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
   await client.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
    [MIGRATION,expected.get(MIGRATION)]);
  }
  const base=(await client.query([
   'SELECT',
   '(SELECT count(*)::int FROM cfb_finance_report_schedule_captures) AS versions,',
   '(SELECT count(DISTINCT pdf_sha256)::int FROM cfb_finance_pdf_body_captures) AS bodies'
  ].join(' '))).rows[0];
  if(base.versions!==830||base.bodies!==813)
   throw Error('830 original report v1 captures and 813 authentic bodies required');
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}
async function sourcePages(client,sha,cache){
 if(cache.has(sha))return cache.get(sha);
 const source=(await client.query([
  'SELECT page_number,raw_page_text',
  'FROM cfb_finance_report_schedule_pages WHERE pdf_sha256=$1',
  'ORDER BY page_number'
 ].join(' '),[sha])).rows;
 if(!source.length)throw Error('Verified PDF page text absent from existing cache');
 const pages=[];
 for(const row of source){
  if(row.page_number!==pages.length+1)throw Error('Noncontiguous cached original PDF page text');
  pages.push(row.raw_page_text);
 }
 cache.set(sha,pages);
 return pages;
}
export function rawSpanSummary(pages,reportYear){
 const candidates=extractLayoutShadowCandidates(pages,reportYear);
 if(candidates.length>1000000)throw Error('Excessive bounded raw span candidates');
 const result={
  candidate_spans:candidates.length,
  single_amount_name_spans:candidates.filter(x=>x.readiness==='single_amount_name_visible').length,
  multiple_amount_spans:candidates.filter(x=>x.readiness==='multiple_amount_columns').length,
  insufficient_field_spans:candidates.filter(x=>x.readiness==='insufficient_printed_fields').length,
  multiline_spans:candidates.filter(x=>x.reconstruction_method==='adjacent_page_lines').length
 };
 if(result.single_amount_name_spans+result.multiple_amount_spans+result.insufficient_field_spans!==result.candidate_spans)
  throw Error('Raw candidate classification invariant broken');
 for(const candidate of candidates){
  if(candidate.raw_span.length<1||candidate.raw_span.length>10000 ||
    candidate.possible_amount_columns>100)
   throw Error('Raw source line exceeds bounded v2 schema');
 }
 const hasText=pages.some(s=>String(s??'').trim().length>100);
 return {candidates,stats:result,
  extraction_status:result.candidate_spans?'candidate_spans_present':
   hasText?'no_candidate_spans':'no_readable_text'};
}
async function persistVersion(client,report,pages){
 const {candidates,stats,extraction_status}=rawSpanSummary(pages,report.report_year);
 let begun=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE');begun=true;
  await client.query([
   'INSERT INTO cfb_finance_report_v2_raw_captures',
   '(report_version_id,extractor_version,pdf_sha256,page_count,candidate_spans,',
   'single_amount_name_spans,multiple_amount_spans,insufficient_field_spans,',
   'multiline_spans,extraction_status)',
   'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING'
  ].join(' '),[report.report_version_id,CFB_LAYOUT_SHADOW_VERSION,
   report.pdf_sha256,pages.length,stats.candidate_spans,
   stats.single_amount_name_spans,stats.multiple_amount_spans,
   stats.insufficient_field_spans,stats.multiline_spans,extraction_status]);
  if(candidates.length){
   const payload=candidates.map(x=>({
    page:x.page_number,first:x.first_line_number,last:x.last_line_number,
    raw:x.raw_span,day:x.printed_transaction_date,amount:x.printed_amount_cents,
    columns:x.possible_amount_columns,family:x.schedule_family,
    method:x.reconstruction_method,readiness:x.readiness
   }));
   await client.query([
    'INSERT INTO cfb_finance_report_v2_raw_spans',
    '(report_version_id,extractor_version,page_number,first_line_number,',
    'last_line_number,raw_span,printed_transaction_date,printed_amount_cents,',
    'possible_amount_columns,schedule_family,reconstruction_method,readiness)',
    'SELECT $1,$2,x.page,x.first,x.last,x.raw,x.day::date,x.amount,',
    'x.columns,x.family,x.method,x.readiness FROM jsonb_to_recordset($3::jsonb)',
    'AS x(page integer,first integer,last integer,raw text,day text,amount bigint,',
    'columns integer,family text,method text,readiness text)',
    'WHERE true ON CONFLICT DO NOTHING'
   ].join(' '),[report.report_version_id,CFB_LAYOUT_SHADOW_VERSION,JSON.stringify(payload)]);
  }
  await client.query('COMMIT');begun=false;
  return stats;
 }finally{if(begun)await client.query('ROLLBACK').catch(()=>{});}
}
async function safeCounts(client){
 const row=(await client.query([
  'SELECT',
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_captures',
  "WHERE extractor_version='cfb-schedule-layout-shadow-v2') AS reports_with_v2,",
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_spans',
  "WHERE extractor_version='cfb-schedule-layout-shadow-v2') AS raw_candidate_spans,",
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_spans',
  "WHERE readiness='single_amount_name_visible') AS single_amount_name_spans,",
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_spans',
  "WHERE readiness='multiple_amount_columns') AS multiple_amount_spans,",
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_spans',
  "WHERE readiness='insufficient_printed_fields') AS insufficient_field_spans,",
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_spans',
  "WHERE reconstruction_method='adjacent_page_lines') AS multiline_spans,",
  '(SELECT count(*)::int FROM cfb_finance_report_v2_raw_captures',
  "WHERE extraction_status='no_readable_text') AS no_readable_text_reports"
 ].join(' '))).rows[0];
 if(Object.values(row).some(x=>!safeInt(x)))
  throw Error('Unexpected unbounded v2 readback');
 if(row.reports_with_v2>830||
  row.raw_candidate_spans!==row.single_amount_name_spans+
   row.multiple_amount_spans+row.insufficient_field_spans)
  throw Error('Unsafe v2 source count reconciliation');
 return {schema:'cfb-864-versioned-cached-pdf-candidate-spans-v2',
  officialRegisteredReportVersions:830,officialDistinctPdfHashes:813,
  ...row,reportBacklog:830-row.reports_with_v2,
  exactNewTransactionLinks:0,
  historicalEligibilityUnchanged:true,forecastsAndModelsUnchanged:true};
}
export async function main(){
 assertGuard(process.env);
 if(registry830().length!==830)throw Error('Pinned official source registry changed');
 const batch=Number(process.env.VOTEPREDICT_CFB_LAYOUT_V2_BATCH_LIMIT??'830');
 if(!Number.isInteger(batch)||batch<1||batch>830)
  throw Error('Invalid bounded v2 batch limit');
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:180000,
  application_name:'votepredict-cfb-864-versioned-layout-v2',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'});
 const client=await pool.connect();
 try{
  const who=(await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
  )).rows[0];
  if(who?.db!==target.database||who?.role!==target.role||who?.ro!=='off')
   throw Error('Unexpected existing primary database identity');
  await ensureMigration(client);
  const reports=(await client.query([
   'SELECT v.report_version_id,v.report_year,',
   'v.full_original_pdf_sha256 AS pdf_sha256',
   'FROM cfb_official_senate_pdf_versions v',
   'LEFT JOIN cfb_finance_report_v2_raw_captures c',
   "ON c.report_version_id=v.report_version_id AND c.extractor_version='cfb-schedule-layout-shadow-v2'",
   'WHERE c.report_version_id IS NULL',
   'ORDER BY v.report_year DESC,v.report_version_id'
  ].join(' '))).rows;
  const cache=new Map(),errorCategories=new Map();
  let processed=0,failed=0;
  for(const report of reports.slice(0,batch)){
   let phase='load';
   try{
    const pages=await sourcePages(client,report.pdf_sha256,cache);
    phase='extract_and_store';
    await persistVersion(client,report,pages);
    processed++;
   }catch(e){
    failed++;
    const code=typeof e?.code==='string'&&/^[A-Z0-9]{5}$/.test(e.code)?e.code:'non_sql';
    const key=phase+'_'+code;
    errorCategories.set(key,(errorCategories.get(key)??0)+1);
    if(processed===0&&failed>=5&&errorCategories.size===1)break;
   }
  }
  const output={...(await safeCounts(client)),attemptedReports:processed+failed,
   completedThisRun:processed,failedThisRun:failed,
   failureCategories:Object.fromEntries([...errorCategories].sort((a,b)=>a[0].localeCompare(b[0])))};
  console.log('CFB_864_LAYOUT_V2_SAFE_COUNTS '+JSON.stringify(output));
  if(failed)process.exitCode=1;
 }finally{client.release(true);await pool.end();}
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/backfill-cfb-layout-v2-cached-protected.mjs'))
 main().catch(()=>{console.error('CFB_864_LAYOUT_V2_HELD');process.exitCode=1;});
