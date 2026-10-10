/**
 * #864: original public Minnesota SOS 2020/2022 general-election Senate
 * candidate observation census. Results are POST-vote, and cannot identify
 * original filing website fields or pre-vote issue statement dates.
 *
 * Data source columns: official "stsenate.txt" records use 16 semicolon fields
 * (state;...;officeId;office;district;partyCandidateId;name;...;party;...;
 *  totalVotes;percent;raceTotal). Official election "cand.txt" uses 7 columns
 * (fullCandidateId;name;officeId;office;county;partyId;party).
 */
import {createHash} from 'node:crypto';
export const SENATE_HISTORIC_GENERAL_CENSUS_VERSION='senate-official-general-2020-22-original-result-census-v1';
const EXPECTED_SHA={
 '2020':{
  st:'c2937b1fee5ae077603d892adf03c4ce83e2bb2592753680d5bfdeb4aecf7ba5',
  cand:'8a0596d788b651ec27c05aa576bed31a3a51efd83c2cd2ee2ae5fdcc2f02965a',
 },
 '2022':{
  st:'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74',
  cand:'0973d5962a0afc830ac9374c43f70269871a6377d956b552065c0cf06bec3538',
 },
} as const;
export interface OriginalGeneralCandidate {
 electionYear:2020|2022; district:string;candidateName:string;partyCode:string;
 votes:number;officialElectionCandidateId:string;
 generalOutcome:'winner'|'nonwinner';
 sourceEvidenceClass:'postvote_election_result_identity_only';
 campaignWebsiteOriginalSOSFilingField: null;
 campaignIssueStatementPublicByProven:false;
 eligibleForHistoricalPreVoteForecast:false;
}
const sha256=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function parseRows(bytes:Buffer,sizeLimit:number):string[][] {
 if(bytes.length<100||bytes.length>sizeLimit)throw Error('Original SOS election file exceeds expected size or is missing');
 // SOS's 2020/22 downloadable text may contain Windows-1252 single bytes; all
 // relevant ASCII semicolon fields remain identical under latin1 decoding.
 const text=bytes.toString('latin1');
 if(/<\s*(?:html|!doctype|head|body)\b|maintenance in progress/i.test(text.slice(0,2000)))
   throw Error('Received HTML maintenance page, not SOS original candidate/results file');
 return text.replace(/^\ufeff/,'').split(/\r?\n/).filter(x=>x.trim().length>0).map(x=>x.split(';'));
}
const office=(district:string)=>'State Senator District '+district;
function district(value:string){
 if(!/^\d{1,2}$/.test(value)||Number(value)<1||Number(value)>67)
   throw Error('Malformed SOS Senate district identity');
 return String(Number(value));
}
function positiveInteger(raw:string){
 if(!/^\d+$/.test(raw))throw Error('Malformed candidate total in SOS general result');
 const n=Number(raw);
 if(!Number.isSafeInteger(n)||n<0||n>10_000_000)
   throw Error('Out-of-range candidate vote total');
 return n;
}
export function auditSos2020to2022OriginalGeneralCensus(
 year:2020|2022,
 stsenateOriginalBytes:Buffer,
 candidateLookupOriginalBytes:Buffer,
) {
 const digest=EXPECTED_SHA[String(year) as '2020'|'2022'];
 const actual={stsenate:sha256(stsenateOriginalBytes),cand:sha256(candidateLookupOriginalBytes)};
 const referenceMatch=actual.stsenate===digest.st&&actual.cand===digest.cand;
 const result=parseRows(stsenateOriginalBytes,3*1024*1024);
 const lookup=parseRows(candidateLookupOriginalBytes,3*1024*1024);
 const byLookup=new Map<string,string[]>();
 const allLookup=new Set<string>();
 for(const row of lookup){
  if(row.length!==7)throw Error('SOS election candidate lookup must contain exactly seven fields (not historical filing website export)');
  if(!row[3].startsWith('State Senator District '))continue;
  const dist=district(row[3].replace('State Senator District ',''));
  if(row[3]!==office(dist)||!row[0]||!row[2]||!row[1]||!row[6]
    ||row[0].slice(0,4)!==row[2])throw Error('Malformed official election ballot candidate key');
  if(byLookup.has(row[0]))throw Error('Duplicate SOS election candidate lookup ID');
  byLookup.set(row[0],row);
  allLookup.add(dist);
 }
 if(allLookup.size!==67)throw Error('Incomplete election candidate lookup Senate district denominator');
 const byDistrict=new Map<string,OriginalGeneralCandidate[]>();
 const seenCandidateIds=new Set<string>();let writeIns=0;
 for(const row of result){
  if(row.length!==16||row[0]!=='MN'||row[1]||row[2]
    ||!row[4].startsWith('State Senator District '))
    throw Error('Malformed official Senate district result row');
  const dist=district(row[5]);
  if(row[4]!==office(dist)||!/^01\d\d$/.test(row[3])
    ||!row[6]||!row[7]||!row[10])
    throw Error('SOS original result missing district, office, party or candidate');
  const votes=positiveInteger(row[13]);
  if(row[10]==='WI'&&row[7]==='WRITE-IN'){writeIns++;continue;}
  const id=row[3]+row[6];
  if(seenCandidateIds.has(id))throw Error('Duplicate SOS general result candidate ID');
  seenCandidateIds.add(id);
  const candidate=byLookup.get(id);
  if(!candidate||candidate[1]!==row[7]||candidate[2]!==row[3]
    ||candidate[3]!==row[4]||candidate[6]!==row[10])
    throw Error('Official general result candidate does not match independent SOS candidate lookup');
  const item:OriginalGeneralCandidate={
   electionYear:year,district:dist,candidateName:row[7],partyCode:row[10],
   votes,officialElectionCandidateId:id,
   generalOutcome:'nonwinner',sourceEvidenceClass:'postvote_election_result_identity_only',
   campaignWebsiteOriginalSOSFilingField:null,
   campaignIssueStatementPublicByProven:false,eligibleForHistoricalPreVoteForecast:false,
  };
  byDistrict.set(dist,[...(byDistrict.get(dist)??[]),item]);
 }
 if(byDistrict.size!==67||writeIns!==67||byLookup.size!==seenCandidateIds.size)
   throw Error('Historical SOS Senate election general identity universe mismatch');
 const winners:OriginalGeneralCandidate[]=[];const losers:OriginalGeneralCandidate[]=[];
 for(let d=1;d<=67;d++){
  const name=String(d),candidates=byDistrict.get(name);
  if(!candidates?.length)throw Error('Missing Senate general district in official original');
  candidates.sort((a,b)=>b.votes-a.votes||a.candidateName.localeCompare(b.candidateName));
  if(candidates.length>1&&candidates[0].votes===candidates[1].votes)
    throw Error('Cannot infer a unique winner from tied uncanvassed tallies');
  candidates[0].generalOutcome='winner';winners.push(candidates[0]);
  losers.push(...candidates.slice(1));
 }
 const expected=year===2020?{named:146,losing:79}:{named:131,losing:64};
 if(winners.length!==67||losers.length!==expected.losing||seenCandidateIds.size!==expected.named)
   throw Error('Unexpected original SOS 2020/2022 Senate named-candidate denominator');
 return {
  schema:SENATE_HISTORIC_GENERAL_CENSUS_VERSION,
  officialGeneralElectionDate:year===2020?'2020-11-03':'2022-11-08',
  source:{
   stsenateUrl:'https://electionresultsfiles.sos.mn.gov/'+(year===2020?'20201103':'20221108')+'/stsenate.txt',
   candidateLookupUrl:'https://electionresultsfiles.sos.mn.gov/'+(year===2020?'20201103':'20221108')+'/cand.txt',
   originalResultSha256:actual.stsenate,originalCandidateLookupSha256:actual.cand,
   originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence:referenceMatch,
   bothOriginalGovernmentFilesPresentAndStructurallyCrossChecked:true,
   officialResultClass:'post_election_unofficial_result',
   originalSOSFiledCandidateWebsiteFieldVerified:false,
   completeHistoricalFilingUniverseVerified:false,
  },
  totals:{
   senateDistricts:67,uniqueNamedBallotCandidates:seenCandidateIds.size,
   nonWriteinElectionWinnerCandidates:winners.length,
   nonwinningNamedCandidates:losers.length,
   writeInAggregateRows:writeIns,
   districtsWithMultipleNamedCandidates:[...byDistrict.values()].filter(x=>x.length>1).length,
   completeOriginalGeneralBallotCandidateObservations:true,
   certifiedOriginalFiledCandidateUniverse:false,
   certifiedCampaignWebsiteFieldCount:null,
   certifiedHistoricalCampaignIssueStatements:0,
  },
  candidates:[...winners,...losers].sort((a,b)=>
   Number(a.district)-Number(b.district)||b.votes-a.votes),
  limitations:[
   'Original result bytes and separate seven-field candidate lookup agree; neither has historical filing Campaign Website column 15.',
   'Unofficial general results establish post-vote candidate identity only; never a pre-vote feature.',
   'A district may have no nonwinning named opponent, although there is a WRITE-IN aggregate.',
   'The 2020/22 election result roster is not the complete filed candidate, withdrew/primary-only, or source website universe.',
  ],
 };
}
