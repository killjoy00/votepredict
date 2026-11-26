import { createHash } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { classify2027CollectionUrl,COLLECTION_LIMITS,type CollectionSourceReceipt,type CollectionCounters } from '@/sources/minnesota/2027-collection-source';
import { minnesotaLocalDate } from '@/sources/minnesota/sessions';
import { databaseTargetFingerprint,readReleaseBinding } from './release-readiness';

export const DAILY_COLLECTION_PLAN = Object.freeze({session:'2027-2028',timezone:'America/Chicago',
  proposedCadence:'once daily',productionScheduleEnabled:false,limits:COLLECTION_LIMITS,
  stages:['catalog','status','initial_text','health'] as const,
  forecastsEnabled:false,voteIngestionEnabled:false,p8CaptureEnabled:false,vercelRequired:false});
export const DAILY_COLLECTION_REPORT_TYPE='application/vnd.votepredict.2027-collection-report+json';
export const DAILY_COLLECTION_SOURCE_RECEIPT_TYPE='application/vnd.votepredict.2027-source-observation+json';
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export type CollectionHealth={knownBills:number;houseBills:number;senateBills:number;neverObserved:number;staleStatus:number;failedStatus:number;missingInitialText:number};
export type CollectionReport={schemaVersion:'2027-collection-report-v1';session:'2027-2028';runId:string;day:string;startedAt:string;finishedAt:string;
  state:'completed_batch'|'partial_failure';stages:Record<string,unknown>;before:CollectionHealth;after:CollectionHealth|null;
  counters:CollectionCounters;alerts:string[];previousHeartbeat:CollectionHeartbeat;officialUniverseVerified:false;fullDailyCoverageVerified:false;productionForecastingActive:false};

export function assertDailyCollectionRun(env:Record<string,string|undefined>,now:Date):{runId:string;day:string;databaseUrl:string;role:string;fingerprint:string}{
  const day=minnesotaLocalDate(now);
  if(env.VERCEL||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||env.GITHUB_REF!=='refs/heads/main'||
    env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/2027-daily-collection.yml@refs/heads/main'||
    env.VOTEPREDICT_2027_COLLECTION_AUTHORIZED!=='true'||env.GITHUB_RUN_ATTEMPT!=='1'||
    day<'2027-01-12'||day>'2028-12-31'||!/^[0-9]{1,20}$/.test(env.GITHUB_RUN_ID??'')){
    throw Error('2027 live collection not authorized or outside session window');
  }
  const databaseUrl=env.VOTEPREDICT_2027_COLLECTOR_DATABASE_URL??'';
  const role=env.VOTEPREDICT_2027_COLLECTOR_ROLE??'';
  const fingerprint=env.VOTEPREDICT_2027_COLLECTOR_DATABASE_FINGERPRINT??'';
  let url:URL;try{url=new URL(databaseUrl)}catch{throw Error('Protected collector connection is not configured');}
  if(!/^[a-f0-9]{64}$/.test(fingerprint)||databaseTargetFingerprint(databaseUrl)!==fingerprint||
    !url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler.')||!url.password||
    !/^[a-z][a-z0-9_]{1,62}$/.test(role)||decodeURIComponent(url.username)!==role||
    !['require','verify-full'].includes(url.searchParams.get('sslmode')??'')||
    [...url.searchParams.keys()].some(key=>!['sslmode','channel_binding'].includes(key))){
    throw Error('Protected collector connection does not match approved target/role');
  }
  return {runId:env.GITHUB_RUN_ID+':1',day,databaseUrl,role,fingerprint};
}

/** Uses the existing migration 0037 content-addressed, trigger-protected store.
 * Retains exact received entity bytes; acceptance is not an external timestamp. */
