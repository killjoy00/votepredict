/**
 * #864: 2022 domain-wide Wayback recovery ONLY for independently documented
 * Minnesota senators Nicole Mitchell, Rob Kupec, Michael Kreun.
 *
 * The prior exact-URL 2022 Wayback/CDX+CC probe returned 0 pages for these
 * three. Query the historical DOMAIN rather than silently conclude the
 * candidate had no online 2022 positions. Independent original index SHA1
 * and original replay bytes must match before dating a page to 2022.
 *
 * Never treat old web domains as old bill positions without human review.
 * Never treat an observed 2026 page as 2022 public-by.
 */
import targets from '../../data/evaluation/senate-2022-verified-served-domain-archive-targets-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from './wayback.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory} from './senate-official-ever-served-directory.js';

export const HISTORICAL_SENATOR_2022_DOMAIN_ARCHIVE_VERSION='senate-2022-three-actually-served-senators-broad-domain-archive-v1' as const;
export const EXPECTED_DOMAINS={
  mitchell:{candidateName:'Nicole Mitchell',district:'47',domain:'nicolemitchell.org'},
  kupec:{candidateName:'Rob Kupec',district:'4',domain:'kupec4mnsenate.com'},
  kreun:{candidateName:'Michael Kreun',district:'32',domain:'michaelformnsenate.com'},
} as const;
export const GENERAL_CUTOFF_UTC='2022-11-08T00:00:00.000Z';
export const START_UTC='2022-01-01T00:00:00.000Z';
export type SenatorDomainTarget=(typeof targets.targets)[number];
export interface SenatorDomainPreVoteCapture extends WaybackCapture{
  candidateName:string;senateDistrict:string;
  current2026WebsiteClaimNotHistoricalProof:true;
  historicCandidateIssueStanceCertified:false;
}
const exactDomain=(url:string):string=>{
  const parsed=new URL(url);
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password
    ||parsed.port||parsed.hash||parsed.hostname.length>253||parsed.pathname.length>300)
    throw Error('Unsafe original 2022 senator campaign URL');
  return parsed.hostname.toLowerCase().replace(/^www\./,'');
};
export function senatorOnlyDomain2022Targets(official:AuditedOfficialSenateDirectory){
  if(targets.schema!=='mn-2022-ever-served-senate-domain-wide-archive-targets-v1'
    ||targets.scope.onlyLRLVerifiedActuallyServedMNStateSenators!==true
    ||targets.scope.historicalWebsiteFilingDomainVerified!==false
    ||targets.scope.currentFetchProvidesOnlyObservedAtUtc!==true
    ||targets.scope.originalPageTextAvailableDuring2022ProvenBeforeFetching!==false
    ||targets.scope.senators!==3||targets.scope.domainSearches!==3
    ||targets.targets.length!==3)
    throw Error('Unknown or promoted candidate historic website input');
  const used=new Set<string>();
  return targets.targets.map(t=>{
    if(!(t.id in EXPECTED_DOMAINS))throw Error('Unknown person: not independently eligible for senator research');
    const expect=EXPECTED_DOMAINS[t.id as keyof typeof EXPECTED_DOMAINS];
    if(used.has(t.id)||t.candidateName!==expect.candidateName||t.district!==expect.district
      ||t.domain!==expect.domain||exactDomain(t.historicalElectionPageLead)!==t.domain
      ||t.previousExactPathObservedAtUtc.slice(0,10)!=='2026-10-11'
      ||![200,404].includes(t.previousExactPathFetchHttpStatus))
      throw Error('Unexpected senator/district/host or non-dated pre-existing original source');
    used.add(t.id);
    const service=validateActualSenateServiceForElection(official,t.candidateName,t.district,2022);
    if(service.status!=='verified_senate_service'
      ||service.serviceForThisElectionFollowingYearVerified!==true)
      throw Error('A campaign index can only be queried for an independently documented actually-serving Senator');
    return {...t,
      officialServedSenatorName:service.officialName,
      officialLRLServiceTerm:service.term,
      LRLOriginalObservationDateUtc:official.source.observedAt,
      LRLOriginalContentSha256:official.source.sourceBytesSha256,
      officialIdentityProvenFromOriginalLRLBytes:true as const,
    };
  });
}
export function historicalSenatorDomainCdxUrl(domain:string):string{
  if(!Object.values(EXPECTED_DOMAINS).some(t=>t.domain===domain))
    throw Error('Unknown historical senator campaign domain');
  const query=new URLSearchParams({
    url:domain,matchType:'domain',from:'20220101',to:'20221107',output:'json',
    fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',limit:'300',
  });
  return 'https://web.archive.org/cdx/search/cdx?'+query.toString();
}
function domainPathPriority(original:string):number{
  const u=new URL(original);
  const path=u.pathname.toLowerCase();
  if(/\/(?:issue|issues|polic(?:y|ies)|platform|priorit(?:y|ies)|values|positions)(?:\/|$)/.test(path))return 0;
  if(/\/(?:news-events|press|news|updates|about|our-campaign|meet|campaign)(?:\/|$)/.test(path))return 1;
  if(path==='/'||!path)return 2;
  return 3;
}
/** Per source URL keep first and latest *distinct* exact original digest,
 * biased to issue-specific paths and first pre-vote captures. No more than
 * three downloads, and do not claim all URL versions were enumerated. */
