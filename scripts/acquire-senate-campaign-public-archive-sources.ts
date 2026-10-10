/**
 * #864 C: one-shot public-only historical campaign source acquisition.
 * Reads static source leads and fixed Common Crawl / Wayback URLs ONLY.
 * Never connects to Vercel/Neon/production/serving or reads credentials.
 * No scheduled/background operation; invoked once by a controlled GH Actions job.
 *
 * node --import tsx scripts/acquire-senate-campaign-public-archive-sources.ts \
 *   --output-dir artifacts/campaign-archive-public-sources-20261010
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import siteLeads from '../data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json' with {type:'json'};
import windows from '../data/evaluation/senate-commoncrawl-index-windows-2024-25-v1.json' with {type:'json'};
import {
  planSenateCommonCrawlIndexResearch, reviewOfflineCommonCrawlIndexRows,
  type CcSourceQuery, type CommonCrawlCatalog, type CcIndexRecord,
} from '../src/evidence/senate-commoncrawl-historical-recovery.js';
import { inspectSenateCommonCrawlWarcBytes } from '../src/evidence/senate-commoncrawl-warc-proof.js';
import type { CampaignPageLeadManifest } from '../src/evidence/campaign-archive-source-recovery.js';
import { parseWaybackCdxJson, type WaybackCapture } from '../src/evidence/wayback.js';

export const SENATE_CAMPAIGN_PUBLIC_SOURCE_ACQUISITION_VERSION='senate-campaign-public-source-acquisition-v1' as const;
const leads=siteLeads as unknown as CampaignPageLeadManifest;
const catalog=windows as unknown as CommonCrawlCatalog;
const MAX_INDEX_BYTES=2*1024*1024;
const MAX_PUBLISHER_BYTES=1024*1024;
const MAX_WARC_COMPRESSED_BYTES=8*1024*1024;
const NETWORK_TIMEOUT_MS=14000;
const MAX_WARC_DOWNLOADS=8;
const INDEX_ALLOWLIST=[
  ['Ann Johnson Stewart','CC-MAIN-2024-33','issue_exact'],
  ['Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact'],
  ['Ann Johnson Stewart','CC-MAIN-2024-46','issue_exact'],
  ['Keri Heintzeman','CC-MAIN-2025-08','homepage_exact'],
  ['Keri Heintzeman','CC-MAIN-2025-13','homepage_exact'],
  ['Keri Heintzeman','CC-MAIN-2025-18','homepage_exact'],
  ['Amanda Hemmingsen-Jaeger','CC-MAIN-2025-33','issue_exact'],
  ['Amanda Hemmingsen-Jaeger','CC-MAIN-2025-43','issue_exact'],
  ['Michael Holmstrom Jr','CC-MAIN-2025-33','issue_exact'],
  ['Michael Holmstrom Jr','CC-MAIN-2025-43','issue_exact'],
  ['Louis McNutt','CC-MAIN-2025-33','issue_exact'],
  ['Louis McNutt','CC-MAIN-2025-43','issue_exact'],
  ['Dwight Dorau','CC-MAIN-2025-33','homepage_exact'],
  ['Dwight Dorau','CC-MAIN-2025-43','homepage_exact'],
] as const;
const PUBLISHER_SOURCES=[
  {id:'media-sd6-20250410',url:'https://lptv.org/public-forum-held-with-mn-senate-district-6-republican-primary-candidates/',
    publicationDateClaim:'2025-04-10',relatedCandidate:'Keri Heintzeman',kind:'media_report_of_candidate_forum'},
  {id:'2024-mnfamilyvoter-sd45',url:'https://www.mnfamilyvoter.com/candidate/mn-state-senate/johnson-stewart-ann/',
    publicationDateClaim:null,relatedCandidate:'Ann Johnson Stewart',kind:'third_party_sourced_candidate_platform_quote'},
  {id:'2025-lakesarea-vote-sd6',url:'https://lakesarea.vote/keri-heintzeman/',
    publicationDateClaim:null,relatedCandidate:'Keri Heintzeman',kind:'candidate_submitted_questionnaire'},
] as const;
type PublicationKind=typeof PUBLISHER_SOURCES[number]['kind'];
export interface ResponseSample {
  status:number|null;
  error:string|null;
  requestUrl:string;
  responseUrl:string|null;
  retrievedAt:string;
  requestOriginKind:'commoncrawl_cdx_index'|'wayback_cdx_index'|'public_publisher_page'|'original_commoncrawl_warc'|'wayback_snapshot';
  bodySha256:string|null; bodyBytes:number|null;
  responseHeaders:{
    date:string|null;contentType:string|null;lastModified:string|null;
    contentRange:string|null;etag:string|null;
  }|null;
  bodyBuffer:Buffer|null;
  boundedBodyComplete:boolean;
}
function sha256(data:Buffer):string{
  return createHash('sha256').update(data).digest('hex');
}
function safeResponseText(raw:ResponseSample):string {
  return raw.bodyBuffer?.toString('utf8')??'';
}
function saveBytes(dir:string,file:string,bytes:Buffer):string {
  if(!/^[a-zA-Z0-9._-]{1,110}$/.test(file)||file.includes('..'))
    throw new Error('Unsafe acquisition output filename');
  const full=join(dir,file);
  writeFileSync(full,bytes,{flag:'wx',mode:0o600});
  return file;
}
export async function readBoundedPublicResponse(
  url:string,
  kind:ResponseSample['requestOriginKind'],
  options:{fetchImpl?:typeof fetch;byteCap?:number;headers?:Record<string,string>;timeoutMs?:number}={},
):Promise<ResponseSample>{
  const expected=new URL(url);
  const allowed=kind==='commoncrawl_cdx_index'?['index.commoncrawl.org']
    :kind==='wayback_cdx_index'||kind==='wayback_snapshot'?['web.archive.org']
      :kind==='original_commoncrawl_warc'?['data.commoncrawl.org']
        :['lptv.org','www.mnfamilyvoter.com','lakesarea.vote'];
  if(expected.protocol!=='https:'||!allowed.includes(expected.hostname)
    ||expected.username||expected.password||expected.port)
    throw new Error('Not a preapproved public-source fetch host: '+url);
  const stamp=new Date().toISOString();
  const output:ResponseSample={
    status:null,error:null,requestUrl:url,responseUrl:null,retrievedAt:stamp,
    requestOriginKind:kind,bodySha256:null,bodyBytes:null,responseHeaders:null,
    bodyBuffer:null,boundedBodyComplete:false,
  };
  try{
    const response=await (options.fetchImpl??fetch)(url,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(options.timeoutMs??NETWORK_TIMEOUT_MS),
      headers:{
        'accept':'application/json,text/html,text/plain,application/octet-stream;q=0.5',
        'user-agent':'VotePredict-Research/1.0 source-provenance-audit-864 (public data only)',
        'accept-encoding':'identity',
        ...options.headers,
      },
    });
    output.status=response.status;
    output.responseUrl=response.url;
    output.responseHeaders={
      date:response.headers.get('date'),contentType:response.headers.get('content-type'),
      lastModified:response.headers.get('last-modified'),
      contentRange:response.headers.get('content-range'),etag:response.headers.get('etag'),
    };
    const cap=options.byteCap??MAX_INDEX_BYTES;
    const rawLength=response.headers.get('content-length');
    if(rawLength&&/^\d+$/.test(rawLength)&&Number(rawLength)>cap){
      output.error='HTTP content-length exceeds bounded source acquisition cap';
      await response.body?.cancel();
      return output;
    }
    if(!response.body){
      output.bodyBuffer=Buffer.alloc(0);output.bodyBytes=0;
      output.bodySha256=sha256(output.bodyBuffer);output.boundedBodyComplete=true;
      return output;
    }
    const reader=response.body.getReader();
    let length=0;
    const chunks:Buffer[]=[];
    while(true){
      const r=await reader.read();
      if(r.done)break;
      length+=r.value.byteLength;
      if(length>cap){
        await reader.cancel();
        output.error='HTTP decoded response exceeds bounded source acquisition cap';
        return output;
      }
      chunks.push(Buffer.from(r.value));
    }
    const bytes=Buffer.concat(chunks,length);
    output.bodyBuffer=bytes;output.bodyBytes=length;
    output.bodySha256=sha256(bytes);output.boundedBodyComplete=true;
  }catch(err){
    output.error=err instanceof Error?err.name+': '+err.message.slice(0,220):'unknown_network_failure';
  }
  return output;
}
function noBody(r:ResponseSample) {
  const {bodyBuffer,...rest}=r;
  return rest;
}
export function acquisitionTargets():{
  commoncrawl:CcSourceQuery[];
  wayback:{candidateName:string;issueUrl:string;generalElectionOn:string;url:string}[];
} {
  const plan=planSenateCommonCrawlIndexResearch(leads,catalog);
  const cc=INDEX_ALLOWLIST.map(([candidateName,collectionId,queryKind])=>{
    const matches=plan.queries.filter(q=>q.candidateName===candidateName&&q.collectionId===collectionId&&q.queryKind===queryKind);
    if(matches.length!==1)throw new Error('Missing/ambiguous pinned candidate source index: '+candidateName+' '+collectionId);
    return matches[0];
  });
  if(cc.length!==14)throw new Error('Expected 14 bounded priority Common Crawl source index requests');
  const wayback=leads.candidates.map(c=>{
    const page=c.pages.find(p=>!p.kind.startsWith('homepage'))
      ??c.pages.find(p=>p.kind.startsWith('homepage'));
    const website=page?.originalUrl??'https://'+c.campaignHost+'/';
    const dayPrior=new Date(Date.parse(c.generalElectionOn+'T00:00:00Z')-86_400_000).toISOString().slice(0,10);
    const params=new URLSearchParams({
      url:website,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
      filter:'statuscode:200',from:'20240101',to:dayPrior.replace(/-/g,''),limit:'100',
    });
    return {candidateName:c.candidateName,issueUrl:website,generalElectionOn:c.generalElectionOn,
      url:'https://web.archive.org/cdx/search/cdx?'+params.toString()};
  });
  if(wayback.length!==6)throw new Error('Expected exactly six bounded Wayback source index requests');
  return {commoncrawl:cc,wayback};
}
type UntrustedCdxResults={
  requestId:string;candidateName:string;originalUrl:string;collectionId:string;
  response:ReturnType<typeof noBody>;
  persistedSourceBodyFile:string|null;
  indexRecordCount:number|null;
  parsedIndexRecordCount:number|null;
  indexReviewError:string|null;
  candidateWarcRecords:CcIndexRecord[];
};
async function acquireCcIndexes(dir:string,impl:typeof fetch):Promise<UntrustedCdxResults[]> {
  const queries=acquisitionTargets().commoncrawl;
  const output:UntrustedCdxResults[]=[];
  // Four bounded concurrent requests; no broad crawler or dynamic website traversal.
  for(let i=0;i<queries.length;i+=4){
    const group=queries.slice(i,i+4);
    const rows=await Promise.all(group.map(async q=>{
      const response=await readBoundedPublicResponse(q.queryApiUrl,'commoncrawl_cdx_index',
        {fetchImpl:impl,byteCap:MAX_INDEX_BYTES,timeoutMs:NETWORK_TIMEOUT_MS});
      let parsedIndexRecordCount:number|null=null,records:CcIndexRecord[]=[];
      let error:string|null=null;
      if(response.status===200&&response.boundedBodyComplete){
        try{
          const review=reviewOfflineCommonCrawlIndexRows(q,safeResponseText(response));
          parsedIndexRecordCount=review.records.length;
          records=review.records;
        }catch(e){error=e instanceof Error?e.message:'CDX index response invalid';}
      }
      const file=response.bodyBuffer&&response.bodyBuffer.length&&response.status===200
        ?saveBytes(dir,'cc-index-'+q.id+'.jsonl',response.bodyBuffer):null;
      return {
        requestId:q.id,candidateName:q.candidateName,originalUrl:q.sourceUrl,collectionId:q.collectionId,
        response:noBody(response),persistedSourceBodyFile:file,
        indexRecordCount:response.status===200&&response.bodyBuffer
          ?safeResponseText(response).split(/\r?\n/).filter(x=>x.trim()).length:null,
        parsedIndexRecordCount,indexReviewError:error,
        candidateWarcRecords:records,
      };
    }));
    output.push(...rows);
    for(const r of rows){
      console.log('PUBLIC-CC-INDEX '+JSON.stringify({
        candidate:r.candidateName,collection:r.collectionId,status:r.response.status,
        error:r.response.error??r.indexReviewError,
        sha256:r.response.bodySha256,
        indexedPreVoteRecords:r.parsedIndexRecordCount,
      }));
    }
  }
  return output;
}
async function acquireWarcSample(
  dir:string,rows:UntrustedCdxResults[],impl:typeof fetch,
) {
  const sourceRows=rows.flatMap(row=>row.candidateWarcRecords.map(record=>({
    originalQueryId:row.requestId,originalCdxBodySha256:row.response.bodySha256,record,
  })));
  const selected:typeof sourceRows=[];
  const countPerCandidate=new Map<string,number>(),dedup=new Set<string>();
  for(const row of sourceRows){
    if(selected.length>=MAX_WARC_DOWNLOADS)break;
    const id=row.record.warcFilename+':'+row.record.warcOffset+':'+row.record.warcLength;
    if(dedup.has(id)||(countPerCandidate.get(row.record.candidateName)??0)>=2)continue;
    selected.push(row);dedup.add(id);
    countPerCandidate.set(row.record.candidateName,1+(countPerCandidate.get(row.record.candidateName)??0));
  }
  const outcomes=[];
  for(const row of selected){
    const index=row.record;
    const response=await readBoundedPublicResponse(index.warcDataUrl,'original_commoncrawl_warc',{
      fetchImpl:impl,byteCap:MAX_WARC_COMPRESSED_BYTES,timeoutMs:NETWORK_TIMEOUT_MS,
      headers:{range:index.httpRange},
    });
    const h=response.responseHeaders?.contentRange;
    const rangeOk= response.status===206 && h!==null && typeof h==='string'
      && new RegExp('^bytes '+index.warcOffset+'-'+index.warcRangeEndInclusive+'/\\d+$').test(h)
      &&response.bodyBuffer?.length===index.warcLength;
    let validatorProof:ReturnType<typeof inspectSenateCommonCrawlWarcBytes>['report']|null=null;
    let validatorError:string|null=null;
    let gzipFile:string|null=null,payloadFile:string|null=null;
    if(rangeOk&&response.bodyBuffer){
      gzipFile=saveBytes(dir,'cc-original-'+row.originalQueryId+'-'+index.timestamp+'.warc.gz',response.bodyBuffer);
      try{
        const checked=inspectSenateCommonCrawlWarcBytes(index,response.bodyBuffer,leads);
        validatorProof=checked.report;
        payloadFile=saveBytes(dir,'cc-page-'+row.originalQueryId+'-'+index.timestamp+'.html',
          checked.originalHttpPagePayloadBytes);
      }catch(error){
        validatorError=error instanceof Error?error.message:'unverified WARC record';
      }
    }
    const out={
      candidateName:index.candidateName,originalUrl:index.originalUrl,indexCaptureClaim:index.capturedAt,
      originalCdxResponseSha256:row.originalCdxBodySha256,recordIndex:index,
      response:noBody(response),http206ByteRangeAndHeadersConsistent:Boolean(rangeOk),
      originalCompressedWarcFile:gzipFile,verifiedOriginalPagePayloadFile:payloadFile,
      locallyCrossCheckedWarcProof:validatorProof,localWarcVerificationError:validatorError,
      responseSourceIsPublicCommonCrawlRange: Boolean(rangeOk),
      onDiskPayloadFirstPublicByProven:false,originalCandidateStatementProof:false,
      eligibleForForecast:false,
    };
    outcomes.push(out);
    console.log('PUBLIC-CC-WARC '+JSON.stringify({
      candidate:out.candidateName,status:response.status,rangeOk:out.http206ByteRangeAndHeadersConsistent,
      matchedLocalDigests:Boolean(validatorProof),capture:index.capturedAt,
      bodySha256:response.bodySha256,error:response.error??validatorError,
    }));
  }
  return {consideredOfficialCdxIndexRecords:sourceRows.length,requestedWarcRanges:selected.length,outcomes};
}
async function acquireWaybackIndexes(dir:string,impl:typeof fetch){
  const sources=acquisitionTargets().wayback;
  const output=[];
  for(let i=0;i<sources.length;i+=3){
    const group=sources.slice(i,i+3);
    const rows=await Promise.all(group.map(async (source,n)=>{
      const response=await readBoundedPublicResponse(source.url,'wayback_cdx_index',
        {fetchImpl:impl,byteCap:MAX_INDEX_BYTES,timeoutMs:NETWORK_TIMEOUT_MS});
      let captures:WaybackCapture[]=[];
      let parseError:string|null=null;
      if(response.status===200&&response.bodyBuffer){
        try{
          const parsed=JSON.parse(safeResponseText(response)) as unknown;
          captures=parseWaybackCdxJson(parsed).filter(c=>
            new Date(c.capturedAt).getTime()<Date.parse(source.generalElectionOn+'T00:00:00Z')
            &&new URL(c.original).hostname.toLowerCase().replace(/^www\./,'')
              ===new URL(source.issueUrl).hostname.toLowerCase().replace(/^www\./,'')
            &&new URL(c.original).pathname.replace(/\/$/,'')
              ===new URL(source.issueUrl).pathname.replace(/\/$/,''));
        }catch(e){parseError=e instanceof Error?e.message:'invalid Wayback CDX payload';}
      }
      const bodyFile=response.status===200&&response.bodyBuffer?.length
        ?saveBytes(dir,'wayback-index-'+String(i+n+1).padStart(2,'0')+'.json',response.bodyBuffer):null;
      return {candidateName:source.candidateName,originalPageUrl:source.issueUrl,
        response:noBody(response),persistedIndexResponseBodyFile:bodyFile,
        indexCaptureCandidatesStrictlyPreGeneral:captures.map(c=>({
          originalUrl:c.original,capturedAt:c.capturedAt,archiveUrl:c.archiveUrl,cdxDigest:c.digest,
          independentlyAuthenticatedOriginalPageBytes:false,quoteVerified:false,
        })),parseError};
    }));
    output.push(...rows);
    for(const r of rows)console.log('PUBLIC-WAYBACK-INDEX '+JSON.stringify({
      candidate:r.candidateName,status:r.response.status,error:r.response.error??r.parseError,
      sha256:r.response.bodySha256,indexPreVoteCandidates:r.indexCaptureCandidatesStrictlyPreGeneral.length,
    }));
  }
  return output;
}
async function acquirePublisherPages(dir:string,impl:typeof fetch) {
  const sources=await Promise.all(PUBLISHER_SOURCES.map(async source=>{
    const response=await readBoundedPublicResponse(source.url,'public_publisher_page',
      {fetchImpl:impl,byteCap:MAX_PUBLISHER_BYTES,timeoutMs:NETWORK_TIMEOUT_MS});
    const file=response.status===200&&response.bodyBuffer?.length
      ?saveBytes(dir,source.id+'.html',response.bodyBuffer):null;
    return {
      id:source.id,articleUrl:source.url,candidateName:source.relatedCandidate,
      kind:source.kind as PublicationKind,publicationDateOnPageClaim:source.publicationDateClaim,
      response:noBody(response),retrievedSourceHtmlFile:file,
      publishingDateIndependentlyCorroboratedByHistoricalCapture:false,
      containsSourcePageQuoteManuallyReviewed:false,
      eligibleForHistoricalCampaignPageStatement:false,
    };
  }));
  for(const source of sources)console.log('PUBLIC-PUBLISHER '+JSON.stringify({
    id:source.id,candidate:source.candidateName,status:source.response.status,
    sha256:source.response.bodySha256,bytes:source.response.bodyBytes,
    error:source.response.error,
  }));
  return sources;
}
export async function acquireSenateCampaignPublicSources(
  outputDir:string,fetchImpl:typeof fetch=fetch,
) {
  if(existsSync(resolve(outputDir)))throw new Error('Refusing to overwrite existing acquisition output directory');
  const target=resolve(outputDir);
  mkdirSync(target,{recursive:true,mode:0o700});
  const startedAt=new Date().toISOString();
  const indexes=await acquireCcIndexes(target,fetchImpl);
  const warcs=await acquireWarcSample(target,indexes,fetchImpl);
  const wayback=await acquireWaybackIndexes(target,fetchImpl);
  const publishers=await acquirePublisherPages(target,fetchImpl);
  const manifest={
    schema:SENATE_CAMPAIGN_PUBLIC_SOURCE_ACQUISITION_VERSION,
    startedAt,completedAt:new Date().toISOString(),
    scope:{issue:864,auditYears:[2024,2025],publicOnly:true,
      credentialsRead:false,productionReads:false,productionWrites:false,
      scheduledRun:false,activeBackfillEnabled:false,trainingOrServingChanged:false,
      officialCampaignSiteDenominatorCertified:false,
      locallyVerifiedHistoricalCandidatePageExcerptsAdmittedToForecast:0},
    totals:{
      attemptedCommonCrawlIndexQueries:indexes.length,
      commonCrawlIndexHttp200:indexes.filter(r=>r.response.status===200).length,
      commonCrawlIndexedPreVoteCandidateRecords:indexes.reduce((n,r)=>n+r.candidateWarcRecords.length,0),
      attemptedCommonCrawlOriginalWarcRanges:warcs.requestedWarcRanges,
      originalWarcHttp206Validated:warcs.outcomes.filter(r=>r.http206ByteRangeAndHeadersConsistent).length,
      locallyCrossCheckedWarcPagePayloads:warcs.outcomes.filter(r=>r.locallyCrossCheckedWarcProof!==null).length,
      attemptedWaybackIndexQueries:wayback.length,
      waybackIndexHttp200:wayback.filter(r=>r.response.status===200).length,
      waybackPreGeneralIndexCaptureCandidates:wayback.reduce((n,r)=>n+r.indexCaptureCandidatesStrictlyPreGeneral.length,0),
      publisherLivePagesDownloaded:publishers.filter(p=>p.retrievedSourceHtmlFile!==null).length,
      verifiedPreElectionCandidateAuthoredStatements:0,
    },
    sourceAuthorization:{
      originalHistoricalWebsiteBytesIndependentlyVerified:false,
      preElectionCandidateStatementProofCertified:false,
      fetchedArchiveIndexBodiesPreservedIfSuccessful:true,
      remoteArchiveHttpHeadersAndBodyHashesPreserved:true,
      sourceFirstPublicByDerivedFromDateInArticle:false,
      archiveSourceFailureDoesNotMeanZeroCaptures:true,
    },
    commonCrawlIndexes:indexes.map(({candidateWarcRecords,...x})=>({
      ...x,indexedCandidateWarcRows:candidateWarcRecords,
    })),
    commonCrawlWarcs:warcs,
    waybackIndexes:wayback,
    contemporaneouslyDatedPublisherPages:publishers,
  };
  const reportFile=saveBytes(target,'acquisition-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
  console.log('PUBLIC-SOURCE-ACQUISITION-SUMMARY '+JSON.stringify({
    ...manifest.totals,reportFile,outputDir:target,
    independentlyVerifiedPreVoteIssueStatements:0,
    corpusComplete:false,
  }));
  return manifest;
}
function option(name:string):string|undefined{
  const args=process.argv.slice(2);
  const at=args.indexOf(name);
  const value=at>=0?args[at+1]:args.find(v=>v.startsWith(name+'='))?.slice(name.length+1);
  return value&&!value.startsWith('--')?value:undefined;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/acquire-senate-campaign-public-archive-sources.ts')){
  const output=option('--output-dir');
  if(!output)throw new Error('--output-dir required');
  acquireSenateCampaignPublicSources(output).catch(err=>{
    console.error('Public-only archive acquisition failed:',err instanceof Error?err.message:'unknown failure');
    process.exitCode=1;
  });
}
