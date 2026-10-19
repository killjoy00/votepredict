/**
 * Issues #946/#987: read-only, PUBLIC Wayback exact-original canaries only.
 * No DB credential, source persistence, unbounded CDX, redirect, publisher
 * fetch, human quote approval, ingestion, serving or model change.
 * --preview: offline. --network-canary: five previously authenticated
 * original HTML archive URLs on single reviewed main push, once per year.
 */
import {appendFileSync} from 'node:fs';
import {getTrackDHistoricalShadowPins} from
 './audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 buildTrackDOriginalReplayPilotPlan,
 summarizeTrackDOriginalReplayPilotPlan,
 selectTrackDCanaryPins,replayTrackDPublicCanary,
 TRACK_D_ORIGINAL_REPLAY_PILOT_VERSION,
} from '../src/evaluation/senate-media-track-d-original-replay-pilot.js';

export const TRACK_D_CANARY_MAIN_MARKER=
 'TRACK_D_946_987_ORIGINAL_REPLAY_CANARY_V4_20261018';
export function assertTrackDPublicOriginalCanaryMainRun(
 env:NodeJS.ProcessEnv,
){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  env.GITHUB_ACTIONS!=='true'||
  env.GITHUB_EVENT_NAME!=='push'||
  env.GITHUB_REF!=='refs/heads/main'||
  env.GITHUB_RUN_ATTEMPT!=='1'||
  env.TRACK_D_CANARY_PUBLIC_KEYLESS_OK!=='true'||
  env.TRACK_D_CANARY_REVIEWED_MAIN_MARKER!=='true')
  throw Error('Unreviewed / repeat live historical Wayback replay blocked');
 return true;
}
export async function replayTrackDReviewedCanarySet(
 pins:ReturnType<typeof getTrackDHistoricalShadowPins>,
 probe:typeof replayTrackDPublicCanary=replayTrackDPublicCanary,
 pause:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,1500)),
){
 const selected=selectTrackDCanaryPins(pins);
 if(selected.length!==5)throw Error('Bounded original replay schedule changed');
 const results=[];
 for(let i=0;i<selected.length;i++){
  if(i>0)await pause();
  results.push(await probe(selected[i]!));
 }
 if(results.length!==5||results.some(x=>!x.zeroWritesToVotePredict||x.articleEligibleForForecast))
  throw Error('Live original replay escaped metadata-only policy');
 return{
  version:TRACK_D_ORIGINAL_REPLAY_PILOT_VERSION,
  status:'public_original_replay_canary_only',
  originalArchiveHttpRequestsAttempted:5,
  distinctSourceYears:[2021,2022,2023,2024,2025],
  reauthenticatedRawSha1AndSha256:results.filter(x=>
    x.outcome==='pinned_original_sha256_reauthenticated').length,
  unavailableOriginalVersions:results.filter(x=>
    x.outcome==='archive_original_temporarily_unavailable').length,
  quarantinedIndexedDigestOrRawBodyMismatches:results.filter(x=>
    x.outcome==='indexed_original_replay_mismatch_quarantined').length,
  perPublicSourceVersion:results,
  allRepliesFromPreviouslyValidatedFixedArchiveUrls:true,
  originalHttpBytesOutputOrPersisted:false,
  originalPublisherRobotsCannotBeBypassedThroughAlternateHosts:true,
  noDirectPublisherOrExternalAudioRequests:true,
  zeroPrivateSourceDocumentOrEvidenceReads:true,
  noProductionConfigurationWrites:true,
  sourceHtmlArchiveCaptureNotOriginalPublicationTime:true,
  humanVerifiedFullQuotesOrModelSignalsAdded:0,
 };
}
async function main(){
 let stage='static_historical_sha_receipts';
 try{
  if(process.argv.length!==3||
   !['--preview','--network-canary'].includes(process.argv[2]))
   throw Error('Accepted modes: --preview or --network-canary');
  const pins=getTrackDHistoricalShadowPins();
  const plan=buildTrackDOriginalReplayPilotPlan(pins);
  if(plan.length!==22)throw Error('Vetted offline pilot count changed');
  if(process.argv[2]==='--preview'){
   console.log('TRACK_D_946_987_ARCHIVE_PILOT_OFFLINE='+
    JSON.stringify(summarizeTrackDOriginalReplayPilotPlan(pins)));
   return;
  }
  assertTrackDPublicOriginalCanaryMainRun(process.env);
  stage='bounded_public_archive_replay_only';
  const report=await replayTrackDReviewedCanarySet(pins);
  stage='metadata_only_original_replay_receipt';
  const safe=JSON.stringify(report);
  if(safe.length>9000||
   /"(?:(?:original|archive)(?:Url|URL)|raw(?:Body)?Sha256|sourceDocumentId|evidenceId|password|apiKey|body|html)"\s*:/i.test(safe))
   throw Error('Unexpected source content in public metadata receipt');
  console.log('TRACK_D_946_987_ORIGINAL_REPLAY_CANARY='+safe);
  if(process.env.GITHUB_STEP_SUMMARY){
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '#946 / #987 public-only historical archive replay canary\n\n'+
    'Five *previously authenticated* exact URLs; one per 2021–25 displayed year. '+
    'Historical archive service availability is not publisher first posting.\n\n'+
    '| Same archived raw SHA | Unavailable / uncertain | Digest mismatch quarantined |\n'+
    '| ---: | ---: | ---: |\n'+
    '| '+report.reauthenticatedRawSha1AndSha256+' | '+report.unavailableOriginalVersions+
    ' | '+report.quarantinedIndexedDigestOrRawBodyMismatches+' |\n\n'+
    'No collector, production database, quote, forecast or source configuration write.\n');
  }
 }catch{
  console.error('TRACK_D_946_987_ORIGINAL_REPLAY_CANARY_HOLD='+stage);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith(
 '/replay-senate-media-track-d-historical-canaries.ts'))
 void main();