export function senatorDomainPreGeneral2022Cdx(
  domain:string,payload:unknown,
):{rankedCandidateRows:SenatorDomainPreVoteCapture[];
  selectedOriginalReplays:SenatorDomainPreVoteCapture[];
  rawCdxResultRows:number;returnedIndexAtCapacity:boolean;
  filteredOutMismatchedDomainOrWrongYear:number;}{
  if(!Object.values(EXPECTED_DOMAINS).some(t=>t.domain===domain))
    throw Error('Unsafe original source domain');
  if(!Array.isArray(payload)||!payload.length||!Array.isArray(payload[0]))
    throw Error('Missing domain-wide 2022 Wayback source-index matrix');
  if(payload.length>301)throw Error('Domain-wide archive query exceeded 300-row bounded sample');
  const data=parseWaybackCdxJson(payload);
  const who=Object.values(EXPECTED_DOMAINS).find(t=>t.domain===domain)!;
  const byCapture=new Set<string>();
  let dropped=0;
  const allowed:SenatorDomainPreVoteCapture[]=[];
  for(const row of data){
    let host:string;
    try{host=exactDomain(row.original);}catch{dropped++;continue;}
    const captured=Date.parse(row.capturedAt);
    const path=new URL(row.original).pathname;
    if(host!==domain||captured<Date.parse(START_UTC)
      ||captured>=Date.parse(GENERAL_CUTOFF_UTC)
      ||!/^[A-Z2-7]{32}$/.test(row.digest)
      ||row.statuscode!=='200'
      ||/\/(?:wp-(?:admin|includes)|admin|login|feed|xmlrpc|api)(?:\/|$)/i.test(path)
      ||/\.(?:jpg|jpeg|png|webp|gif|ico|svg|js|css|woff|ttf|pdf|zip)$/i.test(path)
      ||new URL(row.original).search)
      {dropped++;continue;}
    const key=row.timestamp+'|'+row.digest+'|'+host+path;
    if(byCapture.has(key))continue;
    byCapture.add(key);
    allowed.push({...row,candidateName:who.candidateName,senateDistrict:who.district,
      current2026WebsiteClaimNotHistoricalProof:true,
      historicCandidateIssueStanceCertified:false});
  }
  const byPath=new Map<string,SenatorDomainPreVoteCapture[]>();
  for(const c of allowed){
    const path=new URL(c.original).pathname.replace(/\/+$/,'').toLowerCase();
    byPath.set(path,[...(byPath.get(path)??[]),c]);
  }
  const representative:SenatorDomainPreVoteCapture[]=[];
  for(const values of byPath.values()){
    values.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
    representative.push(values[0]);
    if(values.length>1&&values[0].digest!==values.at(-1)!.digest)
      representative.push(values.at(-1)!);
  }
  representative.sort((a,b)=>domainPathPriority(a.original)-domainPathPriority(b.original)
    ||a.capturedAt.localeCompare(b.capturedAt));
  const usedUrls=new Set<string>(),selected:SenatorDomainPreVoteCapture[]=[];
  for(const item of representative){
    const archiveId=item.timestamp+'|'+item.original+'|'+item.digest;
    if(usedUrls.has(archiveId))continue;
    usedUrls.add(archiveId);
    selected.push(item);
    if(selected.length===3)break;
  }
  return{
    rankedCandidateRows:allowed,
    selectedOriginalReplays:selected,
    rawCdxResultRows:payload.length-1,
    returnedIndexAtCapacity:payload.length>=301,
    filteredOutMismatchedDomainOrWrongYear:dropped,
  };
}
