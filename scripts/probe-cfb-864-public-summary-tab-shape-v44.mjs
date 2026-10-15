/**
 * #864 V44 preliminary official CFB API source-shape probe.
 * Only public candidate principal pages and controlled tabs: two 2022
 * candidates, no donor/payee/transaction text, no raw HTML or JSON export.
 * Reveals ONLY tab names, report link labels, and financial column/row
 * headings to plan an independently sourced nine/five verification.
 */
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const ORIGIN='https://register.cfb.mn.gov';
const API=ORIGIN+'/reports-and-data/viewers/campaign-finance/candidates/api';
const TARGETS=[{reg:'17140',segment:2022},{reg:'16311',segment:2022},{reg:'18730',segment:2022}];
function sha(value){return createHash('sha256').update(value).digest('hex')}
function reason(error){const msg=error instanceof Error?error.message:String(error);if(/timeout|abort/i.test(msg))return 'timeout';if(/HTTP [45]/.test(msg))return 'government_http_hold';return 'official_tab_structural_hold';}
function listTabs(body){
 const all=[...body.matchAll(/(?:tabname|tab_name|data-tabname)["'\s:=><]+([a-z][a-z0-9_-]+)/gi)].map(x=>x[1]);
 return [...new Set(all)].filter(x=>x.length<=45).slice(0,25);
}
async function candidate(t){
 const url=ORIGIN+'/reports-and-data/viewers/campaign-finance/candidates/'+t.reg+'/'+t.segment+'/';
 const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 VotePredict research public CFB metadata'},signal:AbortSignal.timeout(35000)});
 if(!response.ok)throw Error('CFB candidate page HTTP '+response.status);
 if(new URL(response.url).hostname!=='register.cfb.mn.gov')throw Error('unexpected official host');
 const html=await response.text();if(html.length>1500000)throw Error('unexpected public candidate page size');
 const cookies=(typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[response.headers.get('set-cookie')??'']);
 const cookie=cookies.map(v=>v.split(';')[0]).filter(Boolean).join('; ');
 const tabs=listTabs(html);
 const financialTabHTML=[...html.matchAll(/.{0,260}Financial\s+Summary.{0,270}/gsi)].slice(0,2).map(m=>
  m[0].replace(/[\w.+%-]+@[\w.-]+/g,'[email removed]').replace(/\+?\d[\d ()-]{8,}/g,'[phone removed]'));
 const scriptUrls=[...html.matchAll(/<script[^>]+src=["']([^"']{0,180})["']/gi)].map(m=>m[1]).filter(x=>!x.includes('google')&&!x.includes('cdn')).slice(-20);
 const outcome=[];
 for(const tabname of ['reports_data','financial']){
  try{
   const p=new URLSearchParams({id:t.reg,year:String(t.segment),
    'year_data[ElectionSegmentEndDate]':String(t.segment),
    'year_data[ElectionSegmentStartDate]':String(t.segment-1),tabname});
   const r=await fetch(API,{method:'POST',headers:{
    'user-agent':'Mozilla/5.0 VotePredict research public CFB metadata',
    accept:'application/json,text/plain;q=0.8,*/*;q=0.2',
    'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
    referer:url,origin:ORIGIN,'x-requested-with':'XMLHttpRequest',
    ...(cookie?{cookie}:{})
   },body:p.toString(),signal:AbortSignal.timeout(30000)});
   if(!r.ok){outcome.push({tab:tabname,http:r.status});continue}
   const data=await r.text();if(data.length>1500000)throw Error('oversized candidate tab');
   let json;try{json=JSON.parse(data)}catch{outcome.push({tab:tabname,format:'not_json',bytes:data.length});continue}
   const text=typeof json.tabcontent==='string'?json.tabcontent:'';
   const allHeaders=[...text.matchAll(/<th\b[^>]*>([\s\S]{0,250}?)<\/th>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
   const headings=allHeaders.filter(x=>x.length<=85).slice(0,32);
   const relevantRows=[...text.matchAll(/<tr\b[^>]*>([\s\S]{0,1500}?)<\/tr>/gi)]
    .filter(x=>/viewPDF\s*\(/i.test(x[1]))
    .slice(0,20).map(m=>{
       const safe=m[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
       const report=m[1].match(/viewPDF\('([^']+)','([^']+)','([^']+)','([^']+)','([^']+)',(\d+)\)/);
       return {key:report?[report[1],report[3],report[4],report[5],report[6]].join(':'):null,
        rowDisplay: safe.slice(0,220).replace(/[\w.+%-]+@[\w.-]+/g,'[email removed]')};
    });
   const yearSummaryLines=[...text.matchAll(/<(?:tr|li|p)[^>]*>([\s\S]{0,1500}?)<\/(?:tr|li|p)>/gi)]
    .map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim())
    .filter(x=>/cash|total receipts|total contributions|receipts|donations|contributions|financial summary/i.test(x))
    .slice(0,12).map(x=>x.slice(0,160).replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,'[name removed]'));
   outcome.push({tab:tabname,http:200,hash:sha(data),bodyBytes:data.length,jsonKeys:Object.keys(json).slice(0,15),
    headingColumns:headings,numberOfPDFReportRows:relevantRows.length,reportRows:relevantRows,
    summaryPatternCount:yearSummaryLines.length,summaryPatternDescriptions:yearSummaryLines});
  }catch(e){outcome.push({tab:tabname,error:reason(e)})}
 }
 return {registration:t.reg,segment:t.segment,pageOriginalSHA256:sha(html),pageTabs:tabs,financialTabHTML,scriptUrls,outcome};
}
const records=[];
for(const t of TARGETS){try{records.push(await candidate(t))}catch(e){records.push({registration:t.reg,error:reason(e)})}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Fixed public candidate metadata tabs only');
 for(const record of records)console.log('CFB_864_PUBLIC_TAB_SHAPE_V44 '+JSON.stringify(record));
}
