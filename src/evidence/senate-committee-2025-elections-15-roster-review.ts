/**
 * #864: independent source-only committee roster check of precisely the 15
 * preliminary 2025 Elections named YEA/NAY blocks with source numeric parity.
 * The actual 2025 original-PDF metadata is first SHA-256 checked.
 *
 * Official date-varying membership:
 * https://www.lrl.mn.gov/timecapsule/commmembers?body=s&comtecode=10073&sess=94&subcomtecode=0
 * Bill Weber served 1/14-2/3/2025, NOT on the post-2/3 meetings in scope.
 * Original indexed Feb13/Mar27 PDFs have conflicting printed date headings;
 * Feb13 PDF also votes 3 names it lists absent. Those records remain HOLD.
 * No automatic vote import, full member roster identity approval or DB read.
 */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '@/sources/minnesota/house-votes';

const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
export const MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER=[
  'Bahr','Boldon','Carlson','Cwodzinski','Koran','Limmer','Lucero',
  'Marty','Mathews','Port','Westlin',
] as const;
export const MN_2025_ELECTIONS_SOURCE_PIN={
  year:2025,originalSourceRun:38079646647,artifactId:11679214346,
  originalArtifactJsonSha256:'689fae2cce78bdd2b26f097a4652232fb49e7162cfab7070179fe72bfaea44f5',
  previouslyShaReverifiedOriginalPdfs:12,provisionalCandidateBlocks:22,
  tallyMatchedBlocks:15,sourceTallyMismatchedBlocks:1,sourceTallyUnknownBlocks:6,
  exactMatchedNamedChoiceTokens:163,yearDistinctMatchedOriginalPdfs:6,
} as const;
const sideMap=new Map<string,{name:string;side:'yea'|'nay'}>();
for(const surname of MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER){
  for(const side of ['yea','nay'] as const){
    const key=sha(side+':'+normalizeMemberName(surname));
    if(sideMap.has(key))throw Error('Official 2025 post-Feb3 Senate committee fingerprint collision');
    sideMap.set(key,{name:normalizeMemberName(surname),side});
  }
}
if(MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER.length!==11)
  throw Error('Post-Feb3 Elections committee does not have exactly 11 members');

