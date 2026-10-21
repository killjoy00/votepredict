/**
 * Population-wide, government-source-only triage of accepted MN Senate votes
 * whose source bill/day has parsed paper, but no paper with the same tally.
 *
 * A complete printed nested amendment may be missing from paper-v1. This
 * compares ORIGINAL verified Journal roll counts and named ballots, source-
 * local nested amendment papers and raw roll observations. It NEVER writes
 * links, ballots, source text, events, bill versions or serving records.
 *
 * No member names, question text, internal IDs, source URLs or digests in
 * output; those remain inside the protected READ ONLY transaction.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,parseJournalPaperActions} from './senate-vote-paper-parser.js';
import {parseNestedSenateSourcePapers,type NestedSenateSourcePaper}
 from './senate-vote-paper-nested.js';
import {parseSenateJournalText} from '../sources/minnesota/senate-journals.js';
import {independentlyPrintedAttendanceNames} from './senate-2022-passage-roster-shadow.js';
import {classifySameSourceVote,type AcceptedVote,type ParsedAction,
 type SameSourceQuestionCensus} from './senate-same-source-question-census.js';
import {questionCore} from './senate-vote-paper-case-audit.js';

export const SENATE_NO_TALLY_ORIGINAL_CENSUS='senate-no-matching-tally-original-v1' as const;
export type TallyFailure=
 'unverified_original_source'|'multiple_source_copies'|'attendance_roster_unreadable'|
 'original_roll_tally_absent'|'original_source_parser_refused'|
 'nested_unique_question_ballot_candidate'|'nested_repeated_accepted_ballot'|
 'nested_repeated_source_question'|'nested_different_question'|
 'nested_matching_tally_no_full_ballot'|'nested_different_named_ballot'|
 'v1_original_reparse_tally_restored'|
 'raw_roll_exact_question_ballot_candidate'|'raw_roll_repeated_accepted_ballot'|
 'raw_roll_different_question'|'raw_roll_different_bill'|
 'printed_tally_without_full_named_match';
const STAGES:readonly TallyFailure[]=[
 'unverified_original_source','multiple_source_copies','attendance_roster_unreadable',
 'original_roll_tally_absent','original_source_parser_refused',
 'nested_unique_question_ballot_candidate','nested_repeated_accepted_ballot',
 'nested_repeated_source_question','nested_different_question',
 'nested_matching_tally_no_full_ballot','nested_different_named_ballot',
 'v1_original_reparse_tally_restored',
 'raw_roll_exact_question_ballot_candidate','raw_roll_repeated_accepted_ballot',
 'raw_roll_different_question','raw_roll_different_bill',
 'printed_tally_without_full_named_match'
];
interface OriginalJournal {
 id:string;source_url:string;source_type:string|null;body:string|null;
 original_verified:boolean;
}
export interface DayAccepted {
 eventId:string;sourceUrl:string;day:string;
 billIdentifier:string|null;voteKind:string;motionText:string;
 yeas:number;nays:number;votes:Array<{name:string;choice:string}>;
 existingExact:boolean;
}
export interface NoTallyOriginalCensus {
 schemaVersion:typeof SENATE_NO_TALLY_ORIGINAL_CENSUS;
 originalSameSourceUnlinked:number;
 missingTallyVotes:number;
 sourceDocumentsInspected:number;
 verifiedOriginalDocuments:number;
 originalQuorumRostersRead:number;
 nestedUniqueQuestionBallotCandidates:number;
 rawRollUniqueQuestionBallotCandidates:number;
 stages:Record<TallyFailure,number>;
 stageGroups:Array<{session:string;vote_kind:string;stage:TallyFailure;count:number}>;
 examples:Array<{session:string;bill:string;day:string;stage:TallyFailure;votes:number}>;
 exactLinksCreated:0;sourceBodiesChanged:false;acceptedVotesChanged:false;
 amendedBillStatesCertified:0;
}
function scoped(x:{source_url:string;bill_id:string;day:string}):string{
 return JSON.stringify([x.source_url,x.bill_id,x.day]);
}
interface ParsedDoc {
 source:OriginalJournal;
 rosterCount:number;
 tallies:Array<{yeas:number;nays:number}>;
 nested:NestedSenateSourcePaper[];
 v1:Array<{bill:string;yeas:number|null;nays:number|null}>;
 raw:Array<{bill:string|null;yeas:number;nays:number;question:string;ballot:string|null}>;
 refused:boolean;
}
function reparse(doc:OriginalJournal):ParsedDoc{
 const text=doc.body??'';
 const names=independentlyPrintedAttendanceNames(text);
 const tallies=[...text.matchAll(/The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+)/gi)]
  .map(m=>({yeas:Number(m[1]),nays:Number(m[2])}))
  .filter(m=>Number.isSafeInteger(m.yeas)&&Number.isSafeInteger(m.nays));
 let nested:NestedSenateSourcePaper[]=[],v1:ParsedDoc['v1']=[],raw:ParsedDoc['raw']=[],refused=false;
 if(names.length>=55){
  try{
   nested=parseNestedSenateSourcePapers(text,names);
   v1=parseJournalPaperActions(text,names).map(p=>({
    bill:p.billIdentifier,yeas:p.yeas,nays:p.nays
   }));
   raw=parseSenateJournalText({
    text,sessionKey:'source-only',sourceUrl:doc.source_url,
    knownMemberNames:names,allowRosterMismatch:true
   }).map(p=>({bill:p.billIdentifier??null,yeas:p.yeaCount,nays:p.nayCount,
    question:questionCore(p.motionText),
    ballot:ballotSignature(p.memberVotes.map(m=>({
     name:m.sourceName,choice:m.choice
    })),p.yeaCount,p.nayCount)}));
  }catch{refused=true;nested=[];v1=[];raw=[]}
 }
 return {source:doc,rosterCount:names.length,tallies,nested,v1,raw,refused};
}
function sig(v:AcceptedVote|DayAccepted):string|null{
 if('yea_count' in v)return ballotSignature(v.votes,v.yea_count,v.nay_count);
 return ballotSignature(v.votes,v.yeas,v.nays);
}
function originalScope(x:{sourceUrl:string;day:string}):string{
 return JSON.stringify([x.sourceUrl,x.day]);
}
/** Strict source-independent full-day accepted ballot uniqueness, even
 * against an accepted event whose bill is unresolved or whose parsed paper
 * belongs to another bill. Same tally is NEVER a link.
 */
