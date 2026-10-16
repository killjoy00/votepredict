/**
 * #864 finance Track A: 26 official amendment-VERSION PDF references in
 * the 2022 CFB segment for eleven people independently proven to have
 * served in the Minnesota Senate. Keep original and amended PDFs separate.
 *
 * Inputs are previous permanent 22 C/E and 20 YE original-PDF SHA ledgers,
 * their immutable source checkpoints, and the original 396-response CFB
 * candidate viewer API ledger. Do not infer statewide filing duties,
 * amendments checked on paper, or historical public release from a URL.
 */
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn} from '../../src/evidence/cfb-report-availability.js';
import {cfbReportViewerUrl} from '../../src/evidence/cfb-current-report-acquisition.js';
import type {CfbReportViewerReference} from '../../src/evidence/cfb-report-pdf-proof.js';
import {load2022PinnedOriginalViewerRows}
  from './cfb-2022-served-senators-next-original-ce.js';
import {parseCfb2022OriginalCeHeader}
  from '../../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
import {parseServedYearEnd2021to22Header}
  from './cfb-2021-22-served-senator-yearend-original-proof.js';

export const SERVED_2021_22_AMENDMENTS_VERSION=
  'cfb-2021-22-11-served-senators-26-original-amendment-version-pdf-source-v1' as const;
const sha256=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const shaOk=(s:string)=>/^[0-9a-f]{64}$/.test(s);
const validDay=(s:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T00:00:00Z');
  return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;
};
const validObserved=(s:string)=>Number.isFinite(Date.parse(s))
  &&new Date(s).toISOString()===s && s>='2026-10-10T00:00:00.000Z';
