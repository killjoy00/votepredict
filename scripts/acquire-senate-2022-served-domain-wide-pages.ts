/**
 * Issue #864: actually attempt broader 2022 public Wayback historical domain
 * acquisition for three real Minnesota Senators with no captures from the
 * previous exact URL search. All HTTP sources are observedAt UTC, and a
 * historical public-by date requires captured original bytes + CDX SHA-1.
 *
 * No production, credentials, non-senator research, content publication,
 * automatic policy/stance extraction or model changes.
 */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fetchDatedBoundedPublic,base32Sha1Archive,type PublicReply}
 from './acquire-senate-2022-ever-served-campaign-originals.js';
import {type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
  HISTORICAL_SENATOR_2022_DOMAIN_ARCHIVE_VERSION,
  senatorOnlyDomain2022Targets,historicalSenatorDomainCdxUrl,
  senatorDomainPreGeneral2022Cdx,
} from '../src/evidence/senate-2022-verified-served-domain-archive.js';

const MAX_INDEX_BYTES=1_400_000,MAX_REPLAY_BYTES=2_500_000;
function saveBytes(dir:string,name:string,content:Buffer|null):string|null{
 if(!content||!content.length)return null;
 if(!/^[a-z0-9._-]{1,125}$/.test(name)||name.includes('..'))throw Error('Unsafe original public archive filename');
 writeFileSync(join(dir,name),content,{flag:'wx',mode:0o600});
 return name;
}
function withoutBuffer(reply:PublicReply){
 const {body,...headers}=reply;
 return headers;
}
export async function acquire2022ServedSenatorDomainHistoricalPages(
 outputDir:string,official:AuditedOfficialSenateDirectory,impl:typeof fetch=fetch,
){
 // This gate runs before FIRST network fetch or filesystem write.
 const targets=senatorOnlyDomain2022Targets(official);
 const output=resolve(outputDir);
 if(existsSync(output))throw Error('Refuse overwriting original historical capture output');
 mkdirSync(output,{mode:0o700,recursive:true});
 const results=[];
 for(const target of targets){
  const url=historicalSenatorDomainCdxUrl(target.domain);
  const query=await fetchDatedBoundedPublic(url,MAX_INDEX_BYTES,impl);
  const indexBytes=saveBytes(output,target.id+'-domain-wide-original-cdx.json',
    query.status===200?query.body:null);
  let indexStatus:'http_failed'|'parse_failed'|'parsed_bounded_sample'='http_failed';
  let parsed:ReturnType<typeof senatorDomainPreGeneral2022Cdx>|null=null;
  let parserError:string|null=null;
  if(query.status===200&&query.body){
   try{
     parsed=senatorDomainPreGeneral2022Cdx(target.domain,
       JSON.parse(query.body.toString('utf8')) as unknown);
     indexStatus='parsed_bounded_sample';
   }catch(e){
     indexStatus='parse_failed';
     parserError=e instanceof Error?e.message:'2022 domain-wide CDX index malformed';
   }
  }
  const trials=[];
  for(const [i,row] of (parsed?.selectedOriginalReplays??[]).entries()){
   const reply=await fetchDatedBoundedPublic(row.archiveUrl,MAX_REPLAY_BYTES,impl);
   const digestMatches=Boolean(reply.status===200&&reply.body
    &&base32Sha1Archive(reply.body)===row.digest
    &&(/^text\/(?:html|plain)/i.test(reply.headers.contentType??'')
      ||/^application\/xhtml\+xml/i.test(reply.headers.contentType??'')));
   const name=saveBytes(output,target.id+'-historical-'+row.timestamp+'-'+i+'.html',
     digestMatches?reply.body:null);
   trials.push({
    candidateName:target.candidateName,verifiedSenatorSource:target.officialServedSenatorName,
    originalCapturedSiteUrl:row.original,
    historicalWaybackIndexedCaptureAtUtc:row.capturedAt,
    indexedOriginalPayloadSha1Base32:row.digest,
    remoteArchivedReplayUrl:row.archiveUrl,
    remoteHttp:withoutBuffer(reply),
    originalPageBytesSaved:name,
    archivedPageOriginalBodyVerifiedByIndexDigest:digestMatches,
    archiveCaptureProvesPageTextWasPublicByUtc:digestMatches?row.capturedAt:null,
    originalHtmlSha256:digestMatches?reply.responseBodySha256:null,
    authorFirstPublishedOn:null,
    humanCheckedCampaignIssuePolicyText:false,
    candidateWrittenStatementFound:null,
    senatorIssueStanceAdmittedForForecast:false,
   });
   console.log('SENATE-2022-DOMAIN-ORIGINAL '+JSON.stringify({
    person:target.candidateName,url:row.original,
    capturedAt:row.capturedAt,requestObservedAt:reply.observedAtUtc,
    httpStatus:reply.status,sourceSha256:reply.responseBodySha256,
    originalHistoricallyVerified:digestMatches,
   }));
  }
  const recovered=trials.filter(x=>x.archivedPageOriginalBodyVerifiedByIndexDigest);
  const item={
   candidateName:target.candidateName,district:target.district,
   actualSenateServiceVerified:true,
   officialSenatorServiceSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
   officialLRLSourceObservedAtUtc:target.LRLOriginalObservationDateUtc,
   officialLRLSourceOriginalSha256:target.LRLOriginalContentSha256,
   senatorOriginal2022CampaignDomainCandidate:target.domain,
   originalFiledSosWebsiteAssignmentValidated:false,
   sourcePreviouslyObservedAtUtc:target.previousExactPathObservedAtUtc,
   previousExactPageHttpStatus:target.previousExactPathFetchHttpStatus,
   previousExactURLPageContentObservedAtUtc:
    target.previousExactPathFetchHttpStatus===200
      ?target.previousExactPathObservedAtUtc:null,
   previousSourceWasNotHistoricallyProven2022:true,
   historicalDomainIndexRequest:withoutBuffer(query),
   historicalIndexFile:indexBytes,indexStatus,indexParserFailure:parserError,
   rawIndexRowsBounded:parsed?.rawCdxResultRows??null,
   indexAtReturnedCapacityAndNotExhaustive:parsed?.returnedIndexAtCapacity??null,
   acceptedSameDomain2022OriginalIndexCandidateRows:parsed?.rankedCandidateRows.length??null,
   selectedUpToThreeOriginalPageReplays:trials,
   originalPageBodiesWithDigestVerified:recovered.length,
   earliestHistoricalOriginalPageAttestedByUtc:recovered.map(x=>
     x.archiveCaptureProvesPageTextWasPublicByUtc!).sort()[0]??null,
   exactCampaignIssueStatementDateVerified:false,
   firstAuthorPublishedOn:null,
   noIndexedCaptureDoesNotProveWebsiteAbsence:true,
   forecastOrEvidenceRowsAdmitted:0,
  };
  console.log('SENATE-2022-DOMAIN-SUMMARY '+JSON.stringify({
   person:target.candidateName,
   observedAt:query.observedAtUtc,indexHttp:query.status,
   indexState:indexStatus,rows:parsed?.rankedCandidateRows.length??null,
   originalReplaysAttempted:trials.length,
   historicallyVerifiedOriginalPages:recovered.length,
   earliest: item.earliestHistoricalOriginalPageAttestedByUtc,
   campaignPolicyExcerptsValidated:0,
  }));
  results.push(item);
 }
 const manifest={
   schema:HISTORICAL_SENATOR_2022_DOMAIN_ARCHIVE_VERSION,
   actualResearchAcquiredAtUtc:new Date().toISOString(),
   sourceKind:'public_domain_wide_wayback_CDX_exact_replay_digest_crosscheck',
   onlyThreeVerifiedSenators:true,nonSenatorNamesInResearchOutputs:0,
   priorExactPathProbeRunId:38098726687,
   independentActualSenateServiceSourceSha256:official.source.sourceBytesSha256,
   independentActualSenateServiceSourceObservedAtUtc:official.source.observedAt,
   controls:{
    firstRequestRequiresOriginalLRLVerifiedSenateService:true,
    acquired2026DateNeverTreatedAs2022Publication:true,
    archiveIndexMetadataOnlyWithoutVerifiedOriginalHTML:true,
    historicalPageCaptureTimeNotAuthorFirstPostingTime:true,
    historicalPageNotAutomaticallyPolicyStance:true,
    older2022ElectionDayExcluded:true,
    fetchedDocsMayNotExhaustHistoricalSiteVersions:true,
    publisher/officeOutreach:false,
    databaseQueries:false,productionEvidenceWrites:false,
    forecastOrModelChanges:false,
   },
   totals:{
    verifiedServedSenatorsWithQueriedDomains:results.length,
    domainWideHistoricalIndexQueries:results.length,
    indexQueriesHttp200:results.filter(x=>x.historicalDomainIndexRequest.status===200).length,
    parsed2022DomainIndexCandidateRows:results.reduce((n,x)=>n+(x.acceptedSameDomain2022OriginalIndexCandidateRows??0),0),
    attemptedOriginalWaybackReplays:results.reduce((n,x)=>n+x.selectedUpToThreeOriginalPageReplays.length,0),
    originalHistoricalPageBodiesIndependentlyDigestVerified:
      results.reduce((n,x)=>n+x.originalPageBodiesWithDigestVerified,0),
    distinctSenatorsWithVerifiedOriginal2022Page:
      results.filter(x=>x.originalPageBodiesWithDigestVerified>0).length,
    candidateOwnedPolicyExcerptsHistoricallyVerifiedByHuman:0,
    unknownActualFiledCampaignWebsiteFieldCount:results.length,
    nonSenatorsPublishedInSenatorCoverage:0,
    productionEvidenceOrForecastAdmissions:0,
   },
   persons:results,
   limitations:[
    'Each Wayback CDX index, whether 200/404/503, is observed on a dated 2026 request.',
    'A valid historic index does not alone prove candidate statements or historic site pages.',
    'Only digest-matched exact archived original HTML bytes can set 2022 attested page availability.',
    'An exact old original page may lack candidate-authored policy or may belong to a different site cycle; manual review remains mandatory.',
    '2026 current site content, including later re-election claims, is never backdated to 2022.',
    'A bounded host-level 300-row query and three replays per senator are not a census of old versions.',
    'An elected ballot result is separate from independently LRL-proven service, and original filed website fields remain unknown.',
   ],
 };
 saveBytes(output,'acquisition-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8'));
 return manifest;
}
