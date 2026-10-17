/**
 * Conservative, non-serving first-party/official HTML observation capture.
 *
 * A web page seen today proves observation at the fetch time, not historical
 * public availability, a candidate's vote, or committee-to-org affiliation.
 * Raw source bytes are retained unchanged as UTF-8 HTML with SHA-256.
 */
import {createHash} from 'node:crypto';

export const CFB_ISSUE_SOURCE_OBSERVATION_SCHEMA =
 'cfb-issue-finance-observation-manifest-v1';
const HOSTS=new Set([
 'register.cfb.mn.gov','www.mnchamber.com',
 'educationminnesota.org','mnaflcio.org'
]);
const ROLES=new Set([
 'cfb_registry_index','first_party_pac_affiliation',
 'first_party_issue_publication','first_party_historical_context',
 'retrospective_scorecard_index'
]);
const GROUPS=new Set([
 'CFB official committee registry','Minnesota Chamber of Commerce',
 'Education Minnesota','Minnesota AFL-CIO'
]);
const MAX_BODY_BYTES=800000;
const MAX_ROBOTS_BYTES=65000;
const BOT='VotePredictEvidenceBot';
export const CFB_ISSUE_SOURCE_OBSERVATION_USER_AGENT=
 BOT+'/1.0 (+https://github.com/killjoy00/votepredict)';

