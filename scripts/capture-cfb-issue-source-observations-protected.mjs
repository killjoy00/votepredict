/**
 * Protected prospective original-source snapshots for issue-finance research.
 * Every remote observation is a NEW fetched-at proof only. Never backdate
 * published_at, set historical eligibility, or change models.
 * Logs: aggregate counts only; no source text, URLs, donor names, credentials.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 validateCfbIssueSourceManifest,fetchCfbIssueSource
} from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {discoverCfbIssueFirstPartyPages}
 from '../src/evidence/cfb-issue-first-party-discovery-v3.mjs';

const MIGRATION='0031_cfb_issue_finance_source_observations.sql';
const MARKER='SENATE_864_CFB_ISSUE_SOURCE_CAPTURE_V1';
const PUBLISHED_SNAPSHOT_SCHEMA='cfb-864-prospective-first-party-original-html-v1';
const ALLOWED_EVENTS=new Set(['push','schedule','workflow_dispatch']);
function sha(x){return createHash('sha256').update(x).digest('hex');}
function guardedEnv(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_REF!=='refs/heads/main'||
  !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||
  e.GITHUB_RUN_ATTEMPT!=='1'||
  !ALLOWED_EVENTS.has(e.GITHUB_EVENT_NAME)||
  e.VOTEPREDICT_CFB_ISSUE_CAPTURE_KEYLESS_PASSED!=='true'||
  (e.GITHUB_EVENT_NAME==='push'&&
   e.VOTEPREDICT_CFB_ISSUE_CAPTURE_MARKER!=='true'))
  throw Error('Reviewed keyless first-attempt main source observation required');
}
async function ensureMigration(client){
 const files=new Map(readdirSync('migrations')
  .filter(x=>/^\d{4}_[\w-]+\.sql$/.test(x))
  .map(x=>[x,sha(readFileSync('migrations/'+x))]));
 if(!files.has(MIGRATION))throw Error('Pinned new additive source ledger migration absent');
 let opened=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  opened=true;
  const rows=(await client.query(
   'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
  )).rows;
  if(rows.length<20||rows.length>100)throw Error('Unexpected existing migration ledger');
  for(const row of rows)
   if(files.get(row.filename)!==row.checksum)
    throw Error('Existing migration ledger differs from source');
  if(!rows.some(x=>x.filename==='0030_cfb_finance_report_v2_raw_spans.sql'))
   throw Error('Expected original-finance provenance prerequisite missing');
  if(!rows.some(x=>x.filename===MIGRATION)){
   await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
   await client.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
    [MIGRATION,files.get(MIGRATION)]);
  }
  await client.query('COMMIT');opened=false;
 }finally{if(opened)await client.query('ROLLBACK').catch(()=>{});}
}
export function safeSourceCaptureCounts(outcomes){
 const statuses=new Set(['captured','robots_disallowed','robots_unavailable',
  'fetch_unavailable','source_oversize','unsupported_content_type',
  'non_utf8','unusable_html','invalid_clock','invalid_source']);
 const counts=Object.create(null);
 for(const outcome of outcomes){
  if(!statuses.has(outcome.status))throw Error('Unexpected source status');
  counts[outcome.status]=(counts[outcome.status]??0)+1;
 }
 return Object.fromEntries(Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0])));
}
export async function main(){
 guardedEnv(process.env);
 const manifest=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8'));
 const sources=validateCfbIssueSourceManifest(manifest);
 const discoveryPolicy=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-first-party-discovery-v3.json','utf8'));
 const existing=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({
  host:existing.host,port:existing.port,user:existing.role,
  password:existing.password,database:existing.database,
  ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:15000,statement_timeout:180000,
  query_timeout:180000,application_name:'votepredict-cfb-issue-original-source-v1',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'
 });
 const client=await pool.connect();
 try{
  const who=(await client.query(
   'SELECT current_database() AS db,current_user AS role, '+
   "current_setting('transaction_read_only') AS ro"
  )).rows[0];
  if(who?.db!==existing.database||who?.role!==existing.role||who?.ro!=='off')
   throw Error('Unexpected existing primary Neon database identity');
  await ensureMigration(client);
  const outcomes=[];
  // First fetch only the pinned originals. Discover URLs from the FRESH
  // verified first-party archive bytes, never from old stored page datelines.
  for(const source of sources)
   outcomes.push(await fetchCfbIssueSource(source));
  const freshIndexes=outcomes.filter(x=>x.status==='captured')
   .map(x=>x.snapshot);
  const discovered=discoverCfbIssueFirstPartyPages({
   indexSnapshots:freshIndexes,manifest:sources,policy:discoveryPolicy
  });
  // Each newly discovered article still goes through the same host, robots,
  // strict redirect, maximum body, rate-limit and raw-original checks.
  const discoveryOutcomes=[];
  for(const source of discovered){
   const outcome=await fetchCfbIssueSource(source);
   discoveryOutcomes.push(outcome);
   outcomes.push(outcome);
  }
  let newVersions=0,unchangedVersions=0;
  const captures=outcomes.filter(x=>x.status==='captured').map(x=>x.snapshot);
  if(captures.length){
   let opened=false;
   try{
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE');
    opened=true;
    for(const s of captures){
     const result=await client.query([
      'INSERT INTO cfb_issue_finance_source_observations',
      '(source_id,organization_group,source_role,source_url,final_url,',
      'html_sha256,content_type,raw_html_bytes,observed_at,claim_status,',
      'historical_asof_eligible,mechanically_actionable,model_weight)',
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      'ON CONFLICT (source_id,html_sha256) DO NOTHING'
     ].join(' '),[
      s.sourceId,s.organizationGroup,s.sourceRole,s.sourceUrl,s.finalUrl,
      s.htmlSha256,s.contentType,s.rawHtmlBytes,s.observedAt,
      'unverified_raw_observation',false,false,0
     ]);
     newVersions+=result.rowCount;
     unchangedVersions+=result.rowCount?0:1;
    }
    await client.query('COMMIT');opened=false;
   }finally{if(opened)await client.query('ROLLBACK').catch(()=>{});}
  }
  const saved=(await client.query([
   'SELECT COUNT(*)::int AS versions,',
   'COUNT(DISTINCT source_id)::int AS sources,',
   "COUNT(*) FILTER (WHERE historical_asof_eligible OR mechanically_actionable",
   'OR model_weight <> 0)::int AS unsafe_rows',
   'FROM cfb_issue_finance_source_observations'
  ].join(' '))).rows[0];
  // Prospective discovery legitimately accumulates NEW stable source IDs
  // across runs. The explicit per-run discovery bound is validated above.
  if(saved.unsafe_rows!==0||saved.versions<newVersions||
   saved.sources>saved.versions)throw Error('Source observation invariant failed');
  const report={
   schema:PUBLISHED_SNAPSHOT_SCHEMA,
   sourceManifestSize:sources.length,
   firstPartyReleaseIndexCaptured:freshIndexes.some(
    x=>x.sourceId==='education-mn-media-releases-index'),
   firstPartyReleaseUrlsDiscovered:discovered.length,
   discoveredOriginalReleasesCaptured:discoveryOutcomes
    .filter(x=>x.status==='captured').length,
   attemptedOriginalSourceRequests:outcomes.length,
   byDisposition:safeSourceCaptureCounts(outcomes),
   capturedOriginalHtmlThisRun:captures.length,
   newImmutableSourceVersions:newVersions,
   existingImmutableSourceVersionsReused:unchangedVersions,
   cumulativeImmutableVersions:saved.versions,
   cumulativeDistinctSourceIds:saved.sources,
   exactHistoricalTransactionMatchesWritten:0,
   retrospectiveSourceDatesBackfilled:0,
   historicalAsOfEligibilityUnchanged:true,
   forecastsAndServingUnchanged:true,
   rawSourceTextOrDonorDetailsLogged:false
  };
  console.log('CFB_864_ISSUE_SOURCE_SAFE_COUNTS '+JSON.stringify(report));
  if(captures.length===0)process.exitCode=1;
 }finally{client.release(true);await pool.end();}
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/capture-cfb-issue-source-observations-protected.mjs'))
 main().catch(()=>{console.error('CFB_864_ISSUE_SOURCE_CAPTURE_HELD');process.exitCode=1;});
