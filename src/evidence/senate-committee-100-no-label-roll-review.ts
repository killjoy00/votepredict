/** Issue #864: review 100 remaining embedded Senate Minutes PDFs with
 * literal roll-call cue but NO YEA/NAY label and no supported parser roll.
 * Keywords or a numeric tally are never automatically named member votes.
 */
import { createHash } from 'node:crypto';
import {
  extractOriginalRollSignalCandidates,type RollReviewYear,
} from './senate-committee-unparsed-roll-review.js';

export const NO_LABEL_ROLL_EXPECTED={
  2022:15,2023:60,2024:13,2025:12,
} as const;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function selectOriginalNoLabelRollPdfCandidates(year:RollReviewYear,raw:string){
  const full=extractOriginalRollSignalCandidates(year,raw);
  const filtered=full.filter(x=>x.parserAyeNayLabels===0);
  if(filtered.length!==NO_LABEL_ROLL_EXPECTED[year]||
    new Set(filtered.map(x=>x.originalOfficialPdfUrl)).size!==filtered.length ||
    filtered.some(x=>x.parserRollCallPhrases<1||x.parserRecordedRollCallsDetected!==0))
    throw Error('No-label original Senate roll PDF source population mismatch');
  return filtered;
}
type CueCategory='possible_numbered_vote_or_division'|
  'motion_related_roll_language'|'likely_attendance_roll'|'ambiguous_roll_language';
const ROLL=/\broll\s+call\b/gi;
const MOTION=/\b(?:motion|amendment|moved|prevail(?:ed)?|failed|recommended\s+to\s+pass|re-?refer)\b/i;
const VOTING=/\b(?:vote|voting|division|tally|ayes?|yeas?|nays?|yeas?\s+and\s+nays?)\b/i;
const ATTENDANCE=/\b(?:quorum|members?\s+(?:present|absent)|attendance|roll\s+call\s+(?:was\s+)?taken|called\s+the\s+meeting\s+to\s+order)\b/i;
const NUMERIC=/\b(?:vote\s*(?:was|of)?|roll\s+call(?:\s+vote)?)\s*(?:by\s+)?(?:a\s+)?(?:vote\s+of\s+)?(\d{1,2})\s*[/–-]\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:ayes?|yeas?|yes)\s*(?:and|,)\s*(\d{1,2})\s*(?:nays?|no)\b/i;
const priority:Record<CueCategory,number>={
  possible_numbered_vote_or_division:4,motion_related_roll_language:3,
  ambiguous_roll_language:2,likely_attendance_roll:1,
};
export function triageOriginalNoLabelRollText(text:string){
  if(text.length<40||text.length>1_000_000)
    throw Error('Original Senate text exceeds bounded source-only review');
  const positions=[...text.matchAll(ROLL)].map(m=>m.index??0);
  if(positions.length<1)throw Error('No roll-call phrase in independently expected original PDF text');
  const cues=positions.map(at=>{
    const window=text.slice(Math.max(0,at-340),Math.min(text.length,at+340));
    const numeric=NUMERIC.test(window);
    const motion=MOTION.test(window),voting=VOTING.test(window),attendance=ATTENDANCE.test(window);
    const kind:CueCategory=numeric&&(voting||motion)?'possible_numbered_vote_or_division'
      :motion&&voting?'motion_related_roll_language'
      :attendance&&!motion&&!numeric?'likely_attendance_roll':'ambiguous_roll_language';
    return {sourceOffset:at,contextSha256:hash(window),
      numericTallyCue:numeric,motionWordsNearby:motion,
      voteOrDivisionWordsNearby:voting,attendanceWordsNearby:attendance,
      reviewCategory:kind,categoryNotVerifiedActualVote:true};
  });
  const highest=cues.reduce((a,b)=>priority[b.reviewCategory]>priority[a.reviewCategory]?b:a);
  const snippets=cues.slice(0,3).map(c=>({
    sourceOffset:c.sourceOffset,
    temporaryContext:text.slice(Math.max(0,c.sourceOffset-130),Math.min(text.length,c.sourceOffset+130))
      .replace(/\s+/g,' ').slice(0,260),
  }));
  return {
    sourceRollPhraseCount:positions.length,
    highestReviewCategory:highest.reviewCategory,
    possibleNumericallyCountedRollCues:cues.filter(c=>c.numericTallyCue).length,
    attendanceOnlyCueContexts:cues.filter(c=>c.reviewCategory==='likely_attendance_roll').length,
    motionRelatedCues:cues.filter(c=>c.motionWordsNearby).length,
    cueDetails:cues,
    sourceTextSha256:hash(text),
    temporarySourceExcerptsForHumanAudit:snippets,
    noNamedMemberChoicesDerived:true,
    noActualRecordedVoteDenominatorCertified:true,
  };
}