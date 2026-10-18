/**
 * Protected, scheduled, insert-only raw Senate DFL Wayback backfill from two
 * independently archived publisher-original post sitemaps (Jan 28, 2026).
 * A 24-shard rotation touches each sitemap URL, at most 100 candidates/run.
 * No live publisher requests, stance decisions, votes or model writes.
 */
import {createHash} from 'node:crypto';
import {appendFileSync,readFileSync,readdirSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection}
  from '../src/operations/senate-media-neon-api-readonly.js';
import {ArchivedSenateDFLStore} from '../src/operations/senate-dfl-archive-store.js';
import {getWaybackRecords,loadArchivedDFL}
  from '../src/sources/minnesota/senate-dfl-wayback.js';
import {
  HISTORICAL_DFL_SITEMAPS,fetchArchivedDFLSitemap,
  orderedHistoricalDFLCandidates,historicalDFLSitemapManifest,dflSitemapShard,
  dflOutstandingReviewBatch,
} from '../src/sources/minnesota/senate-dfl-sitemap-archive.js';

const MARKER='SENATE_DFL_SITEMAP_RAW_20261016';
const REVIEW_MARKER='SENATE_DFL_REMAINDER_20261018';
const CRON='47 * * * *';
const MIGRATION='0020_senate_raw_statement_archive_captures.sql';
type Ledger={filename:string;checksum:string};
type Count={year:string;total:number};
type CheckedRun={kind:'scheduled'|'initial-main-push'|'manual-fallback'|'review-remainder';runNumber:number};

function assertReviewedMain():CheckedRun{
  const e=process.env;
  if(process.argv.length!==2||
    e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
    !['push','schedule','workflow_dispatch'].includes(e.GITHUB_EVENT_NAME??'')||
    e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||
    e.VOTEPREDICT_SENATE_SITEMAP_CI!=='true'||
    !/^[0-9a-f]{40}$/.test(e.GITHUB_SHA??'')||!e.GITHUB_EVENT_PATH)
    throw Error('Sitemap archive run must follow independently tested protected main');
  const runNumber=Number(e.GITHUB_RUN_NUMBER);
  if(!Number.isSafeInteger(runNumber)||runNumber<1)
    throw Error('Invalid GitHub workflow run number for deterministic rotation');
  const p=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    schedule?:string;repository?:{full_name?:string};
    head_commit?:{id?:string;message?:string};
  };
  if(p.repository?.full_name!==e.GITHUB_REPOSITORY)
    throw Error('Protected GitHub event repository identity mismatch');
  if(e.GITHUB_EVENT_NAME==='push'){
    if(p.ref!=='refs/heads/main'||p.after!==e.GITHUB_SHA||
      p.deleted||p.forced||p.head_commit?.id!==e.GITHUB_SHA||
      !p.head_commit?.message?.includes(MARKER))
      throw Error('Initial insert-only publisher sitemap backfill was not explicitly marked');
    return {kind:p.head_commit.message.includes(REVIEW_MARKER)
      ?'review-remainder':'initial-main-push',runNumber};
  }
  if(e.GITHUB_EVENT_NAME==='workflow_dispatch'){
    if(p.ref && p.ref!=='refs/heads/main')
      throw Error('Manual archive recovery must target the default main branch');
    return {kind:'manual-fallback',runNumber};
  }
  if(e.GITHUB_EVENT_NAME!=='schedule'||p.schedule!==CRON)
    throw Error('Unexpected protected scheduled archive source');
  return {kind:'scheduled',runNumber};
}
function fullReviewedLedger():Ledger[]{
  const files=readdirSync('migrations')
    .filter(name=>/^\d{4}_[a-z0-9_-]+\.sql$/.test(name)).sort();
  if(files.indexOf(MIGRATION)!==19||files.length<21)
    throw Error('Expected existing DFL provenance migration and questionnaire schema');
  return files.map(filename=>({filename,checksum:createHash('sha256')
    .update(readFileSync('migrations/'+filename)).digest('hex')}));
}
async function readonly<T>(pool:Pool,operation:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{return await operation(client);}finally{await client.query('ROLLBACK');}
  }finally{client.release();}
}
async function countDFL(pool:Pool,kind:'raw'|'captures'):Promise<Count[]>{
  return readonly(pool,async c=>{
    const sql=kind==='raw'
      ? "SELECT COALESCE(to_char(published_on,'YYYY'),'undated') AS year,COUNT(*)::text AS total "+
        "FROM senate_raw_statements WHERE source_id='senate_dfl' GROUP BY year ORDER BY year"
      : "SELECT COALESCE(to_char(s.published_on,'YYYY'),'undated') AS year,COUNT(*)::text AS total "+
        "FROM senate_raw_statement_archive_captures a JOIN senate_raw_statements s ON s.source_url=a.source_url "+
        "WHERE s.source_id='senate_dfl' GROUP BY year ORDER BY year";
    const result=await c.query<{year:string;total:string}>(sql);
    return result.rows.map(row=>{
      const total=Number(row.total);
      if(!/^(20\d{2}|undated)$/.test(row.year)||!Number.isSafeInteger(total)||total<0)
        throw Error('Invalid source/year readback');
      return {year:row.year,total};
    });
  });
}
/** Read-only progress across the complete pinned publisher URL inventory.
 * Candidate URLs include non-statements and posts outside the 2023-2025
 * recovery window: unresolved URLs are not equivalent to missing releases.
 */
