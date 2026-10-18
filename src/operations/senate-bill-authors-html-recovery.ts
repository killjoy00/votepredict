/**
 * Strictly scoped, first-party HTML fallback for the 41 failed Revisor XML
 * authorship scans. Deliberately not wired to the bulk collector or forecasts.
 * Parse literal current-author order and only independently printed action dates.
 */
import {authorKey,type RawAuthor} from './senate-bill-author-parser.js';
import {CASES,officialUrl,validateCaseInventory} from '../../scripts/audit-senate-bill-authors-41-source-readonly.js';
import {RevisorPacer} from './senate-revisor-pacer.js';

export const AUTHOR_HTML_RECOVERY_CASES=CASES;
export type HtmlRecoveryCase=(typeof CASES)[number];
export interface ParsedHtmlAuthors {
  declaredCount:number;
  authors:RawAuthor[];
  datedCurrentAuthors:number;
  datedActionRows:number;
}
export interface OfficialHtmlCapture {
  item:HtmlRecoveryCase;
  sourceUrl:string;
  fetchedAt:string;
  rawHtml:string;
  httpStatus:200;
  parsed:ParsedHtmlAuthors;
}
function decodeEntities(value:string):string{
  return value
    .replace(/&#x([0-9a-f]{1,6});/gi,(_m,n:string)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&#([0-9]{1,7});/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
    .replace(/&(?:nbsp|ensp|emsp);/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&apos;|&#39;|&rsquo;|&lsquo;/gi,"'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&ndash;/gi,'–').replace(/&mdash;/gi,'—')
    .replace(/&eacute;/gi,'é').replace(/&aacute;/gi,'á');
}
function plain(html:string):string{
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ').trim());
}
type Heading={start:number;end:number;value:string};
function headings(html:string):Heading[]{
  return [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(m=>({start:m.index,end:m.index+m[0].length,value:plain(m[2])}));
}
function isoDate(us:string,session:string):string|null {
  const match=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(us);
  if(!match)return null;
  const [,mm,dd,yy]=match;
  const n=Number(yy),month=Number(mm),day=Number(dd);
  const [start,end]=session.split('-').map(Number);
  if(n<start || n>end || month<1 || month>12 || day<1 || day>31)return null;
  const date=new Date(Date.UTC(n,month-1,day));
  if(date.getUTCFullYear()!==n||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)
    return null;
  return yy+'-'+mm.padStart(2,'0')+'-'+dd.padStart(2,'0');
}
function normal(value:string):string{
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase().replace(/\s+/g,' ');
}
function appearsAsName(haystack:string,name:string):boolean{
  const n=normal(name),h=' '+normal(haystack)+' ';
  return n.length>1 && h.includes(' '+n+' ');
}
/**
 * Reject wrong-session, wrong-bill, truncated or ambiguous current lists.
 * This parser does not infer any action date from snapshot/fetch timestamps.
 */
export function parseOfficialBillAuthorHtml(html:string,item:HtmlRecoveryCase):ParsedHtmlAuthors{
  validateCaseInventory();
  if(!html||html.length>2_000_000||html.length<3000)
    throw Error('Incomplete or oversized official bill status HTML');
  const titleHead=headings(html).find(h=>/^((HF|SF)\s+\d+)$/.test(h.value));
  const wanted=item.identifier.slice(0,2)+' '+Number(item.identifier.slice(2));
  if(!titleHead||titleHead.value.replace(/\s+/g,' ')!==wanted)
    throw Error('HTML bill heading does not match exact requested identifier');
  const legislature=({ '2021-2022':92,'2023-2024':93,'2025-2026':94 } as Record<string,number>)[item.session];
  const sessionLabel=item.session.split('-');
  const contentHeader=plain(html.slice(titleHead.end,Math.min(html.length,titleHead.end+1200)));
  const expectedSession=new RegExp('\\b'+legislature+
    '(?:st|nd|rd|th)\\s+Legislature\\s*\\(\\s*'+
    sessionLabel[0]+'\\s*[-–]\\s*'+sessionLabel[1]+'\\s*\\)','i');
  if(!expectedSession.test(plain(html.slice(0,Math.min(html.length,titleHead.end+1500)))) &&
     !expectedSession.test(contentHeader))
    throw Error('Revisor legislature / two-year session does not match bill');
  const all=headings(html);
  const idx=all.findIndex(h=>/^Authors\s*\(\s*\d+\s*\)$/i.test(h.value));
  if(idx<0)throw Error('No exact public Authors (N) heading');
  const count=Number(all[idx].value.match(/\(\s*(\d+)\s*\)/)?.[1]);
  if(!Number.isInteger(count)||count<1||count>100)
    throw Error('Invalid public author count');
  const next=all.slice(idx+1).find(h=>h.start>all[idx].end);
  if(!next||!/^Actions\b/i.test(next.value))
    throw Error('Authors list not bounded by actions heading');
  const section=html.slice(all[idx].end,next.start);
  const list=[...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  const names:listName[]=list.map(li=>{
    const a=/<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(li[1]);
    return a?plain(a[1]):'';
  }).filter(Boolean);
  if(names.length!==count)
    throw Error('Listed current authors do not match Authors (N) count');
  if(names.some(name=>name.length>100||name.length<2||/[\d<>{}]/.test(name)))
    throw Error('Non-author / malformed name in official author list');
  const keys=names.map(authorKey);
  if(keys.some(x=>!x)||new Set(keys).size!==names.length)
    throw Error('Ambiguous or repeated official author names');

  // Official Action rows are already printed with dates. Dedupe duplicate
  // chronological and side-by-side page sections by choosing the earliest
  // explicitly printed addition for an identified current author.
  const afterActions=html.slice(next.end);
  const datedAdd=new Map<string,string>();
  const datedStrike=new Map<string,string>();
  let actionRows=0;
  const rows=[...afterActions.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for(const row of rows){
    const s=plain(row[1]);
    const dateMatch=/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/.exec(s);
    const action=/\bAuthors?\s+(added|stricken)\s+(.+?)(?:\s+pg\.\s*|\s*$)/i.exec(s);
    if(!dateMatch||!action)continue;
    const date=isoDate(dateMatch[1],item.session);
    if(!date)continue;
    const target=action[1].toLowerCase()==='added'?datedAdd:datedStrike;
    let found=false;
    for(let i=0;i<names.length;i++){
      if(!appearsAsName(action[2],names[i]))continue;
      const prior=target.get(keys[i]);
      if(!prior || (target===datedAdd?date<prior:date>prior))
        target.set(keys[i],date);
      found=true;
    }
    if(found)actionRows++;
  }
  const authors=names.map((name,i):RawAuthor=>({
    nameRaw:name,role:i===0?'chief':'coauthor',authorOrder:i+1,
    // A listed current author is not currently removed, even if the page
    // records an earlier strike followed by reinstatement. Preserve the
    // historical strike in the complete raw HTML snapshot, not as a false
    // current removed_on state.
    addedOn:datedAdd.get(keys[i])??null,removedOn:null,
  }));
  return {declaredCount:count,authors,
    datedCurrentAuthors:authors.filter(a=>a.addedOn!==null||a.removedOn!==null).length,
    datedActionRows:actionRows};
}
type listName=string;
const INFO:{[key:string]:{legislature:number;first:number}}={
  '2021-2022':{legislature:92,first:2021},
  '2023-2024':{legislature:93,first:2023},
  '2025-2026':{legislature:94,first:2025},
};
export async function fetchOfficialHtmlForCase(
  item:HtmlRecoveryCase,pacer:RevisorPacer,request:typeof fetch=fetch,
):Promise<OfficialHtmlCapture>{
  const spec=INFO[item.session];if(!spec)throw Error('Invalid session');
  // From completed first-party 41-case audit: applicable year has HTTP 200;
  // the other year returned HTTP 500. No API calls are made here.
  const year=spec.first+(item.lastHttp===200?1:0);
  const sourceUrl=officialUrl(item,year,'html');
  await pacer.wait();
  const res=await request(sourceUrl,{
    method:'GET',headers:{Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      'User-Agent':'VotePredict/2.0 (41-case official authorship HTML recovery)'},
    cache:'no-store',signal:AbortSignal.timeout(16000),
  });
  if([429,503].includes(res.status))throw Error('Official-source throttle: abort all recovery');
  if(!res.ok)throw Error('Official HTML did not return 200 for '+item.identifier);
  const final=new URL(res.url);
  if(final.protocol!=='https:'||!['www.revisor.mn.gov','revisor.mn.gov'].includes(final.hostname))
    throw Error('Official HTML redirected to untrusted host');
  const bits=final.pathname.match(/^\/bills\/(\d+)\/(\d{4})\/0\/(SF|HF)\/(\d+)\/?$/i);
  if(!bits||Number(bits[1])!==spec.legislature||
     ![spec.first,spec.first+1].includes(Number(bits[2]))||
     bits[3].toUpperCase()+Number(bits[4])!==item.identifier)
    throw Error('Official HTML redirected to a different bill/year');
  const len=Number(res.headers.get('content-length')??0);
  if(len>2_000_000)throw Error('Oversized official source');
  const rawHtml=await res.text();
  const parsed=parseOfficialBillAuthorHtml(rawHtml,item);
  return {item,sourceUrl:final.toString(),fetchedAt:new Date().toISOString(),
    httpStatus:200,rawHtml,parsed};
}
