import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {runOriginal2023KuneshSpeakerStudy} from './probe-senate-media-mpr-kunesh-2023-speaker-cues.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/public-source-metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('No original MPR page or transcript persistence');
const result=await runOriginal2023KuneshSpeakerStudy();
const pinned=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-mpr-kunesh-2023-original-in-turn-20261011.json',import.meta.url),'utf8'));
if(pinned.version!=='mpr-2023-original-kunesh-printed-two-policy-cues-public-provenance-v1'
 ||pinned.historicalCaptures?.length!==result.results.length)throw Error('Pinned original first-party MPR attribution scope changed');
for(let i=0;i<result.results.length;i++){
 const a=result.results[i],b=pinned.historicalCaptures[i];
 if(a.originalCaptureUtc!==b.captureUtc||a.originalSha1Base32!==b.indexedOriginalSha1Base32||a.originalRawSha256!==b.rawOriginalSha256
  ||a.originalBytes!==b.bytes||a.shortCues?.length!==b.studies.length)throw Error('Pinned original episode source identity drift');
 for(let j=0;j<a.shortCues.length;j++){
  const cue=a.shortCues[j],old=b.studies[j];
  if(cue.studyId!==old.shortPhraseStudyId)throw Error('Selected direct-speaker candidate was modified');
  if(!cue.originalReplayedAndSha1Sha256Matched)continue;
  if(cue.textVisibleOnPage!==old.selectedPhraseOnOriginalPage
   ||cue.selectedCueInPrintedAudioTranscript!==old.selectedPhraseInsideOriginalAudioTranscriptSection
   ||cue.selectedCueWithinExactMaryKuneshLabeledTranscriptTurn!==old.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn
   ||cue.selectedCueDistanceFromStartOfMaryTurn!==old.selectedPhraseDistanceFromStartOfNamedTurnCharacters
   ||JSON.stringify(cue.selectedCueOwnerLabels)!==JSON.stringify(old.selectedPhraseOwnerLabels))
    throw Error('Pinned original MPR source sentence turn attribution changed');
 }
}
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
