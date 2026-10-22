/**
 * Population-wide, ORIGINAL-JOURNAL-only audit for Senate votes whose same
 * original URL/bill/day paper has one complete named ballot but more than
 * one accepted vote on that same bill/day carries those choices.
 *
 * The repeated BALLOT is never a link. The physically printed question plus
 * full ballot must uniquely identify a roll in the entire authenticated
 * government Journal and an accepted vote across the ENTIRE source/day,
 * including unresolved/other bills. Read-only; private names, source URLs,
 * source bodies, full questions, IDs and digests stay in the transaction.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,hash} from './senate-vote-paper-parser.js';
import {parseOriginal,fullQuestion} from './senate-repeated-paper-original-roll-audit.js';
import {classifySameSourceVote,type AcceptedVote,type ParsedAction,
 type SameSourceQuestionCensus} from './senate-same-source-question-census.js';
import type {OriginalJournal,DayAccepted} from './senate-no-tally-original-census.js';

export const SENATE_REPEATED_ACCEPTED_ORIGINAL_AUDIT=
 'senate-repeated-accepted-original-question-audit-v1' as const;
// PostgreSQL SELECT DISTINCT requires ORDER BY the selected expression/alias.
export const REPEATED_ACCEPTED_CLAIMED_ACTION_SQL=[
 'SELECT DISTINCT action_id::text AS id FROM senate_vote_paper_event_links',
 'WHERE action_id=ANY($1::uuid[]) ORDER BY id LIMIT 6501'
].join(' ');
export type RepeatedAcceptedStage=
 'original_source_not_one_verified_journal'|
 'original_rolls_or_roster_unreadable'|
 'no_original_roll_with_exact_full_question_and_ballot'|
 'original_question_and_ballot_repeated_across_rolls'|
 'printed_question_or_bill_span_not_proven'|
 'question_and_ballot_repeated_across_accepted_day'|
 'already_linked_original_question_on_other_paper'|
 'unique_original_question_and_full_ballot';
const STAGES:readonly RepeatedAcceptedStage[]=[
 'original_source_not_one_verified_journal',
 'original_rolls_or_roster_unreadable',
 'no_original_roll_with_exact_full_question_and_ballot',
 'original_question_and_ballot_repeated_across_rolls',
 'printed_question_or_bill_span_not_proven',
 'question_and_ballot_repeated_across_accepted_day',
 'already_linked_original_question_on_other_paper',
 'unique_original_question_and_full_ballot'
];
export interface UniqueAcceptedOriginalRoll {
 vote:AcceptedVote;source:OriginalJournal;
 printedQuestion:string;questionStart:number;rollStart:number;
 rollOrdinal:number;ballot:string;originalTextSha:string;
}
export interface RepeatedAcceptedOriginalAudit {
 schemaVersion:typeof SENATE_REPEATED_ACCEPTED_ORIGINAL_AUDIT;
 repeatedAcceptedBallotVotes:number;
 originalsInspected:number;acceptedDayRows:number;
 stages:Record<RepeatedAcceptedStage,number>;
 groups:Array<{session:string;vote_kind:string;stage:RepeatedAcceptedStage;count:number}>;
 examples:Array<{session:string;bill:string;day:string;stage:RepeatedAcceptedStage;votes:number}>;
 sourceAndAcceptedUniqueCandidates:number;
 exactLinksCreated:0;newSourceActions:0;
 oldSourcePapersChanged:false;originalVotesChanged:false;
 sourceBodiesChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
const key=(v:{source_url:string;bill_id:string;day:string})=>
 JSON.stringify([v.source_url,v.bill_id,v.day]);
function named(x:{votes:Array<{name:string;choice:string}>;yeas:number;nays:number}):string|null{
 return ballotSignature(x.votes,x.yeas,x.nays);
}
export function summarizeRepeatedAcceptedOriginals(
 votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 docs:readonly OriginalJournal[],allDay:readonly DayAccepted[],
 existing:SameSourceQuestionCensus,
 linkedActionIds:ReadonlySet<string>=new Set(),
 onUnique?:(proof:UniqueAcceptedOriginalRoll)=>void
):RepeatedAcceptedOriginalAudit {
 if(votes.length>2500||actions.length>6500||docs.length>220||allDay.length>2500
  ||new Set(votes.map(v=>v.id)).size!==votes.length
  ||new Set(actions.map(a=>a.id)).size!==actions.length
  ||new Set(docs.map(d=>d.id)).size!==docs.length
  ||new Set(allDay.map(a=>a.eventId)).size!==allDay.length)
  throw Error('Repeated accepted ORIGINAL Journal corpus bound or duplicate identity');
 const papers=new Map<string,ParsedAction[]>();
 const accepted=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=key(a),x=papers.get(k)??[];x.push(a);papers.set(k,x)}
 for(const v of votes){const k=key(v),x=accepted.get(k)??[];x.push(v);accepted.set(k,x)}
 const targets=votes.filter(v=>!v.exact_linked&&classifySameSourceVote(
  v,papers.get(key(v))??[],accepted.get(key(v))??[]
 )==='ballot_repeated_across_votes');
 if(targets.length!==existing.totals.ballot_repeated_across_votes)
  throw Error('Repeated accepted named-ballot original source denominator drift');
 const byDocument=new Map(docs.map(d=>[d.id,d]));
 const physical=new Map(docs.map(d=>[d.id,parseOriginal(d)]));
 const stages=Object.fromEntries(STAGES.map(s=>[s,0])) as Record<RepeatedAcceptedStage,number>;
 const groups=new Map<string,{session:string;vote_kind:string;stage:RepeatedAcceptedStage;count:number}>();
 const examples=new Map<string,{session:string;bill:string;day:string;stage:RepeatedAcceptedStage;votes:number}>();
 for(const v of targets){
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day))
   throw Error('Unsafe public Senate original repeated accepted bill/date');
  const sources=[...new Set((papers.get(key(v))??[]).filter(a=>
   a.original_source_verified&&a.source_url===v.source_url
  ).map(a=>a.source_id))];
  const document=sources.length===1?byDocument.get(sources[0]!):undefined;
  const original=document?physical.get(document.id):undefined;
  let stage:RepeatedAcceptedStage;
  if(!document||document.source_url!==v.source_url||!original?.verified
   ||!(v.source_url.split('/').at(-1)??'').startsWith(v.day.replace(/-/g,'')))
   stage='original_source_not_one_verified_journal';
  else if(!original.aligned)stage='original_rolls_or_roster_unreadable';
  else{
   const ballot=ballotSignature(v.votes,v.yea_count,v.nay_count);
   const question=fullQuestion(v.motion_text);
   const rolls=original.rolls.filter(r=>ballot!==null&&r.ballot===ballot
    &&r.question===question&&r.yeas===v.yea_count&&r.nays===v.nay_count);
   if(rolls.length===0)stage='no_original_roll_with_exact_full_question_and_ballot';
   else if(rolls.length!==1)stage='original_question_and_ballot_repeated_across_rolls';
   else{
    const p=rolls[0]!;
    if(p.bill!==v.bill||p.questionStart===null||p.questionStart<0
     ||p.questionStart>=p.start||p.start-p.questionStart>2600
     ||question.length<40||question.length>2600
     ||!/^The question (?:was taken|recurred)\b/i.test(question)
     ||question.includes('The roll was called,')
     ||/JOURNAL OF THE SENATE|\d{1,3}(?:ST|ND|RD|TH) DAY\]/i.test(question)
     ||v.stored_link)
     stage='printed_question_or_bill_span_not_proven';
    else{
     const peers=allDay.filter(a=>a.sourceUrl===v.source_url&&a.day===v.day
      &&a.yeas===v.yea_count&&a.nays===v.nay_count
      &&named(a)===ballot&&fullQuestion(a.motionText)===question);
     if(peers.length!==1||peers[0]!.eventId!==v.id)
      stage='question_and_ballot_repeated_across_accepted_day';
     else if(actions.some(a=>a.source_url===v.source_url&&a.day===v.day
      &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count
      &&a.ballot_sha256===ballot&&fullQuestion(a.question_text)===question
      &&linkedActionIds.has(a.id)))
      stage='already_linked_original_question_on_other_paper';
     else{
      stage='unique_original_question_and_full_ballot';
      if(onUnique)onUnique({vote:v,source:document,
       printedQuestion:question,questionStart:p.questionStart,rollStart:p.start,
       rollOrdinal:p.ordinal,ballot:ballot!,originalTextSha:hash(document.body!)});
     }
    }
   }
  }
  stages[stage]++;
  const gk=JSON.stringify([v.session,v.vote_kind,stage]);
  const g=groups.get(gk)??{session:v.session,vote_kind:v.vote_kind,stage,count:0};
  g.count++;groups.set(gk,g);
  const ek=JSON.stringify([v.session,v.bill,v.day,stage]);
  const e=examples.get(ek)??{session:v.session,bill:v.bill,day:v.day,stage,votes:0};
  e.votes++;examples.set(ek,e);
 }
 if(Object.values(stages).reduce((n,x)=>n+x,0)!==targets.length)
  throw Error('Original repeated accepted full question census did not conserve target votes');
 return {
  schemaVersion:SENATE_REPEATED_ACCEPTED_ORIGINAL_AUDIT,
  repeatedAcceptedBallotVotes:targets.length,
  originalsInspected:docs.length,acceptedDayRows:allDay.length,
  stages,
  groups:[...groups.values()].sort((a,b)=>b.count-a.count||
   a.session.localeCompare(b.session)||a.vote_kind.localeCompare(b.vote_kind)),
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,20),
  sourceAndAcceptedUniqueCandidates:stages.unique_original_question_and_full_ballot,
  exactLinksCreated:0,newSourceActions:0,
  oldSourcePapersChanged:false,originalVotesChanged:false,
  sourceBodiesChanged:false,servingModelsChanged:false,
  completeAmendedBillStatesCertified:0
 };
}
/** Caller has pinned existing VotePredict Neon primary, verified migration
 * ledger and begun REPEATABLE READ READ ONLY; never emit ballots/source text.
 */
