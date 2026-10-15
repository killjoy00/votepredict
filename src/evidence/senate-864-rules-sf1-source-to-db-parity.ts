/**
 * #864: TWO January 24 2023 Senate Rules SF1 original named decisions.
 * Compare in PRIVATE read-only memory to the existing source document,
 * archived committee events, and historical membership roster.
 *
 * No query, migration, model, write, or member identity export in this file.
 * An unanchored legacy event or incomplete source/roster never authorizes an
 * add-only vote. The two decisions must not be collapsed into one bill vote.
 */
import {
 activeMembershipCandidates,reconcileHouseMemberName,
 type MembershipCandidate
} from '../sources/minnesota/member-reconciliation.js';
import {normalizeSenateCommitteeMemberSourceName,
 type SenateCommitteeVoteObservation} from './minnesota-senate-committee-minutes.js';

export type OriginalRulesSource={
 verifiedRawPdfSha:boolean;
 verifiedSourceTextSha:boolean;
 rolls:SenateCommitteeVoteObservation[];
};
export type RulesSourceDoc={
 id:string;source_url:string;content_sha256:string;
 meeting_date:string|null;committee_name:string|null;
};
export type RulesStoredEvent={
 id:string;source_document_id:string|null;external_key:string|null;
 occurred_on:string;bill_identifier:string|null;vote_kind:string;
 amendment_ref:string|null;motion_text:string|null;yea_count:number|null;
 nay_count:number|null;passed:boolean|null;committee_name:string|null;
 committee_vote:boolean;
};
export type RulesStoredChoice={
 vote_event_id:string;normalized_member_name:string;choice:string;
 membership_id:string|null;
};
export type RulesSnapshot={
 readOnlyTransactionProven:boolean;databaseIdentityVerified:boolean;
 completeBoundedSourceEventsFetched:boolean;explicitRollbackCompleted:boolean;
 documents:RulesSourceDoc[];events:RulesStoredEvent[];
 choices:RulesStoredChoice[];historicalRoster:MembershipCandidate[];
};
type ResultStatus=
 'already_stored_exact'|'candidate_add_only_after_separate_approval'|
 'hold_original_not_stored'|'hold_historical_member_resolution'|
 'hold_ambiguous_existing_event'|'hold_conflicting_existing_event'|
 'hold_unverified_snapshot_or_source';
type Detail={sourceMotionOrdinal:0|1;sourcePrintedYea:number;sourcePrintedNay:number;
 status:ResultStatus;matchingStoredEvents:number;competingStoredEvents:number;
 resolvedMemberChoices:number;distinctMotionIdentityProved:true};
