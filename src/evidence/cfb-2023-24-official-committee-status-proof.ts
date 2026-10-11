/**
 * Finance issue #864. Original Board named-committee evidence, with strict
 * separation between (1) a contemporaneous signed 2024 Board action and
 * (2) the CURRENT 2026 candidate viewer status. Neither proves actual
 * Board termination dates or legally owed historical annual reports.
 */
import {createHash} from 'node:crypto';
export const CFB_22_REGISTRATION_SOURCE_VERSION=
 'cfb-2023-24-22-real-senators-committee-current-vs-2024-signed-board-case-v1' as const;
export const CFB_PUTNAM_ORIGINAL_2024_CONCILIATION=
 'https://cfb.mn.gov/pdf/bdactions/1674_Conciliation_Agreement.pdf' as const;
export const CFB_SOURCE_71_GIT_BLOB_SHA=
 'bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388' as const;
const shaBlob=(str:string)=>createHash('sha1')
 .update('blob '+Buffer.byteLength(str,'utf8')+'\0').update(str,'utf8').digest('hex');
export interface ActualSenatorCfbCommittee{
 registrationNumber:string;senator:string;district2022:number;
}
export function select22AuthenticSenatorRegistrationTargets(source71Psv:string):ActualSenatorCfbCommittee[]{
 if(shaBlob(source71Psv)!==CFB_SOURCE_71_GIT_BLOB_SHA)
  throw Error('Original 71 authentic YE viewer references and 22 real senators source changed');
 const rows=source71Psv.trimEnd().split('\n').map(r=>r.split('|'));
 if(rows.length!==71||rows.some(r=>r.length!==21))throw Error('Original 71 exact CFB version rows not proven');
 const people=new Map<string,ActualSenatorCfbCommittee>();
 for(const r of rows){
  const [id,person,district,reg]=r;
  if(!id?.startsWith(reg+':')||!person||!/^\d+$/.test(reg??'')
    ||!/^\d+$/.test(district??''))throw Error('Source CFB senator identity invalid');
  const entry={registrationNumber:reg!,senator:person,district2022:Number(district)};
  const old=people.get(reg!);
  if(old&&(old.senator!==entry.senator||old.district2022!==entry.district2022))
   throw Error('Original CFB committee registration person/district contradicts source');
  people.set(reg!,entry);
 }
 const result=[...people.values()].sort((a,b)=>a.district2022-b.district2022);
 if(result.length!==22||new Set(result.map(x=>x.district2022)).size!==22)
  throw Error('Source provenance does not prove 22 distinct actual real senators');
 return result;
}
function textFromOriginalPdf(extractedText:string):string{
 return extractedText.replace(/\u0000/g,'').replace(/[‐‑–—]/g,'-')
  .replace(/\u2019/g,"'").replace(/\s+/g,' ').trim();
}
/**
 * This paragraph is an original Board signed September 2024 contemporary
 * named registered principal committee, not simply a generic rule.
 * Critically a Board statement that a report was "second amended" cannot
 * mint a new 2026 CFB report viewer version or prove its exact public-by.
 */
