/**
 * Issue #864, track 1: 24 original VERSION report PDFs (amend=0, not the
 * independently certified amendment checkbox) from 12 2022 Senate
 * registrations, one per district 1 through 12, C and E reports each.
 *
 * All twelve registrations, original CFB reports_data API SHA256 digests,
 * original 2022 district-selection page SHA256 digests and district identities
 * were independently acquired by prior CFB sources. Do not promote a viewer
 * reference, Board receipt stamp or statutory release floor to historical
 * public-by evidence or as-of prediction eligibility.
 */
import { cfbElectronicReportAvailableOn } from './cfb-report-availability.js';
import { cfbReportViewerUrl } from './cfb-current-report-acquisition.js';
import type { CfbReportViewerReference } from './cfb-report-pdf-proof.js';

export const CFB_2022_SENATE_CE_PROOF_VERSION =
  'cfb-2022-senate-12-district-24-original-ce-pdf-proofs-v1' as const;
export const CFB_2022_CE_INDEPENDENT_CALENDAR_URL =
  'https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf';
const SOURCED: ReadonlyArray<{
  reg: string; district: number; viewerSha: string; districtPageSha: string;
}> = [
  {reg:'18011',district:1,viewerSha:'8fba66d4ddb3447bc1a312eda3147883d48e06b42e742320ec813267fd6a34e1',districtPageSha:'3a83026171f1ca8cd4dfb18f6abc2c260534e3709e822f019f90e37d3f896859'},
  {reg:'18792',district:2,viewerSha:'5685dc4ac622a06926c4ceeb9f95b921e684731393dc819d1487a323bcb24130',districtPageSha:'1366a4e21cf11d0657fae5b710485b3542267ab2de5df9fd20e73de0505adc1b'},
  {reg:'18873',district:3,viewerSha:'be43e7f0410e4f875e58a4ee318a01e35a7548e822c5b6f05727a854c19cc1ec',districtPageSha:'c1c518748d9f5100490433e2228c2b604a0b4c7edbe72df3d5bed7b667454732'},
  {reg:'18917',district:4,viewerSha:'a1398201e2af495580a59f4762529cf2378d8112003a5ee40fdc390d2aa6d1df',districtPageSha:'33b8d34c419d242e65459bc0a1cd2e8471fa3c807126c8a755eae373f8c0487a'},
  {reg:'18001',district:5,viewerSha:'e42a55d4275e2df3917e20e4ee9f2851fca07b0426fc1a2127495117ff535bbd',districtPageSha:'341d2739aaa00f234107be6fcaa35647635a8c416901ef74328f369984725bbe'},
  {reg:'18077',district:6,viewerSha:'ba58067adaa5fb8b377794f20b354412c2cd0a2206483d773d04ec964335733b',districtPageSha:'5d18dc31898994d8eb766282f56e7ca0947e7833b9583642a7e1c6e9355d58e1'},
  {reg:'18821',district:7,viewerSha:'221c4e5c837cf4a84c747882c6357b2e0e6f28eb3cb7aee1724003cfa24e5216',districtPageSha:'30040ae9a71a17bfa14e7fce59027c0442626b6278f7388850754d52af00650a'},
  {reg:'18581',district:8,viewerSha:'164d01d97b308aed867079e5303a602fae28ebf9b6afaa4e017d52468e79d0d2',districtPageSha:'06b956ae506f232ebe7191fb7c14423aecbf476781c09cf4b713613f757a1268'},
  {reg:'18749',district:9,viewerSha:'55428d056917f70425670b94a991a37ba12ae0aa7ed0429f2292205fcff142d1',districtPageSha:'788e55c4c863159a065c753803bb2bdfda94806c1703a780802f231433419dd8'},
  {reg:'18778',district:10,viewerSha:'556017e91ec285f0b18e5422526507eadcc033fa7426feeec4a03b19b5c8beb5',districtPageSha:'69fa946f581f3c72136493be85d860c3184a226f3cb265bad2a31f1752124a2c'},
  {reg:'18406',district:11,viewerSha:'f55257c5e6095307f27870913681074f045b88e17ccfea2d260ffe666cec0424',districtPageSha:'d00233234e766b6bcb58f2c4157ca154f52db18e068257f66683259e09877102'},
  {reg:'17373',district:12,viewerSha:'42ba8c48ca059e1d39901e3b2d1a729ba8908044acb804613f6323f3fef67b00',districtPageSha:'f21db8a0ae4813587a8c6d16603281dec3734260068ff24813ca21b1e833de8f'},
] as const;

export const CFB_2022_CE_RULES = {
  C: {dueOn:'2022-07-25',coverageEndOn:'2022-07-18'},
  E: {dueOn:'2022-10-31',coverageEndOn:'2022-10-24'},
} as const;

