import { createHash } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { canonicalPublicUrl,fetchPublicPage,publicPageMentionsPerson } from '@/evidence/public-http';
import { databaseTargetFingerprint,readReleaseBinding } from './release-readiness';
import { storeBlob } from './2027-daily-collection';

export const PRESEASON_LIMITS=Object.freeze({sources:29,maxPageBytes:2*1024*1024,maxBytes:32*1024*1024,timeoutMs:10000,runMs:6*60*1000});
export const PRESEASON_RECEIPT_TYPE='application/vnd.votepredict.2027-preseason-source-review+json';
export const PRESEASON_EVENT_TYPE='application/vnd.votepredict.2027-preseason-archive-event+json';
const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const rosterDigest='3b062058cbe77d2ff6caad8719a65535ad75849d48e0c627c9b460ef48df17bd';
type RosterMember={lrlId:string;seat:string;name:string;electionName:string};
type Lead={url:string;kind:string;publisher:string};
type LeadMember={lrlId:string;seat:string;name:string;sources:Lead[]};
type LeadFile={schemaVersion:string;rosterSha256:string;members:LeadMember[]};
export type PreseasonTarget=RosterMember&{url:string;kind:string;publisher:string;rosterSha256:string};
export type PreseasonReceipt={schemaVersion:'2027-preseason-source-review-v1';session:'2027-2028';runId:string;rosterSha256:string;lrlId:string;seat:string;sourceUrl:string;sourceKind:string;publisher:string;observedAt:string;bodySha256:string;bodyBytes:number;claimedPublicationAt:string|null;identityNameMentioned:boolean;rawBodyRetained:boolean;reviewRequired:true;servingEligible:false;canonicalWriteAllowed:false;modelWeight:0};

export function buildPreseasonTargets(rosterRaw:string,manual:LeadFile,depth:LeadFile,cohort:{summary:{rosterSha256:string};targets:RosterMember[]}):PreseasonTarget[]{
  const roster=JSON.parse(rosterRaw) as {session:string;complete:boolean;members:RosterMember[]};
  if(hash(rosterRaw)!==rosterDigest||roster.session!=='2027-2028'||!roster.complete||roster.members.length!==201||
    new Set(roster.members.map(m=>m.lrlId)).size!==201||new Set(roster.members.map(m=>m.seat)).size!==201||
    cohort.summary.rosterSha256!==rosterDigest||cohort.targets.length!==51||new Set(cohort.targets.map(x=>x.lrlId)).size!==51||
    manual.schemaVersion!=='2027-incoming-evidence-manual-discovery-v1'||depth.schemaVersion!=='2027-incoming-evidence-depth-review-v1'||
    manual.rosterSha256!==rosterDigest||depth.rosterSha256!==rosterDigest)throw Error('Preseason source manifest/roster binding failed');
  const targets:PreseasonTarget[]=[];
  for(const m of [...manual.members,...depth.members]){
    const person=roster.members.find(x=>x.lrlId===m.lrlId&&x.seat===m.seat&&x.name===m.name);
    if(!person||!cohort.targets.some(x=>x.lrlId===person.lrlId&&x.seat===person.seat))throw Error('Preseason target identity not in incoming cohort');
    for(const source of m.sources){
      const url=new URL(source.url);
      if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.search||
        !['candidate_campaign_page','candidate_interview','published_candidate_questionnaire'].includes(source.kind)||
        !source.publisher||source.publisher.length>160||canonicalPublicUrl(source.url)!==source.url)throw Error('Unapproved preseason source shape');
      targets.push({...person,url:source.url,kind:source.kind,publisher:source.publisher,rosterSha256:rosterDigest});
    }
  }
  if(targets.length!==28||new Set(targets.map(x=>x.url)).size!==targets.length)throw Error('Unexpected preseason source inventory');
  return targets;
}