export async function readRepeatedAcceptedOriginalAudit(
 db:PoolClient,votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 census:SameSourceQuestionCensus,
 onUnique?:(proof:UniqueAcceptedOriginalRoll)=>void
):Promise<RepeatedAcceptedOriginalAudit>{
 const papers=new Map<string,ParsedAction[]>();
 const accepted=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=key(a),x=papers.get(k)??[];x.push(a);papers.set(k,x)}
 for(const v of votes){const k=key(v),x=accepted.get(k)??[];x.push(v);accepted.set(k,x)}
 const targets=votes.filter(v=>!v.exact_linked&&classifySameSourceVote(
  v,papers.get(key(v))??[],accepted.get(key(v))??[]
 )==='ballot_repeated_across_votes');
 if(targets.length!==census.totals.ballot_repeated_across_votes)
  throw Error('Repeated accepted vote source target count changed under transaction');
 const ids=[...new Set(targets.flatMap(v=>(papers.get(key(v))??[])
  .filter(a=>a.original_source_verified&&a.source_url===v.source_url)
  .map(a=>a.source_id)))];
 const urls=[...new Set(targets.map(v=>v.source_url))];
 if(ids.length>220||urls.length>220)throw Error('Accepted-repeated original Journal URL/ID bound');
 const docs:OriginalJournal[]=ids.length?(await db.query<OriginalJournal>([
  'SELECT d.id::text,d.source_url,',
  "d.metadata#>>'{rawPrepassageVotes,sourceType}' AS source_type,",
  "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
  'EXISTS(SELECT 1 FROM senate_paper_source_verifications p',
  'WHERE p.source_document_id=d.id AND p.source_url=d.source_url',
  "AND p.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
  'AS original_verified FROM source_documents d WHERE d.id=ANY($1::uuid[])',
  'ORDER BY d.id LIMIT 221'
 ].join(' '),[ids])).rows:[];
 const allDay:DayAccepted[]=urls.length?(await db.query<DayAccepted>([
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
 ].join(' '),[urls])).rows:[];
 if(allDay.length>=2501)throw Error('Original accepted source-day collision census truncated');
 const candidatePaperIds=[...new Set(actions.filter(a=>urls.includes(a.source_url)
  &&Number.isInteger(a.yea_count)&&Number.isInteger(a.nay_count)
  &&a.ballot_sha256!==null).map(a=>a.id))];
 if(candidatePaperIds.length>6500)throw Error('Original repeated accepted paper-link corpus truncated');
 const claimed=candidatePaperIds.length?(await db.query<{id:string}>(
  REPEATED_ACCEPTED_CLAIMED_ACTION_SQL,[candidatePaperIds])).rows:[];
 if(claimed.length>6500)throw Error('Original accepted existing paper link corpus exceeded');
 return summarizeRepeatedAcceptedOriginals(votes,actions,docs,allDay,census,
  new Set(claimed.map(x=>x.id)),onUnique);
}