export interface Cfb2022OriginalCeTarget {
  reg: string; district: number; period: 'C'|'E';
  id:string; viewerSha:string; districtPageSha:string;
  dueOn:string; expectedPeriodEndOn:string;
}
export function cfb2022OriginalCePdfTargets(): Cfb2022OriginalCeTarget[] {
  const districts=new Set(SOURCED.map(t=>t.district));
  const regs=new Set(SOURCED.map(t=>t.reg));
  if(SOURCED.length!==12 || districts.size!==12 || regs.size!==12
    || [...districts].sort((a,b)=>a-b).join(',')!==Array.from({length:12},(_,i)=>i+1).join(',')
    || SOURCED.some(t=>!/^\d{4,8}$/.test(t.reg)
      || !/^[0-9a-f]{64}$/.test(t.viewerSha)
      || !/^[0-9a-f]{64}$/.test(t.districtPageSha))) throw Error('Untrusted pinned 2022 cohort');
  return SOURCED.flatMap(t=>(['C','E'] as const).map(period=>({
    reg:t.reg,district:t.district,period,
    id:[t.reg,'22','pcc',period,'0','0'].join(':'),
    viewerSha:t.viewerSha,districtPageSha:t.districtPageSha,
    dueOn:CFB_2022_CE_RULES[period].dueOn,
    expectedPeriodEndOn:CFB_2022_CE_RULES[period].coverageEndOn,
  }))).sort((a,b)=>a.district-b.district || a.period.localeCompare(b.period));
}
export function cfb2022CeRef(target:Cfb2022OriginalCeTarget):CfbReportViewerReference {
  return {registrationNumber:target.reg,year:'22',type:'pcc',period:target.period,se:'0',
    amendment:0,filingYear:2022,reportName:'2022 pre-election report'};
}
export interface Cfb2022PdfProofCapture {
  sourceUrl:string; sha256:string; bytes:number; fetchedAt:string; text:string;
}
function dateUs(s:string):string|null {
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(!m) return null;
  const d=new Date(Date.UTC(+m[3]!,+m[1]!-1,+m[2]!));
  return d.getUTCFullYear()===+m[3]! && d.getUTCMonth()===+m[1]!-1 && d.getUTCDate()===+m[2]!
    ? d.toISOString().slice(0,10) : null;
}
function dateEnglish(s:string):string|null {
  const m=/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
  const months=['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const idx=m ? months.indexOf(m[1]!.toLowerCase()) : -1;
  return m && idx>=0 ? dateUs((idx+1)+'/'+m[2]+'/'+m[3]) : null;
}
const shaOk=(s:string)=>/^[a-f0-9]{64}$/.test(s);
function captureValid(p:Cfb2022PdfProofCapture):boolean {
  return shaOk(p.sha256) && Number.isInteger(p.bytes) && p.bytes>=300 && p.bytes<=30_000_000
    && !Number.isNaN(Date.parse(p.fetchedAt));
}
function normalized(t:string){return t.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();}
export function diagnoseCfb2022CeCalendar(p:Cfb2022PdfProofCapture|null){
  const t=p?normalized(p.text):'';
  return {
    sourceIdentity:!!p&&p.sourceUrl===CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
    pdfProvenance:!!p&&captureValid(p)&&p.bytes>=500,
    datedCalendarTitle:/2022 Disclosure Calendar for Candidates for Senate, House, and District Courts/i.test(t),
    hasYear2022:/2022/.test(t),
    hasJuly25:/July 25/.test(t),
    hasPreprimaryTerm:/Pre-primary report of receipts and expenditures due/i.test(t),
    preprimaryPeriodExact:/Pre-primary report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2022 through 7\/18\/2022/i.test(t),
    hasOctober31:/October 31/.test(t),
    hasPregeneralTerm:/Pre-general report of receipts and expenditures due/i.test(t),
    pregeneralPeriodExact:/October 31\s+Pre-general report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2022 through 10\/24\/2022/i.test(t),
    primaryLossExemption:/Candidates who lost the primary election do not need to file this report/i.test(t),
  };
}
export function diagnoseCfb2022OriginalCeHeader(target:Cfb2022OriginalCeTarget,text:string){
  const head=normalized(text).slice(0,6500);
  const direct=head.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1]??null;
  const labelIndex=head.search(/Registration\s+Number\s*:/i);
  const vicinity=labelIndex<0?'':head.slice(Math.max(0,labelIndex-700),labelIndex+700);
  const dates=head.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const received=head.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i);
  const district=new RegExp('Senat(?:e|or)\\s+District\\s*:?\\s*'+target.district+'\\b','i');
  return {
    firstPageWindowChars:head.length,
    hasPrincipalCommitteeReportTitle:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head),
    hasRegistrationLabel:labelIndex>=0,
    directRegistrationNumberMatches:direct===target.reg,
    registrationIdFoundNearSourceLabel:labelIndex>=0
      && new RegExp('(?:^|\\D)'+target.reg+'(?:\\D|$)').test(vicinity),
    hasSenateOfficeWord:/Senat(?:e|or)/i.test(head),
    expectedSenateDistrictMatched:district.test(head),
    hasPeriodCoveredLabel:/Period\s+Covered\s*:/i.test(head),
    coveragePeriodParseable:!!dates,
    parsedPeriodStartOn:dateUs(dates?.[1]??''),
    parsedPeriodEndOn:dateUs(dates?.[2]??''),
    exactIndependentExpectedPeriodEnd:dateUs(dates?.[2]??'')===target.expectedPeriodEndOn,
    hasBoardReceivedStamp:/Received\s+by\s+the\s+Board/i.test(head),
    receivedDateParseable:!!received,
    parsedReceivedOn:dateEnglish(received?.[1]??''),
  };
}
export function verifyCfb2022CeCalendar(p:Cfb2022PdfProofCapture|null):boolean {
  if(!p || p.sourceUrl!==CFB_2022_CE_INDEPENDENT_CALENDAR_URL || !captureValid(p)
    || p.bytes<500) return false;
  const t=normalized(p.text);
  // The dated 2022 candidate packet contains an original, not mutable
  // current-year, Senate+House+district court disclosure calendar.
  return /2022 Disclosure Calendar for Candidates for Senate, House, and District Courts/i.test(t)
    && /2022/.test(t)
    && /July 25/.test(t)
    && /Pre-primary report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2022 through 7\/18\/2022/i.test(t)
    && /October 31\s+Pre-general report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2022 through 10\/24\/2022/i.test(t)
    && /Candidates who lost the primary election do not need to file this report/i.test(t);
}
export function parseCfb2022OriginalCeHeader(target:Cfb2022OriginalCeTarget,text:string){
  const head=normalized(text).slice(0,6500);
  if(!/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head)) return null;
  const reg=head.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1] ?? null;
  // The 2022 paper forms often print the registration NUMBER separately from
  // its label. Require either the directly adjacent exact number OR an
  // unambiguous target number close to a verified registration label.
  // A directly adjacent, different registration MUST always be rejected.
  const labelIndex=head.search(/Registration\s+Number\s*:/i);
  const vicinity=labelIndex<0?'':head.slice(Math.max(0,labelIndex-700),labelIndex+700);
  const registrationMatches=reg!==null
    ? reg===target.reg
    : labelIndex>=0 && new RegExp('(?:^|\\D)'+target.reg+'(?:\\D|$)').test(vicinity);
  const district=new RegExp('Senat(?:e|or)\\s+District\\s*:?\\s*'+target.district+'\\b','i');
  const dates=head.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const rec=head.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i);
  if(!registrationMatches || !district.test(head) || !dates || !rec) return null;
  const periodStartOn=dateUs(dates[1]??'');
  const periodEndOn=dateUs(dates[2]??'');
  const receivedOn=dateEnglish(rec[1]??'');
  if(!periodStartOn || !periodEndOn || !receivedOn
    || periodStartOn<'2022-01-01' || periodStartOn>periodEndOn
    || periodEndOn!==target.expectedPeriodEndOn || receivedOn<periodEndOn) return null;
  return {periodStartOn,periodEndOn,receivedOn,identityMatches:true as const};
}
export function auditCfb2022OriginalCePdf(
  target:Cfb2022OriginalCeTarget, pdf:Cfb2022PdfProofCapture|null,
  calendar:Cfb2022PdfProofCapture|null, sourceError:string|null=null,
){
  const expectedUrl=cfbReportViewerUrl(cfb2022CeRef(target));
  const pdfProvenance=!!pdf && captureValid(pdf) && pdf.sourceUrl===expectedUrl;
  const header=pdfProvenance?parseCfb2022OriginalCeHeader(target,pdf!.text):null;
  const independentCalendarVerified=verifyCfb2022CeCalendar(calendar);
  const verified=!!header && independentCalendarVerified && !sourceError;
  return {
    id:target.id,registrationNumber:target.reg,senateDistrict:target.district,
    period:target.period,viewerReportVersionZero:true,
    originalPdfAmendmentCheckboxIndependentlyVerified:false,
    priorOfficialCandidateApiSha256:target.viewerSha,
    originalDistrictRosterHtmlSha256:target.districtPageSha,
    originalPdfSourceUrl:pdfProvenance?pdf!.sourceUrl:null,
    originalPdfSha256:pdfProvenance?pdf!.sha256:null,
    originalPdfBytes:pdfProvenance?pdf!.bytes:null,
    originalPdfHeaderIdentityAndPeriodVerified:!!header,
    reportCoverageStartOn:header?.periodStartOn??null,
    reportCoverageEndOn:header?.periodEndOn??null,
    reportReceivedByBoardOn:header?.receivedOn??null,
    calendarUrl:CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
    independentlyAuthenticatedOriginalCalendar:independentCalendarVerified,
    statutoryDueOn:independentCalendarVerified?target.dueOn:null,
    earliestLegalAndFilingBoundOn:verified?cfbElectronicReportAvailableOn(header!.receivedOn,target.dueOn):null,
    historicalPublicByDateIndependentlyVerified:null,
    eligibleForHistoricalPrediction:false,
    sourceError,
    status:sourceError?'source_fetch_or_identity_failed'
      :!pdfProvenance?'source_pdf_missing_or_invalid'
      :!header?'source_pdf_first_page_identity_or_period_mismatch'
      :!independentCalendarVerified?'independent_calendar_unverified'
      :'original_version_pdf_header_and_independent_calendar_verified',
  };
}
