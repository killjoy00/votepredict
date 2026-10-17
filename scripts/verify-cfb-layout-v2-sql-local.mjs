/** Ephemeral localhost PostgreSQL only. Synthetic v2 span rows always ROLLBACK. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {CFB_LAYOUT_SHADOW_VERSION} from '../src/evidence/cfb-report-schedule-layout-shadow-v2.mjs';
import {rawSpanSummary} from './backfill-cfb-layout-v2-cached-protected.mjs';

function disposable(){
 const raw=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
 if(!raw)throw Error('Disposable PostgreSQL required');
 const url=new URL(raw);
 if(!['localhost','127.0.0.1'].includes(url.hostname)
  ||url.pathname!=='/votepredict'
  ||!['postgres:','postgresql:'].includes(url.protocol)
  ||!['push','pull_request'].includes(process.env.GITHUB_EVENT_NAME??''))
  throw Error('V2 SQL fixture requires ephemeral localhost database');
 return raw;
}
async function main(){
 const pool=new Pool({connectionString:disposable(),max:1});
 const client=await pool.connect();
 let open=false;
 try{
  await client.query('BEGIN');open=true;
  const before=(await client.query([
   'SELECT',
   '(SELECT count(*)::int FROM evidence_items) AS evidence,',
   '(SELECT count(*)::int FROM cfb_finance_report_schedule_captures) AS v1_reports,',
   '(SELECT count(*)::int FROM cfb_finance_report_transaction_links) AS v1_links'
  ].join(' '))).rows[0];
  const bytes=Buffer.from('%PDF-'+'.'.repeat(800));
  const sha=createHash('sha256').update(bytes).digest('hex');
  const id='999996:25:pcc:YE:0:0';
  await client.query([
   'INSERT INTO cfb_official_senate_pdf_versions',
   '(report_version_id,committee_registration,report_year,official_viewer_url,',
   'full_original_pdf_sha256,full_original_pdf_bytes,statutory_release_floor_on,',
   'estimated_available_on,website_observed_on,dating_method,dating_confidence)',
   'VALUES ($1,$2,2025,$3,$4,$5,$6,$7,$8,$9,$10)'
  ].join(' '),[
   id,'999996','https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=25&type=pcc&period=YE&se=0&regnum=999996&amend=0',
   sha,bytes.length,'2025-01-01','2025-02-01','2025-03-01','source_fixture_official_hash','medium'
  ]);
  await client.query([
   'INSERT INTO cfb_finance_pdf_body_captures',
   '(pdf_sha256,byte_length,original_pdf,verified_from_url,fetched_at)',
   'VALUES($1,$2,$3,$4,now())'
  ].join(' '),[sha,bytes.length,bytes,
   'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=25&type=pcc&period=YE&se=0&regnum=999996&amend=0']);
  const page=['SCHEDULE A1 CONTRIBUTIONS','10/02/2025','Taylor Example','$250.00',
   '10/03/2025 Another Example $100.00 $50.00'].join('\n');
  await client.query([
   'INSERT INTO cfb_finance_report_schedule_captures',
   '(report_version_id,pdf_sha256,fetched_at,page_count,raw_schedule_text,extraction_status)',
   "VALUES($1,$2,now(),1,$3,'machine_readable')"
  ].join(' '),[id,sha,page]);
  const {candidates,stats,extraction_status}=rawSpanSummary([page],2025);
  assert.equal(candidates.length,2);
  assert.equal(stats.single_amount_name_spans,1);
  assert.equal(stats.multiple_amount_spans,1);
  for(let repeat=0;repeat<2;repeat++){
   await client.query([
    'INSERT INTO cfb_finance_report_v2_raw_captures',
    '(report_version_id,extractor_version,pdf_sha256,page_count,candidate_spans,',
    'single_amount_name_spans,multiple_amount_spans,insufficient_field_spans,',
    'multiline_spans,extraction_status)',
    'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING'
   ].join(' '),[
    id,CFB_LAYOUT_SHADOW_VERSION,sha,1,stats.candidate_spans,
    stats.single_amount_name_spans,stats.multiple_amount_spans,
    stats.insufficient_field_spans,stats.multiline_spans,extraction_status
   ]);
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
   ].join(' '),[id,CFB_LAYOUT_SHADOW_VERSION,JSON.stringify(payload)]);
  }
  const got=(await client.query([
   'SELECT readiness,printed_amount_cents,possible_amount_columns',
   'FROM cfb_finance_report_v2_raw_spans',
   'WHERE report_version_id=$1 ORDER BY first_line_number'
  ].join(' '),[id])).rows;
  assert.equal(got.length,2);
  assert.equal(got[0].readiness,'single_amount_name_visible');
  assert.equal(Number(got[0].printed_amount_cents),25000);
  assert.equal(got[1].readiness,'multiple_amount_columns');
  assert.equal(got[1].printed_amount_cents,null);
  const after=(await client.query([
   'SELECT',
   '(SELECT count(*)::int FROM evidence_items) AS evidence,',
   '(SELECT count(*)::int FROM cfb_finance_report_schedule_captures) AS v1_reports,',
   '(SELECT count(*)::int FROM cfb_finance_report_transaction_links) AS v1_links'
  ].join(' '))).rows[0];
  assert.equal(after.evidence,before.evidence);
  assert.equal(after.v1_reports,before.v1_reports+1);
  assert.equal(after.v1_links,before.v1_links);
  await client.query('ROLLBACK');open=false;
  console.log('CFB_LAYOUT_V2_APPEND_ONLY_LOCAL_ROLLBACK_SUCCESS');
 }finally{if(open)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();}
}
main().catch(()=>{console.error('CFB_LAYOUT_V2_LOCAL_FIXTURE_FAILED');process.exitCode=1;});
