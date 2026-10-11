/**
 * #864 finance: an original signed 2023 Minnesota Campaign Finance Board
 * conciliation action explicitly identifying one authenticated serving
 * senator's principal campaign committee. An enforcement source is NOT
 * a registration application, final termination action, a 2023 CFB YE
 * report filing-duty certificate, or an original PDF historical public-by.
 */
import {select22AuthenticSenatorRegistrationTargets} from
 './cfb-2023-24-official-committee-status-proof.js';
export const HOFFMAN_2023_ORIGINAL_BOARD_AGREEMENT=
 'https://cfb.mn.gov/pdf/bdactions/1641_Conciliation_Agreement.pdf' as const;
export function inspectHoffman2023OriginalBoardAction(input:{
 original2023BoardPdfText:string;
 existingAuthenticated71VersionPSV:string;
}){
 const s=select22AuthenticSenatorRegistrationTargets(input.existingAuthenticated71VersionPSV);
 const real=s.find(x=>x.registrationNumber==='17319');
 if(!real||real.senator!=='John A. Hoffman'||real.district2022!==34)
  throw Error('Original already authenticated senator Hoffman #17319 identity absent');
 const t=input.original2023BoardPdfText.replace(/\u0000/g,'')
  .replace(/[‐‑–—]/g,'-').replace(/[’‘]/g,"'")
  .replace(/\s+/g,' ').trim();
 const proof=[
  /STATE OF MINNESOTA\s+CAMPAIGN FINANCE AND PUBLIC DISCLOSURE BOARD\s+CONCILIATION AGREEMENT/i,
  /In the matter of the Committee to Elect John Hoffman\s*\(17319\)/i,
  /The Committee to Elect John Hoffman is the principal campaign committee of Senator John Hoffman/i,
  /committee's 2021 and 2022 amended year-end reports of receipts and expenditures/i,
  /transition to using the Board's Campaign Finance Reporter Online application starting with the 2023 reporting year/i,
 ];
 if(proof.some(p=>!p.test(t)))
  throw Error('Original signed 2023 CFB document did not independently prove Hoffman committee identity and exact context');
 const dates=[...t.matchAll(/\bDated:\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(2023)\b/gi)]
  .map(m=>m[1]+' '+m[2]+', '+m[3]);
 if(!dates.length)throw Error('Original CFB action lacks an independently readable 2023 original signed date');
 return{
  stateAgencyOriginal:true,
  originalOfficialBoardDocumentType:'conciliation_agreement',
  principalCampaignCommitteeRegistration:'17319',
  originalDocumentIdentifiedSenator:'Senator John Hoffman',
  authenticServingSenator:'John A. Hoffman',
  authenticSenateDistrict2022:34,
  originalSignatureDatesAsPrinted:dates,
  independentSourceNamedPrincipalCommitteeInSigned2023Action:true,
  BoardDiscussedAmended2021and2022AnnualReports:true,
  BoardDocumentDescribes2023FutureReporterOnlineCommitment:true,
  actualFirstRegistrationDate:null,
  committeeRegistrationStatusOnSpecific2023Or2024Date:null,
  originalBoardVoluntaryOrAdministrativeTermination:null,
  legal2023YearEndFilingObligation:null,
  legal2024YearEndFilingObligation:null,
  newlyProvenExact2023Or2024YEVersionHistoricalPublicBy:null,
  exact2021or2022CFBReportAmendmentMappingFromBoardWords:null,
 };
}