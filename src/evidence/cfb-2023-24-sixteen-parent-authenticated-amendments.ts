/**
 * #864 finance only: 16 official CFB 2023/24 YE amendment references, for
 * five independently verified people who actually served MN Senate in 2022.
 * Parents are among 28 independently PDF-authenticated originals (PR #1079).
 * Neither 2023/24 actual service, legal filing obligations, PDF availability
 * at prediction time, nor donor transactions follow from this source audit.
 */
import {createHash} from 'node:crypto';
import {cfbReportViewerUrl} from './cfb-current-report-acquisition.js';
import {
  parseServed2023to24YearEndHeader,served2023to24YearEndRef,
  type Verified2023to24OriginalTarget,
} from './cfb-2023-24-served-28-yearend-originals.js';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof.js';

export const PARENT_VERIFIED_2023_24_16_AMENDMENTS_VERSION=
  'cfb-2023-24-five-verified-served-senators-sixteen-ye-amendment-pdf-source-v1' as const;
const SHA=/^[0-9a-f]{64}$/;
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const gitBlobSha=(s:string)=>createHash('sha1')
  .update('blob '+Buffer.byteLength(s,'utf8')+'\0').update(s,'utf8').digest('hex');
const lines=(s:string)=>s.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));
export interface SourceVerified2023to24YeAmendment {
  id:string;parentOriginalId:string;year:2023|2024;registrationNumber:string;
  senatorVerifiedServedIn2022:string;senateDistrict2022:number;
  amendmentIndex:number;viewerApiSha256:string;
  originalPdfSha256:string;originalPdfBytes:number;
  originalPeriodStart:string;originalPeriodEnd:string;originalBoardReceipt:string;
}
export function selectSixteenParentAuthenticatedYeAmendments(input:{
  originalQueuePsv:string;authenticatedOriginal28Psv:string;
  sourceViewer396Psv:string;sourceOriginalCheckpointJson:string;
}):SourceVerified2023to24YeAmendment[]{
  const ck=JSON.parse(input.sourceOriginalCheckpointJson);
  if(sha(input.originalQueuePsv)!=='838b74e9b2a19b75bb0c2d5509ce8b29c126428bfe3938aca0eb5260a743ba38'
    ||sha(input.sourceViewer396Psv)!=='6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9'
    ||gitBlobSha(input.authenticatedOriginal28Psv)!=='f32027a9efbc6ca60460d3eb9ca77a9f2ec9d50f'
    ||ck.schemaVersion!=='cfb-2023-24-verified-2022-served-fourteen-senators-28-original-ye-pdf-source-checkpoint-v1'
    ||ck.sourceResult.uniqueOriginalPdfSha256!==28
    ||ck.identicalMetadataAcrossTwoOfficialSourceRuns.originalPdfBinarySha256!==true
    ||ck.identicalMetadataAcrossTwoOfficialSourceRuns.coveredPeriodAndBoardReceipt!==true
    ||ck.scope.independentlyVerifiedActualServingSenatorsIn2022!==14)
    throw Error('Independently authenticated real senator source PDF parents changed');
  const parents=lines(input.authenticatedOriginal28Psv);
  if(parents.length!==28||new Set(parents.map(p=>p[0])).size!==28)
    throw Error('Cannot prove 28 original CFB year-end PDF parents');
  const map=new Map(parents.map(x=>[x[0],x]));
  const viewer=new Map(lines(input.sourceViewer396Psv).filter(x=>x[0]==='2024')
    .map(x=>[x[1],x]));
  const queue=lines(input.originalQueuePsv)
    .filter(x=>x[0]==='P3_AMEND_AFTER_PARENT');
  if(queue.length!==16||new Set(queue.map(x=>x[1])).size!==16)
    throw Error('Expected exact sixteen preselected amended-version CFB source IDs');
  const targets=queue.map(row=>{
    const [priority,id,parentId,reportedYear,name,district,registration,segment,
      viewerHash,unverifiedPriorHash]=row;
    const match=/^(\d+):(23|24):pcc:YE:0:([1-9]\d*)$/.exec(id??'');
    const original=map.get(parentId!),snap=viewer.get(registration!);
    if(row.length!==10||priority!=='P3_AMEND_AFTER_PARENT'||!match
      ||match[1]!==registration||parentId!==match[1]+':'+match[2]+':pcc:YE:0:0'
      ||reportedYear!=='20'+match[2]||segment!=='2024'||unverifiedPriorHash!=='-'
      ||!original||original.length!==12||original[0]!==parentId
      ||original[1]!==name||original[2]!==district||original[3]!==registration
      ||original[4]!==viewerHash||original[10]!=='independently_authenticated_original_pdf_first_page'
      ||!SHA.test(original[5]!)||Number(original[6])<300
      ||!snap||snap[2]!==viewerHash
      ||!snap[3]!.split(',').includes(match[2]+':pcc:YE:0:'+match[3]))
      throw Error('Amendment source is not an exact official CFB reference with independently proven PDF parent');
    return{
      id:id!,parentOriginalId:parentId!,year:reportedYear==='2023'?2023 as const:2024 as const,
      registrationNumber:registration!,senatorVerifiedServedIn2022:name!,
      senateDistrict2022:Number(district),amendmentIndex:Number(match[3]),
      viewerApiSha256:viewerHash!,
      originalPdfSha256:original[5]!,originalPdfBytes:Number(original[6]),
      originalPeriodStart:original[7]!,originalPeriodEnd:original[8]!,
      originalBoardReceipt:original[9]!,
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(targets.map(t=>t.registrationNumber)).size!==5
    ||new Set(targets.map(t=>t.parentOriginalId)).size!==6
    ||targets.filter(t=>t.year===2023).length!==6
    ||targets.filter(t=>t.year===2024).length!==10)
    throw Error('Original five-person / six-original-PDF / sixteen-amendment source cohort changed');
  for(const parent of new Set(targets.map(t=>t.parentOriginalId))){
    const arr=targets.filter(t=>t.parentOriginalId===parent).map(t=>t.amendmentIndex)
      .sort((a,b)=>a-b);
    if(arr.some((x,i)=>x!==i+1))throw Error('Official amended PDF source index chain not consecutive');
  }
  return targets;
}
export function sourceYeAmendmentReference(t:SourceVerified2023to24YeAmendment):
  CfbReportViewerReference{
  return {year:String(t.year).slice(2),filingYear:t.year,type:'pcc',period:'YE',
    se:'0',registrationNumber:t.registrationNumber,amendment:t.amendmentIndex,
    reportName:'2023/24 official principal committee amended year-end'};
}
export type CfbAmendedPdfSource={sourceUrl:string;sha256:string;bytes:number;
  observedAt:string;text:string};
export function auditAuthenticatedParentYeAmendment(t:SourceVerified2023to24YeAmendment,
  pdf:CfbAmendedPdfSource|null,sourceError:string|null=null){
  const url=cfbReportViewerUrl(sourceYeAmendmentReference(t));
  const provenance=!!pdf&&pdf.sourceUrl===url&&SHA.test(pdf.sha256)
    &&Number.isInteger(pdf.bytes)&&pdf.bytes>=300&&pdf.bytes<=30_000_000
    &&Number.isFinite(Date.parse(pdf.observedAt));
  const sourceOriginal:Verified2023to24OriginalTarget={
    id:t.parentOriginalId,reg:t.registrationNumber,
    actualSenator:t.senatorVerifiedServedIn2022,
    district2022:t.senateDistrict2022,reportYear:t.year,
    originalViewerApiSha256:t.viewerApiSha256,originalViewerSegment:2024,
    reportingPeriod:'YE',amendmentIndex:0,specialElectionFlag:'0',
  };
  const header=provenance?parseServed2023to24YearEndHeader(sourceOriginal,pdf!.text):null;
  const checked=!!header?.verified
    &&header.coverageStartOn===t.originalPeriodStart
    &&header.coverageEndOn===t.originalPeriodEnd
    &&!!header.boardReceivedOn
    &&header.boardReceivedOn>=t.originalBoardReceipt;
  const distinct=provenance&&pdf!.sha256!==t.originalPdfSha256;
  const authenticated=provenance&&checked&&distinct&&!sourceError;
  return{
    id:t.id,independently2022ServingSenator:t.senatorVerifiedServedIn2022,
    electionDistrict2022:t.senateDistrict2022,reportYear:t.year,
    registrationNumber:t.registrationNumber,amendmentViewerIndex:t.amendmentIndex,
    officiallyIndicatedAmendment:true,independentlyVerifiedPaperAmendedCheckbox:null,
    parentOriginalReportId:t.parentOriginalId,originalPdfSha256:t.originalPdfSha256,
    originalPdfBytes:t.originalPdfBytes,originalCoverageStartOn:t.originalPeriodStart,
    originalCoverageEndOn:t.originalPeriodEnd,originalBoardReceiptOn:t.originalBoardReceipt,
    originalViewerApiSha256:t.viewerApiSha256,
    pdfUrl:provenance?pdf!.sourceUrl:null,pdfSha256:provenance?pdf!.sha256:null,
    pdfBytes:provenance?pdf!.bytes:null,pdfRetrievedAt:provenance?pdf!.observedAt:null,
    amendedFirstPageOfficeRegistrationPeriodReceiptVerified:checked,
    amendedBoardReceiptOn:header?.boardReceivedOn??null,
    firstPagePrintedSenateDistrictMatched:header?.exactPrintedSenateDistrictMatches??false,
    firstPageRegistrationMatched:header?.committeeRegistrationMatches??false,
    sourceFailureKind:sourceError,
    distinctBinaryFromParent:!!distinct,
    independentStatutoryDueDate:null,
    historicallyActuallyPublicByOn:null,
    legallyOwedReportCount:null,
    eligibleForHistoricalForecast:false,
    status:sourceError?'official_source_failed'
      :!provenance?'source_pdf_missing_or_provenance_failed'
      :!checked?'source_first_page_committee_or_dates_unverified'
      :!distinct?'official_version_binary_identical_to_original_parent'
      :'amended_pdf_and_parent_identity_authenticated' as const,
  };
}
export function auditSixteenAmendmentSourceSequence(
  reports:ReturnType<typeof auditAuthenticatedParentYeAmendment>[],
){
  const legit=reports.filter(x=>x.status==='amended_pdf_and_parent_identity_authenticated');
  const hashes=legit.map(r=>r.pdfSha256!);
  const duplicates=legit.filter(r=>hashes.indexOf(r.pdfSha256!)!==hashes.lastIndexOf(r.pdfSha256!))
    .map(r=>({id:r.id,sha256:r.pdfSha256}));
  const byParent=new Map<string,typeof legit>();
  for(const r of legit){
    const list=byParent.get(r.parentOriginalReportId)??[];
    list.push(r);byParent.set(r.parentOriginalReportId,list);
  }
  const sourceHolds=reports.filter(r=>r.status!=='amended_pdf_and_parent_identity_authenticated')
    .map(r=>({id:r.id,status:r.status}));
  const complete=reports.length===16&&legit.length===16&&sourceHolds.length===0
    &&new Set(reports.map(r=>r.id)).size===16&&new Set(hashes).size===16
    &&byParent.size===6;
  return{
    exactOfficialAmendmentVersions:reports.length,
    independentlyAuthenticatedAmendmentPdfReferences:legit.length,
    distinctlyAuthenticatedAmendedPdfBinaries:new Set(hashes).size,
    unexpectedDuplicateVersionPdfContent:duplicates,
    sourceHolds,acceptedAllSixteenDistinct:complete,
    originalReportParentsVerified:6,
    originalSourceRealSenatorsVerified:5,
    historicallyProvenPublicByCount:0,
    statutoryRequiredReportsDenominator:null,
    independent2023Or2024ServiceEstablishment:false,
  };
}
