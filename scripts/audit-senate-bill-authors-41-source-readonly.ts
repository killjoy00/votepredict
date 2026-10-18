/**
 * One-time, no-write official-source diagnostic for the 41 unresolved
 * Minnesota Senate bill authorship scans. Public Revisor GETs only.
 * The bulk collector and all database/forecast paths remain untouched.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {RevisorPacer} from '../src/operations/senate-revisor-pacer.js';

type Session='2021-2022'|'2023-2024'|'2025-2026';
type Case={session:Session; identifier:string; lastHttp:200|500};
type Json=Record<string,unknown>;
const REPO='killjoy00/votepredict';
const MARKER='SENATE_BILL_AUTHORS_41_PUBLIC_SOURCE_REVIEW';
const SESSION_INFO:Record<Session,{legislature:number;firstYear:number}>={
  '2021-2022':{legislature:92,firstYear:2021},
  '2023-2024':{legislature:93,firstYear:2023},
  '2025-2026':{legislature:94,firstYear:2025},
};
// Frozen from the completed protected read-only production inventory #39145623545.
// This is NOT a query or a new backfill target discovery mechanism.
export const CASES:readonly Case[]=[
  {session:'2021-2022',identifier:'HF1168',lastHttp:500},
  {session:'2021-2022',identifier:'HF1954',lastHttp:500},
  {session:'2021-2022',identifier:'HF2137',lastHttp:500},
  {session:'2021-2022',identifier:'HF265',lastHttp:500},
  {session:'2021-2022',identifier:'HF766',lastHttp:500},
  {session:'2021-2022',identifier:'HF966',lastHttp:500},
  {session:'2021-2022',identifier:'SF1713',lastHttp:500},
  {session:'2021-2022',identifier:'SF1866',lastHttp:500},
  {session:'2021-2022',identifier:'SF783',lastHttp:500},
  {session:'2021-2022',identifier:'HF3529',lastHttp:200},
  {session:'2021-2022',identifier:'HF3605',lastHttp:200},
  {session:'2021-2022',identifier:'HF3689',lastHttp:200},
  {session:'2023-2024',identifier:'HF1187',lastHttp:500},
  {session:'2023-2024',identifier:'HF1268',lastHttp:500},
  {session:'2023-2024',identifier:'HF1931',lastHttp:500},
  {session:'2023-2024',identifier:'HF2273',lastHttp:500},
  {session:'2023-2024',identifier:'HF3145',lastHttp:500},
  {session:'2023-2024',identifier:'HF693',lastHttp:500},
  {session:'2023-2024',identifier:'SF2699',lastHttp:500},
  {session:'2023-2024',identifier:'SF292',lastHttp:500},
  {session:'2023-2024',identifier:'HF3769',lastHttp:200},
  {session:'2023-2024',identifier:'HF4025',lastHttp:200},
  {session:'2023-2024',identifier:'HF4094',lastHttp:200},
  {session:'2023-2024',identifier:'HF4806',lastHttp:200},
  {session:'2023-2024',identifier:'SF4005',lastHttp:200},
  {session:'2025-2026',identifier:'HF1074',lastHttp:500},
  {session:'2025-2026',identifier:'HF1269',lastHttp:500},
  {session:'2025-2026',identifier:'HF1911',lastHttp:500},
  {session:'2025-2026',identifier:'HF1994',lastHttp:500},
  {session:'2025-2026',identifier:'HF2042',lastHttp:500},
  {session:'2025-2026',identifier:'HF2398',lastHttp:500},
  {session:'2025-2026',identifier:'SF2042',lastHttp:500},
  {session:'2025-2026',identifier:'SF2762',lastHttp:500},
  {session:'2025-2026',identifier:'HF3409',lastHttp:200},
  {session:'2025-2026',identifier:'HF3539',lastHttp:200},
  {session:'2025-2026',identifier:'HF4298',lastHttp:200},
  {session:'2025-2026',identifier:'HF4820',lastHttp:200},
  {session:'2025-2026',identifier:'HF5004',lastHttp:200},
  {session:'2025-2026',identifier:'HF5027',lastHttp:200},
  {session:'2025-2026',identifier:'SF3643',lastHttp:200},
  {session:'2025-2026',identifier:'SF4774',lastHttp:200},
];

export function validateCaseInventory(cases:readonly Case[]=CASES):void {
  const keys=new Set<string>();
  const sessions:Record<Session,number>={
    '2021-2022':0,'2023-2024':0,'2025-2026':0,
  };
  let http500=0,house=0;
  for(const item of cases){
    if(!Object.hasOwn(SESSION_INFO,item.session) ||
      !/^(?:SF|HF)[1-9][0-9]{0,5}$/.test(item.identifier) ||
      ![200,500].includes(item.lastHttp))
      throw Error('Unexpected frozen public bill identifier/status');
    const key=item.session+':'+item.identifier;
    if(keys.has(key))throw Error('Duplicate public bill identifier');
    keys.add(key);
    sessions[item.session]++;
    if(item.lastHttp===500)http500++;
    if(item.identifier.startsWith('HF'))house++;
  }
  if(cases.length!==41 || http500!==25 || house!==31 ||
    sessions['2021-2022']!==12 ||
    sessions['2023-2024']!==13 ||
    sessions['2025-2026']!==16)
    throw Error('41-case inventory differs from protected readback');
}
export function officialUrl(
  item:Case,year:number,kind:'api'|'html',
):string {
  const info=SESSION_INFO[item.session];
  if(!info || ![info.firstYear,info.firstYear+1].includes(year))
    throw Error('Year not in requested legislative session');
  const chamber=item.identifier.slice(0,2),number=Number(item.identifier.slice(2));
  const path=info.legislature+'/'+year+'/0/'+chamber+'/'+number+'/';
  return kind==='api'?'https://api.revisor.mn.gov/bills/v1/'+path:
    'https://www.revisor.mn.gov/bills/'+path;
}
export interface Envelope {
  billTag:boolean;htmlLike:boolean;fileType:string|null;
  fileNumber:number|null;sessionYear:number|null;
  authorsTag:boolean;acceptedByCurrentCollector:boolean;
  reason:string;
}
/** Mirror the existing collector's acceptance checks WITHOUT changing it. */
export function diagnoseXml(xml:string,identifier:string,requestedYear:number):Envelope {
  const billTag=/<(?:[\w.-]+:)?BILL\b/i.test(xml);
  const htmlLike=/<!doctype\s+html|<html\b/i.test(xml.slice(0,1000));
  const fileType=xml.match(/<FILE_TYPE>\s*(HF|SF)\s*<\/FILE_TYPE>/i)?.[1]?.toUpperCase()??null;
  const rawNum=xml.match(/<FILE_NUMBER>\s*(\d+)\s*<\/FILE_NUMBER>/i)?.[1];
  const fileNumber=rawNum?Number(rawNum):null;
  const rawYear=xml.match(/<SESSION_YEAR>\s*(\d{4})\s*<\/SESSION_YEAR>/i)?.[1];
  const sessionYear=rawYear?Number(rawYear):null;
  const expected=identifier.toUpperCase();
  const actual=fileType && fileNumber!==null?fileType+fileNumber:null;
  const reasons:string[]=[];
  if(!billTag)reasons.push('bill_tag_missing');
  if(htmlLike)reasons.push('html_instead_of_xml');
  if(!fileType)reasons.push('file_type_missing');
  if(actual!==expected)reasons.push('bill_identity_mismatch');
  if(sessionYear!==null && sessionYear!==requestedYear)
    reasons.push('session_year_mismatch');
  return {billTag,htmlLike,fileType,fileNumber,sessionYear,
    authorsTag:/<(?:[\w.-]+:)?AUTHORS\b/i.test(xml),
    acceptedByCurrentCollector:reasons.length===0,
    reason:reasons.length?reasons.join(','):'accepted'};
}
export function htmlAuthorHeading(html:string):{found:boolean;count:number|null} {
  const headings=[...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map(x=>x[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
  const found=headings.find(x=>/^Authors(?:\s*\(\d+\))?(?:\s|$)/i.test(x))??'';
  const count=found.match(/^Authors\s*\((\d+)\)/i)?.[1];
  return {found:Boolean(found),count:count!==undefined?Number(count):null};
}

interface Event {
  repository?:{full_name?:string;default_branch?:string};
  ref?:string;after?:string;deleted?:boolean;forced?:boolean;
  head_commit?:{id?:string;message?:string};
}
function authorizePublicAudit():void {
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true' || e.GITHUB_REPOSITORY!==REPO ||
    e.GITHUB_EVENT_NAME!=='push' || e.GITHUB_REF!=='refs/heads/main' ||
    e.GITHUB_RUN_ATTEMPT!=='1' ||
    e.VOTEPREDICT_AUTHORS_41_SOURCE_REVIEW_CI!=='true' ||
    !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'') || !e.GITHUB_EVENT_PATH)
    throw Error('Exact reviewed main and independent CI required');
  const event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH,'utf8')) as Event;
  if(event.repository?.full_name!==REPO ||
    event.repository?.default_branch!=='main' ||
    event.ref!=='refs/heads/main' ||
    event.after!==e.GITHUB_SHA ||
    event.head_commit?.id!==e.GITHUB_SHA ||
    !event.head_commit?.message?.includes(MARKER) ||
    event.deleted===true || event.forced===true)
    throw Error('Unreviewed or replayed one-shot source audit denied');
}