export type PreseasonBudget={started:number;bytes:number;requests:number};
export async function fetchPreseasonTarget(target:PreseasonTarget,budget:PreseasonBudget,runId:string,fetcher:typeof fetch=fetch){
  if(budget.requests>=PRESEASON_LIMITS.sources||budget.bytes>=PRESEASON_LIMITS.maxBytes||Date.now()-budget.started>=PRESEASON_LIMITS.runMs)
    throw Error('SOURCE_BUDGET_EXHAUSTED');
  budget.requests++;
  let raw:Buffer|undefined,observedAt:string|undefined;
  const page=await fetchPublicPage(target.url,{maxBytes:PRESEASON_LIMITS.maxPageBytes,timeoutMs:PRESEASON_LIMITS.timeoutMs,
    userAgent:'VotePredict/2.0 bounded preseason evidence review',
    fetcher:async(input,init)=>{
      if(String(input)!==target.url||raw)throw Error('SOURCE_URL_MISMATCH');
      const response=await fetcher(input,{...init,method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
        signal:AbortSignal.any([init?.signal??AbortSignal.timeout(PRESEASON_LIMITS.timeoutMs),AbortSignal.timeout(Math.max(1,PRESEASON_LIMITS.runMs-(Date.now()-budget.started)))])});
      if(response.url&&new URL(response.url).href!==target.url)throw Error('SOURCE_URL_MISMATCH');
      if(response.status!==200){await response.body?.cancel();throw Error('SOURCE_HTTP_'+response.status);}
      const limit=Math.min(PRESEASON_LIMITS.maxPageBytes,PRESEASON_LIMITS.maxBytes-budget.bytes);
      if(!response.body||Number(response.headers.get('content-length')??0)>limit){await response.body?.cancel();throw Error('SOURCE_SIZE_LIMIT');}
      const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
      try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;budget.bytes+=part.value.byteLength;
        if(size>limit){await reader.cancel();throw Error('SOURCE_SIZE_LIMIT');}chunks.push(part.value);}}
      finally{reader.releaseLock();}
      raw=Buffer.concat(chunks);observedAt=new Date().toISOString();
      const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');
      return new Response(new Uint8Array(raw),{status:200,headers});
    }});
  if(!raw||!observedAt||page.finalUrl!==target.url||hash(raw)!==page.contentSha256||raw.length!==page.bytes)
    throw Error('SOURCE_BYTES_MISMATCH');
  const receipt:PreseasonReceipt={schemaVersion:'2027-preseason-source-review-v1',session:'2027-2028',runId,rosterSha256:target.rosterSha256,
    lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url,sourceKind:target.kind,publisher:target.publisher,observedAt,
    bodySha256:page.contentSha256,bodyBytes:raw.length,claimedPublicationAt:page.publishedAt??null,
    identityNameMentioned:[target.name,target.electionName].some(name=>publicPageMentionsPerson(page.text,name)),
    rawBodyRetained:false,reviewRequired:true,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0};
  return {receipt,raw};
}

export function assertPreseasonArchiveRun(env:Record<string,string|undefined>,now:Date){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(env.VERCEL||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||env.GITHUB_REF!=='refs/heads/main'||
    env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/2027-preseason-evidence-archive.yml@refs/heads/main'||
    env.VOTEPREDICT_2027_PRESEASON_ARCHIVE_AUTHORIZED!=='true'||env.GITHUB_RUN_ATTEMPT!=='1'||day<'2026-11-26'||day>='2027-01-12'||
    !/^[0-9]{1,20}$/.test(env.GITHUB_RUN_ID??''))throw Error('Preseason archive not authorized');
  const databaseUrl=env.VOTEPREDICT_2027_PRESEASON_ARCHIVE_DATABASE_URL??'',role=env.VOTEPREDICT_2027_PRESEASON_ARCHIVE_ROLE??'',fingerprint=env.VOTEPREDICT_2027_PRESEASON_ARCHIVE_DATABASE_FINGERPRINT??'';
  let url:URL;try{url=new URL(databaseUrl);}catch{throw Error('Protected archive connection unavailable');}
  if(!/^[a-f0-9]{64}$/.test(fingerprint)||databaseTargetFingerprint(databaseUrl)!==fingerprint||
    !url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler.')||!url.password||
    !/^[a-z][a-z0-9_]{1,62}$/.test(role)||decodeURIComponent(url.username)!==role||
    url.searchParams.get('sslmode')!=='verify-full'||[...url.searchParams.keys()].some(key=>!['sslmode','channel_binding'].includes(key)))
    throw Error('Protected archive target/role mismatch');
  return {day,runId:env.GITHUB_RUN_ID+':1',databaseUrl,role,fingerprint};
}