const DAY='2023-01-24',COMMITTEE='Rules and Administration';
const SRC='https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf';
const SHA='a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379';
const unique=<T>(v:T[])=>new Set(v).size===v.length;
const validUuid=(id:string)=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
const committee=(v:string|null)=>v!==null&&/rules(?:\s+and\s+administration)?/i.test(v);
const bill=(v:string|null)=>v!==null&&v.replace(/[ .]/g,'').toUpperCase()==='SF1';
export function validateOriginalRulesSF1(source:OriginalRulesSource){
 if(!source.verifiedRawPdfSha||!source.verifiedSourceTextSha||source.rolls.length!==2)
  return false;
 return source.rolls.every((r,i)=>{
  const expected=i===0?{yea:4,nay:6,passed:false,kind:'amendment'}:
   {yea:6,nay:4,passed:true,kind:'motion'};
  return r.billIdentifier==='SF1'&&r.individualVotesAvailable===true&&
   r.yeaCount===expected.yea&&r.nayCount===expected.nay&&
   r.passed===expected.passed&&r.voteKind===expected.kind&&
   r.memberVotes.length===10&&
   r.memberVotes.filter(x=>x.choice==='yea').length===expected.yea&&
   r.memberVotes.filter(x=>x.choice==='nay').length===expected.nay&&
   unique(r.memberVotes.map(x=>x.normalizedName));
 });
}
export function compareRulesOriginalToStored(source:OriginalRulesSource,snapshot:RulesSnapshot){
 if(!validateOriginalRulesSF1(source)||
  !Array.isArray(snapshot.documents)||snapshot.documents.length>100||
  !Array.isArray(snapshot.events)||snapshot.events.length>300||
  !Array.isArray(snapshot.choices)||snapshot.choices.length>3000||
  !Array.isArray(snapshot.historicalRoster)||snapshot.historicalRoster.length>150)
  throw Error('Two exact original named rolls and bounded source/store snapshot required');
 const snapOk=snapshot.readOnlyTransactionProven&&snapshot.databaseIdentityVerified&&
  snapshot.completeBoundedSourceEventsFetched&&snapshot.explicitRollbackCompleted;
 const exactDocs=snapshot.documents.filter(x=>x.source_url===SRC&&
  x.content_sha256===SHA&&x.meeting_date===DAY&&committee(x.committee_name));
 const sameRawPdfDifferentURL=snapshot.documents.filter(x=>x.content_sha256===SHA&&
  x.source_url!==SRC);
 const docsValid=exactDocs.length===1&&sameRawPdfDifferentURL.length===0&&
  snapshot.documents.filter(x=>x.source_url===SRC).length===1;
 const active=activeMembershipCandidates(snapshot.historicalRoster,DAY);
 const dbByEvent=new Map<string,RulesStoredChoice[]>();
 for(const row of snapshot.choices){
  const list=dbByEvent.get(row.vote_event_id)??[];
  list.push(row);dbByEvent.set(row.vote_event_id,list);
 }
 const verifiedMembers=source.rolls.map(original=>{
  const resolved=original.memberVotes.map(v=>{
   const result=reconcileHouseMemberName(
    normalizeSenateCommitteeMemberSourceName(v.sourceName),active);
   return result.status==='matched'?result.membershipId:null;
  });
  return resolved.every(x=>x!==null&&validUuid(x))&&unique(resolved)&&
   resolved.length===10?resolved as string[]:null;
 });
 // Even when each roll has ten independently resolved names, differences
 // between the two ten-person rosters could signal a broken OCR-side parse.
 const sidesConsistent=verifiedMembers.every(Boolean)&&
  verifiedMembers[0]!.slice().sort().join('|')===verifiedMembers[1]!.slice().sort().join('|');
 const sourceSpecificEvents=snapshot.events.filter(x=>
  exactDocs.some(d=>d.id===x.source_document_id));
 const sameDayRelevant=snapshot.events.filter(x=>x.occurred_on===DAY&&
  x.committee_vote&&committee(x.committee_name)&&
  (bill(x.bill_identifier)||exactDocs.some(d=>d.id===x.source_document_id)));
 const eventIds=new Set(snapshot.events.map(x=>x.id));
 const choicesBounded=snapshot.choices.every(c=>eventIds.has(c.vote_event_id));
 const anyAmbiguousDuplicateSource=snapshot.documents.filter(x=>
  x.content_sha256===SHA||x.source_url===SRC).length>1;
 const results:Detail[]=source.rolls.map((r,i)=>{
  const members=verifiedMembers[i];
  const initial={
   sourceMotionOrdinal:i as 0|1,sourcePrintedYea:r.yeaCount,
   sourcePrintedNay:r.nayCount,matchingStoredEvents:0,
   competingStoredEvents:sameDayRelevant.length,
   resolvedMemberChoices:members?.length??0,
   distinctMotionIdentityProved:true as const,
  };
  const result=(status:ResultStatus,matched=0):Detail=>({
   ...initial,status,matchingStoredEvents:matched
  });
  if(!snapOk||!choicesBounded)return result('hold_unverified_snapshot_or_source');
  if(!members||!sidesConsistent)return result('hold_historical_member_resolution');
  if(!docsValid||anyAmbiguousDuplicateSource)
   return result('hold_original_not_stored');
  const sameMoment=sameDayRelevant.filter(e=>
   e.yea_count===r.yeaCount&&e.nay_count===r.nayCount&&
   e.vote_kind===r.voteKind&&e.passed===r.passed&&bill(e.bill_identifier));
  const exact=sameMoment.filter(e=>{
   // A matching bill/date/tally/side slate does NOT prove that this was
   // the same parliamentary decision: identical slates can vote on several
   // amendments and motions in a single committee hearing. Never certify
   // "already stored" without the exact original parsed motion context.
   const originalMotionContext=r.motionText.normalize('NFKC').replace(/\s+/g,' ').trim();
   const storedMotionContext=e.motion_text?.normalize('NFKC').replace(/\s+/g,' ').trim();
   if(!originalMotionContext||storedMotionContext!==originalMotionContext||
    (e.amendment_ref??null)!==(r.amendmentRef??null))return false;
   if(!exactDocs.some(d=>d.id===e.source_document_id)||
    e.occurred_on!==DAY)return false;
   const choices=dbByEvent.get(e.id)??[];
   if(choices.length!==10||choices.some(x=>!x.membership_id||
    !['yea','nay'].includes(x.choice)))return false;
   const sourceSide=r.memberVotes.map((v,idx)=>members[idx]+':'+v.choice).sort().join('|');
   const storedSide=choices.map(v=>v.membership_id+':'+v.choice).sort().join('|');
   return sourceSide===storedSide;
  });
  if(exact.length===1&&sameMoment.length===1)
   return result('already_stored_exact',1);
  if(exact.length>1||sameMoment.length>1)return result('hold_ambiguous_existing_event',exact.length);
  if(sameMoment.length===1)return result('hold_conflicting_existing_event');
  // Another original-source event with this bill on this date may have an
  // unanchored legacy parser index or conflicting bill/motion metadata.
  // Always HOLD instead of creating an apparent duplicate.
  if(sameDayRelevant.some(e=>bill(e.bill_identifier))||
   sourceSpecificEvents.some(e=>e.occurred_on===DAY))
   return result('hold_ambiguous_existing_event');
  return result('candidate_add_only_after_separate_approval');
 });
 const counts=(status:ResultStatus)=>results.filter(x=>x.status===status).length;
 return {
  schemaVersion:'senate-864-2023-rules-sf1-source-stored-reconciliation-v1',
  sourceYear:2023,sourceMeetingDate:DAY,sourceNamedMotions:2,
  sourceNamedChoiceOccurrences:20,sourceOriginalRawShaVerified:source.verifiedRawPdfSha,
  protectedReadOnlySnapshotAttested:snapOk,
  originalPdfStoredExactlyOnce:docsValid,
  originalPdfStoredUnderAnotherOfficialUrl:sameRawPdfDifferentURL.length,
  exactOriginalSourceStoredEvents:sourceSpecificEvents.length,
  sameDaySenateRulesSf1CandidateEvents:sameDayRelevant.length,
  serviceDayResolvedOriginalMemberChoices:verifiedMembers.reduce((n,x)=>n+(x?.length??0),0),
  alreadyStoredExactly:counts('already_stored_exact'),
  addOnlyCandidatesAwaitingSeparateApproval:counts('candidate_add_only_after_separate_approval'),
  holds:results.filter(x=>x.status.startsWith('hold_')).length,
  noPrivateNamesMemberIdsExternalKeysSourceURLsOrChoiceHashesExported:true,
  noProductionWriteOrModelRetraining:true,noLegacyPositionalRekeyOrReplay:true,
  statuses:results.map(x=>({
   motion:x.sourceMotionOrdinal===0?'failed_oral_amendment':'adopted_committee_report',
   yea:x.sourcePrintedYea,nay:x.sourcePrintedNay,status:x.status,
   exactStoredMatches:x.matchingStoredEvents
  }))
 };
}
