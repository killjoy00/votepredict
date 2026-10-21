/**
 * Non-serving, source-only 2021-22 Senate final-passage shadow replay.
 * Reparse *stored authenticated original Journal text*, using names visibly
 * printed in THAT JOURNAL'S opening quorum attendance roll. These are only
 * name-reading hints; they NEVER fill in a missing ballot or prove a vote.
 *
 * No events, actions, source bodies, links, DB rows or serving text are
 * created/altered. This runs in a REPEATABLE READ READ ONLY transaction.
 */
import type {PoolClient} from 'pg';
import {normalizeMemberName} from '../sources/minnesota/house-votes.js';
import {ballotSignature,parseJournalPaperActions,rollMatches,compact,type PaperAction}
 from './senate-vote-paper-parser.js';
import {classifySameSourceVote,type AcceptedVote,type ParsedAction} from './senate-same-source-question-census.js';

export const SENATE_2022_PASSAGE_ROSTER_SHADOW='senate-2022-passage-roster-shadow-v1' as const;
export interface StoredJournal {
 id:string;source_url:string;source_type:string|null;raw_text:string|null;content_sha256:string|null;
}
export type ShadowStage='no_verified_original_source'|'original_attendance_missing'|
 'no_reparsed_passage_action'|'no_matching_tally'|'named_ballot_still_missing'|
 'named_ballot_disagrees'|'repeated_paper_ballot'|'repeated_accepted_ballot'|
 'substantive_question_difference'|'strict_unique_question_full_ballot_candidate';
export interface RosterShadowProof {
 schemaVersion:typeof SENATE_2022_PASSAGE_ROSTER_SHADOW;
 targeted2021PassageVotes:number;
 sourceDocumentsLoaded:number;
 sourceAttendanceRosters:number;
 strictlyUniqueQuestionAndFullBallotCandidates:number;
 stages:Record<ShadowStage,number>;
 /** Public bill, day, stage, number of distinct accepted votes only. */
 examples:Array<{bill:string;day:string;stage:ShadowStage;votes:number}>;
 dbLinksCreated:0;acceptedVoteEventsChanged:false;paperActionsChanged:false;
 fullBillTextsCertified:0;
}
const STAGES:readonly ShadowStage[]=[
 'no_verified_original_source','original_attendance_missing',
 'no_reparsed_passage_action','no_matching_tally','named_ballot_still_missing',
 'named_ballot_disagrees','repeated_paper_ballot','repeated_accepted_ballot',
 'substantive_question_difference','strict_unique_question_full_ballot_candidate'
];
function scope(v:{source_url:string;bill_id:string;day:string}):string {
 return JSON.stringify([v.source_url,v.bill_id,v.day]);
}
/** Only an original quorum list, bounded above and below.
 * No surnames are inferred from accepted vote or later source text.
 * If the opening roster is absent, truncated or contains repeated names,
 * the reader refuses to treat the body as an attendance roster.
 */
export function independentlyPrintedAttendanceNames(text:string):string[]{
 if(typeof text!=='string'||text.length>8_000_000)return [];
 const beginning=text.slice(0,16000);
 const marks=[...beginning.matchAll(/The roll was called,\s*and the following Senators were present:/gi)];
 if(marks.length!==1)return [];
 const from=marks[0]!.index!+marks[0]![0].length;
 const after=beginning.slice(from,from+6500);
 const closing=/Pursuant to Rule 14\.1|The President declared a quorum present/i.exec(after);
 if(!closing||closing.index<200||closing.index>5500)return [];
 const body=after.slice(0,closing.index);
 // Honor original PDF line/column boundaries; never split single-spaced
 // proper names such as "Johnson Stewart" or "Lopez Franzen".
 const line=/^[\p{Lu}][\p{L}\p{M}'’.-]*(?: [\p{Lu}][\p{L}\p{M}'’.-]*){0,2}$/u;
 const names=body.split(/\r?\n| {2,}/).map(s=>s.trim()).filter(s=>line.test(s));
 if(names.length<55||names.length>67)return [];
 const normalized=names.map(normalizeMemberName);
 if(normalized.some(n=>!n)||new Set(normalized).size!==names.length)return [];
 return names;
}
function signature(v:AcceptedVote):string|null{
 return ballotSignature(v.votes,v.yea_count,v.nay_count);
}
function matchingQuestion(a:PaperAction,v:AcceptedVote):boolean{
 return rollMatches(a,{billIdentifier:v.bill,motionText:v.motion_text,
  yeas:v.yea_count,nays:v.nay_count,ballotSignature:signature(v)});
}
type ReparseResult={sourceId:string;sourceUrl:string;actions:PaperAction[];names:number};
function recordExample(
 groups:Map<string,{bill:string;day:string;stage:ShadowStage;votes:number}>,
 v:AcceptedVote,stage:ShadowStage
):void{
 const k=JSON.stringify([v.bill,v.day,stage]);
 const row=groups.get(k)??{bill:v.bill,day:v.day,stage,votes:0};
 row.votes++;groups.set(k,row);
}