async function storeBlob(db:Pick<PoolClient,'query'>,body:Buffer,mediaType:string,requireType=false):Promise<string>{
  const sha=digest(body);
  await db.query('INSERT INTO evidence_content_blobs(sha256,body,media_type) VALUES($1,$2,$3) ON CONFLICT(sha256) DO NOTHING',[sha,body,mediaType]);
  const stored=(await db.query<{sha256:string;bytes:number;verified:boolean;media_type:string;accepted_at:Date}>(
    'SELECT sha256,media_type,accepted_at,octet_length(body)::int AS bytes,encode(sha256(body),\'hex\')=sha256 AS verified FROM evidence_content_blobs WHERE sha256=$1',[sha])).rows[0];
  if(!stored||stored.sha256!==sha||stored.bytes!==body.length||!stored.verified||(requireType&&stored.media_type!==mediaType))throw Error('Immutable archive readback mismatch');
  return sha;
}
export async function archive2027Source(db:Pick<Pool,'connect'>,receipt:CollectionSourceReceipt,body:Buffer):Promise<string>{
  if(receipt.schemaVersion!=='2027-source-observation-v1'||receipt.session!=='2027-2028'||
    classify2027CollectionUrl(receipt.sourceUrl)!==receipt.sourceKind||
    !/^[0-9]{1,20}:[0-9]{1,6}$/.test(receipt.runId)||
    !Number.isInteger(receipt.httpStatus)||receipt.httpStatus<100||receipt.httpStatus>599||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.observedAt)||
    !Number.isFinite(Date.parse(receipt.observedAt))||
    digest(body)!==receipt.responseBodySha256||body.length!==receipt.responseBodyBytes||
    body.length<1||body.length>COLLECTION_LIMITS.maxResponseBytes)throw Error('Source body does not match receipt');
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='10s'");
    await storeBlob(client,body,'application/octet-stream');
    const receiptSha=await storeBlob(client,Buffer.from(JSON.stringify(receipt)),DAILY_COLLECTION_SOURCE_RECEIPT_TYPE,true);
    const accepted=(await client.query<{accepted_at:Date}>(
      'SELECT accepted_at FROM evidence_content_blobs WHERE sha256=$1',[receiptSha])).rows[0]?.accepted_at;
    if(!accepted||Math.abs(accepted.getTime()-Date.parse(receipt.observedAt))>300000)
      throw Error('Acquisition and independent DB acceptance clocks disagree');
    await client.query('COMMIT');return receiptSha;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function storeCollectionEvent(db:Pick<PoolClient,'query'>,event:Record<string,unknown>):Promise<string>{
  return storeBlob(db,Buffer.from(JSON.stringify(event)),DAILY_COLLECTION_REPORT_TYPE,true);
}

export async function readCollectionHealth(db:Pick<Pool,'query'>):Promise<CollectionHealth>{
  const result=await db.query<CollectionHealth>(`
    SELECT count(*)::int AS "knownBills",count(*) FILTER(WHERE c.slug='house')::int AS "houseBills",
      count(*) FILTER(WHERE c.slug='senate')::int AS "senateBills",
      count(*) FILTER(WHERE b.metadata #>> '{revisorLiveStatus,fetchedAt}' IS NULL)::int AS "neverObserved",
      count(*) FILTER(WHERE NULLIF(b.metadata #>> '{revisorLiveStatus,fetchedAt}','')::timestamptz < now()-interval '24 hours')::int AS "staleStatus",
      count(*) FILTER(WHERE b.metadata #>> '{revisorLiveStatusAttempt,state}'='failed')::int AS "failedStatus",
      count(*) FILTER(WHERE bv.id IS NULL OR bv.raw_text IS NULL OR bv.text_hash IS NULL)::int AS "missingInitialText"
    FROM bills b JOIN legislative_sessions s ON s.id=b.session_id AND s.slug='2027-2028'
    JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
    LEFT JOIN bill_versions bv ON bv.bill_id=b.id AND bv.version_key=b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
    WHERE b.metadata #>> '{revisorUniverse,liveSync}'='true'`);
  return result.rows[0];
}

/** Reject broad/owner credentials and unverified production schema. Does not
 * provision roles, alter privileges, initialize sessions or execute forecasts. */
export async function verifyCollectionTarget(db:Pool,expected:{role:string;fingerprint:string},actualFingerprint:string|null){
  const binding=await readReleaseBinding(db,actualFingerprint,expected.fingerprint);
  if(!binding.verified)throw Error('Collector schema or target binding unverified');
  const client=await db.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'");
    const role=(await client.query<{role:string;unsafe:boolean;archiveInsert:boolean;archiveSelect:boolean;archiveMutate:boolean;forbidden:boolean}>(`
      SELECT current_user::text AS role,
        (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls OR
          pg_has_role(current_user,d.datdba,'MEMBER')) AS unsafe,
        has_table_privilege(current_user,'public.evidence_content_blobs','INSERT') AS "archiveInsert",
        has_table_privilege(current_user,'public.evidence_content_blobs','SELECT') AS "archiveSelect",
        (has_table_privilege(current_user,'public.evidence_content_blobs','UPDATE') OR has_table_privilege(current_user,'public.evidence_content_blobs','DELETE') OR has_table_privilege(current_user,'public.evidence_content_blobs','TRUNCATE')) AS "archiveMutate",
        EXISTS(SELECT 1 FROM unnest(ARRAY['public.forecasts','public.forecast_schedules','public.forecast_revisions','public.vote_events','public.member_votes','public.memberships','public.legislative_sessions']) AS tables(name)
          WHERE has_table_privilege(current_user,tables.name,'INSERT') OR has_table_privilege(current_user,tables.name,'UPDATE') OR has_table_privilege(current_user,tables.name,'DELETE') OR has_table_privilege(current_user,tables.name,'TRUNCATE')) AS forbidden
      FROM pg_roles r JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`)).rows[0];
    if(!role||role.role!==expected.role||role.unsafe||!role.archiveInsert||!role.archiveSelect||role.archiveMutate||role.forbidden)
      throw Error('Collector role is missing restricted insert/read privileges or has unsafe privileges');
    const roster=(await client.query<{active:boolean;house:number;senate:number}>(`
      SELECT s.is_current AS active,count(DISTINCT m.district) FILTER(WHERE c.slug='house')::int AS house,
      count(DISTINCT m.district) FILTER(WHERE c.slug='senate')::int AS senate
      FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
      LEFT JOIN memberships m ON m.session_id=s.id
      LEFT JOIN chambers c ON c.id=m.chamber_id
      WHERE s.slug='2027-2028' GROUP BY s.id,s.is_current`)).rows[0];
    if(!roster?.active||roster.house!==134||roster.senate!==67)throw Error('2027 active roster missing required seat coverage');
  }finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}

