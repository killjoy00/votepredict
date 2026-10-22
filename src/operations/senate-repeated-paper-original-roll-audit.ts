/**
 * Independent ORIGINAL-GOVERNMENT-JOURNAL roll/header replay for all accepted
 * Senate votes currently held only because a complete paper ballot is repeated.
 *
 * Unlike the paper-v1 parser, this recovers the physically printed question
 * immediately preceding each roll-call header from the authenticated original
 * Journal. Two rolls may have the same named ballot, but only a question+full
 * named ballot unique across the ENTIRE original Journal and all accepted votes
 * on that original source/day is eligible even as a question-only candidate.
 *
 * This entire module is READ ONLY. Source text, members, URLs, IDs and full
 * questions never leave the protected caller's transaction or printed summary.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,billIdentifier,compact,hash} from './senate-vote-paper-parser.js';
import {parseSenateJournalText} from '../sources/minnesota/senate-journals.js';
import {independentlyPrintedAttendanceNames} from './senate-2022-passage-roster-shadow.js';
import {classifySameSourceVote,type AcceptedVote,type ParsedAction,
 type SameSourceQuestionCensus} from './senate-same-source-question-census.js';
import type {DayAccepted,OriginalJournal} from './senate-no-tally-original-census.js';

export const SENATE_REPEATED_ORIGINAL_ROLL='senate-repeated-paper-original-roll-source-v1' as const;
export type RepeatedOriginalStage=
 'original_source_not_unique_verified'|'original_roster_or_raw_header_unreadable'|
 'original_printed_question_and_ballot_absent'|
 'original_printed_question_and_ballot_repeated'|
 'original_question_span_or_bill_unproven'|
 'accepted_day_question_and_ballot_repeated'|
 'unique_original_printed_question_full_ballot';
const STAGES:readonly RepeatedOriginalStage[]=[
 'original_source_not_unique_verified','original_roster_or_raw_header_unreadable',
 'original_printed_question_and_ballot_absent',
 'original_printed_question_and_ballot_repeated',
 'original_question_span_or_bill_unproven',
 'accepted_day_question_and_ballot_repeated',
 'unique_original_printed_question_full_ballot'
];
const journalRoll=/The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:\s*Those who voted in the affirmative were:\s*([\s\S]*?)(?=Those who voted in the negative were:|The motion|So(?:\s|,)|The amendment|RECONSIDERATION|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS|MEMBERS EXCUSED|ADJOURNMENT)/gi;
const URL=/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/;
interface PrintedRoll {
 start:number;ordinal:number;
 questionStart:number|null;question:string|null;
 bill:string|null;
 yeas:number;nays:number;ballot:string|null;
}
interface ParsedOriginal {
 verified:boolean;aligned:boolean;rolls:PrintedRoll[];
}
export interface UniqueOriginalRoll {
 vote:AcceptedVote;source:OriginalJournal;
 printedQuestion:string;questionStart:number;rollStart:number;
 rollOrdinal:number;ballot:string;originalTextSha:string;
}
export interface RepeatedOriginalAudit {
 schemaVersion:typeof SENATE_REPEATED_ORIGINAL_ROLL;
 repeatedPaperVoteCohort:number;
 originalDocumentsInspected:number;
 originalAcceptedDayRows:number;
 stages:Record<RepeatedOriginalStage,number>;
 groups:Array<{session:string;vote_kind:string;stage:RepeatedOriginalStage;count:number}>;
 examples:Array<{session:string;bill:string;day:string;stage:RepeatedOriginalStage;votes:number}>;
 sourceUniqueQuestionBallotCandidates:number;
 newActionsCreated:0;exactLinksCreated:0;
 officialVotesChanged:false;originalSourcesChanged:false;oldPapersChanged:false;
 servingModelsChanged:false;assembledBillStatesCertified:0;
}
function scope(v:{source_url:string;bill_id:string;day:string}):string{
 return JSON.stringify([v.source_url,v.bill_id,v.day]);
}
function fullQuestion(s:string):string{
 const ms=[...s.matchAll(/The question (?:was taken|recurred)/gi)];
 return compact(ms.length?s.slice(ms.at(-1)!.index):s);
}
function parseOriginal(d:OriginalJournal):ParsedOriginal{
 const empty:ParsedOriginal={verified:false,aligned:false,rolls:[]};
 if(!d.original_verified||d.source_type!=='mn_senate_journal'||!URL.test(d.source_url)
  ||typeof d.body!=='string'||d.body.length<2000||d.body.length>8_000_000
  ||d.body.includes('\r'))return empty;
 const text=d.body,names=independentlyPrintedAttendanceNames(text);
 if(names.length<55)return {verified:true,aligned:false,rolls:[]};
 let raw:ReturnType<typeof parseSenateJournalText>;
 try{
  raw=parseSenateJournalText({text,sessionKey:'source-only',
   sourceUrl:d.source_url,knownMemberNames:names,allowRosterMismatch:true});
 }catch{return {verified:true,aligned:false,rolls:[]}}
 const headers=[...text.matchAll(journalRoll)];
 if(headers.length!==raw.length||headers.length>600)
  return {verified:true,aligned:false,rolls:[]};
 const rolls:PrintedRoll[]=[];
 for(let i=0;i<headers.length;i++){
  const h=headers[i]!,v=raw[i]!,at=h.index;
  if(at===undefined||v.yeaCount!==Number(h[1])||v.nayCount!==Number(h[2]))
   return {verified:true,aligned:false,rolls:[]};
  const contextStart=Math.max(0,at-2600),context=text.slice(contextStart,at);
  const markers=[...context.matchAll(/The question (?:was taken|recurred)/gi)];
  const questionStart=markers.length?contextStart+markers.at(-1)!.index!:null;
  const question=questionStart===null?null:compact(text.slice(questionStart,at));
  const matchBill=[...context.matchAll(/(?:S\.?F\.?|H\.?F\.?)\s*(?:No\.?)?\s*\d+/gi)].at(-1);
  const sourceBill=matchBill?billIdentifier(matchBill[0]):null;
  rolls.push({start:at,ordinal:i+1,questionStart,question,
   bill:sourceBill===v.billIdentifier?sourceBill:null,
   yeas:v.yeaCount,nays:v.nayCount,
   ballot:ballotSignature(v.memberVotes.map(m=>({name:m.sourceName,choice:m.choice})),
    v.yeaCount,v.nayCount)});
 }
 return {verified:true,aligned:true,rolls};
}
/** No source vote, paper or accepted-event identity is generated from a
 * shared tally or from order of source records. Entire original is replayed
 * once and uniqueness is evaluated across ALL its physical roll headers.
 */
