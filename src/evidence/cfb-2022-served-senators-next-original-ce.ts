/**
 * #864 finance Track A: NEW 2022 original C/E PDF targets from Senate districts
 * 13-24. Exactly one person per district may enter after independent official
 * SOS general-result, Minnesota LRL actual Senate service, CFB district roster,
 * and SHA-pinned original reports_data viewer evidence all agree.
 *
 * The election result is used RETROSPECTIVELY for source discovery, never as a
 * pre-election model feature. No candidate who never served is named in output.
 */
import {createHash} from 'node:crypto';
import {validateActualSenateServiceForElection,
  type AuditedOfficialSenateDirectory} from './senate-official-ever-served-directory.js';
import type {SosSenate2022Result} from './cfb-2022-senate-sos-ballot-obligation-reconciliation.js';
import {deriveCfb2022OriginalSegmentRegistrationSet}
  from './cfb-2022-senate-sos-ballot-obligation-reconciliation.js';
import type {CfbSenateDistrictPageObservation}
  from './cfb-senate-district-registration-inventory.js';
import {CFB_2022_CE_RULES,auditCfb2022OriginalCePdf,
  type Cfb2022OriginalCeTarget,type Cfb2022PdfProofCapture}
  from './cfb-2022-senate-original-ce-pdf-proof.js';

export const SERVED_2022_NEXT_CE_VERSION=
  'cfb-2022-ever-served-sd13-24-first-party-original-ce-v1' as const;
export const SERVED_2022_NEXT_DISTRICTS=
  [13,14,15,16,17,18,19,20,21,22,23,24] as const;
export const SERVED_2022_GENERAL_SOURCE_SHA=
  'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74' as const;
export const SERVED_2022_396_SOURCE_PSV_SHA=
  '6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9' as const;
const exactSha=(s:string)=>/^[0-9a-f]{64}$/.test(s);
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const normalized=(s:string)=>s.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/g,' ')
  .replace(/[^a-z ]/g,' ').trim().replace(/\s+/g,' ');
