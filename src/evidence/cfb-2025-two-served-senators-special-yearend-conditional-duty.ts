/**
 * Issue #864, finance Track B: a CONDITIONAL 2025 reporting-duty fact from
 * the TWO ORIGINAL SD29/SD47 special-election CFB disclosure calendars.
 *
 * The Board's 2025 calendar explicitly requires an additional year-end
 * report UNLESS the cycle-final is a termination report. This is a concrete
 * legal predicate, not proof that either actual senator's cycle-final form
 * was (or was not) a termination, not proof of a YE filing, and not historical
 * public-by evidence. No named non-serving candidates are admitted.
 */
import {createHash} from 'node:crypto';
import {
  validateActualSenateServiceForElection,
  type AuditedOfficialSenateDirectory,
} from './senate-official-ever-served-directory.js';
import {
  SERVED_2025_YE_CALENDAR,SERVED_2025_YE_CALENDAR_SHA,
  SERVED_2025_YE_DUE,SERVED_2025_YE_REFERENCE_LEDGER_SHA,
} from './cfb-2025-served-two-ordinary-year-end-originals.js';

export const SPECIAL_2025_SERVING_SENATORS_CONDITIONAL_DUTY_SCHEMA=
  'cfb-2025-actual-senators-2-special-yearend-conditional-duty-original-calendar-v1' as const;
export const OFFICIAL_2025_TERMINATION_LAW=
  'https://www.revisor.mn.gov/statutes/2025/cite/10A.243' as const;
export const OFFICIAL_2025_REGISTRATION_LAW=
  'https://www.revisor.mn.gov/statutes/2025/cite/10A.14' as const;
export const REGISTRY_ORIGINAL_PSV_SHA=
  '31376fef8883e40d86091632b7d0581ee034553f56f43d56744ebe7c3c9a94ec' as const;
const SHA=/^[a-f0-9]{64}$/;
const CALENDAR_SPEC=[
  {district:29,reg:'19229',name:'Michael Holmstrom Jr',registered:'2025-07-29',
   url:'https://cfb.mn.gov/pdf/calendars/2025_special_election_29.pdf',
   sha:'b102a7297a6ff1add3bcdb4bce03ef9761f3a3433908cbb507e95554fd3d38b2',
   specialOriginalSha:'0cecaf71ada09c3cb7d12dd439438dc432c7998159250b7c62e85bfdb0e383b2',
   boardReceived:'2025-11-26'},
  {district:47,reg:'19233',name:'Amanda Hemmingsen-Jaeger',registered:'2025-08-01',
   url:'https://cfb.mn.gov/pdf/calendars/2025_special_election_47.pdf',
   sha:'3b7669d2597632278b2a0e895a5cbf7199492fd286872127f6d9e36d9eb13291',
   specialOriginalSha:'e96a87e4bd9d0583382ae2345fd597e7c8d6db7f919c91797516c975b1ca4ab1',
   boardReceived:'2025-11-20'},
] as const;
export type OriginalCalendar={district:29|47;url:string;sha256:string;
  observedAt:string;bytes:number;text:string};
