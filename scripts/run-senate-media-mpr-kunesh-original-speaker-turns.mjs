import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {runKuneshSpeakerTurnProof} from './probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require only --output artifacts/metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Only public original metadata JSON under artifacts permitted');
const r=await runKuneshSpeakerTurnProof();
const prior=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-mpr-kunesh-original-speaker-turns-20261011.json',import.meta.url),'utf8'));
if(prior.version!=='mpr-kunesh-2023-2024-original-speaker-turn-receipts-v1' ||prior.originals?.length!==r.results.length)throw Error('Pinned public source proof changed');
for(let i=0;i<r.results.length;i++){
 const now=r.results[i],saved=prior.originals[i];
 if(now.leadId!==saved.leadId||now.archivedCaptureUtc!==saved.archivedCaptureUtc
  ||now.priorIndexedSha1!==saved.indexedSha1Base32||now.priorOriginalSha256!==saved.rawOriginalHtmlSha256)throw Error('Original source identity changed');
 if(now.status!=='sha1_and_sha256_reverified_same_original_html')continue;
 const c=now.turnIndicators;
 if(now.reverifiedRawSha256!==saved.rawOriginalHtmlSha256||now.reverifiedRawBytes!==saved.rawOriginalHtmlBytes
  ||c?.transcriptSectionHeadingVisible!==saved.visibleAudioTranscriptSection
  ||c?.senatorFullNameSpeakerLabelsInTranscript!==saved.maryKuneshSpeakerLabelsInTranscript
  ||c?.selectedShortCueVisibleAnywhereOnOriginalPage!==saved.selectedShortCueVisibleOnPage
  ||c?.selectedShortCueVisibleInsideTranscriptSection!==saved.selectedShortCueInsideTranscriptSection
  ||c?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn!==saved.selectedShortCueWithinMaryKuneshLabeledTurn
  ||c?.selectedShortCueCharacterDistanceFromStartOfTurn!==saved.selectedShortCueOffsetInLabeledTurnChars
  ||JSON.stringify(c?.selectedShortCueSpeakerTurnOwnerLabels)!==JSON.stringify(saved.selectedCueOwnerLabeledSpeakerTurns))
    throw Error('Historical transcript boundaries shifted despite same public original hash: requires new provenance review');
}
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({
 version:r.version,selectedOriginalHtmlCaptures:r.originalPublicSourceDocumentCount,
 successfullyReverifiedSha1Sha256OriginalBodies:r.verifiedOriginalHtmlRawBodyCount,
 historicallyAuthenticatedBoundedSameSpeakerTurnCueCandidates:r.candidateSameLabeledSpeakerTurnCount,
 results:r.results.map(x=>({
  source:x.leadId,archivedUtc:x.archivedCaptureUtc,status:x.status,
  speakerCueWithinSameTurn:x.turnIndicators?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn??null,
  transcriptSectionFound:x.turnIndicators?.transcriptSectionHeadingVisible??null,
  selectedCueOnPage:x.turnIndicators?.selectedShortCueVisibleAnywhereOnOriginalPage??null,
  cueWithinTranscript:x.turnIndicators?.selectedShortCueVisibleInsideTranscriptSection??null,
  phraseTurnOwnerLabels:x.turnIndicators?.selectedShortCueSpeakerTurnOwnerLabels??null,
  cueNotInAnyBoundedTurn:x.turnIndicators?.selectedShortCueOutsideAllBoundedSpeakerTurns??null,
  labels:x.turnIndicators?.senatorFullNameSpeakerLabelsInTranscript??null
 })),
 noFullTranscriptOrOriginalHtmlOrAudioPersisted:true,noPrivateDbOrRecordedVoteOrModelChanges:true
}));
