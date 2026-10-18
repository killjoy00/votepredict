/**
 * Explicit owner-authorized one-shot recovery of exactly 41 failed raw
 * Minnesota SF / linked-HF author scans from public official Revisor HTML.
 * No bulk collector, forecast, serving, features or vote table changes.
 * Green independently verified reviewed main + protected GitHub Neon only.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {RevisorPacer} from '../src/operations/senate-revisor-pacer.js';
import {authorKey} from '../src/operations/senate-bill-author-parser.js';
import {
  AUTHOR_HTML_RECOVERY_CASES,fetchOfficialHtmlForCase,
  type OfficialHtmlCapture,
} from '../src/operations/senate-bill-authors-html-recovery.js';
import {validateCaseInventory} from './audit-senate-bill-authors-41-source-readonly.js';
import {resolveSenator,type SenateMember} from '../src/operations/senate-identity-bill-resolvers.js';

const REPO='killjoy00/votepredict';
const WORKFLOW=REPO+'/.github/workflows/senate-bill-authors-41-recovery.yml@refs/heads/main';
const MARKER='SENATE_BILL_AUTHORS_41_HTML_RECOVERY';
const TARGET_COUNT=28938;
const BASE_SUCCESS=28897;
type BillRow={
  bill_id:string;session_id:string;session:string;identifier:string;
  result:string;attempts:number;source_url:string;
};
type LedgerRow={filename:string;checksum:string};
interface Event{
  repository?:{full_name?:string;default_branch?:string};
  ref?:string;after?:string;deleted?:boolean;forced?:boolean;
  head_commit?:{id?:string;message?:string};
}
function authorize():void{
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!==REPO||
    e.GITHUB_WORKFLOW_REF!==WORKFLOW||
    e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
    e.GITHUB_RUN_ATTEMPT!=='1'||
    e.VOTEPREDICT_AUTHORS_41_RECOVERY_INDEPENDENT_CI!=='true'||
    !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||!e.GITHUB_EVENT_PATH)
    throw Error('Reviewed exact-main protected first-attempt gate required');
  const event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH,'utf8')) as Event;
  if(event.repository?.full_name!==REPO||
    event.repository.default_branch!=='main'||
    event.ref!=='refs/heads/main'||
    event.after!==e.GITHUB_SHA||event.head_commit?.id!==e.GITHUB_SHA||
    !event.head_commit.message?.includes(MARKER)||
    event.forced===true||event.deleted===true)
    throw Error('Unreviewed recovery event denied');
}
function expectedMigrations():LedgerRow[]{
  const files=readdirSync('migrations')
    .filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if(files.length<25||files[24]!=='0025_senate_bill_authors.sql')
    throw Error('Expected immutable 0025 source migration not present');
  return files.map(filename=>({filename,
    checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex')}));
}
async function checkReleaseLedger(client:PoolClient):Promise<void>{
  const expected=expectedMigrations();
  const rows=(await client.query<LedgerRow>(
    'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
  )).rows;
  if(rows.length!==expected.length ||
    rows.some((v,i)=>v.filename!==expected[i].filename||v.checksum!==expected[i].checksum))
    throw Error('Existing production release migration ledger drift');
}
const KEYS=AUTHOR_HTML_RECOVERY_CASES.map(c=>c.session+':'+c.identifier);
const TARGETS_SQL=
  "SELECT b.id::text AS bill_id,s.id::text AS session_id,"+
  "s.slug AS session,b.identifier,scan.result,scan.attempts,scan.source_url "+
  "FROM bills b JOIN legislative_sessions s ON s.id=b.session_id "+
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
  "JOIN senate_bill_author_scans scan ON scan.bill_id=b.id "+
  "WHERE s.slug||':'||b.identifier=ANY($1::text[]) AND "+
  "(b.identifier ~* '^SF[0-9]{1,6}$' OR "+
  "(b.identifier ~* '^HF[0-9]{1,6}$' AND EXISTS ("+
  "SELECT 1 FROM bill_companions cp WHERE cp.house_bill_id=b.id AND cp.session_id=s.id)))";
async function checkTargets(client:PoolClient,lock=false):Promise<BillRow[]>{
  const rows=(await client.query<BillRow>(TARGETS_SQL+
    ' ORDER BY session,identifier'+(lock?' FOR UPDATE OF scan':''),[KEYS])).rows;
  const actual=new Set(rows.map(x=>x.session+':'+x.identifier));
  if(rows.length!==41||actual.size!==41||KEYS.some(key=>!actual.has(key))||
     rows.some(x=>x.result!=='source_error'||x.attempts<2))
    throw Error('Protected 41-case source-error identity/attempt preflight changed');
  return rows;
}
async function checkUniverse(client:PoolClient):Promise<{targets:number;success:number;errors:number}>{
  const rows=(await client.query<{targets:number;success:number;errors:number}>(
    "SELECT count(*)::int AS targets,"+
    "count(*) FILTER (WHERE scan.result='success')::int AS success,"+
    "count(*) FILTER (WHERE scan.result='source_error' OR scan.bill_id IS NULL)::int AS errors "+
    "FROM bills b JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "LEFT JOIN senate_bill_author_scans scan ON scan.bill_id=b.id "+
    "WHERE s.slug=ANY($1::text[]) AND "+
    "(b.identifier ~* '^SF[0-9]{1,6}$' OR "+
    "(b.identifier ~* '^HF[0-9]{1,6}$' AND EXISTS "+
    "(SELECT 1 FROM bill_companions cp WHERE cp.house_bill_id=b.id AND cp.session_id=s.id)))",
    [['2021-2022','2023-2024','2025-2026']],
  )).rows[0];
  if(!rows||rows.targets!==TARGET_COUNT)throw Error('Production bill catalog changed');
  return rows;
}
async function readRoster(client:PoolClient):Promise<SenateMember[]>{
  const rows=(await client.query<{
    id:string;session_slug:string;name:string;district:string|null;
    starts_on:string|null;ends_on:string|null;aliases:string[];
  }>(
    "SELECT m.id::text,s.slug AS session_slug,l.name,m.district,"+
    "m.starts_on::text,m.ends_on::text,"+
    "coalesce(array_agg(DISTINCT a.source_name) FILTER "+
    "(WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases "+
    "FROM memberships m JOIN legislative_sessions s ON s.id=m.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate' "+
    "JOIN legislators l ON l.id=m.legislator_id "+
    "LEFT JOIN membership_source_aliases a ON a.membership_id=m.id "+
    "WHERE s.slug=ANY($1::text[]) "+
    "GROUP BY m.id,s.slug,l.name,m.district,m.starts_on,m.ends_on",
    [['2021-2022','2023-2024','2025-2026']],
  )).rows;
  const roster=rows.map(x=>({
    id:x.id,sessionSlug:x.session_slug,name:x.name,district:x.district,
    startsOn:x.starts_on,endsOn:x.ends_on,aliases:x.aliases,
  }));
  for(const slug of ['2021-2022','2023-2024','2025-2026']){
    if(roster.filter(x=>x.sessionSlug===slug).length<40)
      throw Error('Protected existing Senate membership roster unavailable');
  }
  return roster;
}
function sha(value:string):string{
  return createHash('sha256').update(value).digest('hex');
}
async function insertOne(
  client:PoolClient,row:BillRow,capture:OfficialHtmlCapture,roster:SenateMember[],
):Promise<number>{
  const digest=sha(capture.rawHtml);
  // Existing raw_xml column is the immutable original HTTP-response-text
  // snapshot slot. For source='revisor_html' it contains HTML, not XML.
  // The raw response format is declared by authors.source and source_url.
  const snapshot=(await client.query<{id:string}>(
    "INSERT INTO senate_bill_author_snapshots "+
    "(bill_id,source_url,fetched_at,http_status,sha256,raw_xml) "+
    "VALUES($1,$2,$3,200,$4,$5) "+
    "ON CONFLICT(bill_id,sha256) DO UPDATE "+
    "SET source_url=senate_bill_author_snapshots.source_url RETURNING id",
    [row.bill_id,capture.sourceUrl,capture.fetchedAt,digest,capture.rawHtml],
  )).rows[0];
  if(!snapshot?.id)throw Error('Official raw HTML snapshot write missing');
  let inserted=0;
  for(const author of capture.parsed.authors){
    const key=authorKey(author.nameRaw);
    if(!key)throw Error('Unexpected empty canonical author key');
    const resolution=row.identifier.startsWith('SF')
      ?resolveSenator({printedName:author.nameRaw,sessionSlug:row.session,
        date:author.addedOn},roster)
      :{membershipId:null,matchMethod:'unresolved'};
    const chamber=row.identifier.startsWith('SF')?'senate':'house';
    await client.query(
      "INSERT INTO senate_bill_authors "+
      "(bill_id,session_id,chamber,name_raw,author_key,membership_id,match_method,"+
      "role,author_order,added_on,removed_on,source,snapshot_id,source_url) "+
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,'revisor_html',$12,$13) "+
      "ON CONFLICT(bill_id,chamber,author_key) DO UPDATE SET "+
      "membership_id=COALESCE(senate_bill_authors.membership_id,EXCLUDED.membership_id),"+
      "match_method=CASE WHEN senate_bill_authors.membership_id IS NULL AND "+
      "EXCLUDED.membership_id IS NOT NULL THEN EXCLUDED.match_method "+
      "ELSE senate_bill_authors.match_method END,"+
      "name_raw=CASE WHEN senate_bill_authors.source='revisor_xml' "+
      "THEN senate_bill_authors.name_raw ELSE EXCLUDED.name_raw END,"+
      "role=CASE WHEN senate_bill_authors.source='revisor_xml' "+
      "THEN senate_bill_authors.role ELSE EXCLUDED.role END,"+
      "author_order=COALESCE(senate_bill_authors.author_order,EXCLUDED.author_order),"+
      "added_on=CASE WHEN senate_bill_authors.added_on IS NULL THEN EXCLUDED.added_on "+
      "WHEN EXCLUDED.added_on IS NULL THEN senate_bill_authors.added_on "+
      "ELSE LEAST(senate_bill_authors.added_on,EXCLUDED.added_on) END,"+
      "removed_on=CASE WHEN senate_bill_authors.removed_on IS NULL THEN EXCLUDED.removed_on "+
      "WHEN EXCLUDED.removed_on IS NULL THEN senate_bill_authors.removed_on "+
      "ELSE GREATEST(senate_bill_authors.removed_on,EXCLUDED.removed_on) END,"+
      "source=CASE WHEN senate_bill_authors.source='revisor_xml' "+
      "THEN senate_bill_authors.source ELSE 'revisor_html' END,"+
      "snapshot_id=CASE WHEN senate_bill_authors.source='revisor_xml' "+
      "THEN senate_bill_authors.snapshot_id ELSE EXCLUDED.snapshot_id END,"+
      "source_url=CASE WHEN senate_bill_authors.source='revisor_xml' "+
      "THEN senate_bill_authors.source_url ELSE EXCLUDED.source_url END",
      [row.bill_id,row.session_id,chamber,author.nameRaw,key,
        resolution.membershipId,resolution.matchMethod,author.role,
        author.authorOrder,author.addedOn,author.removedOn,
        snapshot.id,capture.sourceUrl],
    );
    inserted++;
  }
  const scan=(await client.query<{bill_id:string}>(
    "UPDATE senate_bill_author_scans SET "+
    "source_url=$2,checked_at=$3,http_status=200,result='success',"+
    "attempts=attempts+1,snapshot_id=$4 "+
    "WHERE bill_id=$1 AND result='source_error' RETURNING bill_id::text",
    [row.bill_id,capture.sourceUrl,capture.fetchedAt,snapshot.id],
  )).rows;
  if(scan.length!==1||scan[0].bill_id!==row.bill_id)
    throw Error('Unreviewed or concurrently resolved scan write prevented');
  return inserted;
}
async function readonlyReadback(client:PoolClient):Promise<{
  total:number;success:number;remaining:number;journals:number;
  perSession:{session:string;total:number;success:number;remaining:number}[];
}>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
    const result=await client.query<{
      session:string;total:number;success:number;remaining:number;
    }>(
      "WITH targets AS (SELECT s.slug AS session,scan.result "+
      "FROM bills b JOIN legislative_sessions s ON s.id=b.session_id "+
      "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
      "LEFT JOIN senate_bill_author_scans scan ON scan.bill_id=b.id "+
      "WHERE s.slug=ANY($1::text[]) AND "+
      "(b.identifier ~* '^SF[0-9]{1,6}$' OR "+
      "(b.identifier ~* '^HF[0-9]{1,6}$' AND EXISTS "+
      "(SELECT 1 FROM bill_companions cp WHERE cp.house_bill_id=b.id AND cp.session_id=s.id)))) "+
      "SELECT session,count(*)::int AS total,"+
      "count(*) FILTER(WHERE result='success')::int AS success,"+
      "count(*) FILTER(WHERE result IS NULL OR result='source_error')::int AS remaining "+
      "FROM targets GROUP BY session ORDER BY session",
      [['2021-2022','2023-2024','2025-2026']],
    );
    const p=result.rows;
    const journals=(await client.query<{n:number}>(
      "SELECT count(*)::int AS n FROM source_documents d "+
      "LEFT JOIN senate_bill_author_journal_scans scan ON scan.source_document_id=d.id "+
      "WHERE d.metadata #>> '{rawPrepassageVotes,sourceType}'='mn_senate_journal' "+
      "AND d.metadata #>> '{rawPrepassageVotes,sessionSlug}'=ANY($1::text[]) "+
      "AND d.metadata #>> '{rawPrepassageVotes,text}' IS NOT NULL "+
      "AND scan.source_document_id IS NULL",
      [['2021-2022','2023-2024','2025-2026']],
    )).rows[0]?.n??-1;
    const total=p.reduce((sum,x)=>sum+x.total,0);
    const success=p.reduce((sum,x)=>sum+x.success,0);
    const remaining=p.reduce((sum,x)=>sum+x.remaining,0);
    return {total,success,remaining,journals,perSession:p};
  }finally{await client.query('ROLLBACK');}
}

async function main():Promise<void>{
  let phase='protected_launch';
  let pool:Pool|null=null;
  try{
    authorize();
    validateCaseInventory();
    if(process.argv.length!==2)throw Error('No production run arguments accepted');
    const apiKey=process.env.NEON_API_KEY?.trim();
    const projectId=process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim();
    if(!apiKey||!projectId)throw Error('Protected existing Neon credentials absent');
    phase='existing_marked_primary_connection';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey,projectId,
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({
      host:target.host,port:target.port,database:target.database,
      user:target.role,password:target.password,ssl:{rejectUnauthorized:true},
      max:1,connectionTimeoutMillis:12000,statement_timeout:120000,
      query_timeout:130000,application_name:'votepredict-authors-41-exact-html-recovery',
      options:'-c statement_timeout=120000 -c lock_timeout=7000',
    });
    const client=await pool.connect();
    try{
      phase='repeatable_read_preflight';
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      let roster:SenateMember[]=[];
      try{
        const identity=(await client.query<{
          db:string;role:string;ro:string;scans:string|null;authors:string|null;
          snapshots:string|null;
        }>(
          "SELECT current_database() AS db,current_user AS role,"+
          "current_setting('transaction_read_only') AS ro,"+
          "to_regclass('public.senate_bill_author_scans')::text AS scans,"+
          "to_regclass('public.senate_bill_authors')::text AS authors,"+
          "to_regclass('public.senate_bill_author_snapshots')::text AS snapshots",
        )).rows[0];
        if(!identity||identity.db!==target.database||
           identity.role!==target.role||identity.ro!=='on'||
           !identity.scans||!identity.authors||!identity.snapshots)
          throw Error('Protected read-only marked database identity failed');
        await checkReleaseLedger(client);
        await checkTargets(client);
        const u=await checkUniverse(client);
        if(u.targets!==TARGET_COUNT||u.success!==BASE_SUCCESS||u.errors!==41)
          throw Error('Expected unmodified 28,897+41 production state not found');
        roster=await readRoster(client);
      }finally{await client.query('ROLLBACK');}

      phase='official_source_capture_and_all_41_validation';
      const pacer=new RevisorPacer({intervalMs:1300});
      const captures:OfficialHtmlCapture[]=[];
      for(const item of AUTHOR_HTML_RECOVERY_CASES){
        const capture=await fetchOfficialHtmlForCase(item,pacer);
        captures.push(capture);
        console.log('SENATE_BILL_AUTHORS_41_HTML_PARSED='+JSON.stringify({
          session:item.session,identifier:item.identifier,
          authors:capture.parsed.declaredCount,
          datedCurrentAuthors:capture.parsed.datedCurrentAuthors,
        }));
      }
      if(captures.length!==41||captures.some(c=>
        c.parsed.authors.length!==c.parsed.declaredCount||c.parsed.authors.length<1))
        throw Error('One or more of 41 official authorship pages did not validate');
      const expectedAuthorRows=captures.reduce((n,c)=>n+c.parsed.authors.length,0);
      console.log('SENATE_BILL_AUTHORS_41_SOURCE_PREFLIGHT='+JSON.stringify({
        all41Validated:true,source:'official_revisor_html',
        publicBills:captures.length,orderedCurrentAuthors:expectedAuthorRows,
        sourceThrottled:false,dbWritesSoFar:false,
      }));

      phase='single_atomic_exact_41_transaction';
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      let inserted=0,committed=false;
      try{
        await checkReleaseLedger(client);
        const u=await checkUniverse(client);
        if(u.targets!==TARGET_COUNT||u.success!==BASE_SUCCESS||u.errors!==41)
          throw Error('Production universe moved since read-only preflight');
        const rows=await checkTargets(client,true);
        const byKey=new Map(rows.map(x=>[x.session+':'+x.identifier,x]));
        for(const capture of captures){
          const key=capture.item.session+':'+capture.item.identifier;
          const row=byKey.get(key);
          if(!row)throw Error('Requested bill absent from locked exact targets');
          inserted+=await insertOne(client,row,capture,roster);
        }
        if(inserted!==expectedAuthorRows)throw Error('Staged author-count mismatch');
        const successful=(await client.query<{n:number}>(
          "SELECT count(*)::int AS n FROM senate_bill_author_scans "+
          "WHERE bill_id=ANY($1::uuid[]) AND result='success'",
          [rows.map(x=>x.bill_id)],
        )).rows[0]?.n??0;
        if(successful!==41)throw Error('Atomic 41-case success receipt mismatch');
        const orderRows=(await client.query<{n:number}>(
          "SELECT count(*)::int AS n FROM senate_bill_authors "+
          "WHERE bill_id=ANY($1::uuid[]) AND author_order IS NOT NULL",
          [rows.map(x=>x.bill_id)],
        )).rows[0]?.n??0;
        if(orderRows<expectedAuthorRows)throw Error('Ordered authorship rows incomplete');
        await client.query('COMMIT');
        committed=true;
      }finally{
        if(!committed)await client.query('ROLLBACK');
      }
      phase='post_commit_independent_repeatable_read';
      const readback=await readonlyReadback(client);
      const completed=readback.total===TARGET_COUNT &&
        readback.success===TARGET_COUNT &&
        readback.remaining===0 &&
        readback.journals===0;
      console.log('SENATE_BILL_AUTHORS_41_RECOVERY='+JSON.stringify({
        status:completed?'complete_verified':'post_commit_readback_incomplete',
        source:'first_party_revisor_html',recoveredBillScans:41,
        orderedAuthorsStored:expectedAuthorRows,
        totalTargets:readback.total,successfulScans:readback.success,
        remaining_unscanned:readback.remaining,
        remaining_journals:readback.journals,
        perSession:readback.perSession,bulkCollectorRestarted:false,
        recurringScheduleRemainsPaused:true,
        servingVotesForecastUntouched:true,
      }));
      if(!completed)process.exitCode=1;
    }finally{client.release(true);}
  }catch(error){
    // Never print Neon client exceptions: some contain database URLs/credentials.
    const e=error as {code?:unknown};
    const sqlState=typeof e?.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:'none';
    console.error('SENATE_BILL_AUTHORS_41_RECOVERY_HELD='+JSON.stringify({
      phase,sqlState,productionCompletionNotVerified:true,
    }));
    process.exitCode=1;
  }finally{if(pool)try{await pool.end();}catch{process.exitCode=1;}}
}
void main();
