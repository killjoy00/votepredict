/**
 * #864 FINANCE Track A: 28 2023/24 YE original CFB report version references
 * for 14 independently verified 2022 serving senators. This does NOT claim
 * that all 14 were still serving in both later report years, legally owed
 * filings or that contemporary historical publication timing is established.
 */
import {createHash} from 'node:crypto';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof.js';
import {cfbReportViewerUrl} from './cfb-current-report-acquisition.js';

export const VERIFIED_SERVING_2023_24_YE_SOURCE_VERSION=
  'cfb-2023-24-fourteen-verified-2022-senators-twenty-eight-original-ye-pdf-source-v1' as const;
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const HASH=/^[0-9a-f]{64}$/;
const lines=(s:string)=>s.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));
const expectedRegs=['18430','17117','18795','18763','18058','17105','18901',
  '16891','17893','17362','18819','16964','17319','18781'].sort();
export interface Verified2023to24OriginalTarget{
  id:string;reportYear:2023|2024;reg:string;actualSenator:string;
  district2022:number;originalViewerApiSha256:string;originalViewerSegment:2024;
  reportingPeriod:'YE';amendmentIndex:0;specialElectionFlag:'0';
}
export function selectServed2023to24OriginalYearEnds(input:{
  queuePsv:string;viewerPsv:string;priorCeFirstPsv:string;priorCeSecondPsv:string;
}):Verified2023to24OriginalTarget[]{
  if(sha(input.queuePsv)!=='838b74e9b2a19b75bb0c2d5509ce8b29c126428bfe3938aca0eb5260a743ba38'
    ||sha(input.viewerPsv)!=='6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9'
    ||sha(input.priorCeFirstPsv)!=='ff6c330378596c7efd224215908e9e4e70d0cc01b19598dde0f0fc36c57382a2'
    ||sha(input.priorCeSecondPsv)!=='263c1b27b425f67332eacdf855e4ae7f7300d111b2330d0a259d239cfea9050c')
    throw Error('Prior source-authenticated 2022 serving-senator original or CFB viewer evidence changed');
  const prior=[...lines(input.priorCeFirstPsv),...lines(input.priorCeSecondPsv)];
  if(prior.length!==44)throw Error('Cannot establish all 22 source-confirmed 2022 serving senator C/E identities');
  const people=new Map<string,{name:string;district:number}>();
  for(const row of prior){
    const reg=row[0]!.split(':')[0]!,name=row[1]!,district=Number(row[2]);
    const existing=people.get(reg);
    if(existing&&(existing.name!==name||existing.district!==district))
      throw Error('Contradictory 2022 senator identity from official original PDF');
    people.set(reg,{name,district});
  }
  if(people.size!==22)throw Error('Verified 2022 senator registration parent count drifted');
  const view=lines(input.viewerPsv).filter(r=>r[0]==='2024'
    &&expectedRegs.includes(r[1]!));
  if(view.length!==14||new Set(view.map(r=>r[1])).size!==14)
    throw Error('Original official CFB 2024 candidate viewer sample no longer has 14 persons');
  const viewerByReg=new Map(view.map(r=>[r[1]!,r]));
  const selected=lines(input.queuePsv).filter(r=>r[0]==='P2_AUTHENTICATE_ORIGINAL_FIRST');
  if(selected.length!==28||new Set(selected.map(r=>r[1])).size!==28)
    throw Error('Strict 28 authentic official 2023/24 YE viewer reference targets changed');
  const countByReg=new Map<string,number>();
  const targets=selected.map(row=>{
    const id=row[1]!,reg=row[6]!;
    const match=/^(\d{4,8}):(23|24):pcc:YE:0:0$/.exec(id);
    const y:2023|2024=match?.[2]==='23'?2023:2024;
    const person=people.get(reg),api=viewerByReg.get(reg);
    if(!match||match[1]!==reg||!person||!api
      ||!expectedRegs.includes(reg)
      ||row[2]!==id||row[3]!==String(y)
      ||row[4]!==person.name||Number(row[5])!==person.district
      ||row[7]!=='2024'||row[8]!==api[2]||row[9]!=='-'
      ||!api[3]!.split(',').includes(match[2]+':pcc:YE:0:0'))
      throw Error('Original public CFB year-end version not joined to actual serving senator');
    countByReg.set(reg,(countByReg.get(reg)??0)+1);
    return{
      id,reg,reportYear:y,actualSenator:person.name,district2022:person.district,
      originalViewerApiSha256:api[2]!,originalViewerSegment:2024 as const,
      reportingPeriod:'YE' as const,amendmentIndex:0 as const,
      specialElectionFlag:'0' as const,
    };
  });
  if(countByReg.size!==14||[...countByReg.values()].some(v=>v!==2))
    throw Error('Expected exactly 2023 and 2024 original YE for each confirmed 2022 senator');
  return targets.sort((a,b)=>a.district2022-b.district2022||a.reportYear-b.reportYear);
}
export function served2023to24YearEndRef(t:Verified2023to24OriginalTarget):CfbReportViewerReference{
  return {filingYear:t.reportYear,registrationNumber:t.reg,year:String(t.reportYear).slice(2),
    type:'pcc',period:'YE',se:'0',amendment:0,
    reportName:'Annual Report of Receipts and Expenditures for Principal Campaign Committee'};
}
function usDay(s:string):string|null{
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(!m)return null;
  const day=m[3]+'-'+m[1]!.padStart(2,'0')+'-'+m[2]!.padStart(2,'0');
  const parsed=new Date(day+'T00:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===day?day:null;
}
function englishDay(s:string):string|null{
  const m=/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/.exec(s);
  if(!m)return null;
  const months=['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const n=months.indexOf(m[1]!.toLowerCase())+1;
  return n?usDay(n+'/'+m[2]+'/'+m[3]):null;
}
export function parseServed2023to24YearEndHeader(t:Verified2023to24OriginalTarget,text:string){
  const first=text.replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,6500);
  const title=/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(first);
  const reg=first.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1]??null;
  const districtIds=[...first.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)]
    .map(m=>Number(m[1]));
  const range=first.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const receipt=first.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const start=usDay(range?.[1]??''),end=usDay(range?.[2]??'');
  const received=englishDay(receipt?.[1]??'');
  const identityValid=title&&reg===t.reg&&districtIds.length>=1
    &&new Set(districtIds).size===1&&districtIds[0]===t.district2022;
  const rangeMatches=start===t.reportYear+'-01-01'
    &&end===t.reportYear+'-12-31';
  const receiptMatches=!!received&&received>=end!;
  const verified=identityValid&&rangeMatches&&receiptMatches;
  return{
    verified,committeeRegistrationMatches:reg===t.reg,
    exactPrintedSenateDistrictMatches:districtIds.length>0&&new Set(districtIds).size===1
      &&districtIds[0]===t.district2022,
    principalCampaignReportTitle:title,coverageStartOn:start,coverageEndOn:end,
    boardReceivedOn:received,sourceFirstPageNormalizedCharCount:first.length,
  };
}
export interface Parsed2023to24Source {
  sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string;
}
export function auditServed2023to24OriginalYearEnd(t:Verified2023to24OriginalTarget,
  fetched:Parsed2023to24Source|null,error:string|null=null){
  const url=cfbReportViewerUrl(served2023to24YearEndRef(t));
  const hasPdf=!!fetched&&fetched.sourceUrl===url&&HASH.test(fetched.sha256)
    &&Number.isInteger(fetched.bytes)&&fetched.bytes>=300&&fetched.bytes<=30_000_000
    &&Number.isFinite(Date.parse(fetched.observedAt));
  const head=hasPdf?parseServed2023to24YearEndHeader(t,fetched!.text):null;
  const authentic=hasPdf&&head?.verified&&!error;
  return{
    originalReportId:t.id,personIndependentlyProvenServedIn2022:t.actualSenator,
    senateDistrict2022:t.district2022,registrationNumber:t.reg,
    reportYear:t.reportYear,actualSenateServiceInLaterReportYear:null,
    originalViewerApiSha256:t.originalViewerApiSha256,
    viewerReferenceIndex:0,independentPdfAmendedCheckboxVerified:null,
    sourcePdfUrl:hasPdf?fetched!.sourceUrl:null,sourcePdfSha256:hasPdf?fetched!.sha256:null,
    sourcePdfByteCount:hasPdf?fetched!.bytes:null,
    pdfFetchedAtUtc:hasPdf?fetched!.observedAt:null,
    originalFirstPageIdentityAndDatesVerified:!!head?.verified,
    header:{principalReportTitle:head?.principalCampaignReportTitle??false,
      committeeRegistrationMatches:head?.committeeRegistrationMatches??false,
      printedSenateDistrictMatches:head?.exactPrintedSenateDistrictMatches??false,
      startOn:head?.coverageStartOn??null,endOn:head?.coverageEndOn??null,
      boardReceivedOn:head?.boardReceivedOn??null,
      originalTextLengthWindow:head?.sourceFirstPageNormalizedCharCount??0},
    statutoryDueOn:null,actualHistoricalPublicByOn:null,
    legallyOwed2023Or2024ReportCount:null,
    historicalPredictionEligible:false,
    sourceError:error,
    status:error?'official_source_fetch_failed'
      :!hasPdf?'official_pdf_source_not_authenticated'
      :!head?.verified?'original_pdf_first_page_identity_coverage_or_receipt_hold'
      :'original_pdf_first_page_authenticated' as const,
  };
}
export function summarize28YearEndSource(reports:ReturnType<typeof auditServed2023to24OriginalYearEnd>[]){
  const authenticated=reports.filter(r=>r.status==='original_pdf_first_page_authenticated');
  const hashes=authenticated.map(r=>r.sourcePdfSha256!);
  const dupe=hashes.filter((x,i)=>hashes.indexOf(x)!==i);
  return{
    sourceVersionCount:reports.length,authenticatedReportReferences:authenticated.length,
    independentlyUniqueOriginalPdfBinaries:new Set(hashes).size,
    unexpectedOriginalBinaryDuplicates:[...new Set(dupe)],
    identityOrSourceHolds:reports.filter(r=>r.status!=='original_pdf_first_page_authenticated')
      .map(r=>({id:r.originalReportId,status:r.status})),
    all28OriginalsIndependentlyAuthenticated:reports.length===28&&authenticated.length===28
      &&new Set(hashes).size===28,
    sourceYear2023Authenticated:authenticated.filter(r=>r.reportYear===2023).length,
    sourceYear2024Authenticated:authenticated.filter(r=>r.reportYear===2024).length,
    statutoryOwedDenominator:null,independentHistoricalPublicByCount:0,
  };
}
