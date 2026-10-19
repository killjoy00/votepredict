import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {
 getTrackDHistoricalShadowPins,
} from '../scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 TRACK_D_REMAINING_ORIGINAL_V6,TRACK_D_REMAINING_MAIN_MARKER,
 getRemainingAliasCandidates,fixedMprPdfTargets,
 parseExactPdfIndex,auditExactHistoricalPdf,auditReformerDatedOriginal,
 runTrackDRemainingHistoricalOriginalProbe,
} from '../src/evaluation/senate-media-track-d-remaining-original-probe.js';
import {
 assertTrackDRemainingOriginalReviewedMain,validatePreviouslyKnownPdfEvidence,
} from '../scripts/probe-senate-media-track-d-seven-alias-three-pdf-v6.js';
import type {
 PublicCdxIndexResult,PublicCdxCaptureCandidate,PublicCdxReplayResult,
 PublicMediaResearchLead,
} from '../src/evidence/senate-media-public-wayback-probe.js';

const pins=getTrackDHistoricalShadowPins();
const aliases=getRemainingAliasCandidates(pins);
const pdfs=fixedMprPdfTargets();
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32=(body:Uint8Array)=>{
 let out='',val=0,bits=0;
 for(const x of createHash('sha1').update(body).digest()){
  val=val<<8|x;bits+=8;
  while(bits>=5){bits-=5;out+=B32[val>>>bits&31];}
  val&=(1<<bits)-1;
 }
 if(bits)out+=B32[(val<<(5-bits))&31];
 return out;
};
const syntheticIndex=async (lead:PublicMediaResearchLead):Promise<PublicCdxIndexResult>=>{
 const ts=lead.publicationDayDisplayedOnPublicPage.replaceAll('-','')+'010000';
 const utc=lead.publicationDayDisplayedOnPublicPage+'T01:00:00Z';
 const c:PublicCdxCaptureCandidate={
  leadId:lead.id,originalUrl:lead.livePageUrl,timestamp:ts,
  archiveCapturedAt:utc,
  archiveUrl:'https://web.archive.org/web/'+ts+'id_/'+lead.livePageUrl,
  mimeType:'text/html',indexedPayloadSha1Base32:'A'.repeat(32),
  cdxRecordLength:null,indexedOriginalStatusCode:'200',
  historicCaptureYear:Number(ts.slice(0,4)),
  replayBytesAuthenticated:false,sourceDocumentsSha256Matched:false,
  senatorQuotationHumanVerified:false,
 };
 return{
  version:'senate-media-public-exact-cdx-proof-v1',
  leadId:lead.id,originalUrl:lead.livePageUrl,
  queriedFromYear:2021,queriedThroughYear:2025,
  status:'index_candidates',
  resultLimitReachedMayHaveMoreCaptures:false,captures:[c],
  originalHttpResponseBytesVerified:0,sourceDocumentsMatched:0,
  humanAttributedSenatorQuotesVerified:0,
  historicalFirstPublisherPublicByProven:false,
  historicArticleOrPublisherCensusEstablished:false,
 };
};
const syntheticReplay=async(c:PublicCdxCaptureCandidate):Promise<PublicCdxReplayResult>=>({
 leadId:c.leadId,archiveUrl:c.archiveUrl,archiveCapturedAt:c.archiveCapturedAt,
 status:'matched_indexed_payload_sha1',matchedArchivedIndexPayload:true,
 observedRawBodyBytes:72000,observedRawBodySha256:'a'.repeat(64),
 privateVotePredictSourceDocumentMatched:false,
 publisherInitialPublicationTimeProven:false,
 archivedAudioOrTranscriptAvailableAtCaptureProven:false,
 exactSenatorQuoteHumanVerified:false,historicalForecastEligibilityProven:false,
});

