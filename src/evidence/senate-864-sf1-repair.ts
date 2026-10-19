/** Exact two-motion add-only correction. No generic parser replay or serving evidence. */
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {activeMembershipCandidates,reconcileHouseMemberName} from '../sources/minnesota/member-reconciliation.js';
import {compareRulesOriginalToStored,normalize2023RulesSf1OfficePrintedName,
 type OriginalRulesSource,type RulesSnapshot} from './senate-864-rules-sf1-source-to-db-parity.js';
import {senateCommitteeHearingTiming} from './senate-committee-meeting-timing.js';
export const SF1_DAY='2023-01-24';
export const SF1_URL='https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf';
export const SF1_SHA='a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379';
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function sf1RepairPlan(source:OriginalRulesSource,snapshot:RulesSnapshot){
 const report=compareRulesOriginalToStored(source,snapshot);
 if(report.holds||report.serviceDayResolvedOriginalMemberChoices!==20)
  throw Error('SF1 independent source/person/store hold');
 if(report.alreadyStoredExactly===2)return {events:[],report};
 if(report.addOnlyCandidatesAwaitingSeparateApproval!==2||report.alreadyStoredExactly!==0)
  throw Error('Partial SF1 state requires separate investigation');
 const active=activeMembershipCandidates(snapshot.historicalRoster,SF1_DAY);
 const events=source.rolls.map((roll,index)=>{
  const votes=roll.memberVotes.map(v=>{
   const r=reconcileHouseMemberName(normalize2023RulesSf1OfficePrintedName(v.sourceName),active);
   if(r.status!=='matched')throw Error('Unresolved original SF1 choice');
   const person=active.find(p=>p.membershipId===r.membershipId)!;
   // Explicit membership bounds are mandatory for a write, even when a legacy
   // resolver's read-only diagnostic tolerated an unknown term boundary.
   if(!person.startsOn||!person.endsOn||person.startsOn>SF1_DAY||person.endsOn<SF1_DAY)
    throw Error('SF1 hearing-day term bounds unproved');
   return {membershipId:r.membershipId,sourceName:v.sourceName,
    normalizedName:v.normalizedName,choice:v.choice};
  });
  const motion=index===0?'failed-oral-rereferral-amendment':'adopted-judiciary-committee-report';
  // Full authenticated original plus distinct parliamentary question; never
  // derive identity from an importer ordinal or merely a matching vote slate.
  const key='senate-committee-source-v1:'+digest([SF1_SHA,SF1_DAY,'SF1',motion]);
  return {key,roll,votes,sourceId:snapshot.documents.find(d=>d.source_url===SF1_URL)!.id};
 });
 return {events,report};
}
export const SF1_INSERT_EVENT=`INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,
 vote_kind,motion_text,amendment_ref,occurred_on,yea_count,nay_count,other_count,passed,is_passage,metadata)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9, $10,$11,0,$12,false,$13::jsonb)
 ON CONFLICT(session_id,chamber_id,external_key) DO NOTHING RETURNING id::text`;
export const SF1_INSERT_CHOICE=`INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,
 normalized_member_name,choice,source_ordinal,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
 ON CONFLICT(vote_event_id,normalized_member_name) DO NOTHING RETURNING id::text`;
export async function insertSf1Plan(db:Pick<PoolClient,'query'>,events:ReturnType<typeof sf1RepairPlan>['events'],context:{sessionId:string;chamberId:string;billId:string}){
 if(events.length!==2)throw Error('Exactly two complete source-proven motions required');
 for(const event of events){
  const r=event.roll,timing=senateCommitteeHearingTiming(SF1_DAY);
  const metadata={committeeVote:true,committeeName:'Rules and Administration',individualVotesAvailable:true,
   finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,
   ...timing.metadata,issue864SourceRepair:'two-sf1-source-anchored-v1',originalPdfSha256:SF1_SHA};
  const result=await db.query(SF1_INSERT_EVENT,[context.sessionId,context.chamberId,context.billId,event.sourceId,
   event.key,r.voteKind,r.motionText,r.amendmentRef??null,SF1_DAY,r.yeaCount,r.nayCount,r.passed,JSON.stringify(metadata)]);
  if(result.rows.length!==1)throw Error('Concurrent or partial SF1 event conflict');
  for(const [i,v] of event.votes.entries()){
   const stored=await db.query(SF1_INSERT_CHOICE,[result.rows[0].id,v.membershipId,v.sourceName,v.normalizedName,v.choice,i,
    JSON.stringify({committeeVote:true,issue864SourceRepair:'two-sf1-source-anchored-v1',sourceIdentity:'official_2023_SR7_and_hearing_day_membership'})]);
   if(stored.rows.length!==1)throw Error('SF1 named choice conflict');
  }
 }
}