export type Original2025GeneralCalendar={
  url:string;sha256:string;observedAt:string;bytes:number;text:string;
};
type FinalProof={
  schemaVersion:string;
  sourceOriginalReports:Array<{
    reportId:string;district:number;senator:string;registrationNumber:string;
    originalPdfBinarySha256:string;boardReceivedOn:string;calendarDueOn:string;
    legallyPossibleNotBeforeOn:string;originalViewerApiSha256:string;
    independentlyProvenHistoricalPublicByOn:null;
  }>;
  sourceSummary:{
    newlyAuthenticatedOriginalPdfVersionsBeyondPrevious2025Cohorts:number;
    historicalPublicByVerified:number;sourceFailures:number;
  };
};
function utcDateValid(s:string):boolean{
  const date=new Date(s);
  return /^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)
    &&Number.isFinite(date.getTime())&&date.toISOString()===s
    &&date.getTime()<=Date.now()+60000;
}
function normalized(text:string){return text.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();}
export function verifyOriginalSpecialCalendarConditional(
  calendar:OriginalCalendar,
):{verified:boolean;reason:string|null}{
  const spec=CALENDAR_SPEC.find(s=>s.district===calendar.district);
  if(!spec||calendar.url!==spec.url||calendar.sha256!==spec.sha
    ||calendar.bytes<500||calendar.bytes>12000000||!utcDateValid(calendar.observedAt))
    return {verified:false,reason:'original_official_special_calendar_provenance_missing'};
  const body=normalized(calendar.text);
  const matches=
    new RegExp('Senate\\s+District\\s+'+spec.district+
      '\\s+Special\\s+Election\\s+Public\\s+Disclosure\\s+Calendar','i').test(body)
    &&/\b2025\b/.test(body)
    &&/Special election cycle final report of receipts and expenditures due/i.test(body)
    &&/Period\s+covered\s*:\s*July\s+29\s+through\s+November\s+19,?\s+2025/i.test(body)
    &&/\bDecember\s+1\b/.test(body)
    // This precise conditional can only be sourced from an ORIGINAL PDF,
    // and must not be silently simplified to an unconditional obligation.
    &&/Candidates\s+will\s+be\s+required\s+to\s+file\s+a\s+2025\s+year-end\s+report\s+in\s+addition\s+to\s+the\s+special\s+election\s+cycle\s+final\s+report\s+unless\s+the\s+special\s+election\s+cycle\s+final\s+report\s+is\s+a\s+termination\s+report/i.test(body);
  return matches?{verified:true,reason:null}:
    {verified:false,reason:'2025_special_calendar_termination_exception_not_explicitly_verified'};
}
export function verifyOriginal2025GeneralCalendar(c:Original2025GeneralCalendar){
  const txt=normalized(c.text);
  return c.url===SERVED_2025_YE_CALENDAR
    &&c.sha256===SERVED_2025_YE_CALENDAR_SHA
    &&c.bytes>=500&&c.bytes<=12000000&&utcDateValid(c.observedAt)
    &&/2025\s+Campaign\s+Finance\s+Disclosure\s+Calendar/i.test(txt)
    &&/\b2026\b/.test(txt)
    &&/2025\s+year-end\s+report\s+of\s+receipts\s+and\s+expenditures\s+due/i.test(txt)
    &&/February\s+2\b/.test(txt);
}
function datedRegistry(registry:string){
  const finalNewline=registry.endsWith('\n');
  if(!finalNewline||registry.endsWith('\n\n'))throw Error('Original 2026 CFB registry PSV malformed newline');
  const raw=registry.slice(0,-1);
  if(createHash('sha256').update(raw).digest('hex')!==REGISTRY_ORIGINAL_PSV_SHA)
    throw Error('Original 2026 current CFB registry source SHA mismatched');
  const dates=new Map<string,{listedRegisteredOn:string;listedTerminatedOn:string|null}>();
  for(const row of raw.split('\n')){
    const fields=row.split('|');
    if(fields.length!==3||!/^[0-9]{3,8}$/.test(fields[0]??'')
      ||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fields[1]??'')
      ||(fields[2]&&!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fields[2]))
      ||dates.has(fields[0]!))throw Error('Original CFB registry registration and dates corrupted');
    dates.set(fields[0]!,{
      listedRegisteredOn:fields[1]!,listedTerminatedOn:fields[2]||null,
    });
  }
  if(dates.size!==230)throw Error('Original 2026 current CFB registered Senate rows changed');
  return dates;
}
function originalViewerLedger(original:string){
  if(!original.endsWith('\n')||original.endsWith('\n\n'))throw Error('Original 2025 viewer metadata malformed');
  const raw=original.slice(0,-1);
  if(createHash('sha256').update(raw).digest('hex')!==SERVED_2025_YE_REFERENCE_LEDGER_SHA)
    throw Error('2025 original CFB viewer ledger source SHA mismatched');
  const refs=new Map<string,{sha:string;tokens:string[]}>();
  for(const line of raw.split('\n')){
    const cols=line.split('|');
    if(cols.length!==3||!SHA.test(cols[1]??'')||refs.has(cols[0]!))
      throw Error('Malformed original CFB 2025 reports metadata');
    refs.set(cols[0]!,{sha:cols[1]!,tokens:cols[2]!.split(',')});
  }
  if(refs.size!==41)throw Error('2025 CFB registration source cohort changed');
  return refs;
}
export function audit2025SpecialConditionalYearEndDuties(input:{
  official:AuditedOfficialSenateDirectory;
  finalCheckpoint:FinalProof;
  registrySnapshot:string;
  pinned2025ViewerLedger:string;
  specialCalendars:readonly OriginalCalendar[];
  generalCalendar:Original2025GeneralCalendar;
}){
  const {official,finalCheckpoint,registrySnapshot,pinned2025ViewerLedger,
    specialCalendars,generalCalendar}=input;
  if(finalCheckpoint.schemaVersion!==
      'cfb-2025-ever-served-senators-2-special-final-original-pdf-source-checkpoint-v1'
    ||finalCheckpoint.sourceOriginalReports.length!==2
    ||finalCheckpoint.sourceSummary.newlyAuthenticatedOriginalPdfVersionsBeyondPrevious2025Cohorts!==2
    ||finalCheckpoint.sourceSummary.historicalPublicByVerified!==0
    ||finalCheckpoint.sourceSummary.sourceFailures!==0)
    throw Error('Original fully authenticated 2025 Senate two-final report source missing');
  if(specialCalendars.length!==2
    ||new Set(specialCalendars.map(x=>x.district)).size!==2)
    throw Error('Exactly two distinct original district-specific CFB disclosure calendars required');
  if(!verifyOriginal2025GeneralCalendar(generalCalendar))
    throw Error('Independent original general 2025 CFB disclosure calendar did not authenticate');
  const dated=datedRegistry(registrySnapshot);
  const viewer=originalViewerLedger(pinned2025ViewerLedger);
  const records=[];
  for(const spec of CALENDAR_SPEC){
    const calendar=specialCalendars.find(c=>c.district===spec.district)!;
    const check=verifyOriginalSpecialCalendarConditional(calendar);
    if(!check.verified)throw Error('Original CFB 2025 calendar conditional text not proved: '+check.reason);
    const actual=validateActualSenateServiceForElection(
      official,spec.name,String(spec.district),2025);
    if(actual.status!=='verified_senate_service'
      ||actual.officialName!==spec.name||!actual.officialServiceSource)
      throw Error('Actual Senate service not independently verified');
    const proof=finalCheckpoint.sourceOriginalReports.find(r=>r.registrationNumber===spec.reg);
    const v=viewer.get(spec.reg),reg=dated.get(spec.reg);
    if(!proof||!v||!reg||proof.district!==spec.district||proof.senator!==spec.name
      ||proof.reportId!==spec.reg+':25:pcc:YE:1:0'
      ||proof.originalPdfBinarySha256!==spec.specialOriginalSha
      ||proof.calendarDueOn!=='2025-12-01'||proof.boardReceivedOn!==spec.boardReceived
      ||proof.legallyPossibleNotBeforeOn!=='2025-12-02'
      ||proof.independentlyProvenHistoricalPublicByOn!==null
      ||v.sha!==proof.originalViewerApiSha256
      ||!v.tokens.includes('YE1.0')||!v.tokens.includes('YE0.0')
      ||reg.listedRegisteredOn!==spec.registered
      ||reg.listedTerminatedOn!==null)
      throw Error('2025 original actual senator, registration, report and date proof did not reconcile');
    records.push({
      person:spec.name,actualSenateServiceVerified:true,
      independentSenateServiceOriginalUrl:actual.officialServiceSource,
      district:spec.district,cfbRegistrationId:spec.reg,
      currentOctober2026CFBListReportedRegistrationOn:reg.listedRegisteredOn,
      currentOctober2026CFBListReportedTerminationOn:reg.listedTerminatedOn,
      originalRegistry2026ObservationProvesHistoricalEffectiveRegistration:false,
      independentlyProvenHistoricRegistrationEffectiveOn:null,
      independentlyProvenHistoricTerminationEffectiveOn:null,
      originalSpecialCycleFinalPdfId:proof.reportId,
      originalSpecialCycleFinalPdfSha256:proof.originalPdfBinarySha256,
      boardReceivedOriginalFinalOn:proof.boardReceivedOn,
      sourceYearEndOriginalViewerId:spec.reg+':25:pcc:YE:0:0',
      originalYearEndViewerReferenceObservedIn2026:true,
      originalYearEndPdfAuthenticatedByThisAudit:false,
      specialFinalDueOn:'2025-12-01',
      yearEndDueOn:SERVED_2025_YE_DUE,
      legalSourceSpecialCalendarUrl:spec.url,
      originalSpecialCalendarSha256:spec.sha,
      originalSpecialCalendarObservedAt:calendar.observedAt,
      generalCalendarUrl:SERVED_2025_YE_CALENDAR,
      generalCalendarSha256:SERVED_2025_YE_CALENDAR_SHA,
      originalCalendarCondition:
        '2025_year_end_required_unless_special_cycle_final_is_termination_report',
      conditionalDutyOfficiallyEstablished:true,
      whetherOriginalCycleFinalIsTerminationReportIndependentlyVerified:null,
      yearEndLegallyOwedForThisCommittee:null,
      annualYearEndFilingComplianceEstablished:null,
      statewideReportObligationDenominator:null,
      historicallyProvenPublicByOn:null,
      historicalPredictionEligible:false,
    });
  }
  return {
    schemaVersion:SPECIAL_2025_SERVING_SENATORS_CONDITIONAL_DUTY_SCHEMA,
    observedAt:new Date().toISOString(),
    actualSenateMemberCases:records,
    originalCalendarProofs:specialCalendars.map(s=>({
      district:s.district,url:s.url,sha256:s.sha256,
      bytes:s.bytes,observedAt:s.observedAt,
      terminationExceptionTextVerified:true,
    })),
    independentGeneralCalendarProof:{
      url:generalCalendar.url,sha256:generalCalendar.sha256,
      bytes:generalCalendar.bytes,observedAt:generalCalendar.observedAt,
      2025YearEndDueOn:SERVED_2025_YE_DUE,
    },
    official2025TerminationRuleSource:OFFICIAL_2025_TERMINATION_LAW,
    official2025RegistrationRuleSource:OFFICIAL_2025_REGISTRATION_LAW,
    original2026CurrentRegistryIsNotHistoricalLifecycleCertificate:true,
    note:'The Board explicitly makes an additional 2025 year-end report conditional on the special-cycle final NOT being a termination report; neither a YE0.0 viewer link nor absence of a recent 2026 termination marker independently decides that question.',
    sums:{
      actualSenators:2,conditionalOriginalCalendarRulesVerified:2,
      independentlyDeterminedTerminationCheckboxes:0,
      independentlyProvenHistoricalRegistrations:0,
      independentlyProvenHistoricalTerminations:0,
      legallyOwedOriginalYearEndCount:null,
      actualFiledYearEndOriginalsAuthenticatedThisAudit:0,
      independentlyProvenHistoricalPublicByDates:0,
      statewideLegallyRequiredSenateReportCount:null,
    },
    safeguards:{
      nonServingPersonNamesPersisted:false,originalSourceBodiesStored:false,
      personalContactDataStored:false,donorsStored:false,
      noCandidateReportsModified:true,noHistoricalForecastEligibility:true,
      noProductionDbAccess:true,noScheduledSourceReacquisition:true,
      no2027OrModelChanges:true,keepIssue864Open:true,
    },
  };
}
