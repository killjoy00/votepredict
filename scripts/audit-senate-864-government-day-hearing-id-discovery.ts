/**
 * #864 bounded non-secret original government calendar source shape probe.
 * Temporary diagnostic for restoring exact Senate hearing_id on 2024/2025
 * LRL-indexed meetings without Minutes PDFs. Never discover vote/people.
 */
import {createHash} from 'node:crypto';
const cases=[
 {name:'2024_taxes',committee:'Taxes',date:'2024-03-06',expectedId:18475},
 {name:'2024_state',committee:'State and Local Government and Veterans',date:'2024-03-14',expectedId:18532},
 {name:'2025_energy',committee:'Energy, Utilities, Environment, and Climate',date:'2025-03-19',expectedId:19216},
] as const;
const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
function probe(url:string,html:string){
 const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ');
 const summary={
  baseUrl:new URL(url).origin+new URL(url).pathname,
  rawHtmlSha256:sha(new TextEncoder().encode(html)),htmlBytes:Buffer.byteLength(html,'utf8'),
  title:html.match(/<title\b[^>]*>([^<]+)<\/title>/i)?.[1]?.slice(0,100)??null,
  mtgidTokens:[...new Set([...html.matchAll(/\bs_\d{5}\b/g)].map(x=>x[0]))].slice(0,12),
  senateIndividualHrefPaths:[...new Set([...html.matchAll(/\/schedule\/individual\/\d{5}(?:\/\d{8})?/gi)].map(x=>x[0]))].slice(0,12),
  directHearingIds:[...new Set([...html.matchAll(/hearing_id[=&:\/'" ]+(\d{5})/gi)].map(x=>x[1]))].slice(0,12),
  calendarDetailsScriptCandidates:[...new Set([...html.matchAll(/(?:src|href)=["']([^"']{1,160}(?:cal|schedule)[^"']{0,160})["']/gi)].map(x=>x[1]))].slice(0,8),
  sawNeedJavascriptMessage:/doesn.t work properly without JavaScript/i.test(clean),
 };
 const sourceVariants=[] as Array<{found:number;context:string}>;
 for(const term of ['Taxes','State and Local Government and Veterans','Energy, Utilities, Environment, and Climate','s_19216','hearing_id','19216']){
  let start=0,count=0;
  while(count<2){
   const ix=clean.toLowerCase().indexOf(term.toLowerCase(),start);
   if(ix<0)break;
   sourceVariants.push({found:ix,context:clean.slice(Math.max(0,ix-100),Math.min(clean.length,ix+230))
    .replace(/\s+/g,' ').replace(/[<>]/g,'').slice(0,330)});
   count++;start=ix+term.length;
  }
 }
 return {summary,publicPageAnchors:sourceVariants.slice(0,14)};
}
async function get(url:string){
 const u=new URL(url);
 if(u.protocol!=='https:'||!['www.leg.mn.gov','www.senate.mn'].includes(u.hostname)||
    !['/cal','/schedule/senate/20240306','/schedule/senate/20240314',
     '/schedule/senate/20250319'].includes(u.pathname))
  throw Error('Refuse nonreviewed government date-source URL');
 const r=await fetch(url,{redirect:'manual',headers:{accept:'text/html', 'user-agent':'VotePredict/2.0 committee-calendar-primary-id-audit'},
  signal:AbortSignal.timeout(30000)});
 if(r.status!==200)throw Error('Government original day source returned non-200 '+r.status);
 const a=new Uint8Array(await r.arrayBuffer());
 if(a.byteLength<300||a.byteLength>2_000_000)throw Error('Government original day HTML out of bounds');
 return {text:new TextDecoder('utf-8',{fatal:true}).decode(a),bytes:a.length};
}
for(const c of cases){
 for(const sourceType of ['leg','senate'] as const){
  const [y,m,d]=c.date.split('-'),url=sourceType==='leg'?
   'https://www.leg.mn.gov/cal?d1='+m+'%2F'+d+'%2F'+y:
   'https://www.senate.mn/schedule/senate/'+y+m+d;
  try{
   const x=await get(url);
   console.log('SENATE864_GOV_CALENDAR_PROBE='+JSON.stringify({
    sourceType,case:c.name,date:c.date,expectedHearingId:c.expectedId,
    expectedIdStringFound:x.text.includes(String(c.expectedId)),...probe(url,x.text)
   }));
  }catch(e){
   console.log('SENATE864_GOV_CALENDAR_PROBE_HOLD='+JSON.stringify({
    sourceType,case:c.name,
    errorCategory:(e instanceof Error&&e.message.startsWith('Government original day'))?'government_http_or_length':'network_or_source_html',
   }));
  }
 }
}
