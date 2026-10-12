import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runOriginal2023KuneshSpeakerStudy} from './probe-senate-media-mpr-kunesh-2023-speaker-cues.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/public-source-metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('No original MPR page or transcript persistence');
const result=await runOriginal2023KuneshSpeakerStudy();
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({
 version:result.version,
 original2023ArchiveVersions:result.exactOriginalArchiveBodiesSelected,
 exactOriginalHtmlSha1Sha256Replays:result.totalOriginalShaMatchedReplays,
 first2023OriginalSpeakerCues:result.first2023OriginalPrintedSpeakerCuesAuthenticated,
 sourceResults:result.results.map(s=>({utc:s.originalCaptureUtc,originalAllShaVerified:s.allShortCueOriginalBodyReplaysSha1Sha256Matched,
  study:s.shortCues.map(q=>({id:q.studyId,status:q.sourceReplayStatus,
   foundPage:q.textVisibleOnPage,foundPrintedTranscript:q.selectedCueInPrintedAudioTranscript,
   insideNamedKuneshTurn:q.selectedCueWithinExactMaryKuneshLabeledTranscriptTurn,
   ownerLabels:q.selectedCueOwnerLabels,distanceFromTurnStart:q.selectedCueDistanceFromStartOfMaryTurn}))
 })),
 fullSpeakerQuoteOrAudioOrMemberVotesHumanVerified:0,noPrivateDBOrProductionChanges:true
}));
