import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {runFourSenatorOriginalSpeakerTurns} from './probe-senate-media-four-more-original-mpr-speaker-turns.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/original-speaker-metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Cannot persist full original articles or transcripts');
const r=await runFourSenatorOriginalSpeakerTurns();
const receipt=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-four-more-original-mpr-speaker-turns-20261011.json',import.meta.url),'utf8'));
if(receipt.version!=='senate-media-four-other-senator-authenticated-original-mpr-speaker-turns-v1'
 ||receipt.sourceOriginalSpeakerTurnCaptures?.length!==r.results.length)throw Error('Pinned speaker-turn source receipt changed');
for(let i=0;i<r.results.length;i++){
 const v=r.results[i],p=receipt.sourceOriginalSpeakerTurnCaptures[i];
 if(v.id!==p.id||v.senator!==p.senator||v.firstPartyEpisodeUrl!==p.originalPublisherUrl
  ||v.originalArchiveUtc!==p.archivalCaptureUtc||v.indexedSourceOriginalSha1!==p.indexedOriginalSha1
  ||v.priorRawOriginalSha256!==p.rawOriginalHtmlSha256||v.priorOriginalBytes!==p.rawOriginalHtmlBytes)
   throw Error('Pinned original archived MPR source identity differs');
 if(v.replayStatus!=='sha1_sha256_and_bytes_reverified_original_mpr_html')continue;
 const x=v.speakerTurnIndicators;
 if(v.actualOriginalSha256!==p.rawOriginalHtmlSha256||v.actualOriginalBytes!==p.rawOriginalHtmlBytes
  ||x?.transcriptSectionHeadingVisible!==p.visibleAudioTranscriptHeading
  ||x?.senatorFullNameSpeakerLabelsInTranscript!==p.fullNameSenatorSpeakerLabelsInTranscript
  ||x?.selectedShortCueVisibleAnywhereOnOriginalPage!==p.selectedShortPhraseOnOriginalPage
  ||x?.selectedShortCueVisibleInsideTranscriptSection!==p.selectedShortPhraseWithinTranscript
  ||x?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn!==p.selectedShortPhraseInsideBoundedOwnSenatorTurn
  ||x?.selectedShortCueInsideOtherNamedSpeakerTurn!==p.selectedShortPhraseInOtherNamedTurn
  ||JSON.stringify(x?.selectedShortCueSpeakerTurnOwnerLabels)!==JSON.stringify(p.phraseOwnerSpeakerLabels))
   throw Error('Indexed original MPR speaker turn observed result shifted unexpectedly');
}
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