export async function verifyPreseasonArchiveRole(db:Pool,target:{role:string;fingerprint:string},actualFingerprint:string|null){
  if(!(await readReleaseBinding(db,actualFingerprint,target.fingerprint)).verified)throw Error('Archive target/schema binding unverified');
  const client=await db.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'");
    const role=(await client.query<{role:string;safe:boolean;archiveAllowed:boolean;otherWrites:boolean}>(`
      SELECT current_user::text AS role,
        NOT (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls OR
          pg_has_role(current_user,d.datdba,'MEMBER') OR
          EXISTS (SELECT 1 FROM pg_roles other WHERE other.oid<>r.oid AND pg_has_role(current_user,other.oid,'MEMBER')) OR
          EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege(current_user,n.oid,'CREATE'))) AS safe,
        (has_table_privilege(current_user,'public.evidence_content_blobs','SELECT') AND has_table_privilege(current_user,'public.evidence_content_blobs','INSERT')
          AND NOT has_table_privilege(current_user,'public.evidence_content_blobs','UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')) AS "archiveAllowed",
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f')
          AND c.oid<>'public.evidence_content_blobs'::regclass
          AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') OR
          has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES'))) AS "otherWrites"
      FROM pg_roles r JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`)).rows[0];
    if(!role||role.role!==target.role||!role.safe||!role.archiveAllowed||role.otherWrites)throw Error('Archive role privileges are not restricted');
  }finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}

export async function retainPreseasonSourceInTransaction(client:Pick<PoolClient,'query'>,target:PreseasonTarget,receipt:PreseasonReceipt,raw:Buffer){
  if(receipt.schemaVersion!=='2027-preseason-source-review-v1'||receipt.session!=='2027-2028'||receipt.rosterSha256!==target.rosterSha256||
    receipt.lrlId!==target.lrlId||receipt.seat!==target.seat||receipt.sourceUrl!==target.url||receipt.sourceKind!==target.kind||
    receipt.publisher!==target.publisher||!/^\d{1,20}:1$/.test(receipt.runId)||!Number.isFinite(Date.parse(receipt.observedAt))||
    receipt.rawBodyRetained||receipt.reviewRequired!==true||receipt.servingEligible!==false||receipt.canonicalWriteAllowed!==false||receipt.modelWeight!==0||
    raw.length<1||raw.length>PRESEASON_LIMITS.maxPageBytes||raw.length!==receipt.bodyBytes||hash(raw)!==receipt.bodySha256)throw Error('Invalid preseason source receipt');
  if(target.kind==='published_education_questionnaire_pdf'&&(raw.length<300||raw.subarray(0,5).toString('ascii')!=='%PDF-'||receipt.identityNameMentioned!==true))throw Error('Invalid education original');
  await storeBlob(client,raw,target.kind==='published_education_questionnaire_pdf'?'application/pdf':'application/octet-stream',target.kind==='published_education_questionnaire_pdf');
    const digest=await storeBlob(client,Buffer.from(JSON.stringify({...receipt,rawBodyRetained:true})),PRESEASON_RECEIPT_TYPE,true);
    const accepted=(await client.query<{accepted_at:Date}>('SELECT accepted_at FROM evidence_content_blobs WHERE sha256=$1',[digest])).rows[0]?.accepted_at;
    if(!accepted||Math.abs(accepted.getTime()-Date.parse(receipt.observedAt))>300000)throw Error('Preseason archive acceptance clock mismatch');
  return digest;
}

export async function retainPreseasonSource(db:Pick<Pool,'connect'>,target:PreseasonTarget,receipt:PreseasonReceipt,raw:Buffer){
  const client=await db.connect();
  try{await client.query('BEGIN');const digest=await retainPreseasonSourceInTransaction(client,target,receipt,raw);await client.query('COMMIT');return digest;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