export function inspectPutnam2024OfficialBoardConciliation(input:{
  source71Psv:string;originalBoardPdfExtractedText:string;
}){
 const real=select22AuthenticSenatorRegistrationTargets(input.source71Psv);
 const target=real.find(x=>x.registrationNumber==='18430');
 if(!target||target.senator!=='Aric Putnam'||target.district2022!==14)
  throw Error('CFB 18430 Putnam actual 2022-serving senator prior identity unverified');
 const full=textFromOriginalPdf(input.originalBoardPdfExtractedText);
 const tests={
  actualBoardConciliationSource:/STATE OF MINNESOTA\s+CAMPAIGN FINANCE AND PUBLIC DISCLOSURE BOARD\s+CONCILIATION AGREEMENT/i.test(full),
  exactlyNamedRegistration:/In the matter of the Aric\s*\(Putnam\) for MN committee\s*\(18430\)/i.test(full),
  sameNamedSenatePrincipalCommittee:/Aric\s*\(Putnam\) for MN is the principal campaign committee of Senator Aric Putnam/i.test(full),
  sourceSaysRegistrationYear2019:/The committee registered with the Board in 2019/i.test(full),
  originalSourceMentionsSecondAmended2023YE:/committee's second amended 2023 year-end report/i.test(full),
  originalSourceMentionsFirstOriginal2023YE:/committee's original 2023 year-end report/i.test(full),
  boardNamedReportAmendmentInSpring2024:/committee then filed an amended report as instructed by Board staff/i.test(full),
  contemporarySenatorSignature:/Dated:\s*September 20,\s*2024\s+Senator Aric Putnam/i.test(full),
  contemporaryBoardChairSignature:/Dated:\s*September 4,\s*2024\s+David Asp/i.test(full),
 };
 if(Object.values(tests).some(x=>!x))
  throw Error('Original signed Board document did not confirm every historical committee-specific primary fact');
 const versions=input.source71Psv.trimEnd().split('\n').filter(s=>
  s.startsWith('18430:23:pcc:YE:0:')).map(s=>s.split('|')[0]!);
 if(versions.length!==2||!versions.includes('18430:23:pcc:YE:0:0')
   ||!versions.includes('18430:23:pcc:YE:0:1'))
  throw Error('Historical 2023 official source viewer amendment scope unexpectedly changed');
 return{
  committeeRegistration:'18430',senator:'Aric Putnam',senateDistrict2022:14,
  officialBoardSigningDate:'2024-09-20',officialBoardChairSigningDate:'2024-09-04',
  boardSpecificCommitteeNamedIn2024Case:true,
  originalBoardStatesRegistrationYear:2019,
  originalBoardDescribesSecondAmended2023YE:true,
  modernCfbViewer2023YearEndExactVersionRefs:versions,
  modernViewer2023AmendmentRefsCount:1,
  secondAmendedReferenceNotCrossIdentifiedWithModernViewer:true,
  newHistorical2023PdfVersionAuthenticated:false,
  actualPublicByForAny2023PdfVersionProven:false,
  2023Or2024YearEndLegallyOwed:null,
  actualCommitteeRegistrationTerminationOnDate:null,
 };
}
export interface CfbCurrentCandidatePageProbe{
 registrationNumber:string;officeIsSenateFromHeading:boolean;
 exactRegistrationInHeading:boolean;dateOfFetch:string;
 latestVisibleStatus:'terminated_as_of_current_viewer'|'not_labelled_terminated'|'unverified';
 currentPageProvesRegistrationIn2023Or2024:false;
 original2023Or2024BoardTerminationDate:null;
 legalRequiredYearEndReportingCount:null;
 exact2023Or2024PdfPublicBy:null;
}
/**
 * Do NOT describe a current status as 2023/24 committee status.
 * Only trust a heading containing the target committee number.
 * Don't treat absence of the word "Terminated" as affirmative 'Active'.
 */
export function inspectCurrentOfficialCfbCandidateHeading(input:{
  registrationNumber:string;html:string;observedAt:string;
}):CfbCurrentCandidatePageProbe{
 if(!/^\d{4,6}$/.test(input.registrationNumber))throw Error('CFB principal committee ID invalid');
 if(!/^\d{4}-\d{2}-\d{2}T/.test(input.observedAt))throw Error('Source observation time invalid');
 const sanitized=input.html.replace(/&nbsp;|&#160;/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 const reg=new RegExp('(?:^|\\s|-)'+input.registrationNumber+'(?:\\s|\\(|\\)|$)');
 const exactRegistrationInHeading=reg.test(sanitized);
 const nearby=exactRegistrationInHeading?sanitized.slice(Math.max(0,
   sanitized.search(reg)-160),Math.min(sanitized.length,sanitized.search(reg)+180)):'';
 const officeIsSenateFromHeading=/\bSenate Committee\b/i.test(nearby);
 const status=exactRegistrationInHeading&&officeIsSenateFromHeading
   ?/\(\s*Terminated\s*\)/i.test(nearby)
      ?'terminated_as_of_current_viewer'
      :'not_labelled_terminated'
   :'unverified';
 return{
  registrationNumber:input.registrationNumber,officeIsSenateFromHeading,
  exactRegistrationInHeading,dateOfFetch:input.observedAt,
  latestVisibleStatus:status,
  currentPageProvesRegistrationIn2023Or2024:false,
  original2023Or2024BoardTerminationDate:null,
  legalRequiredYearEndReportingCount:null,exact2023Or2024PdfPublicBy:null,
 };
}
