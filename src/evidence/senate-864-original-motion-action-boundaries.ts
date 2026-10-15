/**
 * #864 independent, SHA-bound documentary segmentation of original Senate
 * committee minute "MOTION PREVAILED/FAILED" text.
 *
 * The unit of classification is a printed RESULT CUE, not a persisted
 * roll call or a proven distinct parliamentary motion. A new explicit
 * motion introduction after the previous result supports a candidate
 * action boundary; otherwise keep ambiguous/repeated result language.
 * Source names, raw text and voter sides are never serialized.
 */
import {createHash} from 'node:crypto';
import {identifyOriginalSourceMotionCues} from './senate-864-original-motion-cue-review.js';

const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const INTRO=/\b(?:Senator\s+[\p{L}.'-]+(?:\s+[\p{L}.'-]+){0,2}\s+moved\b|moved\s+(?:that|to|the)\b|moves\s+(?:that|to|the)\b|motion\s+to\b|motion\s+(?:made\s+)?by\b|offered\s+(?:the|an?)\b|offers\s+the\b)/giu;
type BoundaryClass='one_explicit_motion_introduction'|
 'multiple_motion_introductions'|'result_with_no_bounded_introduction'|
 'possible_repeated_result_no_new_motion';
export function classifyOriginalSenateMotionResultBoundaries(sourceText:string){
 const flat=sourceText.replace(/\s+/g,' ').trim();
 const observed=identifyOriginalSourceMotionCues(sourceText,250);
 const formal=observed.cues.filter(x=>x.cueType==='formal_result');
 if(formal.length!==observed.byCueKind.formal_result||
  observed.sourceContainsMoreCuesThanBoundedPreview)
  throw Error('Bounded complete original result cue segmentation required');
 const intros=[...flat.matchAll(INTRO)].map(m=>m.index??0);
 const candidates=formal.map((c,i)=>{
  const prior=formal[i-1];
  const from=prior===undefined?0:prior.offsetInWhitespaceNormalizedSource+16;
  const resultAt=c.offsetInWhitespaceNormalizedSource;
  const boundedStart=Math.max(from,resultAt-1250);
  // Multiple phrases close together often describe the SAME introduction:
  // "Senator X moved ... motion to" should not fabricate two motions.
  const mentions=intros.filter(p=>p>=boundedStart&&p<resultAt);
  const distinctIntroOffsets:number[]=[];
  for(const p of mentions){
   if(distinctIntroOffsets.length===0||
    p-distinctIntroOffsets[distinctIntroOffsets.length-1]!>90)
    distinctIntroOffsets.push(p);
  }
  const nearPrevious=prior!==undefined&&
   resultAt-prior.offsetInWhitespaceNormalizedSource<120;
  const classification:BoundaryClass=distinctIntroOffsets.length>1?
   'multiple_motion_introductions':distinctIntroOffsets.length===1?
   'one_explicit_motion_introduction':nearPrevious?
   'possible_repeated_result_no_new_motion':
   'result_with_no_bounded_introduction';
  const segmentStart=distinctIntroOffsets.at(-1)??Math.max(from,resultAt-180);
  const segment=flat.slice(segmentStart,resultAt+Math.min(70,flat.length-resultAt));
  const printed=flat.slice(resultAt,resultAt+50);
  const failed=/^\s*(?:MOTION|AMENDMENT)\s+(?:FAILED|DID NOT PREVAIL)\b/i.test(printed);
  const passed=/^\s*(?:MOTION|AMENDMENT)\s+(?:PREVAILED|PASSED|CARRIED|ADOPTED)\b/i.test(printed);
  if(!failed&&!passed)throw Error('Unrecognized source printed result outcome');
  return {
   printedFormalResultOrdinal:i,
   originalWhitespaceNormalizedResultOffset:resultAt,
   originalPassageSha256:c.originalExcerptSha256,
   sourceMotionBoundaryStartOffset:segmentStart,
   sourceMotionBoundaryTextSha256:sha(segment),
   printedResult:failed?'failed':'passed',
   classification,
   independentMotionIntroductionCount:distinctIntroOffsets.length,
   nearbyPrintedBillReferences:c.nearbyPrintedBillReferences,
   nearbyPrintedAmendmentReferences:c.nearbyPrintedAmendmentReferences,
   namedVoterOrSideIdentityExported:false,
   sourceCueIndependentlyCertifiedAsDistinctMotion:false,
   canUseOldPositionalImporterKeyAsStableEventId:false,
   comparedToExistingStoredEvent:false,
  };
 });
 return {
  sourceNormalizedWhitespaceSha256:observed.sourceTextSha256,
  sourcePrintedFormalResultCues:formal.length,
  candidateOneIntroduction: candidates.filter(x=>
   x.classification==='one_explicit_motion_introduction').length,
  ambiguousMultipleIntroductions:candidates.filter(x=>
   x.classification==='multiple_motion_introductions').length,
  possibleRepeatedResultCues:candidates.filter(x=>
   x.classification==='possible_repeated_result_no_new_motion').length,
  resultOnlyWithoutBoundedMotionIntro:candidates.filter(x=>
   x.classification==='result_with_no_bounded_introduction').length,
  candidateBoundariesNotCertifiedUniqueActions:true as const,
  noMemberSideOrAttendanceInference:true as const,
  noStoredEventOrDatabaseComparison:true as const,
  candidates,
 };
}
