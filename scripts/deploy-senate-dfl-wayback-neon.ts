/**
 * Protected, bounded insert-only historical Senate DFL original publications.
 * Fetches original full documents solely from publicly indexed Wayback captures,
 * not senatedfl.mn. Writes capture provenance alongside new raw text; no models.
 */
import {createHash} from 'node:crypto';
import {appendFileSync,readFileSync,readdirSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection}
  from '../src/operations/senate-media-neon-api-readonly.js';
import {ArchivedSenateDFLStore} from '../src/operations/senate-dfl-archive-store.js';
import {getWaybackRecords,loadArchivedDFL,originalDFLUrl}
  from '../src/sources/minnesota/senate-dfl-wayback.js';

const MARKER='SENATE_DFL_WAYBACK_RAW_20261016';
const MIGRATION='0020_senate_raw_statement_archive_captures.sql';
type Ledger={filename:string;checksum:string};
type YearCount={year:string;total:number};
type Seed={year:number;url:string};

function assertMain():void{
  const e=process.env;
  if(process.argv.length!==2||
    e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
    e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
    e.GITHUB_RUN_ATTEMPT!=='1'||e.VOTEPREDICT_SENATE_ARCHIVE_CI!=='true'||
    !/^[0-9a-f]{40}$/.test(e.GITHUB_SHA??'')||!e.GITHUB_EVENT_PATH)
    throw Error('Protected reviewed-main archive write prerequisites missing');
  const p=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(p.ref!=='refs/heads/main'||p.after!==e.GITHUB_SHA||p.deleted||
    p.forced||p.repository?.full_name!==e.GITHUB_REPOSITORY||
    p.head_commit?.id!==e.GITHUB_SHA||
    !p.head_commit?.message?.includes(MARKER))
    throw Error('Protected one-shot archive deployment marker missing');
}
function migrations():Ledger[]{
  const files=readdirSync('migrations')
    .filter(x=>/^\d{4}_[a-z0-9_-]+\.sql$/.test(x)).sort();
  if(files.indexOf(MIGRATION)!==19||files.length<20)
    throw Error('Archived raw statement migration 0020 not in expected order');
  return files.map(filename=>({filename,checksum:createHash('sha256')
    .update(readFileSync('migrations/'+filename)).digest('hex')}));
}
function validatedLedger(actual:Ledger[],expected:Ledger[]):boolean{
  // No out-of-order 0020, and never auto-deploy unrelated older migrations.
  if(actual.length<19||actual.length>expected.length)
    throw Error('Production schema ledger not ready for additive 0020');
  for(let i=0;i<actual.length;i++)
    if(actual[i].filename!==expected[i].filename||
      actual[i].checksum!==expected[i].checksum)
      throw Error('Reviewed schema migration checksum/order drift');
  return actual.length>=20;
}
function reviewedSeeds():Seed[]{
  const content:unknown=JSON.parse(readFileSync('data/senate-dfl-historical-originals.json','utf8'));
  if(!Array.isArray(content)||content.length<3||content.length>100)
    throw Error('Unexpected historical DFL original seed inventory');
  const seen=new Set<string>(),years=new Set<number>();
  const seeds:Seed[]=[];
  for(const item of content){
    if(!item||typeof item!=='object')throw Error('Invalid archive seed');
    const s=item as Seed;
    if(!Number.isInteger(s.year)||s.year<2023||s.year>2025||
      typeof s.url!=='string'||originalDFLUrl(s.url)!==s.url||seen.has(s.url))
      throw Error('Archive seed outside approved first-party DFL scope');
    seen.add(s.url);years.add(s.year);seeds.push(s);
  }
  if([2023,2024,2025].some(year=>!years.has(year)))
    throw Error('Missing one historic year from reviewed seed list');
  return seeds.sort((a,b)=>b.year-a.year);
}
async function readonly<T>(pool:Pool,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await pool.connect();
  try{
    await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{return await fn(c);}finally{await c.query('ROLLBACK');}
  }finally{c.release();}
}
async function yearCounts(pool:Pool,table:'senate_raw_statements'|'senate_raw_statement_archive_captures'):Promise<YearCount[]>{
  return readonly(pool,async c=>{
    const sql=table==='senate_raw_statements'
      ? "SELECT COALESCE(to_char(published_on,'YYYY'),'undated') AS year,COUNT(*)::text AS total "+
        "FROM senate_raw_statements WHERE source_id='senate_dfl' GROUP BY year ORDER BY year"
      : "SELECT COALESCE(to_char(s.published_on,'YYYY'),'undated') AS year,COUNT(*)::text AS total "+
        "FROM senate_raw_statement_archive_captures a JOIN senate_raw_statements s ON s.source_url=a.source_url "+
        "WHERE s.source_id='senate_dfl' GROUP BY year ORDER BY year";
    const rows=await c.query<{year:string;total:string}>(sql);
    return rows.rows.map(r=>{
      const total=Number(r.total);
      if(!/^(20\d{2}|undated)$/.test(r.year)||!Number.isSafeInteger(total)||total<0)
        throw Error('Unexpected raw archive count');
      return {year:r.year,total};
    });
  });
}
function sum(rows:YearCount[]):number{return rows.reduce((n,row)=>n+row.total,0);}
async function main():Promise<void>{
  let phase='independent_verified_main',pool:Pool|undefined;
  try{
    assertMain();
    const expected=migrations(),seeds=reviewedSeeds();
    phase='existing_vote_predict_neon_default_primary';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({host:target.host,port:target.port,user:target.role,
      password:target.password,database:target.database,
      ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:10000,
      statement_timeout:90000,query_timeout:95000,
      application_name:'votepredict-dfl-wayback-raw'});
    phase='read_only_identity_and_full_ledger_preflight';
    const hasMigration=await readonly(pool,async c=>{
      const identity=await c.query(
        "SELECT current_database() AS db,current_user AS role,"+
        "current_setting('transaction_read_only') AS readonly,"+
        "to_regclass('public.senate_raw_statements')::text AS original_table,"+
        "to_regclass('public.senate_raw_statement_archive_captures')::text AS archive_table");
      const row=identity.rows[0];
      if(!row||row.db!==target.database||row.role!==target.role||row.readonly!=='on'||
        row.original_table!=='senate_raw_statements')
        throw Error('Archive target database/role or prior raw table mismatch');
      const ledger=await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename');
      const already=validatedLedger(ledger.rows,expected);
      if(Boolean(row.archive_table)!==already)
        throw Error('Archive provenance schema/ledger mismatch');
      return already;
    });
    phase='serializable_additive_0020_only';
    if(!hasMigration){
      const sql=readFileSync('migrations/'+MIGRATION,'utf8');
      if(/\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER|REVOKE|GRANT|COPY|EXECUTE)\b/i.test(
        sql.replace(/--[^\n]*/g,'')))throw Error('Nonadditive archive migration rejected');
      const c=await pool.connect();let active=false;
      try {
        await c.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
        active=true;
        const ledger=await c.query<Ledger>(
          'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE');
        if(validatedLedger(ledger.rows,expected))
          throw Error('Archive migration changed during protected preflight');
        await c.query(sql);
        await c.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
          [MIGRATION,expected[19].checksum]);
        await c.query('COMMIT');active=false;
      }finally{
        if(active)try{await c.query('ROLLBACK');}catch{/* report initial failure */}
        c.release();
      }
    }
    phase='read_only_archive_schema_and_counts';
    const before=await yearCounts(pool,'senate_raw_statements');
    const archiveBefore=await yearCounts(pool,'senate_raw_statement_archive_captures');
    const store=new ArchivedSenateDFLStore(pool);
    const already=await store.existing(seeds.map(s=>s.url));
    phase='bounded_first_party_public_wayback_restoration';
    const results:Record<string,number>={inserted:0,alreadyPresent:already.size,
      noCapture:0,unavailable:0,invalidArticle:0,indexErrors:0};
    const insertedByYear:Record<string,number>={};
    let consecutiveErrors=0,stopReason:string|null=null;
    for(const seed of seeds){
      if(already.has(seed.url))continue;
      try{
        const captures=await getWaybackRecords(seed.url,fetch,6);
        if(!captures.length){results.noCapture++;continue;}
        let full=false;
        for(const record of captures.slice(-2).reverse()){
          try{
            const source=await loadArchivedDFL(record);
            if(source.item.published_on?.slice(0,4)!==String(seed.year))
              throw Error('Captured original publication year differs from reviewed source');
            const inserted=await store.insert(source);
            if(inserted){
              results.inserted++;
              insertedByYear[seed.year]=(insertedByYear[seed.year]??0)+1;
            }else results.alreadyPresent++;
            full=true;
            break;
          }catch(error){
            if(error instanceof Error&&/HTTP (429|503)/.test(error.message)){
              stopReason='archive_replay_rate_limited';break;
            }
            results.invalidArticle++;
          }
        }
        if(stopReason)break;
        if(!full)results.unavailable++;
        consecutiveErrors=0;
      }catch(error){
        if(error instanceof Error&&/HTTP (429|503)/.test(error.message)){
          stopReason='archive_index_rate_limited';break;
        }
        results.indexErrors++;
        if(++consecutiveErrors>=5){stopReason='repeated_archive_index_unavailable';break;}
      }
      await sleep(1850);
    }
    phase='rollback_only_post_insert_readback';
    const after=await yearCounts(pool,'senate_raw_statements');
    const archiveAfter=await yearCounts(pool,'senate_raw_statement_archive_captures');
    if(sum(after)-sum(before)!==results.inserted||
      sum(archiveAfter)-sum(archiveBefore)!==results.inserted||
      sum(archiveAfter)>sum(after))
      throw Error('Insert-only DFL historical publication/provenance counts inconsistent');
    const coverage={status:'bounded_archived_original_raw_collection',
      seedCount:seeds.length,byYearAdded:insertedByYear,results,stopReason,
      dflBefore:before,dflAfter:after,archivedBefore:archiveBefore,archivedAfter:archiveAfter,
      captureIsDistinctFromPublication:true,noModelsOrForecastsTouched:true,
      completeHistoricalArchive:false};
    console.log('SENATE_DFL_PUBLIC_ARCHIVE_PRODUCTION='+JSON.stringify(coverage));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,'## Senate DFL independent archive raw recovery\n\n'+
      'New first-party originals: '+results.inserted+'\n\n'+
      'Archive provenance counts by publication year: '+
      archiveAfter.map(r=>r.year+': '+r.total).join(', ')+
      '\n\nNo forecasts/models changed. Archive capture and publication date separate.\n');
    if(results.inserted===0&&sum(archiveAfter)===0)
      throw Error('No full archived first-party original text recovered');
    if(stopReason)throw Error('Archive collector held after partial safe inserts');
  }catch{
    console.error('SENATE_DFL_PUBLIC_ARCHIVE_PRODUCTION_HELD_AT='+phase);
    process.exitCode=1;
  }finally{if(pool)try{await pool.end();}catch{process.exitCode=1;}}
}
void main();
