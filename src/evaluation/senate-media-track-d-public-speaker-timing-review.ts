/**
 * #946/#987 public-source, OFFLINE, metadata-only speaker and publication
 * chronology triage. These are prior SHA-authenticated original-body CUES,
 * never automatically approved complete quotations, official ballots or
 * retrospective model features. No article text, names from private DB,
 * network or production source mutations.
 */
import type {HistoricalShadowPin} from './senate-media-track-d-historic-shadow.js';
import {validateTrackDHistoricalShadowPins} from './senate-media-track-d-historic-shadow.js';
export const TRACK_D_PUBLIC_SPEAKER_REVIEW_VERSION=
 'senate-media-946-987-reviewed-public-cues-asof-guardrails-v1';
type Rec=Record<string,any>;

export function buildTrackDPublicSpeakerTimingQueue(input:{
 pins:readonly HistoricalShadowPin[];newReformer:Rec;
 kunesh2023:Rec;hauschild2024:Rec;mprSix:Rec;ledger:Rec;
}){
 const {pins,newReformer,kunesh2023,hauschild2024,mprSix,ledger}=input;
 validateTrackDHistoricalShadowPins(pins);
 if(newReformer.version!=='senate-media-three-reformer-brief-original-http-recovery-receipts-v1'||
  newReformer.perSourceOriginalUrlVariantPairs?.length!==3||
  kunesh2023.version!=='mpr-2023-original-kunesh-printed-two-policy-cues-public-provenance-v1'||
  kunesh2023.historicalCaptures?.length!==2||
  hauschild2024.version!=='senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-v1'||
  mprSix.version!=='mpr-six-senator-interviews-public-original-and-seed-receipts-v1'||
  mprSix.urls?.length!==6||
  ledger.version!=='senate-media-public-discovery-leads-v1')
  throw Error('Immutable public original speech/timestamp research receipts changed');

 const grouped=newReformer.perSourceOriginalUrlVariantPairs.map((r:Rec)=>{
  const matching=pins.filter(p=>p.originalUrl===r.originalPublisherBriefsPath);
  if(matching.length!==r.originalBriefsHttpCaptureVersions.length||
   matching.some(p=>p.sourceGroup!=='additional_5_2021_2025_reformer_originals')||
   r.bothExactUrlVariantsHistoricallyVerified!==false)
   throw Error('Reformer candidate speech original identity inconsistent');
  const people=new Set<string>();
  for(const original of r.originalBriefsHttpCaptureVersions as Rec[]){
   const pin=matching.find(p=>p.capturedUtc===original.captureUtc);
   if(!pin||pin.rawSha256!==original.rawOriginalSha256||
    original.replayStatus!=='actual_original_indexed_sha1_verified')
    throw Error('Invalid person/capture archival original binding');
   for(const cue of original.individualSenatorShortCueOutcomes as Rec[]){
    if(cue.fragmentInHistoricallyVerifiedHtml!==true||
      cue.surnameSameParagraph!==true||
      cue.fullSpeechQuoteHumanApproved!==false||
      !r.selectedServingSenators.includes(cue.speaker))
     throw Error('Historical speaker cue not safely verified in that original');
    people.add(cue.speaker);
   }
  }
  if(people.size!==r.selectedServingSenators.length)
   throw Error('Person-level original short-cue support not complete for selected article');
  return{
   publicArticleId:r.sourceArticleId,
   verifiedOriginalUrl:r.originalPublisherBriefsPath,
   sourceType:'reformer_reporter_printed_short_speaker_fragment_in_original_html',
   distinctOriginalBodies:matching.length,
   distinctServingSenatorNameCueCandidates:[...people].sort(),
   separatelyAttributableOriginalShortFragmentCandidateCount:people.size,
   originalArchiveBytesSha1AndSha256Authenticated:true,
   exactOriginalDatedUrlAliasAuthenticated:false,
   publisherInitialPostingMinuteProven:false,
   completeQuoteHumanApproved:false,
   archivedWholeSpokenAudioVerified:false,
   factOfSenatorIndividualVoteAuthenticatedByArticle:false,
   predictiveAsOfOrStanceCertified:false,
  };
 });
 if(grouped.reduce((n:number,r:Rec)=>n+r.separatelyAttributableOriginalShortFragmentCandidateCount,0)!==6)
  throw Error('Original Reformer named short cues count drifted');
 const kuneshPins=pins.filter(p=>p.publicId.startsWith('mpr-2023-kunesh-native-family-preservation@'));
 if(kuneshPins.length!==2||
  kunesh2023.originalPublisherEpisodeUrl!==kuneshPins[0]!.originalUrl)
  throw Error('Original Kunesh 2023 exact MPR episode mismatch');
 const kuneshCaptureObservations=kunesh2023.historicalCaptures.map((c:Rec)=>{
  if(!kuneshPins.some(p=>p.capturedUtc===c.captureUtc&&
   p.rawSha256===c.rawOriginalSha256&&p.indexedSha1===c.indexedOriginalSha1Base32)||
   c.rawOriginalHtmlBodySha1AndSha256Reverified!==true)
   throw Error('Kunesh historical original SHA timestamp mismatch');
  const accepted=(c.studies as Rec[]).filter(x=>
   x.labeledSenatorSpeakerTurn==='MARY KUNESH:'&&
   x.selectedPhraseInsideOriginalAudioTranscriptSection===true&&
   x.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn===true);
  const excluded=(c.studies as Rec[]).filter(x=>
   x.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn!==true);
  if(accepted.length!==2||excluded.length!==1||
   c.studies.some((x:Rec)=>x.originalMemberSpeechHumanVerbatimReviewApproved!==false))
   throw Error('Invalid MPR direct transcript-speaker turn isolation');
  return{
   capturedUtc:c.captureUtc,
   originalNamedMaryKuneshPrintedTranscriptShortCueCount:accepted.length,
   unrelatedReporterTextOrOutsideTurnControlCount:excluded.length,
   authenticatedMP3:false,fullHumanQuoteApproved:false,
  };
 });
 // Current 2024 audio transcript is NOT presumed available in the old HTML.
 const early2024=hauschild2024.firstHistoricallyAuthenticatedSelectedTranscriptCuePresenceWithinFourIndexedCaptures;
 if(hauschild2024.sourceOriginalPublisherUrl!==
  'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south'||
  early2024!=='2025-07-24T23:23:22Z'||
  hauschild2024.cannotBackdate2025HtmlTranscriptTextTo2024Captures!==true||
  !pins.some(p=>p.issue===987&&
   p.originalUrl===hauschild2024.sourceOriginalPublisherUrl&&
   p.capturedUtc==='2024-02-19T22:55:56Z'))
  throw Error('Unproven retrospectively edited 2024 MPR transcript was backdated');
 const charter=mprSix.urls.find((u:Rec)=>u.id==='mpr-2024-kunesh-charter-school-oversight');
 if(!charter||charter.originals?.length!==2)
  throw Error('2024 MPR charter school before/after original transcript evidence missing');
 const early=charter.originals.find((x:Rec)=>x.captureUtc==='2024-10-22T18:31:15Z');
 const late=charter.originals.find((x:Rec)=>x.captureUtc==='2024-12-11T00:46:18Z');
 if(!early||!late||JSON.stringify(early.selectedCuesPresent)!=='[false,false]'||
  JSON.stringify(late.selectedCuesPresent)!=='[true,true]'||
  !pins.some(p=>p.rawSha256===early.sha256&&p.capturedUtc===early.captureUtc)||
  !pins.some(p=>p.rawSha256===late.sha256&&p.capturedUtc===late.captureUtc))
  throw Error('Selected MPR 2024 October-to-December speaker availability clock changed');

 const election=ledger.selectedNonExhaustiveArticleLeads.find(
  (x:Rec)=>x.id==='mn-reformer-2025-special-election-brief');
 if(!election||election.publicationDayDisplayedOnPublicPage!=='2025-04-30'||
  !pins.some(p=>p.publicId.startsWith(election.id+'@')&&p.capturedUtc<'2025-05-06T00:00:00Z'))
  throw Error('2025 election result vs serving-member oath boundary changed');

 return{
  version:TRACK_D_PUBLIC_SPEAKER_REVIEW_VERSION,
  originalReformerReporterItems:grouped,
  originalReformerDistinctNamedSenatorShortCueCandidates:6,
  mpr2023Kunesh:{
   namedMember:'Mary Kunesh',
   archivedOriginalUrl:kunesh2023.originalPublisherEpisodeUrl,
   pinnedOriginalVersionsWithTwoNamedInTurnShortCues:kuneshCaptureObservations,
   originalPrintedSpeakerCueCandidates:2,
   reportIsNotAudioOrFullHumanQuote:true,
   earliestSelectedCuesDemonstratedBy:'2023-02-10T02:40:30Z',
   noRetroactive2023_02_07BroadcastDayTranscript:true,
  },
  mpr2024Hauschild:{
   namedMember:'Grant Hauschild',
   eventDay:'2024-02-19',
   early2024OriginalHtmlHadSpecificSelectedTranscriptCue:false,
   firstSelectedCueLaterOriginalCaptureUtc:early2024,
   firstOriginalPublishedTimeProven:false,
   no2024_02_19ForecastStanceOrTranscriptPromotion:true,
  },
  mpr2024KuneshCharter:{
   namedMember:'Mary Kunesh',
   october22OriginalSelectedTranscriptCue:false,
   december11OriginalSelectedTranscriptCue:true,
   demonstratedByUtc:'2024-12-11T00:46:18Z',
   doesNotProveExactTranscriptUploadDate:true,
   cannotBackdateSpeakerTurnToOctober22:true,
  },
  memberTermGuard:{
   senator:'Keri Heintzeman',
   publisherSpecialElectionArticleDay:'2025-04-30',
   officialSenateOathDay:'2025-05-06',
   onArticlePublicationDayServingSenator:false,
   noMaySixMembershipRetroactivelyOnAprilThirty:true,
  },
  attributionOutcome:'source_verified_short_name_cues_for_human_review_only',
  humanApprovedFullQuotes:0,
  exactIndividualSenateVotesInferredFromMediaStories:0,
  historicalModelForecastSignalPromoted:0,
  publicationAndArchiveCaptureClocksKeptDistinct:true,
  sourceBodyOrFullQuotedStatementsWritten:false,
  privateSourceDataOrServingCodeUsed:false,
 };
}
