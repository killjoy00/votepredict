import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {researchMprHistoryBridge} from './probe-senate-media-mpr-history-bridge.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require --output artifacts/*.json');
const out=resolve(args[1]);
if(!out.startsWith(resolve(root,'artifacts')+'/')||!out.endsWith('.json'))throw Error('No raw publisher HTML, RSS or MP3 outputs');
const report=await researchMprHistoryBridge();
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({version:report.version,currentFeedStatus:report.currentPublisherPodcastFeed.status,
 currentFeedExactEpisodeCandidates:report.currentPublisherPodcastFeed.relevantFeedItems?.matchCountWithinFirstEight??null,
 historicalFeedIndex:report.historicallyReplayedPublisherFeed.indexStatus,
 historicalFeedCaptureSummaries:report.historicallyReplayedPublisherFeed.originalReplayAttempts.map(x=>({utc:x.captureUtc,status:x.status,matchingItems:x.relevantFeedItems?.matchCountWithinFirstEight??null})),
 alternativeHistoricalPageUrlStatuses:report.separatelyIndexedHistoricPageUrlHypotheses.map(x=>({url:x.url,index:x.indexStatus,authenticBodies:x.originalReplayAttempts.filter(r=>r.status==='authenticated_original_html').length,transcriptCues:x.originalReplayAttempts.map(r=>({utc:r.captureUtc,cues:r.pageMetadata?.selectedTranscriptTextCues??null,status:r.status}))})),
 exactPinned2025BodyMetadataStatus:report.previouslyShaPinnedJuly2025HtmlMetadataRecheck.status,
 sourceAudioRedirects:report.originalPageLinkedFirstPartyMp3RedirectChecks.map(x=>({source:x.sourceId,statuses:x.redirectSteps.map(y=>({status:y.status,host:y.host??null})),currentSha256:x.publisherCurrentAudioSha256})),
 storedPublisherRawHtmlOrMp3:false}));