test('seven Reformer historic dated aliases derive from exact immutable prior /briefs/ SHA-pins',()=>{
 assert.equal(aliases.length,7);
 assert.equal(new Set(aliases.map(p=>p.briefOriginalUrl)).size,7);
 assert.equal(new Set(aliases.map(p=>p.datedOriginalUrl)).size,7);
 assert.deepEqual([...new Set(aliases.map(x=>Number(x.publisherDay.slice(0,4))))].sort(),
  [2021,2022,2023,2024,2025]);
 assert.ok(aliases.every(p=>p.issue===946&&
  p.briefOriginalUrl.startsWith('https://minnesotareformer.com/briefs/')&&
  p.datedOriginalUrl.startsWith('https://minnesotareformer.com/20')&&
  p.briefArchiveUtc.startsWith('20')&&p.briefArchiveUtc<='2025-12-31T23:59:59Z'));
 assert.equal(aliases.filter(p=>p.briefOriginalUrl.includes('sanctuary-state-bill')).length,1);
});
test('MPR transcript PDFs are exactly original prior first-party source receipts',()=>{
 assert.equal(validatePreviouslyKnownPdfEvidence(),true);
 assert.equal(pdfs.length,3);
 assert.deepEqual(pdfs.map(x=>x.publisherDay),['2024-02-19','2025-04-24','2025-09-11']);
 assert.ok(pdfs.every(x=>x.exactUrl.startsWith('https://codytranscripts.apmcdn.org/production/')));
 assert.equal(pdfs.filter(x=>x.previouslyAuthenticatedArchiveUtc!==null).length,1);
});
test('untrusted CDX rows cannot impersonate same historical PDF original URL or timestamp',()=>{
 const p=pdfs[0]!;
 const headings=['timestamp','original','mimetype','statuscode','digest','length'];
 const row=['20250727180908',p.exactUrl,'application/octet-stream','200',
  'S2P5473SIZ7Z6ZDAX4AJF7TMK2VFPXOZ','32785'];
 assert.equal(parseExactPdfIndex([headings,row],p).length,1);
 assert.throws(()=>parseExactPdfIndex([headings,[...row.slice(0,1),
  'https://evil.test/other.pdf',...row.slice(2)]],p),/provenance/);
 assert.throws(()=>parseExactPdfIndex([headings,['20260210180000',...row.slice(1)]],p),
  /outside 2021/);
 assert.throws(()=>parseExactPdfIndex([headings,['20240230180908',...row.slice(1)]],p),
  /Invalid or rolled/);
 assert.throws(()=>parseExactPdfIndex([headings,[...row.slice(0,3),'302',...row.slice(4)]],p),
  /provenance/);
});
test('an authentic indexed original PDF is separately proven but never promoted to public-by or speaker words',async()=>{
 const pin=pdfs[0]!;
 const raw=Buffer.from('%PDF-1.4\n'+('fixed-historic-synthetic-pdf-contents'.repeat(5))+'\n%%EOF');
 const digest=base32(raw);
 let requests=0;
 const f=(async (url:string)=>{
  requests++;
  if(url.startsWith('https://web.archive.org/cdx/search/cdx'))
   return new Response(JSON.stringify([
    ['timestamp','original','mimetype','statuscode','digest','length'],
    ['20240801010101',pin.exactUrl,'application/pdf','200',digest,String(raw.length)],
   ]),{status:200,headers:{'content-type':'application/json'}});
  assert.equal(url,'https://web.archive.org/web/20240801010101id_/'+pin.exactUrl);
  return new Response(raw,{status:200,headers:{'content-type':'application/pdf'}});
 }) as typeof fetch;
 const r=await auditExactHistoricalPdf(pin,f);
 assert.equal(requests,2);
 assert.equal(r.indexStatus,'index_candidates');
 assert.equal(r.selectedOriginals.length,1);
 assert.equal(r.selectedOriginals[0]!.status,'sha1_indexed_original_pdf_authenticated');
 assert.equal(r.selectedOriginals[0]!.rawBodySha256,createHash('sha256').update(raw).digest('hex'));
 assert.equal(r.selectedOriginals[0]!.byteIdenticalToEarlierPublisherOriginalReceipt,false);
 assert.equal(r.selectedOriginals[0]!.observedOriginalBeforePreviouslyKnownArchive,true);
});
test('CDX outage remains UNKNOWN, malformed/non-original body is quarantined or unknown',async()=>{
 const p=pdfs[1]!;
 const f=(async()=>new Response('Temporarily unavailable',
  {status:503,headers:{'content-type':'text/plain'}})) as typeof fetch;
 const result=await auditExactHistoricalPdf(p,f);
 assert.equal(result.indexStatus,'index_unavailable_unknown');
 assert.equal(result.indexedOriginalCount,null);
 assert.equal(result.selectedOriginals.length,0);
});
test('exact dated URL public SHA1 result is two-sided source availability, NOT a proven article alias',async()=>{
 const a=aliases[0]!;
 const result=await auditReformerDatedOriginal(a,fetch,syntheticIndex,syntheticReplay);
 assert.equal(result.datedOriginalIndexStatus,'index_candidates');
 assert.equal(result.datedReplays.length,1);
 assert.equal(result.datedReplays[0]!.status,'dated_original_sha1_indexed_original_authenticated');
 assert.equal(result.bothOriginalPathVersionsAuthenticatedInResearch,true);
 assert.equal(result.historicallySameArticleNotEstablished,true);
 assert.equal(result.automaticallyDeduplicatedArticleCount,0);
 const unavailable=await auditReformerDatedOriginal(a,fetch,
  async()=>{throw Error('index unavailable')},syntheticReplay);
 assert.equal(unavailable.datedOriginalIndexStatus,'index_unavailable_unknown');
 assert.equal(unavailable.bothOriginalPathVersionsAuthenticatedInResearch,false);
});
test('entire bounded research run never certifies quote, audio, historical alias identity or forecast',async()=>{
 let pauses=0,pdfCalls=0;
 const result=await runTrackDRemainingHistoricalOriginalProbe(
  pins,fetch,syntheticIndex,syntheticReplay,
  async (pin)=>{
   pdfCalls++;
   return{
    indexStatus:'index_unavailable_unknown' as const,indexedOriginalCount:null,
    boundedFirstPageMayBeIncomplete:false,
    selectedOriginals:[] as Awaited<ReturnType<typeof auditExactHistoricalPdf>>['selectedOriginals'],
   };
  },async()=>{pauses++});
 assert.equal(result.version,TRACK_D_REMAINING_ORIGINAL_V6);
 assert.equal(pdfCalls,3);
 assert.equal(pauses,9);
 assert.equal(result.exactPublicIndexQueriesPlanned,10);
 assert.equal(result.reformerDatedUrlsWithIndependentlyAuthenticatedOriginalHtml,7);
 assert.equal(result.originalPdfArchiveVersionsAuthenticated,0);
 assert.equal(result.reformerHistoricalAliasIdentitiesVerifiedAndApproved,0);
 assert.equal(result.automaticArticleAliasDeduplication,0);
 assert.equal(result.fullSpeakerUtterancesHumanApproved,0);
 assert.equal(result.retrospectiveAsOfFeatureOrActualVoteApproved,0);
 assert.equal(result.rawPdfAudioOrArticleHtmlPersisted,false);
 assert.equal(result.directPublisherHttpRequests,0);
 assert.equal(result.privateDatabaseSourceOrEvidenceReadsOrWrites,0);
});
test('main archive original probes only after reviewed CI-marked, exact first main attempt',()=>{
 const ok:NodeJS.ProcessEnv={
  NODE_ENV:'test',GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  TRACK_D_V6_KEYLESS_SUCCEEDED:'true',TRACK_D_V6_REVIEWED_MAIN_MARKER:'true',
 };
 assert.equal(TRACK_D_REMAINING_MAIN_MARKER,'TRACK_D_946_987_REMAINING_ORIGINAL_V6_20261019');
 assert.equal(assertTrackDRemainingOriginalReviewedMain(ok),true);
 for(const fail of [
  {GITHUB_REPOSITORY:'untrusted/fork'},{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REF:'refs/heads/other'},
  {TRACK_D_V6_KEYLESS_SUCCEEDED:'false'},
  {TRACK_D_V6_REVIEWED_MAIN_MARKER:'false'},
 ]){
  assert.throws(()=>assertTrackDRemainingOriginalReviewedMain({...ok,...fail}),/not permitted/);
 }
});
test('offline preview does not query a network, publisher, private database, or audio resource',()=>{
 const text=execFileSync(process.execPath,['--import','tsx',
  'scripts/probe-senate-media-track-d-seven-alias-three-pdf-v6.ts','--preview'],
  {encoding:'utf8',timeout:30000});
 assert.match(text,/TRACK_D_REMAINING_ORIGINAL_PREVIEW=/);
 const o=JSON.parse(text.trim().split('TRACK_D_REMAINING_ORIGINAL_PREVIEW=')[1]!);
 assert.equal(o.sevenSelectedReformerDatedUrlHypotheses.length,7);
 assert.equal(o.threeKnownExactMprTranscriptPdfs.length,3);
 assert.equal(o.plannedPublicExactIndexQueries,10);
 assert.equal(o.networkRequestsInPreview,0);
 assert.equal(o.forecastEligibilityAdded,0);
});
