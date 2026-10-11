/**
 * #864 one-shot public-original-source proof of 2023/2024 annual Minnesota
 * CFB deadlines and §10A.20 (nonpublic until 8am after DUE) and §10A.243.
 * Never downloads report transactions; PDF/statute fetched only in memory.
 * Only exact source SHA/bytes and small categorical flags reach artifact.
 *
 * node --import tsx scripts/audit-cfb-2023-24-original-annual-filing-calendars.ts
 * --output artifacts/cfb-2023-24-official-annual-calendars-and-statutes.json
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {
  CFB_YE_LEGAL_RELEASE_RESEARCH_VERSION,
  CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS as URLS,
  originalCfbYearEndLegalReleaseThreshold,
} from '../src/evidence/cfb-2023-24-yearend-statutory-thresholds.js';
const USER_AGENT='Mozilla/5.0 VotePredict public original CFB calendar and legal history only';
type Snapshot={sourceUrl:string;sourceSha256:string;bytes:number;observedAt:string;
 sourceType:'official_board_calendar_pdf'|'original_mn_revisor_statute_html';
 titleMatched:boolean;exactYearEndReportDueMatched:boolean|null;
 exactCoveragePeriodMatched:boolean|null;chapter10A20StatutoryReleaseMatched:boolean|null;
 filingContinuingUntilTerminationMatched:boolean|null;
 section10A243TerminationReportRequirementMatched:boolean|null;
 failureKind:string|null};
function failKind(error:unknown):string{
 const m=error instanceof Error?error.message:String(error);
 return /timeout|abort/i.test(m)?'official_original_source_timeout':
   /HTTP [45]\d\d/i.test(m)?'official_original_source_http_error':
   /PDF|parsed|calendar/i.test(m)?'official_source_document_text_unverified':
   'original_source_identity_or_statutory_content_not_proven';
}
function normalized(s:string){return s.replace(/\u0000/g,'').replace(/<[^>]*>/g,' ')
 .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
 .replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();}
async function bytesFromOriginalSource(url:string,pdf:boolean){
 const target=new URL(url);
 if(target.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov','www.revisor.mn.gov',
   'revisor.mn.gov'].includes(target.hostname.toLowerCase()))
   throw Error('Only exact official CFB and Minnesota Revisor hosts permitted');
 const resp=await fetch(url,{headers:{'user-agent':USER_AGENT,
   accept:pdf?'application/pdf':'text/html,application/xhtml+xml'},
   redirect:'follow',signal:AbortSignal.timeout(45_000)});
 if(!resp.ok)throw Error('HTTP '+resp.status);
 const end=new URL(resp.url);
 if(!['cfb.mn.gov','www.cfb.mn.gov','www.revisor.mn.gov','revisor.mn.gov']
   .includes(end.hostname.toLowerCase())||end.protocol!=='https:')
   throw Error('Official source was redirected outside approved government hosts');
 const bytes=new Uint8Array(await resp.arrayBuffer());
 if(bytes.length<300||bytes.length>3_000_000)throw Error('Official legal source outside bounded byte length');
 if(pdf&&new TextDecoder('ascii').decode(bytes.subarray(0,5))!=='%PDF-')
   throw Error('Official CFB calendar was not a PDF');
 if(!pdf&&/^\s*<!doctype html/i.test(new TextDecoder('utf-8').decode(bytes.subarray(0,300)))===false
   &&new TextDecoder('utf-8').decode(bytes.subarray(0,100)).indexOf('<html')<0)
   throw Error('Official Revisor source not recognized HTML');
 return{bytes,sha:createHash('sha256').update(bytes).digest('hex')};
}
async function pdfText(bytes:Uint8Array){
 const {CanvasFactory}=await import('pdf-parse/worker');
 const {PDFParse}=await import('pdf-parse');
 const parser=new PDFParse({data:bytes,CanvasFactory});
 try{return normalized((await parser.getText()).text??'');}
 finally{await parser.destroy();}
}
async function pdfCalendar(year:2023|2024):Promise<Snapshot>{
 const threshold=originalCfbYearEndLegalReleaseThreshold(year),
  url=threshold.officialOriginalBoardCalendar;
 const {bytes,sha}=await bytesFromOriginalSource(url,true);
 // pdf-parse can transfer/detach its Uint8Array input: fingerprint its size BEFORE parse.
 const sourceByteCount=bytes.byteLength;
 const body=await pdfText(bytes);
 const goodTitle=/Campaign Finance (?:and )?Public Disclosure Board/i.test(body)
  &&/Campaign Finance Disclosure Calendar/i.test(body);
 const actualYear = new RegExp(year+'\\s+year-end report of receipts and expenditures due','i')
   .test(body);
 const coverage = new RegExp('1\\s*/\\s*1\\s*/\\s*'+year+
   '\\s+through\\s+12\\s*/\\s*31\\s*/\\s*'+year,'i').test(body);
 const due=/January\s+31/i.test(body)
   &&body.includes(String(year+1))
   &&actualYear;
 return {sourceUrl:url,sourceSha256:sha,bytes:sourceByteCount,
   observedAt:new Date().toISOString(),sourceType:'official_board_calendar_pdf',
   titleMatched:goodTitle,exactYearEndReportDueMatched:due,
   exactCoveragePeriodMatched:coverage,
   chapter10A20StatutoryReleaseMatched:null,
   filingContinuingUntilTerminationMatched:null,
   section10A243TerminationReportRequirementMatched:null,
   failureKind:goodTitle&&due&&coverage?null:'official_source_calendar_required_fields_missing'};
}
async function originalStatute(url:string,which:'10A20'|'10A243'):Promise<Snapshot>{
 const {bytes,sha}=await bytesFromOriginalSource(url,false);
 const text=normalized(new TextDecoder('utf8').decode(bytes));
 const twenty=which==='10A20',title=twenty
   ?/10A\.20\s+CAMPAIGN REPORTS/i.test(text)
   :/10A\.243\s+TERMINATION OF REGISTRATION/i.test(text);
 const release=twenty?/A report filed under this section is nonpublic data until 8:00 a\.m\. on the day following the day the report was due/i.test(text):null;
 const duration=twenty?/must continue to file until the committee, fund, or party unit is terminated/i.test(text):null;
 const final=twenty?null:/may terminate its registration with the board after it has disposed of all its assets in excess of \$100 by filing a final report of receipts and expenditures/i.test(text);
 const due=twenty?/reports must be filed with the board on or before January 31 of each year/i.test(text):null;
 return {sourceUrl:url,sourceSha256:sha,bytes:bytes.length,
  observedAt:new Date().toISOString(),sourceType:'original_mn_revisor_statute_html',
  titleMatched:title,exactYearEndReportDueMatched:due,
  exactCoveragePeriodMatched:null,chapter10A20StatutoryReleaseMatched:release,
  filingContinuingUntilTerminationMatched:duration,
  section10A243TerminationReportRequirementMatched:final,
  failureKind:title&&(twenty?release&&due&&duration:final)?null:
   'original_statutory_section_or_operative_words_not_verified'};
}
async function main(){
 const argv=process.argv.slice(2);
 if(argv.length!==2||argv[0]!=='--output'||!argv[1])
   throw Error('Only --output artifacts/<new>.json permitted');
 const out=resolve(argv[1]);
 if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
   throw Error('Only new metadata JSON inside artifacts permitted');
 const definitions=[
  {type:'official_calendar_2023',action:()=>pdfCalendar(2023)},
  {type:'official_calendar_2024',action:()=>pdfCalendar(2024)},
  {type:'revisor_10A20_2023',action:()=>originalStatute(URLS.chapter10A20_2023,'10A20')},
  {type:'revisor_10A20_2024',action:()=>originalStatute(URLS.chapter10A20_2024,'10A20')},
  {type:'revisor_10A243_2024',action:()=>originalStatute(URLS.chapter10A243_2024,'10A243')},
 ];
 const records:Array<Omit<Snapshot,'sourceSha256'|'bytes'> & {role:string;sourceSha256:string|null;bytes:number|null}>=[];
 for(const target of definitions){
  try{records.push({role:target.type,...await target.action()});}
  catch(e){records.push({role:target.type,sourceUrl:target.type==='revisor_10A20_2023'
    ?URLS.chapter10A20_2023:target.type==='revisor_10A20_2024'
    ?URLS.chapter10A20_2024:target.type==='revisor_10A243_2024'
    ?URLS.chapter10A243_2024:target.type==='official_calendar_2023'
    ?URLS.reportYear2023:URLS.reportYear2024,
    sourceSha256:null,bytes:null,observedAt:new Date().toISOString(),
    sourceType:target.type.startsWith('official')?'official_board_calendar_pdf':'original_mn_revisor_statute_html',
    titleMatched:false,exactYearEndReportDueMatched:null,exactCoveragePeriodMatched:null,
    chapter10A20StatutoryReleaseMatched:null,
    filingContinuingUntilTerminationMatched:null,
    section10A243TerminationReportRequirementMatched:null,
    failureKind:failKind(e)});}
 }
 const verified=(role:string)=>records.some(x=>x.role===role&&x.failureKind===null);
 const mandatory=["official_calendar_2023","official_calendar_2024",
   "revisor_10A20_2024","revisor_10A243_2024"];
 const result={
  schemaVersion:CFB_YE_LEGAL_RELEASE_RESEARCH_VERSION,
  issue:864,retrievedAt:new Date().toISOString(),
  originalPublicSourcesOnly:true,
  originalCalendarSourceRecords:records,
  fixedStatutoryDates:[originalCfbYearEndLegalReleaseThreshold(2023),
    originalCfbYearEndLegalReleaseThreshold(2024)],
  officialSourceAudit:{
    mandatoryPrimarySourcesFullyVerified:mandatory.every(verified)
      &&records.every(x=>x.bytes!==null&&x.bytes>=300&&/^[a-f0-9]{64}$/.test(x.sourceSha256??'')),
    originalSourceMetadataContainsVerifiedNonzeroByteSizes:records.every(x=>x.bytes!==null&&x.bytes>=300),
    original2023StatuteCopyIndependentlyRechecked:verified('revisor_10A20_2023'),
    sourceDocumentFailures:records.filter(x=>x.failureKind).map(x=>({role:x.role,kind:x.failureKind})),
    calendar2023HasExact2023YearEndReportAndCoveredPeriod:verified('official_calendar_2023'),
    calendar2025HasExact2024YearEndReportAndCoveredPeriod:verified('official_calendar_2024'),
    statutoryReportsNonpublicUntilNextDayEightAMProven:verified('revisor_10A20_2024'),
    activeCommitteeDutyTerminationDependentProven:verified('revisor_10A20_2024')
      &&verified('revisor_10A243_2024'),
    exactLegallyOwedCommitteeReportsDenominator:null,
    historicalActualPublicationTimeProvenCount:0,
  },
  safeguards:{noRawPDFStatuteBodiesOrPersonalDataStored:true,
    noSourceFinanceTransactionData:true,noLegalDutyInferredForAnyCommittee:true,
    noActualPublicByOrForecastEligibilityClaim:true,
    noLiveDatabaseModelSchedulerTrainingOr2027Changes:true,
    issue864MustRemainOpen:true},
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,...result.officialSourceAudit,
   output:out,productionWrites:0},null,2));
 if(!result.officialSourceAudit.mandatoryPrimarySourcesFullyVerified)process.exitCode=1;
}
main().catch(e=>{console.error(failKind(e));process.exitCode=1;});
