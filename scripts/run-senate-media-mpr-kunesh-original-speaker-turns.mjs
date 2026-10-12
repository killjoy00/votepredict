import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync,mkdirSync} from 'node:fs';
import {runKuneshSpeakerTurnProof} from './probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require only --output artifacts/metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Only public original metadata JSON under artifacts permitted');
const r=await runKuneshSpeakerTurnProof();
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
