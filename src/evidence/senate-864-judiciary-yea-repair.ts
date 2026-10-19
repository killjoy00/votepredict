/** One independently identified printed choice; no generic importer replay. */
import {createHash} from 'node:crypto';
import type {RulesSnapshot} from './senate-864-rules-sf1-source-to-db-parity.js';
import type {SenateCommitteeVoteObservation} from './minnesota-senate-committee-minutes.js';
export const YEA_DAY='2024-02-21';
export const YEA_URL='https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/20240221/Jud_20240221_minutes.pdf';
export const YEA_SHA='a109e8cbdd2edacc705c4494c35bc096052e9ceb69e16fbbc296b36506dbfa5d';
export const YEA_MOTION_SHA='46643e8d617cc7c0401972b29a94f14df730a35ea90666dc229b352853a6b684';
export const textSha=(s:string)=>createHash('sha256').update(s).digest('hex');
export type JudiciaryYeaSource={roll:SenateCommitteeVoteObservation;independentOfficeAndFullAliasVerified:true};
const fullNames=new Set(['ron latz','ronald steven latz']);
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
export function judiciaryYeaPlan(source:JudiciaryYeaSource,s:RulesSnapshot){
 const r=source.roll;
 if(!source.independentOfficeAndFullAliasVerified||!s.readOnlyTransactionProven||!s.databaseIdentityVerified||
  !s.completeBoundedSourceEventsFetched||!s.explicitRollbackCompleted||
  s.documents.length>100||s.events.length>300||s.choices.length>3000||s.historicalRoster.length>150||
  r.billIdentifier!=='SF3534'||r.yeaCount!==6||r.nayCount!==4||r.passed!==true||
  !r.individualVotesAvailable||r.memberVotes.length!==10||textSha(r.motionText)!==YEA_MOTION_SHA||
  r.memberVotes.filter(v=>v.choice==='yea').length!==6||new Set(r.memberVotes.map(v=>v.normalizedName)).size!==10)
  throw Error('Exact independently verified original and snapshot required');
 const choice=r.memberVotes.filter(v=>v.sourceName==='Latz - Chair'&&v.normalizedName==='latz chair'&&v.choice==='yea');
 if(choice.length!==1)throw Error('Printed office choice changed');
 const docs=s.documents.filter(d=>d.source_url===YEA_URL&&d.content_sha256===YEA_SHA&&d.meeting_date===YEA_DAY&&d.committee_name==='Judiciary and Public Safety');
 if(docs.length!==1||s.documents.filter(d=>d.source_url===YEA_URL||d.content_sha256===YEA_SHA).length!==1)
  throw Error('Original storage identity not unique');
 // Match the complete literal question and original, never an ordinal key.
 const events=s.events.filter(e=>e.source_document_id===docs[0].id&&e.occurred_on===YEA_DAY&&e.bill_identifier==='SF3534'&&
  e.yea_count===6&&e.nay_count===4&&e.passed===true&&e.committee_vote===true&&
  e.committee_name==='Judiciary and Public Safety'&&textSha(e.motion_text??'')===YEA_MOTION_SHA);
 if(events.length!==1||s.events.filter(e=>e.source_document_id===docs[0].id).length!==1)
  throw Error('Exact stored parliamentary question not unique');
 // Independent LRL original explicitly connects Ronald Steven Latz to "Ron";
 // the separate official 2024 attendance register prints "Latz, Ron".
 // Surname-only matching is deliberately absent here.
 const people=s.historicalRoster.filter(p=>[p.name,p.normalizedName??'',...(p.aliases??[])].some(n=>fullNames.has(norm(n))));
 if(people.length!==1||!people[0].startsOn||!people[0].endsOn||people[0].startsOn>YEA_DAY||people[0].endsOn<YEA_DAY)
  throw Error('Full alias and explicit hearing-day membership not unique');
 const person=people[0],event=events[0],stored=s.choices.filter(v=>v.vote_event_id===event.id);
 if(![9,10].includes(stored.length)||new Set(stored.map(v=>v.normalized_member_name)).size!==stored.length||
  stored.some(v=>!v.membership_id||!r.memberVotes.some(x=>x.normalizedName===v.normalized_member_name&&x.choice===v.choice)))
  throw Error('Stored source-choice intersection changed');
 const existing=stored.filter(v=>v.normalized_member_name==='latz chair');
 if(existing.length){
  if(stored.length!==10||existing.length!==1||existing[0].membership_id!==person.membershipId||existing[0].choice!=='yea')
   throw Error('Conflicting repaired choice');
  return {insert:false,eventId:event.id,membershipId:person.membershipId,choice:choice[0]};
 }
 if(stored.length!==9||stored.some(v=>v.membership_id===person.membershipId)||
  r.memberVotes.filter(v=>!stored.some(x=>x.normalized_member_name===v.normalizedName&&x.choice===v.choice)).length!==1)
  throw Error('Not the unique missing office-labelled YEA');
 return {insert:true,eventId:event.id,membershipId:person.membershipId,choice:choice[0]};
}
export const INSERT_JUDICIARY_YEA=`INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,
 normalized_member_name,choice,source_ordinal,metadata) VALUES($1,$2,$3,$4,'yea',NULL,$5::jsonb)
 ON CONFLICT(vote_event_id,normalized_member_name) DO NOTHING RETURNING id::text`;
