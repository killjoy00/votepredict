export const CFB_REPORT_AVAILABILITY_VERSION='mn-cfb-report-availability-v3' as const;
export const CFB_SPECIFIC_LOBBYING_SUBJECT_FIRST_REPORT_YEAR=2024 as const;

function exactDate(value:string,label:string):string{
  const date=value?.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date??''))throw new Error(`${label} must be YYYY-MM-DD`);
  const parsed=new Date(date+'T00:00:00Z');
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error(`Invalid ${label}`);
  return date;
}

// CFB board records state that electronically filed CFRO campaign-finance reports
// are published on the Board website the day after filing. This helper deliberately
// requires a proven filing date; report due dates are never substituted.
export function cfbElectronicReportAvailableOn(filedOn:string):string{
  const date=new Date(exactDate(filedOn,'CFB filing date')+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}

export interface CfbDisclosureProof {
  registrationNumber:string;
  reportName:string;
  filedOn:string;
  availableOn:string;
  proofUrl:string;
  proofKind:'cfb_report_filing'|'cfb_large_contribution_notice'|'cfb_lobbyist_activity_report';
}

export function buildCfbReportDisclosureProof(input:{
  registrationNumber:string;
  reportName:string;
  filedOn:string;
  proofUrl:string;
}):CfbDisclosureProof{
  if(!input.registrationNumber.trim())throw new Error('CFB registration number required');
  if(!/^https:\/\//i.test(input.proofUrl))throw new Error('CFB proof URL must be https');
  const filedOn=exactDate(input.filedOn,'CFB filing date');
  return {
    registrationNumber:input.registrationNumber.trim(),
    reportName:input.reportName.trim(),
    filedOn,
    availableOn:cfbElectronicReportAvailableOn(filedOn),
    proofUrl:input.proofUrl,
    proofKind:'cfb_report_filing',
  };
}

// Large-contribution notice rows often carry a contribution/receipt date. That is an
// event date, not proof that the notice was public. Callers must separately prove both
// the actual filing date and the official publication/availability date. No derivation
// from transaction, contribution, receipt, due, or reporting-period dates is allowed.
export function buildCfbLargeContributionNoticeProof(input:{
  registrationNumber:string;
  filedOn:string;
  publishedOn:string;
  proofUrl:string;
}):CfbDisclosureProof{
  if(!input.registrationNumber.trim())throw new Error('CFB registration number required');
  if(!/^https:\/\//i.test(input.proofUrl))throw new Error('CFB proof URL must be https');
  const filedOn=exactDate(input.filedOn,'CFB notice filing date');
  const publishedOn=exactDate(input.publishedOn,'CFB notice publication date');
  if(publishedOn<filedOn)throw new Error('CFB notice publication date cannot precede filing date');
  return {
    registrationNumber:input.registrationNumber.trim(),
    reportName:'large_contribution_notice',
    filedOn,
    availableOn:publishedOn,
    proofUrl:input.proofUrl,
    proofKind:'cfb_large_contribution_notice',
  };
}

// Specific lobbying subjects are activity-report content, not dated transactions. The
// Board's July 10, 2024 minutes identify the Jan-May 2024 lobbyist activity report as
// the first report to disclose specific lobbying subjects. For historical replay, a
// reporting period, activity date, category date, or statutory due date still does not
// prove public availability. Callers must separately prove the actual filing date and
// the date the regulator made that filing public; no campaign-finance next-day rule is
// assumed for lobbyist reports.
export function buildCfbLobbyistActivityDisclosureProof(input:{
  registrationNumber:string;
  reportName:string;
  filedOn:string;
  publishedOn:string;
  proofUrl:string;
}):CfbDisclosureProof{
  if(!input.registrationNumber.trim())throw new Error('CFB registration number required');
  if(!input.reportName.trim())throw new Error('CFB lobbyist report name required');
  if(!/^https:\/\//i.test(input.proofUrl))throw new Error('CFB proof URL must be https');
  const filedOn=exactDate(input.filedOn,'CFB lobbyist report filing date');
  const publishedOn=exactDate(input.publishedOn,'CFB lobbyist report publication date');
  if(publishedOn<filedOn)throw new Error('CFB lobbyist report publication date cannot precede filing date');
  return {
    registrationNumber:input.registrationNumber.trim(),
    reportName:input.reportName.trim(),
    filedOn,
    availableOn:publishedOn,
    proofUrl:input.proofUrl,
    proofKind:'cfb_lobbyist_activity_report',
  };
}