const firstLast=(s:string)=>{const a=normalized(s).split(' ');return a.length>=2?a[0]+'|'+a.at(-1):null;};
function matchesCfbRosterLabel(label:string,name:string):boolean{
  const a=label.split(',');
  if(a.length!==2||!a[0]||!a[1])return false;
  return firstLast(a[1]+' '+a[0])===firstLast(name);
}
export interface Served2022OriginalCeTarget extends Cfb2022OriginalCeTarget {
  senator:string;officialServiceSource:string;
  officialServiceSourceObservedAt:string;originalElectionSourceSha256:string;
  /** Previous district(s) recorded for this exact person in the official
   * LRL Senate service record for 2022. A 2022 campaign report may still
   * print that district after election redistricting; never infer it. */
  official2022PreviousSenateDistricts:number[];
}
interface PinnedIndex {
  observedCandidateRegistrationIndex:{
    registrationIdsCsv:string;segmentMembershipMaskHex:string;distinctRegistrations:number;
  };
  provenance:{runId:number;rawJsonSha256:string};
}
export function load2022PinnedOriginalViewerRows(psv:string){
  if(sha(psv)!==SERVED_2022_396_SOURCE_PSV_SHA)
    throw Error('Permanent original 396-CFB-API-body ledger hash mismatch');
  const rows=new Map<string,{apiSha:string;keys:Set<string>}>();
  let count=0;
  for(const line of psv.split('\n')){
    const [segment,reg,apiSha,keys,...tail]=line.split('|');
    if(tail.length||!['2022','2024'].includes(segment??'')
      ||!/^\d{3,8}$/.test(reg??'')||!exactSha(apiSha??'')
      ||keys===undefined||(keys.length>0&&keys.split(',').some(k=>!/^(21|22|23|24):(pcc|aoc):(YE|C|E):[01]:\d+$/.test(k))))
      throw Error('Malformed permanent historical CFB API-ledger row');
    count++;
    if(segment==='2022'){
      if(rows.has(reg!))throw Error('Duplicate 2022 Senate CFB registration source');
      rows.set(reg!,{apiSha:apiSha!,keys:new Set(keys?keys.split(','):[])});
    }
  }
  if(count!==396||rows.size!==270)throw Error('Historical 396-CFB viewer source scope drift');
  return rows;
}
export function selectServed2022NextOriginalCe(input:{
  official:AuditedOfficialSenateDirectory;
  sosGeneral:readonly SosSenate2022Result[];
  originalSosGeneralBytesSha256:string;
  cfbDistrictPages:readonly CfbSenateDistrictPageObservation[];
  viewerPsv:string;
  registrationCheckpoint:PinnedIndex;
  alreadyAuthenticatedReportIds:ReadonlySet<string>;
}):{targets:Served2022OriginalCeTarget[];
  selectedSenators:{district:number;officialName:string;registrationNumber:string;
    originalCfbDistrictPageSha256:string;originalViewerApiSha256:string}[];
  skippedDistricts:{district:number;reason:string}[];
  legalSenateReportDenominator:null;
}{
  if(input.originalSosGeneralBytesSha256!==SERVED_2022_GENERAL_SOURCE_SHA
    ||input.official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
    ||!exactSha(input.official.source.sourceBytesSha256)
    ||!Number.isFinite(Date.parse(input.official.source.observedAt)))
    throw Error('Independent original SOS election or official Senate service provenance missing');
  if(input.sosGeneral.some(r=>r.election!=='general')
    ||new Set(input.sosGeneral.map(r=>r.district)).size!==67)
    throw Error('Full original 2022 general result required');
  if(input.cfbDistrictPages.length!==SERVED_2022_NEXT_DISTRICTS.length
    ||new Set(input.cfbDistrictPages.map(x=>x.district)).size!==SERVED_2022_NEXT_DISTRICTS.length
    ||input.cfbDistrictPages.some(p=>p.segmentEndYear!==2022
      ||!SERVED_2022_NEXT_DISTRICTS.includes(p.district as typeof SERVED_2022_NEXT_DISTRICTS[number])
      ||!exactSha(p.htmlSha256??'')||!p.retrievedAt
      ||!['candidate_labels_observed','no_candidate_labels_visible'].includes(p.status)))
    throw Error('Missing or invalid original official CFB 2022 Senate district pages');
  const cohort=deriveCfb2022OriginalSegmentRegistrationSet(input.registrationCheckpoint);
  const ledger=load2022PinnedOriginalViewerRows(input.viewerPsv);
  const targets:Served2022OriginalCeTarget[]=[];
  const selectedSenators:ReturnType<typeof selectServed2022NextOriginalCe>['selectedSenators']=[];
  const skippedDistricts:ReturnType<typeof selectServed2022NextOriginalCe>['skippedDistricts']=[];
  for(const district of SERVED_2022_NEXT_DISTRICTS){
    const candidates=input.sosGeneral.filter(r=>r.district===district).sort((a,b)=>b.voteCount-a.voteCount);
    if(!candidates.length||candidates[0]!.voteCount<=0
      ||(candidates.length>1&&candidates[0]!.voteCount===candidates[1]!.voteCount)){
      skippedDistricts.push({district,reason:'official_unique_general_winner_unresolved'});continue;
    }
    const winner=candidates[0]!;
    const service=validateActualSenateServiceForElection(
      input.official,winner.candidateName,String(district),2022);
    if(service.status!=='verified_senate_service'
      ||!service.serviceForThisElectionFollowingYearVerified
      ||!service.officialName||!service.officialServiceSource){
      skippedDistricts.push({district,reason:'exact_senate_service_in_following_term_unresolved'});continue;
    }
    const page=input.cfbDistrictPages.find(p=>p.district===district)!;
    const matches=page.candidates.filter(c=>matchesCfbRosterLabel(c.candidateDisplayName,winner.candidateName)
      &&cohort.has(c.registrationNumber));
    if(matches.length!==1){
      skippedDistricts.push({district,reason:'single_original_cfb_registration_identity_unresolved'});continue;
    }
    const reg=matches[0]!.registrationNumber,pinned=ledger.get(reg);
    if(!pinned){
      skippedDistricts.push({district,reason:'original_cfb_api_provenance_unresolved'});continue;
    }
    const periods=(['C','E'] as const).filter(p=>pinned.keys.has('22:pcc:'+p+':0:0'));
    if(periods.length===0){
      skippedDistricts.push({district,reason:'no_original_C_or_E_viewer_reference_observed'});continue;
    }
    // Redistricting: an incumbent can be on the 2022 ballot for a NEW district
    // while their 2022 campaign committee PDF still prints an OLD one. Allow
    // only old districts from this exact verified senator's original LRL
    // Senate-service term that overlaps 2022, not any other nearby district.
    const serviceRows=input.official.senators.filter(r=>r.officialName===service.officialName);
    if(serviceRows.length!==1)throw Error('Original official Senate service identity duplicate');
    const previousDistricts=[...new Set(serviceRows[0]!.senateServiceTerms
      .filter(term=>term.startsYear<=2022&&(term.endsYear===null||term.endsYear>=2022))
      .map(term=>Number(term.district))
      .filter(old=>Number.isInteger(old)&&old>=1&&old<=67&&old!==district))].sort((a,b)=>a-b);
    const personTargets=periods.map(period=>{
      const id=reg+':22:pcc:'+period+':0:0';
      if(input.alreadyAuthenticatedReportIds.has(id))throw Error('Previously authenticated PDF double-counted');
      const rule=CFB_2022_CE_RULES[period];
      return {senator:service.officialName!,officialServiceSource:service.officialServiceSource!,
        officialServiceSourceObservedAt:input.official.source.observedAt,
        originalElectionSourceSha256:SERVED_2022_GENERAL_SOURCE_SHA,
        official2022PreviousSenateDistricts:previousDistricts,
        reg,district,period,id,viewerSha:pinned.apiSha,districtPageSha:page.htmlSha256!,
        dueOn:rule.dueOn,expectedPeriodEndOn:rule.coverageEndOn};
    });
    targets.push(...personTargets);
    selectedSenators.push({district,officialName:service.officialName,
      registrationNumber:reg,originalCfbDistrictPageSha256:page.htmlSha256!,
      originalViewerApiSha256:pinned.apiSha});
  }
  if(targets.length>24||targets.length===0 ||new Set(targets.map(t=>t.id)).size!==targets.length
    ||new Set(selectedSenators.map(t=>t.registrationNumber)).size!==selectedSenators.length)
    throw Error('New serving-senator report cohort empty, duplicate or out of bounds');
  return {targets,selectedSenators,skippedDistricts,legalSenateReportDenominator:null};
}

