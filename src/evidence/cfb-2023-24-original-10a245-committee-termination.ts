/**
 * Issue #864 original public-source Minnesota finance law: independent
 * original 2023 and 2024 §10A.245 administrative termination. This statute
 * is NOT a substitute for an actual documented CFB committee termination
 * and absolutely does NOT license historical report/public-by inference.
 */
export const ORIGINAL_2023_24_CFB_ADMIN_TERMINATION_VERSION=
 'original-mn-2023-24-10a245-six-year-administrative-termination-conditional-v1' as const;
export const ORIGINAL_REVISOR_TERMINATION_2023=
 'https://www.revisor.mn.gov/statutes/2023/cite/10A.245' as const;
export const ORIGINAL_REVISOR_TERMINATION_2024=
 'https://www.revisor.mn.gov/statutes/2024/cite/10A.245' as const;
export type OfficialOriginalTerminationLegalYear=2023|2024;

function originalTermLegalSource(year:OfficialOriginalTerminationLegalYear){
 if(year===2023)return ORIGINAL_REVISOR_TERMINATION_2023;
 if(year===2024)return ORIGINAL_REVISOR_TERMINATION_2024;
 throw Error('Only original 2023 or 2024 §10A.245 laws allowed');
}
export function auditOriginalSection10A245Source(input:{
 lawYear:OfficialOriginalTerminationLegalYear;
 originalRevisorHtml:string;
}){
 const url=originalTermLegalSource(input.lawYear);
 if(!input.originalRevisorHtml.includes('<html'))
  throw Error('Original source is not Revisor HTML');
 const text=input.originalRevisorHtml.replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;|&#160;|&thinsp;/gi,' ')
  .replace(/&amp;/g,'&')
  .replace(/\s+/g,' ').trim();
 const title=/10A\.245 ADMINISTRATIVE TERMINATION OF INACTIVE COMMITTEES AND FUNDS/i.test(text);
 const explicitPrincipalCommittee=/a principal campaign committee becomes inactive on the later of the following dates/i.test(text);
 const electionCriterion=/six years after the last election in which the individual for whom the committee exists was a candidate/i.test(text);
 const serviceCriterion=/six years after the last day on which the individual for whom the committee exists served in an elective office/i.test(text);
 const boardDiscretion=/the board may terminate the registration of a principal campaign committee/i.test(text);
 const certification=/60 days after sending written notice of inactivity by certified mail/i.test(text);
 if(!title||!explicitPrincipalCommittee||!electionCriterion||!serviceCriterion
  ||!boardDiscretion||!certification)
   throw Error('Original Revisor historical six-year/60-day source statute not authenticated');
 return{
  sourceUrl:url,originalLawYear:input.lawYear,
  principalCommitteeInactiveOnlyAtLaterOfSixYearsAfterLastCandidacyOrService:true,
  administrativeTerminationByBoardPermissiveNotAutomatic:true,
  administrativeTerminationOnlyAfter60DayWrittenCertifiedMailNotice:true,
  merelyLosingElectionCannotEstablishRegulatorCommitteeTermination:true,
  requiresIndependentCommitteeLastElectionAndServiceDates:true,
  requiresIndependentBoardCertifiedNoticeAndActualTerminationRecord:true,
  candidateSpecificCommitteeTerminationEstablished:null,
  candidateSpecificLegallyOwedReportEstablished:null,
  anyVersionHistoricallyPublicByEstablished:false,
 };
}
/**
 * A six-year inactivity eligibility computation alone MUST NOT become an
 * actual termination proof. Each proof requires original candidate/committee
 * identity, precise notice and an actual regulator termination action.
 * A final voluntary §10A.243 termination report is a separate path.
 */
export function classifyPrincipalCommitteeTerminatedOnHistoricalDate(input:{
  specificCommitteeIdentityIndependentlyAuthenticated:boolean;
  originalCfBSpecificTerminationDate:string|null;
  originalRegulatorTerminationActionProved:boolean;
  originalSourceUrl:string|null;
}):{independentDocumentedTermination:boolean|null;filingDutyIn2023Or2024:null}{
 if(input.originalCfBSpecificTerminationDate!==null){
  const x=input.originalCfBSpecificTerminationDate;
  const d=new Date(x+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||Number.isNaN(d.valueOf())
    ||d.toISOString().slice(0,10)!==x)
    throw Error('Original regulator committee termination date invalid');
 }
 if(input.originalSourceUrl!==null){
  const u=new URL(input.originalSourceUrl);
  if(u.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov',
   'register.cfb.mn.gov'].includes(u.hostname))
   throw Error('CFB original historical registration proof must be on regulator host');
 }
 // A claimed action/date + plausible official URL is NOT independently
 // authenticated original per-committee government evidence. This module
 // audits legal statutes only, not termination report bodies or action order.
 // We deliberately never issue a positive committee termination finding.
 return{
   independentDocumentedTermination:null,
   filingDutyIn2023Or2024:null,
 };
}
