/**
 * #864 exact motion-description neighborhood of the EIGHT provisional named
 * 2025 Elections original source-roll blocks NOT on Feb 6 / held dates.
 * No member sides, unique-vote certification, or serving/production.
 */
import {createHash} from 'node:crypto';

export const EIGHT_2025_ELECTIONS_CONTEXT_VERSION=
 'senate-2025-elections-feb11-mar25-apr08-eight-original-motion-context-v1' as const;
export const EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS={
 '2025-02-11':[2354,3460],
 '2025-03-25':[1326],
 '2025-04-08':[2133,2401,2673,2941,3303],
} as const;
export const FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB=
 '63a605e038bea5762a70be7ac79602f6c23a0924' as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const normalize=(s:string)=>s.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const sourceBills=(s:string)=>[...new Set([...s.matchAll(/\b(?:S\.?\s*F\.?|H\.?\s*F\.?)\s*(?:No\.?\s*)?\d{1,5}\b/gi)]
 .map(m=>m[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()))].slice(0,8);

export interface SourceCandidateEight {
 sourceTextOffset:number;
 explicitNamedYea:number;explicitNamedNay:number;
 sourceNearbyTextSha256:string;
 matchesHistoricalCommitteeRoster:boolean;
 namedYeaNayAtOpeningAbsentMembers:number;
 candidateNotCertifiedDistinctHistoricalVote:boolean;
}
export type Eight2025Date=keyof typeof EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS;
export function inspectEight2025ElectionMotionSource(input:{
 date:Eight2025Date;text:string;candidate:SourceCandidateEight;
}){
 const {date,text,candidate:c}=input;
 const required=EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS[date];
 if(!required.includes(c.sourceTextOffset as never)
  ||c.explicitNamedYea+c.explicitNamedNay!==11
  ||!c.matchesHistoricalCommitteeRoster
  ||c.namedYeaNayAtOpeningAbsentMembers!==0
  ||!c.candidateNotCertifiedDistinctHistoricalVote
  ||!/^[a-f0-9]{64}$/.test(c.sourceNearbyTextSha256))
  throw Error('Not an original, historical-roster verified eight-roll source block');
 const off=c.sourceTextOffset;
 if(!Number.isInteger(off)||off<500||off+430>text.length)
  throw Error('Original provisional source offset outside PDF text bounds');
 const exactNear=text.slice(Math.max(0,off-580),Math.min(text.length,off+430));
 if(sha(exactNear)!==c.sourceNearbyTextSha256)
  throw Error('Original exact 2025 named-roll source paragraph SHA changed');
 if(!/\broll\s+call\b/i.test(exactNear))
  throw Error('Original source context no longer mentions roll call');
 const before=normalize(text.slice(Math.max(0,off-830),off));
 const after=normalize(text.slice(off,Math.min(text.length,off+150)));
 const names=[...before.matchAll(/\bSenator\s+([A-Za-z][A-Za-z .'-]{1,65}?)\s+(?:moved|moves|offered|proposed)\b/gi)]
  .map(m=>({saying:normalize(m[0]),position:m.index??0}));
 const latest=names.length?names[names.length-1]!:null;
 const left=before.slice(-650);
 const billMentions=sourceBills(left);
 const classes=[
  ['amendment',/\bamendment\b/i],
  ['tabling',/\b(?:lay(?:ing)? .{0,45} on the table|table (?:the |this )?(?:bill|motion|senate file))/i],
  ['pass_or_refer',/\b(?:recommend.{0,70}pass|pass and be referred|re-?referred|report (?:the|a) bill)/i],
  ['other_motion',/\b(?:motion|moved|moves|vote|roll call)\b/i],
 ] as const;
 const keywordClasses=classes.filter(([,re])=>re.test(left)).map(([kind])=>kind);
 const summary=normalize(text.slice(Math.max(0,off-440),Math.min(text.length,off+100)));
 return {
  indexedHearingDate:date,originalSourceOffset:off,
  sourceNearbyContextSha256:c.sourceNearbyTextSha256,
  explicitlyNamedSourceYeaCount:c.explicitNamedYea,
  explicitlyNamedSourceNayCount:c.explicitNamedNay,
  candidateNearbyBillTextTokensOnly:billMentions,
  nearbyActionKeywordClassesOnly:keywordClasses,
  closestPrintedMoverStringCandidate:latest?.saying??null,
  closestPrintedMoverDistanceBeforeRoll:latest?before.length-latest.position:null,
  sourceContextPreviewForHumanReview:summary.slice(0,520),
  originalContextReviewPreviewSha256:sha(summary),
  sourcePreviewNotCompleteMotionParagraph:true,
  namedSidesNotPublished:true,
  amendmentTableAndPassDistinctMotionsRequired:true,
  duplicatedMotionNarrativeNotCertifiedUnique:true,
  noSourceParagraphAutomaticallyPromotedAsHistoricalVote:true,
 };
}
