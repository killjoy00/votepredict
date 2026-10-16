import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runSixMprInterviews} from './probe-senate-media-mpr-six-interviews-originals.mjs';
import {reconcileSelectedPublicCoverage} from './reconcile-senate-media-mpr-interviews-public.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
if(argv.length!==2||argv[0]!=='--output'||!argv[1])throw Error('Only --output artifacts/<name>.json');
const target=resolve(argv[1]);
if(!target.startsWith(resolve(root,'artifacts')+'/')||!target.endsWith('.json'))throw Error('Original media/raw html/private report output prohibited');
const live=await runSixMprInterviews();
const reconciliation=reconcileSelectedPublicCoverage(live);
mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,JSON.stringify({version:'mpr-six-interviews-public-originals-and-covered-gates-v1',live,reconciliation},null,2)+'\n',
 {flag:'wx',mode:0o600});
console.log(JSON.stringify({
 sourceCount:live.boundedSelectedInterviewUrls,namedIntervieweeTurns:live.namedArticleSpeakerCandidateTurns,
 previousPublicOriginals:reconciliation.priorPublicOriginalHtmlCaptureReceipts,
 excludedByCurrentSeedPrefix:reconciliation.collectorExcludedByCurrentExactSeedPrefix,
 excludedByCurrentTopicGate:reconciliation.collectorExcludedByCurrentTopicalPriority,
 newlyAuthenticatedRawOriginalHtmlBodies:live.historicallyAuthenticatedArchiveBodies,
 liveDistinctBodiesNotEqualToSingleEarlierPublicReceipt:reconciliation.additionalLiveHistoricalOriginalHtmlSha256IdentitiesBeyondSinglePreviousPinnedSnapshot,
 sources:live.sourcePages.map(x=>({
  id:x.leadId,year:x.displayedPublisherDay.slice(0,4),
  currentStatus:x.current.status,
  currentSelectedSpeakerCues:x.current.shortSpeechCues?.selectedSpeakerTurnCandidateObservations??null,
  WaybackIndex:x.waybackOriginal.indexStatus,
  WaybackOriginals:x.waybackOriginal.originalHtmlReplayAttempts.map(v=>({utc:v.captureUtc,status:v.status,shortCues:v.shortCues?.map(q=>q.cueFound)??null})),
  commonCrawl:x.commonCrawlOriginal.queriedCollections.map(c=>({collection:c.collection,index:c.indexStatus,
   originals:c.originalWarcReplayAttempts.map(y=>({utc:y.captureUtc,status:y.status,shortCues:y.shortCues?.map(q=>q.cueFound)??null}))})),
  genuinePriorPublicOriginalReceipt:reconciliation.publicCoverageRows.find(r=>r.selectedLeadId===x.leadId)?.priorPublicOriginalCaptureReceipt?.captureUtc??null
 })),
 privateDatabaseCoverageUnknown:true,individualSenatorQuotesHumanApproved:0,noProductionDataTouched:true
}));
