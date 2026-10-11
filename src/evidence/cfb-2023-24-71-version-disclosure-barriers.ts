/**
 * #864 - source-only original CFB reporting metadata. NEVER wire into
 * production model/serving; these 71 version records are NOT approved as
 * historically public, legally owed or contemporaneously vote-day eligible.
 * Dates from original 2023/2024 §10A.20 and Board's 2023/2025 calendars.
 */
import {createHash} from 'node:crypto';
export const CFB_SERVING_22_ORIGINAL_71_REPORT_CLOCKS_VERSION=
  'cfb-2023-24-original-22-2022-serving-senators-71-ye-version-lower-bounds-v1' as const;
const LEDGER_SHA='bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388';
const HASH=/^[a-f0-9]{64}$/;
type Year=2023|2024;
type SourceStatus=
  |'original_pdf_first_page_authenticated'
  |'distinct_authenticated_amended_pdf'
  |'HOLD_source_pdf_not_authenticated'
  |'HOLD_first_page_registration_unverified'
  |'duplicate_official_amendment_reference_pdf_alias';
type Cohort='verified28Originals'|'recovered16Originals'
  |'parentVerified16Amendments'|'recovered11Amendments';
export interface CfbSourceVersionDisclosureBarrier{
  officialViewerReportVersionId:string;
  actual2022ServingSenator:string;
  districtActuallyServed2022:number;
  committeeRegistrationNumber:string;
  reportYear:Year;
  reportKind:'original'|'amended';
  viewerOriginalApiSha256:string;
  sourcePdfSha256:string;
  sourcePdfStatus:SourceStatus;
  duplicateViewerIndexCanonicalId:string|null;
  paperBoardReceivedOn:string;
  periodStartOn:string;periodEndOn:string;
  legalYearEndDueOn:string;
  statutoryNotBeforeLocal:string;
  earliestPossibleDateFloor:string|null;
  actualHistoricalPublicByOn:null;
  thisExactReportLegallyOwed:null;
  historicalForecastEligible:false;
  sourceCohort:Cohort;
  actualHistoricalDisplayProofKind:'none';
}
function safeDay(x:string){const d=new Date(x+'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(d.getTime())
    &&d.toISOString().slice(0,10)===x;
}
export function parseCfb2023to24SourceVersionStatutoryBounds(
  sourcePsv:string,
):CfbSourceVersionDisclosureBarrier[]{
 const git=createHash('sha1').update('blob '+Buffer.byteLength(sourcePsv,'utf8')+'\0')
  .update(sourcePsv,'utf8').digest('hex');
 if(git!==LEDGER_SHA||Buffer.byteLength(sourcePsv,'utf8')!==28467)
  throw Error('Seventy-one source-verified original CFB YE version proof ledger has changed');
 const rows=sourcePsv.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));
 if(rows.length!==71||rows.some(x=>x.length!==21))
  throw Error('Exactly 71 previously sourced 2023/24 official report versions expected');
 const out:CfbSourceVersionDisclosureBarrier[]=rows.map(r=>{
   const [id,name,dis,reg,yr,kind,viewer,pdfHash,status,alias,board,
     start,end,due,nonpublic,floor,publicBy,owed,eligible,cohort,pubProof]=r;
   const ref=/^(\d+):(23|24):pcc:YE:0:(\d+)$/.exec(id??'');
   const year=yr==='2023'?2023:yr==='2024'?2024:null;
   const expected=year===2023
     ?['2024-01-31','2024-02-01T08:00:00[America/Chicago]','2024-02-01']
     :['2025-01-31','2025-02-01T08:00:00[America/Chicago]','2025-02-01'];
   if(!ref||!year||yr!=='20'+ref[2]||ref[1]!==reg||!name
     ||! /^\d+$/.test(reg!)||!Number.isInteger(Number(dis))
     ||Number(dis)<1||Number(dis)>67
     ||!HASH.test(viewer!)||!HASH.test(pdfHash!)
     ||!safeDay(board!)||start!==yr+'-01-01'||end!==yr+'-12-31'
     ||due!==expected[0]||nonpublic!==expected[1]
     ||(floor!== '-'&&(!safeDay(floor!)||floor!<expected[2]!))
     ||publicBy!=='-'||owed!=='-'||eligible!=='false'
     ||pubProof!=='historical_public_display_not_independently_proven'
     ||!['verified28Originals','recovered16Originals',
       'parentVerified16Amendments','recovered11Amendments'].includes(cohort!)
     ||!['original_pdf_first_page_authenticated','distinct_authenticated_amended_pdf',
       'HOLD_source_pdf_not_authenticated','HOLD_first_page_registration_unverified',
       'duplicate_official_amendment_reference_pdf_alias'].includes(status!)
     ||!['original','amended'].includes(kind!)
     ||(kind==='original'&&Number(ref[3])!==0)
     ||(kind==='amended'&&Number(ref[3])===0)
     ||((status!.startsWith('HOLD_'))!==(floor==='-'))
     ||(status==='original_pdf_first_page_authenticated'&&kind!=='original')
     ||(status==='distinct_authenticated_amended_pdf'&&kind!=='amended')
     ||(status==='duplicate_official_amendment_reference_pdf_alias'&&kind!=='amended')
     ||(status==='duplicate_official_amendment_reference_pdf_alias'&&alias==='-')
     ||(status!=='duplicate_official_amendment_reference_pdf_alias'&&alias!=='-')
   )throw Error('CFB historical version source identity, YE cutoff or statutory public release changed');
   if(floor!=='-'&&floor!==(board!>expected[2]!?board:expected[2]))
      throw Error('Source receipt date must only create possible-date lower bound');
   return{
     officialViewerReportVersionId:id!,actual2022ServingSenator:name!,
     districtActuallyServed2022:Number(dis),committeeRegistrationNumber:reg!,
     reportYear:year,reportKind:kind as 'original'|'amended',
     viewerOriginalApiSha256:viewer!,sourcePdfSha256:pdfHash!,
     sourcePdfStatus:status as SourceStatus,
     duplicateViewerIndexCanonicalId:alias==='-'?null:alias!,
     paperBoardReceivedOn:board!,periodStartOn:start!,periodEndOn:end!,
     legalYearEndDueOn:due!,statutoryNotBeforeLocal:nonpublic!,
     earliestPossibleDateFloor:floor==='-'?null:floor!,
     actualHistoricalPublicByOn:null,thisExactReportLegallyOwed:null,
     historicalForecastEligible:false,sourceCohort:cohort as Cohort,
     actualHistoricalDisplayProofKind:'none' as const,
   };
 });
 const ids=new Set(out.map(r=>r.officialViewerReportVersionId));
 const used=new Set(out.map(r=>r.committeeRegistrationNumber));
 if(ids.size!==71||used.size!==22||out.filter(r=>r.reportYear===2023).length!==32
   ||out.filter(r=>r.reportYear===2024).length!==39
   ||out.filter(r=>r.reportKind==='original').length!==44
   ||out.filter(r=>r.reportKind==='amended').length!==27)
   throw Error('Original 22-person Senate history CFB year-end version cohort changed');
 const authentic=out.filter(r=>r.sourcePdfStatus==='original_pdf_first_page_authenticated'
   ||r.sourcePdfStatus==='distinct_authenticated_amended_pdf');
 const held=out.filter(r=>r.sourcePdfStatus.startsWith('HOLD_'));
 const aliases=out.filter(r=>r.sourcePdfStatus==='duplicate_official_amendment_reference_pdf_alias');
 if(authentic.length!==68||new Set(authentic.map(x=>x.sourcePdfSha256)).size!==68
   ||held.length!==2||aliases.length!==1)
   throw Error('Only 68 distinct authenticated source finance PDFs and two held/one alias permitted');
 for(const a of aliases){
   const orig=out.find(x=>x.officialViewerReportVersionId===a.duplicateViewerIndexCanonicalId);
   if(!orig||orig.sourcePdfStatus!=='distinct_authenticated_amended_pdf'
     ||orig.sourcePdfSha256!==a.sourcePdfSha256||orig.committeeRegistrationNumber!==a.committeeRegistrationNumber
     ||orig.reportYear!==a.reportYear)
     throw Error('Original official CFB version alias is not same independently authenticated PDF');
 }
 return out;
}
export type HistoricalDisclosureAssessment=
  'original_financial_document_identity_held'|
  'duplicate_official_viewer_index_not_new_financial_form'|
  'statutory_release_or_recorded_receipt_proves_not_yet_public'|
  'release_day_intraday_clock_not_established'|
  'actual_historical_public_display_still_unproven';
export function assessCfb2023to24HistoricalAvailability(
 row:CfbSourceVersionDisclosureBarrier,
 voteDateOn:string,
):{assessment:HistoricalDisclosureAssessment;historicalPredictionEligible:false;
    actualPublicByOn:null;legalNotBeforeLocal:string}{
 if(!safeDay(voteDateOn))throw Error('Historical vote cutoff must be exact valid YYYY-MM-DD');
 let result:HistoricalDisclosureAssessment;
 if(row.sourcePdfStatus.startsWith('HOLD_'))
   result='original_financial_document_identity_held';
 else if(row.sourcePdfStatus==='duplicate_official_amendment_reference_pdf_alias')
   result='duplicate_official_viewer_index_not_new_financial_form';
 else if(voteDateOn<row.earliestPossibleDateFloor!)
   result='statutory_release_or_recorded_receipt_proves_not_yet_public';
 else if(voteDateOn===row.statutoryNotBeforeLocal.slice(0,10))
   result='release_day_intraday_clock_not_established';
 else
   result='actual_historical_public_display_still_unproven';
 return{assessment:result,historicalPredictionEligible:false,
   actualPublicByOn:null,legalNotBeforeLocal:row.statutoryNotBeforeLocal};
}