type OriginalSourceBlock={
  sourceOffset:number;namedYeaCount:number;namedNayCount:number;
  sourceReportedYeaCount:number|null;sourceReportedNayCount:number|null;
  namesUniqueAndExclusive:boolean;numericTallyMatchesExplicitNamedList:null|boolean;
  choiceIdentitySha256:string[];
};
export function validate2025OriginalElectionsSourceBlock(block:OriginalSourceBlock){
  if(block.numericTallyMatchesExplicitNamedList!==true||
    block.namesUniqueAndExclusive!==true||
    !Array.isArray(block.choiceIdentitySha256)||
    block.choiceIdentitySha256.length!==block.namedYeaCount+block.namedNayCount||
    block.sourceReportedYeaCount!==block.namedYeaCount||
    block.sourceReportedNayCount!==block.namedNayCount||
    block.namedYeaCount<0||block.namedNayCount<0)
    throw Error('Original candidate explicit names or source numeric totals do not match');
  const seen=new Set<string>();
  let yea=0,nay=0;
  for(const value of block.choiceIdentitySha256){
    if(!/^[a-f0-9]{64}$/.test(value))throw Error('Invalid original committee side fingerprint');
    const member=sideMap.get(value);
    if(!member)throw Error('Original named voter is not on historical post-Feb3 Elections committee roster');
    if(seen.has(member.name))throw Error('Original vote includes one member more than once');
    seen.add(member.name);
    if(member.side==='yea')yea++;
    else nay++;
  }
  if(yea!==block.namedYeaCount||nay!==block.namedNayCount||
    seen.size>11||seen.size<9)
    throw Error('Original numeric side or source member count invalid for 2025 Elections');
  const missing=MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER
    .map(normalizeMemberName).filter(n=>!seen.has(n));
  return {
    matchedKnownRosterNames:seen.size,
    originalSourceNamedYeaNayTokens:yea+nay,
    rosterMembersWithNoNamedChoice:missing.length,
    missingMembersSha256:missing.map(sha).sort(),
    noChoiceDoesNotProveAbsentOrPass:true,
    independentlyValidatedOriginalMeetingAttendance:false,
    approvedHistoricalMemberVote:false,
  };
}
export type AuditTarget2025={
  year:number;hearingDate:string;committeeName:string;officialSourcePdfUrl:string;
  sourceTextOffset:number;yeaNamed:number;nayNamed:number;
  sourceNumericTallyMatchesNames:boolean;eligibleAsMemberVote:boolean;
};
export function audit2025OriginalElectionsAgainstPublicRoster(
 originalRunJson:string,
 prioritizedTallyMatchQueueJson:string,
){
  const pin=MN_2025_ELECTIONS_SOURCE_PIN;
  if(sha(originalRunJson)!==pin.originalArtifactJsonSha256)
    throw Error('Original 2025 Senate source artifact raw JSON SHA256 differs from exact review');
  const original=JSON.parse(originalRunJson) as {
    year:number;expectedOriginalPdfCount:number;originalPdfTextReverified:number;
    unresolvedPdfCount:number;
    supplementalSummary:{
      candidateMotionOrVoteBlocks:number;blocksWithExactNamedAndSourceTallyMatch:number;
      blocksWithSourceTallyMismatch:number;blocksWithoutSourceNumericTally:number;
    };
    candidates:Array<{
      year:number;hearingDate:string;committeeName:string;originalOfficialPdfUrl:string;
      supplementalCandidateEvidence:OriginalSourceBlock[];
    }>;
  };
  const officialQueue=JSON.parse(prioritizedTallyMatchQueueJson) as {
    issue:number;sourceRunId:number;totalCandidateBlocks:number;
    explicitNamedSourceTokens:number;records:AuditTarget2025[];
  };
  if(officialQueue.issue!==864||officialQueue.sourceRunId!==pin.originalSourceRun||
    officialQueue.totalCandidateBlocks!==19||officialQueue.explicitNamedSourceTokens!==196||
    officialQueue.records.length!==19)
    throw Error('Reviewed high-priority source-offset queue changed identity');
  if(original.year!==2025||original.originalPdfTextReverified!==pin.previouslyShaReverifiedOriginalPdfs||
    original.unresolvedPdfCount!==0||
    original.supplementalSummary.candidateMotionOrVoteBlocks!==pin.provisionalCandidateBlocks||
    original.supplementalSummary.blocksWithExactNamedAndSourceTallyMatch!==pin.tallyMatchedBlocks||
    original.supplementalSummary.blocksWithSourceTallyMismatch!==pin.sourceTallyMismatchedBlocks||
    original.supplementalSummary.blocksWithoutSourceNumericTally!==pin.sourceTallyUnknownBlocks)
    throw Error('Previously verified original 2025 Senate source candidate counts changed');

  const targeted=officialQueue.records.filter(r=>r.year===2025);
  if(targeted.length!==15 || new Set(targeted.map(x=>x.officialSourcePdfUrl)).size!==6)
    throw Error('Exact 15 source offsets and six unique originals changed');
  const entries:Array<{
    hearingDate:string;officialOriginalPdfUrl:string;originalSourceTextOffset:number;
    memberChoiceTokens:number;knownRosterFingerprints:number;noNamedChoiceMembers:number;
    missingRosterNamesSha256:string[];
    sourceDateAndAttendanceReviewState:
      'HOLD_PRINTED_DATE_AND_ABSENT_MEMBER_CONFLICT'|'HOLD_PRINTED_HEARING_DATE_MISMATCH'|
      'SOURCE_ROSTER_MATCH_REQUIRES_DATE_SPECIFIC_ATTENDANCE';
    notEvidenceReady:true;unrecordedRosterMembersNotImputed:true;
  }>=[];
  for(const r of targeted){
    const doc=original.candidates.find(x=>x.originalOfficialPdfUrl===r.officialSourcePdfUrl);
    if(!doc||doc.year!==2025||doc.hearingDate!==r.hearingDate||
      doc.committeeName!=='Elections'||
      !(r.hearingDate>'2025-02-03' && r.hearingDate<='2025-12-31')||
      !/^\d{4}-\d\d-\d\d$/.test(r.hearingDate)||
      !r.officialSourcePdfUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/'))
      throw Error('Official year or hearing source identity no longer in independent original audit');
    const block=doc.supplementalCandidateEvidence.find(v=>
      v.sourceOffset===r.sourceTextOffset&&v.namedYeaCount===r.yeaNamed&&
      v.namedNayCount===r.nayNamed);
    if(!block)throw Error('Exact 2025 original candidate source offset has drifted');
    const checked=validate2025OriginalElectionsSourceBlock(block);
    const risk=r.hearingDate==='2025-02-13'?'HOLD_PRINTED_DATE_AND_ABSENT_MEMBER_CONFLICT' as const
      :r.hearingDate==='2025-03-27'?'HOLD_PRINTED_HEARING_DATE_MISMATCH' as const
      :'SOURCE_ROSTER_MATCH_REQUIRES_DATE_SPECIFIC_ATTENDANCE' as const;
    entries.push({
      hearingDate:r.hearingDate,officialOriginalPdfUrl:r.officialSourcePdfUrl,
      originalSourceTextOffset:r.sourceTextOffset,
      memberChoiceTokens:checked.originalSourceNamedYeaNayTokens,
      knownRosterFingerprints:checked.matchedKnownRosterNames,
      noNamedChoiceMembers:checked.rosterMembersWithNoNamedChoice,
      missingRosterNamesSha256:checked.missingMembersSha256,
      sourceDateAndAttendanceReviewState:risk,notEvidenceReady:true,
      unrecordedRosterMembersNotImputed:true,
    });
  }
  const sum=entries.reduce((a,x)=>a+x.memberChoiceTokens,0);
  if(sum!==pin.exactMatchedNamedChoiceTokens ||
    entries.filter(x=>x.knownRosterFingerprints===11).length!==14||
    entries.filter(x=>x.knownRosterFingerprints===9).length!==1||
    entries.filter(x=>x.sourceDateAndAttendanceReviewState.startsWith('HOLD')).length!==2||
    new Set(entries.map(x=>x.officialOriginalPdfUrl+'|'+x.originalSourceTextOffset)).size!==15)
    throw Error('Original 2025 Senate roster and source conflict denominator drifted');
  return {
    schemaVersion:'senate-2025-elections-15-original-roll-public-roster-check-v1',issue:864,
    historicalRosterSource:'https://www.lrl.mn.gov/timecapsule/commmembers?body=s&comtecode=10073&sess=94&subcomtecode=0',
    originalSourceArtifactId:pin.artifactId,
    originalSourceArtifactJsonSha256:pin.originalArtifactJsonSha256,
    originalSourceRunId:pin.originalSourceRun,
    historicalPostFeb3ElectionsCommitteeMemberCount:11,
    completeElevenNamedMemberBlocks:14,nineOfElevenNamedMemberBlocks:1,
    full2025MatchedSourceBlocks:15,explicitNamedYeaNaySourceChoiceTokens:sum,
    blockSourcesWithDateOrAttendanceConflict:2,
    namesNotInOfficialHistoricalRoster:0,
    noRosterMemberVotedOrAbsentByInference:true,
    onlySourceRosterHashMatchedNotOriginalMeetingAttendance:true,
    noHistoricalPrivateEvidenceDatabaseAccessOrMutation:true,
    noForecastModelServingScheduler2027Changes:true,
    candidates:entries,
  };
}