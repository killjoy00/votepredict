/**
 * #864: archived 2022 Rob Kupec Senate campaign first-party /issues page.
 * Original 2022 site homepage stored in public original-run 38100967926
 * explicitly contains navigation "Issues", but the broad 300-row Wayback
 * domain sample prioritized only homepage/about. This follow-up acquires
 * EXACT issue paths; never infer a stance from a navigation link.
 *
 * Rejected: people never shown to have served Senate, current 2026 site
 * backdating, archive CDX-only as text, malformed URL/version/issue identity.
 * Public-only, no Vercel/Neon, no member evidence writes.
 */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import lead from '../data/evaluation/senate-kupec-2022-archived-issues-original-targets-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {fetchDatedBoundedPublic,base32Sha1Archive,type PublicReply}
 from './acquire-senate-2022-ever-served-campaign-originals.js';

export const KUP_2022_ISSUE_ARCHIVE_VERSION='senate-2022-original-kupec-issues-exact-wayback-acquisition-v1' as const;
const START='2022-01-01T00:00:00.000Z',CUTOFF='2022-11-08T00:00:00.000Z';
const originals=[
 'https://www.kupec4mnsenate.com/issues',
 'http://www.kupec4mnsenate.com/issues',
 'https://www.kupec4mnsenate.com/issues/',
] as const;
function proveSource(official:AuditedOfficialSenateDirectory){
 const p=validateActualSenateServiceForElection(official,'Rob Kupec','4',2022);
 if(lead.schema!=='senate-2022-rob-kupec-original-campaign-issue-page-path-recovery-v1'
   ||lead.issue!==864||lead.actualPerson.actualSenateServiceVerifiedFromOriginalLRL!==true
   ||lead.actualPerson.candidate!=='Rob Kupec'||lead.actualPerson.electionDistrict!=='4'
   ||lead.rules.includeNeverServedCandidates!==false
   ||lead.rules.modelOrForecastPositionAllowed!==false
   ||lead.rules.hashMatchOriginalWaybackCdxSha1Required!==true
   ||lead.rules.maxWaybackExactPathQueries!==3
   ||lead.rules.maxOriginalHtmlReplays!==4
   ||lead.fixedHistoricalUrlTargets.join('|')!==originals.join('|')
   ||lead.researchSource.originalHomepageSha256!==
       '930de7ddb507262b616a049355625761d4cbf4e979abd7055e4a7deac4295e56'
   ||p.status!=='verified_senate_service'
   ||p.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Original 2022 Senate identity or source discovery not trusted');
 return p;
}
export function kupecExactIssueCdxQuery(url:string){
 if(!originals.includes(url as typeof originals[number]))
  throw Error('Only old 2022 senator-owned candidate Issues URL variants are permitted');
 const q=new URLSearchParams({
  url,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',from:'20220101',to:'20221107',limit:'100',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+q.toString();
}
function issueHostPath(url:string){
 const u=new URL(url);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password
   ||u.search||u.hash||u.port||u.hostname.replace(/^www\./,'')!=='kupec4mnsenate.com'
   ||u.pathname.toLowerCase().replace(/\/+$/,'')!=='/issues')
   throw Error('Original archive row is not the exact historic campaign Issues path');
 return true;
}
export function kupecExact2022IssueCandidates(payload:unknown){
 if(Array.isArray(payload)&&payload.length===0)return{
  historicalRows:[] as WaybackCapture[],indexAtCapacity:false,
  rawIndexRows:0,exactIssueRows:0,
 };
 if(!Array.isArray(payload)||!payload.length||!Array.isArray(payload[0])
   ||payload.length>101)throw Error('Missing/unbounded historic 2022 issue archive index');
 const filtered:WaybackCapture[]=[],known=new Set<string>();
 for(const row of parseWaybackCdxJson(payload)){
  let good=true;
  try{issueHostPath(row.original);}catch{good=false;}
  if(!good||Date.parse(row.capturedAt)<Date.parse(START)
    ||Date.parse(row.capturedAt)>=Date.parse(CUTOFF)
    ||!/^[A-Z2-7]{32}$/.test(row.digest)
    ||row.statuscode!=='200'||!['text/html','text/plain','application/xhtml+xml'].includes(row.mimetype))
    continue;
  const id=row.original+'|'+row.timestamp+'|'+row.digest;
  if(known.has(id))continue;
  known.add(id);filtered.push(row);
 }
 return{historicalRows:filtered.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)),
  indexAtCapacity:payload.length===101,
  rawIndexRows:payload.length-1,exactIssueRows:filtered.length};
}
const noBody=(r:PublicReply)=>{const {body,...meta}=r;return meta;};
function save(dir:string,file:string,b:Buffer|null){
 if(!b||!b.length)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(file)||file.includes('..'))
   throw Error('Unsafe historical original issues source path');
 writeFileSync(join(dir,file),b,{mode:0o600,flag:'wx'});
 return file;
}
export async function acquireKupec2022OriginalIssuePages(
 outputDir:string,official:AuditedOfficialSenateDirectory,impl:typeof fetch=fetch,
){
 const senator=proveSource(official);
 const target=resolve(outputDir);
 if(existsSync(target))throw Error('Refuse to overwrite original campaign evidence');
 mkdirSync(target,{mode:0o700,recursive:true});
 const indexed=[],selected:WaybackCapture[]=[],replays=[];
 for(const [n,originalUrl] of originals.entries()){
  const q=kupecExactIssueCdxQuery(originalUrl);
  const response=await fetchDatedBoundedPublic(q,900000,impl);
  const file=save(target,'kupec-2022-issues-index-'+n+'.json',
    response.status===200?response.body:null);
  let parsed:ReturnType<typeof kupecExact2022IssueCandidates>|null=null;
  let error:string|null=null;
  if(response.status===200&&response.body){
   try{parsed=kupecExact2022IssueCandidates(JSON.parse(response.body.toString('utf8')) as unknown);}
   catch(e){error=e instanceof Error?e.message:'invalid archive original index';}
  }
  indexed.push({
   observedUtc:response.observedAtUtc,sourceQuery:q,sourceResponse:noBody(response),
   rawOriginalIndexFile:file,originalIndexValidated:Boolean(parsed),
   exactSameCandidateIssueUrlIndexedOriginalRows:parsed?.exactIssueRows??null,
   boundedSampleCouldOmitVersions:parsed?.indexAtCapacity??null,
   parseError:error,
  });
  selected.push(...(parsed?.historicalRows??[]));
  console.log('KUPEC-2022-ISSUES-INDEX '+JSON.stringify({
   url:originalUrl,observedAt:response.observedAtUtc,httpStatus:response.status,
   indexedRows:parsed?.exactIssueRows??null,reason:error??response.error,
  }));
 }
 const unique=new Map<string,WaybackCapture>();
 for(const row of selected.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt))){
  const id=row.original+'|'+row.timestamp+'|'+row.digest;
  if(!unique.has(id))unique.set(id,row);
 }
 const rows=[...unique.values()].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
 const chosen:WaybackCapture[]=[];
 if(rows.length)chosen.push(rows[0]);
 if(rows.length>1)chosen.push(rows.at(-1)!);
 if(rows.length>2)chosen.push(rows[Math.floor(rows.length/2)]);
 for(const [i,source] of chosen.slice(0,4).entries()){
  const r=await fetchDatedBoundedPublic(source.archiveUrl,2_500_000,impl);
  const valid=Boolean(r.status===200&&r.body
    &&base32Sha1Archive(r.body)===source.digest
    &&(/^(?:text\/html|text\/plain|application\/xhtml\+xml)/i.test(r.headers.contentType??'')));
  const file=save(target,'kupec-2022-authenticated-issues-'+source.timestamp+'-'+i+'.html',
    valid?r.body:null);
  const proof={
   originalIssueUrl:source.original,
   originalCaptureAtUtc:source.capturedAt,
   originalWaybackCDXSha1Base32:source.digest,
   originalIndependentCDXAndHtmlDigestsMatched:valid,
   archivedOriginalReplayUrl:source.archiveUrl,
   sourceActuallyFetchedAtUtc:r.observedAtUtc,
   originalHtmlSha256:valid?r.responseBodySha256:null,
   savedOriginalHtmlFile:file,
   sourceHttp:noBody(r),
   candidateAuthoredIssuePassageReviewed:false,
   senatorPositionPublicByCertifiedForSpecificExcerpt:false,
   originalSiteAuthorPostedAt:null,
   forecastEligible:false,
  };
  replays.push(proof);
  console.log('KUPEC-2022-ISSUES-ORIGINAL '+JSON.stringify({
   sourceUrl:source.original,capture:source.capturedAt,
   observedAt:r.observedAtUtc,http:r.status,
   hashMatchedHistoricalIndex:valid,sha256:r.responseBodySha256,
  }));
 }
 const matched=replays.filter(x=>x.originalIndependentCDXAndHtmlDigestsMatched);
 const report={
  schema:KUP_2022_ISSUE_ARCHIVE_VERSION,
  observedAtUtc:new Date().toISOString(),
  LRLActualSenateMemberName:senator.officialName,
  realSenateServiceSource:senator.officialServiceSource,
  independentSenateLRLDirectoryObservedAtUtc:official.source.observedAt,
  independentSenateLRLOriginalSha256:official.source.sourceBytesSha256,
  original2022CandidateFilingWebsiteFieldVerified:false,
  firstAuthorOriginalPostedOn:null,
  originalIssueTextHasBeenReviewed:false,
  known2026PageCannotBeBackdated:true,
  noNeverServedCandidateReportRows:true,
  originalExactPathQueryResults:indexed,
  archivedReplayAttempts:replays,
  stats:{
   memberPeopleVerified:1,
   exactPathIndexQueries:3,
   sourceIndexesHttp200:indexed.filter(x=>x.sourceResponse.status===200).length,
   bounded2022IssueOriginalIndexRows:rows.length,
   originalArchivedIssuePagesActuallyFetched:replays.length,
   independentOriginalIssueHTMLMatchedHistoricalIndex:matched.length,
   policyExcerptsAttributedOrAdmitted:0,
   original2022SosWebsiteFiledFieldProven:0,
   evidenceOrForecastMutations:0,
  },
  limits:[
   'The original public homepage captured July 3 2022 includes an Issues navigation label only, not the text of the target page.',
   'Current 2026 source or 2022 CDX index row alone does not prove exact historic issue page text.',
   'Only 2022 original issues HTML exact SHA1 matching CDX may establish page content by an actual 2022 capture time.',
   'Original site publication/author date is unknown; no dated senator support/oppose position is created without exact text review.',
   'HTTP 200 empty index is only this bounded source query count, never proof an issues page never existed.',
   'No source is used automatically as a pre-vote forecasting feature.',
  ],
 };
 save(target,'acquisition-manifest.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
 return report;
}
