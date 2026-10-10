/**
 * #864 C: official Minnesota SOS 2025 special Senate PRIMARY election result identity observations.
 * These are post-election results, not pre-vote candidate platform websites.
 */
import { auditSenateSosWebsiteSeedInventory, strictCandidateKey,
  type SenateMembershipExport, type SenateSosSeedManifest } from './sos-senate-historical-candidate-inventory.js';
export const SPECIAL_SENATE_PRIMARY_AUDIT_VERSION='senate-2025-special-primary-candidates-audit-v1' as const;
type PrimarySourceId =
  | 'sos-2025-01-14-sd60-special-primary'
  | 'sos-2025-04-15-sd6-special-primary'
  | 'sos-2025-08-26-sd29-47-special-primary';
type SpecialDistrict = '6' | '29' | '47' | '60';
export interface SpecialPrimarySource {
  id: PrimarySourceId;
  electionOn: string;
  resultDocumentKind: 'official_sos_results_html'|'official_sos_7_field_candidate_lookup_txt';
  officialResultUrl: string;
  candidatesSourceUrl: string;
  officialMediaIndexUrl?: string;
  districts: SpecialDistrict[];
  candidateCount: number;
  originalSourceByteHashVerified: false;
  resultPublicationDateCryptographicallyVerified: false;
}
export interface SpecialPrimaryCandidate {
  sourceId: PrimarySourceId;
  district: SpecialDistrict;
  candidateName: string;
  partyCode: 'R'|'DFL';
  sosCandidateId: string|null;
  sosOfficeId: string|null;
  sourceType: 'sos_seven_field_candidate_lookup' | 'sos_official_primary_result_html';
  originalCampaignWebsite: null;
  actualStatementTextObserved: false;
  originalPageCaptureBeforeElectionVerified: false;
  electionResultIsPreElectionProof: false;
}
export interface SpecialPrimaryManifest {
  schema:'mn-senate-special-primary-candidates-2025-v1';
  sources:SpecialPrimarySource[];
  candidates:SpecialPrimaryCandidate[];
}
/**
 * Optional exact 7-field 2025 SOS candidate table parsed independently from a
 * caller-supplied local copy, without claiming authentication of source bytes.
 * No address/contact fields are accessed.
 */