export async function readCollectionEvents(db:Pick<PoolClient,'query'>,day:string){
  // Only collector report blobs, not evidence contents/outcomes. Bound the
  // window to this Chicago day using the independent DB acceptance clock.
  const result=await db.query<{event:Record<string,unknown>}>(`
    SELECT convert_from(body,'UTF8')::jsonb AS event
      FROM evidence_content_blobs WHERE media_type=$1
       AND accepted_at >= $2::date::timestamp AT TIME ZONE 'America/Chicago'
       AND accepted_at < ($2::date+1)::timestamp AT TIME ZONE 'America/Chicago'
      ORDER BY accepted_at,sha256 LIMIT 20`,[DAILY_COLLECTION_REPORT_TYPE,day]);
  return result.rows.map(row=>row.event);
}
export function assertDailyRunAvailable(events:readonly Record<string,unknown>[],day:string,runId:string){
  const today=events.filter(e=>e.day===day);
  // Two starts max per day, only if the first failed or was interrupted.
  // A successful bounded batch is never repeated on the same day.
  if(today.some(e=>e.state==='completed_batch'||e.runId===runId)||today.filter(e=>e.state==='started').length>=2)
    throw Error('Daily collection attempt already completed or retry budget exhausted');
}
export function collectionAlerts(before:CollectionHealth,after:CollectionHealth|null,discovered:number|null,counters:CollectionCounters,phaseFailed:boolean):string[]{
  const alerts:string[]=[];
  if(phaseFailed||counters.failed)alerts.push('SOURCE_OR_COLLECTION_FAILURE');
  if(counters.archived!==counters.requests)alerts.push('UNARCHIVED_SOURCE_ATTEMPTS');
  if(discovered===0)alerts.push('ZERO_CATALOG_YIELD');
  if(discovered!==null&&discovered<before.knownBills)alerts.push('CATALOG_COVERAGE_REGRESSION');
  if(!after)alerts.push('HEALTH_READBACK_UNAVAILABLE');
  else{
    if(after.neverObserved>0||after.staleStatus>0)alerts.push('STATUS_BACKLOG_OR_STALE');
    if(after.failedStatus>0)alerts.push('STATUS_FAILURES');
    if(after.missingInitialText>0)alerts.push('INITIAL_TEXT_BACKLOG');
  }
  return alerts;
}

export type CollectionHeartbeat={
  expectedDay:string;state:'not_due'|'missing'|'interrupted'|'partial_failure'|'completed_batch';
  starts:number;terminalRecords:number;unclosedStarts:number;alerts:string[];
};
export function previousCollectionDay(day:string):string{
  const date=new Date(day+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)throw Error('Invalid collection day');
  date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}
export function inspectCollectionHeartbeat(events:readonly Record<string,unknown>[],expectedDay:string):CollectionHeartbeat{
  const rows=events.filter(e=>e.day===expectedDay);
  const starts=rows.filter(e=>e.state==='started');
  const terminal=rows.filter(e=>e.state==='completed_batch'||e.state==='partial_failure');
  const unclosed=starts.filter(e=>!terminal.some(t=>t.runId===e.runId)).length;
  const completed=terminal.some(e=>e.state==='completed_batch');
  const alerts:string[]=[];
  let state:CollectionHeartbeat['state'];
  if(expectedDay<'2027-01-12')state='not_due';
  else if(starts.length===0){state='missing';alerts.push('PREVIOUS_DAILY_COLLECTION_MISSING');}
  else if(completed){state='completed_batch';if(unclosed>0)alerts.push('PREVIOUS_COLLECTION_INTERRUPTED_ATTEMPT');}
  else if(unclosed>0){state='interrupted';alerts.push('PREVIOUS_DAILY_COLLECTION_INTERRUPTED');}
  else{state='partial_failure';alerts.push('PREVIOUS_DAILY_COLLECTION_PARTIAL_FAILURE');}
  return {expectedDay,state,starts:starts.length,terminalRecords:terminal.length,unclosedStarts:unclosed,alerts};
}