export function summarizeRepeatedOriginalRolls(
 votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 docs:readonly OriginalJournal[],dayAccepted:readonly DayAccepted[],
 existing:SameSourceQuestionCensus,
 onUnique?:(proof:UniqueOriginalRoll)=>void
):RepeatedOriginalAudit{
 if(votes.length>2500||actions.length>6500||docs.length>220
  ||dayAccepted.length>2500||new Set(docs.map(x=>x.id)).size!==docs.length
  ||new Set(dayAccepted.map(x=>x.eventId)).size!==dayAccepted.length)
  throw Error('Original repeated-paper source corpus/identity limit exceeded');
 const actionsByScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scope(a),x=actionsByScope.get(k)??[];x.push(a);actionsByScope.set(k,x)}
 for(const v of votes){const k=scope(v),x=votesByScope.get(k)??[];x.push(v);votesByScope.set(k,x)}
 const targets=votes.filter(v=>!v.exact_linked&&classifySameSourceVote(v,
  actionsByScope.get(scope(v))??[],votesByScope.get(scope(v))??[])
  ==='ballot_repeated_across_papers');
 if(targets.length!==existing.totals.ballot_repeated_across_papers)
  throw Error('Original repeated-paper source denominator drift');
 const originalById=new Map(docs.map(x=>[x.id,x]));
 const parsed=new Map(docs.map(x=>[x.id,parseOriginal(x)]));
 const stages=Object.fromEntries(STAGES.map(x=>[x,0])) as Record<RepeatedOriginalStage,number>;
 const groups=new Map<string,{session:string;vote_kind:string;stage:RepeatedOriginalStage;count:number}>();
 const examples=new Map<string,{session:string;bill:string;day:string;stage:RepeatedOriginalStage;votes:number}>();
 for(const v of targets){
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day))
   throw Error('Unsafe original-roll bill/date identity');
  const sourceIds=[...new Set((actionsByScope.get(scope(v))??[])
   .filter(a=>a.original_source_verified&&a.source_url===v.source_url)
   .map(a=>a.source_id))];
  let stage:RepeatedOriginalStage;
  const source=sourceIds.length===1?originalById.get(sourceIds[0]!):undefined;
  const view=source?parsed.get(source.id):undefined;
  if(!source||!view?.verified||source.source_url!==v.source_url
   ||!(source.source_url.split('/').at(-1)??'').startsWith(v.day.replace(/-/g,'')))
   stage='original_source_not_unique_verified';
  else if(!view.aligned)stage='original_roster_or_raw_header_unreadable';
  else{
   const signature=ballotSignature(v.votes,v.yea_count,v.nay_count);
   const q=fullQuestion(v.motion_text);
   const matching=view.rolls.filter(r=>r.ballot===signature&&signature!==null
    &&r.question===q&&r.yeas===v.yea_count&&r.nays===v.nay_count);
   if(!matching.length)stage='original_printed_question_and_ballot_absent';
   else if(matching.length!==1)stage='original_printed_question_and_ballot_repeated';
   else{
    const r=matching[0]!;
    if(r.bill!==v.bill||r.questionStart===null
     ||r.questionStart<0||r.questionStart>=r.start
     ||r.start-r.questionStart>2600||q.length<40||q.length>2600
     ||!/^The question (?:was taken|recurred)\b/i.test(q)
     ||q.includes('The roll was called,')
     ||/JOURNAL OF THE SENATE|\d{1,3}(?:ST|ND|RD|TH) DAY\]/i.test(q))
     stage='original_question_span_or_bill_unproven';
    else{
     const accepted=dayAccepted.filter(p=>p.sourceUrl===v.source_url&&p.day===v.day
      &&p.yeas===v.yea_count&&p.nays===v.nay_count
      &&ballotSignature(p.votes,p.yeas,p.nays)===signature
      &&fullQuestion(p.motionText)===q);
     if(accepted.length!==1||accepted[0]!.eventId!==v.id)
      stage='accepted_day_question_and_ballot_repeated';
     else{
      stage='unique_original_printed_question_full_ballot';
      if(onUnique)onUnique({vote:v,source,
       printedQuestion:q,questionStart:r.questionStart,rollStart:r.start,
       rollOrdinal:r.ordinal,ballot:signature!,originalTextSha:hash(source.body!)});
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
 if(Object.values(stages).reduce((a,b)=>a+b,0)!==targets.length)
  throw Error('Original repeated-paper Journal vote conservation failed');
 return{
  schemaVersion:SENATE_REPEATED_ORIGINAL_ROLL,
  repeatedPaperVoteCohort:targets.length,originalDocumentsInspected:docs.length,
  originalAcceptedDayRows:dayAccepted.length,stages,
  groups:[...groups.values()].sort((a,b)=>b.count-a.count||
   a.session.localeCompare(b.session)||a.vote_kind.localeCompare(b.vote_kind)),
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,20),
  sourceUniqueQuestionBallotCandidates:stages.unique_original_printed_question_full_ballot,
  newActionsCreated:0,exactLinksCreated:0,
  officialVotesChanged:false,originalSourcesChanged:false,oldPapersChanged:false,
  servingModelsChanged:false,assembledBillStatesCertified:0
 };
}
/** Caller authenticates read-only Neon primary and migration ledger. */
export async function readRepeatedOriginalRollAudit(
 db:PoolClient,votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 census:SameSourceQuestionCensus,onUnique?:(p:UniqueOriginalRoll)=>void
):Promise<RepeatedOriginalAudit>{
 const byScope=new Map<string,ParsedAction[]>();
 const byVotes=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scope(a),v=byScope.get(k)??[];v.push(a);byScope.set(k,v)}
 for(const v of votes){const k=scope(v),x=byVotes.get(k)??[];x.push(v);byVotes.set(k,x)}
 const targets=votes.filter(v=>!v.exact_linked
  &&classifySameSourceVote(v,byScope.get(scope(v))??[],byVotes.get(scope(v))??[])
   ==='ballot_repeated_across_papers');
 const ids=[...new Set(targets.flatMap(v=>(byScope.get(scope(v))??[])
  .filter(a=>a.original_source_verified&&a.source_url===v.source_url)
  .map(a=>a.source_id)))];
 if(ids.length>220)throw Error('Original repeated-paper Journal source count exceeded');
 const docs:OriginalJournal[]=ids.length?(await db.query<OriginalJournal>([
  'SELECT d.id::text,d.source_url,',
  "d.metadata#>>'{rawPrepassageVotes,sourceType}' AS source_type,",
  "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
  'EXISTS(SELECT 1 FROM senate_paper_source_verifications p',
  'WHERE p.source_document_id=d.id AND p.source_url=d.source_url',
  "AND p.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
  'AS original_verified FROM source_documents d',
  'WHERE d.id=ANY($1::uuid[]) ORDER BY d.id LIMIT 221'
 ].join(' '),[ids])).rows:[];
 const urls=[...new Set(targets.map(v=>v.source_url))];
 if(urls.length>220)throw Error('Original repeated-paper Journal URL count exceeded');
 const dayAccepted:DayAccepted[]=urls.length?(await db.query<DayAccepted>([
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
 if(dayAccepted.length>=2501)throw Error('Original repeated-paper accepted collision census truncated');
 return summarizeRepeatedOriginalRolls(votes,actions,docs,dayAccepted,census,onUnique);
}
