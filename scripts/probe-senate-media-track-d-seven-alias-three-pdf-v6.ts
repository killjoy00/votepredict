/**
 * #946/#987: public-only historical URL-alias and APM transcript-source audit.
 * Offline --preview is safe on PR. Real fixed 10 exact-index requests only
 * on first reviewed-main push with explicit marker and keyless CI success.
 * Neither archived PDF/HTML nor copied interview text is output or retained.
 */
import {appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {
 getTrackDHistoricalShadowPins,getTrackDPublicSpeakerTimingQueue,
} from './audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 TRACK_D_REMAINING_ORIGINAL_V6,TRACK_D_REMAINING_MAIN_MARKER,
 getRemainingAliasCandidates,fixedMprPdfTargets,
 runTrackDRemainingHistoricalOriginalProbe,
} from '../src/evaluation/senate-media-track-d-remaining-original-probe.js';

export function assertTrackDRemainingOriginalReviewedMain(env:NodeJS.ProcessEnv){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='push'||
  env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||
  env.TRACK_D_V6_KEYLESS_SUCCEEDED!=='true'||
  env.TRACK_D_V6_REVIEWED_MAIN_MARKER!=='true')
  throw Error('Unreviewed or repeated historic original archive request not permitted');
 return true;
}
export function validatePreviouslyKnownPdfEvidence(){
 const prev=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-mpr-hauschild-3play-transcript-pdf-provenance-20261011.json','utf8'));
 const later=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-mpr-2025-pha-coleman-3play-originals-20261011.json','utf8'));
 const pins=fixedMprPdfTargets();
 if(prev.version!=='mpr-hauschild-publisher-transcript-pdf-original-receipt-v1'||
  prev.pdfUrl!==pins[0]?.exactUrl||
  prev.currentPublisherPdf.sha256!==pins[0]?.independentlyPreviouslyRetrievedPdfSha256||
  prev.historicalOriginalPdf.captureUtc!==pins[0]?.previouslyAuthenticatedArchiveUtc||
  prev.historicalOriginalPdf.rawOriginalSha256!==pins[0]?.independentlyPreviouslyRetrievedPdfSha256||
  prev.historicalOriginalPdf.independentlyOriginalSha1Verified!==true||
  later.version!=='mpr-2025-pha-coleman-3play-pdf-public-hash-provenance-receipts-v1'||
  later.sources?.length!==2||
  later.sources.some((x:any,i:number)=>x.currentFirstPartyApm3PlayPdf!==pins[i+1]?.exactUrl||
   x.currentPdf.rawSha256!==pins[i+1]?.independentlyPreviouslyRetrievedPdfSha256||
   x.historic2025Wayback.authenticatedOriginalPdfCaptureCount!==0))
  throw Error('Previously independently vetted first-party MPR PDF source receipts changed');
 return true;
}
async function main(){
 let stage='validate_original_historical_public_receipts';
 try{
  if(process.argv.length!==3||
   !['--preview','--public-index-probe'].includes(process.argv[2]))
   throw Error('Only --preview or --public-index-probe modes supported');
  const pins=getTrackDHistoricalShadowPins();
  const alias=getRemainingAliasCandidates(pins);
  const speaker=getTrackDPublicSpeakerTimingQueue(pins);
  validatePreviouslyKnownPdfEvidence();
  if(alias.length!==7||speaker.humanApprovedFullQuotes!==0||
   speaker.historicalModelForecastSignalPromoted!==0||
   speaker.mpr2024Hauschild.firstSelectedCueLaterOriginalCaptureUtc!==
    '2025-07-24T23:23:22Z'||
   speaker.memberTermGuard.onArticlePublicationDayServingSenator!==false)
   throw Error('Human/speech/as-of proof boundary changed');
  if(process.argv[2]==='--preview'){
   console.log('TRACK_D_REMAINING_ORIGINAL_PREVIEW='+JSON.stringify({
    version:TRACK_D_REMAINING_ORIGINAL_V6,
    sevenSelectedReformerDatedUrlHypotheses:alias.map(x=>({
     publicBriefId:x.id,displayedPublicationDay:x.publisherDay,
    })),
    threeKnownExactMprTranscriptPdfs:fixedMprPdfTargets().map(x=>({
     publicSourceId:x.id,displayedPublicationDay:x.publisherDay,
    })),
    previouslyHumanApprovedSpeakerQuotes:0,forecastEligibilityAdded:0,
    plannedPublicExactIndexQueries:10,networkRequestsInPreview:0,
    productionWrites:0,
   }));
   return;
  }
  assertTrackDRemainingOriginalReviewedMain(process.env);
  stage='bounded_exact_wayback_historical_index_probes';
  const result=await runTrackDRemainingHistoricalOriginalProbe(pins);
  stage='public_metadata_only_result';
  const body=JSON.stringify(result);
  if(body.length>25000||
   /"(?:datedOriginalUrl|briefOriginalUrl|exactUrl|apiKey|secret|fullText|audioBytes|pdfBytes|htmlBytes|body)"\s*:/i.test(body)||
   result.directPublisherHttpRequests!==0||
   result.privateDatabaseSourceOrEvidenceReadsOrWrites!==0||
   result.forecastModelCollectorOrVercelWrites!==0||
   result.exactPublicIndexQueriesPlanned!==10)
   throw Error('Unexpected private/source bytes or scope outside metadata-only audit');
  console.log('TRACK_D_REMAINING_ORIGINAL_RESULT='+body);
  writeFileSync('track-d-946-987-v6-public-research-metadata.json',body+'\n',
   {encoding:'utf8',flag:'wx'});
  if(process.env.GITHUB_STEP_SUMMARY)
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## #946 / #987 historical original source-gap probe\n\n'+
    'Public-only exact seven Reformer dated original URLs and three exact pre-reviewed APM transcript PDFs.\n\n'+
    '| Dated HTML counterparts SHA1-reauthenticated | Reformer counterparts unresolved | MPR original PDFs SHA1-reauthenticated |\n'+
    '| ---: | ---: | ---: |\n'+
    '| '+result.reformerDatedUrlsWithIndependentlyAuthenticatedOriginalHtml+
    ' | '+result.reformerDatedUrlsWithUnresolvedOrUnverifiedOriginalHtml+
    ' | '+result.originalPdfArchiveVersionsAuthenticated+' |\n\n'+
    'An unavailable CDX endpoint or missing selected index is NOT proof of absent publication. '+
    'Zero automatic original article alias equivalences, historical quote approvals, forecast model changes, or DB writes.\n');
 }catch{
  console.error('TRACK_D_REMAINING_ORIGINAL_HOLD='+stage);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith(
 '/probe-senate-media-track-d-seven-alias-three-pdf-v6.ts'))
 void main();