export function parse2025SenateSpecialCandidateLookup(raw:string) {
  if(Buffer.byteLength(raw,'utf8')>1_000_000)throw new Error('Candidate source exceeds byte limit');
  const candidates:Array<Pick<SpecialPrimaryCandidate,'district'|'candidateName'|'partyCode'|'sosCandidateId'|'sosOfficeId'>>=[];
  for(const line of raw.split(/\r?\n/)){
    if(!line.trim())continue;
    const cells=line.replace(/\r$/,'').split(';');
    if(cells.length!==7 || !/^\d{8}$/.test(cells[0]) || !/^\d{4}$/.test(cells[2])
      || cells[0].slice(0,4)!==cells[2] || cells[4]!=='88'
      || !['R','DFL'].includes(cells[6])
      || !/^State Senator District (29|47)$/.test(cells[3])
      || !/^\d{2}$/.test(cells[5]) || !cells[1].trim()) {
      throw new Error('Invalid 2025 primary candidate source row');
    }
    const district=cells[3].split(' ').at(-1)! as SpecialDistrict;
    if((district==='29'&&cells[2]!=='0149')||(district==='47'&&cells[2]!=='0167'))
      throw new Error('2025 special primary office ID mismatch');
    candidates.push({
      district,candidateName:cells[1].trim(),partyCode:cells[6] as 'R'|'DFL',
      sosCandidateId:cells[0],sosOfficeId:cells[2],
    });
  }
  const ids=new Set(candidates.map(c=>c.sosCandidateId));
  if(ids.size!==candidates.length)throw new Error('Duplicate SOS candidate identifier');
  return candidates.sort((a,b)=>Number(a.district)-Number(b.district)
    ||a.sosCandidateId!.localeCompare(b.sosCandidateId!));
}
function signature(c:Pick<SpecialPrimaryCandidate,'district'|'candidateName'|'partyCode'|'sosCandidateId'|'sosOfficeId'>):string {
  return [c.district,strictCandidateKey(c.candidateName),c.partyCode,c.sosCandidateId,c.sosOfficeId].join('\u0000');
}
export function audit2025SenateSpecialPrimary(
  manifest:SpecialPrimaryManifest,
  websiteSeeds:SenateSosSeedManifest,
  memberships?:readonly SenateMembershipExport[],
  optionalLocalSosPrimaryFile?:string,
) {
  if(manifest.schema!=='mn-senate-special-primary-candidates-2025-v1') throw new Error('Wrong 2025 source manifest schema');
  const sourceMeta=[
    {id:'sos-2025-01-14-sd60-special-primary',date:'2025-01-14',electionId:'177',districts:['60'],count:9,kind:'official_sos_results_html'},
    {id:'sos-2025-04-15-sd6-special-primary',date:'2025-04-15',electionId:'183',districts:['6'],count:9,kind:'official_sos_results_html'},
    {id:'sos-2025-08-26-sd29-47-special-primary',date:'2025-08-26',electionId:'190',districts:['29','47'],count:7,kind:'official_sos_7_field_candidate_lookup_txt'},
  ] as const;
  const sourceIndex=new Map(manifest.sources.map(s=>[s.id,s]));
  if(sourceIndex.size!==3||manifest.sources.length!==3)throw new Error('Three original SOS primary source events required');
  for(const s of sourceMeta){
    const actual=sourceIndex.get(s.id);
    const resultUrl='https://electionresults.sos.mn.gov/Results/Index?ersElectionId='+s.electionId+'&scenario=StateSenate';
    const file=s.id.endsWith('sd29-47-special-primary')?'https://electionresultsfiles.sos.mn.gov/20250826/cand.txt':resultUrl;
    if(!actual || actual.electionOn!==s.date || actual.resultDocumentKind!==s.kind
      || actual.officialResultUrl!==resultUrl || actual.candidatesSourceUrl!==file
      || actual.originalSourceByteHashVerified!==false || actual.resultPublicationDateCryptographicallyVerified!==false
      || JSON.stringify(actual.districts)!==JSON.stringify(s.districts)
      || actual.candidateCount!==s.count
      || (s.electionId==='190'
        ?actual.officialMediaIndexUrl!=='https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=190'
        :actual.officialMediaIndexUrl!==undefined))
      throw new Error('Untrusted or incomplete SOS special primary source metadata');
  }
  const seen=new Set<string>();
  const candidates=manifest.candidates.map(c=>{
    const source=sourceIndex.get(c.sourceId);
    const sourceIsText=source?.resultDocumentKind==='official_sos_7_field_candidate_lookup_txt';
    const key=c.sourceId+':'+c.district+':'+strictCandidateKey(c.candidateName);
    if(!source || !source.districts.includes(c.district)
      ||!c.candidateName.trim() || !['R','DFL'].includes(c.partyCode)
      ||c.sourceType!==(sourceIsText?'sos_seven_field_candidate_lookup':'sos_official_primary_result_html')
      ||c.originalCampaignWebsite!==null ||c.actualStatementTextObserved!==false
      ||c.originalPageCaptureBeforeElectionVerified!==false ||c.electionResultIsPreElectionProof!==false
      ||(sourceIsText
        ?!c.sosCandidateId||!c.sosOfficeId||!/^\d{8}$/.test(c.sosCandidateId)
          ||c.sosCandidateId.slice(0,4)!==c.sosOfficeId
        :c.sosCandidateId!==null ||c.sosOfficeId!==null)
      ||seen.has(key))throw new Error('Invalid or duplicate special primary candidate row');
    seen.add(key);
    const winnerSource=c.district==='60'?'sos-special-2025-60'
      :c.district==='6'?'sos-special-2025-6':'sos-special-2025-29-47';
    const matchingWinner=websiteSeeds.winners.filter(w=>w.sourceId===winnerSource&&w.district===c.district);
    if(matchingWinner.length!==1)throw new Error('Official 2025 winner reference not unique');
    const wasGeneralWinner=strictCandidateKey(matchingWinner[0].candidateName)===strictCandidateKey(c.candidateName);
    const knownPublisherWebsiteLeads=websiteSeeds.websiteLeads.filter(l=>l.electionYear===2025
      &&l.district===c.district &&strictCandidateKey(l.candidateName)===strictCandidateKey(c.candidateName))
      .map(l=>({url:l.url,publisherSourceId:l.sourceId,claimStatus:'discovery_only_no_historical_site_capture' as const}));
    return {
      electionOn:source.electionOn,sourceId:c.sourceId,sourceUrl:source.candidatesSourceUrl,
      district:c.district,candidateName:c.candidateName,partyCode:c.partyCode,
      sosCandidateId:c.sosCandidateId,
      exactGeneralElectionWinnerIdentity:wasGeneralWinner,
      publisherCampaignSiteDiscoveryLeads:knownPublisherWebsiteLeads,
      campaignWebsiteFromPrimaryResult:null,verifiedPreVoteIssueStatements:0,
      independentlyVerifiedCampaignSitePublicBy:null,
    };
  }).sort((a,b)=>a.electionOn.localeCompare(b.electionOn)
    ||Number(a.district)-Number(b.district) || a.candidateName.localeCompare(b.candidateName));
  for(const meta of sourceMeta){
    if(candidates.filter(c=>c.sourceId===meta.id).length!==meta.count)
      throw new Error('Source-to-primary roster candidate count mismatch');
  }
  if(new Set(candidates.map(c=>c.district)).size!==4)
    throw new Error('Expected four distinct 2025 Senate special districts');
  const f2025=websiteSeeds.filedCandidates.filter(f=>['sos-filed-2025-60','sos-filed-2025-6'].includes(f.sourceId));
  const specialFileListOnly=f2025.filter(f=>!candidates.some(c=>c.district===f.district
    &&strictCandidateKey(c.candidateName)===strictCandidateKey(f.candidateName)))
    .map(f=>({name:f.candidateName,district:f.district,sourceId:f.sourceId,
      primaryResultAbsenceInterpretation:'unknown_not_withdrawal_or_missing_website'}));
  const primaryNotInKnownFiledLists=candidates.filter(c=>['6','60'].includes(c.district)
    &&!f2025.some(f=>f.district===c.district&&strictCandidateKey(f.candidateName)===strictCandidateKey(c.candidateName)))
    .map(c=>({name:c.candidateName,district:c.district,sourceId:c.sourceId}));
  let independentFileReconciliation:null|{exactCandidateIdNamePartyMatch:boolean;compared:number;provesOriginalSourceBytes:boolean}=null;
  if(optionalLocalSosPrimaryFile!==undefined){
    const local=parse2025SenateSpecialCandidateLookup(optionalLocalSosPrimaryFile);
    const manifestTxt=manifest.candidates.filter(c=>c.sourceType==='sos_seven_field_candidate_lookup');
    if(JSON.stringify(local.map(signature))!==JSON.stringify(manifestTxt.sort((a,b)=>
      Number(a.district)-Number(b.district)||a.sosCandidateId!.localeCompare(b.sosCandidateId!)).map(signature)))
      throw new Error('Local SOS candidate text does not exactly match pinned 2025 original identity observations');
    independentFileReconciliation={exactCandidateIdNamePartyMatch:true,compared:local.length,provesOriginalSourceBytes:false};
  }
  // Reuse strict winner/owner checks to allow a separately authorized SELECT-only export.
  const membershipAudit=auditSenateSosWebsiteSeedInventory(websiteSeeds,memberships);
  const priorities=membershipAudit.membershipPriorities.filter(m=>m.sessionSlug==='2025-2026')
    .map(m=>{
      const matches=candidates.filter(c=>c.district===m.district&&strictCandidateKey(c.candidateName)===strictCandidateKey(m.senatorName));
      return {...m,specialPrimarySourceIds:matches.map(c=>c.sourceId),specialPrimaryIdentityMatchOnly:matches.length===1,
        originalCampaignWebsiteByPrimaryResult:null,historicalCampaignStatementPromoted:false};
    });
  return {
    schema:SPECIAL_SENATE_PRIMARY_AUDIT_VERSION,
    scope:{calendarYear:2025,chamber:'senate',noNetwork:true,noProductionDbRead:true,noProductionDbWrite:true,
      officialFiledCandidateUniverseComplete:false,sourceOriginalBytesIndependentlyAuthenticated:false,
      postElectionResultsAreNotPreVoteEvidence:true,preVoteCampaignIssuePositionsVerified:false},
    counts:{
      sourceElections:manifest.sources.length,districts:4,primaryCandidatesObserved:candidates.length,
      candidatesByDistrict:Object.fromEntries(['6','29','47','60'].map(d=>[d,candidates.filter(c=>c.district===d).length])),
      exactEventualGeneralWinnerIdentities:candidates.filter(c=>c.exactGeneralElectionWinnerIdentity).length,
      otherPrimaryCandidateObservations:candidates.filter(c=>!c.exactGeneralElectionWinnerIdentity).length,
      overlappingKnownFiledCandidates:f2025.length-specialFileListOnly.length,
      filedNamesNotSeenInPrimaryResults:specialFileListOnly.length,
      primaryNamesNotSeenInAvailableFiledLists:primaryNotInKnownFiledLists.length,
      specialPrimaryPublisherWebsiteLeads:candidates.reduce((n,c)=>n+c.publisherCampaignSiteDiscoveryLeads.length,0),
      memberRowsProvided:priorities.length,
      zeroCampaignPositionMemberRows:memberships?priorities.filter(m=>m.recordedIssuePositionItems===0).length:null,
    },
    originalSources:manifest.sources,
    primaryCandidateObservations:candidates,
    officialSpecialFiledCandidateNamesNotInPrimaryResult:specialFileListOnly,
    primaryCandidateNamesNotInExistingOfficialFilerList:primaryNotInKnownFiledLists,
    membershipPriorities:priorities,
    localCandTextIdentityCheck:independentFileReconciliation,
    warnings:[
      'An election-result publication cannot establish a pre-primary or pre-general campaign statement public-by date.',
      'The January and April 2025 HTML race results have candidate identities but no website field or SOS candidate ID.',
      'The August 2025 SOS 7-column cand.txt has candidate IDs and party, not campaign websites.',
      'Divergent filing-list/primary-result sets are reportable gaps; neither nonparticipation nor withdrawal is automatically inferred.',
      'All six previously recovered publisher URL leads remain discovery-only; they do not supply campaign-website historical publication proof.',
      'The 2025-26 session is scoped to calendar-year 2025 for historical statements; no 2026 site snapshot may be backdated.',
    ],
  };
}
