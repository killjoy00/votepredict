/**
 * Resumable raw Revisor authorship for Minnesota Senate SFs and paired HFs.
 * Uses existing sessions, bills, Senate identities and journal documents only.
 * Does not read/write vote, feature, forecast or serving tables.
 */
import {createHash} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {
  resolveBill,resolveSenator,canonicalBillIdentifier,
  type SenateMember,type SessionBill,
} from './senate-identity-bill-resolvers.js';
import {RevisorPacer} from './senate-revisor-pacer.js';
import {
  authorKey,parseSenateBillAuthorXml,parseSenateJournalAuthorChanges,
  type RawAuthor,type JournalAuthorChange,
} from './senate-bill-author-parser.js';

const INFO=[
  {slug:'2025-2026',legislature:94,year:2025},
  {slug:'2023-2024',legislature:93,year:2023},
  {slug:'2021-2022',legislature:92,year:2021},
] as const;
const SESSIONS=INFO.map(x=>x.slug);
const TIMEOUT_MS=16000;
export interface AuthorBill {
  bill_id:string;session_id:string;session_slug:string;
  identifier:string;chamber:'senate'|'house';
}
export interface AuthorCapture {
  url:string;fetchedAt:string;httpStatus:number|null;
  rawXml:string|null;result:'success'|'not_found'|'source_error'|'throttled';
}
export interface AuthorCollectionResult {
  attempted:number;successful:number;notFound:number;sourceErrors:number;
  stoppedForThrottle:boolean;authorsStored:number;
  journalsScanned:number;journalChanges:number;journalLinked:number;
  remainingUnscanned:number;remainingJournals:number;
}
interface JournalDoc {
  id:string;source_url:string;source_date:string|null;text:string;
  session_slug:string;
}
interface Catalog {roster:SenateMember[];bills:SessionBill[]}
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');

