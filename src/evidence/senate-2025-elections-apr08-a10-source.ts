/**
 * #864: Investigate previously under-counted 2025-04-08 Elections SF2384
 * A10 amendment 7 AYE / 3 NAY / 1 explicitly Absent.
 * SHA-verifiable original minutes, but ZERO automatic member_vote writes.
 */
import {createHash} from 'node:crypto';
export const APR08_A10_SOURCE_SCHEMA=
 'senate-2025-elections-apr08-sf2384-a10-original-7-3-1-motion-source-review-v1' as const;
export const SOURCE={
 year:2025,date:'2025-04-08',committee:'Elections',bill:'SF2384',
 originalOfficialUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250408/Elections_20250408_Minutes.pdf',
 originalPdfSHA256:'d26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46',
 originalTextSHA256:'6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101',
 originalPdfBytes:99628,priorElectionsOriginalSourceRun:38098600457,
 priorEightMotionContextSourceRun:38108467376,priorEightMotionSourceArtifactId:11691340627,
 priorA20OriginalNearContextSHA256:'0f667c84df52683e6382a6ddfa77196b1a588b5ab7f7d2866d22bed94af26a1e',
} as const;
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const OFFICIAL=new Set(['Carlson','Westlin','Bahr','Boldon','Cwodzinski',
 'Limmer','Marty','Port','Koran','Mathews','Lucero']);
const flat=(s:string)=>s.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const parseNames=(value:string)=>value.split(/\s*,\s*/)
 .map(x=>x.trim()).filter(Boolean);
export function inspectOriginalApr08A10Motion(text:string){
 if(text.length<1800||text.length>200000||sha(text)!==SOURCE.originalTextSHA256)
  throw Error('Original April8 full extracted-text SHA changed');
 return inspectApr08A10MotionTextCore(text);
}
/** Pure textual structural test harness; NOT an authenticated original source. */
export function inspectApr08A10MotionTextCore(text:string){
 // A roll-call request or a second A10 label is NOT a motion introduction.
 // Multiple nearby introductions remain held rather than silently deduplicated.
 const introductions=[...text.matchAll(
  /\bSenator\s+([A-Za-z][A-Za-z .'-]{1,55}?)\s+(?:moved|moves|offered|proposed)\s+(?:to\s+adopt\s+)?(?:the\s+)?A10\s+Amendment\b/gi
 )];
 if(!introductions.length)throw Error('Original A10 motion introduction missing');
 const results=[...text.matchAll(/With\s+a\s+vote\s+of[\s\S]{0,85}?\b7\s*\/\s*3\s*\/\s*1\b[\s\S]{0,45}?\b(?:motion|amendment)\s+prevail(?:ed|s)\b/gi)];
 if(results.length!==1)throw Error('Original A10 vote 7/3/1 tally is absent or repeated');
 const result=results[0]!;
 const tallyAt=result.index??-1;
 const eligible=introductions.filter(m=>(m.index??-1)<tallyAt&&tallyAt-(m.index??-1)<1100);
 if(eligible.length!==1)throw Error('No unique A10 motion connected to reported division');
 const nearest=eligible[0]!;
 const movedBy=nearest[1]!.trim();
 if(!OFFICIAL.has(movedBy))throw Error('A10 mover not on verified Elections roster');
 const start=Math.max(0,(nearest.index??0)-310),end=Math.min(text.length,tallyAt+620);
 const neighborhood=text.slice(start,end);
 // Restrict named response extraction to the explicit A10 result paragraph.
 const after=flat(text.slice(tallyAt,tallyAt+620));
 const lists=after.match(/Ayes:\s*([A-Za-z\s,.'-]+?)\s+Nays:\s*([A-Za-z\s,.'-]+?)\s+Absent:\s*([A-Za-z\s,.'-]+?)(?=\s+Senator\b|$)/i);
 if(!lists)throw Error('Original A10 source 7/3/1 explicit named Ayes/Nays/Absent lists not isolated');
 const yea=parseNames(lists[1]!),nay=parseNames(lists[2]!),absent=parseNames(lists[3]!);
 if(yea.length!==7||nay.length!==3||absent.length!==1||absent[0]!=='Lucero'
  ||new Set([...yea,...nay,...absent]).size!==11
  ||[...yea,...nay,...absent].some(x=>!OFFICIAL.has(x)))
  throw Error('Original source A10 7/3/1 sides do not exactly partition 11 current Elections senators');
 const beforeMotion=flat(text.slice(Math.max(0,(nearest.index??0)-320),(nearest.index??0)+90));
 const mover=movedBy;
 return {
  hearingDate:SOURCE.date,originalBillAttribution:'SF2384',
  originalMotionLabel:'A10 Amendment',
  originalMotionMover: mover,
  originalA10SourceNearestLabelTextOffset:nearest.index,
  originalExactVoteTallyTextOffset:tallyAt,
  originalNearbyTextSHA256:sha(neighborhood),
  originalPreVoteMotionTextSHA256:sha(beforeMotion),
  originalResultPrintedYeaCount:yea.length,
  originalResultPrintedNayCount:nay.length,
  originalResultPrintedAbsentCount:absent.length,
  sourceLastNamesExactlyMatchElevenSenatorElectionsRoster:true,
  originalSourceChoiceIdentitySHA256:{
   yea:yea.map(x=>sha('yea:'+x.toLowerCase())).sort(),
   nay:nay.map(x=>sha('nay:'+x.toLowerCase())).sort(),
   absent:absent.map(x=>sha('absent:'+x.toLowerCase())).sort(),
  },
  // Tiny temporary motion-only snippet excludes member side list and private contacts.
  provisionalMotionWordingForHumanReview:flat(text.slice(Math.max(0,(nearest.index??0)-180),tallyAt)).slice(0,350),
  originalMinutesMotionNarrativeNotIndependentVideoWitness:true,
  noDistinctHistoricalVoteCertified:true,
  noIndividualMemberVoteEligibleForProductionWithoutSeparateApproval:true,
  absentIndividualMustNotBeAssignedYeaOrNay:true,
  noOpeningMeetingAttendanceSubstituteForMotionTimePresence:true,
 };
}
