/**
 * Historical #864: untrusted automatic captions of 2021-04-08 Judiciary hearing.
 *
 * This program cannot certify an original COMMITTEE motion, its exact vote day,
 * attendance, side, timestamp or public-by. The original April 12 Journal has
 * a separately authenticated Pappas SF970 committee amendment, but a caption
 * mention can only be a playback review cue, not committee member_vote proof.
 */
import {createHash} from 'node:crypto';
import {APR12_THREE_STRICT_ORIGINAL} from
 './senate-2021-apr12-three-strict-original-committee-amendments.js';

export const APR08_JUDICIARY_CAPTION_ORIGINAL={
 schemaVersion:'senate-2021-apr08-judiciary-pappas-caption-independent-strict-source-v1',
 bill:'SF970',mover:'Pappas',committee:'Judiciary and Public Safety Finance and Policy',
 hearingPage:'https://www.lrl.mn.gov/media/file?body=s&cid=3099&date=04%2F08%2F2021',
 originalCaptionURL:'https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=cmte_jud_040821.mp4',
 originalCaptionSourceName:'cmte_jud_040821.mp4',
 officialIndexedHearingDate:'2021-04-08',
 originalJournalReportDate:'2021-04-12',
 firstOriginalRun:38177903789,
 firstOriginalRunArtifact:11716551428,
 firstOriginalArtifactZipBytes:2395,
 firstOriginalArtifactZipSHA256:'b7e499970e1dbe62a0cded2e913d5233bd4d1b0f4b41c21f1bb4c98556400343',
 firstOriginalArtifactJsonBytes:9122,
 firstOriginalArtifactJsonSHA256:'ba8a5e584999bc16819c0095e0a3f84cd03a40afa77bdcf27f537d7e6962b1b6',
 originalAutomaticCaptionBytes:436144,
 originalAutomaticCaptionSHA256:'6e37f661cb4ced4d33fdce7ed5af0a38cd57f9580efcf55ce5bc90e6ed92e84a',
 firstPassDataTimeRows:2593,
 firstPassTableRows:2594,
 firstPassSameRowMoverAmendmentOrRollCallCueCount:3,
 exactJournalMotionDayConfirmed:false,
 originalRecordingAudioPlayedOrAuthenticated:false
} as const;
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');

export function verifySecondOriginalJudiciaryCaptionBytes(bytes:Buffer){
 if(bytes.length!==APR08_JUDICIARY_CAPTION_ORIGINAL.originalAutomaticCaptionBytes)
  throw Error('Original Senate 2021 Judiciary caption byte-size mismatch');
 const actual=sha(bytes);
 if(actual!==APR08_JUDICIARY_CAPTION_ORIGINAL.originalAutomaticCaptionSHA256)
  throw Error('Original Senate 2021 Judiciary caption SHA-256 mismatch');
 return {bytes:bytes.length,sha256:actual};
}

function textOnly(fragment:string){
 return fragment
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#0*39;|&apos;|&rsquo;/gi,"'")
  .replace(/&#(\d+);/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_m,n:string)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/\s+/g,' ').trim();
}
type CaptionRow={rowIndex:number;timeValue:string|null;timeSeconds:number|null;text:string};
const amendment=/\bamendment\b/i;
const roll=/\broll\s*call\b/i;
const mover=/\bPappas\b/i;
function classifyRows(html:string):CaptionRow[]{
 return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((m,rowIndex)=>{
   const fragment=m[1]??'';
   const timeValue=fragment.match(/\bdata-time\s*=\s*["']([^"']+)["']/i)?.[1]??null;
   const timeSeconds=timeValue!==null&&/^\d+$/.test(timeValue)?Number(timeValue):null;
   return {rowIndex,timeValue,timeSeconds,text:textOnly(fragment)};
  });
}

/** Pure extractor: never emits automatic caption text or other senator names. */
export function summarizeApril08PappasCaptionUntrustedCues(html:string){
 if(Buffer.byteLength(html,'utf8')>5_000_000)
  throw Error('Untrusted caption payload exceeds strict review cap');
 const rows=classifyRows(html);
 const cues=rows.filter(r=>mover.test(r.text)&&(amendment.test(r.text)||roll.test(r.text)));
 const journal=APR12_THREE_STRICT_ORIGINAL.motions.filter(m=>
  m.bill===APR08_JUDICIARY_CAPTION_ORIGINAL.bill&&
  m.mover===APR08_JUDICIARY_CAPTION_ORIGINAL.mover);
 if(journal.length!==1)throw Error('Original Journal has no single exact SF970 Pappas committee amendment');
 return {
  sourceKind:'untrusted_auto_caption_review_cues_only',
  reviewedBill:'SF970',journalReportDate:'2021-04-12',
  originalMediaPageHeaderDay:'2021-04-08',
  allCaptionTableRows:rows.length,
  timestampedRows:rows.filter(r=>r.timeValue!==null).length,
  rowsMentioningMover:rows.filter(r=>mover.test(r.text)).length,
  rowsMentioningAmendment:rows.filter(r=>amendment.test(r.text)).length,
  rowsMentioningRollCall:rows.filter(r=>roll.test(r.text)).length,
  sameRowMoverAndAmendmentOrRollCall: cues.length,
  captionPlaybackReviewCues:cues.slice(0,20).map(r=>{
   const start=Math.max(0,r.rowIndex-6);
   const end=Math.min(rows.length,r.rowIndex+7);
   const window=rows.slice(start,end).map(x=>x.text).join('\n');
   return {
    captionRowIndex:r.rowIndex,
    captionDataTime:r.timeValue,
    captionTimeSeconds:r.timeSeconds,
    observedSameRowAmendmentWord:amendment.test(r.text),
    observedSameRowRollCallWords:roll.test(r.text),
    originalCaptionRowSHA256:sha(r.text),
    nearbyThirteenRowsUntrustedContextSHA256:sha(window),
    anySourceTextOrNamedVoteSidesPersisted:false,
    authenticMemberSpeechVerified:false,
    motionSpecificMeetingDateConfirmed:false
   };
  }),
  captionReviewQueueMayBeIncomplete:cues.length>20,
  independentSourceOriginalRecordingAudioProof:false,
  noVerifiedSpeakerOrAmendmentVoteTime:true,
  journalAmendmentMotionPreservedAsSeparateFromBillPassage:true,
  occurredOn:null,firstPublishedBy:null,
  noMemberVoteInferredOrImported:true,
  noProductionDatabaseOrForecastTouched:true
 };
}