function validPublicUrl(raw){
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||
   url.username||url.password||url.port||url.search||url.hash)return false;
  return url;
 }catch{return false;}
}
export function validateCfbIssueSourceManifest(manifest){
 if(manifest?.schemaVersion!==CFB_ISSUE_SOURCE_OBSERVATION_SCHEMA||
  !Array.isArray(manifest.sources)||manifest.sources.length<2||
  manifest.sources.length>12)throw Error('Invalid bounded issue source manifest');
 const unique=new Set(),rows=[];
 for(const item of manifest.sources){
  if(!item||typeof item.id!=='string'||
   !/^[a-z0-9][a-z0-9_-]{3,79}$/.test(item.id)||
   !GROUPS.has(item.organizationGroup)||!ROLES.has(item.role)||
   !validPublicUrl(item.url)||unique.has(item.id+'|'+item.url))
   throw Error('Unsafe or duplicate issue source');
  unique.add(item.id+'|'+item.url);
  rows.push(Object.freeze({...item}));
 }
 return rows;
}
function globRegex(pattern){
 const end=pattern.endsWith('$');
 const raw=end?pattern.slice(0,-1):pattern;
 return new RegExp('^'+raw.split('*').map(part=>
  part.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')).join('.*')+(end?'$':''));
}
function rulesForAgent(text,botName){
 const groups=[];let current={agents:[],rules:[]};let rulesStarted=false;
 function commit(){
  if(current.agents.length)groups.push(current);
  current={agents:[],rules:[]};rulesStarted=false;
 }
 for(const raw of String(text??'').split(/\r?\n/)){
  const withoutComment=raw.split('#')[0].trim();
  if(!withoutComment){if(rulesStarted)commit();continue;}
  const m=/^([A-Za-z-]+)\s*:\s*(.*?)\s*$/.exec(withoutComment);
  if(!m)continue;
  const field=m[1].toLowerCase(),value=m[2];
  if(field==='user-agent'){
   if(rulesStarted)commit();
   current.agents.push(value.toLowerCase());continue;
  }
  if(!current.agents.length)continue;
  if(field==='allow'||field==='disallow'){
   rulesStarted=true;
   if(value)current.rules.push({directive:field,value});
  }
 }
 commit();
 const a=botName.toLowerCase();
 const specific=groups.filter(g=>g.agents.some(x=>x===a));
 const accepted=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 return accepted.flatMap(x=>x.rules);
}
export function robotsAllows(robots,path,agent=BOT){
 const rules=rulesForAgent(robots,agent);
 let found=null;
 for(const r of rules){
  try{
   if(!globRegex(r.value).test(path))continue;
   const size=r.value.replace(/[*$]/g,'').length;
   if(!found||size>found.size||(size===found.size&&r.directive==='allow'))
    found={allow:r.directive==='allow',size};
  }catch{return false;}
 }
 return found?found.allow:true;
}
async function boundedBuffer(response,maxBytes){
 const declared=Number(response.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>maxBytes)throw Error('source_oversize');
 const parts=[];let size=0;
 const reader=response.body?.getReader();
 if(!reader)throw Error('source_no_body');
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>maxBytes)throw Error('source_oversize');
   parts.push(Buffer.from(value));
  }
 }finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(parts);
}
async function controlledFetch(url,fetcher,maxBytes){
 // Redirects to a different hostname are never followed. A later manifest
 // update must explicitly authorize any new origin after source review.
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetcher(url,{
   method:'GET',redirect:'manual',
   headers:{'user-agent':CFB_ISSUE_SOURCE_OBSERVATION_USER_AGENT,
    'accept':'text/html,text/plain;q=0.7,*/*;q=0.1'},
   signal:AbortSignal.timeout(20000)
  });
  if(response.status>=300&&response.status<400){
   const location=response.headers.get('location');
   if(!location)throw Error('source_redirect');
   const next=new URL(location,url);
   if(!validPublicUrl(next.toString())||
    next.hostname!==new URL(url).hostname)throw Error('source_redirect');
   url=next.toString();continue;
  }
  if(response.status===404)return {status:404,response,url};
  if(!response.ok)throw Error('source_http');
  const buffer=await boundedBuffer(response,maxBytes);
  return {status:response.status,response,url,buffer};
 }
 throw Error('source_redirect');
}
export async function fetchCfbIssueSource(item,options={}){
 const fetcher=options.fetcher??fetch;
 const time=options.now??(()=>new Date().toISOString());
 if(!validPublicUrl(item?.url))return {status:'invalid_source'};
 const url=new URL(item.url);
 const robotsUrl=url.origin+'/robots.txt';
 let robots;
 try{robots=await controlledFetch(robotsUrl,fetcher,MAX_ROBOTS_BYTES);}
 catch{return {status:'robots_unavailable'};}
 if(robots.status===404)robots={buffer:Buffer.from('')};
 if(!robots.buffer)return {status:'robots_unavailable'};
 let policy;
 try{policy=new TextDecoder('utf-8',{fatal:true}).decode(robots.buffer);}
 catch{return {status:'robots_unavailable'};}
 if(!robotsAllows(policy,url.pathname+url.search))return {status:'robots_disallowed'};
 // One-second delay after robots before fetching the original. Only one
 // source is fetched at a time; manifest origins are kept in order.
 await (options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms))))(1000);
 let fetched;
 try{fetched=await controlledFetch(item.url,fetcher,MAX_BODY_BYTES);}
 catch(e){return {status:e?.message==='source_oversize'?
  'source_oversize':'fetch_unavailable'};}
 if(fetched.status!==200)return {status:'fetch_unavailable'};
 const type=(fetched.response.headers.get('content-type')??'')
  .split(';')[0].trim().toLowerCase();
 if(type!=='text/html')return {status:'unsupported_content_type'};
 let body;
 try{body=new TextDecoder('utf-8',{fatal:true}).decode(fetched.buffer);}
 catch{return {status:'non_utf8'};}
 if(body.length<100||body.length>850000||!/<(?:html|!doctype|head|body)[\s>]/i.test(body))
  return {status:'unusable_html'};
 const capturedAt=time();
 if(!/^\d{4}-\d{2}-\d{2}T/.test(capturedAt))
  return {status:'invalid_clock'};
 return {status:'captured',snapshot:{
  sourceId:item.id,organizationGroup:item.organizationGroup,
  sourceRole:item.role,sourceUrl:item.url,finalUrl:fetched.url,
  htmlSha256:createHash('sha256').update(fetched.buffer).digest('hex'),
  contentType:'text/html',rawHtml:body,observedAt:capturedAt,
  claimStatus:'unverified_raw_observation',
  historicalAsOfEligible:false,mechanicallyActionable:false,modelWeight:0
 }};
}
