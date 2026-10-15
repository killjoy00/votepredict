/**
 * Track D (#912): access the EXISTING VotePredict Neon database using the
 * owner's protected GitHub Actions NEON_API_KEY. Exactly five GETs:
 * project metadata, existing branch listing, default-branch databases,
 * project endpoints, connection URI.
 * No branch/role/compute creation, credential rotation, environment pull,
 * Vercel fallback, or database write. The URI stays inside the Actions runner.
 */
import { assertMediaReadinessManualApproval } from './senate-media-neon-credential-gate.js';

const API='https://console.neon.tech/api/v2/projects/';
const PROJECT=/^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,8}$/;
const BRANCH=/^br-[a-z0-9-]{3,80}$/;
const IDENT=/^[a-zA-Z_][a-zA-Z0-9_$-]{0,62}$/;
const HOST=/^[a-z0-9.-]+\.neon\.tech$/;

type SafeFetch=(url:string, init:RequestInit)=>Promise<Pick<Response,'status'|'ok'|'json'>>;
type JsonObject=Record<string,unknown>;
const isRecord=(v:unknown):v is JsonObject=>
  Boolean(v)&&typeof v==='object'&&!Array.isArray(v);

export interface ExistingMediaNeonConnection {
  projectId:string;
  branchId:string;
  endpointId:string;
  database:string;
  role:string;
  host:string;
  port:number;
  /** Credential is held only in memory of the protected GitHub runner. */
  password:string;
}
export interface ExistingMediaNeonInput {
  apiKey:string;
  projectId:string;
  /** Optional only if Neon exposes more than one plausible database. */
  preferredDatabase?:string;
  /** Choose exactly one existing read/write primary instead of the normal read replica. */
  requirePrimary?:boolean;
}
/** Fixed non-sensitive milestones. No Neon response fields may enter this reporter. */
export type MediaNeonAccessPhase =
  | 'project_metadata_received'
  | 'project_identity_verified'
  | 'branch_inventory_received'
  | 'default_branch_selected'
  | 'database_inventory_received'
  | 'database_selected'
  | 'endpoint_inventory_received'
  | 'endpoint_selected'
  | 'connection_uri_response_received'
  | 'connection_uri_verified'
  | 'sql_connection_opened'
  | 'sql_readonly_identity_verified'
  | 'sql_required_tables_verified'
  | 'sql_aggregate_completed'
  | 'sql_transaction_rolled_back';
export type MediaNeonPhaseReporter = (phase:MediaNeonAccessPhase)=>void;
function assertIdentity(input: ExistingMediaNeonInput):void {
  if (!input.apiKey || input.apiKey.length>1000 || !PROJECT.test(input.projectId))
    throw Error('VotePredict-protected Neon project credentials missing or invalid');
  if (input.preferredDatabase && !IDENT.test(input.preferredDatabase))
    throw Error('Optional existing database selector is invalid');
}
async function getNeon(
  path:string,apiKey:string,request:SafeFetch,
):Promise<JsonObject>{
  let response:Pick<Response,'status'|'ok'|'json'>;
  try {
    response=await request(path,{
      method:'GET',redirect:'error',cache:'no-store',credentials:'omit',
      signal:AbortSignal.timeout(8_000),
      headers:{Accept:'application/json',Authorization:'Bearer '+apiKey},
    });
  } catch {
    throw Error('Bounded VotePredict Neon metadata GET failed');
  }
  if(response.status!==200 || !response.ok)
    throw Error('Bounded VotePredict Neon metadata GET unavailable or unauthorized');
  let body:unknown;
  try{body=await response.json();}
  catch {throw Error('Neon metadata body was not valid JSON');}
  if(!isRecord(body))throw Error('Neon metadata response lacked an object');
  return body;
}
function assertExactProject(input:ExistingMediaNeonInput, payload:JsonObject):void {
  const p=payload.project;
  if(!isRecord(p) || p.id!==input.projectId)
    throw Error('Neon project does not match configured VotePredict ID');
  const name=typeof p.name==='string'
    ?p.name.toLowerCase().replace(/[^a-z0-9]/g,''):'';
  if(!name.includes('votepredict'))
    throw Error('Neon project name is not VotePredict');
}

