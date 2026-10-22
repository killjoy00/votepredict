/**
 * Protected, read-only question-level triage for Senate votes where multiple
 * source-local papers share the same complete named ballot.
 *
 * A tally or duplicated ballot is NEVER a vote-to-paper link. The only
 * candidate emitted for later independent ORIGINAL Journal replay has one
 * exact FULL question+ballot on both sides of the entire source day, an
 * authenticated paper source, and no existing event link on either side.
 * This file performs zero writes and never exports ballots, source text,
 * internal identities, or member names in its summary.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,compact} from './senate-vote-paper-parser.js';
import {classifySameSourceVote,type AcceptedVote,type ParsedAction,
 type SameSourceQuestionCensus} from './senate-same-source-question-census.js';
import type {DayAccepted} from './senate-no-tally-original-census.js';

export const REPEATED_PAPER_QUESTION_AUDIT='senate-repeated-paper-full-question-audit-v1' as const;
export type RepeatedQuestionStage=
 'no_exact_full_question_on_paper'|'same_full_question_multiple_papers'|
 'same_full_question_on_other_original_paper'|'accepted_full_question_not_unique'|
 'unverified_original_paper'|'paper_action_already_linked'|
 'original_source_replay_candidate';
const STAGES:readonly RepeatedQuestionStage[]=[
 'no_exact_full_question_on_paper','same_full_question_multiple_papers',
 'same_full_question_on_other_original_paper','accepted_full_question_not_unique',
 'unverified_original_paper','paper_action_already_linked',
 'original_source_replay_candidate'
];
export interface RepeatedQuestionCandidate {
 accepted:AcceptedVote;action:ParsedAction;
}
export interface RepeatedQuestionAudit {
 schemaVersion:typeof REPEATED_PAPER_QUESTION_AUDIT;
 repeatedPaperBallotVotes:number;
 acceptedDayRows:number;
 stages:Record<RepeatedQuestionStage,number>;
 groups:Array<{session:string;vote_kind:string;stage:RepeatedQuestionStage;count:number}>;
 examples:Array<{session:string;bill:string;day:string;stage:RepeatedQuestionStage;votes:number}>;
 originalSourceReplayCandidates:number;
 originalPrintedSourceSpansCertified:0;
 acceptedEventLinksCreated:0;
 sourceBodiesChanged:false;acceptedVotesChanged:false;oldPaperActionsChanged:false;
 completeAmendedBillStatesCertified:0;
}
function scoped(v:{source_url:string;bill_id:string;day:string}):string{
 return JSON.stringify([v.source_url,v.bill_id,v.day]);
}
function fullQuestion(text:string):string{
 const matches=[...text.matchAll(/The question (?:was taken|recurred)/gi)];
 return compact(matches.length?text.slice(matches.at(-1)!.index):text);
}
function signature(v:{votes:Array<{name:string;choice:string}>;yeas:number;nays:number}):string|null{
 return ballotSignature(v.votes,v.yeas,v.nays);
}
export function summarizeRepeatedPaperQuestionAudit(
 votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 acceptedDay:readonly DayAccepted[],existing:SameSourceQuestionCensus,
 linkedActionIds:ReadonlySet<string>=new Set(),
 onCandidate?:(candidate:RepeatedQuestionCandidate)=>void
):RepeatedQuestionAudit{
 if(votes.length>2500||actions.length>6500||acceptedDay.length>2500
  ||new Set(votes.map(x=>x.id)).size!==votes.length
  ||new Set(actions.map(x=>x.id)).size!==actions.length
  ||new Set(acceptedDay.map(x=>x.eventId)).size!==acceptedDay.length)
  throw Error('Repeated-paper question replay population/identity bound');
 const actionsByScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scoped(a),list=actionsByScope.get(k)??[];list.push(a);actionsByScope.set(k,list)}
 for(const v of votes){const k=scoped(v),list=votesByScope.get(k)??[];list.push(v);votesByScope.set(k,list)}
 const targets=votes.filter(v=>!v.exact_linked
  &&classifySameSourceVote(v,actionsByScope.get(scoped(v))??[],
   votesByScope.get(scoped(v))??[])==='ballot_repeated_across_papers');
 if(targets.length!==existing.totals.ballot_repeated_across_papers)
  throw Error('Repeated-paper full-question denominator drift');
 const totals=Object.fromEntries(STAGES.map(s=>[s,0])) as Record<RepeatedQuestionStage,number>;
 const groups=new Map<string,{session:string;vote_kind:string;stage:RepeatedQuestionStage;count:number}>();
 const examples=new Map<string,{session:string;bill:string;day:string;stage:RepeatedQuestionStage;votes:number}>();
 for(const v of targets){
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day))
   throw Error('Unsafe repeated-paper public bill/day identifier');
  const sig=ballotSignature(v.votes,v.yea_count,v.nay_count);
  if(!sig)throw Error('Repeated-paper vote lost its complete accepted ballot');
  const papers=(actionsByScope.get(scoped(v))??[]).filter(a=>
   (a.source_id===v.source_id||a.original_source_verified)
   &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count
   &&a.ballot_sha256===sig);
  if(papers.length<2)throw Error('Original repeated paper cohort no longer repeated');
  const q=fullQuestion(v.motion_text);
  const same=papers.filter(a=>fullQuestion(a.question_text)===q);
  let stage:RepeatedQuestionStage;
  if(same.length===0)stage='no_exact_full_question_on_paper';
  else if(same.length!==1)stage='same_full_question_multiple_papers';
  else{
   const allPaperQuestions=actions.filter(a=>a.source_url===v.source_url&&a.day===v.day
    &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count
    &&a.ballot_sha256===sig&&fullQuestion(a.question_text)===q);
   if(allPaperQuestions.length!==1)stage='same_full_question_on_other_original_paper';
   else{
    const peers=acceptedDay.filter(x=>x.sourceUrl===v.source_url&&x.day===v.day
     &&x.yeas===v.yea_count&&x.nays===v.nay_count
     &&signature(x)===sig&&fullQuestion(x.motionText)===q);
    if(peers.length!==1||peers[0]!.eventId!==v.id)
     stage='accepted_full_question_not_unique';
    else if(!same[0]!.original_source_verified)
     stage='unverified_original_paper';
    else if(linkedActionIds.has(same[0]!.id))
     stage='paper_action_already_linked';
    else{
     stage='original_source_replay_candidate';
     if(onCandidate)onCandidate({accepted:v,action:same[0]!});
    }
   }
  }
  totals[stage]++;
  const gk=JSON.stringify([v.session,v.vote_kind,stage]);
  const g=groups.get(gk)??{session:v.session,vote_kind:v.vote_kind,stage,count:0};
  g.count++;groups.set(gk,g);
  const ek=JSON.stringify([v.session,v.bill,v.day,stage]);
  const e=examples.get(ek)??{session:v.session,bill:v.bill,day:v.day,stage,votes:0};
  e.votes++;examples.set(ek,e);
 }
 if(Object.values(totals).reduce((n,x)=>n+x,0)!==targets.length)
  throw Error('Repeated-paper full-question audit did not conserve all votes');
 return {
  schemaVersion:REPEATED_PAPER_QUESTION_AUDIT,
  repeatedPaperBallotVotes:targets.length,acceptedDayRows:acceptedDay.length,
  stages:totals,
  groups:[...groups.values()].sort((a,b)=>b.count-a.count||
   a.session.localeCompare(b.session)||a.vote_kind.localeCompare(b.vote_kind)),
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,20),
  originalSourceReplayCandidates:totals.original_source_replay_candidate,
  originalPrintedSourceSpansCertified:0,acceptedEventLinksCreated:0,
  sourceBodiesChanged:false,acceptedVotesChanged:false,oldPaperActionsChanged:false,
  completeAmendedBillStatesCertified:0
 };
}
/** Use only inside authenticated REPEATABLE READ READ ONLY Neon transaction. */
export async function readRepeatedPaperQuestionAudit(
 db:PoolClient,votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 census:SameSourceQuestionCensus
):Promise<RepeatedQuestionAudit>{
 const eligible=votes.filter(v=>!v.exact_linked);
 const targetUrls=[...new Set(eligible.map(v=>v.source_url))];
 if(!targetUrls.length)return summarizeRepeatedPaperQuestionAudit(votes,actions,[],census);
 if(targetUrls.length>600)throw Error('Repeated-paper URL source corpus unexpectedly large');
 const acceptedDay=(await db.query<DayAccepted>([
  'SELECT v.id::text AS "eventId",d.source_url AS "sourceUrl",',
  'v.occurred_on::text AS day,b.identifier AS "billIdentifier",',
  'v.vote_kind AS "voteKind",v.motion_text AS "motionText",',
  'v.yea_count AS yeas,v.nay_count AS nays,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',mv.source_member_name,",
  "'choice',mv.choice)) FROM member_votes mv WHERE mv.vote_event_id=v.id),'[]'::jsonb) AS votes,",
  'EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v e WHERE e.vote_event_id=v.id)',
  'AS "existingExact"',
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  "JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'",
  'JOIN legislative_sessions s ON s.id=v.session_id',
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
  'LEFT JOIN bills b ON b.id=v.bill_id',
  'WHERE d.source_url=ANY($1::text[])',
  "AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
  'ORDER BY d.source_url,v.occurred_on,v.id LIMIT 2501'
 ].join(' '),[targetUrls])).rows;
 if(acceptedDay.length>=2501)throw Error('Full-day original accepted vote collision corpus truncated');
 const preliminary:RepeatedQuestionCandidate[]=[];
 summarizeRepeatedPaperQuestionAudit(votes,actions,acceptedDay,census,new Set(),
  p=>preliminary.push(p));
 const ids=preliminary.map(p=>p.action.id);
 const already=ids.length?(await db.query<{id:string}>([
  'SELECT DISTINCT action_id::text AS id FROM senate_vote_paper_event_links',
  'WHERE action_id=ANY($1::uuid[])'
 ].join(' '),[ids])).rows:[];
 return summarizeRepeatedPaperQuestionAudit(votes,actions,acceptedDay,census,
  new Set(already.map(x=>x.id)));
}
