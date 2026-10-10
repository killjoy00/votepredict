/**
 * #864 — original 19 exact-tally candidate context and date/attendance checks.
 * Standalone source-review classifier: NO ingestion, evidence DB or model use.
 * An official PDF's printed header can contradict its indexed hearing identity.
 */
import { createHash } from 'node:crypto';
import { normalizeMemberName } from '@/sources/minnesota/house-votes';
import type { SupplementalNamedVoteCandidate } from './senate-committee-supplemental-named-roll-review.js';

const sha = (v:string)=>createHash('sha256').update(v).digest('hex');
const months:Record<string,number>={january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12};
const week=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function inspectOfficialSenatePdfHeader(text:string,indexedHearingDate:string){
  if(!/^20(?:2[1-5])-\d\d-\d\d$/.test(indexedHearingDate))
    throw Error('Not a scoped original Senate hearing date');
  const head=text.slice(0,1250);
  const m=head.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*,?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d\d)\b/i);
  let date:null|string=null,weekdayMatches:null|boolean=null;
  if(m){
    const mon=months[m[2]!.toLowerCase()]!;
    const dt=new Date(Date.UTC(Number(m[4]),mon-1,Number(m[3])));
    if(dt.getUTCFullYear()===Number(m[4])&&dt.getUTCMonth()===mon-1&&dt.getUTCDate()===Number(m[3])){
      date=dt.toISOString().slice(0,10);
      weekdayMatches=week[dt.getUTCDay()].toLowerCase()===m[1]!.toLowerCase();
    }
  }
  return {
    indexedHearingDate,printedHeaderDate:date,
    printedHeaderDateAgreesWithIndexedDate:date===null?null:date===indexedHearingDate,
    printedWeekdayMatchesPrintedDate:weekdayMatches,
    sourceDateHeaderNeedsReview:date===null || date!==indexedHearingDate || weekdayMatches===false,
  };
}

export function sourceAbsenteeChoiceConflicts(text:string,
  candidate:SupplementalNamedVoteCandidate){
  const head=text.slice(0,2200);
  const a=head.match(/\bAbsent:\s*([\s\S]{0,550}?)(?=\bSenator\s+[A-Za-zÀ-ÿ .'-]{3,80}?\s+called\s+the\s+meeting\s+to\s+order\b|\bCall\s+to\s+Order\b|\bA\s+quorum\s+is\s+present\b|$)/i);
  if(!a) return {attendanceAbsentSectionFound:false,absentPeopleParsed:0,
    explicitChoiceFingerprintMatchesAbsentee:0,absenteeChoiceFingerprintSha256:[] as string[],
    sourceAttendanceNoAmbiguousAbsencesCertified:false};
  const chunk=a[1]!.trim();
  if(/^No\s+Members?\s+Absent\b/i.test(chunk))return {
    attendanceAbsentSectionFound:true,absentPeopleParsed:0,explicitChoiceFingerprintMatchesAbsentee:0,
    absenteeChoiceFingerprintSha256:[] as string[],sourceAttendanceNoAmbiguousAbsencesCertified:true,
  };
  const rows=[...chunk.matchAll(/\bSenator\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ .'-]{2,75}?)(?=,\s*Senator\b|\n|$)/g)];
  const candidateSet=new Set(candidate.choiceIdentitySha256);
  const conflict=new Set<string>();
  for(const r of rows){
    const person=r[1]!.trim().replace(/\s+/g,' ');
    const suffix=person.split(' ').at(-1)!;
    for(const name of [suffix,person]){
      const norm=normalizeMemberName(name);
      for(const choice of ['yea','nay'] as const){
        const digest=sha(choice+':'+norm);
        if(candidateSet.has(digest))conflict.add(digest);
      }
    }
  }
  return {
    attendanceAbsentSectionFound:true,absentPeopleParsed:rows.length,
    explicitChoiceFingerprintMatchesAbsentee:conflict.size,
    absenteeChoiceFingerprintSha256:[...conflict].sort(),
    sourceAttendanceNoAmbiguousAbsencesCertified:false,
  };
}

export function inspectProvisionalMatchedSenateMotion(input:{
  text:string,indexedHearingDate:string;expectedSourceOffset:number;
  candidate:SupplementalNamedVoteCandidate;
}){
  const {text,indexedHearingDate,expectedSourceOffset,candidate}=input;
  if(text.length<40||text.length>1_000_000||candidate.sourceOffset!==expectedSourceOffset||
    candidate.numericTallyMatchesExplicitNamedList!==true ||
    !candidate.namesUniqueAndExclusive ||
    candidate.sourceReportedYeaCount!==candidate.namedYeaCount ||
    candidate.sourceReportedNayCount!==candidate.namedNayCount)
    throw Error('Unpinned candidate or source tally mismatch; not safe for crosscheck');
  const header=inspectOfficialSenatePdfHeader(text,indexedHearingDate);
  const attendance=sourceAbsenteeChoiceConflicts(text,candidate);
  const start=Math.max(0,expectedSourceOffset-620);
  const end=Math.min(text.length,expectedSourceOffset+400);
  const near=text.slice(start,end);
  const billCandidates=[...near.matchAll(/\b(?:S\.?\s*F\.?|H\.?\s*F\.?)\s*(?:No\.?\s*)?\d{1,5}\b/gi)]
    .map(x=>x[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase());
  const motionContextDetected=/\b(?:amendment|motion|moved|recommended|re-?referred|adopted|prevailed|failed)\b/i.test(near);
  const outcomeMentioned=/\b(?:motion|amendment)\s+(?:failed|prevailed|passed|was\s+adopted)|\bmotion\s+did\s+not\s+prevail/i.test(near);
  const reviewFlags:string[]=[];
  if(header.sourceDateHeaderNeedsReview)reviewFlags.push('printed_header_date_or_weekday_disagrees');
  if(attendance.explicitChoiceFingerprintMatchesAbsentee>0)
    reviewFlags.push('named_vote_choice_matches_person_listed_absent');
  if(!attendance.attendanceAbsentSectionFound)
    reviewFlags.push('attendance_absence_section_not_located');
  if(!motionContextDetected)reviewFlags.push('no_motion_context_detected');
  return {
    indexedHearingDate,sourceTextOffset:expectedSourceOffset,header,attendance,
    sourceNearTextSha256:sha(near),nearestBillIdentifiers:[...new Set(billCandidates)].slice(-6),
    explicitSourceNamedYeaCount:candidate.namedYeaCount,
    explicitSourceNamedNayCount:candidate.namedNayCount,
    numericSourceTallyMatchesNamedLists:true,
    motionContextDetected,outcomeMentioned,
    reviewFlags,needsSourceIdentityReconciliation:reviewFlags.length>0,
    sourceContextForTemporaryHumanReview:near.replace(/\s+/g,' ').slice(0,1015),
    sourceContextPreviewNeverCommittedToPermanentLedger:true,
    actualDistinctRecordedMotionHumanCertified:false,
    officialHistoricalSenatorRosterMatched:false,
    eligibleForIndividualMemberVotes:false,
  };
}