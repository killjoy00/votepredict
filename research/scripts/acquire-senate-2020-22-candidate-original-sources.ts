/**
 * #864 C one-time public 2020/2022 MN Senate original source acquisition.
 * May run on a source-only internal PR (no secrets) or manually in an
 * internet-capable workspace. No DB, Vercel, emails, forecasts or migration.
 *
 * Election result candidate "cand.txt" is 7-field ballot lookup, NOT the
 * distinct SOS 21-field historic filing export's Campaign Website column!
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseWaybackCdxJson,type WaybackCapture} from '../../src/evidence/wayback.js';
import {auditSos2020to2022OriginalGeneralCensus} from '../../src/evidence/senate-2020-22-official-general-census.js';

export const SENATE_HISTORIC_ORIGINAL_ACQUISITION_VERSION='senate-2020-22-public-original-source-acquisition-v1';
const MAX_RAW_BYTES=2*1024*1024;
const DEADLINE=18000;
const sources=[
 {id:'2022-sd4-ballotpedia-article',year:2022,kind:'candidate_submitted_publisher_questionnaire',
  candidatePairs:['Rob Kupec','Dan Bohmer'],
  url:'https://news.ballotpedia.org/2022/10/07/all-candidates-for-minnesota-state-senate-district-4-complete-ballotpedias-candidate-connection-survey/'},
 {id:'2022-sd32-ballotpedia-article',year:2022,kind:'candidate_submitted_publisher_questionnaire',
  candidatePairs:['Michael Kreun','Kate Luthner'],
  url:'https://news.ballotpedia.org/2022/10/19/all-candidates-for-minnesota-state-senate-district-32-complete-ballotpedias-candidate-connection-survey/'},
 {id:'2020-sos-general-stsenate',year:2020,kind:'official_postvote_state_senate_general_results_not_filing',
  candidatePairs:[],url:'https://electionresultsfiles.sos.mn.gov/20201103/stsenate.txt'},
 {id:'2020-sos-general-cand',year:2020,kind:'official_postvote_7field_ballot_candidate_lookup_not_filing',
  candidatePairs:[],url:'https://electionresultsfiles.sos.mn.gov/20201103/cand.txt'},
 {id:'2022-sos-general-stsenate',year:2022,kind:'official_postvote_state_senate_general_results_not_filing',
  candidatePairs:[],url:'https://electionresultsfiles.sos.mn.gov/20221108/stsenate.txt'},
 {id:'2022-sos-general-cand',year:2022,kind:'official_postvote_7field_ballot_candidate_lookup_not_filing',
  candidatePairs:[],url:'https://electionresultsfiles.sos.mn.gov/20221108/cand.txt'},
] as const;
const allowedHosts=['news.ballotpedia.org','web.archive.org','electionresultsfiles.sos.mn.gov'];
export function historicalSourceTargets(){return sources;}
export interface FetchedOriginal {
  requestUrl:string;status:number|null;error:string|null;
  retrievedAt:string;responseUrl:string|null;bodySha256:string|null;
  responseBytes:number|null;contentType:string|null;
  dateHeader:string|null;lastModified:string|null;
  responseBuffer:Buffer|null;
}
export async function retrieveSmallPublicOriginal(
 url:string,fetcher:typeof fetch=fetch,
):Promise<FetchedOriginal>{
 const address=new URL(url);
 if(address.protocol!=='https:'||!allowedHosts.includes(address.hostname)
   ||address.username||address.password||address.port||address.hash)
   throw Error('Unapproved public original source host/path');
 const result:FetchedOriginal={
  requestUrl:url,status:null,error:null,retrievedAt:new Date().toISOString(),
  responseUrl:null,bodySha256:null,responseBytes:null,contentType:null,
  dateHeader:null,lastModified:null,responseBuffer:null,
 };
 try{
  const response=await fetcher(url,{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(DEADLINE),
    headers:{Accept:'text/html,text/plain,application/json','accept-encoding':'identity',
      'user-agent':'VotePredict-Research/1.0 historic-Senate-archive-audit-864'},
  });
  result.status=response.status;result.responseUrl=response.url;
  result.contentType=response.headers.get('content-type');
  result.dateHeader=response.headers.get('date');
  result.lastModified=response.headers.get('last-modified');
  const size=response.headers.get('content-length');
  if(size&&/^\d+$/.test(size)&&Number(size)>MAX_RAW_BYTES){
    await response.body?.cancel();
    result.error='Exceeds 2 MiB response limit';return result;
  }
  if(!response.body){result.error='Missing response body';return result;}
  const reader=response.body.getReader();let total=0;const chunks:Buffer[]=[];
  while(true){
    const x=await reader.read();
    if(x.done)break;
    total+=x.value.length;
    if(total>MAX_RAW_BYTES){await reader.cancel();result.error='Exceeded bounded downloaded byte cap';return result;}
    chunks.push(Buffer.from(x.value));
  }
  const bytes=Buffer.concat(chunks,total);
  result.responseBuffer=bytes;result.responseBytes=bytes.length;
  result.bodySha256=createHash('sha256').update(bytes).digest('hex');
 }catch(e){result.error=e instanceof Error?e.name+': '+e.message.slice(0,160):'public_get_failed';}
 return result;
}
const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Sha1(bytes:Buffer):string{
 const raw=createHash('sha1').update(bytes).digest();let value=0,bits=0,out='';
 for(const n of raw){value=(value<<8)|n;bits+=8;
  while(bits>=5){out+=abc[(value>>(bits-5))&31];bits-=5;}
  value&=(1<<bits)-1;
 }
 if(bits)out+=abc[(value<<(5-bits))&31];
 return out;
}
function metadata(response:FetchedOriginal){
 const {responseBuffer,...x}=response;return x;
}
function persist(dir:string,name:string,body:Buffer|null):string|null {
 if(!body||!body.length)return null;
 if(!/^[a-zA-Z0-9._-]{1,110}$/.test(name)||name.includes('..'))
   throw Error('Unsafe public source filename');
 writeFileSync(join(dir,name),body,{mode:0o600,flag:'wx'});
 return name;
}
const ELECTION_CUTOFF='2022-11-08T00:00:00Z';
function canonicalPath(url:string):string {
 const x=new URL(url);
 return x.hostname.replace(/^www\./i,'').toLowerCase()+x.pathname.replace(/\/$/,'');
}
export function filteredCandidateQuestionnaireCdx(
 origin:string,payload:unknown,
):WaybackCapture[]{
 const rows=parseWaybackCdxJson(payload);
 if(rows.length>200)throw Error('Unbounded questionnaire Wayback index response');
 const unique=new Set<string>();
 return rows.filter(c=>{
  if(canonicalPath(c.original)!==canonicalPath(origin)
    ||Date.parse(c.capturedAt)<Date.UTC(2022,0,1)
    ||Date.parse(c.capturedAt)>=Date.parse(ELECTION_CUTOFF)
    ||!/^[A-Z2-7]{32}$/.test(c.digest))return false;
  const id=c.timestamp+'|'+c.digest;
  if(unique.has(id))return false;
  unique.add(id);return true;
 });
}
function indexQuery(url:string){
 const params=new URLSearchParams({
  url,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',from:'20220101',to:'20221107',limit:'200',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+params.toString();
}
export async function acquireSenateOriginal2020to2022Sources(
 outputDir:string,fetcher:typeof fetch=fetch,
){
 if(existsSync(resolve(outputDir)))throw Error('Refuse to overwrite prior source acquisition');
 const dir=resolve(outputDir);mkdirSync(dir,{recursive:true,mode:0o700});
 const files=[];
 const originals=new Map<string,Buffer>();
 for(const target of sources){
  const r=await retrieveSmallPublicOriginal(target.url,fetcher);
  // A state SOS endpoint may return an HTTP 200 HTML maintenance page in
  // place of the election text file. Never count that as original result data.
  const isSOS=target.kind.startsWith('official_postvote');
  const ascii=r.responseBuffer?.subarray(0,8192).toString('latin1')??'';
  const looksLikeElectionText=Boolean(!isSOS||(
    r.status===200
    &&!/<\s*(?:!doctype|html|head|body|title)\b/i.test(ascii)
    &&!/(?:maintenance in progress|please revisit this site)/i.test(ascii)
    &&ascii.split(/\r?\n/).some(row=>row.includes(';')&&row.length>9)
  ));
  const name=persist(dir,target.id+'.response',r.status===200?r.responseBuffer:null);
  const observation={id:target.id,year:target.year,kind:target.kind,
   sourceUrl:target.url,expectedCandidateNames:target.candidatePairs,
   response:metadata(r),storedResponseFile:name,
   sourceTextFormatChecksPassed:r.status===200&&looksLikeElectionText,
   sourceHttp200ButNotExpectedTextFormat:r.status===200&&!looksLikeElectionText,
   original2020or2022SosFilingWebsiteColumnAuthenticated:false,
   originalArchivePageBefore2022ElectionAuthenticated:false,
   postElectionSourceNotEligibleAsForecastFeature:target.kind.startsWith('official'),
   claimsExactPolicyCandidateExcerptPreVote:false,
  };
  files.push(observation);
  if(isSOS&&observation.sourceTextFormatChecksPassed&&r.responseBuffer)
    originals.set(target.id,r.responseBuffer);
  console.log('HISTORIC-PUBLIC-SOURCE '+JSON.stringify({id:observation.id,
   status:r.status,error:r.error,sha256:r.bodySha256,bytes:r.responseBytes}));
 }
 const originalGeneralCensuses=[];
 for(const year of [2020,2022] as const){
  const st=originals.get(year+'-sos-general-stsenate');
  const cand=originals.get(year+'-sos-general-cand');
  if(!st||!cand){
    originalGeneralCensuses.push({
      electionYear:year,reportFile:null,success:false,
      sourceResult:'one or both official general result files were unavailable or wrong format',
      fullCandidateOriginalGeneralBallotProof:false,
      sourceWebsiteFieldHistoricallyVerified:false,
    });
    continue;
  }
  try{
    const report=auditSos2020to2022OriginalGeneralCensus(year,st,cand);
    const file=persist(dir,year+'-sos-general-crosschecked-candidate-census.json',
      Buffer.from(JSON.stringify(report,null,2)+'\n'));
    originalGeneralCensuses.push({
      electionYear:year,reportFile:file,success:true,
      sourceResult:'both originals structurally matched',
      sourceHashesMatchPriorAcquisition:report.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,
      districts:report.totals.senateDistricts,
      winners:report.totals.nonWriteinElectionWinnerCandidates,
      losingNamedCandidates:report.totals.nonwinningNamedCandidates,
      sourceWebsiteFieldHistoricallyVerified:false,
      fullCandidateOriginalGeneralBallotProof:true,
    });
    console.log('HISTORIC-OFFICIAL-CENSUS '+JSON.stringify({
      electionYear:year,originalSha256:report.source.originalResultSha256,
      candidateLookupSha256:report.source.originalCandidateLookupSha256,
      sourceHashMatched:report.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,
      namedCandidates:report.totals.uniqueNamedBallotCandidates,
      winners:report.totals.nonWriteinElectionWinnerCandidates,
      losingCandidates:report.totals.nonwinningNamedCandidates,
    }));
  }catch(e){
    originalGeneralCensuses.push({
      electionYear:year,reportFile:null,success:false,
      sourceResult:'official source formats or identities did not reconcile',
      fullCandidateOriginalGeneralBallotProof:false,
      sourceWebsiteFieldHistoricallyVerified:false,
    });
    console.log('HISTORIC-OFFICIAL-CENSUS '+JSON.stringify({
      electionYear:year,success:false,
      reason:e instanceof Error?e.message.slice(0,100):'unknown',
    }));
  }
 }
 const snapshots=[];
 for(const article of sources.filter(x=>x.kind==='candidate_submitted_publisher_questionnaire')){
  const q=indexQuery(article.url);
  const response=await retrieveSmallPublicOriginal(q,fetcher);
  const indexFile=persist(dir,article.id+'.cdx.json',response.status===200?response.responseBuffer:null);
  let rows:WaybackCapture[]=[];let parseError:string|null=null;
  if(response.status===200&&response.responseBuffer){
   try{rows=filteredCandidateQuestionnaireCdx(article.url,
      JSON.parse(response.responseBuffer.toString('utf8')) as unknown);}
   catch(e){parseError=e instanceof Error?e.message:'invalid historic CDX';}
  }
  const candidate=rows.length?[rows[0],rows.at(-1)!].filter((x,i,a)=>
   a.findIndex(y=>y.timestamp===x.timestamp&&y.digest===x.digest)===i):[];
  const snapshotAttempts=[];
  for(const record of candidate){
   const snapshot=await retrieveSmallPublicOriginal(record.archiveUrl,fetcher);
   const matchingDigest=Boolean(snapshot.status===200&&snapshot.responseBuffer
     &&base32Sha1(snapshot.responseBuffer)===record.digest);
   const htmlFile=persist(dir,article.id+'-'+record.timestamp+'.html',
     matchingDigest?snapshot.responseBuffer:null);
   snapshotAttempts.push({
    captureTime:record.capturedAt,originalUrl:record.original,
    historicalIndexSha1Base32:record.digest,sourceIndexRowNotPreElectionFeature:true,
    archiveUrl:record.archiveUrl,response:metadata(snapshot),savedOriginalHtmlFile:htmlFile,
    matchesHistoricalIndexDigest:matchingDigest,
    candidateWordsFromPublisherQuestionnaireAttributionManuallyValidated:false,
    stanceOrForecastEligibilityCertified:false,
   });
   console.log('HISTORIC-WAYBACK-REPLAY '+JSON.stringify({id:article.id,
    capturedAt:record.capturedAt,status:snapshot.status,
    digestMatchesCdx:matchingDigest,bodySha256:snapshot.bodySha256}));
  }
  const x={sourceId:article.id,queryUrl:q,response:metadata(response),
   indexResponseBodyFile:indexFile,parsedHistoricalIndexRows:rows.length,parseError,
   snapshotAttempts};
  snapshots.push(x);
  console.log('HISTORIC-WAYBACK-INDEX '+JSON.stringify({
   source:article.id,status:response.status,rows:rows.length,
   sha256:response.bodySha256,error:response.error??parseError}));
 }
 const manifest={
  schema:SENATE_HISTORIC_ORIGINAL_ACQUISITION_VERSION,
  observedAt:new Date().toISOString(),
  scope:{issue:864,years:[2020,2022],publicGetOnly:true,
   writesToNeonOrVercel:false,modelOrForecastChanges:false,
   sourceRequestIsNotEvidenceOfAvailability:true,
   candidateSosFilingOriginalsVerified:false,
   statewide2021to2025CampaignDenominatorCertified:false,
   originalCandidateQuestionnairePostingDateIndependentlyEstablished:false},
  totals:{directPublicRequests:files.length,
   directPublisherPagesAcquired:files.filter(x=>x.kind==='candidate_submitted_publisher_questionnaire'
    &&x.storedResponseFile).length,
   generalElectionPostvoteFilesAcquired:files.filter(x=>x.kind.startsWith('official')
    &&x.storedResponseFile&&x.sourceTextFormatChecksPassed).length,
   waybackIndexQueries:snapshots.length,
   priorGeneralWaybackIndexEntries:snapshots.reduce((n,x)=>n+x.parsedHistoricalIndexRows,0),
   priorGeneralWaybackArchiveHtmlSha1Matches:snapshots.reduce((n,x)=>
     n+x.snapshotAttempts.filter(y=>y.matchesHistoricalIndexDigest).length,0),
   completeOriginalGeneralElectionCensuses:originalGeneralCensuses.filter(x=>x.success).length,
   originalElectionWinnerIdentitiesConfirmed:originalGeneralCensuses.filter(x=>x.success).reduce((sum,x)=>sum+(x.winners??0),0),
   originalElectionNonwinnerIdentitiesConfirmed:originalGeneralCensuses.filter(x=>x.success).reduce((sum,x)=>sum+(x.losingNamedCandidates??0),0),
   historicalCandidateIssueExcerptsManuallyAttributed:0,
   evidenceAddedToModel:0},
  directSources:files,originalGeneralCensuses,questionnaireWayback:snapshots,
  limitations:[
   'The seven-column election cand.txt is NOT the 21-column historical SOS filing export and has no campaign website field.',
   'Election outcomes and general election result files are post-election identity evidence, never pre-vote features.',
   'Original publishing timestamp of article text may precede archive capture but cannot be assumed.',
   'Ballotpedia publisher-carried candidate responses must remain separate from candidate-owned platform pages and losing opponents.',
   'A Wayback index hit without an HTTP 200 original body and digest match is not a verified page.',
   'No historical statewide candidate/website census is concluded from two articles or current 2026 candidate finder.',
  ],
 };
 const filename=persist(dir,'acquisition-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 console.log('HISTORIC-SOURCE-SUMMARY '+JSON.stringify({...manifest.totals,manifestFile:filename}));
 return manifest;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/acquire-senate-2020-22-candidate-original-sources.ts')){
 const index=process.argv.indexOf('--output-dir');
 if(index<0||!process.argv[index+1])throw Error('Provide --output-dir');
 acquireSenateOriginal2020to2022Sources(process.argv[index+1]).catch(()=>{
  console.error('Historic public sources could not be acquired; no data was promoted');
  process.exitCode=1;
 });
}
