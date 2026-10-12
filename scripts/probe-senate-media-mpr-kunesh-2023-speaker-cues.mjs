/**
 * Evidence-only original-2023 MPR Kunesh utterance/source-turn experiment.
 * Choose two short phrases solely from the CURRENT first-party MPR transcript,
 * distinct from its news-summary paragraph; require each to occur INSIDE a
 * complete MARY KUNESH: label in two previously SHA1+SHA256 authenticated
 * original 2023 episode HTML versions. Reporter-summary cue is negative control.
 *
 * A printed speaker-labeled MPR original is NOT historical audio SHA,
 * independently human-certified verbatim full quotation or member vote.
 * Source bodies are consumed in memory, never persisted.
 */
import {readFileSync} from 'node:fs';
import {publicPinnedOriginals,reverifyPinnedOriginalSpeakerTurn} from './probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
export const VERSION='mpr-2023-kunesh-speaker-printed-passages-on-original-html-v1';
export const STUDY=Object.freeze([
 Object.freeze({
  id:'native-tribal-sovereignty',
  shortPhrase:'it mandates our state interest in preserving our tribal identity',
  role:'selected_short_senator_printed_transcript_candidate',
  issue:'tribal_sovereignty_child_welfare'
 }),
 Object.freeze({
  id:'native-family-first-placement',
  shortPhrase:"we are also making sure it's like a family first placement",
  role:'selected_short_senator_printed_transcript_candidate',
  issue:'family_first_native_child_placement'
 }),
 Object.freeze({
  id:'outside-transcript-summary-control',
  shortPhrase:'we want to make sure this is codified in our state legislature',
  role:'negative_control_prior_page_context_not_a_separate_2023_transcript_cue',
  issue:'public_publisher_page_context'
 })
]);
export function selectPinned2023Originals(publicReceipt){
 const all=publicPinnedOriginals(publicReceipt);
 const selected=all.filter(x=>x.leadId==='mpr-2023-kunesh-native-family-preservation');
 if(selected.length!==2||selected[0].captureUtc!=='2023-02-10T02:40:30Z'
  ||selected[1].captureUtc!=='2024-04-18T02:46:06Z'
  ||selected[0].sha256!=='091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92'
  ||selected[1].sha256!=='40d95fdf4f17d5e5c32f0c3b574e47af83a0526735bef33a9d0ddce09b93b89b')
  throw Error('Previous historically authenticated exact 2023 Kunesh source changed');
 return selected;
}
export function validateSelectedShortPhrases(study=STUDY){
 if(study.length!==3||study.some((x,i)=>JSON.stringify(x)!==JSON.stringify(STUDY[i])))throw Error('Unapproved original short phrase study');
 for(const q of study){
  if(typeof q.shortPhrase!=='string'||q.shortPhrase.length>105
   ||q.shortPhrase.split(/\s+/).length>18||!q.shortPhrase)throw Error('Oversized or invalid short quotation cue');
 }
 return study;
}
export async function runOriginal2023KuneshSpeakerStudy(f=fetch){
 const receipt=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json',import.meta.url),'utf8'));
 const archives=selectPinned2023Originals(receipt),study=validateSelectedShortPhrases(),results=[];
 for(const source of archives){
  const sourceCues=[];
  for(const selected of study){
   const pin={...source,label:'MARY KUNESH:',cue:selected.shortPhrase};
   const verified=await reverifyPinnedOriginalSpeakerTurn(pin,f);
   sourceCues.push({
    studyId:selected.id,role:selected.role,
    originalReplayedAndSha1Sha256Matched:verified.status==='sha1_and_sha256_reverified_same_original_html',
    sourceReplayStatus:verified.status,
    textVisibleOnPage:verified.turnIndicators?.selectedShortCueVisibleAnywhereOnOriginalPage??null,
    printedAudioTranscriptSectionFound:verified.turnIndicators?.transcriptSectionHeadingVisible??null,
    selectedCueInPrintedAudioTranscript:verified.turnIndicators?.selectedShortCueVisibleInsideTranscriptSection??null,
    selectedCueWithinExactMaryKuneshLabeledTranscriptTurn:verified.turnIndicators?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn??null,
    otherNamedTurnHasSelectedCue:verified.turnIndicators?.selectedShortCueInsideOtherNamedSpeakerTurn??null,
    selectedCueDistanceFromStartOfMaryTurn:verified.turnIndicators?.selectedShortCueCharacterDistanceFromStartOfTurn??null,
    selectedCueOwnerLabels:verified.turnIndicators?.selectedShortCueSpeakerTurnOwnerLabels??null,
    fullActualSpeakerVerbatimAudioOrLegislativeVoteCertified:false
   });
  }
  results.push({
   originalFirstPartyUrl:source.pageUrl,leadId:source.leadId,originalCaptureUtc:source.captureUtc,
   originalSha1Base32:source.sha1,originalRawSha256:source.sha256,originalBytes:source.bytes,
   allShortCueOriginalBodyReplaysSha1Sha256Matched:sourceCues.every(x=>x.originalReplayedAndSha1Sha256Matched),
   shortCues:sourceCues,sourceWasPreviouslyKnownAndNotNewArticle:true,
   authentic2023AvailabilityNoEarlierThanExactCaptureProven:false
  });
 }
 return {version:VERSION,localResearchDay:'2026-10-11',
  exactOriginalArchiveBodiesSelected:archives.length,
  preselectedShortCueCandidates:study.filter(q=>q.role!=='negative_control_prior_page_context_not_a_separate_2023_transcript_cue').length,
  contextOnlyNegativeControls:1,
  totalExactOriginalRawBodyReplaysAttempted:archives.length*study.length,
  totalOriginalShaMatchedReplays:results.reduce((n,r)=>n+r.shortCues.filter(x=>x.originalReplayedAndSha1Sha256Matched).length,0),
  first2023OriginalPrintedSpeakerCuesAuthenticated:results[0].shortCues.filter(x=>x.role.startsWith('selected_short')&&x.selectedCueWithinExactMaryKuneshLabeledTranscriptTurn).length,
  verifiedPrintedSpeakerCuesInEither2023EpisodeSource:results.reduce((n,r)=>n+r.shortCues.filter(x=>x.role.startsWith('selected_short')&&x.selectedCueWithinExactMaryKuneshLabeledTranscriptTurn).length,0),
  results,
  selectedStringEvidenceNotHumanFullQuoteCertified:true,
  original2023AudioShaNotAuthenticated:true,
  selected2023OriginalHtmlFirstPostingDateUnknown:true,
  noMemberVoteRecordedOrModelTimingInferred:true,
  noProductionSourceCollectorDatabaseOrForecastChange:true,
  noRawHTMLFullTranscriptOrAudioSaved:true};
}
