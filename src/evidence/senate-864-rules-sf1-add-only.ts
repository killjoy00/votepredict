/**
 * Issue #864, January 24 2023 SF1. ONLY two SHA-authenticated named votes,
 * never all Senate committee records. Prepare a stable original-action key
 * without parser ordinal and only after 10/10 unique hearing-day senator IDs.
 * No database connection or writes in this module. All private identities
 * stay in the protected runner and are never included in public receipts.
 */
import {createHash} from 'node:crypto';
import {activeMembershipCandidates,reconcileHouseMemberName,
 type MembershipCandidate} from '../sources/minnesota/member-reconciliation.js';
import {normalize2023RulesSf1OfficePrintedName,validateOriginalRulesSF1,
 type OriginalRulesSource,compareRulesOriginalToStored} from
 './senate-864-rules-sf1-source-to-db-parity.js';
import {planVerifiedSenateCommitteeNamedRollAdditions,
 type OriginalMotion} from './senate-864-verified-motion-addition-plan.js';

export const SF1_DAY='2023-01-24';
export const SF1_COMMITTEE='Rules and Administration';
export const SF1_SOURCE='https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf';
export const SF1_PDF_SHA='a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379';
export const SF1_TEXT_SHA='2a6eb9aced550ed193b4329fd447c9be170ccc34ac36ead3544';
export const SF1_BYTES=189421;
export const SF1_MOTION_CONTEXT_SHA=[
 '60665907a1a90d30908a0d2996bd63ffe8223412994d36bbcd3fc6243422ca4d',
 '436866d98930a63e39623e0ef957d9e1e3b6e5a5414ce188dcdc488acac2cffa',
] as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const unique=<T>(rows:readonly T[])=>new Set(rows).size===rows.length;
const uuid=(s:string)=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);

/** Original-text context offsets, never importer/parser observation indices. */
export function uniqueOrderedOriginalContextAnchors(
 originalText:string,contexts:readonly string[]
):Array<{offset:number;contextSha256:string}>{
 if(originalText.length>500000||contexts.length!==2||
  contexts.some(x=>x.length<18||x.length>1200))
  throw Error('Unbounded or incomplete exact original action contexts');
 const canonical=originalText.replace(/\s+/g,' ').trim();
 const anchors=contexts.map(context=>{
  const first=canonical.indexOf(context);
  if(first<0||canonical.indexOf(context,first+1)!==-1)
   throw Error('Original action context missing or repeated');
  return {offset:first,contextSha256:sha(context)};
 });
 if(anchors[0]!.offset>=anchors[1]!.offset||
  !unique(anchors.map(x=>x.contextSha256)))
  throw Error('Two historical motions are not unique ordered original actions');
 return anchors;
}

