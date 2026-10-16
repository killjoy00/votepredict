/**
 * Protected, resumable raw-only Minnesota Senate official bill-text backfill.
 * Uses existing Neon primary and preexisting bill/vote links; never writes
 * bill_versions, source_documents, vote_events, member_votes or serving tables.
 * On checked main merge and later scheduled main runs, collect bounded pages.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { buildRevisorBillCandidateUrls } from '../src/sources/minnesota/revisor.js';
import {
  captureOfficialRevisorHtml, discoverOfficialVersionLeads,
  extractLiteralAmendmentBlocks, isOfficialRevisorVersionUrl,
  type OfficialVersionLead,
} from '../src/operations/senate-official-bill-text.js';

const MARKER='SENATE_OFFICIAL_TEXT_RAW_20261016';
const MIGRATION='0027_senate_official_bill_text_raw.sql';
const REPO='killjoy00/votepredict';
const SESSIONS=['2025-2026','2023-2024','2021-2022'];
const MAX_NEW_BILLS=100, MAX_DISCOVER=100, MAX_VERSIONS=550, MAX_JOURNALS=30;
const MAX_HTTP_BYTES=8_000_000, RETRIES=3, TIMEOUT_MS=20000;
type Ledger={filename:string;checksum:string};
type Bill={bill_id:string;session_id:string;slug:string;identifier:string;attempts:number};
type Version={id:string;bill_id:string;session_id:string;family:'numbered_version'|'unofficial_engrossment'|'conference_report';
  printed_label:string;source_url:string;status_url:string;source_locator:string;posted_on:string|null;attempts:number};
type RawDocument={id:string;source_url:string;content_sha256:string;fetched_at:string;session_id:string;slug:string;
  raw:{sourceType?:unknown;sourceDate?:unknown;text?:unknown;records?:unknown}};
class Throttled extends Error { constructor(readonly status:number){super('official_revisor_throttled')} }
type HttpResponse={status:number;sourceUrl:string;body:Uint8Array|null;contentType:string|null};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');

function guard(e:NodeJS.ProcessEnv):void{
  if(process.argv.length!==2 || e.GITHUB_REPOSITORY!==REPO
    || e.GITHUB_REF!=='refs/heads/main' || e.GITHUB_RUN_ATTEMPT!=='1'
    || e.VOTEPREDICT_SENATE_TEXT_INDEPENDENT_CI!=='true'
    || !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
    throw Error('checked_main_gate_missing');
  if(e.GITHUB_EVENT_NAME==='schedule')return;
  if(e.GITHUB_EVENT_NAME!=='push' || !e.GITHUB_EVENT_PATH)
    throw Error('unsupported_production_trigger');
  const event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(event.ref!=='refs/heads/main'||event.repository?.full_name!==REPO
    ||event.after!==e.GITHUB_SHA||event.head_commit?.id!==e.GITHUB_SHA
    ||event.forced===true||event.deleted===true
    ||!event.head_commit?.message?.includes(MARKER))
    throw Error('reviewed_marker_main_push_required');
}
function expectedMigrations():Ledger[]{
  const files=readdirSync('migrations').filter(n=>/^\d{4}_[\w-]+\.sql$/.test(n)).sort();
  if(files[26]!==MIGRATION || !files[25]?.startsWith('0026_'))
    throw Error('migration_number_or_concurrent_inventory_changed');
  return files.map(filename=>({filename,checksum:digest(readFileSync('migrations/'+filename,'utf8'))}));
}
function positionOfMigration(expected:Ledger[]):number{
  const index=expected.findIndex(row=>row.filename===MIGRATION);
  if(index!==26)throw Error('official_text_migration_number_moved');
  return index;
}
function prefix(rows:Ledger[],expected:Ledger[]):boolean{
  positionOfMigration(expected);
  // Later agents may deploy later-numbered migrations before this PR merges.
  // Require all *other* reviewed main migrations to be already applied and
  // checksum-identical. The sole permitted gap is this collector's own 0027.
  const matches=(actual:Ledger[],want:Ledger[])=>actual.length===want.length
    &&actual.every((row,i)=>row.filename===want[i].filename&&row.checksum===want[i].checksum);
  if(matches(rows,expected))return true;
  if(matches(rows,expected.filter(row=>row.filename!==MIGRATION)))return false;
  throw Error('production_migration_checksum_drift_or_other_migration_pending');
}
async function readOnly<T>(db:PoolClient,fn:()=>Promise<T>):Promise<T>{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{return await fn();}
  finally{await db.query('ROLLBACK');}
}
async function preflight(db:PoolClient,identity:{database:string;role:string},expected:Ledger[]){
  return readOnly(db,async()=>{
    const id=(await db.query<{database:string;role:string;ro:string;ledger:string|null;votes:string|null;
      members:string|null;bills:string|null;versions:string|null;raw_links:string|null;companions:string|null}>(
      "SELECT current_database() AS database,current_user AS role,"
      +"current_setting('transaction_read_only') AS ro,"
      +"to_regclass('public.votepredict_schema_migrations')::text AS ledger,"
      +"to_regclass('public.vote_events')::text AS votes,"
      +"to_regclass('public.member_votes')::text AS members,"
      +"to_regclass('public.bills')::text AS bills,"
      +"to_regclass('public.bill_versions')::text AS versions,"
      +"to_regclass('public.senate_raw_vote_bill_mentions')::text AS raw_links,"
      +"to_regclass('public.bill_companions')::text AS companions")).rows[0];
    if(!id||id.database!==identity.database||id.role!==identity.role||id.ro!=='on'
      ||Object.entries(id).filter(([k])=>!['database','role','ro'].includes(k)).some(([,v])=>!v))
      throw Error('wrong_neon_primary_or_raw_prerequisites');
    const rows=(await db.query<Ledger>('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows;
    return prefix(rows,expected);
  });
}
async function migrate(db:PoolClient,expected:Ledger[]):Promise<boolean>{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try {
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-schema-migrations'))");
    const rows=(await db.query<Ledger>('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE')).rows;
    if(prefix(rows,expected)){await db.query('COMMIT');return false;}
    await db.query(readFileSync('migrations/'+MIGRATION,'utf8'));
    await db.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
      [MIGRATION,expected[positionOfMigration(expected)].checksum]);
    await db.query('COMMIT');return true;
  } catch(error){await db.query('ROLLBACK');throw error;}
}
async function getHttp(url:string,pacer:{wait:()=>Promise<void>}):Promise<HttpResponse>{
  await pacer.wait();
  let response:Response;
  try{
    response=await fetch(url,{headers:{'User-Agent':'VotePredict/2.0 official Senate raw bill text research',
      Accept:'text/html,application/xhtml+xml;q=0.9'},
      signal:AbortSignal.timeout(TIMEOUT_MS),cache:'no-store'});
  }catch{throw Error('official_fetch_network_failure');}
  if(response.status===429||response.status===503)throw new Throttled(response.status);
  const final=new URL(response.url||url);
  if(final.protocol!=='https:'||final.hostname!=='www.revisor.mn.gov'
    ||final.username||final.password)throw Error('official_fetch_redirected_off_site');
  if(response.status!==200)return {status:response.status,sourceUrl:final.toString(),body:null,contentType:null};
  const advertised=Number(response.headers.get('content-length'));
  if(advertised>MAX_HTTP_BYTES)throw Error('official_body_too_large');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<100||bytes.length>MAX_HTTP_BYTES)throw Error('official_body_size_invalid');
  return {status:200,sourceUrl:final.toString(),body:bytes,contentType:response.headers.get('content-type')};
}
async function stageBills(db:PoolClient):Promise<number>{
  // Strict preexisting vote-bill links. Companion expansion is bill association
  // only; no assertion of identical text or exact amendment-paper identity.
  const sql=[
    'WITH selected AS (',
    ' SELECT DISTINCT v.bill_id FROM senate_raw_vote_bill_mentions v WHERE v.bill_id IS NOT NULL',
    ' UNION SELECT c.house_bill_id FROM bill_companions c',
    ' JOIN senate_raw_vote_bill_mentions v ON v.bill_id=c.senate_bill_id',
    ' UNION SELECT c.senate_bill_id FROM bill_companions c',
    ' JOIN senate_raw_vote_bill_mentions v ON v.bill_id=c.house_bill_id',
    '), missing AS (',
    ' SELECT b.id AS bill_id,b.session_id,s.slug',
    ' FROM selected v JOIN bills b ON b.id=v.bill_id',
    ' JOIN legislative_sessions s ON s.id=b.session_id',
    " JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
    " WHERE s.slug=ANY($1::text[]) AND b.identifier ~* '^(HF|SF)[1-9][0-9]{0,5}$'",
    ' AND NOT EXISTS(SELECT 1 FROM senate_official_bill_text_discovery d WHERE d.bill_id=b.id)',
    ' ORDER BY s.slug DESC,b.id LIMIT $2',
    ') INSERT INTO senate_official_bill_text_discovery(bill_id,session_id)',
    ' SELECT bill_id,session_id FROM missing WHERE true ON CONFLICT (bill_id) DO NOTHING RETURNING bill_id'
  ].join('\n');
  const res=await db.query<{bill_id:string}>(sql,[SESSIONS,MAX_NEW_BILLS]);
  return res.rowCount??0;
}
async function nextDiscovery(db:PoolClient):Promise<Bill[]>{
  const r=await db.query<Bill>(
    "SELECT d.bill_id,d.session_id,s.slug,b.identifier,d.attempts "
    +"FROM senate_official_bill_text_discovery d JOIN bills b ON b.id=d.bill_id "
    +"JOIN legislative_sessions s ON s.id=d.session_id "
    +"WHERE d.attempts<$1 AND (d.status='pending' OR "
    +"(d.status='failed' AND d.checked_at<now()-interval '6 hours')) "
    +"ORDER BY s.slug DESC,d.attempts,b.identifier LIMIT $2",
    [RETRIES,MAX_DISCOVER]);
  return r.rows;
}
async function noteDiscovery(db:PoolClient,bill:Bill,status:'complete'|'failed'|'unavailable',
  sourceUrl:string,httpStatus:number|null,error:string|null,leads:OfficialVersionLead[]):Promise<void>{
  await db.query('BEGIN');
  try {
    if(status==='complete') for(const lead of leads){
      if(!isOfficialRevisorVersionUrl(lead.sourceUrl,sourceUrl))
        throw Error('discovered_version_not_in_source_bill');
      await db.query(
        'INSERT INTO senate_official_bill_text_queue'
        +' (bill_id,session_id,family,printed_label,source_url,status_url,source_locator,posted_on)'
        +' VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(bill_id,source_url) DO NOTHING',
        [bill.bill_id,bill.session_id,lead.family,lead.printedLabel,lead.sourceUrl,
          sourceUrl,lead.locator,lead.postedOn]);
    }
    await db.query(
      'UPDATE senate_official_bill_text_discovery SET status=$2,status_url=$3,checked_at=now(),'
      +'attempts=attempts+1,last_http_status=$4,last_error_kind=$5,versions_found=$6 WHERE bill_id=$1',
      [bill.bill_id,status,sourceUrl,httpStatus,error,leads.length]);
    await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}
}
async function discoverBill(db:PoolClient,bill:Bill,pacer:{wait:()=>Promise<void>}):Promise<'complete'|'failed'|'unavailable'>{
  const urls=buildRevisorBillCandidateUrls(bill.slug,bill.identifier);
  let lastHttp:number|null=null,lastUrl=urls[0],lastError:string|null=null;
  for(const url of urls){
    lastUrl=url;
    try{
      const got=await getHttp(url,pacer);
      lastHttp=got.status;lastUrl=got.sourceUrl;
      if(got.status===404)continue;
      if(got.status!==200){lastError='official_http_'+got.status;break;}
      const leads=discoverOfficialVersionLeads(Buffer.from(got.body!).toString('utf8'),got.sourceUrl);
      await noteDiscovery(db,bill,'complete',got.sourceUrl,200,null,leads);
      return 'complete';
    }catch(error){
      if(error instanceof Throttled)throw error;
      lastError=error instanceof Error?error.message.slice(0,90):'unknown';
      break;
    }
  }
  const status=lastHttp===404&&!lastError?'unavailable':'failed';
  await noteDiscovery(db,bill,status,lastUrl,lastHttp,lastError,[]);
  return status;
}
async function nextVersions(db:PoolClient):Promise<Version[]>{
  const r=await db.query<Version>(
    'SELECT q.id,q.bill_id,q.session_id,q.family,q.printed_label,q.source_url,q.status_url,'
    +'q.source_locator,q.posted_on::text,q.attempts FROM senate_official_bill_text_queue q '
    +'JOIN legislative_sessions s ON s.id=q.session_id '
    +"WHERE q.attempts<$1 AND (q.status='pending' OR "
    +"(q.status='failed' AND q.last_checked_at<now()-interval '6 hours')) "
    +"ORDER BY s.slug DESC,CASE q.family WHEN 'unofficial_engrossment' THEN 0 "
    +"WHEN 'conference_report' THEN 1 ELSE 2 END,q.id LIMIT $2",
    [RETRIES,MAX_VERSIONS]);
  return r.rows;
}
async function markVersion(db:PoolClient,q:Version,status:'failed'|'unavailable',httpStatus:number|null,kind:string):Promise<void>{
  await db.query('UPDATE senate_official_bill_text_queue '
    +'SET status=$2,attempts=attempts+1,last_checked_at=now(),last_http_status=$3,last_error_kind=$4 '
    +'WHERE id=$1',[q.id,status,httpStatus,kind]);
}
async function captureVersion(db:PoolClient,q:Version,got:HttpResponse):Promise<{created:boolean;legacyMatched:boolean}>{
  if(!got.body||!isOfficialRevisorVersionUrl(q.source_url,q.status_url)
    ||got.sourceUrl!==q.source_url)throw Error('version_url_redirect_or_source_mismatch');
  const parsed=captureOfficialRevisorHtml(got.body);
  await db.query('BEGIN');
  try{
    const result=await db.query<{id:string}>(
      'INSERT INTO senate_official_bill_text_captures'
      +' (queue_id,session_id,bill_id,family,source_url,status_url,source_locator,printed_label,'
      +'original_body,raw_text,original_body_sha256,body_hash_provenance,extracted_text_sha256,'
      +'original_byte_length,content_type,fetched_at,posted_on,http_status)'
      +" VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'fetched_original_bytes',$12,$13,$14,now(),$15,200)"
      +' ON CONFLICT(source_url,source_locator,original_body_sha256,extracted_text_sha256)'
      +' DO NOTHING RETURNING id',
      [q.id,q.session_id,q.bill_id,q.family,q.source_url,q.status_url,q.source_locator,q.printed_label,
       parsed.originalBody,parsed.rawText,parsed.originalBodySha256,parsed.extractedTextSha256,
       parsed.originalByteLength,got.contentType,q.posted_on]);
    const old=await db.query<{id:string}>(
      'SELECT id FROM bill_versions WHERE bill_id=$1 AND version_key=$2 AND text_hash=$3 LIMIT 1',
      [q.bill_id,q.printed_label,parsed.extractedTextSha256]);
    await db.query("UPDATE senate_official_bill_text_queue SET status='complete',"
      +'attempts=attempts+1,last_checked_at=now(),last_http_status=200,last_error_kind=NULL WHERE id=$1',[q.id]);
    await db.query('COMMIT');
    return {created:result.rows.length>0,legacyMatched:old.rows.length>0};
  }catch(error){await db.query('ROLLBACK');throw error;}
}
async function fetchVersion(db:PoolClient,q:Version,pacer:{wait:()=>Promise<void>}){
  try{
    if(!isOfficialRevisorVersionUrl(q.source_url,q.status_url))throw Error('invalid_queued_official_url');
    const got=await getHttp(q.source_url,pacer);
    if(got.status===404){
      await markVersion(db,q,'unavailable',404,'official_404');
      return {status:'unavailable' as const,created:false,legacyMatched:false};
    }
    if(got.status!==200){
      await markVersion(db,q,'failed',got.status,'official_http_'+got.status);
      return {status:'failed' as const,created:false,legacyMatched:false};
    }
    const captured=await captureVersion(db,q,got);
    return {status:'complete' as const,...captured};
  }catch(error){
    if(error instanceof Throttled)throw error;
    // Exact failed queue row, no accidental amendment or version selection.
    await markVersion(db,q,'failed',null,
      error instanceof Error?error.message.slice(0,90):'unknown');
    return {status:'failed' as const,created:false,legacyMatched:false};
  }
}
async function nextDocuments(db:PoolClient):Promise<RawDocument[]>{
  const r=await db.query<RawDocument>(
    'SELECT d.id,d.source_url,d.content_sha256,d.fetched_at,d.session_id,s.slug,'
    +"d.metadata->'rawPrepassageVotes' AS raw "
    +'FROM source_documents d JOIN legislative_sessions s ON s.id=d.session_id '
    +"JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "
    +'LEFT JOIN senate_official_bill_text_journal_scans scanned ON scanned.source_document_id=d.id '
    +"WHERE s.slug=ANY($1::text[]) AND d.metadata->'rawPrepassageVotes'->>'sourceType' "
    +"IN ('mn_senate_journal','mn_senate_committee_minutes_html') "
    +'AND (scanned.source_document_id IS NULL OR '
    +"(scanned.status='failed' AND scanned.scanned_at<now()-interval '6 hours' AND scanned.attempts<3)) "
    +'AND EXISTS (SELECT 1 FROM senate_raw_vote_bill_mentions m '
    +'WHERE m.source_document_id=d.id AND m.bill_id IS NOT NULL) '
    +'ORDER BY s.slug DESC,d.fetched_at,d.id LIMIT $2',[SESSIONS,MAX_JOURNALS]);
  return r.rows;
}
function normBill(bill:string):string|null{
  const m=bill.match(/^(HF|SF)0*(\d+)$/i);
  return m?m[1].toUpperCase()+Number(m[2]):null;
}
async function scanDocument(db:PoolClient,d:RawDocument):Promise<{found:number;links:number;unresolved:number}>{
  const extracted=typeof d.raw?.text==='string'?d.raw.text:'';
  if(!/^[0-9a-f]{64}$/i.test(d.content_sha256)
    || d.content_sha256.toLowerCase()==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    || extracted.length<50)
    throw Error('raw_document_text_or_fingerprint_missing');
  const links=await db.query<{bill_id:string;identifier:string;record_ordinal:number}>(
    'SELECT m.bill_id,b.identifier,m.record_ordinal FROM senate_raw_vote_bill_mentions m '
    +'JOIN bills b ON b.id=m.bill_id WHERE m.source_document_id=$1 AND m.bill_id IS NOT NULL',[d.id]);
  const idByBill=new Map<string,string>();
  for(const row of links.rows){const normalized=normBill(row.identifier);if(normalized)idByBill.set(normalized,row.bill_id);}
  const snippets=extractLiteralAmendmentBlocks(extracted)
    .filter(x=>idByBill.has(x.billIdentifier));
  const records=Array.isArray(d.raw.records)?d.raw.records:[] as unknown[];
  let exactLinks=0;
  await db.query('BEGIN');
  try{
    for(const snippet of snippets){
      const billId=idByBill.get(snippet.billIdentifier)!;
      const capture=await db.query<{id:string}>(
        'INSERT INTO senate_official_bill_text_captures'
        +' (session_id,bill_id,source_document_id,family,source_url,source_locator,printed_label,raw_text,'
        +'original_body_sha256,body_hash_provenance,extracted_text_sha256,fetched_at,proceeding_on)'
        +" VALUES($1,$2,$3,'amendment',$4,$5,$6,$7,$8,'existing_source_document_fingerprint',$9,$10,$11)"
        +' ON CONFLICT(source_url,source_locator,original_body_sha256,extracted_text_sha256) '
        +'DO NOTHING RETURNING id',
        [d.session_id,billId,d.id,d.source_url,snippet.sourceLocator,snippet.printedLabel,
        snippet.rawText,d.content_sha256,snippet.extractedTextSha256,d.fetched_at,
        typeof d.raw.sourceDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.raw.sourceDate)
          ? d.raw.sourceDate:null]);
      const receiptId=capture.rows[0]?.id ?? (await db.query<{id:string}>(
        'SELECT id FROM senate_official_bill_text_captures WHERE source_url=$1 AND source_locator=$2 '
        +'AND original_body_sha256=$3 AND extracted_text_sha256=$4',
        [d.source_url,snippet.sourceLocator,d.content_sha256,snippet.extractedTextSha256])).rows[0]?.id;
      if(!receiptId)throw Error('amendment_capture_receipt_not_found');
      // Strict A-number match plus preexisting linked record ordinal. No
      // same-bill, nearby-position or companion inference for unnumbered motions.
      if(!snippet.amendmentRef)continue;
      const candidates=records.filter((record):record is Record<string,unknown>=>
        Boolean(record)&&typeof record==='object'&&!Array.isArray(record)
        && record.voteKind==='amendment'
        && normBill(String(record.billIdentifier??''))===snippet.billIdentifier
        && String(record.amendmentRef??'').toUpperCase()===snippet.amendmentRef);
      const target=candidates.length===1?candidates[0]:null;
      const ordinal=typeof target?.ordinal==='number'?target.ordinal:null;
      if(ordinal===null||!links.rows.some(row=>row.record_ordinal===ordinal&&row.bill_id===billId))continue;
      const written=await db.query(
        'INSERT INTO senate_official_bill_text_record_links'
        +' (source_document_id,record_ordinal,capture_id,relation,source_locator)'
        +" VALUES($1,$2,$3,'literal_amendment_reference',$4) ON CONFLICT DO NOTHING",
        [d.id,ordinal,receiptId,snippet.sourceLocator]);
      exactLinks+=written.rowCount??0;
    }
    await db.query(
      'INSERT INTO senate_official_bill_text_journal_scans'
      +' (source_document_id,scanned_at,status,snippets_found,exact_record_links,unresolved_snippets,attempts)'
      +" VALUES($1,now(),$2,$3,$4,$5,1) ON CONFLICT(source_document_id) DO UPDATE "
      +'SET scanned_at=EXCLUDED.scanned_at,status=EXCLUDED.status,attempts=senate_official_bill_text_journal_scans.attempts+1,'
      +'snippets_found=EXCLUDED.snippets_found,exact_record_links=EXCLUDED.exact_record_links,'
      +'unresolved_snippets=EXCLUDED.unresolved_snippets,failure_kind=NULL',
      [d.id,snippets.length?'extracted':'none',snippets.length,exactLinks,snippets.length-exactLinks]);
    await db.query('COMMIT');
    return {found:snippets.length,links:exactLinks,unresolved:snippets.length-exactLinks};
  }catch(error){await db.query('ROLLBACK');throw error;}
}
async function noteDocumentFailure(db:PoolClient,sourceId:string){
  await db.query(
    'INSERT INTO senate_official_bill_text_journal_scans'
    +" (source_document_id,scanned_at,status,snippets_found,exact_record_links,unresolved_snippets,failure_kind)"
    +" VALUES($1,now(),'failed',0,0,0,'extract_or_store_failed')"
    +' ON CONFLICT(source_document_id) DO UPDATE SET scanned_at=now(),attempts=senate_official_bill_text_journal_scans.attempts+1,'
    +"status='failed',failure_kind='extract_or_store_failed'",[sourceId]);
}
async function report(db:PoolClient){
  return readOnly(db,async()=>{
    const families=(await db.query(
      'SELECT s.slug AS session,c.family,count(*)::int AS captures,'
      +'count(DISTINCT c.bill_id)::int AS bills_with_text,'
      +'coalesce(sum(length(c.raw_text)),0)::bigint::text AS text_characters,'
      +'count(*) FILTER(WHERE c.source_document_id IS NOT NULL)::int AS embedded_amendments '
      +'FROM senate_official_bill_text_captures c JOIN legislative_sessions s ON s.id=c.session_id '
      +'GROUP BY s.slug,c.family ORDER BY s.slug DESC,c.family')).rows;
    const queue=(await db.query(
      'SELECT s.slug AS session,q.family,q.status,count(*)::int AS count '
      +'FROM senate_official_bill_text_queue q JOIN legislative_sessions s ON s.id=q.session_id '
      +'GROUP BY s.slug,q.family,q.status ORDER BY s.slug DESC,q.family,q.status')).rows;
    const discovery=(await db.query(
      'SELECT s.slug AS session,d.status,count(*)::int AS count '
      +'FROM senate_official_bill_text_discovery d JOIN legislative_sessions s ON s.id=d.session_id '
      +'GROUP BY s.slug,d.status ORDER BY s.slug DESC,d.status')).rows;
    // Error rollups are first-party operational receipts. Report categories only:
    // never emit bill titles, HTML bodies, URLs, SQL parameters or secrets.
    const discoveryFailureKinds=(await db.query(
      'SELECT s.slug AS session,coalesce(d.last_http_status::text,\'none\') AS http_status,'
      +"coalesce(nullif(d.last_error_kind,''),'none') AS error_kind,count(*)::int AS count "
      +'FROM senate_official_bill_text_discovery d JOIN legislative_sessions s ON s.id=d.session_id '
      +"WHERE d.status='failed' GROUP BY s.slug,d.last_http_status,d.last_error_kind "
      +'ORDER BY count(*) DESC,s.slug LIMIT 25')).rows;
    const journals=(await db.query(
      'SELECT s.slug AS session,j.status,count(*)::int AS documents,'
      +'coalesce(sum(j.snippets_found),0)::int AS snippets,'
      +'coalesce(sum(j.exact_record_links),0)::int AS exact_record_links,'
      +'coalesce(sum(j.unresolved_snippets),0)::int AS unresolved '
      +'FROM senate_official_bill_text_journal_scans j '
      +'JOIN source_documents d ON d.id=j.source_document_id '
      +'JOIN legislative_sessions s ON s.id=d.session_id '
      +'GROUP BY s.slug,j.status ORDER BY s.slug DESC,j.status')).rows;
    const outstanding=(await db.query(
      "SELECT (SELECT count(*)::int FROM senate_official_bill_text_discovery WHERE status='pending') AS pending_discovery,"
      +"(SELECT count(*)::int FROM senate_official_bill_text_queue WHERE status='pending') AS pending_versions,"
      +"(SELECT count(*)::int FROM senate_official_bill_text_queue WHERE status='failed') AS failed_versions,"
      +"(SELECT count(*)::int FROM senate_official_bill_text_queue WHERE status='unavailable') AS unavailable_versions,"
      +"(SELECT count(*)::int FROM senate_official_bill_text_discovery WHERE status='failed') AS failed_discovery,"
      +"(SELECT count(*)::int FROM senate_official_bill_text_discovery WHERE status='unavailable') AS unavailable_discovery,"
      +'(SELECT count(*)::int FROM senate_official_bill_text_record_links) AS exact_amendment_links')).rows[0];
    const eligible=(await db.query([
      'WITH bill_ids AS (',
      ' SELECT DISTINCT m.bill_id FROM senate_raw_vote_bill_mentions m WHERE m.bill_id IS NOT NULL',
      ' UNION SELECT c.house_bill_id FROM bill_companions c JOIN senate_raw_vote_bill_mentions m ON m.bill_id=c.senate_bill_id',
      ' UNION SELECT c.senate_bill_id FROM bill_companions c JOIN senate_raw_vote_bill_mentions m ON m.bill_id=c.house_bill_id',
      ') SELECT s.slug AS session,count(*)::int AS eligible_bills,',
      "count(*) FILTER(WHERE disc.bill_id IS NULL)::int AS unstaged_bills",
      ' FROM bill_ids a JOIN bills b ON b.id=a.bill_id',
      ' JOIN legislative_sessions s ON s.id=b.session_id',
      " JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
      ' LEFT JOIN senate_official_bill_text_discovery disc ON disc.bill_id=b.id',
      " WHERE s.slug IN ('2025-2026','2023-2024','2021-2022')",
      ' GROUP BY s.slug ORDER BY s.slug DESC'
    ].join('\n'))).rows;
    const rawDocuments=(await db.query([
      'SELECT s.slug AS session,count(*)::int AS eligible_documents,',
      'count(*) FILTER(WHERE j.source_document_id IS NULL)::int AS unscanned_documents,',
      "count(*) FILTER(WHERE j.status='failed')::int AS failed_documents,",
      "count(*) FILTER(WHERE j.status='failed' AND j.attempts>=3)::int AS exhausted_document_retries",
      ' FROM source_documents d',
      ' JOIN legislative_sessions s ON s.id=d.session_id',
      " JOIN jurisdictions jur ON jur.id=s.jurisdiction_id AND jur.slug='us-mn'",
      ' LEFT JOIN senate_official_bill_text_journal_scans j ON j.source_document_id=d.id',
      " WHERE s.slug IN ('2025-2026','2023-2024','2021-2022')",
      " AND d.metadata->'rawPrepassageVotes'->>'sourceType'",
      " IN ('mn_senate_journal','mn_senate_committee_minutes_html')",
      ' AND EXISTS (SELECT 1 FROM senate_raw_vote_bill_mentions m',
      ' WHERE m.source_document_id=d.id AND m.bill_id IS NOT NULL)',
      ' GROUP BY s.slug ORDER BY s.slug DESC'
    ].join('\n'))).rows;
    return {families,queue,discovery,discoveryFailureKinds,journals,eligible,rawDocuments,outstanding};
  });
}
async function main():Promise<void>{
  let phase='main_gate',pool:Pool|null=null;
  try{
    guard(process.env);
    const expected=expectedMigrations();
    phase='existing_neon_primary';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({host:target.host,port:target.port,user:target.role,
      password:target.password,database:target.database,ssl:{rejectUnauthorized:true},
      max:2,connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:195000,
      application_name:'votepredict-senate-official-text-raw',
      options:'-c statement_timeout=180000 -c lock_timeout=5000'});
    const client=await pool.connect();
    try{
      phase='read_only_preflight';
      await preflight(client,target,expected);
      phase='additive_migration';
      const migrationApplied=await migrate(client,expected);
      phase='read_only_baseline';
      const baseline=await readOnly(client,async()=>(await client.query<{votes:number;members:number}>(
        'SELECT (SELECT count(*)::int FROM vote_events) AS votes,'
        +'(SELECT count(*)::int FROM member_votes) AS members')).rows[0]);
      const {RevisorPacer}=await import('../src/operations/senate-revisor-pacer.js');
      const pacer=new RevisorPacer();
      const counts={staged:0,discovered:0,failedDiscovery:0,unavailableDiscovery:0,
        versionsRecovered:0,versionsAlreadyStored:0,matchedExistingVersions:0,
        failedVersions:0,unavailableVersions:0,journalDocuments:0,amendmentBlocks:0,
        exactAmendmentLinks:0,unresolvedAmendments:0};
      let throttled=false;
      let haltedOnDiscoveryFailures=false;
      let repeatedDiscoveryFailures=0;
      phase='stage_raw_vote_linked_bills';
      counts.staged=await stageBills(client);
      phase='discover_versions';
      for(const bill of await nextDiscovery(client)){
        try {
          const result=await discoverBill(client,bill,pacer);
          if(result==='complete'){counts.discovered++;repeatedDiscoveryFailures=0;}
          if(result==='failed'){counts.failedDiscovery++;repeatedDiscoveryFailures++;}
          if(result==='unavailable'){counts.unavailableDiscovery++;repeatedDiscoveryFailures=0;}
          // A run with repeated failures and no successes must never silently
          // exhaust thousands of source retries. Keep queued work resumable.
          if(repeatedDiscoveryFailures>=8){
            haltedOnDiscoveryFailures=true;
            break;
          }
        }catch(error){
          if(error instanceof Throttled){throttled=true;break;}
          throw error;
        }
      }
      if(!throttled){
        phase='fetch_immutable_versions';
        for(const q of await nextVersions(client)){
          try{
            const result=await fetchVersion(client,q,pacer);
            if(result.status==='complete'){
              if(result.created)counts.versionsRecovered++;
              else counts.versionsAlreadyStored++;
              if(result.legacyMatched)counts.matchedExistingVersions++;
            }
            if(result.status==='failed')counts.failedVersions++;
            if(result.status==='unavailable')counts.unavailableVersions++;
          }catch(error){
            if(error instanceof Throttled){throttled=true;break;}
            throw error;
          }
        }
      }
      // Existing extracted journal/minutes text: no refetch or name resolution.
      if(!throttled){
        phase='extract_literal_amendments';
        for(const doc of await nextDocuments(client)){
          try{
            const result=await scanDocument(client,doc);
            counts.journalDocuments++;counts.amendmentBlocks+=result.found;
            counts.exactAmendmentLinks+=result.links;
            counts.unresolvedAmendments+=result.unresolved;
          }catch{
            await noteDocumentFailure(client,doc.id);
          }
        }
      }
      phase='post_commit_readback';
      const after=await readOnly(client,async()=>(await client.query<{votes:number;members:number}>(
        'SELECT (SELECT count(*)::int FROM vote_events) AS votes,'
        +'(SELECT count(*)::int FROM member_votes) AS members')).rows[0]);
      if(!baseline||!after||baseline.votes!==after.votes||baseline.members!==after.members)
        throw Error('forbidden_live_vote_counts_changed');
      const summary=await report(client);
      const output={status:throttled?'stopped_on_official_throttle'
          :haltedOnDiscoveryFailures?'stopped_on_repeated_discovery_failures':'bounded_batch_committed',
        migrationApplied,throttled,haltedOnDiscoveryFailures,counts,baselineUnchanged:true,...summary,
        servingInputsUntouched:true};
      console.log('SENATE_OFFICIAL_TEXT_RAW_READBACK='+JSON.stringify(output));
      if(process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          'Minnesota Senate official RAW text (no forecast changes)\n\n'
          +'State: '+output.status+'\n\n'+JSON.stringify(output,null,2)+'\n');
      // Operational gate: returning success on repeated failed fetches hid
      // the 100/100 first-production failure. Keep receipts but flag the run.
      if(haltedOnDiscoveryFailures)process.exitCode=1;
    }finally{client.release(true);}
  }catch(error){
    const sqlState=typeof (error as {code?:unknown})?.code==='string'
      && /^[A-Z0-9]{5}$/.test((error as {code:string}).code)
      ?(error as {code:string}).code:'none';
    // Never include credentials, network responses or SQL parameters in logs.
    console.error('SENATE_OFFICIAL_TEXT_RAW_HELD='+JSON.stringify({phase,sqlState}));
    process.exitCode=1;
  }finally{if(pool)await pool.end().catch(()=>undefined);}
}
main().catch(()=>{process.exitCode=1;});
