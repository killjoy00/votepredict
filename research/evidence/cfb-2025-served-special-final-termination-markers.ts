/**
 * Issue #864 / Finance: investigate the TERMINATION DESIGNATION on two
 * ALREADY original-PDF-authenticated 2025 special-cycle-final filings,
 * exclusively for people independently documented to have served Senate.
 *
 * Important distinction: finding the WORDS "termination report" on a blank
 * form cannot prove the TERMINATION BOX was selected. We only output
 * severely constrained lexical diagnostics; selected-box / effective Board
 * termination status remains NULL absent independently legible document
 * selection or original Board termination notice.
 */
import {createHash} from 'node:crypto';
import {cfbReportViewerUrl} from '../../src/evidence/cfb-current-report-acquisition.js';
import {cfbServed2025FinalReference,parseServed2025SpecialFinalHeader,
  type Served2025SpecialFinalTarget} from './cfb-2025-served-special-final-pdf-proof.js';

export const CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA=
  'cfb-2025-two-served-senators-original-special-final-termination-marker-probe-v1' as const;
const EXPECTED=[
  {reg:'19229',district:29,senator:'Michael Holmstrom Jr',
    reportSha:'0cecaf71ada09c3cb7d12dd439438dc432c7998159250b7c62e85bfdb0e383b2',
    bytes:35024,receivedOn:'2025-11-26'},
  {reg:'19233',district:47,senator:'Amanda Hemmingsen-Jaeger',
    reportSha:'e96a87e4bd9d0583382ae2345fd597e7c8d6db7f919c91797516c975b1ca4ab1',
    bytes:38474,receivedOn:'2025-11-20'},
] as const;
const SHA=/^[0-9a-f]{64}$/;
const KNOWN_TERMS=/\b(?:termination|terminate|terminated|terminating|report|final|type|special|election|cycle|committee|check|checked|selected|mark|yes|no|not|is|a|an|this|filed|filing|ordinary|amended|amendment|original|form)\b/gi;
function timestamp(s:string):boolean{
  const d=new Date(s);
  return /^2026-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ$/.test(s)
    &&Number.isFinite(d.getTime())&&d.toISOString()===s
    &&d.getTime()<=Date.now()+60000;
}
export type OriginalServedFinalForMarkers={
  sourceUrl:string;sha256:string;bytes:number;fetchedAt:string;text:string;
};
export function probeServedSenatorSpecialFinalTerminationMarkers(
  target:Served2025SpecialFinalTarget,
  pdf:OriginalServedFinalForMarkers,
){
  const spec=EXPECTED.find(s=>s.reg===target.registrationNumber);
  if(!spec||target.district!==spec.district||target.officialName!==spec.senator
    ||target.reportId!==spec.reg+':25:pcc:YE:1:0'
    ||!/^https:\/\/www\.lrl\.mn\.gov\//.test(target.originalServiceSourceUrl)
    ||!SHA.test(target.viewerSha256)||!SHA.test(target.rosterHtmlSha256)
    ||pdf.sourceUrl!==cfbReportViewerUrl(cfbServed2025FinalReference(target))
    ||pdf.sha256!==spec.reportSha||pdf.bytes!==spec.bytes||!timestamp(pdf.fetchedAt)){
    throw Error('Original Senate member / CFB report / source PDF identity not pinned');
  }
  const header=parseServed2025SpecialFinalHeader(target,pdf.text);
  if(!header||header.coverageStartOn!=='2025-07-29'
    ||header.coverageEndOn!=='2025-11-19'
    ||header.boardReceivedOn!==spec.receivedOn)
    throw Error('Previously verified original report first-page identity/coverage/receipt changed');
  if(pdf.text.length<100||pdf.text.length>1000000)throw Error('PDF extraction outside bounds');

  // No first-page text, contact, address, donor names, numbers/amounts or
  // entire originals are copied into output. Allow ONLY a tiny controlled
  // vocabulary near each marker, plus its exact position in extracted text.
  const matches=[...pdf.text.matchAll(/\b(?:termination|terminate|terminated|terminating)\b/gi)];
  const diagnosticMarkers=matches.slice(0,12).map(m=>{
    const index=m.index??-1;
    const context=pdf.text.slice(Math.max(0,index-65),Math.min(pdf.text.length,index+100));
    const keywords=[...context.matchAll(KNOWN_TERMS)].map(x=>x[0]!.toLowerCase()).slice(0,25);
    return {textOffset:index,lexeme:m[0]!.toLowerCase(),
      whitelistedSurroundingKeywords:keywords};
  });
  const head=pdf.text.replace(/\u0000/g,' ').replace(/\s+/g,' ').slice(0,6500);
  const unambiguousTextualReportType=
    /(?:report\s+type|type\s+of\s+report)\s*:\s*termination\s+report\b/i.test(head);
  const bareLabelPresent=/\btermination\s+report\b/i.test(head);
  const uncheckedLabelDoesNotProveSelected=true;
  return {
    reportId:target.reportId,actualSenator:target.officialName,
    district:target.district,registrationNumber:target.registrationNumber,
    originalPdfUrl:pdf.sourceUrl,originalPdfSha256:pdf.sha256,
    originalPdfBytes:pdf.bytes,independentlyRetrievedAt:pdf.fetchedAt,
    originalPdfExtractedTextSha256:createHash('sha256').update(pdf.text).digest('hex'),
    originalViewerApiSha256:target.viewerSha256,
    originalSenateServiceDocumentUrl:target.originalServiceSourceUrl,
    coverageStartOn:header.coverageStartOn,coverageEndOn:header.coverageEndOn,
    originalCfbBoardReceivedOn:header.boardReceivedOn,
    totalTerminationWordOccurrences:matches.length,
    terminationWordDiagnostics:diagnosticMarkers,
    terminationWordOccurrencesBeyondLimitedDiagnostics:Math.max(0,matches.length-diagnosticMarkers.length),
    bareTerminationReportLabelPresentInFirst6500Characters:bareLabelPresent,
    explicitlyTextLabeledTerminationTypeInFirst6500Characters:unambiguousTextualReportType,
    textualLabelDoesNotProveGraphicalSelection:uncheckedLabelDoesNotProveSelected,
    originalTerminationCheckboxSelectionIndependentlyProven:null,
    originalBoardTerminationNoticeIndependentlyProven:null,
    registeredCommitteeTerminatedEffectiveOn:null,
    yearEnd2025WasLegallyOwed:null,
    independentHistoricalPublicByOn:null,
    admissibleToHistoricalForecast:false,
    originalPdfOrRawExtractedTextRetained:false,
    diagnosticIsFormWordingNotLegalConclusion:true,
  };
}
