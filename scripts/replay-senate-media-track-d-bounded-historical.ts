/**
 * #946/#987: reviewed-main one-shot 22-version PUBLIC Wayback-only capture.
 * --preview remains offline. --capture requires successful independent CI
 * and exact reviewed main marker. No credentials, production writes or quotes.
 */
import {appendFileSync,writeFileSync} from 'node:fs';
import {
 getTrackDHistoricalShadowPins,getTrackDPublicSpeakerTimingQueue,
} from './audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 TRACK_D_BOUNDED_CAPTURE_MAIN_MARKER,
 TRACK_D_BOUNDED_CAPTURE_VERSION,
 selectTrackDBoundedHistoricalPins,runTrackDBoundedHistoricalCapture,
} from '../src/evaluation/senate-media-track-d-bounded-archive-capture.js';

export function assertTrackDBoundedCaptureReviewedMain(
 e:NodeJS.ProcessEnv,
){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_ACTIONS!=='true'||
  e.GITHUB_EVENT_NAME!=='push'||
  e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||
  e.TRACK_D_V5_PUBLIC_KEYLESS_CHECKS_PASSED!=='true'||
  e.TRACK_D_V5_REVIEWED_MAIN_MARKER_PRESENT!=='true')
  throw Error('Unreviewed or repeating public archive capture is blocked');
 return true;
}

async function main(){
 let stage='read_immutable_public_historical_origins';
 try{
  if(process.argv.length!==3||
   !['--preview','--capture'].includes(process.argv[2]))
   throw Error('Only --preview or --capture allowed');
  const pins=getTrackDHistoricalShadowPins();
  const selected=selectTrackDBoundedHistoricalPins(pins);
  const human=getTrackDPublicSpeakerTimingQueue(pins);
  if(selected.length!==22||human.humanApprovedFullQuotes!==0||
   human.historicalModelForecastSignalPromoted!==0||
   human.memberTermGuard.onArticlePublicationDayServingSenator!==false||
   human.mpr2024Hauschild.firstSelectedCueLaterOriginalCaptureUtc!==
    '2025-07-24T23:23:22Z')
   throw Error('Historical version, speaker, or member-date guards changed');
  if(process.argv[2]==='--preview'){
   console.log('TRACK_D_BOUNDED_HISTORICAL_CAPTURE_PREVIEW='+JSON.stringify({
    version:TRACK_D_BOUNDED_CAPTURE_VERSION,
    archiveVersions:22,uniquePublisherUrls:16,
    reformerArchiveVersions:17,mprEpisodeVersions:5,
    historicalBriefDatedAliasHypotheses:7,
    independentlyProvedHistoricTwoSidedAliases:0,
    publisherInitialPostingClocksAuthenticated:0,
    humanApprovedWholeSpokenSenatorQuotes:0,
    forecastEligibleSources:0,productionWrites:0,
    plannedArchiveGetRequests:22,newCdxOrPublisherRequests:0,
   }));
   return;
  }
  assertTrackDBoundedCaptureReviewedMain(process.env);
  stage='public_wayback_original_capture_only';
  const report=await runTrackDBoundedHistoricalCapture(pins);
  stage='safe_public_metadata_receipt';
  const safe=JSON.stringify(report);
  if(safe.length>26000||
   /"(?:originalUrl|archiveUrl|rawSha256|sourceDocumentId|evidenceId|password|apiKey|body|html)"\s*:/i.test(safe)||
   report.directPublisherRequests!==0||report.cdxQueries!==0||
   report.privateDatabaseReadsOrWrites!==0||
   report.sourceOrModelOrCollectorConfigurationWrites!==0||
   report.originalArchiveGetRequestsAttempted!==22)
   throw Error('Archived article bytes, private data or unexpected side effect in receipt');
  console.log('TRACK_D_BOUNDED_HISTORICAL_CAPTURE='+safe);
  writeFileSync('track-d-946-987-bounded-capture-metadata.json',safe+'\n',{encoding:'utf8',flag:'wx'});
  if(process.env.GITHUB_STEP_SUMMARY){
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## #946 / #987 bounded historical source capture\n\n'+
    '22 independently pinned, historical public Wayback HTML originals; '+
    'source versions are not distinct news articles.\n\n'+
    '| Historical originals | Verified SHA1 + SHA256 | Unavailable / unknown | Quarantined mismatch |\n'+
    '| ---: | ---: | ---: | ---: |\n'+
    '| '+report.originalArchiveGetRequestsAttempted+' | '+
    report.matchedPinnedSha1AndSha256+' | '+report.archiveUnavailableOrUncertain+
    ' | '+report.mismatchedAndQuarantined+' |\n\n'+
    'Seven dated-alias hypotheses remain unresolved, zero quotes/member identities approved, '+
    'zero production source/model/forecast writes. Archive observation is not initial publication.\n');
  }
 }catch{
  console.error('TRACK_D_BOUNDED_HISTORICAL_CAPTURE_HOLD='+stage);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith(
 '/replay-senate-media-track-d-bounded-historical.ts'))
 void main();