type RequestResult={status:number|null;body:string;failure:string|null};
let requests=0;
let stopReason:string|null=null;
const pacer=new RevisorPacer({intervalMs:1250});
async function publicGet(url:string,accept:string):Promise<RequestResult> {
  if(stopReason)return {status:null,body:'',failure:'stopped'};
  await pacer.wait();
  requests++;
  try {
    const res=await fetch(url,{
      method:'GET',headers:{Accept:accept,
        'User-Agent':'VotePredict/2.0 (read-only manual official-source review)'},
      cache:'no-store',signal:AbortSignal.timeout(12000),
    });
    const host=new URL(res.url).hostname;
    if(!['api.revisor.mn.gov','www.revisor.mn.gov','revisor.mn.gov'].includes(host))
      throw Error('Unexpected official host');
    if(res.status===429 || res.status===503)
      stopReason='official_source_throttling_'+res.status;
    const len=Number(res.headers.get('content-length')??0);
    if(res.ok && len>2_000_000)
      return {status:res.status,body:'',failure:'oversized_response'};
    return {status:res.status,body:res.ok?await res.text():'',failure:null};
  }catch {
    return {status:null,body:'',failure:'timeout_or_request_error'};
  }
}
async function reviewCase(item:Case):Promise<Json> {
  const info=SESSION_INFO[item.session];
  const api:Json[]=[];
  let anyAccepted=false;
  for(const year of [info.firstYear,info.firstYear+1]){
    const result=await publicGet(officialUrl(item,year,'api'),'application/xml,text/xml;q=0.9,*/*;q=0.1');
    if(result.status===200 && result.body){
      const diagnostic=diagnoseXml(result.body,item.identifier,year);
      anyAccepted=anyAccepted||diagnostic.acceptedByCurrentCollector;
      api.push({year,http:result.status,bodyBytes:result.body.length,diagnostic});
    }else api.push({year,http:result.status,failure:result.failure});
    if(stopReason)break;
  }
  let html:Json|null=null;
  if(!stopReason){
    const year200=api.find(x=>x.http===200)?.year as number|undefined;
    const first=year200??info.firstYear;
    for(const year of [first,info.firstYear+info.firstYear+1-first]){
      if(html && (html.authorHeadingFound===true || html.authorCount!==null))
        break;
      const response=await publicGet(officialUrl(item,year,'html'),'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1');
      const heading=response.status===200?htmlAuthorHeading(response.body):{found:false,count:null};
      const identifierPattern=new RegExp('\\b'+item.identifier.slice(0,2)+'\\s*'+
        item.identifier.slice(2)+'\\b','i');
      html={year,http:response.status,
        officialBillHeadingFound:response.status===200&&identifierPattern.test(response.body),
        authorHeadingFound:heading.found,authorCount:heading.count,
        failure:response.failure};
      if(stopReason)break;
    }
  }
  return {session:item.session,identifier:item.identifier,lastRecordedHttp:item.lastHttp,
    api,html,apiNowAccepted:anyAccepted};
}
async function main():Promise<void>{
  authorizePublicAudit();
  validateCaseInventory();
  const started=Date.now();
  const results:Json[]=[];
  for(const item of CASES){
    if(Date.now()-started>17*60_000){
      stopReason='17_minute_source_review_budget';
      break;
    }
    const row=await reviewCase(item);
    results.push(row);
    // Only public bill IDs, response codes and safe envelope/headline metadata.
    console.log('SENATE_BILL_AUTHORS_41_SOURCE_CASE='+JSON.stringify(row));
    if(stopReason)break;
  }
  const report={
    status:results.length===CASES.length && !stopReason?'completed':'partial',
    audited:results.length,total:CASES.length,requests,
    lastStoredHttp500:CASES.filter(x=>x.lastHttp===500).length,
    nowAcceptableXml:results.filter(x=>x.apiNowAccepted===true).length,
    officialHtmlAuthorHeadings:results.filter(x=>
      (x.html as Json|null)?.authorHeadingFound===true).length,
    stoppedFor:stopReason,at:new Date().toISOString(),
    databaseAccess:false,productionWrites:false,collectorRestarted:false,
  };
  console.log('SENATE_BILL_AUTHORS_41_SOURCE_REVIEW='+JSON.stringify(report));
  if(report.status!=='completed')process.exitCode=1;
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  void main().catch(()=>{console.error('One-time official-source audit stopped at protected gate');process.exitCode=1;});