/**
 * Neon GET /projects/{id} does NOT return project.default_branch_id.
 * Its separate GET /projects/{id}/branches response exposes branch.default.
 * Never infer the target from a name like "main" or the first item.
 * A paginated/incomplete list or multiple defaults fails closed.
 */
function selectExistingDefaultBranch(payload:JsonObject,projectId:string):string {
  if(!Array.isArray(payload.branches)
    || payload.branches.length===0 || payload.branches.length>100)
    throw Error('Existing Neon branch inventory is missing or exceeds bounded limit');
  if(payload.pagination!==undefined) {
    if(!isRecord(payload.pagination)
      || (payload.pagination.next !== undefined
        && payload.pagination.next !== null
        && payload.pagination.next !== ''))
      throw Error('Neon branch inventory incomplete; cannot select default branch');
  }
  if(payload.branches.some(branch=>
    !isRecord(branch) || !BRANCH.test(String(branch.id))
    || branch.project_id!==projectId
    || typeof branch.default !== 'boolean'))
    throw Error('Existing Neon branches do not match the expected project');
  const defaults=payload.branches.filter(branch=>branch.default===true);
  if(defaults.length!==1)
    throw Error('Exactly one independently marked default branch is required');
  return defaults[0].id as string;
}
function chooseDatabase(
  body:JsonObject,branchId:string,preferredDatabase?:string,
):{database:string;role:string}{
  if(!Array.isArray(body.databases)||body.databases.length===0||body.databases.length>50)
    throw Error('Neon project has no bounded database inventory');
  const rows=body.databases;
  if(rows.some(row=>!isRecord(row)
    || row.branch_id!==branchId
    || typeof row.name!=='string'||!IDENT.test(row.name)
    || typeof row.owner_name!=='string'||!IDENT.test(row.owner_name)))
    throw Error('Neon database inventory does not match approved branch identity');
  const selected=preferredDatabase
    ?rows.filter(row=>row.name===preferredDatabase)
    :rows.length===1?rows:rows.filter(row=>row.name.toLowerCase()==='votepredict');
  if(selected.length!==1)
    throw Error('Existing VotePredict database is ambiguous or absent; no SQL connection attempted');
  return {database:selected[0].name as string,role:selected[0].owner_name as string};
}
function chooseEndpoint(body:JsonObject,branchId:string,projectId:string,requirePrimary=false) {
  if(!Array.isArray(body.endpoints)||body.endpoints.length===0||body.endpoints.length>200)
    throw Error('No bounded compute endpoint inventory for VotePredict');
  const possible=body.endpoints.filter(v=>isRecord(v)
    && v.project_id===projectId && v.branch_id===branchId
    && typeof v.host==='string' && HOST.test(v.host)
    && typeof v.id==='string' && /^ep-[a-z0-9-]{3,80}$/.test(v.id)
    && (v.type==='read_only'||v.type==='read_write'));
  const replicas=possible.filter(v=>v.type==='read_only');
  const primary=possible.filter(v=>v.type==='read_write');
  // Prefer a single EXISTING read replica; otherwise use the sole primary
  // with a READ ONLY transaction. Never create a replica.
  const selection=requirePrimary ?primary:(replicas.length===1 ?replicas:primary);
  if(selection.length!==1)throw Error('No unambiguous existing Neon compute for project and branch');
  return {endpointId:selection[0].id as string,host:selection[0].host as string};
}
function validateUri(
  payload:JsonObject,
  expected:{database:string;role:string;host:string},
):{password:string;port:number}{
  if(typeof payload.uri!=='string'||payload.uri.length>10000)
    throw Error('Neon connection-URI response was unavailable');
  let u:URL;
  try{u=new URL(payload.uri);}catch{throw Error('Neon connection-URI payload invalid');}
  if(!['postgres:','postgresql:'].includes(u.protocol)
    || u.hostname!==expected.host
    || decodeURIComponent(u.username)!==expected.role
    || decodeURIComponent(u.pathname.slice(1))!==expected.database
    || !u.password || u.hash || u.hostname.includes('-pooler.')
    || (u.port!=='' && u.port!=='5432')
    || !['require','verify-full'].includes(u.searchParams.get('sslmode')??'')
    || [...u.searchParams.keys()].some(x=>!['sslmode','channel_binding'].includes(x)))
    throw Error('Neon connection URI did not match verified existing project endpoint/database');
  return {password:decodeURIComponent(u.password),port:u.port?Number(u.port):5432};
}