function statusUrls(bill:AuthorBill):string[] {
  const session=INFO.find(x=>x.slug===bill.session_slug);
  const canonical=canonicalBillIdentifier(bill.identifier);
  if(!session || !canonical || !/^(?:SF|HF)[1-9]\d{0,5}$/.test(canonical))
    throw Error('Invalid session-scoped bill identifier');
  const chamber=canonical.startsWith('SF')?'SF':'HF';
  const number=Number(canonical.slice(2));
  return [session.year,session.year+1].map(year=>
    'https://api.revisor.mn.gov/bills/v1/'+session.legislature+'/'+year+'/0/'+chamber+'/'+number+'/');
}
export async function captureBillAuthors(
  bill:AuthorBill,pacer:RevisorPacer,request:typeof fetch=fetch,
):Promise<AuthorCapture> {
  const urls=statusUrls(bill);
  let lastStatus:number|null=null, lastUrl=urls[0],anyError=false;
  for(const url of urls){
    lastUrl=url;
    await pacer.wait();
    try{
      const response=await request(url,{
        headers:{Accept:'application/xml,text/xml;q=0.9,*/*;q=0.1',
          'User-Agent':'VotePredict/2.0 raw Senate bill authorship'},
        cache:'no-store',signal:AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus=response.status;
      if(response.status===429 || response.status===503)
        return {url,fetchedAt:new Date().toISOString(),httpStatus:response.status,rawXml:null,result:'throttled'};
      if(response.status===404)continue;
      if(!response.ok){anyError=true;continue;}
      const rawXml=await response.text();
      const type=rawXml.match(/<FILE_TYPE>\s*(HF|SF)\s*<\/FILE_TYPE>/i)?.[1]?.toUpperCase();
      const num=Number(rawXml.match(/<FILE_NUMBER>\s*(\d+)\s*<\/FILE_NUMBER>/i)?.[1]);
      const year=rawXml.match(/<SESSION_YEAR>\s*(\d{4})\s*<\/SESSION_YEAR>/i)?.[1];
      if(!/<(?:[\w.-]+:)?BILL\b/i.test(rawXml) ||
        /<!doctype\s+html|<html\b/i.test(rawXml.slice(0,1000)) ||
        !type || canonicalBillIdentifier(type+num)!==canonicalBillIdentifier(bill.identifier) ||
        (year!==undefined && Number(year)!==Number(new URL(url).pathname.split('/')[4]))){
        anyError=true;
        continue;
      }
      return {url,fetchedAt:new Date().toISOString(),
        httpStatus:response.status,rawXml,result:'success'};
    }catch{anyError=true;}
  }
  return {url:lastUrl,fetchedAt:new Date().toISOString(),
    httpStatus:lastStatus,rawXml:null,result:anyError?'source_error':'not_found'};
}
async function loadCatalog(client:PoolClient):Promise<Catalog>{
  const members=await client.query<{
    id:string;session_slug:string;name:string;district:string|null;
    starts_on:string|null;ends_on:string|null;aliases:string[];
  }>(
    "SELECT m.id,s.slug AS session_slug,l.name,m.district,m.starts_on::text,m.ends_on::text,"+
    "coalesce(array_agg(DISTINCT a.source_name) FILTER (WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases "+
    "FROM memberships m JOIN legislative_sessions s ON s.id=m.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate' "+
    "JOIN legislators l ON l.id=m.legislator_id "+
    "LEFT JOIN membership_source_aliases a ON a.membership_id=m.id "+
    "WHERE s.slug=ANY($1::text[]) GROUP BY m.id,s.slug,l.name,m.district,m.starts_on,m.ends_on",
    [SESSIONS],
  );
  const roster:SenateMember[]=members.rows.map(x=>({
    id:x.id,sessionSlug:x.session_slug,name:x.name,district:x.district,
    startsOn:x.starts_on,endsOn:x.ends_on,aliases:x.aliases,
  }));
  for(const slug of SESSIONS){
    if(roster.filter(m=>m.sessionSlug===slug).length<40)
      throw Error('Missing existing Senate roster: '+slug);
  }
  const bills=await client.query<{id:string;slug:string;identifier:string}>(
    "SELECT b.id,s.slug,b.identifier FROM bills b "+
    "JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "WHERE s.slug=ANY($1::text[])",[SESSIONS],
  );
  return {roster,bills:bills.rows.map(x=>({id:x.id,sessionSlug:x.slug,identifier:x.identifier}))};
}
const targetWhere=
  "JOIN legislative_sessions s ON s.id=b.session_id "+
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
  "WHERE s.slug=ANY($1::text[]) AND "+
  "(b.identifier ~* '^SF[0-9]{1,6}$' OR "+
  "(b.identifier ~* '^HF[0-9]{1,6}$' AND EXISTS "+
  "(SELECT 1 FROM bill_companions cp WHERE cp.house_bill_id=b.id AND cp.session_id=s.id)))";
async function unscanned(client:PoolClient,limit:number):Promise<AuthorBill[]>{
  const q=await client.query<AuthorBill>(
    "SELECT b.id AS bill_id,s.id AS session_id,s.slug AS session_slug,b.identifier,"+
    "CASE WHEN b.identifier ~* '^SF' THEN 'senate' ELSE 'house' END AS chamber "+
    "FROM bills b LEFT JOIN senate_bill_author_scans scan ON scan.bill_id=b.id "+
    targetWhere+" AND (scan.bill_id IS NULL OR scan.result='source_error') "+
    "ORDER BY (scan.bill_id IS NOT NULL),"+
    "CASE WHEN b.identifier ~* '^SF' THEN 0 ELSE 1 END,s.slug DESC,"+
    "substring(b.identifier from '[0-9]+$')::integer LIMIT $2",[SESSIONS,limit]);
  return q.rows;
}
async function remainingBills(client:PoolClient):Promise<number>{
  const q=await client.query<{n:number}>(
    "SELECT count(*)::int AS n FROM bills b "+
    "LEFT JOIN senate_bill_author_scans scan ON scan.bill_id=b.id "+
    targetWhere+" AND (scan.bill_id IS NULL OR scan.result='source_error')",[SESSIONS]);
  return q.rows[0]?.n??0;
}
const UPSERT_AUTHOR=
  "INSERT INTO senate_bill_authors "+
  "(bill_id,session_id,chamber,name_raw,author_key,membership_id,match_method,"+
  "role,author_order,added_on,removed_on,source,snapshot_id,source_url) "+
  "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14) "+
  "ON CONFLICT (bill_id,chamber,author_key) DO UPDATE SET "+
  "membership_id=COALESCE(senate_bill_authors.membership_id,EXCLUDED.membership_id),"+
  "match_method=CASE WHEN senate_bill_authors.membership_id IS NULL AND EXCLUDED.membership_id IS NOT NULL "+
  "THEN EXCLUDED.match_method ELSE senate_bill_authors.match_method END,"+
  "name_raw=CASE WHEN EXCLUDED.source='revisor_xml' THEN EXCLUDED.name_raw ELSE senate_bill_authors.name_raw END,"+
  "role=CASE WHEN EXCLUDED.source='revisor_xml' THEN EXCLUDED.role "+
  "WHEN senate_bill_authors.source='revisor_xml' THEN senate_bill_authors.role "+
  "WHEN EXCLUDED.role='chief' THEN EXCLUDED.role ELSE senate_bill_authors.role END,"+
  "author_order=COALESCE(EXCLUDED.author_order,senate_bill_authors.author_order),"+
  "added_on=CASE WHEN senate_bill_authors.added_on IS NULL THEN EXCLUDED.added_on "+
  "WHEN EXCLUDED.added_on IS NULL THEN senate_bill_authors.added_on "+
  "ELSE LEAST(senate_bill_authors.added_on,EXCLUDED.added_on) END,"+
  "removed_on=CASE WHEN senate_bill_authors.removed_on IS NULL THEN EXCLUDED.removed_on "+
  "WHEN EXCLUDED.removed_on IS NULL THEN senate_bill_authors.removed_on "+
  "ELSE GREATEST(senate_bill_authors.removed_on,EXCLUDED.removed_on) END,"+
  "source=CASE WHEN EXCLUDED.source='revisor_xml' THEN EXCLUDED.source ELSE senate_bill_authors.source END,"+
  "snapshot_id=CASE WHEN EXCLUDED.source='revisor_xml' THEN EXCLUDED.snapshot_id ELSE senate_bill_authors.snapshot_id END,"+
  "source_url=CASE WHEN EXCLUDED.source='revisor_xml' THEN EXCLUDED.source_url ELSE senate_bill_authors.source_url END";
async function insertAuthor(
  client:PoolClient,bill:AuthorBill,raw:RawAuthor,
  roster:readonly SenateMember[],source:'revisor_xml'|'journal',
  url:string,snapshotId:string|null,
):Promise<void>{
  const key=authorKey(raw.nameRaw);
  if(!key)return;
  const resolution=bill.chamber==='senate'
    ?resolveSenator({printedName:raw.nameRaw,sessionSlug:bill.session_slug,
      date:raw.addedOn},roster)
    :{membershipId:null,matchMethod:'unresolved'};
  await client.query(UPSERT_AUTHOR,[
    bill.bill_id,bill.session_id,bill.chamber,raw.nameRaw,key,
    resolution.membershipId,resolution.matchMethod,raw.role,raw.authorOrder,
    raw.addedOn,raw.removedOn,source,snapshotId,url,
  ]);
}
/** Exported to allow exact twice-on-one-disposable-Postgres regression testing. */
export async function persistOfficialAuthorCapture(
  client:PoolClient,bill:AuthorBill,capture:AuthorCapture,
  roster:readonly SenateMember[],
):Promise<number>{
  if(capture.result==='throttled')throw Error('Throttle must stop without a scan receipt');
  let authors:RawAuthor[]=[];
  if(capture.result==='success' && capture.rawXml)
    authors=parseSenateBillAuthorXml(capture.rawXml,bill.identifier);
  await client.query('BEGIN');
  try{
    let snapshotId:string|null=null;
    if(capture.result==='success' && capture.rawXml){
      const snapshot=(await client.query<{id:string}>(
        "INSERT INTO senate_bill_author_snapshots "+
        "(bill_id,source_url,fetched_at,http_status,sha256,raw_xml) "+
        "VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (bill_id,sha256) "+
        "DO UPDATE SET source_url=senate_bill_author_snapshots.source_url RETURNING id",[
        bill.bill_id,capture.url,capture.fetchedAt,capture.httpStatus??200,
        sha256(capture.rawXml),capture.rawXml,
      ])).rows[0];
      snapshotId=snapshot.id;
      for(const author of authors)
        await insertAuthor(client,bill,author,roster,'revisor_xml',capture.url,snapshotId);
    }
    await client.query(
      "INSERT INTO senate_bill_author_scans "+
      "(bill_id,session_id,source_url,checked_at,http_status,result,attempts,snapshot_id) "+
      "VALUES ($1,$2,$3,$4,$5,$6,1,$7) "+
      "ON CONFLICT (bill_id) DO UPDATE SET source_url=EXCLUDED.source_url,"+
      "checked_at=EXCLUDED.checked_at,http_status=EXCLUDED.http_status,"+
      "result=EXCLUDED.result,snapshot_id=EXCLUDED.snapshot_id,"+
      "attempts=senate_bill_author_scans.attempts+1",[
      bill.bill_id,bill.session_id,capture.url,capture.fetchedAt,
      capture.httpStatus,capture.result,snapshotId,
    ]);
    await client.query('COMMIT');
    return authors.length;
  }catch(e){await client.query('ROLLBACK');throw e;}
}
async function pendingJournals(client:PoolClient,limit:number):Promise<JournalDoc[]>{
  const q=await client.query<JournalDoc>(
    "SELECT d.id,d.source_url,metadata #>> '{rawPrepassageVotes,sourceDate}' AS source_date,"+
    "metadata #>> '{rawPrepassageVotes,text}' AS text,"+
    "metadata #>> '{rawPrepassageVotes,sessionSlug}' AS session_slug "+
    "FROM source_documents d LEFT JOIN senate_bill_author_journal_scans scan "+
    "ON scan.source_document_id=d.id "+
    "WHERE d.metadata #>> '{rawPrepassageVotes,sourceType}'='mn_senate_journal' "+
    "AND d.metadata #>> '{rawPrepassageVotes,sessionSlug}'=ANY($1::text[]) "+
    "AND d.metadata #>> '{rawPrepassageVotes,text}' IS NOT NULL "+
    "AND scan.source_document_id IS NULL ORDER BY d.id LIMIT $2",[SESSIONS,limit]);
  return q.rows;
}
async function remainingJournals(client:PoolClient):Promise<number>{
  const q=await client.query<{n:number}>(
    "SELECT count(*)::int AS n FROM source_documents d "+
    "LEFT JOIN senate_bill_author_journal_scans scan ON scan.source_document_id=d.id "+
    "WHERE d.metadata #>> '{rawPrepassageVotes,sourceType}'='mn_senate_journal' "+
    "AND d.metadata #>> '{rawPrepassageVotes,sessionSlug}'=ANY($1::text[]) "+
    "AND d.metadata #>> '{rawPrepassageVotes,text}' IS NOT NULL "+
    "AND scan.source_document_id IS NULL",[SESSIONS]);
  return q.rows[0]?.n??0;
}
function rawFromJournal(change:JournalAuthorChange,date:string|null):RawAuthor{
  return {
    nameRaw:change.nameRaw,role:change.role,authorOrder:null,
    addedOn:change.operation==='add'?date:null,
    removedOn:change.operation==='strike'?date:null,
  };
}
export async function backfillStoredJournalAuthorChanges(
  client:PoolClient,cat:Catalog,limit=60,
):Promise<{scanned:number;changes:number;linked:number}>{
  const docs=await pendingJournals(client,limit);
  let changes=0,linked=0;
  const sessionIds=new Map<string,string>();
  const q=await client.query<{id:string;slug:string}>(
    "SELECT s.id,s.slug FROM legislative_sessions s JOIN jurisdictions j "+
    "ON j.id=s.jurisdiction_id AND j.slug='us-mn' WHERE s.slug=ANY($1::text[])",[SESSIONS]);
  q.rows.forEach(x=>sessionIds.set(x.slug,x.id));
  for(const doc of docs){
    const motions=parseSenateJournalAuthorChanges(doc.text);
    changes+=motions.length;
    await client.query('BEGIN');
    try{
      let documentLinks=0;
      for(const motion of motions){
        const billId=resolveBill({
          printedIdentifier:motion.billIdentifier,sessionSlug:doc.session_slug,
        },cat.bills).billId;
        const sessionId=sessionIds.get(doc.session_slug);
        if(!billId || !sessionId)continue;
        const bill:AuthorBill={bill_id:billId,session_id:sessionId,
          session_slug:doc.session_slug,identifier:motion.billIdentifier,chamber:'senate'};
        await insertAuthor(client,bill,rawFromJournal(motion,doc.source_date),
          cat.roster,'journal',doc.source_url,null);
        documentLinks++;
      }
      await client.query(
        "INSERT INTO senate_bill_author_journal_scans "+
        "(source_document_id,source_url,text_sha256,changes_found,changes_linked) "+
        "VALUES ($1,$2,$3,$4,$5) ON CONFLICT (source_document_id) DO NOTHING",[
          doc.id,doc.source_url,sha256(doc.text),motions.length,documentLinks,
        ]);
      await client.query('COMMIT');
      linked+=documentLinks;
    }catch(e){await client.query('ROLLBACK');throw e;}
  }
  return {scanned:docs.length,changes,linked};
}
export async function runSenateBillAuthorCollection(
  pool:Pool,maximumLookups=350,pacer=new RevisorPacer(),
):Promise<AuthorCollectionResult>{
  const limit=Math.min(500,Math.max(1,Math.trunc(maximumLookups)));
  const client=await pool.connect();
  const report:AuthorCollectionResult={
    attempted:0,successful:0,notFound:0,sourceErrors:0,stoppedForThrottle:false,
    authorsStored:0,journalsScanned:0,journalChanges:0,journalLinked:0,
    remainingUnscanned:0,remainingJournals:0,
  };
  try{
    const cat=await loadCatalog(client);
    const journal=await backfillStoredJournalAuthorChanges(client,cat,80);
    report.journalsScanned=journal.scanned;
    report.journalChanges=journal.changes;
    report.journalLinked=journal.linked;
    for(const bill of await unscanned(client,limit)){
      const capture=await captureBillAuthors(bill,pacer);
      report.attempted++;
      if(capture.result==='throttled'){
        report.stoppedForThrottle=true;
        break;
      }
      report.authorsStored+=await persistOfficialAuthorCapture(client,bill,capture,cat.roster);
      if(capture.result==='success')report.successful++;
      if(capture.result==='not_found')report.notFound++;
      if(capture.result==='source_error')report.sourceErrors++;
      if(report.attempted%50===0)
        console.log('SENATE_BILL_AUTHORS_PROGRESS='+JSON.stringify({
          attempted:report.attempted,successful:report.successful,
          sourceErrors:report.sourceErrors,
        }));
    }
    report.remainingUnscanned=await remainingBills(client);
    report.remainingJournals=await remainingJournals(client);
    return report;
  }finally{client.release(true);}
}
export interface AuthorSessionReadback {
  session:string;targetBills:number;scannedBills:number;successBills:number;
  billsWithCoauthors:number;authorRows:number;senateAuthorRows:number;
  senateLinked:number;houseAuthorRows:number;coauthorShare:number;
  senateLinkRate:number;
}
export async function senateBillAuthorReadback(pool:Pool):Promise<AuthorSessionReadback[]>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows=await client.query<{
      session:string;target_bills:string;scanned_bills:string;success_bills:string;
      bills_with_coauthors:string;author_rows:string;senate_author_rows:string;
      senate_linked:string;house_author_rows:string;
    }>(
      "WITH targets AS ("+
      "SELECT b.id,s.slug FROM bills b "+
      "JOIN legislative_sessions s ON s.id=b.session_id "+
      "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
      "WHERE s.slug=ANY($1::text[]) AND (b.identifier ~* '^SF[0-9]{1,6}$' OR "+
      "(b.identifier ~* '^HF[0-9]{1,6}$' AND EXISTS "+
      "(SELECT 1 FROM bill_companions cp WHERE cp.house_bill_id=b.id AND cp.session_id=s.id)))) "+
      "SELECT t.slug AS session,count(DISTINCT t.id)::text AS target_bills,"+
      "count(DISTINCT scan.bill_id)::text AS scanned_bills,"+
      "count(DISTINCT scan.bill_id) FILTER (WHERE scan.result='success')::text AS success_bills,"+
      "count(DISTINCT a.bill_id) FILTER (WHERE a.role='coauthor' AND scan.result='success')::text AS bills_with_coauthors,"+
      "count(DISTINCT a.id)::text AS author_rows,"+
      "count(DISTINCT a.id) FILTER (WHERE a.chamber='senate')::text AS senate_author_rows,"+
      "count(DISTINCT a.id) FILTER (WHERE a.chamber='senate' AND a.membership_id IS NOT NULL)::text AS senate_linked,"+
      "count(DISTINCT a.id) FILTER (WHERE a.chamber='house')::text AS house_author_rows "+
      "FROM targets t LEFT JOIN senate_bill_author_scans scan ON scan.bill_id=t.id "+
      "LEFT JOIN senate_bill_authors a ON a.bill_id=t.id GROUP BY t.slug ORDER BY t.slug",
      [SESSIONS],
    );
    return rows.rows.map(x=>{
      const numeric={
        session:x.session,targetBills:Number(x.target_bills),
        scannedBills:Number(x.scanned_bills),successBills:Number(x.success_bills),
        billsWithCoauthors:Number(x.bills_with_coauthors),
        authorRows:Number(x.author_rows),senateAuthorRows:Number(x.senate_author_rows),
        senateLinked:Number(x.senate_linked),houseAuthorRows:Number(x.house_author_rows),
      };
      return {...numeric,
        coauthorShare:numeric.successBills>0?numeric.billsWithCoauthors/numeric.successBills:0,
        senateLinkRate:numeric.senateAuthorRows>0?numeric.senateLinked/numeric.senateAuthorRows:0};
    });
  }finally{await client.query('ROLLBACK');client.release(true);}
}