/**
 * Audit the original 2022 PDF without confusing its printed pre-redistricting
 * Senate district with the 2022 SOS election's new district. ALL other exact
 * original first-page checks stay enforced by the existing vetted parser.
 *
 * Do not allow arbitrary nearby districts, a winning opponent's district or
 * a district listed for another member. A unique printed district must match
 * the new SOS district OR this person's own independently proved LRL 2022
 * Senate term. Otherwise HOLD, never assert source proof.
 */
export function auditServed2022RedistrictedOriginalCe(
  target:Served2022OriginalCeTarget,pdf:Cfb2022PdfProofCapture|null,
  calendar:Cfb2022PdfProofCapture|null,error:string|null=null,
){
  const h=pdf?.text.replace(/\\u0000/g,'').replace(/\\s+/g,' ').trim().slice(0,6500)??'';
  const seen=[...h.matchAll(/Senat(?:e|or)\\s+District\\s*:?\\s*(\\d{1,2})\\b/gi)]
    .map(m=>Number(m[1]));
  const unique=[...new Set(seen)];
  const printed=unique.length===1?unique[0]!:null;
  const historic=printed!==null&&printed!==target.district
    &&target.official2022PreviousSenateDistricts.includes(printed);
  const matching=printed!==null&&(printed===target.district||historic);
  const adapted=matching?{...target,district:printed}:target;
  const proof=auditCfb2022OriginalCePdf(adapted,pdf,calendar,error);
  return {...proof,senateDistrict:target.district,
    verifiedOfficialSenator:target.senator,
    originalPdfSinglePrintedSenateDistrict:printed,
    priorOfficial2022SenateServiceDistricts:[...target.official2022PreviousSenateDistricts],
    originalPdfPrintedPreviouslyOfficial2022SenateDistrict:historic,
    originalPdfPrintedDistrictSupportedByOfficialElectionOrLRL:matching,
    originalPdfHeaderIdentityAndPeriodVerified:proof.originalPdfHeaderIdentityAndPeriodVerified&&matching,
    earliestLegalAndFilingBoundOn:matching?proof.earliestLegalAndFilingBoundOn:null,
    status:!matching&&proof.status==='original_version_pdf_header_and_independent_calendar_verified'
      ?'source_pdf_district_not_independently_supported':proof.status};
}
