/**
 * #864 bounded read-only diagnostic of 40 already cached official Senate CFB PDFs.
 * Only public-safe aggregate integers are emitted. Never log source text, names,
 * amounts, report IDs, URLs, connection values, or PDF body fingerprints.
 * A form's readable text is not proof that its transaction schedules were parsed.
 */
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {extractScheduleEntries,parsePrintedAmounts,parsePrintedDates} from '../src/evidence/cfb-report-schedule-raw.mjs';
import {extractLayoutShadowCandidates} from '../src/evidence/cfb-report-schedule-layout-shadow-v2.mjs';

const MARKER='SENATE_864_CFB_LAYOUT_AUDIT_V1';
const STATUS=['machine_readable','no_schedule_text','ocr_needed'];
const YEARS=[2021,2022,2023,2024,2025];
const hash=x=>createHash('sha256').update(x).digest('hex');
function safeGuard(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
   ||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'
   ||e.GITHUB_RUN_ATTEMPT!=='1'||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
   ||e.VOTEPREDICT_CFB_LAYOUT_KEYLESS_PASSED!=='true'
   ||e.VOTEPREDICT_CFB_LAYOUT_MARKER!=='true')
  throw Error('Protected reviewed first-attempt main CFB layout audit required');
}
export function selectFortyReports(rows){
 // Five annual strata, then balance known parser outcomes per year.
 // SHA-deduplicate amendments with identical PDF bodies.
 const selected=[],seen=new Set();
 for(const year of YEARS){
  const available=rows.filter(x=>Number(x.report_year)===year)
    .sort((a,b)=>hash(a.report_version_id).localeCompare(hash(b.report_version_id)));
  const choose=(status,n)=>{
   for(const r of available){
    if(n===0)break;
    if(status&&r.extraction_status!==status)continue;
    if(seen.has(r.pdf_sha256))continue;
    selected.push(r);seen.add(r.pdf_sha256);n--;
   }
  };
  const before=selected.length;
  choose('machine_readable',4);
  choose('no_schedule_text',3);
  choose('ocr_needed',1);
  choose(null,8-(selected.length-before));
  if(selected.length-before!==8)throw Error('Insufficient independent PDF layouts in audit year');
 }
 if(selected.length!==40||seen.size!==40)throw Error('Expected 40 unique official PDF bodies');
 return selected;
}
const empty=()=>({
 reports:0,pages:0,nonempty_pages:0,lines:0,date_lines:0,amount_lines:0,
 single_date_amount_lines:0,multiple_amount_lines:0,date_only_lines:0,
 amount_only_lines:0,nearby_split_date_amount_lines:0,
 schedule_heading_lines:0,contribution_headings:0,expenditure_headings:0,
 extracted_v1_lines:0,source_text_characters:0,
 shadow_v2_candidates:0,shadow_v2_single_amount_with_name:0,
 shadow_v2_multiline_candidates:0,shadow_v2_multiple_amount_columns:0,
 shadow_v2_insufficient_fields:0
});
const add=(dst,src)=>{
 for(const key of Object.keys(dst))dst[key]+=src[key];
 return dst;
};
export function pageLayoutFeatures(pages,year){
 const result=empty();result.reports=1;result.pages=pages.length;
 for(const page of pages){
  const lines=String(page??'').replace(/\u0000/g,'').split(/\r?\n/);
  if(lines.some(x=>x.trim().length>0))result.nonempty_pages++;
  result.source_text_characters+=String(page??'').length;
  const local=[];
  for(const original of lines){
   const line=original.replace(/\s+/g,' ').trim();
   if(!line)continue;
   const dates=parsePrintedDates(line).filter(x=>{
    const y=Number(x.slice(0,4));return y>=2020&&y<=year+1;
   }).length;
   const amounts=parsePrintedAmounts(line).length;
   const heading=/\bSCHEDULE\s*[AB]\s*[0-9]?\b/i.test(line)
    ||/\b(?:ITEMIZED|CONTRIBUTIONS RECEIVED|EXPENDITURES MADE|DISBURSEMENTS PAID)\b/i.test(line);
   if(heading)result.schedule_heading_lines++;
   if(/\bSCHEDULE\s*A\s*[0-9]?\b/i.test(line))result.contribution_headings++;
   if(/\bSCHEDULE\s*B\s*[0-9]?\b/i.test(line))result.expenditure_headings++;
   local.push({dates,amounts});
   result.lines++;
   if(dates)result.date_lines++;
   if(amounts)result.amount_lines++;
   if(dates===1&&amounts===1)result.single_date_amount_lines++;
   if(amounts>1)result.multiple_amount_lines++;
   if(dates&&!amounts)result.date_only_lines++;
   if(amounts&&!dates)result.amount_only_lines++;
  }
  for(let i=0;i<local.length;i++){
   if(!local[i].dates||local[i].amounts)continue;
   if(local.slice(i+1,i+4).some(x=>x.amounts>0))result.nearby_split_date_amount_lines++;
  }
 }
 result.extracted_v1_lines=extractScheduleEntries(pages,year).length;
 const shadow=extractLayoutShadowCandidates(pages,year);
 result.shadow_v2_candidates=shadow.length;
 result.shadow_v2_single_amount_with_name=shadow.filter(x=>x.readiness==='single_amount_name_visible').length;
 result.shadow_v2_multiline_candidates=shadow.filter(x=>x.reconstruction_method==='adjacent_page_lines').length;
 result.shadow_v2_multiple_amount_columns=shadow.filter(x=>x.readiness==='multiple_amount_columns').length;
 result.shadow_v2_insufficient_fields=shadow.filter(x=>x.readiness==='insufficient_printed_fields').length;
 return result;
}
function safeSummary(selected,pagesBySha){
 const byYear=Object.fromEntries(YEARS.map(y=>[String(y),empty()]));
 const byStatus=Object.fromEntries(STATUS.map(s=>[s,empty()]));
 const totals=empty();
 for(const report of selected){
  const pages=pagesBySha.get(report.pdf_sha256);
  if(!pages||!pages.length)throw Error('Selected original report pages not cached');
  const part=pageLayoutFeatures(pages,Number(report.report_year));
  add(byYear[String(report.report_year)],part);
  add(byStatus[report.extraction_status],part);
  add(totals,part);
 }
 if(totals.reports!==40||Object.values(byYear).some(x=>x.reports!==8))
  throw Error('CFB layout audit sample selection invalid');
 return {schema:'cfb-864-40-original-pdf-layout-audit-v1',
  sampleReports:40,distinctBodyHashes:40,
  originalRegisteredVersions:830,originalDistinctBodies:813,
  ...totals,byYear,byExtractionStatus:byStatus,
  historicalEligibilityUnchanged:true,forecastsAndModelsUnchanged:true};
}
export async function main(){
 safeGuard(process.env);
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:15000,statement_timeout:180000,
  application_name:'votepredict-cfb-864-40-layout-audit',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'});
 const client=await pool.connect();
 let open=false;
 try{
  const who=(await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
  )).rows[0];
  if(who.db!==target.database||who.role!==target.role)
   throw Error('Incorrect existing primary database identity');
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');open=true;
  const all=(await client.query([
   'SELECT v.report_version_id,v.report_year,',
   'v.full_original_pdf_sha256 AS pdf_sha256,c.extraction_status',
   'FROM cfb_official_senate_pdf_versions v',
   'JOIN cfb_finance_report_schedule_captures c',
   'ON c.report_version_id=v.report_version_id',
   'WHERE v.report_year BETWEEN 2021 AND 2025'
  ].join(' '))).rows;
  if(all.length!==830||new Set(all.map(x=>x.pdf_sha256)).size!==813)
   throw Error('Exact 830/813 protected original corpus not available');
  const selected=selectFortyReports(all);
  const sha=selected.map(x=>x.pdf_sha256);
  const pageRows=(await client.query([
   'SELECT pdf_sha256,page_number,raw_page_text',
   'FROM cfb_finance_report_schedule_pages WHERE pdf_sha256=ANY($1::text[])',
   'ORDER BY pdf_sha256,page_number'
  ].join(' '),[sha])).rows;
  const pages=new Map();
  for(const p of pageRows){
   if(!pages.has(p.pdf_sha256))pages.set(p.pdf_sha256,[]);
   const dest=pages.get(p.pdf_sha256);
   if(p.page_number!==dest.length+1)throw Error('Noncontiguous cached PDF page data');
   dest.push(p.raw_page_text);
  }
  const report=safeSummary(selected,pages);
  await client.query('ROLLBACK');open=false;
  // Safe aggregates only. No donor text/URLs/keys/sha identifiers.
  console.log('CFB_864_LAYOUT_AUDIT_SAFE_COUNTS '+JSON.stringify(report));
 }finally{
  if(open)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
  process.argv[1]?.endsWith('/audit-cfb-40-report-layout-readonly.mjs'))
 main().catch(()=>{console.error('CFB_864_LAYOUT_AUDIT_HELD');process.exitCode=1;});
