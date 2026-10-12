import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runFourSenatorOriginalSpeakerTurns} from './probe-senate-media-four-more-original-mpr-speaker-turns.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/original-speaker-metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Cannot persist full original articles or transcripts');
const r=await runFourSenatorOriginalSpeakerTurns();
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(r,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({
 version:r.version,persons:r.selectedFourDistinctServingSenatorInterviewUrls,originals:r.knownIndexedSourceOriginalHtmlVersions,
 sha1Sha256OriginalsReverified:r.sourceVersionsRawSha1Sha256Reverified,
 genuinePrintedNamedTurnShortCues:r.sameFullNameSpeakerTurnShortPhraseAuthenticated,
 results:r.results.map(v=>({
  id:v.id,senator:v.senator,archiveUtc:v.originalArchiveUtc,sourceStatus:v.replayStatus,
  originalSourceSha256:v.actualOriginalSha256,bytes:v.actualOriginalBytes,
  transcriptSectionSeen:v.speakerTurnIndicators?.transcriptSectionHeadingVisible??null,
  printedNamedTurnCount:v.speakerTurnIndicators?.senatorFullNameSpeakerLabelsInTranscript??null,
  selectedPhraseOnPage:v.speakerTurnIndicators?.selectedShortCueVisibleAnywhereOnOriginalPage??null,
  selectedPhraseInsidePrintedTranscript:v.speakerTurnIndicators?.selectedShortCueVisibleInsideTranscriptSection??null,
  selectedPhraseInSameSenatorTurn:v.speakerTurnIndicators?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn??null,
  selectedPhraseInOtherLabeledTurn:v.speakerTurnIndicators?.selectedShortCueInsideOtherNamedSpeakerTurn??null,
  selectedPhraseOwnerLabels:v.speakerTurnIndicators?.selectedShortCueSpeakerTurnOwnerLabels??null
 })),
 noOriginalAudioVerbatimQuoteMemberRecordedVoteOrModelInputCertified:true
}));