/**
 * Returns a transient password-bearing connection only to its direct caller.
 * NEVER JSON.stringify/log the returned connection or thrown request objects.
 */
export async function discoverExistingVotePredictNeonConnection(
  input:ExistingMediaNeonInput,
  request:SafeFetch=fetch,
  onPhase:MediaNeonPhaseReporter=()=>{},
):Promise<ExistingMediaNeonConnection>{
  assertIdentity(input);
  const base=API+input.projectId;
  const project=await getNeon(base,input.apiKey,request);
  onPhase('project_metadata_received');
  assertExactProject(input,project);
  onPhase('project_identity_verified');
  const existingBranches=await getNeon(base+'/branches?limit=100',input.apiKey,request);
  onPhase('branch_inventory_received');
  const branchId=selectExistingDefaultBranch(existingBranches,input.projectId);
  onPhase('default_branch_selected');
  const dbInventory=await getNeon(base+'/branches/'+branchId+'/databases',input.apiKey,request);
  onPhase('database_inventory_received');
  const {database,role}=chooseDatabase(dbInventory,branchId,input.preferredDatabase);
  onPhase('database_selected');
  const endpoints=await getNeon(base+'/endpoints',input.apiKey,request);
  onPhase('endpoint_inventory_received');
  const {host,endpointId}=chooseEndpoint(endpoints,branchId,input.projectId,input.requirePrimary===true);
  onPhase('endpoint_selected');
  const params=new URLSearchParams({
    branch_id:branchId,endpoint_id:endpointId,
    database_name:database,role_name:role,pooled:'false',
  });
  const uri=await getNeon(base+'/connection_uri?'+params.toString(),input.apiKey,request);
  onPhase('connection_uri_response_received');
  const {password,port}=validateUri(uri,{database,role,host});
  onPhase('connection_uri_verified');
  return {projectId:input.projectId,branchId,endpointId,database,role,host,port,password};
}

/**
 * #912: manual consent was supplied repeatedly. A specially marked main
 * revision may be verified in its OWN uncancellable, ephemeral-Postgres
 * check job, followed by one bounded source COUNT under the SAME protected
 * evidence-readonly-sandbox environment. Regular push, PR, CI replay,
 * foreign repositories and wrong refs all fail closed.
 *
 * The event's marker and needs.verify success must be checked by GitHub
 * Actions AND passed as fixed boolean strings, not raw untrusted data.
 * No programmatic bypass of required environment reviewers is possible.
 */
export const SENATE_MEDIA_CI_ONE_SHOT_MARKER =
  'SENATE_MEDIA_DEDICATED_ONE_SHOT_20261010_V2' as const;
export function assertApprovedDirectNeonWorkflow(env:Record<string,string|undefined>):void{
  if(env.VOTEPREDICT_MEDIA_AGGREGATE_APPROVAL!=='BOUNDED_AGGREGATE_ONLY')
    throw Error('Only separately acknowledged bounded media aggregate review is approved');
  if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
    assertMediaReadinessManualApproval(env);
    return;
  }
  if(env.GITHUB_EVENT_NAME!=='push'
    || env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
    || env.GITHUB_REF!=='refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT!=='1'
    || env.VOTEPREDICT_MEDIA_APPROVAL!=='VERIFY_SENATE_MEDIA_READONLY'
    || env.VOTEPREDICT_MEDIA_DEDICATED_VERIFY_SUCCEEDED!=='true'
    || env.VOTEPREDICT_MEDIA_DEDICATED_ONE_SHOT_MARKER_MATCHED!=='true'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')){
    throw Error('Protected single approved main-commit read-only aggregate not authorized');
  }
}
