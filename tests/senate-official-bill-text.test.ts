import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import {
  captureOfficialRevisorHtml,discoverOfficialVersionLeads,extractLiteralAmendmentBlocks,
  isOfficialRevisorVersionUrl,
} from '../src/operations/senate-official-bill-text.js';

const root='https://www.revisor.mn.gov/bills/93/2023/0/HF/100/';
const official=String.raw`<h2>Bill Text Versions</h2><p>Engrossments</p>
<a href="/bills/93/2023/0/HF/100/versions/0/">Introduction</a>
<a href="/bills/93/2023/0/HF/100/versions/0/pdf/">PDF</a> | Posted on 01/04/2023 |
<a href="/bills/93/2023/0/HF/100/versions/12/">12th Engrossment</a> Posted on 05/20/2023 |
<h2>Unofficial Engrossments</h2>
<a href="/bills/93/2023/0/HF/100/versions/ue/1/">1st Unofficial Engrossment</a> Posted on 04/26/2023 |
<a href="/bills/93/2023/0/HF/100/versions/ue/2/">2nd Unofficial Engrossment</a> Posted on 04/28/2023 |
<h2>Conference Committee Reports</h2>
<a href="/bills/93/2023/0/HF/100/versions/ccr/0/">CCR-HF0100</a> Posted on 05/16/2023 |
<a href="/bills/93/2023/0/HF/100/versions/ccr/A/">CCR-HF0100A</a> Posted on 05/17/2023 |`;

test('discovers numeric, UE, numeric CCR and alphabetic CCR exactly as printed',()=>{
  const leads=discoverOfficialVersionLeads(official,root);
  assert.equal(leads.length,6);
  assert.deepEqual(leads.map(x=>x.family),[
    'numbered_version','numbered_version','unofficial_engrossment',
    'unofficial_engrossment','conference_report','conference_report']);
  assert.equal(leads[5].locator,'versions/ccr/A/');
  assert.equal(leads[5].printedLabel,'CCR-HF0100A');
  assert.equal(leads[3].postedOn,'2023-04-28');
  assert.equal(leads[0].postedOn,'2023-01-04');
  assert.equal(leads[0].sourceUrl,root+'versions/0/');
});
test('missing posted dates remain null, never borrowed from next version',()=>{
  const html='<h2>Bill Text Versions</h2>'
    +'<a href="versions/ue/1/">Unofficial</a>'
    +'<a href="versions/ccr/B/">CCR-HF0100B</a> Posted on 05/19/2023';
  const leads=discoverOfficialVersionLeads(html,root);
  assert.equal(leads.length,2);
  assert.equal(leads[0].postedOn,null);
  assert.equal(leads[1].postedOn,'2023-05-19');
});
test('rejects nonofficial, crossed-bill, PDF and manipulated URLs',()=>{
  assert.equal(isOfficialRevisorVersionUrl(root+'versions/ue/2/',root),true);
  assert.equal(isOfficialRevisorVersionUrl(root+'versions/ccr/A/',root),true);
  for(const url of [
    root+'versions/ue/2/pdf/',root+'versions/ccr/A/?download=1',
    'https://evil.example/bills/93/2023/0/HF/100/versions/0/',
    'https://www.revisor.mn.gov/bills/93/2023/0/HF/101/versions/0/',
  ]) assert.equal(isOfficialRevisorVersionUrl(url,root),false);
  assert.throws(()=>discoverOfficialVersionLeads(official,'http://www.revisor.mn.gov/bills/93/2023/0/HF/100/'));
});
test('document capture hashes independent original HTML bytes and full extracted text',()=>{
  const html='<html><main><div id="document"><p>Line 1</p><p>'
    +'A bill for an act relating to public programs; '.repeat(6)
    +'</p></div></main></html>';
  const raw=Buffer.from(html);
  const result=captureOfficialRevisorHtml(raw);
  assert.equal(result.originalBody,html);
  assert.equal(result.originalBodySha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(result.extractedTextSha256,
    createHash('sha256').update(result.rawText).digest('hex'));
  assert.ok(result.rawText.includes('A bill for an act'));
  assert.equal(result.originalByteLength,raw.length);
});
test('amendment text remains a proposed literal block, not an adopted state',()=>{
  const printed=String.raw`Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:
Page 89, line 19, delete "12 percent" and insert "20 percent".
Page 90, line 3, delete all words after the period and insert "Tax is imposed."
The question was taken on the adoption of the amendment.
YEAS - 27 NAYS - 37
Senator Hoffman moved to amend H.F. No. 100, as follows:
Page 33, line 1, delete "$4,000,000" and insert "$5,500,000".
Page 35, line 3, delete the remaining line and insert a new funding paragraph.
The motion prevailed. So the amendment was adopted.`;
  const blocks=extractLiteralAmendmentBlocks(printed);
  assert.equal(blocks.length,2);
  assert.equal(blocks[0].billIdentifier,'HF100');
  assert.equal(blocks[0].amendmentRef,null);
  assert.ok(blocks[0].rawText.includes('20 percent'));
  assert.ok(!blocks[0].rawText.includes('YEAS - 27'));
  assert.ok(!blocks[0].rawText.includes('The motion prevailed'));
  assert.ok(blocks[0].sourceLocator.startsWith('extracted-text:char:'));
  assert.notEqual(blocks[0].extractedTextSha256,blocks[1].extractedTextSha256);
});
test('does not generate amendment evidence from a bare motion summary',()=>{
  assert.deepEqual(extractLiteralAmendmentBlocks(
    'Senator Smith moved to amend S.F. No. 42. The motion prevailed.'),[]);
});
test('migration adds only new raw tables and candidate view in local Postgres',async(t)=>{
  const conn=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!conn){t.skip('integration Postgres not configured');return;}
  const db=new Client({connectionString:conn});
  await db.connect();
  try {
    const schema=await db.query<{name:string}>(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'"
      +" AND table_name LIKE 'senate_official_bill_text_%' ORDER BY table_name");
    assert.ok(schema.rows.some(x=>x.name==='senate_official_bill_text_captures'));
    assert.ok(schema.rows.some(x=>x.name==='senate_official_bill_text_queue'));
    assert.ok(schema.rows.some(x=>x.name==='senate_official_bill_text_record_links'));
    const v=await db.query("SELECT to_regclass('public.senate_raw_vote_official_bill_text_candidates') AS view");
    assert.ok(v.rows[0].view);
  }finally{await db.end();}
});

