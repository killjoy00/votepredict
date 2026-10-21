/**
 * Population-wide source-only diagnosis: accepted Senate votes with a paper
 * on the same original journal URL, bill and date, but no current exact link.
 * Run in caller's independently verified REPEATABLE READ READ ONLY transaction.
 * Never emit source text, ballots, names, URLs or internal identifiers.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,compact} from './senate-vote-paper-parser.js';
import {questionCore} from './senate-vote-paper-case-audit.js';
import type {VoteTextGapAudit} from './senate-vote-text-gap-audit.js';

export const SAME_SOURCE_QUESTION_CENSUS_VERSION='senate-same-source-question-census-v1' as const;
export type FailureStage=
 'accepted_ballot_incomplete'|'source_provenance_unverified'|
 'paper_ballot_absent'|'no_matching_tally'|'full_named_ballot_mismatch'|
 'ballot_repeated_across_papers'|'ballot_repeated_across_votes'|
 'strict_question_but_no_current_link'|'typography_only_question_difference'|
 'question_intro_difference'|'substantive_question_difference';

export interface AcceptedVote {
 id:string;source_id:string;source_url:string;bill_id:string;
 bill:string;session:string;day:string;vote_kind:string;
 motion_text:string;yea_count:number;nay_count:number;
 votes:Array<{name:string;choice:string}>;
 exact_linked:boolean;stored_link:boolean;
}
export interface ParsedAction {
 id:string;source_id:string;source_url:string;bill_id:string;
 day:string;kind:string;sequence:number;
 question_text:string;motion_text:string;
 yea_count:number|null;nay_count:number|null;
 ballot_sha256:string|null;original_source_verified:boolean;
}
export interface StageGroup {
 stage:FailureStage;vote_kind:string;session:string;count:number;
}
export interface CohortExample {
 session:string;vote_kind:string;stage:FailureStage;bill:string;day:string;votes:number;
}
export interface Passage2021Focus {
  missingPaperBallotVotes:number;
  /** No parsed passage-kind action at the exact original URL/bill/day. */
  noPassageAction:number;
  /** A passage-kind paper action has printed tally, but lacks a complete roll. */
  passageActionWithTallyButNoBallot:number;
  /** Passage-kind paper exists but lacks both a printed tally and full ballot. */
  passageActionWithoutTally:number;
  /** Only public identifiers; priority locations for original-source canaries. */
  examples:Array<{bill:string;day:string;votes:number;kind:'no_passage_action'|'passage_with_tally'|'passage_without_tally'}>;
}
export interface SameSourceQuestionCensus {
 schemaVersion:typeof SAME_SOURCE_QUESTION_CENSUS_VERSION;
 auditedAcceptedVotes:number;
 acceptedWithSourceDayBillPaper:number;
 sameSourceUnlinked:number;
 sourceVerifiedActionCount:number;
 unlinkedWithExistingStoredLink:number;
 stages:StageGroup[];
 totals:Record<FailureStage,number>;
 /** Strict unique ballot with exact, typography or question-intro-only difference. */
 candidateQuestionRechecks:number;
 focused2021Passage:Passage2021Focus;
 examples:CohortExample[];
 newLinksAdded:0;sourceBodiesChanged:false;officialVotesChanged:false;
 completeTextStatesCertified:0;
}
const STAGES:readonly FailureStage[]=[
 'accepted_ballot_incomplete','source_provenance_unverified',
 'paper_ballot_absent','no_matching_tally','full_named_ballot_mismatch',
 'ballot_repeated_across_papers','ballot_repeated_across_votes',
 'strict_question_but_no_current_link','typography_only_question_difference',
 'question_intro_difference','substantive_question_difference'
];

/** Query only official MN Senate accepted votes with a source-local paper at
 * exactly matching bill, day and URL. Include already-linked events solely
 * to reject repeated accepted ballots in the reverse uniqueness check.
 */
const voteQuery=[
 "SELECT v.id::text AS id,v.source_document_id::text AS source_id,",
 "d.source_url,v.bill_id::text AS bill_id,b.identifier AS bill,",
 "s.slug AS session,v.occurred_on::text AS day,v.vote_kind,v.motion_text,",
 "v.yea_count,v.nay_count,",
 "coalesce((SELECT jsonb_agg(jsonb_build_object('name',m.source_member_name,",
 "'choice',m.choice)) FROM member_votes m WHERE m.vote_event_id=v.id),'[]'::jsonb) AS votes,",
 "EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v x",
 "WHERE x.vote_event_id=v.id) AS exact_linked,",
 "EXISTS(SELECT 1 FROM senate_vote_paper_event_links l",
 "WHERE l.vote_event_id=v.id) AS stored_link",
 "FROM vote_events v",
 "JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'",
 "JOIN legislative_sessions s ON s.id=v.session_id",
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "JOIN source_documents d ON d.id=v.source_document_id",
 "JOIN bills b ON b.id=v.bill_id",
 "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')",
 "AND EXISTS(SELECT 1 FROM senate_vote_paper_current_v a",
 "WHERE a.bill_id=v.bill_id AND a.occurred_on=v.occurred_on",
 "AND a.source_url=d.source_url)",
 "ORDER BY v.id LIMIT 2501"
].join(' ');
const actionQuery=[
 "SELECT a.id::text AS id,a.source_document_id::text AS source_id,",
 "a.source_url,a.bill_id::text AS bill_id,a.occurred_on::text AS day,",
 "a.kind,a.sequence,a.question_text,a.motion_text,a.yea_count,a.nay_count,",
 "a.ballot_sha256,a.original_source_verified",
 "FROM senate_vote_paper_current_v a",
 "WHERE EXISTS(SELECT 1 FROM vote_events v",
 "JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'",
 "JOIN legislative_sessions s ON s.id=v.session_id",
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "JOIN source_documents d ON d.id=v.source_document_id",
 "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')",
 "AND v.bill_id=a.bill_id AND v.occurred_on=a.occurred_on",
 "AND d.source_url=a.source_url)",
 "ORDER BY a.id LIMIT 6501"
].join(' ');