function acceptedPeers(v:AcceptedVote,day:readonly DayAccepted[]):DayAccepted[]{
 const signature=sig(v);
 return day.filter(a=>a.sourceUrl===v.source_url&&a.day===v.day
  &&a.yeas===v.yea_count&&a.nays===v.nay_count
  &&sig(a)===signature);
}
/** Whole-population first-failure partition only, not candidate inserts. */
export function summarizeNoTallyOriginalCensus(
 votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 docs:readonly OriginalJournal[],dayAccepted:readonly DayAccepted[],
 existing:SameSourceQuestionCensus
):NoTallyOriginalCensus{
 if(votes.length>2500||actions.length>6500||docs.length>220
  ||dayAccepted.length>2500||new Set(docs.map(d=>d.id)).size!==docs.length)
  throw Error('No-tally diagnostic exceeded read-only population/source bounds');
 const actionsByScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scoped(a),x=actionsByScope.get(k)??[];x.push(a);actionsByScope.set(k,x)}
 for(const v of votes){const k=scoped(v),x=votesByScope.get(k)??[];x.push(v);votesByScope.set(k,x)}
 const targets=votes.filter(v=>!v.exact_linked
  &&classifySameSourceVote(v,actionsByScope.get(scoped(v))??[],
    votesByScope.get(scoped(v))??[])==='no_matching_tally');
 if(targets.length!==existing.totals.no_matching_tally)
  throw Error('Original no-tally cohort differs from protected independent question audit');
 const byId=new Map(docs.map(d=>[d.id,d]));
 const parsed=new Map<string,ParsedDoc>();
 for(const d of docs){
  if(!d.original_verified||d.source_type!=='mn_senate_journal'
   ||typeof d.body!=='string'||d.body.length<2000||d.body.length>8_000_000
   ||!/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/.test(d.source_url))
   continue;
  parsed.set(d.id,reparse(d));
 }
 const stages=Object.fromEntries(STAGES.map(x=>[x,0])) as Record<TallyFailure,number>;
 const groups=new Map<string,{session:string;vote_kind:string;stage:TallyFailure;count:number}>();
 const examples=new Map<string,{session:string;bill:string;day:string;stage:TallyFailure;votes:number}>();
 for(const v of targets){
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day))
   throw Error('Invalid public source bill/date identifier in no-tally results');
  const peers=actionsByScope.get(scoped(v))??[];
  const sourceIds=[...new Set(peers.filter(a=>
   a.original_source_verified&&a.source_url===v.source_url).map(a=>a.source_id))];
  const documents=sourceIds.filter(id=>byId.get(id)?.source_url===v.source_url
   &&parsed.has(id)).map(id=>parsed.get(id)!);
  let stage:TallyFailure;
  if(!documents.length)stage='unverified_original_source';
  else if(documents.length!==1)stage='multiple_source_copies';
  else{
   const d=documents[0]!;
   const hasTally=d.tallies.some(t=>t.yeas===v.yea_count&&t.nays===v.nay_count);
   if(!hasTally)stage='original_roll_tally_absent';
   else if(d.rosterCount<55)stage='attendance_roster_unreadable';
   else if(d.refused)stage='original_source_parser_refused';
   else {
    const matches=d.nested.filter(p=>p.billIdentifier===v.bill&&p.yeas===v.yea_count&&p.nays===v.nay_count);
    const signature=sig(v);
    const sameBallot=matches.filter(p=>p.ballotSha256!==null&&p.ballotSha256===signature);
    const exactlySame=sameBallot.filter(p=>questionCore(p.questionText)===questionCore(v.motion_text));
    const allAccepted=acceptedPeers(v,dayAccepted);
    if(exactlySame.length>0){
     if(allAccepted.length!==1||allAccepted[0]!.eventId!==v.id)
      stage='nested_repeated_accepted_ballot';
     else if(exactlySame.length!==1)stage='nested_repeated_source_question';
     else if(v.vote_kind!=='amendment')stage='nested_different_question';
     else stage='nested_unique_question_ballot_candidate';
    }else if(sameBallot.length)stage='nested_different_question';
    else if(matches.length && matches.every(p=>p.ballotSha256===null))
     stage='nested_matching_tally_no_full_ballot';
    else if(matches.length)stage='nested_different_named_ballot';
    else if(d.v1.some(p=>p.bill===v.bill&&p.yeas===v.yea_count&&p.nays===v.nay_count))
     stage='v1_original_reparse_tally_restored';
    else{
     const raw=d.raw.filter(p=>p.yeas===v.yea_count&&p.nays===v.nay_count
      &&p.ballot===signature&&p.ballot!==null);
     const exactRaw=raw.filter(p=>p.bill===v.bill&&p.question===questionCore(v.motion_text));
     if(exactRaw.length===1&&allAccepted.length===1&&allAccepted[0]!.eventId===v.id)
      stage='raw_roll_exact_question_ballot_candidate';
     else if(exactRaw.length||raw.some(p=>p.bill===v.bill))
      stage=allAccepted.length!==1?'raw_roll_repeated_accepted_ballot':'raw_roll_different_question';
     else if(raw.length)stage='raw_roll_different_bill';
     else stage='printed_tally_without_full_named_match';
    }
   }
  }
  stages[stage]++;
  const k=JSON.stringify([v.session,v.vote_kind,stage]);
  const g=groups.get(k)??{session:v.session,vote_kind:v.vote_kind,stage,count:0};
  g.count++;groups.set(k,g);
  const ek=JSON.stringify([v.session,v.bill,v.day,stage]);
  const e=examples.get(ek)??{session:v.session,bill:v.bill,day:v.day,stage,votes:0};
  e.votes++;examples.set(ek,e);
 }
 if(Object.values(stages).reduce((a,b)=>a+b,0)!==targets.length)
  throw Error('Original no-tally Journal cohort did not conserve accepted votes');
 return{
  schemaVersion:SENATE_NO_TALLY_ORIGINAL_CENSUS,
  originalSameSourceUnlinked:existing.sameSourceUnlinked,
  missingTallyVotes:targets.length,
  sourceDocumentsInspected:docs.length,
  verifiedOriginalDocuments:parsed.size,
  originalQuorumRostersRead:[...parsed.values()].filter(x=>x.rosterCount>=55).length,
  nestedUniqueQuestionBallotCandidates:stages.nested_unique_question_ballot_candidate,
  rawRollUniqueQuestionBallotCandidates:stages.raw_roll_exact_question_ballot_candidate,
  stages,stageGroups:[...groups.values()].sort((a,b)=>b.count-a.count||
   a.session.localeCompare(b.session)||a.vote_kind.localeCompare(b.vote_kind)),
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,20),
  exactLinksCreated:0,sourceBodiesChanged:false,acceptedVotesChanged:false,
  amendedBillStatesCertified:0
 };
}
/** Protected caller holds verified REPEATABLE READ READ ONLY. Only original
 * government-source-verified same-day Journal docs are eligible.
 */