test('SQL archive preserves two conflicting official revisions and ignores identical replay',async(t)=>{
  const connectionString=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!connectionString){t.skip('integration Postgres not configured');return;}
  const db=new Client({connectionString});
  await db.connect();
  await db.query('BEGIN');
  try{
    const jurisdiction=(await db.query<{id:string}>(
      "INSERT INTO jurisdictions(slug,name,country_code) "
      +"VALUES('us-mn-official-text-test','Raw source integration fixture','US') RETURNING id")).rows[0].id;
    const session=(await db.query<{id:string}>(
      "INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2025-2026','Fixture') RETURNING id",
      [jurisdiction])).rows[0].id;
    const bill=(await db.query<{id:string}>(
      "INSERT INTO bills(session_id,identifier,title) VALUES($1,'SF42','Fixture') RETURNING id",
      [session])).rows[0].id;
    const first='Proposed original official numbered bill text, '.repeat(5);
    const second='Conflicting original official numbered bill text, '.repeat(5);
    const sql='INSERT INTO senate_official_bill_text_captures '
      +'(session_id,bill_id,family,source_url,source_locator,printed_label,raw_text,'
      +'original_body_sha256,body_hash_provenance,extracted_text_sha256,fetched_at) '
      +"VALUES($1,$2,'numbered_version',$3,'versions/0/','Introduction',$4,$5,'fetched_original_bytes',$6,now()) "
      +'ON CONFLICT(source_url,source_locator,original_body_sha256,extracted_text_sha256) DO NOTHING RETURNING id';
    const args=(original:string)=>[session,bill,
      'https://www.revisor.mn.gov/bills/94/2025/0/SF/42/versions/0/',
      original,createHash('sha256').update('<body>'+original+'</body>').digest('hex'),
      createHash('sha256').update(original).digest('hex')];
    assert.equal((await db.query(sql,args(first))).rowCount,1);
    assert.equal((await db.query(sql,args(first))).rowCount,0);
    assert.equal((await db.query(sql,args(second))).rowCount,1);
    const result=await db.query<{captures:number}>(
      'SELECT count(*)::int AS captures FROM senate_official_bill_text_captures WHERE bill_id=$1',[bill]);
    assert.equal(result.rows[0].captures,2);
    const live=await db.query<{live:number}>('SELECT count(*)::int AS live FROM bill_versions WHERE bill_id=$1',[bill]);
    assert.equal(live.rows[0].live,0);
  }finally{
    await db.query('ROLLBACK');
    await db.end();
  }
});
