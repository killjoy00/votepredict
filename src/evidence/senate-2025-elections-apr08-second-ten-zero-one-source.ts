/**
 * #864: audit BOTH April 8 Elections original SF2384 10/0/1 text results;
 * isolate the one that is NOT authenticated A11 without double-counting.
 * Original official PDF/text hash required; no member_vote import.
 */
import {createHash} from 'node:crypto';
import {SOURCE} from './senate-2025-elections-apr08-a10-source.js';

export const SECOND_TEN_ZERO_ONE_VERSION =
 'senate-2025-elections-apr08-other-10-0-1-original-neighborhood-v1' as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const flatten=(s:string)=>s.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const OFFICIAL=new Set(['Carlson','Westlin','Bahr','Boldon','Cwodzinski',
 'Limmer','Marty','Port','Koran','Mathews','Lucero']);
const motionPattern=/\bSenator\s+([A-Za-z][A-Za-z .'-]{1,55}?)\s+(?:moved|moves|offered|proposed)\s+(?:to\s+adopt\s+)?(?:the\s+)?A\s*-?\s*(\d+)\s+Amendment\b/gi;
const tallyPattern=/With\s+a\s+vote\s+of[\s\S]{0,85}?\b10\s*\/\s*0\s*\/\s*1\b[\s\S]{0,45}?\b(?:motion|amendment)\s+prevail(?:ed|s)\b/gi;

export function inspectOriginalApr08OtherTenZeroOne(text:string) {
 if(text.length<1800||text.length>200000||
    sha(text)!==SOURCE.originalTextSHA256)
  throw Error('April08 exact original full extracted text SHA changed');
 return inspectOtherTenZeroOneCore(text,{
  roster:OFFICIAL,authenticatedA11ResultOffset:1422,
  authenticatedA11MotionOffset:1286
 });
}
/** Pure structural reviewer: never a substitute for original SHA authentication. */
export function inspectSyntheticOtherTenZeroOne(
 text:string,roster:readonly string[],a11ResultOffset:number,a11MotionOffset:number
) {
 if(roster.length!==11||new Set(roster).size!==11||
    roster.some(x=>OFFICIAL.has(x)))
  throw Error('Synthetic fixture roster must be exactly eleven fictional distinct members');
 return inspectOtherTenZeroOneCore(text,{
  roster:new Set(roster),
  authenticatedA11ResultOffset:a11ResultOffset,
  authenticatedA11MotionOffset:a11MotionOffset
 });
}
type ReviewerOptions={
 roster:ReadonlySet<string>;
 authenticatedA11ResultOffset:number;
 authenticatedA11MotionOffset:number;
};
function inspectOtherTenZeroOneCore(text:string,opts:ReviewerOptions) {
 if(text.length<1800||text.length>200000)
  throw Error('Not a bounded April08 original-motion structural source');
 const results=[...text.matchAll(tallyPattern)];
 if(results.length!==2)
  throw Error('Original April08 expected exactly two printed 10/0/1 prevailed results');
 const motions=[...text.matchAll(motionPattern)];
 const a11=motions.filter(m=>m.index===opts.authenticatedA11MotionOffset);
 if(a11.length!==1||a11[0]![2]!=='11')
  throw Error('Existing authenticated A11 motion anchor does not match');
 const anchored=results.filter(r=>r.index===opts.authenticatedA11ResultOffset);
 if(anchored.length!==1)
  throw Error('Existing authenticated A11 result anchor does not match');
 const other=results.find(r=>r.index!==opts.authenticatedA11ResultOffset)!;
 const resultAt=other.index??-1;
 const predecessors=motions.filter(m=>(m.index??-1)<resultAt);
 const closest=predecessors.at(-1)??null;
 const candidateAt=closest?.index??null;
 const nextAfterCandidate=candidateAt===null?null:
  motions.find(m=>(m.index??-1)>candidateAt+closest![0].length);
 const sectionEnd=nextAfterCandidate?.index??text.length;
 const resultInCandidateSection=candidateAt!==null&&
    resultAt>=candidateAt&&resultAt<sectionEnd;
 const otherTallyCountInCandidateSection=candidateAt===null?null:
  results.filter(r=>(r.index??-1)>=candidateAt&&(r.index??-1)<sectionEnd).length;
 const sourceWithinThousandChars=candidateAt!==null&&
   resultAt-candidateAt>0&&resultAt-candidateAt<=1100;
 const mover=closest?.[1]?.trim()??null;
 const label=closest?('A'+closest[2]):null;
 const explicitlyOnRoster=mover!==null&&opts.roster.has(mover);
 const originalBillExplicit=candidateAt!==null&&
  /\bS\.?\s*F\.?\s*2384\b/i.test(text.slice(candidateAt,resultAt));
 // Restrict named-side parsing to this result's OWN paragraph, ending
 // before a new Senator motion. Do not treat tally alone as named choices.
 const stop=Math.min(text.length,resultAt+850,sectionEnd);
 const after=flatten(text.slice(resultAt,stop));
 const lists=after.match(
  /\bAyes:\s*([A-Za-z\s,.'-]*?)\s+Nays:\s*([A-Za-z\s,.'-]*?)\s+Absent:\s*([A-Za-z\s,.'-]*?)(?=\s+Senator\b|$)/i
 );
 const parse=(s:string)=>s.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
 const yea=lists?parse(lists[1]!):[];
 const nay=lists?parse(lists[2]!):[];
 const absent=lists?parse(lists[3]!):[];
 const rosterExact=!!lists&&yea.length===10&&nay.length===0&&absent.length===1&&
  new Set([...yea,...nay,...absent]).size===11&&
  [...yea,...nay,...absent].every(x=>opts.roster.has(x));
 const candidateUsableOnlyForHumanResearch=resultInCandidateSection&&
  sourceWithinThousandChars&&explicitlyOnRoster&&originalBillExplicit&&
  otherTallyCountInCandidateSection===1&&rosterExact;
 const potentialSameMotionAsA11=candidateAt===opts.authenticatedA11MotionOffset;
 const preview=candidateAt===null?null:
  flatten(text.slice(candidateAt,Math.min(resultAt,candidateAt+260)))
   .replace(/\b(?:Ayes|Nays|Absent):[\s\S]*$/i,'').slice(0,185);
 return {
  date:SOURCE.date,committee:SOURCE.committee,bill:SOURCE.bill,
  sourceOriginalPdfSHA256:SOURCE.originalPdfSHA256,
  sourceOriginalExtractedTextSHA256:SOURCE.originalTextSHA256,
  allOriginalTenZeroOnePrevailTextOffsets:results.map(r=>r.index??-1).sort((a,b)=>a-b),
  independentlyPriorAuthenticatedA11ResultOffset:opts.authenticatedA11ResultOffset,
  independentlyPriorAuthenticatedA11MotionOffset:opts.authenticatedA11MotionOffset,
  otherTenZeroOneResultOffset:resultAt,
  otherOriginalResultNeighborhoodSHA256:sha(text.slice(Math.max(0,resultAt-340),Math.min(text.length,resultAt+530))),
  closestIntroducedAmendmentLabel:label,
  closestPrintedMotionMover:mover,
  closestIntroducedMotionOffset:candidateAt,
  closestMotionToResultTextDistance:candidateAt===null?null:resultAt-candidateAt,
  closestMotionIsExplicitlyValidRosterMember:explicitlyOnRoster,
  candidateBillExplicitlyPrintedBetweenMotionAndResult:originalBillExplicit,
  nextSeparateIntroducedAmendmentMotionOffset:nextAfterCandidate?.index??null,
  candidateMotionOwnSectionContainsOneMatchingResult:otherTallyCountInCandidateSection===1,
  otherResultBelongsToCandidateMotionSection:resultInCandidateSection,
  candidateMotionWordingForHumanReview:preview,
  sourcePrintedNamedTenYesZeroNoOneAbsentRosterExact:rosterExact,
  printedAbsentIndividualOnlyWhenExactlyValidated:rosterExact?absent[0]:null,
  sourceSideIdentitySHA256OnlyWhenExactlyValidated:rosterExact?{
   yea:yea.map(x=>sha('yea:'+x.toLowerCase())).sort(),
   nay:[],
   absent:absent.map(x=>sha('absent:'+x.toLowerCase())).sort()
  }:null,
  sourceCandidateWorthSeparateMotionReview:candidateUsableOnlyForHumanResearch,
  samePreviouslyAuthenticatedA11MotionSection:potentialSameMotionAsA11,
  requiresIndependentFiledAmendmentOrMediaCorroboration:true,
  noOriginalAudioVideoPlaybackCertified:true,
  noNewDistinctVoteDenominatorCertified:true,
  noStoredMemberVoteParityVerified:true,
  noIndividualMemberSideImport:true,
  noSameDayForecastWithoutClock:true
 };
}