const DAY_AFTER=(d:string)=>new Date(Date.parse(d+'T00:00:00Z')+86_400_000).toISOString().slice(0,10);
export interface OriginalSenatorFinanceReport {
  id:string;registrationNumber:string;person:string;
  year:2021|2022;period:'YE'|'C'|'E';
  electionDistrict:number;printedOriginalDistrict:number;
  pdfSha256:string;receivedOn:string;coveredFrom:string;coveredThrough:string;
  dueOn:string;conservativeOriginalNotBeforeOn:string;
}
export interface SenatorAmendmentSourceTarget {
  id:string;originalId:string;original:OriginalSenatorFinanceReport;
  registrationNumber:string;actualSenator:string;year:2021|2022;
  period:'YE'|'C'|'E';amendmentIndex:number;
  originalReportsViewerBodySha256:string;
  originalCfbDistrictRosterSha256:string;
}
interface PriorProofCheckpoint {
  verifiedReportMetadata?:{ledgerWithTerminalLinefeedSha256?:string;verifiedNewOriginalReportPdfCount?:number};
  originalPdfReportLedger?:{withFinalNewlineSha256?:string;reportCount?:number};
  pinnedOriginalRegistrationApiAndDistrictSources?:Array<{
    registrationNumber:string;senateElectionDistrict:number;
    originalCfbReportsTabApiSha256:string;
    official2022CfbDistrictRosterHtmlSha256:string;
  }>;
}
function readOriginals(psv:string,kind:'CE'|'YE'){
  const rows=psv.trimEnd().split('\n');
  const expected=kind==='CE'?22:20;
  if(rows.length!==expected||!psv.endsWith('\n'))
    throw Error('Prior original official CFB report proof ledger scope changed');
  const all:OriginalSenatorFinanceReport[]=[];
  for(const row of rows){
    const parts=row.split('|');
    if(parts.length!==(kind==='CE'?11:12))
      throw Error('Prior original report ledger column count changed');
    const [id,person,elec,printed,binary]=parts;
    const segments=(id??'').split(':');
    if(segments.length!==6||!/^\d{4,8}$/.test(segments[0]??'')
      ||!['21','22'].includes(segments[1]??'')||segments[2]!=='pcc'
      ||(kind==='CE'?!['C','E'].includes(segments[3]??''):segments[3]!=='YE')
      ||segments[4]!=='0'||segments[5]!=='0'
      ||!person||!shaOk(binary??''))
      throw Error('Unrecognized original PDF identity or source SHA');
    const year=2000+Number(segments[1]) as 2021|2022;
    const period=segments[3] as 'YE'|'C'|'E';
    if(year===2021&&period!=='YE')throw Error('Unexpected old-year period');
    const coveredFrom=parts[kind==='CE'?6:7]!;
    const coveredThrough=parts[kind==='CE'?7:8]!;
    const receivedOn=parts[kind==='CE'?8:9]!;
    const dueOn=parts[kind==='CE'?9:10]!;
    const floor=parts[kind==='CE'?10:11]!;
    const expectedEnd=period==='YE'?year+'-12-31':period==='C'?'2022-07-18':'2022-10-24';
    const expectedDue=period==='YE'?(year+1)+'-01-31':period==='C'?'2022-07-25':'2022-10-31';
    if(![coveredFrom,coveredThrough,receivedOn,dueOn,floor].every(validDay)
      ||coveredFrom!==year+'-01-01'||coveredThrough!==expectedEnd
      ||dueOn!==expectedDue||receivedOn<coveredThrough
      ||floor!==cfbElectronicReportAvailableOn(receivedOn,dueOn))
      throw Error('Original authenticated report dates/availability boundary drift');
    const electionDistrict=Number(elec),originalDistrict=Number(printed);
    if(!Number.isInteger(electionDistrict)||electionDistrict<14||electionDistrict>24
      ||!Number.isInteger(originalDistrict)||originalDistrict<1||originalDistrict>67)
      throw Error('Original actual senator district provenance changed');
    all.push({id:id!,registrationNumber:segments[0]!,person,
      year,period,electionDistrict,printedOriginalDistrict:originalDistrict,
      pdfSha256:binary!,receivedOn,coveredFrom,coveredThrough,dueOn,
      conservativeOriginalNotBeforeOn:floor});
  }
  return all;
}
export function select2021to22ActualSenatorAmendmentVersions(input:{
  originalCePsv:string;originalYePsv:string;originalViewerPsv:string;
  ceCheckpoint:PriorProofCheckpoint;yeCheckpoint:PriorProofCheckpoint;
}):{targets:SenatorAmendmentSourceTarget[];
  originals:OriginalSenatorFinanceReport[];
  selectedRegistrations:number;sourceResponseViewerCount:number;
  amendmentRefsByReportPeriod:Record<string,number>} {
  if(sha256(input.originalCePsv)!==input.ceCheckpoint.verifiedReportMetadata?.ledgerWithTerminalLinefeedSha256
    ||input.ceCheckpoint.verifiedReportMetadata?.verifiedNewOriginalReportPdfCount!==22
    ||sha256(input.originalYePsv)!==input.yeCheckpoint.originalPdfReportLedger?.withFinalNewlineSha256
    ||input.yeCheckpoint.originalPdfReportLedger?.reportCount!==20)
    throw Error('Previously authenticated original PDF ledger hash or count mismatch');
  const originals=[...readOriginals(input.originalCePsv,'CE'),...readOriginals(input.originalYePsv,'YE')];
  const byOriginalId=new Map(originals.map(x=>[x.id,x]));
  if(byOriginalId.size!==42||new Set(originals.map(x=>x.pdfSha256)).size!==42)
    throw Error('Prior source-authenticated original PDF identity collision');
  const peopleByReg=new Map<string,string>();
  for(const r of originals){
    const prior=peopleByReg.get(r.registrationNumber);
    if(prior&&prior!==r.person)throw Error('Original Senate senator identity not unique');
    peopleByReg.set(r.registrationNumber,r.person);
  }
  const regs=input.ceCheckpoint.pinnedOriginalRegistrationApiAndDistrictSources;
  if(regs?.length!==11||peopleByReg.size!==11
    ||new Set(regs.map(r=>r.registrationNumber)).size!==11)
    throw Error('Prior LRL-confirmed Senate registration cohort mismatch');
  const pinnedViewer=load2022PinnedOriginalViewerRows(input.originalViewerPsv);
  if(pinnedViewer.size!==270)
    throw Error('Previously authenticated original CFB API source scope mismatch');
  const counts:Record<string,number>={};
  const targets:SenatorAmendmentSourceTarget[]=[];
  for(const reg of regs){
    if(!shaOk(reg.originalCfbReportsTabApiSha256)
      ||!shaOk(reg.official2022CfbDistrictRosterHtmlSha256)
      ||peopleByReg.get(reg.registrationNumber)===undefined)
      throw Error('Independently proven senator original CFB source invalid');
    const originalsForReg=originals.filter(p=>p.registrationNumber===reg.registrationNumber);
    if(originalsForReg.length<3||originalsForReg.length>4
      ||originalsForReg.some(o=>o.electionDistrict!==reg.senateElectionDistrict))
      throw Error('Originals do not match official CFB district-to-senator register');
    const originalApi=pinnedViewer.get(reg.registrationNumber);
    if(!originalApi||originalApi.apiSha!==reg.originalCfbReportsTabApiSha256)
      throw Error('Pinned original CFB candidate reports-data API body mismatch');
    const amendKeys=[...originalApi.keys]
      .filter(key=>/^(21|22):pcc:(C|E|YE):0:[1-9]\d*$/.test(key)).sort();
    for(const key of amendKeys){
      const parts=key.split(':');
      const id=reg.registrationNumber+':'+key;
      const parentId=reg.registrationNumber+':'+parts.slice(0,4).join(':')+':0';
      const parent=byOriginalId.get(parentId);
      if(!parent)throw Error('CFB amendment has no independently authenticated original PDF');
      if(Number(parts[0])+2000!==parent.year||parts[2]!==parent.period)
        throw Error('CFB amendment reference does not agree with parent identity');
      const amendmentIndex=Number(parts[4]);
      if(!Number.isSafeInteger(amendmentIndex)||amendmentIndex>10)
        throw Error('Unexpected original CFB viewer amendment revision index');
      targets.push({id,originalId:parentId,original:parent,
        actualSenator:parent.person,registrationNumber:parent.registrationNumber,
        year:parent.year,period:parent.period,amendmentIndex,
        originalReportsViewerBodySha256:originalApi.apiSha,
        originalCfbDistrictRosterSha256:reg.official2022CfbDistrictRosterHtmlSha256});
      counts[parts[0]+':'+parts[2]]=(counts[parts[0]+':'+parts[2]]??0)+1;
    }
  }
  // Every revision within a parent chain must have a preceding revision.
  const byParent=new Map<string,number[]>();
  for(const t of targets){
    const xs=byParent.get(t.originalId)??[];
    xs.push(t.amendmentIndex);
    byParent.set(t.originalId,xs);
  }
  for(const xs of byParent.values()){
    xs.sort((a,b)=>a-b);
    if(xs.some((index,i)=>index!==i+1))
      throw Error('Original CFB reports-data amendment revision chain skipped an index');
  }
  if(targets.length!==26||new Set(targets.map(t=>t.id)).size!==26
    ||counts['21:YE']!==10||counts['22:YE']!==12
    ||counts['22:C']!==2||counts['22:E']!==2)
    throw Error('Original 26 official 2021-22 CFB amendment references have changed');
  return {targets:targets.sort((a,b)=>a.original.electionDistrict-b.original.electionDistrict
      ||a.year-b.year||a.period.localeCompare(b.period)||a.amendmentIndex-b.amendmentIndex),
    originals,selectedRegistrations:regs.length,sourceResponseViewerCount:pinnedViewer.size,
    amendmentRefsByReportPeriod:counts};
}
export interface CfbHistoricalAmendedPdfSource {
  sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string;
}
export function amendmentViewerReference(target:SenatorAmendmentSourceTarget):CfbReportViewerReference{
  return {filingYear:target.year,reportName:'historical amendment version',
    year:String(target.year).slice(2),type:'pcc',period:target.period,
    se:'0',registrationNumber:target.registrationNumber,
    amendment:target.amendmentIndex};
}
function uniquePrintedSenateDistrict(text:string):number|null{
  const normalized=text.replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,6500);
  const districts=[...normalized.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)]
    .map(m=>Number(m[1]));
  const uniq=[...new Set(districts)];
  return uniq.length===1?uniq[0]!:null;
}
export function auditActualSenatorAmendmentPdf(
  target:SenatorAmendmentSourceTarget,
  pdf:CfbHistoricalAmendedPdfSource|null,
  errorKind:string|null=null,
){
  const url=cfbReportViewerUrl(amendmentViewerReference(target));
  const pdfFound=!!pdf&&pdf.sourceUrl===url
    &&shaOk(pdf.sha256)&&Number.isInteger(pdf.bytes)&&pdf.bytes>=300
    &&pdf.bytes<=30_000_000&&validObserved(pdf.observedAt);
  // Source-only structured diagnostics: numeric district labels and positions,
  // never source report prose, donation text, names or addresses. Crucial when
  // an old PDF layout does not match the 2022 first-page report template.
  const normalizedForDiagnosis=pdfFound
    ?pdf!.text.replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,6500):'';
  const districtDiagnostic={
    originalSourceTextChars:pdfFound?pdf!.text.length:0,
    officialFirstPageWindowChars:normalizedForDiagnosis.length,
    officeWordPositions:[...normalizedForDiagnosis.matchAll(/\bSenat(?:e|or)\b/gi)]
      .slice(0,10).map(m=>m.index),
    exactSenateDistrictLabels:[...normalizedForDiagnosis.matchAll(
      /Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)].slice(0,15)
      .map(m=>({district:Number(m[1]),offset:m.index})),
    otherDistrictLabelNumbers:[...normalizedForDiagnosis.matchAll(
      /\b(?:District|Dist\.?)\s*(?:No\.?\s*)?(?:#\s*)?(\d{1,2})\b/gi)]
      .slice(0,15).map(m=>({district:Number(m[1]),offset:m.index})),
    principalCampaignReportTitlePresent:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(normalizedForDiagnosis),
    registrationLabelPresent:/Registration\s+Number\s*:/i.test(normalizedForDiagnosis),
    coveredPeriodLabelPresent:/Period\s+Covered\s*:/i.test(normalizedForDiagnosis),
    boardReceiptStampPresent:/Received\s+by\s+the\s+Board/i.test(normalizedForDiagnosis),
  };
  const district=pdfFound?uniquePrintedSenateDistrict(pdf!.text):null;
  const supportedDistrict=district!==null&&(district===target.original.printedOriginalDistrict
    ||district===target.original.electionDistrict);
  const original=target.original;
  const ce=pdfFound&&supportedDistrict&&original.period!=='YE'
    ?parseCfb2022OriginalCeHeader({
      id:target.id,reg:target.registrationNumber,district:district!,
      period:original.period,dueOn:original.dueOn,
      expectedPeriodEndOn:original.coveredThrough,
      viewerSha:target.originalReportsViewerBodySha256,
      districtPageSha:target.originalCfbDistrictRosterSha256},pdf!.text)
    :null;
  const ye=pdfFound&&supportedDistrict&&original.period==='YE'
    ?parseServedYearEnd2021to22Header({
      reportId:target.id,reg:target.registrationNumber,
      year:target.year,person:target.actualSenator,
      electionDistrict:original.electionDistrict,
      originalOfficial2021or2022SenateDistricts:[original.printedOriginalDistrict],
      viewerSha:target.originalReportsViewerBodySha256,
      rosterHtmlSha:target.originalCfbDistrictRosterSha256,
      officialSenateServiceOriginalSha:'not-reused-here',
      dueOn:original.dueOn,periodStartOn:original.coveredFrom,
      periodEndOn:original.coveredThrough},pdf!.text)
    :null;
  const receipt=ce?.receivedOn??ye?.boardReceivedOn??null;
  const coverageStart=ce?.periodStartOn??ye?.reportStartOn??null;
  const coverageEnd=ce?.periodEndOn??ye?.reportEndOn??null;
  const periodAndIdentityProved=!!receipt&&coverageStart===original.coveredFrom
    &&coverageEnd===original.coveredThrough;
  const afterOriginal=!!receipt&&receipt>=original.receivedOn;
  const distinctFromOriginal=pdfFound&&pdf!.sha256!==original.pdfSha256;
  const verified=pdfFound&&supportedDistrict&&periodAndIdentityProved
    &&afterOriginal&&distinctFromOriginal&&!errorKind;
  return {
    id:target.id,actualSenator:target.actualSenator,registrationNumber:target.registrationNumber,
    reportYear:target.year,period:target.period,amendmentViewerIndex:target.amendmentIndex,
    officialViewerReferenceIndicatesAmendment:true,
    paperFormAmendedCheckboxIndependentlyVerified:null,
    originalReportId:target.originalId,originalReportSha256:original.pdfSha256,
    originalReportBoardReceivedOn:original.receivedOn,
    originalReportCoverageStartOn:original.coveredFrom,
    originalReportCoverageEndOn:original.coveredThrough,
    originalReportLegallyPossibleNotBeforeOn:original.conservativeOriginalNotBeforeOn,
    electionDistrict2022:original.electionDistrict,
    originalReportPrintedSenateDistrict:original.printedOriginalDistrict,
    amendedPdfPrintedSenateDistrict:supportedDistrict?district:null,
    structuralDistrictDiagnostics:districtDiagnostic,
    originalViewerApiSha256:target.originalReportsViewerBodySha256,
    originalCfbRosterSha256:target.originalCfbDistrictRosterSha256,
    amendedPdfSourceUrl:pdfFound?pdf!.sourceUrl:null,
    amendedPdfSha256:pdfFound?pdf!.sha256:null,
    amendedPdfByteLength:pdfFound?pdf!.bytes:null,
    amendedPdfAcquiredAt:pdfFound?pdf!.observedAt:null,
    amendmentFirstPageIdentityOfficeDatesVerified:periodAndIdentityProved,
    amendedBoardReceivedOn:receipt,
    amendedCoverageStartOn:coverageStart,
    amendedCoverageEndOn:coverageEnd,
    amendedBoardReceivedNotBeforeOriginal:afterOriginal,
    amendedBinaryDistinctFromOriginal:distinctFromOriginal,
    originalReportStatutoryDueOn:original.dueOn,
    // This bound is NOT proof the amended version was actually public then.
    conservativeAmendedVersionNotBeforeOn:verified
      ?cfbElectronicReportAvailableOn(receipt!,original.dueOn):null,
    actualHistoricalPublicByIndependentlyEstablished:null,
    historicalForecastEligible:false,
    legallyRequiredFilingDenominator:null,
    sourceErrorKind:errorKind,
    status:errorKind?'source_http_or_pdf_failure'
      :!pdfFound?'source_pdf_missing_or_invalid'
      :!supportedDistrict?'amended_pdf_printed_district_unmatched'
      :!periodAndIdentityProved?'amended_pdf_first_page_identity_or_period_mismatch'
      :!afterOriginal?'amendment_board_receipt_precedes_original'
      :!distinctFromOriginal?'amendment_pdf_identical_to_original'
      :'amendment_pdf_and_original_identity_authenticated',
  };
}
export function checkAuthenticatedAmendmentChains(
  audits:ReadonlyArray<ReturnType<typeof auditActualSenatorAmendmentPdf>>,
):{valid:boolean;violations:{id:string;reason:string}[]}{
  const violations:{id:string;reason:string}[]=[];
  const byParent=new Map<string,typeof audits[number][]>();
  for(const a of audits){
    if(a.status!=='amendment_pdf_and_original_identity_authenticated'
      ||!a.amendedPdfSha256||!a.amendedBoardReceivedOn){
      violations.push({id:a.id,reason:'source_identity_or_pdf_not_authenticated'});
      continue;
    }
    const xs=byParent.get(a.originalReportId)??[];
    xs.push(a);byParent.set(a.originalReportId,xs);
  }
  for(const group of byParent.values()){
    group.sort((a,b)=>a.amendmentViewerIndex-b.amendmentViewerIndex);
    for(let i=0;i<group.length;i++){
      const current=group[i]!;
      const preceding=group.slice(0,i);
      if(current.amendmentViewerIndex!==i+1)
        violations.push({id:current.id,reason:'nonconsecutive_amendment_index'});
      if(preceding.some(p=>p.amendedPdfSha256===current.amendedPdfSha256))
        violations.push({id:current.id,reason:'amendment_binary_duplicate_of_earlier_revision'});
      if(i>0&&current.amendedBoardReceivedOn!<group[i-1]!.amendedBoardReceivedOn!)
        violations.push({id:current.id,reason:'amendment_revision_receipt_out_of_order'});
    }
  }
  return {valid:violations.length===0,violations};
}


/**
 * Official 2021 Aric Putnam YE amendment version #1:
 * both independent CFB source runs returned the SAME distinct 128,524-byte PDF
 * SHA, but extracted text contains none of the ordinary report title, Senate
 * district, registration, period or Board-receipt first-page labels.
 *
 * That document is a *retrieved source PDF only*, never authenticated as a
 * normal amended finance report. We can permanently capture 25 proven
 * amendments plus this explicit HOLD without converting the hold into proof.
 */
export const REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD={
  id:'18430:21:pcc:YE:0:1',
  binarySha256:'7529ad0bf417548f1617d2bb2b74e5115855844df4a979fdbb6ad3e5e6420acf',
  bytes:128524,priorSuccessfulSourceRuns:2,
} as const;
export function classifySourceVerified2021to22AmendmentBatch(
  audits:ReadonlyArray<ReturnType<typeof auditActualSenatorAmendmentPdf>>,
){
  const chain=checkAuthenticatedAmendmentChains(audits);
  const identityUnique=audits.length===26 && new Set(audits.map(a=>a.id)).size===26;
  const authenticated=audits.filter(a=>a.status==='amendment_pdf_and_original_identity_authenticated');
  if(identityUnique&&authenticated.length===26&&chain.valid)
    return {status:'all_26_amendment_pdfs_authenticated' as const,
      sourceAcquisitionCanBePreserved:true,authenticated:26,
      documentedSourceHolds:0,chainValid:true};
  const holds=audits.filter(a=>a.status!=='amendment_pdf_and_original_identity_authenticated');
  const h=holds[0],diag=h?.structuralDistrictDiagnostics;
  const exactOneIndependentlyReviewedHold=identityUnique&&authenticated.length===25
    &&holds.length===1&&h?.id===REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD.id
    &&h.status==='amended_pdf_printed_district_unmatched'
    &&h.amendedPdfSha256===REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD.binarySha256
    &&h.amendedPdfByteLength===REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD.bytes
    &&h.sourceErrorKind===null&&h.amendedPdfPrintedSenateDistrict===null
    &&h.amendmentFirstPageIdentityOfficeDatesVerified===false
    &&h.amendedBoardReceivedOn===null
    &&h.conservativeAmendedVersionNotBeforeOn===null
    &&diag?.originalSourceTextChars===1836
    &&diag.principalCampaignReportTitlePresent===false
    &&diag.registrationLabelPresent===false
    &&diag.coveredPeriodLabelPresent===false
    &&diag.boardReceiptStampPresent===false
    &&diag.exactSenateDistrictLabels.length===0
    &&diag.otherDistrictLabelNumbers.length===0
    &&diag.officeWordPositions.length===0
    &&!chain.valid
    &&chain.violations.map(v=>v.id+':'+v.reason).sort().join('|')===[
      '18430:21:pcc:YE:0:1:source_identity_or_pdf_not_authenticated',
      '18430:21:pcc:YE:0:2:nonconsecutive_amendment_index',
    ].sort().join('|');
  return {
    status:exactOneIndependentlyReviewedHold
      ?'25_authenticated_1_official_source_document_hold' as const
      :'amendment_source_incomplete_or_identity_unverified' as const,
    sourceAcquisitionCanBePreserved:!!exactOneIndependentlyReviewedHold,
    authenticated:authenticated.length,documentedSourceHolds:holds.length,
    chainValid:chain.valid,
  };
}
