/**
 * #864, finance only: read-only original CFB PDF proof for seven official
 * 2025 amendment references of actual SD29 senator Michael Holmstrom Jr.
 * Never derives statutory filing duty, actual historical public-by, or
 * transaction-level proof from retrospective current CFB data.
 */
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn} from './cfb-report-availability.js';
import {cfbReportViewerUrl} from './cfb-current-report-acquisition.js';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof.js';

const DIGEST=/^[0-9a-f]{64}$/;
export const SD29_2025_SEVEN_AMENDMENTS_SCHEMA=
  'cfb-2025-actual-served-sd29-seven-original-amendment-pdf-proofs-v1' as const;
export const SD29_2025_SOURCE_RESPONSE_SHA=
  '584b5ed98bca7843b6eba51b378328ef41d209aedbbd6d294b5b7526078e5b50' as const;
export const SD29_2025_ACTUAL_SENATOR='Michael Holmstrom Jr' as const;
export const SD29_2025_AMENDMENT_KEYS=[
  '19229:25:pcc:C:1:1',
  '19229:25:pcc:E:1:1',
  '19229:25:pcc:YE:0:1',
  '19229:25:pcc:YE:1:1',
  '19229:25:pcc:YE:1:2',
  '19229:25:pcc:YE:1:3',
  '19229:25:pcc:YE:1:4',
] as const;
const parentExpected=new Map([
  ['19229:25:pcc:C:1:0','c8eca303294251b579908267457158146edd3c51cc6de06eba658589fc6dde6f'],
  ['19229:25:pcc:E:1:0','eeafcd20e31a8cc831a12ae1035fa1ed943733cb9476087f8a3e5e576bc482eb'],
  ['19229:25:pcc:YE:0:0','115af8ec4d2fcf19323ae88cc2e858f1d1cda00c03e9ca994bf31e2070335289'],
  ['19229:25:pcc:YE:1:0','0cecaf71ada09c3cb7d12dd439438dc432c7998159250b7c62e85bfdb0e383b2'],
]);
const parentExactDates=new Map([
  ['19229:25:pcc:C:1:0',['2025-07-29','2025-08-12','2025-08-19','2025-08-19']],
  ['19229:25:pcc:E:1:0',['2025-07-29','2025-10-21','2025-10-28','2025-10-28']],
  ['19229:25:pcc:YE:1:0',['2025-07-29','2025-11-19','2025-11-26','2025-12-01']],
  ['19229:25:pcc:YE:0:0',['2025-11-20','2025-12-31','2026-02-01','2026-02-02']],
]);
const hash=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const noLastLf=(s:string)=>s.endsWith('\n')?s.slice(0,-1):s;
const dataLines=(s:string)=>noLastLf(s).split('\n').filter(Boolean).map(l=>l.split('|'));
function validDate(s:string):boolean{
  return /^\d{4}-\d\d-\d\d$/.test(s)
    &&!Number.isNaN(Date.parse(s+'T00:00:00Z'))
    &&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
function dateUs(s:string):string|null{
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(!m)return null;
  const d=m[3]+'-'+m[1]!.padStart(2,'0')+'-'+m[2]!.padStart(2,'0');
  return validDate(d)?d:null;
}
function dateEnglish(s:string):string|null{
  const m=/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/.exec(s);
  if(!m)return null;
  const months=['january','february','march','april','may','june','july',
    'august','september','october','november','december'];
  const month=months.indexOf(m[1]!.toLowerCase())+1;
  return month?dateUs(month+'/'+m[2]+'/'+m[3]):null;
}
export interface Sd29AmendmentTarget {
  id:string;parentId:string;period:'C'|'E'|'YE';se:'0'|'1';index:number;
  parentPdfSha:string;parentPdfBytes:number;parentStart:string;parentEnd:string;
  parentReceived:string;dueOn:string;viewerSha:string;
  actualSenator:typeof SD29_2025_ACTUAL_SENATOR;district:29;reg:'19229';
}
export function selectSd29SevenAmendmentTargets(source:{
  queuePsv:string;viewerLedgerPsv:string;specialCePsv:string;
  specialFinalPsv:string;ordinaryYePsv:string;
}):Sd29AmendmentTarget[]{
  const queue=source.queuePsv;
  const refs=source.viewerLedgerPsv;
  if(hash(queue)!=='838b74e9b2a19b75bb0c2d5509ce8b29c126428bfe3938aca0eb5260a743ba38'
    ||hash(noLastLf(refs))!=='d34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0')
    throw Error('Pinned original CFB 2025 candidate viewer or acquisition queue changed');
  const viewer=dataLines(refs).filter(r=>r[0]==='19229');
  if(viewer.length!==1||viewer[0]![1]!==SD29_2025_SOURCE_RESPONSE_SHA)
    throw Error('Authenticated actual senator viewer registration API SHA changed');
  const found=dataLines(queue).filter(r=>r[0]==='P1_PARENT_VERIFIED_AMENDMENT');
  if(found.length!==7||new Set(found.map(r=>r[1])).size!==7
    ||found.map(r=>r[1]).sort().join('|')!==[...SD29_2025_AMENDMENT_KEYS].sort().join('|'))
    throw Error('Seven exact official 2025 SD29 amendment source keys changed');
  const supportedParents=new Map<string,Sd29AmendmentTarget>();
  const rows=[...dataLines(source.specialCePsv),
    ...dataLines(source.specialFinalPsv),
    ...dataLines(source.ordinaryYePsv)];
  for(const row of rows){
    const id=row[0]!;
    if(!parentExpected.has(id))continue;
    const sha=row[2]!,bytes=Number(row[3]!),start=row[4]!,
      end=row[5]!,received=row[6]!,due=row[7]!;
    if(supportedParents.has(id)||sha!==parentExpected.get(id)
      ||!Number.isInteger(bytes)||bytes<300
      ||![start,end,received,due].every(validDate)
      ||start>end||received<end||due<end||Number(row[1])!==29
      ||[start,end,received,due].join('|')!==parentExactDates.get(id)?.join('|'))
      throw Error('Original SHA-authenticated CFB SD29 PDF parent ledger invalid');
    const parts=id.split(':');
    supportedParents.set(id,{id,parentId:id,period:parts[3] as 'C'|'E'|'YE',
      se:parts[4] as '0'|'1',index:0,parentPdfSha:sha,parentPdfBytes:bytes,
      parentStart:start,parentEnd:end,parentReceived:received,dueOn:due,
      viewerSha:SD29_2025_SOURCE_RESPONSE_SHA,
      actualSenator:SD29_2025_ACTUAL_SENATOR,district:29,reg:'19229'});
  }
  if(supportedParents.size!==4)throw Error('Missing independently verified source PDF parents');
  const tokens=viewer[0]![2]!.split(',');
  return found.map(row=>{
    const id=row[1]!,parent=row[2]!;
    const m=/^19229:25:pcc:(C|E|YE):([01]):([1-9]\d*)$/.exec(id);
    if(!m||parent!==id.slice(0,id.lastIndexOf(':'))+':0'
      ||!tokens.includes(m[1]+m[2]+'.'+m[3])
      ||row[4]!==SD29_2025_ACTUAL_SENATOR||row[5]!=='29'
      ||row[6]!=='19229'||row[7]!=='2026'
      ||row[8]!==SD29_2025_SOURCE_RESPONSE_SHA
      ||row[9]!==parentExpected.get(parent))
      throw Error('Source PDF reference/real senator/verified original parent join invalid');
    const p=supportedParents.get(parent);
    if(!p)throw Error('No originally authenticated parent source PDF');
    return {...p,id,parentId:parent,period:m[1] as 'C'|'E'|'YE',
      se:m[2] as '0'|'1',index:Number(m[3])};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
export function sd29AmendmentRef(t:Sd29AmendmentTarget):CfbReportViewerReference{
  return {year:'25',filingYear:2025,type:'pcc',period:t.period,
    se:t.se,registrationNumber:t.reg,amendment:t.index,
    reportName:'Official 2025 amended principal committee report'};
}
export interface Sd29OriginalPdfFetch {
  sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string;
}
export function parseSd29AmendmentPdfHeader(t:Sd29AmendmentTarget,text:string){
  const h=text.replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,6500);
  const diagnostics={
    principalCommitteeForm:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(h),
    registrationHeader:/Registration\s+Number\s*:/i.test(h),
    senateDistrictHeader:/Senat(?:e|or)\s+District\s*:?/i.test(h),
    coveredPeriodHeader:/Period\s+Covered\s*:/i.test(h),
    receivedStamp:/Received\s+by\s+the\s+Board/i.test(h),
    firstPageNormalizedChars:h.length,
  };
  const districts=[...h.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)]
    .map(m=>Number(m[1]));
  const reg=h.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1];
  const period=h.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const receipt=h.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const start=dateUs(period?.[1]??''),end=dateUs(period?.[2]??''),
    received=dateEnglish(receipt?.[1]??'');
  const verified=diagnostics.principalCommitteeForm&&reg===t.reg
    &&districts.length>=1&&new Set(districts).size===1&&districts[0]===t.district
    &&start===t.parentStart&&end===t.parentEnd
    &&!!received&&received>=t.parentReceived&&received>=t.parentEnd;
  return {verified,regMatched:reg===t.reg,districtMatched:districts.length>=1
    &&new Set(districts).size===1&&districts[0]===t.district,
    dateRangeMatched:start===t.parentStart&&end===t.parentEnd,
    receiptNotBeforeParent:!!received&&received>=t.parentReceived,
    receivedOn:received,sourceHeaderFlags:diagnostics};
}
export function auditSd29Amendment(t:Sd29AmendmentTarget,
  pdf:Sd29OriginalPdfFetch|null,sourceError:string|null=null){
  const url=cfbReportViewerUrl(sd29AmendmentRef(t));
  const sourceOk=!!pdf&&pdf.sourceUrl===url&&DIGEST.test(pdf.sha256)
    &&Number.isInteger(pdf.bytes)&&pdf.bytes>=300&&pdf.bytes<=30_000_000
    &&Number.isFinite(Date.parse(pdf.observedAt));
  const parsed=sourceOk?parseSd29AmendmentPdfHeader(t,pdf!.text):null;
  const differs=sourceOk&&pdf!.sha256!==t.parentPdfSha;
  const success=!!parsed?.verified&&differs&&!sourceError;
  return{
    id:t.id,actualSenator:t.actualSenator,senateDistrict:t.district,
    registrationNumber:t.reg,period:t.period,specialElectionFlag:t.se,
    amendmentIndex:t.index,originalId:t.parentId,originalSha256:t.parentPdfSha,
    originalBytes:t.parentPdfBytes,originalReceivedOn:t.parentReceived,
    originalCoverageStartOn:t.parentStart,originalCoverageEndOn:t.parentEnd,
    independentOriginalDueOn:t.dueOn,officialViewerApiSha256:t.viewerSha,
    sourcePdfUrl:sourceOk?pdf!.sourceUrl:null,pdfSha256:sourceOk?pdf!.sha256:null,
    pdfBytes:sourceOk?pdf!.bytes:null,pdfRetrievedAt:sourceOk?pdf!.observedAt:null,
    firstPageIdentityAndDatesVerified:!!parsed?.verified,
    firstPageDiagnosticFlags:parsed?.sourceHeaderFlags??null,
    sourcePdfReceiptOn:parsed?.receivedOn??null,
    distinctFromOriginalParent:!!differs,sourceFailure:sourceError,
    possibleButNotProvenPublicNotBefore:success
      ?cfbElectronicReportAvailableOn(parsed!.receivedOn!,t.dueOn):null,
    actualHistoricalPublicByProven:null,legallyOwedReportCount:null,
    historicalForecastEligible:false,
    status:sourceError?'source_fetch_failed':!sourceOk?'source_pdf_provenance_unverified'
      :!parsed?.verified?'source_pdf_first_page_identity_or_dates_hold'
      :!differs?'source_pdf_equals_original_parent'
      :'source_pdf_identity_authenticated' as const,
  };
}
export const INDEPENDENTLY_OBSERVED_SD29_2025_PARENT_BINARY_ALIAS={
  amendmentVersionId:'19229:25:pcc:YE:0:1',
  parentOriginalVersionId:'19229:25:pcc:YE:0:0',
  identicalSourcePdfSha256:'115af8ec4d2fcf19323ae88cc2e858f1d1cda00c03e9ca994bf31e2070335289',
  identicalSourcePdfBytes:18020,
  originalBoardReceivedOn:'2026-02-01',
  reportPeriodStartOn:'2025-11-20',
  reportPeriodEndOn:'2025-12-31',
} as const;
/**
 * This single exception is supported by the first independently sourced
 * Oct 11 2026 GitHub artifact #11708986852 (all seven original bodies).
 * A second independent real CFB source run is required before treating
 * the reviewed alias classification as permanent source evidence.
 */
function exactlyReviewedParentAlias(r:ReturnType<typeof auditSd29Amendment>):boolean{
  const v=INDEPENDENTLY_OBSERVED_SD29_2025_PARENT_BINARY_ALIAS;
  return r.id===v.amendmentVersionId&&r.originalId===v.parentOriginalVersionId
    &&r.originalSha256===v.identicalSourcePdfSha256
    &&r.pdfSha256===v.identicalSourcePdfSha256
    &&r.pdfBytes===v.identicalSourcePdfBytes
    &&r.sourcePdfReceiptOn===v.originalBoardReceivedOn
    &&r.originalReceivedOn===v.originalBoardReceivedOn
    &&r.originalCoverageStartOn===v.reportPeriodStartOn
    &&r.originalCoverageEndOn===v.reportPeriodEndOn
    &&r.status==='source_pdf_equals_original_parent'
    &&r.firstPageIdentityAndDatesVerified&&r.sourceFailure===null
    &&r.distinctFromOriginalParent===false;
}
export function classifySd29AmendmentSequence(reports:ReturnType<typeof auditSd29Amendment>[]){
  const successes=reports.filter(r=>r.status==='source_pdf_identity_authenticated');
  const byHash=new Map<string,typeof successes>();
  for(const row of successes){
    const group=byHash.get(row.pdfSha256!)??[];
    group.push(row);byHash.set(row.pdfSha256!,group);
  }
  const aliases=successes.flatMap(r=>{
    const duplicates=byHash.get(r.pdfSha256!)!;
    const first=duplicates.slice().sort((a,b)=>a.amendmentIndex-b.amendmentIndex)[0]!;
    return duplicates.length>1&&r.id!==first.id?[{id:r.id,canonicalId:first.id,sha256:r.pdfSha256}]:[];
  });
  const uniqueAuthenticatedPdfHashes=byHash.size;
  const reviewedParentAliases=reports.filter(exactlyReviewedParentAlias);
  const sourceHolds=reports.filter(r=>r.status!=='source_pdf_identity_authenticated'
    &&!exactlyReviewedParentAlias(r)).map(r=>({id:r.id,status:r.status}));
  const complete=reports.length===7&&successes.length===7&&aliases.length===0
    &&new Set(reports.map(r=>r.id)).size===7;
  const acceptedWithExactReviewedParentAlias=reports.length===7&&successes.length===6
    &&uniqueAuthenticatedPdfHashes===6&&reviewedParentAliases.length===1
    &&aliases.length===0&&sourceHolds.length===0
    &&new Set(reports.map(r=>r.id)).size===7;
  return{
    classification:acceptedWithExactReviewedParentAlias
      ?'six_distinct_amended_pdf_binaries_one_exact_original_pdf_reference_alias'
      :complete?'seven_distinct_source_pdfs_source_changed_from_first_observation'
      :aliases.length?'unexpected_cross_amendment_binary_reference_alias'
      :'one_or_more_original_pdf_references_held_or_failed',
    sourceVersions:reports.length,sourcePdfIdentityAuthenticated:successes.length,
    verifiedOfficialReferencesIncludingExactParentAlias:successes.length+reviewedParentAliases.length,
    uniqueAuthenticatedPdfHashes,unexpectedBinaryAliases:aliases,
    documentedOriginalParentAliases:reviewedParentAliases.map(r=>({
      id:r.id,canonicalOriginalId:r.originalId,originalSha256:r.originalSha256,
      originalAndAmendedIndexPdfBytes:r.pdfBytes,boardReceivedOn:r.sourcePdfReceiptOn})),
    sourceHolds,
    strictSevenDistinctFormsVerified:complete,
    sourceAcquisitionAcceptedWithExactReviewedParentAlias:acceptedWithExactReviewedParentAlias,
    actualHistoricalPublicByProven:0,legallyOwedReportDenominator:null,
    canClaimSevenDistinctNewPdfs:false,
  };
}
