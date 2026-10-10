/**
 * #864 C: offline SOS seven-column primary ballot candidate observations.
 * Post-election candidate identities never imply pre-election campaign websites.
 */
import { createHash } from 'node:crypto';
import { auditSenateSosWebsiteSeedInventory, strictCandidateKey, type SenateMembershipExport, type SenateSosSeedManifest } from './sos-senate-historical-candidate-inventory.js';

export const SENATE_PRIMARY_BALLOT_AUDIT_VERSION = 'senate-primary-ballot-identity-audit-v1' as const;
export type PrimarySourceId = 'sos-2022-08-09-senate-primary-candidates' | 'sos-2024-08-13-sd45-primary-candidates';
export interface PrimaryBallotSource {
  id: PrimarySourceId;
  year: number;
  electionDate: string;
  electionType: string;
  publisher: string;
  officialMediaIndexUrl: string;
  officialPublishedCandidateRosterUrl: string;
  officialCandidateTableSchemaUrl: string;
  primaryMirrorRepo: string;
  mirrorImmutableCommit: string;
  mirrorBlobGitSha1: string;
  mirrorRawUrl: string;
  mirrorFieldCount: 7;
  containsCampaignWebsiteField: false;
  officialFileBytesCryptographicallyVerifiedInThisRun: false;
  originalSOSCampaignFilingExport: false;
  observations: number;
  distinctSenateDistricts: number;
}
export interface PrimaryBallotCandidate {
  sourceId: PrimarySourceId;
  district: string;
  candidateName: string;
  partyCode: string;
  sosCandidateId: string;
  sosOfficeId: string;
  recordType: 'primary_ballot_candidate_observation_only';
  campaignWebsite: null;
  historicalPlatformTextProof: false;
  sourceOfficialOriginalBytesVerified: false;
}
export interface PrimaryBallotManifest {
  schema: 'mn-senate-primary-ballot-candidate-observations-2022-24-v1';
  sources: PrimaryBallotSource[];
  candidates: PrimaryBallotCandidate[];
}
export function parseSosSenateElectionCandidateRoster(
  raw: string,
  metadata: { sourceId: PrimarySourceId; year: 2022 | 2024 },
) {
  if ((metadata.year===2022? 'sos-2022-08-09-senate-primary-candidates' :
    'sos-2024-08-13-sd45-primary-candidates') !== metadata.sourceId)
    throw new Error('Source/election-year identity mismatch');
  if (Buffer.byteLength(raw, 'utf8') > 10_000_000) throw new Error('Candidate roster size limit exceeded');
  const originalLocalSha256 = createHash('sha256').update(raw, 'utf8').digest('hex');
  const candidates: PrimaryBallotCandidate[] = [];
  let rejectedInvalidSenateLines = 0;
  let nonSenateLines = 0;
  for(const line of raw.split(/\r?\n/)) {
    if(!line.trim())continue;
    const fields=line.replace(/\r$/,'').split(';');
    if(!/^State\s+Senator\s+District\b/i.test(fields[3]??'')) {
      nonSenateLines++;
      continue;
    }
    // Seven-column cand.txt contains NO website field. Reject mistaken 21-field
    // CandTbl input, which may contain campaign phones and residence addresses.
    if(fields.length!==7 || !/^\d{8}$/.test(fields[0])
      || !/^\d{4}$/.test(fields[2]) || fields[0].slice(0,4)!==fields[2]
      || fields[4]!=='88' || !/^[0-9]{2}$/.test(fields[5])
      || !/^State Senator District [0-9]{1,2}$/.test(fields[3])
      || !fields[1].trim() || !fields[6].trim() || !/^[A-Za-z0-9]{1,8}$/.test(fields[6].trim())
      || !/^[1-9]\d?$/.test(String(Number(fields[3].split(' ').at(-1))))
      || Number(fields[3].split(' ').at(-1))>67) {
      rejectedInvalidSenateLines++;
      continue;
    }
    candidates.push({
      sourceId:metadata.sourceId, district:String(Number(fields[3].split(' ').at(-1))),
      candidateName:fields[1].trim(),partyCode:fields[6].trim(),
      sosCandidateId:fields[0],sosOfficeId:fields[2],
      recordType:'primary_ballot_candidate_observation_only',
      campaignWebsite:null,historicalPlatformTextProof:false,
      sourceOfficialOriginalBytesVerified:false,
    });
  }
  const ids=new Set<string>();
  for(const c of candidates){
    if(ids.has(c.sosCandidateId)) throw new Error('Duplicate statewide Senate primary candidate ID: '+c.sosCandidateId);
    ids.add(c.sosCandidateId);
  }
  candidates.sort((a,b)=>Number(a.district)-Number(b.district)||a.sosCandidateId.localeCompare(b.sosCandidateId));
  return {originalLocalSha256,candidates,rejectedInvalidSenateLines,nonSenateLines,
    officialBytesAuthenticated:false,independentPreElectionPublicationProof:false} as const;
}
function district(value:string):string|null {
  if(!/^\d{1,2}$/.test(value))return null;
  const n=Number(value);
  return n>=1&&n<=67?String(n):null;
}
function validateAndGroup(manifest:PrimaryBallotManifest) {
  if(manifest.schema!=='mn-senate-primary-ballot-candidate-observations-2022-24-v1')
    throw new Error('Unrecognized primary-ballot schema');
  const sources=new Map<string,PrimaryBallotSource>();
  for(const s of manifest.sources){
    const date=s.year===2022?'2022-08-09':s.year===2024?'2024-08-13':null;
    const mediaId=s.year===2022?'148':'169';
    const urlDate=s.year===2022?'20220809':'20240813';
    const expectedId=s.year===2022?'sos-2022-08-09-senate-primary-candidates':
      s.year===2024?'sos-2024-08-13-sd45-primary-candidates':null;
    const expectedBlob=s.year===2022?'bb16cbfdf6b91e2b20e2c6882b0bfc57a40a0fe3':
      s.year===2024?'e7a86254c0d3ea1eead252f1f350f13e0919c190':null;
    const expectedPath='data/source/elections/primary-results/minnesota/'+s.year+'/candidates.txt';
    if(!date||s.id!==expectedId||s.electionDate!==date||s.publisher!=='Minnesota Secretary of State'
      || s.officialPublishedCandidateRosterUrl!=='https://electionresultsfiles.sos.mn.gov/'+urlDate+'/cand.txt'
      || s.officialMediaIndexUrl!=='https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId='+mediaId
      || s.mirrorFieldCount!==7 || s.containsCampaignWebsiteField!==false
      || s.officialFileBytesCryptographicallyVerifiedInThisRun!==false
      || s.originalSOSCampaignFilingExport!==false
      || s.primaryMirrorRepo!=='PatrickFanella/left-field'
      || s.mirrorImmutableCommit!=='c0f0b78eda7564532d4c94f8338b8b06ca2a603f'
      || s.mirrorBlobGitSha1!==expectedBlob
      || s.mirrorRawUrl!=='https://raw.githubusercontent.com/'+s.primaryMirrorRepo+'/'+s.mirrorImmutableCommit+'/'+expectedPath
      || sources.has(s.id)) throw new Error('Primary source provenance fail-closed: '+s.id);
    sources.set(s.id,s);
  }
  if(sources.size!==2 ||
    !sources.has('sos-2022-08-09-senate-primary-candidates') ||
    !sources.has('sos-2024-08-13-sd45-primary-candidates'))
    throw new Error('Expected exactly two pinned source snapshots');
  const recordsBySource=new Map<string,PrimaryBallotCandidate[]>();
  const ids=new Set<string>();
  const names=new Set<string>();
  for(const c of manifest.candidates){
    const src=sources.get(c.sourceId);
    const nd=district(c.district);
    if(!src || !nd || c.district!==nd || (src.year===2024&&c.district!=='45')
      || !c.candidateName.trim() || !/^\d{8}$/.test(c.sosCandidateId)
      || !/^\d{4}$/.test(c.sosOfficeId) || c.sosCandidateId.slice(0,4)!==c.sosOfficeId
      || !/^[A-Za-z0-9]{1,8}$/.test(c.partyCode)
      || c.recordType!=='primary_ballot_candidate_observation_only' || c.campaignWebsite!==null
      || c.historicalPlatformTextProof!==false || c.sourceOfficialOriginalBytesVerified!==false)
      throw new Error('Invalid primary candidate record; cannot claim issue-position source');
    const key=c.sourceId+':'+c.sosCandidateId;
    const nameKey=c.sourceId+':'+c.district+':'+strictCandidateKey(c.candidateName);
    if(ids.has(key)||names.has(nameKey)) throw new Error('Duplicate candidate identity in primary source');
    ids.add(key); names.add(nameKey);
    const rows=recordsBySource.get(c.sourceId)??[];
    rows.push(c); recordsBySource.set(c.sourceId,rows);
  }
  for(const source of sources.values()){
    const rows=recordsBySource.get(source.id)??[];
    if(rows.length!==source.observations
      ||new Set(rows.map(r=>r.district)).size!==source.distinctSenateDistricts)
      throw new Error('Manifest primary source counts do not reconcile');
  }
  return {sources,recordsBySource};
}
export function auditSenatePrimaryBallotObservations(
  primary:PrimaryBallotManifest,
  winnerManifest:SenateSosSeedManifest,
  memberships?:readonly SenateMembershipExport[],
) {
  const {sources,recordsBySource}=validateAndGroup(primary);
  const base=auditSenateSosWebsiteSeedInventory(winnerManifest,memberships);
  const contenders=primary.candidates.map(c=>{
    const src=sources.get(c.sourceId)!;
    const electionWinnerSource=src.year===2022?'sos-general-2022':'sos-special-2024-45';
    const winners=winnerManifest.winners.filter(w=>w.sourceId===electionWinnerSource&&w.district===c.district);
    if(winners.length!==1)throw new Error('Primary district lacks exactly one independently referenced general winner');
    return {
      sourceId:c.sourceId,electionYear:src.year,electionDate:src.electionDate,
      district:c.district,candidateName:c.candidateName,partyCode:c.partyCode,
      sosCandidateId:c.sosCandidateId,
      isExactSameDistrictGeneralElectionWinner:strictCandidateKey(winners[0].candidateName)===strictCandidateKey(c.candidateName),
      campaignWebsite:null,historicalPlatformTextProof:false,
      publicBeforeGeneralElection:null,
      identitySourceUrl:src.officialPublishedCandidateRosterUrl,
      sourceOriginalByteHashVerified:false,
    };
  }).sort((a,b)=>a.electionYear-b.electionYear||Number(a.district)-Number(b.district)||a.candidateName.localeCompare(b.candidateName));
  const candidateLeads=base.membershipPriorities.map(m=>{
    const allowed=m.sessionSlug==='2023-2024'
      ? new Set(['sos-2022-08-09-senate-primary-candidates'])
      :m.sessionSlug==='2025-2026'
        ?new Set(['sos-2022-08-09-senate-primary-candidates','sos-2024-08-13-sd45-primary-candidates'])
        :new Set<string>();
    const hit=contenders.filter(c=>allowed.has(c.sourceId)
      && c.district===m.district && strictCandidateKey(c.candidateName)===strictCandidateKey(m.senatorName));
    return {...m,primaryBallotCandidateSourceIds:hit.map(c=>c.sourceId).sort(),
      primaryBallotCandidateIds:hit.map(c=>c.sosCandidateId).sort(),
      identityNeedsMembershipTermReconciliation:true,
      websiteEvidenceGainedFromPrimaryList:false};
  });
  const other=contenders.filter(c=>!c.isExactSameDistrictGeneralElectionWinner);
  const matching=contenders.filter(c=>c.isExactSameDistrictGeneralElectionWinner);
  return {
    schema:SENATE_PRIMARY_BALLOT_AUDIT_VERSION,
    scope:{
      historicalCalendarYears:[2021,2022,2023,2024,2025],
      noNetwork:true,noProductionReads:true,noProductionWrites:true,
      originalGovernmentCandidateFilesNotByteAuthenticated:true,
      primaryBallotResultsAreNotFilingUniverse:true,primaryBallotResultsAreNotCampaignWebsiteEvidence:true,
      historicalSiteAvailabilityCertified:false,issueStatementEvidenceCertified:false,
    },
    counts:{
      sourceSnapshots:primary.sources.length,
      observations:contenders.length,
      senatePrimary2022:recordsBySource.get('sos-2022-08-09-senate-primary-candidates')?.length??0,
      senatePrimary2024:recordsBySource.get('sos-2024-08-13-sd45-primary-candidates')?.length??0,
      observed2022PrimaryDistricts:sources.get('sos-2022-08-09-senate-primary-candidates')!.distinctSenateDistricts,
      totalSenateDistricts:67,
      observed2024SpecialPrimaryDistricts:sources.get('sos-2024-08-13-sd45-primary-candidates')!.distinctSenateDistricts,
      exactGeneralWinnerIdentitiesPresentInThesePrimaryFiles:matching.length,
      otherCandidateObservations:other.length,
      suppliedMemberRows:base.counts.membershipRowsProvided,
      zeroRecordedCampaignPositionsMemberRows:base.counts.zeroRecordedPositionMemberships,
    },
    sources:[...sources.values()].sort((a,b)=>a.year-b.year),
    otherCandidateResearchLeads:other,
    knownPrimaryWinnerIdentityObservations:matching,
    prioritizedMemberships:candidateLeads,
    warnings:[
      'Only contested 2022 primary ballot races appear here; unopposed primary/other filers are not covered.',
      'A general-election nominee who lost November can appear among other candidate observations; those rows are not necessarily losing primary candidates.',
      '2024 source covers Senate SD45 special primary only; it is not a 2024 statewide Senate election.',
      '2020 primary, 2020 and 2022 general ballot losers, withdrawn filers, and 2025 special-primary filing universes remain unreconciled.',
      'The pinned GitHub research copies correspond to SOS layout but have not been independently authenticated byte-for-byte against original government source downloads.',
      'Post-election SOS result snapshots do not prove candidate website existence, position authorship, or pre-election availability.',
      'Do not attribute an opponent or losing candidate issue position to the later elected senator.',
      'Live 2026 SOS filing URLs cannot be backdated to 2020–2025.',
    ],
  };
}
