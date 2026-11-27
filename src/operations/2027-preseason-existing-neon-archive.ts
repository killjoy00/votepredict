import type {Pool,PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {databaseTargetFingerprint} from './release-readiness';
import type {ExistingMediaNeonConnection} from './senate-media-neon-api-readonly';
import type {PreseasonTarget} from './2027-preseason-evidence-archive';
export const ARCHIVE_MARKER='VOTEPREDICT_PRESEASON_ORIGINAL_ARCHIVE_20261126';
export const ARCHIVE_OWNER='votepredict_owner';
export const ARCHIVE_ROLE='votepredict_2027_preseason_archive';
export const ARCHIVE_PROJECT='long-sunset-19921337';
const ARCHIVE_BRANCH='br-billowing-wave-aecfbwky';
const ARCHIVE_ENDPOINT='ep-odd-haze-aebm7w42';
const ARCHIVE_HOST='ep-odd-haze-aebm7w42.c-2.us-east-2.aws.neon.tech';
const ARCHIVE_WORKFLOW='killjoy00/votepredict/.github/workflows/2027-preseason-evidence-archive.yml@refs/heads/main';
const RELEASE_DIGEST='4af9e53d3ae0ccf54abbd234a3daa105914e54c38adcf367cc78f7e384857441';
export function assertExistingArchiveRun(env:Record<string,string|undefined>,event:Record<string,unknown>,now:Date){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const repo=event.repository as {full_name?:string;default_branch?:string}|undefined;
  const head=event.head_commit as {id?:string;message?:string}|undefined;
  const dispatch=env.GITHUB_EVENT_NAME==='workflow_dispatch'&&(event.inputs as {archive?:string|boolean}|undefined)?.archive?.toString()==='true';
  const markedPush=env.GITHUB_EVENT_NAME==='push'&&event.after===env.GITHUB_SHA&&head?.id===env.GITHUB_SHA&&
    event.forced!==true&&event.deleted!==true&&head?.message?.includes(ARCHIVE_MARKER);
  if(env.VERCEL||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||repo?.full_name!==env.GITHUB_REPOSITORY||repo.default_branch!=='main'||
    env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_WORKFLOW_REF!==ARCHIVE_WORKFLOW||env.GITHUB_RUN_ATTEMPT!=='1'||
    env.VOTEPREDICT_2027_PRESEASON_CI_VERIFIED!=='true'||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))||
    !(/^\d{1,20}$/.test(env.GITHUB_RUN_ID??''))||(!dispatch&&!markedPush)||day<'2026-11-26'||day>='2027-01-12')
    throw Error('Existing Neon archive approval gate failed');
  return {day,runId:env.GITHUB_RUN_ID+':1'};
}
export function assertArchiveConnection(target:ExistingMediaNeonConnection){
  if(target.projectId!==ARCHIVE_PROJECT||target.branchId!==ARCHIVE_BRANCH||target.endpointId!==ARCHIVE_ENDPOINT||
    target.host!==ARCHIVE_HOST||target.port!==5432||target.database!=='votepredict'||target.role!==ARCHIVE_OWNER||!target.password)
    throw Error('Production archive target mismatch');
  const u=new URL('postgresql://placeholder/votepredict');u.hostname=target.host;u.port=String(target.port);u.username=target.role;
  const identity=databaseTargetFingerprint(u.toString());
  if(identity!==createHash('sha256').update(JSON.stringify([ARCHIVE_HOST,'5432','votepredict',ARCHIVE_OWNER])).digest('hex'))throw Error('Archive owner endpoint fingerprint mismatch');
  return identity;
}
export function addRonnenbergTarget(targets:readonly PreseasonTarget[],rosterRaw:string,pilot:{summary:{rosterSha256:string};targets:Array<{lrlId:string;seat:string;name:string;electionName:string}>;results:Array<{lrlId:string;seat:string;evidence:Array<{url:string;kind:string;bodySha256:string}>}>}){
  const roster=JSON.parse(rosterRaw) as {members:Array<{lrlId:string;seat:string;name:string;electionName:string}>};
  const digest=createHash('sha256').update(rosterRaw).digest('hex');
  const person=roster.members.find(x=>x.lrlId==='15669'&&x.seat==='house:23A'&&x.name==='Dominick Ronnenberg'&&x.electionName==='Nick Ronnenberg');
  const url='https://www.ronnenbergformn.com/';
  const proof=pilot.results.find(x=>x.lrlId==='15669'&&x.seat==='house:23A')?.evidence.find(e=>e.url===url&&e.kind==='campaign_home');
  if(!person||!proof||!/^[a-f0-9]{64}$/.test(proof.bodySha256)||digest!==pilot.summary.rosterSha256||
    targets.length!==28||targets.some(x=>x.rosterSha256!==digest||x.url===url||x.lrlId===person.lrlId)||
    !pilot.targets.some(x=>x.lrlId===person.lrlId&&x.seat===person.seat&&x.name===person.name))throw Error('Ronnenberg source binding failed');
  return [{...person,url,kind:'candidate_campaign_page',publisher:'Candidate campaign',rosterSha256:digest},...targets];
}
async function memberships(client:Pick<PoolClient,'query'>,role:string,owner:string){
  return (await client.query<{grantor:string;admin_option:boolean;inherit_option:boolean;set_option:boolean}>(
    'SELECT g.rolname::text AS grantor,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor WHERE r.rolname=$1 AND m.rolname=$2 ORDER BY g.rolname',[role,owner])).rows;
}
async function assertEffectiveRole(client:Pick<PoolClient,'query'>,role:string){
  const check=(await client.query<{role:string;safe:boolean;archiveAllowed:boolean;otherWrites:boolean}>("SELECT current_user::text AS role, NOT (r.rolcanlogin OR r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls OR EXISTS (SELECT 1 FROM pg_roles o WHERE o.oid<>r.oid AND pg_has_role(current_user,o.oid,'MEMBER')) OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege(current_user,n.oid,'CREATE'))) AS safe, (has_table_privilege(current_user,'public.evidence_content_blobs','SELECT') AND has_table_privilege(current_user,'public.evidence_content_blobs','INSERT') AND has_table_privilege(current_user,'public.votepredict_schema_migrations','SELECT') AND NOT has_table_privilege(current_user,'public.evidence_content_blobs','UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')) AS \"archiveAllowed\", EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f') AND c.oid<>'public.evidence_content_blobs'::regclass AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES'))) AS \"otherWrites\" FROM pg_roles r WHERE r.rolname=current_user")).rows[0];
  if(!check||check.role!==role||!check.safe||!check.archiveAllowed||check.otherWrites)throw Error('Archive effective role is not restricted');
  const ledger=(await client.query<{filename:string;checksum:string}>('SELECT filename,checksum FROM public.votepredict_schema_migrations ORDER BY filename')).rows;
  if(ledger.length!==37||createHash('sha256').update(JSON.stringify(ledger.map(r=>({filename:r.filename,checksum:r.checksum})))).digest('hex')!==RELEASE_DIGEST)throw Error('Archive migration ledger mismatch');
}
export async function withRestrictedArchiveTransaction<T>(db:Pick<Pool,'connect'>,owner:string,role:string,work:(client:PoolClient)=>Promise<T>){
  // Identifier grammar and explicit equality checks: no untrusted SQL identifiers.
  if(!/^[a-z][a-z0-9_]{1,62}$/.test(owner)||!/^votepredict_2027_preseason_archive(?:_[a-z0-9]+)?$/.test(role)||owner===role)throw Error('Invalid archive role identifiers');
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s'; SET LOCAL search_path=public");
    const who=(await client.query<{role:string;login:string;db:string}>('SELECT current_user::text AS role, session_user::text AS login,current_database() AS db')).rows[0];
    if(who?.role!==owner||who.login!==owner||who.db!=='votepredict')throw Error('Archive owner identity mismatch');
    const locked=(await client.query<{locked:boolean}>("SELECT pg_try_advisory_xact_lock(hashtext('votepredict-2027-preseason-archive')) AS locked")).rows[0]?.locked;
    if(!locked)throw Error('Archive transaction locked');
    const before=await memberships(client,role,owner);
    if(before.some(x=>x.grantor===owner||x.inherit_option||x.set_option||!x.admin_option)||before.length>1)throw Error('Unexpected permanent archive role grants');
    await client.query('GRANT '+role+' TO '+owner+' WITH INHERIT FALSE, SET TRUE');
    await client.query('SET LOCAL ROLE '+role);
    await assertEffectiveRole(client,role);
    const result=await work(client);
    await client.query('RESET ROLE');
    await client.query('REVOKE '+role+' FROM '+owner);
    const after=await memberships(client,role,owner);
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Archive role grant restoration failed');
    await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release(true);}
}