function key(v:{source_url:string;bill_id:string;day:string}):string {
 return JSON.stringify([v.source_url,v.bill_id,v.day]);
}
function question(t:string):string {return questionCore(t)}
function typography(t:string):string {
 // Diagnostic classes only. Neither text normalization grants a link.
 return compact(question(t).toLowerCase()
  .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/[\u2013\u2014]/g,'-')
  .replace(/[.,;:!?"'\u2010-]/g,' ').replace(/\s+/g,' '));
}
function afterIntro(t:string):string {
 return typography(question(t).replace(/^the question (?:was taken|recurred)\b[\s,:;]*/i,''));
}
function signed(v:AcceptedVote):string|null{
 return ballotSignature(v.votes,v.yea_count,v.nay_count);
}
function tally(a:ParsedAction,v:AcceptedVote):boolean{
 return Number.isInteger(a.yea_count)&&Number.isInteger(a.nay_count)
  &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count;
}
function eligible(a:ParsedAction,v:AcceptedVote):boolean {
 return a.source_id===v.source_id||a.original_source_verified;
}
/** One exclusive first-failure stage per unlinked accepted event. */
export function classifySameSourceVote(
 vote:AcceptedVote,actions:readonly ParsedAction[],allVotes:readonly AcceptedVote[]
):FailureStage{
 if(vote.exact_linked)throw Error('Already exact-linked vote in unresolved classifier');
 const scoped=actions.filter(a=>key(a)===key(vote));
 if(!scoped.length)throw Error('Same-source/day/bill audit candidate disappeared');
 const signature=signed(vote);
 if(!signature)return 'accepted_ballot_incomplete';
 const available=scoped.filter(a=>eligible(a,vote));
 if(!available.length)return 'source_provenance_unverified';
 if(!available.some(a=>a.ballot_sha256))return 'paper_ballot_absent';
 const countMatch=available.filter(a=>tally(a,vote));
 if(!countMatch.length)return 'no_matching_tally';
 const ballotMatch=countMatch.filter(a=>a.ballot_sha256?.trim()===signature);
 if(!ballotMatch.length)return 'full_named_ballot_mismatch';
 if(ballotMatch.length!==1)return 'ballot_repeated_across_papers';
 const a=ballotMatch[0]!;
 const reverse=allVotes.filter(v=>key(v)===key(a)&&eligible(a,v)
  &&tally(a,v)&&signed(v)===signature);
 if(reverse.length!==1)return 'ballot_repeated_across_votes';
 if(question(a.question_text)===question(vote.motion_text))
  return 'strict_question_but_no_current_link';
 if(typography(a.question_text)===typography(vote.motion_text))
  return 'typography_only_question_difference';
 if(afterIntro(a.question_text)===afterIntro(vote.motion_text))
  return 'question_intro_difference';
 return 'substantive_question_difference';
}
export function summarizeSameSourceFailures(
 votes:readonly AcceptedVote[],actions:readonly ParsedAction[],gap:VoteTextGapAudit
):SameSourceQuestionCensus{
 if(votes.length>=2501||actions.length>=6501
  ||new Set(votes.map(v=>v.id)).size!==votes.length
  ||new Set(actions.map(a=>a.id)).size!==actions.length)
  throw Error('Same-source census row bound or duplicate source identity');
 const cohort=votes.filter(v=>!v.exact_linked);
 const expected=gap.groups.filter(g=>g.evidence_stage==='same_source_day_bill_unlinked')
  .reduce((n,g)=>n+g.event_count,0);
 if(gap.auditedEvents<cohort.length||cohort.length!==expected)
  throw Error('Same-source cohort count differs from independently reconciled official denominator');
 const totals=Object.fromEntries(STAGES.map(x=>[x,0])) as Record<FailureStage,number>;
 const groups=new Map<string,StageGroup>();
 const examples=new Map<string,CohortExample>();
 const actionsByScope=new Map<string,ParsedAction[]>();
 const votesByScope=new Map<string,AcceptedVote[]>();
 const focusCounts={noPassageAction:0,passageActionWithTallyButNoBallot:0,
  passageActionWithoutTally:0};
 const focusExamples=new Map<string,Passage2021Focus['examples'][number]>();
 for(const a of actions){const k=key(a),x=actionsByScope.get(k)??[];x.push(a);actionsByScope.set(k,x)}
 for(const v of votes){const k=key(v),x=votesByScope.get(k)??[];x.push(v);votesByScope.set(k,x)}
 for(const v of cohort){
  if(!/^(HF|SF)[1-9][0-9]{0,5}$/.test(v.bill)
   ||!/^\d{4}-\d\d-\d\d$/.test(v.day)
   ||!['2021-2022','2023-2024','2025-2026'].includes(v.session))
   throw Error('Same-source audit unsafe public bill/date identifier');
  const k=key(v);
  const stage=classifySameSourceVote(v,actionsByScope.get(k)??[],votesByScope.get(k)??[]);
  totals[stage]++;
  if(v.session==='2021-2022'&&v.vote_kind==='passage'&&stage==='paper_ballot_absent'){
   const eligiblePaper=(actionsByScope.get(k)??[]).filter(a=>eligible(a,v));
   const passage=eligiblePaper.filter(a=>a.kind==='passage');
   const shape:Passage2021Focus['examples'][number]['kind']=passage.length===0
    ?'no_passage_action'
    :passage.some(a=>Number.isInteger(a.yea_count)&&Number.isInteger(a.nay_count))
    ?'passage_with_tally':'passage_without_tally';
   if(shape==='no_passage_action')focusCounts.noPassageAction++;
   else if(shape==='passage_with_tally')focusCounts.passageActionWithTallyButNoBallot++;
   else focusCounts.passageActionWithoutTally++;
   const fk=JSON.stringify([v.bill,v.day,shape]);
   const entry=focusExamples.get(fk)??{bill:v.bill,day:v.day,kind:shape,votes:0};
   entry.votes++;focusExamples.set(fk,entry);
  }
  const gk=JSON.stringify([v.session,v.vote_kind,stage]);
  const g=groups.get(gk)??{session:v.session,vote_kind:v.vote_kind,stage,count:0};
  g.count++;groups.set(gk,g);
  const ek=JSON.stringify([v.session,v.vote_kind,stage,v.bill,v.day]);
  const e=examples.get(ek)??{session:v.session,vote_kind:v.vote_kind,stage,bill:v.bill,day:v.day,votes:0};
  e.votes++;examples.set(ek,e);
 }
 if([...groups.values()].reduce((n,g)=>n+g.count,0)!==cohort.length
  ||Object.values(totals).reduce((a,b)=>a+b,0)!==cohort.length)
  throw Error('Same-source census stage partition failed');
  const focusCount=Object.values(focusCounts).reduce((n,v)=>n+v,0);
  const focusGrouped=[...groups.values()].filter(g=>g.session==='2021-2022'
   &&g.vote_kind==='passage'&&g.stage==='paper_ballot_absent')
   .reduce((n,g)=>n+g.count,0);
  if(focusCount!==focusGrouped)throw Error('Focused 2021 passage census did not partition eligible source actions');
 return {
  schemaVersion:SAME_SOURCE_QUESTION_CENSUS_VERSION,
  auditedAcceptedVotes:gap.auditedEvents,
  acceptedWithSourceDayBillPaper:votes.length,
  sameSourceUnlinked:cohort.length,
  sourceVerifiedActionCount:actions.filter(a=>a.original_source_verified).length,
  unlinkedWithExistingStoredLink:cohort.filter(v=>v.stored_link).length,
  totals,stages:[...groups.values()].sort((a,b)=>
   a.session.localeCompare(b.session)||a.vote_kind.localeCompare(b.vote_kind)||a.stage.localeCompare(b.stage)),
  candidateQuestionRechecks:
   totals.strict_question_but_no_current_link+
   totals.typography_only_question_difference+
   totals.question_intro_difference,
  focused2021Passage:{
   missingPaperBallotVotes:focusCount,...focusCounts,
   examples:[...focusExamples.values()].sort((a,b)=>b.votes-a.votes||
    a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,12)
  },
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.session.localeCompare(b.session)||a.bill.localeCompare(b.bill)||a.day.localeCompare(b.day)).slice(0,18),
  newLinksAdded:0,sourceBodiesChanged:false,officialVotesChanged:false,completeTextStatesCertified:0
 };
}
/** Called only inside the protected READ ONLY coverage transaction. */
export async function readSameSourceQuestionCensus(
 db:PoolClient,gap:VoteTextGapAudit
):Promise<SameSourceQuestionCensus>{
 const votes=(await db.query<AcceptedVote>(voteQuery)).rows;
 const actions=(await db.query<ParsedAction>(actionQuery)).rows;
 return summarizeSameSourceFailures(votes,actions,gap);
}
