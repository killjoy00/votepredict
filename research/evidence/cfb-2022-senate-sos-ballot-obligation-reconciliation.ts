/**
 * Issue #864, parallel track 2. Independently discovered official Minnesota
 * Secretary of State 2022 general and contested-party primary Senate candidate
 * vote/result rows, cross-reconciled to 67 official CFB 2022 election-segment
 * Senate candidate-roster page registrations. This proves a ballot/election
 * participation PREDICATE only, NOT 2022 original campaign finance report
 * legal obligation, filing, nonfiler, or historical registered activity.
 *
 * The state primary results file enumerates contested primary races only;
 * its absence is never evidence that a candidate was not in the election.
 */
import { createHash } from 'node:crypto';

export const CFB_SOS_2022_SENATE_RECONCILIATION_VERSION =
  'cfb-sos-2022-senate-candidate-general-and-contested-primary-2022-ballot-crosscheck-v1' as const;
export const SOS_2022_OFFICIAL_SENATE_FILES = {
  general:'https://electionresultsfiles.sos.mn.gov/20221108/stsenate.txt',
  primary:'https://electionresultsfiles.sos.mn.gov/20220809/stsenate.txt',
} as const;
export interface SosSenate2022Result {
  election:'general'|'primary'; district:number;
  candidateName:string; party:string; voteCount:number; resultsRowId:string;
}
export interface CfbSenate2022Candidate {
  district:number; registrationNumber:string; candidateName:string;
}
function safeName(value:string):boolean{
  return typeof value==='string' && value.trim().length>=3 && value.trim().length<160
    && !/[\n\r|<>]/.test(value);
}
function normalizeWords(name:string):string[] {
  return name.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\[[^\]]*\]|\([^)]*\)/g,' ')
    .replace(/[’']/g,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
}
function candidatePersonKey(displayName:string, cfbReversed:boolean):string|null {
  if(!safeName(displayName))return null;
  const parts=displayName.split(',');
  if(cfbReversed && parts.length!==2)return null;
  const family=cfbReversed ? normalizeWords(parts[0]!) : normalizeWords(displayName);
  const given=cfbReversed ? normalizeWords(parts[1]!) : family;
  const first=given[0],last=cfbReversed?family[0]:family[family.length-1];
  return first&&last ? first+'|'+last : null;
}

export function parseSos2022SenateElectionResults(input:{
  election:'general'|'primary';sourceUrl:string;text:string;
}):SosSenate2022Result[] {
  if(input.sourceUrl!==SOS_2022_OFFICIAL_SENATE_FILES[input.election])
    throw Error('Unknown or out-of-year official Secretary of State Senate results URL');
  if(input.text.length<500 || input.text.length>150_000)throw Error('SOS 2022 Senate results body missing or too large');
  const rows:SosSenate2022Result[]=[];
  const keys=new Set<string>();
  for(const rawLine of input.text.replace(/\r/g,'').trim().split('\n')){
    if(!rawLine.trim())continue;
    const fields=rawLine.split(';');
    if(fields.length!==16 || fields[0]!=='MN' || fields[1]!=='' || fields[2]!=='') {
      throw Error('Invalid SOS 2022 Senate results row layout');
    }
    const district=Number(fields[5]);
    const label=fields[4]??'';
    const candidateName=(fields[7]??'').trim();
    const party=(fields[10]??'').trim();
    const votes=Number(fields[13]);
    const resultsRowId=fields[6]??'';
    if(!Number.isInteger(district)||district<1||district>67
      || label!=='State Senator District '+district
      || !/^\d{4}$/.test(fields[3]??'')
      || !/^\d{4}$/.test(resultsRowId)
      || !safeName(candidateName)
      || !/^[A-Z]{1,5}$/.test(party)
      || !Number.isInteger(votes)||votes<0) {
      throw Error('SOS Senate election/district/candidate/vote identity malformed');
    }
    if(candidateName.toUpperCase()==='WRITE-IN'||party==='WI'){
      if(input.election==='primary') throw Error('Unexpected primary Senate WRITE-IN result row');
      continue;
    }
    const key=district+':'+party+':'+resultsRowId;
    if(keys.has(key))throw Error('Duplicate SOS result identity');
    keys.add(key);
    rows.push({election:input.election,district,candidateName,party,voteCount:votes,resultsRowId});
  }
  if(rows.length<15 || rows.length>450)throw Error('SOS 2022 Senate candidate results count outside source bounds');
  const districts=new Set(rows.map(r=>r.district));
  if(input.election==='general'&&districts.size!==67)
    throw Error('2022 SOS general Senate results missing any of 67 districts');
  if(input.election==='primary'&&(districts.size<10||districts.size>=67))
    throw Error('2022 SOS contested primary source shape unexpected');
  return rows.sort((a,b)=>a.district-b.district
    || a.candidateName.localeCompare(b.candidateName)||a.party.localeCompare(b.party));
}

export function deriveCfb2022OriginalSegmentRegistrationSet(
  checkpoint: {
    observedCandidateRegistrationIndex:{
      registrationIdsCsv:string;segmentMembershipMaskHex:string;distinctRegistrations:number;
    };
    provenance:{runId:number;rawJsonSha256:string};
  },
):Set<string>{
  const i=checkpoint.observedCandidateRegistrationIndex;
  const ids=i.registrationIdsCsv.split(',');
  const masks=i.segmentMembershipMaskHex;
  if(checkpoint.provenance.runId!==38081628130
    || checkpoint.provenance.rawJsonSha256!=='83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04'
    || ids.length!==494||masks.length!==494||i.distinctRegistrations!==494
    || new Set(ids).size!==494||!/^[0-9a-f]{494}$/.test(masks))throw Error('CFB source 494-ID index invalid');
  const regs=new Set(ids.filter((_v,n)=>(Number.parseInt(masks[n]!,16)&2)!==0));
  if(regs.size!==270)throw Error('CFB source 2022 Senate 270-registration cohort drift');
  return regs;
}

export function reconcileCfb2022SenateBallotPredicates(input:{
  cfbCandidates:readonly CfbSenate2022Candidate[];
  sourcePinnedOriginal2022Registrations:Set<string>;
  sosPrimary:readonly SosSenate2022Result[];
  sosGeneral:readonly SosSenate2022Result[];
}){
  const regs=new Set<string>();
  const names=new Set<string>();
  for(const c of input.cfbCandidates){
    if(!Number.isInteger(c.district)||c.district<1||c.district>67
      || !/^\d{3,8}$/.test(c.registrationNumber)||!safeName(c.candidateName)
      || regs.has(c.registrationNumber))throw Error('CFB original 2022 Senate roster candidate invalid or repeated');
    regs.add(c.registrationNumber);
    names.add(c.candidateName);
  }
  if(input.cfbCandidates.length!==270||regs.size!==270||input.sourcePinnedOriginal2022Registrations.size!==270
    || [...regs].some(id=>!input.sourcePinnedOriginal2022Registrations.has(id))) {
    throw Error('Re-acquired CFB 2022 roster does not match original 270 registered viewer IDs');
  }
  const rowMatch=(c:CfbSenate2022Candidate,official:readonly SosSenate2022Result[])=>{
    const key=candidatePersonKey(c.candidateName,true);
    if(!key) return {state:'unresolved_cfb_name_shape',rows:[] as SosSenate2022Result[]};
    const sameDistrict=official.filter(s=>s.district===c.district
      && candidatePersonKey(s.candidateName,false)===key);
    return {state:sameDistrict.length===1?'exact_first_and_last_name_and_district'
      :sameDistrict.length===0?'not_matched_by_safe_name_and_district':'ambiguous_multiple_results',
      rows:sameDistrict};
  };
  const rows=input.cfbCandidates.map(c=>{
    const primary=rowMatch(c,input.sosPrimary),general=rowMatch(c,input.sosGeneral);
    return {
      cfbRegistrationNumber:c.registrationNumber,
      senateDistrict:c.district,
      cfbCandidateName:c.candidateName,
      primarySourceMatchStatus:primary.state,
      primaryCandidateName:primary.rows.length===1?primary.rows[0]!.candidateName:null,
      primaryParty:primary.rows.length===1?primary.rows[0]!.party:null,
      generalSourceMatchStatus:general.state,
      generalCandidateName:general.rows.length===1?general.rows[0]!.candidateName:null,
      generalParty:general.rows.length===1?general.rows[0]!.party:null,
      original2022SenateRegistrationSourcePinVerified:true,
      exact2022GeneralBallotParticipationObserved:general.state==='exact_first_and_last_name_and_district',
      contested2022PrimaryResultObserved:primary.state==='exact_first_and_last_name_and_district',
      wasLegallyRegisteredOnRelevant2022ReportDueDate:null,
      independent2022CommitteeTerminationHistoryProved:false,
      actual2022CampaignReportFilingVerified:false,
      statutoryPrePrimaryReportingObligationVerified:false,
      statutoryPreGeneralReportingObligationVerified:false,
      isMissingFromCfbReportRecords:null,
    };
  }).sort((a,b)=>a.senateDistrict-b.senateDistrict||a.cfbRegistrationNumber.localeCompare(b.cfbRegistrationNumber));
  const matchedGeneral=rows.filter(r=>r.exact2022GeneralBallotParticipationObserved);
  const matchedPrimary=rows.filter(r=>r.contested2022PrimaryResultObserved);
  const sosGeneralUnmatched=input.sosGeneral.filter(s=>!rows.some(c=>c.senateDistrict===s.district
    && c.generalSourceMatchStatus==='exact_first_and_last_name_and_district'
    && c.generalCandidateName===s.candidateName&&c.generalParty===s.party));
  const sosPrimaryUnmatched=input.sosPrimary.filter(s=>!rows.some(c=>c.senateDistrict===s.district
    && c.primarySourceMatchStatus==='exact_first_and_last_name_and_district'
    && c.primaryCandidateName===s.candidateName&&c.primaryParty===s.party));
  return {
    schemaVersion:CFB_SOS_2022_SENATE_RECONCILIATION_VERSION,
    sourceScope:{
      originalCfbCandidateViewerSegment:2022,
      originalCFBSenateDistrictPages:67,
      cfbRegistrationsReobservedAndPinned:270,
      officialSosGeneralDate:'2022-11-08',
      officialSosPrimaryDate:'2022-08-09',
      primaryResultsOnlyIncludeContestedBallotRaces:true,
      resultsAreElectionHistoricalSourcesButNewlyRetrievedIn2026:true,
      sosGeneralResultsAreEvidenceOf2022BallotNotHistoric2022PubByOfCfbReport:true,
    },
    byCandidate:rows,
    sourceCounts:{
      sosGeneralCandidatesWithoutWriteins:input.sosGeneral.length,
      sosPrimaryCandidateResultsContestedOnly:input.sosPrimary.length,
      generalBallotCandidateNameDistrictMatchesToCfb2022Viewer:matchedGeneral.length,
      contestedPrimaryNameDistrictMatchesToCfb2022Viewer:matchedPrimary.length,
      cfbRosterCandidatesWithoutSafeGeneralMatch:270-matchedGeneral.length,
      cfbRosterCandidatesWithoutSafeContestedPrimaryMatch:270-matchedPrimary.length,
      sosGeneralCandidateRecordsWithoutSafeCfbMatch:sosGeneralUnmatched.length,
      sosContestedPrimaryRecordsWithoutSafeCfbMatch:sosPrimaryUnmatched.length,
      exactCandidate2022RegistrationDateAndTerminationEpisodesEstablished:0,
      '2022StatutoryPrePrimaryFilingsLegallyOwedCount':null,
      '2022StatutoryPreGeneralFilingsLegallyOwedCount':null,
      '2022StatutoryYearEndFilingsLegallyOwedCount':null,
      '2022OriginalFilingReportsAuthenticatedInThisAudit':0,
      '2022NonfilersProved':null,
      completeSenate2021to2025StatutoryDenominator:null,
    },
    unmatchedSosGeneralCandidateRecords:sosGeneralUnmatched.map(s=>({
      senateDistrict:s.district,candidateName:s.candidateName,party:s.party,
      missingFromCfbViewerNotProofOfNoFiling:true,
    })),
    unmatchedSosContestedPrimaryRecords:sosPrimaryUnmatched.map(s=>({
      senateDistrict:s.district,candidateName:s.candidateName,party:s.party,
      missingFromCfbViewerNotProofOfNoFiling:true,
    })),
    safeguards:{
      noFuzzyCandidateJoins:true,
      nameOnlyWithoutDistrictNeverSufficient:true,
      generalResultAbsenceIsProofCandidateDidNotFile:false,
      primaryResultAbsenceIsProofCandidateDidNotFile:false,
      current2026CfbRegistrationListingProvesHistoricalTermination:false,
      noContactDonorTransactionOrHomeAddressStored:true,
      noProductionDatabaseReadOrWrite:true,
      noModelsForecastsOrServingChanged:true,
      issue864RemainsOpen:true,
    },
  };
}

export function cfbSos2022SourceSha256(bytes:Uint8Array):string{
  return createHash('sha256').update(bytes).digest('hex');
}