export type SF1PreparedAction={
 original:OriginalMotion;
 printedChoices:Array<{sourceName:string;normalizedName:string;
  membershipId:string;choice:'yea'|'nay'}>;
};
/** Only source text already independently SHA-authenticated may be passed. */
export function prepareOfficialSF1Motions(input:{
 source:OriginalRulesSource;originalText:string;
 historicalRoster:MembershipCandidate[];
}):SF1PreparedAction[]{
 const {source,originalText,historicalRoster}=input;
 if(!validateOriginalRulesSF1(source)||sha(originalText)!==SF1_TEXT_SHA||
  historicalRoster.length<10||historicalRoster.length>150)
  throw Error('Original SF1 source/text, motion or bounded roster mismatch');
 const offices=['Dziedzic, Chair','Rest, Vice Chair','Johnson, Lead'];
 if(source.rolls.some(r=>{
  const labels=r.memberVotes.map(v=>v.sourceName);
  return offices.some(label=>labels.filter(x=>x===label).length!==1)||
   labels.filter(x=>x.includes(',')).length!==3;
 }))throw Error('Senate SR7 original office labels not reproduced exactly');
 const anchors=uniqueOrderedOriginalContextAnchors(originalText,
  source.rolls.map(r=>r.motionText));
 if(anchors.some((a,i)=>a.contextSha256!==SF1_MOTION_CONTEXT_SHA[i]))
  throw Error('Independent original motion context fingerprints changed');
 const active=activeMembershipCandidates(historicalRoster,SF1_DAY);
 if(active.length<10||active.length>100)throw Error('Service-day roster is incomplete');
 const mapped=source.rolls.map((r,index)=>{
  const printedChoices=r.memberVotes.map(v=>{
   const resolution=reconcileHouseMemberName(
    normalize2023RulesSf1OfficePrintedName(v.sourceName),active);
   if(resolution.status!=='matched'||!uuid(resolution.membershipId))
    throw Error('Original voter not independently and uniquely resolved');
   return {sourceName:v.sourceName,normalizedName:v.normalizedName,
    membershipId:resolution.membershipId,choice:v.choice};
  });
  if(!unique(printedChoices.map(x=>x.membershipId))||
   !unique(printedChoices.map(x=>x.normalizedName))||
   printedChoices.length!==10)
   throw Error('Source vote list is not ten independently identified senators');
  const original:OriginalMotion={
   year:2023,hearingDate:SF1_DAY,committeeName:SF1_COMMITTEE,
   originalSourceSha256:SF1_PDF_SHA,originalNormalizedTextSha256:SF1_TEXT_SHA,
   originalMotionContextSha256:anchors[index]!.contextSha256,
   originalTextOffset:anchors[index]!.offset,
   recordedYea:r.yeaCount,recordedNay:r.nayCount,
   billIdentifier:r.billIdentifier??null,
   amendmentRef:r.amendmentRef??null,
   originalExplicitNamedRoll:true,independentOriginalBodyShaAuthenticated:true,
   historicMemberServiceDayIndependentlyValidated:true,
   memberSides:printedChoices.map(v=>({
    sourceName:v.sourceName,historicalMembershipId:v.membershipId,choice:v.choice,
   })),
  };
  return {original,printedChoices};
 });
 if(!unique(mapped[0]!.printedChoices.map(v=>v.membershipId))||
  !unique(mapped[1]!.printedChoices.map(v=>v.membershipId))||
  mapped[0]!.printedChoices.map(v=>v.membershipId).sort().join('|')!==
   mapped[1]!.printedChoices.map(v=>v.membershipId).sort().join('|'))
  throw Error('Two original printed motions have different historical committee members');
 return mapped;
}
export type SF1ParityReceipt=ReturnType<typeof compareRulesOriginalToStored>;
export function assertEligibleSF1AdditionReport(report:SF1ParityReceipt){
 if(report.schemaVersion!=='senate-864-2023-rules-sf1-source-stored-reconciliation-v1'||
  report.sourceOriginalRawShaVerified!==true||
  report.protectedReadOnlySnapshotAttested!==true||
  report.originalPdfStoredExactlyOnce!==true||
  report.sourceNamedMotions!==2||report.sourceNamedChoiceOccurrences!==20||
  report.originalPdfStoredUnderAnotherOfficialUrl!==0||
  report.exactOriginalSourceStoredEvents!==0||
  report.sameDaySenateRulesSf1CandidateEvents!==0||
  report.serviceDayResolvedOriginalMemberChoices!==20||
  report.alreadyStoredExactly!==0||report.addOnlyCandidatesAwaitingSeparateApproval!==2||
  report.holds!==0||report.perMotionHistoricalNameResolution.length!==2||
  report.perMotionHistoricalNameResolution.some(s=>
   s.matched!==10||s.ambiguous!==0||s.unmatched!==0||
   s.matchedWithInvalidMembershipId!==0||s.duplicateResolvedMemberships!==0)||
  report.statuses.length!==2||
  report.statuses.some((s,i)=>s.status!=='candidate_add_only_after_separate_approval'||
   s.yea!==(i===0?4:6)||s.nay!==(i===0?6:4))||
  report.noLegacyPositionalRekeyOrReplay!==true)
  throw Error('Protected source-to-stored does not authorize either SF1 addition');
 return true;
}
export function assertPostwriteSF1Parity(report:SF1ParityReceipt){
 if(report.protectedReadOnlySnapshotAttested!==true||
  report.sourceOriginalRawShaVerified!==true||
  report.originalPdfStoredExactlyOnce!==true||
  report.sourceNamedMotions!==2||report.sourceNamedChoiceOccurrences!==20||
  report.serviceDayResolvedOriginalMemberChoices!==20||
  report.exactOriginalSourceStoredEvents!==2||
  report.alreadyStoredExactly!==2||
  report.addOnlyCandidatesAwaitingSeparateApproval!==0||report.holds!==0||
  report.statuses.length!==2||
  report.statuses.some(s=>s.status!=='already_stored_exact'||s.exactStoredMatches!==1))
  throw Error('Post-commit source-to-stored SF1 parity is not exact');
 return true;
}
export function planApprovedTwoSF1OriginalKeys(
 originals:readonly OriginalMotion[],candidate:SF1ParityReceipt){
 assertEligibleSF1AdditionReport(candidate);
 const p=planVerifiedSenateCommitteeNamedRollAdditions(originals,{
  originalSourceSha256:SF1_PDF_SHA,
  queryReadOnlyAndRolledBack:candidate.protectedReadOnlySnapshotAttested,
  sourceDocumentShaExactlyMatched:candidate.originalPdfStoredExactlyOnce,
  exhaustiveStoredSourceEventRowsCompared:
   candidate.exactOriginalSourceStoredEvents===0&&
   candidate.sameDaySenateRulesSf1CandidateEvents===0,
  matchedDeployedDatabaseBindingIndependentlyVerified:true,
  events:[],
 });
 if(p.sourceNamedRolls!==2||
  p.addOnlyCandidatesAwaitingExplicitDatabaseApproval!==2||
  p.unresolvedSourceRosterOrSnapshot!==0||p.ambiguouslyExistingOrConflicting!==0||
  p.plans.some(x=>x.status!=='candidate_add_only_after_separate_approval'||
   !x.stableExternalKey||!x.stableExternalKey.startsWith('senate-committee-original-v1:'))||
  !unique(p.plans.map(x=>x.stableExternalKey)))
  throw Error('Stable original-action SF1 insert planner HOLD');
 return p.plans.map(x=>x.stableExternalKey!);
}
