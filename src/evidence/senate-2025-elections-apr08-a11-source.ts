/**
 * #864: Individually inspect the adjacent 2025-04-08 Elections SF2384 A11
 * named 10 YEA / 0 NAY / 1 explicitly Absent ORIGINAL source paragraph.
 * No automatic member_vote writes or statewide denominator increment.
 */
import {createHash} from 'node:crypto';
import {SOURCE as APR08_A10_ORIGINAL} from './senate-2025-elections-apr08-a10-source.js';

export const APR08_A11_SOURCE_SCHEMA=
 'senate-2025-elections-apr08-sf2384-a11-original-10-0-1-motion-source-review-v1' as const;
export const SOURCE=APR08_A10_ORIGINAL;
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const ROSTER=new Set([
 'Carlson','Westlin','Bahr','Boldon','Cwodzinski','Limmer',
 'Marty','Port','Koran','Mathews','Lucero'
]);
const flat=(s:string)=>s.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const parseNames=(s:string)=>s.split(/\s*,\s*/).map(v=>v.trim()).filter(Boolean);
const isExactRoster=(members:string[],roster:ReadonlySet<string>)=>
 members.length===11&&new Set(members).size===11&&members.every(x=>roster.has(x));

export function inspectOriginalApr08A11Motion(text:string){
 if(text.length<1800||text.length>200000||sha(text)!==SOURCE.originalTextSHA256)
  throw Error('Original April8 full PDF extracted-text SHA changed');
 return inspectApr08A11MotionTextCore(text);
}
/** Structural diagnostic, NOT authenticated source: real original must pass SHA wrapper. */
export function inspectApr08A11MotionTextCore(text:string){
 return inspectTextCore(text,ROSTER,'Lucero');
}
/** Explicit FAKE-roster fixture harness; NEVER source-authentic or production. */
export function inspectSyntheticApr08A11MotionTextCore(
 text:string,fictionalRoster:readonly string[],fictionalAbsent:string
){
 if(fictionalRoster.length!==11||new Set(fictionalRoster).size!==11
  ||!fictionalRoster.includes(fictionalAbsent)
  ||fictionalRoster.some(x=>ROSTER.has(x)))
  throw Error('Invalid explicitly fictional synthetic roster');
 return inspectTextCore(text,new Set(fictionalRoster),fictionalAbsent);
}
function inspectTextCore(text:string,roster:ReadonlySet<string>,expectedAbsent:string){
 if(text.length<1800||text.length>200000)
  throw Error('A11 structural fixture length invalid');
 // Roll request and later label repetition are not a motion. A second motion
 // introduction on the same amendment requires separate semantic review.
 const introductions=[...text.matchAll(
  /\bSenator\s+([A-Za-z][A-Za-z .'-]{1,55}?)\s+(?:moved|moves|offered|proposed)\s+(?:to\s+adopt\s+)?(?:the\s+)?A11\s+Amendment\b/gi
 )];
 if(introductions.length!==1)
  throw Error('A11 exact amendment motion introduction missing or repeated');
 const motion=introductions[0]!;
 const motionAt=motion.index??-1;
 // Fail closed *within A11's own procedural section*. Other amendments may
 // independently have identical 10/0/1 tallies elsewhere in a long hearing.
 // End at the next explicitly introduced numbered amendment, not at a
 // request for roll call or another mere reference to an amendment label.
 const nextAmendmentMoves=[...text.matchAll(
  /\bSenator\s+[A-Za-z][A-Za-z .'-]{1,55}?\s+(?:moved|moves|offered|proposed)\s+(?:to\s+adopt\s+)?(?:the\s+)?A\d+\s+Amendment\b/gi
 )].filter(x=>(x.index??-1)>motionAt+motion[0].length);
 const nextMotionAt=nextAmendmentMoves[0]?.index??text.length;
 const sectionEnd=Math.min(text.length,motionAt+1600,nextMotionAt);
 const tallyRegex=/With\s+a\s+vote\s+of[\s\S]{0,85}?\b10\s*\/\s*0\s*\/\s*1\b[\s\S]{0,45}?\b(?:motion|amendment)\s+prevail(?:ed|s)\b/gi;
 const allMeetingMatches=[...text.matchAll(tallyRegex)];
 const sectionMatches=[...text.slice(motionAt,sectionEnd).matchAll(tallyRegex)];
 if(sectionMatches.length!==1)
  throw Error('A11 scoped 10/0/1 result absent or repeated within motion section');
 const tallyAt=motionAt+(sectionMatches[0]!.index??-1);
 if(tallyAt<=motionAt||tallyAt-motionAt>1100)
  throw Error('A11 explicit result not connected to uniquely introduced motion');
 const mover=motion[1]!.trim();
 if(!roster.has(mover))throw Error('A11 mover not on validated committee roster');
 const billContext=flat(text.slice(Math.max(0,motionAt-420),tallyAt));
 if(!/\bS\.?\s*F\.?\s*2384\b/i.test(billContext))
  throw Error('A11 actual bill SF2384 not tied to the printed source paragraph');
 const after=flat(text.slice(tallyAt,Math.min(sectionEnd,tallyAt+760)));
 const parts=after.match(
  /\bAyes:\s*([A-Za-z\s,.'-]+?)\s+Nays:\s*([\s\S]*?)\s*Absent:\s*([A-Za-z\s,.'-]+?)(?=\s+Senator\b|$)/i
 );
 if(!parts)throw Error('A11 printed named Ayes/Nays/Absent partition not isolated');
 const yea=parseNames(parts[1]!),nay=parseNames(parts[2]!),absent=parseNames(parts[3]!);
 if(yea.length!==10||nay.length!==0||absent.length!==1
  ||absent[0]!==expectedAbsent
  ||!isExactRoster([...yea,...nay,...absent],roster))
  throw Error('A11 real printed 10/0/1 partition does not match exact roster');
 const neighborhood=text.slice(Math.max(0,motionAt-300),Math.min(sectionEnd,tallyAt+700));
 const motionWording=flat(text.slice(motionAt,tallyAt)).slice(0,240);
 if(/\bAyes:\b|\bNays:\b/i.test(motionWording))
  throw Error('Pre-result A11 motion preview leaks member list');
 return {
  hearingDate:SOURCE.date,committee:'Elections',bill:'SF2384',
  originalMotionLabel:'A11 Amendment',originalPrintedMover:mover,
  originalMotionIntroductionTextOffset:motionAt,
  originalExactResultTextOffset:tallyAt,
  originalA11MotionSectionEndOffset:sectionEnd,
  originalWholeMeetingTenZeroOneResultCandidates:allMeetingMatches.length,
  originalScopedA11TenZeroOneResultCandidates:sectionMatches.length,
  originalNearbyTextSHA256:sha(neighborhood),
  originalPreVoteTextSHA256:sha(text.slice(Math.max(0,motionAt-260),tallyAt)),
  printedYeaCount:10,printedNayCount:0,printedAbsentCount:1,
  printedAbsentMember:expectedAbsent,
  originalExactElevenNameRosterPartition:true,
  sourceSideIdentityHashOnly:{
   yea:yea.map(x=>sha('yea:'+x.toLowerCase())).sort(),
   nay:nay.map(x=>sha('nay:'+x.toLowerCase())).sort(),
   absent:absent.map(x=>sha('absent:'+x.toLowerCase())).sort()
  },
  sourceMotionOnlyShortPreview:motionWording,
  noAutomaticDistinctRecordedVoteCertificate:true,
  noFullSourceSideListCommitted:true,
  absentCannotBecomeYeaOrNay:true,
  originalAudioVideoNotIndependentlyConfirmed:true,
  neverSameDayForecastEligibleWithoutMotionTime:true,
  noPrivateProductionDbReadsOrWrites:true
 };
}