async function countStoredSitemapOriginals(pool:Pool,urls:string[]):Promise<number>{
  if(urls.length<300||urls.length>2000||new Set(urls).size!==urls.length)
    throw Error('Unreviewed pinned publisher URL progress inventory');
  return readonly(pool,async c=>{
    const result=await c.query<{total:string}>(
      "SELECT COUNT(*)::text AS total FROM senate_raw_statements "+
      "WHERE source_id='senate_dfl' AND source_url = ANY($1::text[])",[urls]);
    const count=Number(result.rows[0]?.total);
    if(!Number.isSafeInteger(count)||count<0||count>urls.length)
      throw Error('Invalid read-only publisher sitemap URL progress count');
    return count;
  });
}
function sum(rows:Count[]):number{return rows.reduce((total,item)=>total+item.total,0);}
async function main():Promise<void>{
  let phase='reviewed_main_gate',pool:Pool|undefined;
  try{
    const run=assertReviewedMain();
    const ledger=fullReviewedLedger();
    phase='public_original_publisher_sitemap_snapshot';
    const pages=[];
    for(const index of HISTORICAL_DFL_SITEMAPS){
      // Public independent archival XML; original publisher is never contacted.
      pages.push(await fetchArchivedDFLSitemap(index));
      await sleep(1400);
    }
    const candidates=orderedHistoricalDFLCandidates(pages);
    const batch=dflSitemapShard(candidates,run.runNumber);
    const manifest=historicalDFLSitemapManifest(pages);
    let selected=batch.selected;
    const candidateUrls=candidates.map(c=>c.url);
    phase='existing_votepredict_neon_default_primary';
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
      application_name:'votepredict-dfl-wayback-sitemap-raw'});
    phase='read_only_raw_and_capture_schema_ledger_preflight';
    await readonly(pool,async c=>{
      const identity=await c.query(
        "SELECT current_database() AS db,current_user AS role,"+
        "current_setting('transaction_read_only') AS readonly,"+
        "to_regclass('public.senate_raw_statements')::text AS raw_table,"+
        "to_regclass('public.senate_raw_statement_archive_captures')::text AS capture_table");
      const targetRow=identity.rows[0];
      if(!targetRow||targetRow.db!==target.database||targetRow.role!==target.role||
        targetRow.readonly!=='on'||targetRow.raw_table!=='senate_raw_statements'||
        targetRow.capture_table!=='senate_raw_statement_archive_captures')
        throw Error('Protected production source or raw/provenance tables differ from review');
      const actual=(await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows;
      if(actual.length<20||actual.length>ledger.length)
        throw Error('Production schema migration ledger outside accepted reviewed prefix');
      for(let i=0;i<actual.length;i++){
        if(actual[i].filename!==ledger[i].filename||actual[i].checksum!==ledger[i].checksum)
          throw Error('Production schema ledger checksum/order drift');
      }
      const privilege=await c.query<{raw:boolean;captures:boolean}>(
        "SELECT has_table_privilege(current_user,'public.senate_raw_statements','INSERT') AS raw,"+
        "has_table_privilege(current_user,'public.senate_raw_statement_archive_captures','INSERT') AS captures");
      if(!privilege.rows[0]?.raw||!privilege.rows[0]?.captures)
        throw Error('Missing scoped raw statement or archival provenance insert privileges');
    });
    phase='read_only_before_raw_year_counts';
    const before=await countDFL(pool,'raw');
    phase='read_only_before_archive_capture_year_counts';
    const captureBefore=await countDFL(pool,'captures');
    phase='read_only_before_complete_publisher_url_progress';
    const publisherStoredBefore=await countStoredSitemapOriginals(pool,candidateUrls);
    if(run.kind==='review-remainder'){
      phase='read_only_select_unstored_originals_for_approved_one_shot';
      const stored=await readonly(pool,async c=>{
        const rows=await c.query<{source_url:string}>(
          "SELECT source_url FROM senate_raw_statements WHERE source_id='senate_dfl' "+
          "AND source_url=ANY($1::text[])",[candidateUrls]);
        return new Set(rows.rows.map(row=>row.source_url));
      });
      if(stored.size!==publisherStoredBefore)
        throw Error('Reviewed one-shot source URLs disagree with prior production count');
      selected=dflOutstandingReviewBatch(candidates,stored,225);
    }
    console.log('SENATE_DFL_SITEMAP_RUN='+JSON.stringify({
      mode:run.kind,runNumber:run.runNumber,
      shard:run.kind==='review-remainder'?null:batch.shard,
      shardCount:batch.shardCount,sitemapCandidates:candidates.length,
      selected:selected.length,unresolvedOnly:run.kind==='review-remainder',
      publisherSitemapManifest:manifest,
      sitemapFiles:pages.map(p=>({id:p.id,sha256:p.sha256,entries:p.urlEntries,
        candidates:p.candidateUrls.length})),
    }));
    phase='read_only_original_url_deduplication';
    const store=new ArchivedSenateDFLStore(pool);
    const already=new Set<string>();
    // One-shot review may exceed the store's 100-URL bounded query limit.
    for(let offset=0;offset<selected.length;offset+=100){
      const present=await store.existing(selected.slice(offset,offset+100).map(s=>s.url));
      for(const url of present)already.add(url);
    }
    phase='bounded_insert_only_first_party_archive_restoration';
    const stats={considered:selected.length,alreadyPresent:already.size,
      attempted:0,inserted:0,noCapture:0,unavailable:0,
      ineligibleOrInvalid:0,indexErrors:0};
    const byYearAdded:Record<string,number>={};
    const reviewedFailures:Array<{url:string;reason:string}>=[];
    let consecutiveErrors=0,stopReason:string|null=null;
    for(const seed of selected){
      if(already.has(seed.url))continue;
      stats.attempted++;
      let recovered:Awaited<ReturnType<typeof loadArchivedDFL>>|null=null;
      const failedReasons=new Set<string>();
      try{
        const records=await getWaybackRecords(seed.url,fetch,6);
        if(records.length===0){
          stats.noCapture++;
          failedReasons.add('no_200_html_capture_in_archive_index');
        }else{
          // During the expressly reviewed cleanup, revisit all six bounded
          // captures rather than only the most recent two. Never bypass 429/503.
          const replayRecords=run.kind==='review-remainder'?records:records.slice(-2);
          for(const record of replayRecords.slice().reverse()){
            try{
              recovered=await loadArchivedDFL(record);
              break;
            }catch(error){
              const reason=error instanceof Error?error.message:'unexpected replay error';
              if(/HTTP (429|503)\b/.test(reason)){
                stopReason='archive_replay_rate_limited';break;
              }
              failedReasons.add(/Original publication date missing or outside 2023-2025/.test(reason)
                ?'publication_date_not_2023_2025':
                /lacks complete first-party statement text/.test(reason)
                  ?'incomplete_or_non_statement_html':
                /Original archived HTML unavailable/.test(reason)
                  ?'archived_html_unavailable':
                /Archive replay returned non-HTML/.test(reason)
                  ?'replay_not_html':'archived_html_invalid_or_unavailable');
              stats.ineligibleOrInvalid++;
            }
          }
          if(!recovered&&!stopReason)stats.unavailable++;
        }
        consecutiveErrors=0;
      }catch(error){
        const reason=error instanceof Error?error.message:'unexpected index error';
        if(/HTTP (429|503)\b/.test(reason))
          stopReason='archive_index_rate_limited';
        else{
          stats.indexErrors++;
          failedReasons.add('archive_index_fetch_or_format_error');
          if(++consecutiveErrors>=5)
            stopReason='repeated_archive_index_unavailable';
        }
      }
      if(!recovered&&run.kind==='review-remainder')
        reviewedFailures.push({url:seed.url,
          reason:stopReason??[...failedReasons].sort().join('|')||'no_usable_archive_capture'});
      if(stopReason)break;
      if(recovered){
        // Database failures must abort this protected job; never misclassify
        // a failed SQL insert as a publisher archive/network error.
        const added=await store.insert(recovered);
        if(added){
          stats.inserted++;
          const year=recovered.item.published_on!.slice(0,4);
          byYearAdded[year]=(byYearAdded[year]??0)+1;
        }else stats.alreadyPresent++;
      }
      // Pace *every* external request, including missing captures and errors.
      await sleep(1850);
    }
    phase='read_only_production_source_year_and_capture_lineage_readback';
    const after=await countDFL(pool,'raw'),captureAfter=await countDFL(pool,'captures');
    const publisherStoredAfter=await countStoredSitemapOriginals(pool,candidateUrls);
    // Public first-party URLs only: bounded exact inventory for a manual
    // 2023-2025 eligibility/recoverability review, never raw text or secrets.
    // A missing URL is a candidate, NOT proof of a missing eligible statement.
    phase='read_only_unresolved_first_party_url_inventory';
    const unresolved=await readonly(pool,async c=>{
      const rows=await c.query<{source_url:string}>(
        "SELECT source_url FROM senate_raw_statements WHERE source_id='senate_dfl' "+
        "AND source_url=ANY($1::text[])",[candidateUrls]);
      const stored=new Set(rows.rows.map(row=>row.source_url));
      if(stored.size!==publisherStoredAfter)
        throw Error('DFL public URL inventory and readback counts disagree');
      return candidates.flatMap((seed,index)=>stored.has(seed.url)?[]:[{
        url:seed.url,sitemapId:seed.sitemapId,
        lastModifiedOn:seed.lastModifiedOn,shard:index%24,
      }]);
    });
    if(unresolved.length!==candidates.length-publisherStoredAfter)
      throw Error('Unresolved DFL original URL inventory size differs from readback');
    const unresolvedShards=Array.from({length:24},(_,shard)=>({
      shard,count:unresolved.filter(row=>row.shard===shard).length,
    }));
    console.log('SENATE_DFL_SITEMAP_UNRESOLVED_PUBLIC_URLS='+JSON.stringify({
      manifest,inventorySize:candidates.length,stored:publisherStoredAfter,
      unresolvedCandidates:unresolved.length,
      missingUrlIsNotProofOfEligibleStatement:true,
      byShard:unresolvedShards,
      urls:unresolved,
    }));
    if(publisherStoredAfter-publisherStoredBefore!==stats.inserted||
      sum(after)-sum(before)!==stats.inserted||
      sum(captureAfter)-sum(captureBefore)!==stats.inserted||
      sum(captureAfter)>sum(after))
      throw Error('Raw original and capture provenance inserts do not reconcile');
    const report={status:stopReason?'paused_archive_unavailable_or_rate_limited':'archived_sitemap_shard_raw_backfill',mode:run.kind,
      shard:run.kind==='review-remainder'?null:batch.shard,shardCount:batch.shardCount,
      inventorySize:candidates.length,selectedCount:selected.length,
      publisherUrlProgress:{storedBefore:publisherStoredBefore,storedAfter:publisherStoredAfter,
        unresolvedCandidateUrls:candidates.length-publisherStoredAfter,
        notAllCandidatesAreEligibleHistoricalStatements:true},
      publisherSitemapManifest:manifest,stats,byYearAdded,stopReason,
      before,after,captureBefore,captureAfter,
      publicationDateIsNotCaptureDate:true,noForecasterOrModelWrites:true,
      entireHistoricalArchiveComplete:false};
    console.log('SENATE_DFL_SITEMAP_PRODUCTION='+JSON.stringify(report));
    if(run.kind==='review-remainder')
      console.log('SENATE_DFL_SITEMAP_REMAINDER_REVIEW='+JSON.stringify({
        selected:selected.length,attempted:stats.attempted,inserted:stats.inserted,
        indexedCandidateUrlsStillUnstored:candidates.length-publisherStoredAfter,
        reviewFailures:reviewedFailures,
        stoppedEarly:stopReason!==null,stopReason,
        historicalCompletionNotImplied:true,
      }));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## Senate DFL original archived publisher sitemap recovery\n\n'+
      'Selection: '+(run.kind==='review-remainder'?'review-only outstanding originals':
        'shard '+(batch.shard+1)+'/'+batch.shardCount)+
      '; candidates: '+selected.length+'; inserted: '+stats.inserted+
      '; archive pause: '+(stopReason??'none')+'\n\n'+
      'Publisher sitemap URLs currently stored: '+publisherStoredAfter+'/'+candidates.length+
      ' (remaining candidates are not all eligible historical statements)\n\n'+
      'Captured first-party original counts: '+captureAfter.map(r=>r.year+': '+r.total).join(', ')+
      '\n\nPublisher post sitemap manifest: '+manifest+
      '\n\nOriginal publication date and Wayback capture timestamp are distinct. No models or votes changed.\n');
    // 429/503 is a publisher-archive restriction, not a code deployment
    // failure. Stop immediately, retain only verified insert-only additions,
    // and make the next scheduled hour a fresh, bounded attempt at a different
    // source shard. Never bypass the archive or request the live DFL site.
    if(stopReason)
      console.warn('SENATE_DFL_SITEMAP_PAUSED='+JSON.stringify({
        reason:stopReason,shard:batch.shard,attempted:stats.attempted,
        inserted:stats.inserted,willRetryOnFutureHourlyRotation:true,
        isHistoricalCollectionComplete:false,
      }));
  }catch(error){
    // Never log credentials, query parameters or source contents. SQLSTATE and
    // a bounded diagnostic category are enough to diagnose read-only failures.
    const pg=error as {code?:unknown;name?:unknown;message?:unknown};
    const code=typeof pg.code==='string' && /^[A-Z0-9]{5}$/.test(pg.code)
      ? pg.code : 'none';
    const kind=error instanceof Error ? error.name.slice(0,60) : 'non_error';
    const diagnostic=error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted]')
        .replace(/https?:\/\/\S+/gi,'[redacted url]').slice(0,180)
      : 'unavailable';
    console.error('SENATE_DFL_SITEMAP_PRODUCTION_HELD_AT='+JSON.stringify({
      phase,kind,sqlstate:code,diagnostic,
    }));
    process.exitCode=1;
  }finally{
    if(pool)try{await pool.end();}catch{process.exitCode=1;}
  }
}
void main();
