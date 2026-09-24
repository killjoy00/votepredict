export const CFB_REPORT_AVAILABILITY_VERSION='mn-cfb-report-availability-v1' as const;

// CFB board records state that electronically filed CFRO campaign-finance reports
// are published on the Board website the day after filing. This helper deliberately
// requires a proven filing date; report due dates are never substituted.
export function cfbElectronicReportAvailableOn(filedOn:string):string{
  const match=filedOn.match(/^(\d{4}-\d{2}-\d{2})/);
  if(!match)throw new Error('CFB filing date must be YYYY-MM-DD');
  const date=new Date(match[1]+'T00:00:00Z');
  if(Number.isNaN(date.getTime()))throw new Error('Invalid CFB filing date');
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}

export interface CfbDisclosureProof {
  registrationNumber:string;
  reportName:string;
  filedOn:string;
  availableOn:string;
  proofUrl:string;
  proofKind:'cfb_report_filing'|'cfb_large_contribution_notice';
}

export function buildCfbReportDisclosureProof(input:{
  registrationNumber:string;
  reportName:string;
  filedOn:string;
  proofUrl:string;
}):CfbDisclosureProof{
  if(!input.registrationNumber.trim())throw new Error('CFB registration number required');
  if(!/^https:\/\//i.test(input.proofUrl))throw new Error('CFB proof URL must be https');
  return {
    registrationNumber:input.registrationNumber.trim(),
    reportName:input.reportName.trim(),
    filedOn:input.filedOn.slice(0,10),
    availableOn:cfbElectronicReportAvailableOn(input.filedOn),
    proofUrl:input.proofUrl,
    proofKind:'cfb_report_filing',
  };
}

export function buildCfbLargeContributionNoticeProof(input:{
  registrationNumber:string;
  noticeDate:string;
  proofUrl:string;
}):CfbDisclosureProof{
  if(!input.registrationNumber.trim())throw new Error('CFB registration number required');
  if(!/^https:\/\//i.test(input.proofUrl))throw new Error('CFB proof URL must be https');
  const date=input.noticeDate.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('CFB notice date must be YYYY-MM-DD');
  return {
    registrationNumber:input.registrationNumber.trim(),
    reportName:'large_contribution_notice',
    filedOn:date,
    availableOn:date,
    proofUrl:input.proofUrl,
    proofKind:'cfb_large_contribution_notice',
  };
}
