/**
 * Issue #864 V44: verify CURRENT Minnesota CFB public Financial Summary's
 * committee-year aggregate receipts for nine previously held PDF report
 * versions and five anomalous Board date stamps. This is an INDEPENDENT
 * CURRENT committee-year Board summary, NOT exact prior amended-report
 * version receipt data, individual transaction parity or public-by dates.
 *
 * Exact 14 source IDs inherited from immutable V43 and full V41 original
 * source ledger. No donor/payee/transaction/body data is logged/stored.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verify14OriginalCFBReportFormAndDateSourceReviewsV43 }
 from './audit-cfb-864-nine-PDF-five-date-original-source-v43.mjs';

export const SCHEMA='cfb-864-nine-PDF-five-date-independent-official-annual-summary-source-v44';
export const PREFIX='CFB_864_OFFICIAL_ANNUAL_SUMMARY_V44 ';
const HOST='https://register.cfb.mn.gov';
const API=HOST+'/reports-and-data/viewers/campaign-finance/candidates/api';
const CATEGORIES=[
 'Individuals contributions','Lobbyist contributions','Committee/fund contributions',
 'Party unit contributions','Other contributions','Public subsidy payments',
 'Loans payable income','Miscellaneous income'
];
const HEX=/^[0-9a-f]{64}$/;
const HASH=x=>createHash('sha256').update(x).digest('hex');

function moneyCents(v){
 const m=/^\$([\d,]+)\.(\d{2})$/.exec(String(v).trim());
 if(!m||!/(?:^\d{1,3}(?:,\d{3})*$)|(?:^\d+$)/.test(m[1]))return null;
 const n=Number(m[1].replaceAll(',',''))*100+Number(m[2]);
 return Number.isSafeInteger(n)&&n>=0?n:null;
}
export function parseOfficialCandidateAnnualFinancialSummary(html){
 if(typeof html!=='string'||html.length>2_000_000)throw Error('Invalid official CFB financial summary body');
 // Parse plain table cell content, preserving source's order and exact labels.
 // No person, creditor, transaction or contributor data is used.
 const cells=html.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/<[^>]*>/g,'\n').split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const records=new Map();let active=null;
 for(let i=0;i<cells.length;i++){
  const match=/^(20\d\d)\s*-\s*Election year$/i.exec(cells[i]);
  if(match){
   const year=Number(match[1]);
   if(records.has(year))throw Error('Duplicate official CFB financial summary year');
   active={year,cells:{}};records.set(year,active);continue;
  }
  if(!active)continue;
  if((CATEGORIES.includes(cells[i])||cells[i]==='Total receipts'||
   cells[i]==='Most recent report through')&&cells[i+1]){
    if(Object.hasOwn(active.cells,cells[i]))throw Error('Duplicate official financial label '+active.year+':'+cells[i]);
    active.cells[cells[i]]=cells[i+1];
  }
 }
 const safe=new Map();
 for(const [year,record] of records){
  const cols=record.cells,receiptMoney=moneyCents(cols['Total receipts']);
  const observedDate=cols['Most recent report through']??'';
  const numbers=CATEGORIES.map(k=>moneyCents(cols[k]));
  const datesMatch=new RegExp('^12/31/'+year+'$').test(observedDate);
  const complete=datesMatch&&numbers.every(Number.isSafeInteger)&&Number.isSafeInteger(receiptMoney)
   &&numbers.reduce((a,b)=>a+b,0)===receiptMoney;
  safe.set(year,complete
   ?{year,yearEndThroughOn:year+'-12-31',boardAnnualReportedReceiptsCents:receiptMoney,
     independentPublicSourceFinancialCategoriesSumCents:numbers.reduce((a,b)=>a+b,0),
     componentCount:CATEGORIES.length,aggregateArithmeticVerified:true,
     sourceType:'official_board_public_candidate_year_financial_summary_current'}
   :{year,status:'incomplete_or_nonreconcilable_public_candidate_year_financial_summary',
      boardAnnualReportedReceiptsCents:null,aggregateArithmeticVerified:false});
 }
 return safe;
}
function userSafeReason(error){
 const s=error instanceof Error?error.message:String(error);
 if(/timeout|abort/i.test(s))return'official_candidate_financial_source_timeout';
 if(/HTTP [45]/i.test(s))return'official_candidate_financial_source_http_hold';
 return'official_candidate_financial_source_structure_hold';
}
export function selectV44ExactSources(){
 const prior=verify14OriginalCFBReportFormAndDateSourceReviewsV43();
 if(prior.originalIndexedGovernmentPDFVersionsPreserved!==830||
  prior.remainingReportVersionsWithUnverifiedSummaryAmounts!==9||
  prior.originalOfficialPDFPrintedDateFieldsInternallyContradictory!==5)
  throw Error('V43 exact version source review changed');
 const proof=JSON.parse(readFileSync('docs/evaluation/source-proof/cfb-2021-25-nine-unverified-PDFs-five-printed-receipt-date-anomalies-v43.json','utf8'));
 const targets=new Map();
 for(const r of proof.records){
  const match=/^(\d+):(2[1-5]):pcc:YE:0:\d+$/.exec(r.versionId);
  if(!match)throw Error('Unexpected V43 candidate report source ID');
  const reg=match[1],year=2000+Number(match[2]),seg=2*Math.ceil(year/2);
  if(reg!==r.versionId.split(':')[0]||!HEX.test(r.sourceWholePDFSHA256))
   throw Error('V43 committee registration or source PDF SHA no longer trusted');
  const key=reg+':'+seg;
  const existing=targets.get(key)??{reg,segment:seg,years:new Set(),versionIds:[]};
  existing.years.add(year);
  existing.versionIds.push(r.versionId);
  targets.set(key,existing);
 }
 const items=[...targets.values()].sort((a,b)=>a.reg.localeCompare(b.reg));
 const yearCounts=items.reduce((n,x)=>n+x.years.size,0);
 if(items.length!==11||yearCounts!==13)throw Error('Not exactly original 11 registrations and 13 committee-years');
 return items.map(x=>({reg:x.reg,segment:x.segment,years:[...x.years].sort(),versionIds:x.versionIds.sort()}));
}
async function governmentFinancialTab(t){
 const page=HOST+'/reports-and-data/viewers/campaign-finance/candidates/'+t.reg+'/'+t.segment+'/';
 const res=await fetch(page,{headers:{'user-agent':'Mozilla/5.0 VotePredict source-only committee-year audit'},signal:AbortSignal.timeout(35000)});
 if(!res.ok)throw Error('CFB official page HTTP '+res.status);
 if(new URL(res.url).hostname!=='register.cfb.mn.gov')throw Error('External candidate site origin');
 await res.arrayBuffer();
 const cookies=(typeof res.headers.getSetCookie==='function'?res.headers.getSetCookie():[res.headers.get('set-cookie')??'']);
 const cookie=cookies.map(x=>x.split(';',1)[0]).filter(Boolean).join('; ');
 const params=new URLSearchParams();
 params.set('id',t.reg);params.set('year',String(t.segment));
 params.set('year_data[ElectionSegmentEndDate]',String(t.segment));
 params.set('year_data[ElectionSegmentStartDate]',String(t.segment-1));
 params.set('tabname','financial');
 const reply=await fetch(API,{method:'POST',headers:{
  'user-agent':'Mozilla/5.0 VotePredict source-only committee-year audit',
  accept:'application/json,text/plain;q=0.8,*/*;q=0.1',
  'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
  referer:page,origin:HOST,'x-requested-with':'XMLHttpRequest',
  ...(cookie?{cookie}:{})
 },body:params.toString(),signal:AbortSignal.timeout(35000)});
 if(!reply.ok)throw Error('Official CFB financial summary HTTP '+reply.status);
 if(new URL(reply.url).hostname!=='register.cfb.mn.gov')throw Error('Official tab returned non-Board source');
 const raw=await reply.text();
 if(raw.length<200||raw.length>2_000_000)throw Error('Invalid official Financial Summary source length');
 const payload=JSON.parse(raw);
 if(typeof payload.tabcontent!=='string')throw Error('Financial Summary API has no public tabcontent');
 const source=parseOfficialCandidateAnnualFinancialSummary(payload.tabcontent);
 const years=t.years.map(year=>{
  const r=source.get(year);
  return r??{year,status:'no_report_year_in_current_official_board_financial_summary',
   boardAnnualReportedReceiptsCents:null,aggregateArithmeticVerified:false};
 });
 return{registration:t.reg,segmentEndYear:t.segment,requestedOriginalVersions:t.versionIds,
  sourceOfficialCandidateFinancialTab:page,officialSourceResponseSHA256:HASH(raw),
  officialSummaryFetchedOn:new Date().toISOString(),sourceBoardAnnualYears:years,
  historicalExactReportVersionPublicByProven:0,originalFiledOnCorrectedFromSeparateEvidence:false,
  thisIsCandidateYearNotAmendmentSnapshot:true};
}
export async function acquire11OfficialFinanceYearSources(){
 const targets=selectV44ExactSources(),results=[];
 for(const t of targets){
  try{results.push(await governmentFinancialTab(t))}
  catch(e){results.push({registration:t.reg,segmentEndYear:t.segment,
   requestedOriginalVersions:t.versionIds,sourceStatus:userSafeReason(e),
   sourceBoardAnnualYears:t.years.map(year=>({year,boardAnnualReportedReceiptsCents:null,
    aggregateArithmeticVerified:false,status:'source_fetch_or_parse_hold'}))})}
 }
 const flat=results.flatMap(x=>x.sourceBoardAnnualYears);
 if(results.length!==11||flat.length!==13||new Set(results.map(x=>x.registration)).size!==11||
    flat.filter(x=>x.aggregateArithmeticVerified).length>13)
  throw Error('One of exact CFB candidate-year source requests lost');
 return{schema:SCHEMA,officialPublicCandidateFinancialTabsRequested:11,
  specificCommitteeYearAggregateTotalsRequested:13,
  officialCandidateYearsWithAggregateArithmeticVerified:flat.filter(x=>x.aggregateArithmeticVerified).length,
  officialCandidateYearsAbsentOrHeld:flat.filter(x=>!x.aggregateArithmeticVerified).length,
  exactOriginalAmendmentPdfAmountsCertifiedByThisAnnualSourceAlone:0,
  exactHistoricPublicByDatesEstablished:0,correctedBoardReceivedDatesEstablished:0,
  noDonorTransactionOrRawPdfExport:true,noProductionOrEligibilityChanges:true,
  results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Exact V43 official CFB nine/five only');
 const report=await acquire11OfficialFinanceYearSources();
 console.log(PREFIX+'SUMMARY '+JSON.stringify(Object.fromEntries(Object.entries(report).filter(([k])=>k!=='results'))));
 for(const row of report.results){
  const str=JSON.stringify(row);
  if(str.length>6000||/rawPDF|donorName|transactionText|contactEmail/.test(str))
   throw Error('No individual CFB personal/transaction source output');
  console.log(PREFIX+'ROW '+str);
 }
}