export async function readNoTallyOriginalCensus(
 db:PoolClient,votes:readonly AcceptedVote[],actions:readonly ParsedAction[],
 previous:SameSourceQuestionCensus
):Promise<NoTallyOriginalCensus>{
 const actionsByScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of actions){const k=scoped(a),x=actionsByScope.get(k)??[];x.push(a);actionsByScope.set(k,x)}
 for(const v of votes){const k=scoped(v),x=votesByScope.get(k)??[];x.push(v);votesByScope.set(k,x)}
 const targets=votes.filter(v=>!v.exact_linked&&classifySameSourceVote(
  v,actionsByScope.get(scoped(v))??[],votesByScope.get(scoped(v))??[])==='no_matching_tally');
 if(targets.length!==previous.totals.no_matching_tally)throw Error('Original-no-tally population drift');
 const documentIds=[...new Set(targets.flatMap(v=>
  (actionsByScope.get(scoped(v))??[])
   .filter(a=>a.original_source_verified&&a.source_url===v.source_url)
   .map(a=>a.source_id)))];
 if(documentIds.length>220)throw Error('Original source document cohort exceeds bounded replay');
 const docs=documentIds.length?(await db.query<OriginalJournal>([
  'SELECT d.id::text,d.source_url,',
  "d.metadata#>>'{rawPrepassageVotes,sourceType}' AS source_type,",
  "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
  'EXISTS(SELECT 1 FROM senate_paper_source_verifications p',
  'WHERE p.source_document_id=d.id AND p.source_url=d.source_url',
  "AND p.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
  'AS original_verified',
  'FROM source_documents d WHERE d.id=ANY($1::uuid[]) ORDER BY d.id LIMIT 221'
 ].join(' '),[documentIds])).rows:[];
 const urls=[...new Set(targets.map(v=>v.source_url))];
 const dayAccepted=(await db.query<DayAccepted>([
  'SELECT v.id::text AS "eventId",d.source_url AS "sourceUrl",',
  'v.occurred_on::text AS day,b.identifier AS "billIdentifier",',
  'v.vote_kind AS "voteKind",v.motion_text AS "motionText",',
  'v.yea_count AS yeas,v.nay_count AS nays,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',mv.source_member_name,",
  "'choice',mv.choice)) FROM member_votes mv WHERE mv.vote_event_id=v.id),'[]'::jsonb) AS votes,",
  'EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v e WHERE e.vote_event_id=v.id)',
  'AS "existingExact"',
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  'JOIN chambers c ON c.id=v.chamber_id AND c.slug=\'senate\'',
  'JOIN legislative_sessions s ON s.id=v.session_id',
  'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
  'LEFT JOIN bills b ON b.id=v.bill_id',
  'WHERE d.source_url=ANY($1::text[]) AND s.slug IN',
  "('2021-2022','2023-2024','2025-2026')",
  'ORDER BY d.source_url,v.occurred_on,v.id LIMIT 2501'
 ].join(' '),[urls])).rows;
 if(dayAccepted.length>=2501)throw Error('Original-day accepted ballot cross-bill collision census truncated');
 return summarizeNoTallyOriginalCensus(votes,actions,docs,dayAccepted,previous);
}
