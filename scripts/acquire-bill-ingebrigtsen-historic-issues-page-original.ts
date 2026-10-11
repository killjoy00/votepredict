/**
 * #864 one-shot wider historical source discovery: original first-party
 * billforsenate.org/issues.php explicitly linked from a SHA/CDX-rechecked
 * genuine August 5, 2020 original campaign homepage. The bounded 2020
 * archive indexed only homepages. Investigate exact ORIGINAL issues URLs
 * 2010-2020 without ever treating index leads as visible policy.
 *
 * Reopen original complete Minnesota LRL Senate-service government record;
 * verify actual 2021 Senate service AND original 2020 full home bytes before
 * ANY public archive network request. No production/model/evidence actions.
 */
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import evidence from '../data/evaluation/senate-bill-ingebrigtsen-historic-issue-page-2010-2020-original-archive-target-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {originalCampaignVisibleText,historicalArchiveSha1Base32}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {fetchDatedBoundedPublic,type PublicReply}
 from './acquire-senate-2022-ever-served-campaign-originals.js';

export const BILL_INGEBRIGTSEN_2010_2020_ORIGINAL_ISSUE_PAGE_ARCHIVE_PROBE_VERSION=
 'mn-bill-ingebrigtsen-original-2010-through-2020-issue-page-probe-v1' as const;
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const HOME_SHA='263c155d0560953d418ad84506ef68b9dfe51a1172336da14abb4e5fc93e8a85';
const HOME_CDX='PAS6JCDM4S2BDVKVYADI4OVHX7QM7WRU';
const FROM='2010-01-01T00:00:00.000Z',UNTIL='2020-11-03T00:00:00.000Z';
const cdxf=['timestamp','original','mimetype','statuscode','digest','length'] as const;
const sha256=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function safeIssueUrl(input:string){
 const u=new URL(input);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port
   ||u.search||u.hash||u.hostname.replace(/^www\./,'').toLowerCase()!=='billforsenate.org'
   ||u.pathname!=='/issues.php')
  throw Error('Only archived authentic Bill Ingebrigtsen first-party /issues.php original is allowed');
 return u;
}
export function verifyActualSenatorAnd2020CampaignHomeBeforeArchiveNetwork(
 government:AuditedOfficialSenateDirectory,
 original2020Home:Uint8Array,
){
 const p=evidence.provenance,s=evidence.scope,t=evidence.target;
 if(evidence.schema!=='mn-bill-ingebrigtsen-served-2021-candidate-owned-2010-2020-issues-archive-probe-v1'
   ||evidence.issue!==864||s.queryWindowFrom!==FROM||s.queryWindowUntilExclusive!==UNTIL
   ||s.individualActuallyServedMNStateSenateIn2021Required!==true
   ||s.electionDistrictIn2020!=='8'
   ||s.original2010To2020ArchiveQueryDoesNotProveNew2020Writing!==true
   ||s.originalWebsiteLink2010To2020CanProveHistoricalPlatformOnlyByActualCaptureUtc!==true
   ||s.originalSiteHistorical2020HomepageVerifiedBeforeNetworkRequired!==true
   ||s.completeOriginalOfficialLRLGovernmentServedSenatorsRequired!==true
   ||s.originalCDXIndexQueries!==4||s.maxIndexedRowsPerQuery!==180
   ||s.maxFullOriginalIssueHTMLReplays!==6
   ||s.currentMutableWebsiteNeverUsedToBackdate!==true
   ||s.noSourceOrIssueStatementsAutomaticallyAdmitted!==true
   ||s.emptyIndexOrReplayIsUnknownNotPositionAbsence!==true
   ||s.originalFirstWrittenDateNotEstablished!==true
   ||s.campaignLegislativeSelfReportsNotOfficialRollCall!==true
   ||s.productionDatabaseEvidenceModelForecastSchedulerChanges!==0
   ||p.originalSenatorServiceURL!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||p.originalSenatorServiceRun!==38094976711
   ||p.originalSenatorServiceArtifact!==11685387674
   ||p.originalGovernmentHtmlSha256!==GOV_SHA
   ||p.original2020CandidateSiteAcquisitionRun!==38157868392
   ||p.original2020CandidateSiteArtifact!==11709436801
   ||p.original2020CandidateSiteArchiveName!=='senate-two-more-2021-senators-2020-original-candidate-html-v1'
   ||p.original2020CandidateHomeFile!=='two20b-02-archive-20200805220154-0.html'
   ||p.original2020CandidateHomeSiteUrl!=='http://billforsenate.org/'
   ||p.original2020CandidateHomeCaptureUtc!=='2020-08-05T22:01:54.000Z'
   ||p.original2020CandidateHomeSha256!==HOME_SHA
   ||p.original2020CandidateHomeCdxSha1Base32!==HOME_CDX
   ||p.original2020CandidateHomeHTMLLiteralIssueLink!=='href="issues.php"'
   ||t.actuallyServedSenator!=='Bill Ingebrigtsen'||t.district!=='8'
   ||t.domain!=='billforsenate.org'||t.exactCandidateOwnedIssuesPath!=='/issues.php'
   ||t.issuePageOriginalBytesAuthenticatedYet!==false
   ||t.anyQuotedPolicyStatementAuthenticatedYet!==false
   ||t.original2020SOSFiledWebsiteFieldEstablished!==false
   ||t.indexQueryOriginals.length!==4
   ||government.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
   ||government.source.url!==p.originalSenatorServiceURL
   ||government.source.sourceBytesSha256!==GOV_SHA
   ||government.source.directoryIsSenatorServiceNotCandidateFiling!==true
   ||government.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Original independent public senator service, 2020 homepage or exact old issue URL source scope changed');
 const canonical=[
  'http://billforsenate.org/issues.php',
  'http://www.billforsenate.org/issues.php',
  'https://billforsenate.org/issues.php',
  'https://www.billforsenate.org/issues.php',
 ];
 if(t.indexQueryOriginals.some((x,i)=>x!==canonical[i]))
  throw Error('Historical first-party exact issue path probe scope changed');
 const senator=validateActualSenateServiceForElection(government,t.actuallyServedSenator,t.district,2020);
 if(senator.status!=='verified_senate_service'
   ||senator.serviceForThisElectionFollowingYearVerified!==true
   ||!senator.officialName||!senator.term)
  throw Error('Bill Ingebrigtsen not independently established ACTUALLY SERVING 2021 Minnesota Senate');
 if(original2020Home.length<1000||original2020Home.length>2_500_000
   ||sha256(original2020Home)!==HOME_SHA
   ||historicalArchiveSha1Base32(original2020Home)!==HOME_CDX)
  throw Error('Previously captured genuine original August 2020 first-party homepage SHA256/CDX SHA1 mismatch');
 const originalHomeText=Buffer.from(original2020Home).toString('utf8');
 if(!originalHomeText.includes('href="issues.php"')
   ||!originalHomeText.includes('Bill Ingebrigtsen for Minnesota State Senate')
   ||!originalHomeText.includes('Paid for by Ingebrigtsen for Senate Committee'))
  throw Error('No authenticated original 2020 candidate homepage directly linking Bill Ingebrigtsen issues.php');
 return{senator:senator.officialName,verifiedSenateTerm:senator.term,originalHomeHash:HOME_SHA};
}
export function buildBillIngebrigtsenHistoricalIssueIndexURLs(){
 const expected=evidence.target.indexQueryOriginals;
 return expected.map(original=>{
  safeIssueUrl(original);
  const q=new URLSearchParams({
   url:original,matchType:'exact',output:'json',fl:cdxf.join(','),
   filter:'statuscode:200',from:'20100101',to:'20201102',limit:'180',
  });
  return'https://web.archive.org/cdx/search/cdx?'+q.toString();
 });
}
export function parseBillHistoricalExactIssuesCDX(source:unknown){
 if(Array.isArray(source)&&source.length===0)
  return{eligible:[] as WaybackCapture[],indexRawRows:0,indexAtCap:false};
 if(!Array.isArray(source)||!source.length||source.length>181||!Array.isArray(source[0])
   ||cdxf.some(k=>!(source[0] as unknown[]).map(String).includes(k)))
  throw Error('Missing/unbounded historical exact first-party issues.php Wayback CDX index');
 const found=new Set<string>();
 const eligible:WaybackCapture[]=[];
 for(const c of parseWaybackCdxJson(source)){
  try{safeIssueUrl(c.original);}catch{continue;}
  if(c.capturedAt<FROM||c.capturedAt>=UNTIL
   ||!/^[A-Z2-7]{32}$/.test(c.digest))
   continue;
  const key=c.original+'|'+c.timestamp+'|'+c.digest;
  if(found.has(key))continue;
  found.add(key);eligible.push(c);
 }
 eligible.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
 return{eligible,indexRawRows:source.length-1,indexAtCap:source.length===181};
}
export function selectBillIssueOriginalReplays(records:ReadonlyArray<WaybackCapture>){
 const sorted=[...records].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
 const output:WaybackCapture[]=[],used=new Set<string>();
 function add(x:WaybackCapture|undefined){
  if(!x||output.length>=6)return;
  const key=x.timestamp+'|'+x.digest;
  if(!used.has(key)){used.add(key);output.push(x);}
 }
 add(sorted[0]);
 for(const y of ['2012','2016','2020']){
  add(sorted.find(x=>x.capturedAt.startsWith(y)));
 }
 add(sorted.at(Math.floor(sorted.length/2)));
 add(sorted.at(-1));
 for(const x of sorted) add(x);
 return output.slice(0,6);
}
function save(dir:string,name:string,body:Buffer|null){
 if(!body||!body.byteLength)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(name)||name.includes('..'))
  throw Error('Unsafe public campaign original source filename');
 writeFileSync(join(dir,name),body,{flag:'wx',mode:0o600});
 return name;
}
const metadata=(r:PublicReply)=>{const {body,...view}=r;return view;};
export async function recoverBillIngebrigtsenHistoricExactIssuesPage(
 outputPath:string,government:AuditedOfficialSenateDirectory,
 original2020Home:Uint8Array,network:typeof fetch=fetch,
){
 const qualified=verifyActualSenatorAnd2020CampaignHomeBeforeArchiveNetwork(
  government,original2020Home);
 const dir=resolve(outputPath);
 if(existsSync(dir))throw Error('Original evidence output directory already exists');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const indices:ReturnType<typeof parseBillHistoricalExactIssuesCDX>[]=[];
 const sourceIndexes=[];
 for(const [i,indexUrl] of buildBillIngebrigtsenHistoricalIssueIndexURLs().entries()){
  const reply=await fetchDatedBoundedPublic(indexUrl,1_500_000,network);
  const name='billissue-index-'+String(i+1).padStart(2,'0')+'-original-cdx-2010-2020.json';
  const file=save(dir,name,reply.status===200?reply.body:null);
  let parsed:ReturnType<typeof parseBillHistoricalExactIssuesCDX>|null=null;
  let error:string|null=null;
  if(reply.status===200&&reply.body){
   try{parsed=parseBillHistoricalExactIssuesCDX(
    JSON.parse(reply.body.toString('utf8')) as unknown);}
   catch(e){error=e instanceof Error?e.message:'Unknown invalid original CDX JSON';}
  }
  if(parsed)indices.push(parsed);
  sourceIndexes.push({
   originalUrl:evidence.target.indexQueryOriginals[i],
   indexUrl,downloadedOriginalIndexFile:file,
   indexResponse:metadata(reply),
   parsedIndexSuccessfully:parsed!==null,
   matchedOriginalIssuesPagesInBoundedIndex:parsed?.eligible.length??null,
   sourceIndexReached180RowLimit:parsed?.indexAtCap??null,error:error??reply.error,
  });
 }
 const candidates=indices.flatMap(x=>x.eligible);
 const dedupe=new Map<string,WaybackCapture>();
 for(const x of candidates)dedupe.set(x.original+'|'+x.timestamp+'|'+x.digest,x);
 const replays=selectBillIssueOriginalReplays([...dedupe.values()]);
 const replayResults=[];
 for(const [i,c] of replays.entries()){
  const r=await fetchDatedBoundedPublic(c.archiveUrl,2_500_000,network);
  const sameBytes=Boolean(r.status===200&&r.body
   &&historicalArchiveSha1Base32(r.body)===c.digest
   &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(r.headers.contentType??''));
  const hasName=sameBytes&&r.body?
   originalCampaignVisibleText(r.body).toLowerCase().includes('ingebrigtsen'):false;
  const authentic=sameBytes&&hasName;
  const page='billissue-original-'+c.timestamp+'-'+String(i)+'.html';
  const kept=save(dir,page,authentic?r.body:null);
  replayResults.push({
   actualArchiveCaptureUtc:c.capturedAt,originalCandidateSiteURL:c.original,
   originalIndexedWaybackCDXSHA1:c.digest,archiveReplayURL:c.archiveUrl,
   replayOriginalHTMLFile:kept,completeOriginalHTMLSHA256:authentic?r.responseBodySha256:null,
   genuineOriginalHTMLMatchesIndependentIndexedCDXSHA1:sameBytes,
   originalSiteSurnameAppearsInVisibleText:hasName,
   authenticatedCandidateIssuePageAvailable:authentic,
   response:metadata(r),exactCandidateOwnedIssueQuotationsHumanReviewed:0,
   candidatePastClaimsNeverCertifyOfficialRecordedVote:true,
   automaticProductionPolicyEvidenceAdmission:false,
  });
 }
 const body={
  schema:BILL_INGEBRIGTSEN_2010_2020_ORIGINAL_ISSUE_PAGE_ARCHIVE_PROBE_VERSION,
  acquiredAtUtc:new Date().toISOString(),
  actualSenatorFromIndependentWholeOfficialSource:qualified.senator,
  governmentOriginalLRLHtmlSha256:government.source.sourceBytesSha256,
  governmentOriginalLRLObservedUtc:government.source.observedAt,
  actual2021SenateServiceVerifiedBeforeFirstNetwork:true,
  originalAugust2020FirstPartyHomepageSha256:qualified.originalHomeHash,
  originalAugust2020HomepageLinkedTargetIssuesPHP:true,
  historicalWindow:{from:FROM,untilExclusive:UNTIL},
  exactOriginalIssueUrlIndexes:sourceIndexes,
  totalIndexQueries:sourceIndexes.length,
  totalIndexesSuccessfullyParsed:sourceIndexes.filter(x=>x.parsedIndexSuccessfully).length,
  totalIndexedOriginalCandidateIssueRowsBeforeDedupe:candidates.length,
  totalDistinctIndexOriginalIssuesCaptures:dedupe.size,
  chosenFullHistoricalIssueHTMLReplays:replays.length,
  authenticatedFirstPartyIssuesPageBodies:replayResults.filter(x=>x.authenticatedCandidateIssuePageAvailable).length,
  sourceOnlyNoIssuePositionCountAutomaticallyAdmitted:0,
  productionDatabaseEvidenceForecastModelSchedulerChanges:0,
  failureOrNoOriginalDoesNotMeanNoPolicyPosition:true,
  originalSourceReplayResults:replayResults,
 };
 save(dir,'source-acquisition-manifest.json',Buffer.from(JSON.stringify(body,null,2)+'\n'));
 console.log('BILL-INGEBRIGTSEN-HISTORIC-EXACT-ISSUES-FIRST-PARTY-SOURCE '+JSON.stringify({
  senator:body.actualSenatorFromIndependentWholeOfficialSource,
  indexes:body.totalIndexQueries,indexParsed:body.totalIndexesSuccessfullyParsed,
  indexedMatches:body.totalDistinctIndexOriginalIssuesCaptures,
  replayed:body.chosenFullHistoricalIssueHTMLReplays,
  originalIssuePagesAuthenticated:body.authenticatedFirstPartyIssuesPageBodies,
  productionChanges:body.productionDatabaseEvidenceForecastModelSchedulerChanges,
 }));
 return body;
}