/** Pure, fixture-testable measurement. Expected denominator is independently
 * checked against the protected population census (132 at last readback).
 */
export function summarize2022PassageRosterShadow(
 votes:readonly AcceptedVote[],storedActions:readonly ParsedAction[],
 docs:readonly StoredJournal[],expected:number
):RosterShadowProof{
 if(!Number.isInteger(expected)||expected<0||expected>300
  ||votes.length>2500||storedActions.length>6500||docs.length>150
  ||new Set(docs.map(d=>d.id)).size!==docs.length)
  throw Error('Source-only passage shadow population/identity bounds');
 const actionsByScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 for(const a of storedActions){const k=scope(a),x=actionsByScope.get(k)??[];x.push(a);actionsByScope.set(k,x)}
 for(const v of votes){const k=scope(v),x=votesByScope.get(k)??[];x.push(v);votesByScope.set(k,x)}
 const targets=votes.filter(v=>{
  if(v.exact_linked||v.session!=='2021-2022'||v.vote_kind!=='passage')return false;
  const associated=actionsByScope.get(scope(v))??[];
  if(!associated.length)return false;
  const stage=classifySameSourceVote(v,associated,votesByScope.get(scope(v))??[]);
  return stage==='paper_ballot_absent'&&associated.some(a=>
   a.kind==='passage'&&Number.isInteger(a.yea_count)&&Number.isInteger(a.nay_count));
 });
 if(targets.length!==expected)
  throw Error('Passage shadow denominator differs from independently reconciled 2021 passage paper holds');
 const rawById=new Map(docs.map(d=>[d.id,d]));
 const parsed=new Map<string,ReparseResult>();
 for(const d of docs){
  const eligible=d.source_type==='mn_senate_journal'
   &&typeof d.raw_text==='string'&&d.raw_text.length>=2000
   &&d.raw_text.length<=8_000_000
   &&typeof d.content_sha256==='string'&&/^[0-9a-f]{64}$/.test(d.content_sha256)
   &&/^https:\/\/www\.senate\.mn\/journals\/2021-2022\/\d{10,11}\.pdf$/.test(d.source_url);
  if(!eligible)continue;
  const names=independentlyPrintedAttendanceNames(d.raw_text!);
  parsed.set(d.id,{sourceId:d.id,sourceUrl:d.source_url,
   names:names.length,
   actions:names.length?parseJournalPaperActions(d.raw_text!,names):[]});
 }
 const stages=Object.fromEntries(STAGES.map(s=>[s,0])) as Record<ShadowStage,number>;
 const examples=new Map<string,{bill:string;day:string;stage:ShadowStage;votes:number}>();
 for(const v of targets){
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)||! /^\d{4}-\d\d-\d\d$/.test(v.day))
   throw Error('Unsafe public bill/date in passage source-only summary');
  const old=actionsByScope.get(scope(v))??[];
  const sourceIds=[...new Set(old.filter(a=>a.kind==='passage'&&
    (a.source_id===v.source_id||a.original_source_verified)).map(a=>a.source_id))];
  let stage:ShadowStage;
  const verified=sourceIds.filter(id=>old.some(a=>a.source_id===id&&a.original_source_verified)
   &&rawById.get(id)?.source_url===v.source_url);
  if(!verified.length)stage='no_verified_original_source';
  else if(!verified.some(id=>(parsed.get(id)?.names??0)>=55))
   stage='original_attendance_missing';
  else{
   const papers=verified.flatMap(id=>parsed.get(id)?.actions.filter(a=>
    a.billIdentifier===v.bill&&a.kind==='passage')??[]);
   const tally=papers.filter(a=>a.yeas===v.yea_count&&a.nays===v.nay_count);
   const signed=tally.filter(a=>a.ballotSignature!==null);
   const matched=signed.filter(a=>a.ballotSignature===signature(v));
   if(papers.length===0)stage='no_reparsed_passage_action';
   else if(tally.length===0)stage='no_matching_tally';
   else if(signed.length===0)stage='named_ballot_still_missing';
   else if(matched.length===0)stage='named_ballot_disagrees';
   else if(matched.length!==1)stage='repeated_paper_ballot';
   else {
    // Reverse uniqueness over ALL accepted event types in the exact same
    // original source URL / bill / date, not just missing passage votes.
    const reverse=(votesByScope.get(scope(v))??[]).filter(x=>
     x.yea_count===v.yea_count&&x.nay_count===v.nay_count
     &&signature(x)===matched[0]!.ballotSignature);
    if(reverse.length!==1)stage='repeated_accepted_ballot';
    else if(!matchingQuestion(matched[0]!,v))stage='substantive_question_difference';
    else stage='strict_unique_question_full_ballot_candidate';
   }
  }
  stages[stage]++;recordExample(examples,v,stage);
 }
 if(Object.values(stages).reduce((a,b)=>a+b,0)!==targets.length)
  throw Error('2022 paper-roll shadow stages did not partition accepted population');
 return {
  schemaVersion:SENATE_2022_PASSAGE_ROSTER_SHADOW,
  targeted2021PassageVotes:targets.length,
  sourceDocumentsLoaded:docs.length,
  sourceAttendanceRosters:[...parsed.values()].filter(x=>x.names>=55).length,
  strictlyUniqueQuestionAndFullBallotCandidates:
   stages.strict_unique_question_full_ballot_candidate,
  stages,
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,14),
  dbLinksCreated:0,acceptedVoteEventsChanged:false,paperActionsChanged:false,
  fullBillTextsCertified:0
 };
}
/** The caller already has complete read-only accepted/source cohorts. */
export async function read2022PassageRosterShadow(
 db:PoolClient,votes:readonly AcceptedVote[],actions:readonly ParsedAction[],expected:number
):Promise<RosterShadowProof>{
 // Load only source documents relevant to unlinked 2021-22 passage votes,
 // not every unrelated journal/action in the three-biennium census.
 const candidateScopes=new Set(votes.filter(v=>v.session==='2021-2022'
  &&v.vote_kind==='passage'&&!v.exact_linked).map(scope));
 const ids=[...new Set(actions.filter(a=>candidateScopes.has(scope(a))
  &&a.kind==='passage'&&a.original_source_verified
  &&Number.isInteger(a.yea_count)&&Number.isInteger(a.nay_count)
  &&a.source_url.includes('/journals/2021-2022/'))
  .map(a=>a.source_id))];
 if(ids.length>150)throw Error('Original 2021-22 PDF source inventory exceeds shadow bound');
 const docs=ids.length?(await db.query<StoredJournal>(
  "SELECT id::text,source_url,metadata#>>'{rawPrepassageVotes,sourceType}' AS source_type,"+
  "metadata#>>'{rawPrepassageVotes,text}' AS raw_text,content_sha256"+
  " FROM source_documents WHERE id=ANY($1::uuid[]) ORDER BY id LIMIT 151",
  [ids]
 )).rows:[];
 return summarize2022PassageRosterShadow(votes,actions,docs,expected);
}
