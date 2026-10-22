/**
 * #1498: independent ORIGINAL government Senate Journal source-only diagnosis
 * for the entire unresolved same-bill/day/URL full-named-ballot mismatch class.
 *
 * The accepted vote has a complete roster and the v1 stored paper has the
 * correct printed tally but DIFFERENT member choices. Neither is overwritten.
 * A uniquely printed ORIGINAL physical roll can demonstrate a v1 parsing /
 * association problem only when its full literal question AND entire named
 * ballot match the accepted event, uniquely on both the original and the
 * complete accepted source-day (including other/unknown bill identities).
 *
 * Protected REPEATABLE READ READ ONLY; never print private source URLs, names,
 * IDs, ballots, question text or original Journal bodies. Zero writes.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,compact,hash} from './senate-vote-paper-parser.js';
import {parseOriginal,fullQuestion,type UniqueOriginalRoll}
 from './senate-repeated-paper-original-roll-audit.js';
import {classifySameSourceVote,type AcceptedVote,type ParsedAction,
 type SameSourceQuestionCensus} from './senate-same-source-question-census.js';
import type {OriginalJournal,DayAccepted} from './senate-no-tally-original-census.js';

export const SENATE_NAMED_MISMATCH_ORIGINAL_AUDIT=
 'senate-full-named-ballot-mismatch-original-source-v1' as const;
export type MismatchOriginalStage=
 'original_source_not_one_verified_journal'|
 'original_rolls_or_roster_unreadable'|
 'original_question_and_tally_absent'|
 'accepted_ballot_only_on_different_original_question'|
 'original_question_and_tally_unreadable_ballot'|
 'original_question_and_tally_different_named_ballot'|
 'original_question_and_full_ballot_repeated'|
 'original_question_has_unreadable_duplicate_roll'|
 'original_printed_question_or_bill_span_unproven'|
 'original_accepted_source_day_collision'|
 'original_question_already_claimed_by_paper'|
 'unique_original_v1_question_wrong_named_ballot'|
 'unique_original_v1_wrong_question_association';
const STAGES:readonly MismatchOriginalStage[]=[
 'original_source_not_one_verified_journal',
 'original_rolls_or_roster_unreadable',
 'original_question_and_tally_absent',
 'accepted_ballot_only_on_different_original_question',
 'original_question_and_tally_unreadable_ballot',
 'original_question_and_tally_different_named_ballot',
 'original_question_and_full_ballot_repeated',
 'original_question_has_unreadable_duplicate_roll',
 'original_printed_question_or_bill_span_unproven',
 'original_accepted_source_day_collision',
 'original_question_already_claimed_by_paper',
 'unique_original_v1_question_wrong_named_ballot',
 'unique_original_v1_wrong_question_association'
];
const scope=(x:{source_url:string;bill_id:string;day:string})=>
 JSON.stringify([x.source_url,x.bill_id,x.day]);
function sourceDaySignature(x:DayAccepted):string|null{
 return ballotSignature(x.votes,x.yeas,x.nays);
}
export interface NamedMismatchOriginalAudit{
 schemaVersion:typeof SENATE_NAMED_MISMATCH_ORIGINAL_AUDIT;
 mismatchAcceptedVotes:number;
 authenticatedOriginalDocuments:number;
 completeAcceptedSourceDayRows:number;
 stages:Record<MismatchOriginalStage,number>;
 groups:Array<{session:string;vote_kind:string;stage:MismatchOriginalStage;count:number}>;
 examples:Array<{session:string;bill:string;day:string;stage:MismatchOriginalStage;votes:number}>;
 sourceUniqueNamedBallotCandidates:number;
 originalSourceWrites:0;exactLinksCreated:0;
 originalSourceBodiesChanged:false;olderPaperActionsChanged:false;
 officialVotesChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
export function summarizeNamedMismatchOriginals(
 votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 originals:readonly OriginalJournal[],acceptedDay:readonly DayAccepted[],
 census:SameSourceQuestionCensus,
 linkedActionIds:ReadonlySet<string>=new Set(),
 onUnique?:(p:UniqueOriginalRoll)=>void
):NamedMismatchOriginalAudit{
 if(votes.length>2500||actions.length>6500||originals.length>220||
  acceptedDay.length>2500||
  new Set(votes.map(v=>v.id)).size!==votes.length||
  new Set(actions.map(a=>a.id)).size!==actions.length||
  new Set(originals.map(d=>d.id)).size!==originals.length||
  new Set(acceptedDay.map(v=>v.eventId)).size!==acceptedDay.length)
  throw Error('Original named-mismatch audit population bound or duplicate identity');
 const byScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scope(a),xs=byScope.get(k)??[];xs.push(a);byScope.set(k,xs)}
 for(const v of votes){const k=scope(v),xs=votesByScope.get(k)??[];xs.push(v);votesByScope.set(k,xs)}
 const targets=votes.filter(v=>!v.exact_linked&&classifySameSourceVote(
  v,byScope.get(scope(v))??[],votesByScope.get(scope(v))??[]
 )==='full_named_ballot_mismatch');
 if(targets.length!==census.totals.full_named_ballot_mismatch)
  throw Error('Original full named-ballot mismatch independent denominator drift');
 const byDocument=new Map(originals.map(d=>[d.id,d]));
 const parsed=new Map(originals.map(d=>[d.id,parseOriginal(d)]));
 const stages=Object.fromEntries(STAGES.map(x=>[x,0])) as Record<MismatchOriginalStage,number>;
 const groups=new Map<string,{session:string;vote_kind:string;stage:MismatchOriginalStage;count:number}>();
 const examples=new Map<string,{session:string;bill:string;day:string;stage:MismatchOriginalStage;votes:number}>();
 for(const v of targets){
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day))
   throw Error('Unsafe public original mismatch bill/day');
  const sourceIds=[...new Set((byScope.get(scope(v))??[])
   .filter(a=>a.original_source_verified&&a.source_url===v.source_url)
   .map(a=>a.source_id))];
  const doc=sourceIds.length===1?byDocument.get(sourceIds[0]!):undefined;
  const original=doc?parsed.get(doc.id):undefined;
  let stage:MismatchOriginalStage;
  if(!doc||doc.source_url!==v.source_url||!original?.verified
   ||!(v.source_url.split('/').at(-1)??'').startsWith(v.day.replace(/-/g,'')))
   stage='original_source_not_one_verified_journal';
  else if(!original.aligned)stage='original_rolls_or_roster_unreadable';
  else{
   const expected=ballotSignature(v.votes,v.yea_count,v.nay_count);
   if(!expected)throw Error('Named mismatch class lost complete accepted ballot');
   const q=fullQuestion(v.motion_text);
   const questionRolls=original.rolls.filter(r=>r.question===q
    &&r.yeas===v.yea_count&&r.nays===v.nay_count);
   const matches=questionRolls.filter(r=>r.ballot===expected);
   if(!questionRolls.length){
    const alternative=original.rolls.some(r=>r.ballot===expected
     &&r.yeas===v.yea_count&&r.nays===v.nay_count&&r.question!==q);
    stage=alternative?'accepted_ballot_only_on_different_original_question'
     :'original_question_and_tally_absent';
   }else if(matches.length===0){
    stage=questionRolls.every(r=>r.ballot===null)
     ?'original_question_and_tally_unreadable_ballot'
     :'original_question_and_tally_different_named_ballot';
   }else if(matches.length!==1)stage='original_question_and_full_ballot_repeated';
   else if(questionRolls.some(r=>r!==matches[0]&&r.ballot===null))
    stage='original_question_has_unreadable_duplicate_roll';
   else{
    const roll=matches[0]!;
    if(roll.bill!==v.bill||roll.questionStart===null
     ||roll.questionStart<0||roll.questionStart>=roll.start
     ||roll.start-roll.questionStart>2600
     ||q.length<40||q.length>2600
     ||!/^The question (?:was taken|recurred)\b/i.test(q)
     ||q.includes('The roll was called,')
     ||/JOURNAL OF THE SENATE|\d{1,3}(?:ST|ND|RD|TH) DAY\]/i.test(q)
     ||v.stored_link)
     stage='original_printed_question_or_bill_span_unproven';
    else{
     const acceptedPeers=acceptedDay.filter(x=>x.sourceUrl===v.source_url&&x.day===v.day
      &&x.yeas===v.yea_count&&x.nays===v.nay_count
      &&sourceDaySignature(x)===expected&&fullQuestion(x.motionText)===q);
     if(acceptedPeers.length!==1||acceptedPeers[0]!.eventId!==v.id)
      stage='original_accepted_source_day_collision';
     else if(actions.some(a=>a.source_url===v.source_url&&a.day===v.day
      &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count
      &&fullQuestion(a.question_text)===q&&linkedActionIds.has(a.id)))
      stage='original_question_already_claimed_by_paper';
     else{
      const scoped=(byScope.get(scope(v))??[]).filter(a=>
       (a.source_id===v.source_id||a.original_source_verified)
       &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count);
      stage=scoped.some(a=>fullQuestion(a.question_text)===q)
       ?'unique_original_v1_question_wrong_named_ballot'
       :'unique_original_v1_wrong_question_association';
      if(onUnique)onUnique({vote:v,source:doc,
       printedQuestion:q,questionStart:roll.questionStart,rollStart:roll.start,
       rollOrdinal:roll.ordinal,ballot:expected,originalTextSha:hash(doc.body!)});
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
  throw Error('Original named mismatch stages do not conserve all accepted votes');
 return {
  schemaVersion:SENATE_NAMED_MISMATCH_ORIGINAL_AUDIT,
  mismatchAcceptedVotes:targets.length,
  authenticatedOriginalDocuments:originals.length,
  completeAcceptedSourceDayRows:acceptedDay.length,
  stages,
  groups:[...groups.values()].sort((a,b)=>b.count-a.count||
   a.session.localeCompare(b.session)||a.vote_kind.localeCompare(b.vote_kind)),
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,20),
  sourceUniqueNamedBallotCandidates:stages.unique_original_v1_question_wrong_named_ballot+
   stages.unique_original_v1_wrong_question_association,
  originalSourceWrites:0,exactLinksCreated:0,
  originalSourceBodiesChanged:false,olderPaperActionsChanged:false,
  officialVotesChanged:false,servingModelsChanged:false,
  completeAmendedBillStatesCertified:0
 };
}
/** Must run INSIDE independently verified VotePredict Neon READ ONLY tx. */
export async function readNamedMismatchOriginalAudit(
 db:PoolClient,votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 census:SameSourceQuestionCensus,
 onUnique?:(p:UniqueOriginalRoll)=>void
):Promise<NamedMismatchOriginalAudit>{
 const byScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scope(a),xs=byScope.get(k)??[];xs.push(a);byScope.set(k,xs)}
 for(const v of votes){const k=scope(v),xs=votesByScope.get(k)??[];xs.push(v);votesByScope.set(k,xs)}
 const targets=votes.filter(v=>!v.exact_linked&&classifySameSourceVote(
  v,byScope.get(scope(v))??[],votesByScope.get(scope(v))??[]
 )==='full_named_ballot_mismatch');
 if(targets.length!==census.totals.full_named_ballot_mismatch)
  throw Error('Original named-mismatch source target count changed under transaction');
 const ids=[...new Set(targets.flatMap(v=>(byScope.get(scope(v))??[])
  .filter(a=>a.original_source_verified&&a.source_url===v.source_url)
  .map(a=>a.source_id)))];
 const urls=[...new Set(targets.map(v=>v.source_url))];
 if(ids.length>220||urls.length>220)throw Error('Original mismatch Journal source count exceeded');
 const originals:OriginalJournal[]=ids.length?(await db.query<OriginalJournal>([
  'SELECT d.id::text,d.source_url,',
  "d.metadata#>>'{rawPrepassageVotes,sourceType}' AS source_type,",
  "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
  'EXISTS(SELECT 1 FROM senate_paper_source_verifications p',
  'WHERE p.source_document_id=d.id AND p.source_url=d.source_url',
  "AND p.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
  'AS original_verified FROM source_documents d WHERE d.id=ANY($1::uuid[])',
  'ORDER BY d.id LIMIT 221'
 ].join(' '),[ids])).rows:[];
 const acceptedDay:DayAccepted[]=urls.length?(await db.query<DayAccepted>([
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
 if(acceptedDay.length>=2501)throw Error('Original mismatch accepted source-day collisions truncated');
 const actionIds=[...new Set(actions.filter(a=>urls.includes(a.source_url)).map(a=>a.id))];
 if(actionIds.length>6500)throw Error('Original mismatch existing action-link corpus truncated');
 const linked=actionIds.length?(await db.query<{id:string}>([
  'SELECT DISTINCT action_id::text AS id FROM senate_vote_paper_event_links',
  'WHERE action_id=ANY($1::uuid[]) ORDER BY id LIMIT 6501'
 ].join(' '),[actionIds])).rows:[];
 if(linked.length>6500)throw Error('Original mismatch linked-action corpus truncated');
 return summarizeNamedMismatchOriginals(votes,actions,originals,acceptedDay,census,
  new Set(linked.map(x=>x.id)),onUnique);
}
