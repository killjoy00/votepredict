/**
 * #1498: whole 372 accepted NULL-bill Senate-Journal votes. SECOND SOURCE
 * hypothesis after the physical printed-question audit proved 0 literal-
 * question bill IDs: a separately printed INITIATING motion may explicitly
 * introduce a specific bill and remain bounded by the same roll question.
 *
 * Read-only. Parent-movement markers are investigation candidates, NOT an
 * authority to change an accepted vote bill_id. Full original SHA receipts,
 * accepted source/day ballot uniqueness, printed question/header offsets and
 * existing source-unique bounds remain mandatory even for candidate triage.
 * No source text, member names, URLs, UUIDs, or bill strings are logged.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,billIdentifier} from './senate-vote-paper-parser.js';
import {fullQuestion} from './senate-repeated-paper-original-roll-audit.js';
import {readOrphanJournalOriginalAudit,
 type UnresolvedOriginalReview,type OrphanReport}
 from './senate-orphan-journal-original-audit.js';
import type {VoteTextGapAudit} from './senate-vote-text-gap-audit.js';

export const SENATE_NULL_BILL_PARENT_AUDIT=
 'senate-1498-unresolved-372-original-parent-structure-v1' as const;
export type ParentStage=
 'original_document_unverified_or_duplicated'|
 'original_question_ballot_repeated'|
 'original_question_span_unproven'|
 'non_amendment_procedural_question'|
 'source_day_question_ballot_not_unique'|
 'already_claimed_by_other_accepted_event'|
 'original_question_not_identical'|
 'no_printed_parent_motion'|
 'unbound_bill_mentions_without_parent'|
 'several_printed_parent_motions'|
 'intervening_vote_question_or_roll'|
 'intervening_distinct_motion'|
 'multiple_bills_in_bounded_parent'|
 'parent_more_than_2400_chars_away'|
 'parent_bill_not_uniquely_cataloged'|
 'bounded_parent_motion_candidate_not_certified';
const STAGES:readonly ParentStage[]=[
 'original_document_unverified_or_duplicated',
 'original_question_ballot_repeated','original_question_span_unproven',
 'non_amendment_procedural_question',
 'source_day_question_ballot_not_unique',
 'already_claimed_by_other_accepted_event',
 'original_question_not_identical',
 'no_printed_parent_motion',
 'unbound_bill_mentions_without_parent',
 'several_printed_parent_motions',
 'intervening_vote_question_or_roll',
 'intervening_distinct_motion',
 'multiple_bills_in_bounded_parent',
 'parent_more_than_2400_chars_away',
 'parent_bill_not_uniquely_cataloged',
 'bounded_parent_motion_candidate_not_certified'
];
type Preliminary={stage:ParentStage;bill:string|null};
interface SessionBill {id:string;session:string;identifier:string}
export interface SourceParentReport{
 schemaVersion:typeof SENATE_NULL_BILL_PARENT_AUDIT;
 wholeUnassignedOriginalJournalVotes:number;
 exactPrintedQuestionWithoutBill:number;
 otherSourceEvidenceHolds:number;
 sourceMotionParentCandidates:number;
 fullyUniqueSessionBillParentCandidates:number;
 stages:Record<ParentStage,number>;
 grouped:Array<{session:string;vote_kind:string;stage:ParentStage;count:number}>;
 // The parent motion, even with a unique bill, is not an official
 // question ownership or adopted-amendment proof.
 officialBillAssociationsChanged:false;
 sourceBodiesChanged:false;previousActionsChanged:false;
 exactLinksCreated:0;completeAmendedStatesCertified:0;
 servingModelsChanged:false;
}
function billIds(value:string):string[]{
 const matches=[...value.matchAll(/\b[HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6}\b/gi)]
  .map(m=>billIdentifier(m[0])).filter((x):x is string=>!!x);
 return [...new Set(matches)];
}
/** A named mover MUST explicitly govern the bill in a grammatical amendment
 * motion. NOT the nearest SF/HF token, heading, calendar item or past vote.
 * Names are matched locally but never emitted or copied to the report.
 */
const PARENT_MARKERS=[
 /\b(?:Senator\s+)?[A-Za-z][A-Za-z'.-]{1,50}\s+moved\s+that\s+([HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6})\s+(?:be|should\s+be)\s+amended\b/gi,
 /\b(?:Senator\s+)?[A-Za-z][A-Za-z'.-]{1,50}\s+moved\s+to\s+amend\s+([HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6})\b/gi,
 /\b(?:Senator\s+)?[A-Za-z][A-Za-z'.-]{1,50}\s+(?:moved|offered)\s+(?:(?:the\s+following|an?)\s+)?amendment\s+to\s+([HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6})\b/gi
] as const;
interface ParentMatch {bill:string;at:number;end:number}
export function scanExplicitParentMotion(
 body:string,questionStart:number,previousRollStart:number|null,
 question:string,kind:string
):Preliminary{
 if(kind!=='amendment'||!/\bamendment\b/i.test(question))
  return {stage:'non_amendment_procedural_question',bill:null};
 if(questionStart<=0||questionStart>body.length||
  !/^The question (?:was taken|recurred)\b/i.test(question)||
  billIds(question).length)
  return {stage:'original_question_not_identical',bill:null};
 const start=Math.max(0,questionStart-4000,
  previousRollStart===null?0:previousRollStart);
 const source=body.slice(start,questionStart);
 const parents:ParentMatch[]=[];
 for(const pat of PARENT_MARKERS){
  for(const m of source.matchAll(pat)){
   if(m.index===undefined)continue;
   const bill=billIdentifier(m[1]!);
   if(bill)parents.push({bill,at:start+m.index,end:start+m.index+m[0].length});
  }
 }
 if(!parents.length){
  return {stage:billIds(source).length?'unbound_bill_mentions_without_parent'
   :'no_printed_parent_motion',bill:null};
 }
 // Identical regex matches of one printed parent may overlap; de-duplicate
 // by the actual physical start and complete printed bill identity.
 const physical=[...new Map(parents.map(p=>[p.at+':'+p.bill,p])).values()];
 if(physical.length!==1)
  return {stage:'several_printed_parent_motions',bill:null};
 const p=physical[0]!;
 if(questionStart-p.end>2400)
  return {stage:'parent_more_than_2400_chars_away',bill:null};
 const after=body.slice(p.end,questionStart);
 if(/The roll was called,\s*and there were yeas\b|The question (?:was taken|recurred)\b/i.test(after))
  return {stage:'intervening_vote_question_or_roll',bill:null};
 if(/\b(?:Senator\s+)?[A-Za-z][A-Za-z'.-]{1,50}\s+(?:moved|offered|proposed)\b/i.test(after))
  return {stage:'intervening_distinct_motion',bill:null};
 // A second distinct bill in the physically bounded parent proposal
 // (including amendment language) is a substantive ownership ambiguity.
 const actual=billIds(body.slice(p.at,questionStart));
 if(actual.length!==1||actual[0]!==p.bill)
  return {stage:'multiple_bills_in_bounded_parent',bill:null};
 return {stage:'bounded_parent_motion_candidate_not_certified',bill:p.bill};
}
export function classifyOriginalParentReview(item:UnresolvedOriginalReview):Preliminary{
 if(item.stage==='original_unverified_or_duplicated')
  return {stage:'original_document_unverified_or_duplicated',bill:null};
 if(item.stage==='original_question_ballot_repeated')
  return {stage:'original_question_ballot_repeated',bill:null};
 if(item.stage==='original_question_span_unproven')
  return {stage:'original_question_span_unproven',bill:null};
 if(item.stage!=='bill_not_printed_in_question')
  throw Error('Original 372-case source stage changed; review original Journal before inferring parent');
 const {vote,original,parsed}=item;
 if(!original?.original_verified||!original.body||!parsed?.aligned)
  throw Error('Previously verified source parent candidate original missing');
 const q=fullQuestion(vote.motion_text);
 const sig=ballotSignature(vote.votes,vote.yea_count,vote.nay_count);
 if(!sig)throw Error('Original parent candidate full accepted named-ballot disappeared');
 const matches=parsed.rolls.filter(r=>r.question===q&&r.ballot===sig
  &&r.yeas===vote.yea_count&&r.nays===vote.nay_count);
 if(matches.length!==1)throw Error('Original motion owner physical roll candidate drift');
 const roll=matches[0]!;
 if(roll.questionStart===null||roll.questionStart>=roll.start||
  roll.start-roll.questionStart>2600)
  throw Error('Original parent question/header offsets not source-proven');
 const peers=item.acceptedPeers.filter(a=>a.yeas===vote.yea_count
  &&a.nays===vote.nay_count
  &&ballotSignature(a.votes,a.yeas,a.nays)===sig
  &&fullQuestion(a.motionText)===q);
 if(peers.length!==1||peers[0]!.eventId!==vote.id)
  return {stage:'source_day_question_ballot_not_unique',bill:null};
 if(vote.stored_link||item.claimedQuestions.some(c=>
  c.question_text===q&&c.yea_count===vote.yea_count
  &&c.nay_count===vote.nay_count&&c.ballot_sha256===sig
  &&c.vote_event_id!==vote.id))
  return {stage:'already_claimed_by_other_accepted_event',bill:null};
 if(billIds(q).length)
  throw Error('Original parent source-only cohort unexpectedly has bill printed in question');
 // A previous physical roll is a structural BARRIER, not evidence of the
 // target bill or vote. Its chronological relationship cannot promote a link.
 const prior=parsed.rolls.filter(r=>r.start<roll.questionStart!).at(-1);
 return scanExplicitParentMotion(original.body,roll.questionStart,
  prior?.start??null,q,vote.vote_kind);
}
export function summarizeOriginalParentOwnership(
 items:readonly UnresolvedOriginalReview[],
 gap:VoteTextGapAudit,
 originalAudit:OrphanReport,
 catalog:readonly SessionBill[]
):SourceParentReport{
 if(items.length!==372||originalAudit.unresolvedBill!==372||
  items.length!==gap.groups.filter(g=>g.source_family==='senate_journal'
   &&g.evidence_stage==='no_resolved_bill').reduce((n,g)=>n+g.event_count,0)
  ||new Set(items.map(x=>x.vote.id)).size!==items.length||
  catalog.length>8000)
  throw Error('Original 372 accepted-null-bill source population drift');
 // Frozen independently in protected original-government run #39883631853.
 const required={
  original_unverified_or_duplicated:43,
  original_question_ballot_repeated:80,
  original_question_span_unproven:12,
  bill_not_printed_in_question:237
 };
 const observed=originalAudit.stages.unresolved_bill;
 if(Object.entries(required).some(([k,v])=>observed[k as keyof typeof observed]!==v)||
  Object.values(observed).reduce((n,v)=>n+v,0)!==372)
  throw Error('Independent whole-original 372 question/ballot proof stage drift');
 const byCatalog=new Map<string,Set<string>>();
 for(const b of catalog){
  const k=b.session+'|'+b.identifier;
  const ids=byCatalog.get(k)??new Set<string>();ids.add(b.id);byCatalog.set(k,ids);
 }
 const stages=Object.fromEntries(STAGES.map(x=>[x,0])) as Record<ParentStage,number>;
 const grouped=new Map<string,SourceParentReport['grouped'][number]>();
 let parent=0,cataloged=0;
 for(const item of items){
  if(item.vote.bill_id!==null||item.vote.bill!==null)
   throw Error('Original null-bill candidate has a current accepted bill');
  const preliminary=classifyOriginalParentReview(item);
  let stage=preliminary.stage;
  if(stage==='bounded_parent_motion_candidate_not_certified'){
   parent++;
   const bills=byCatalog.get(item.vote.session+'|'+preliminary.bill);
   if(bills?.size!==1)stage='parent_bill_not_uniquely_cataloged';
   else cataloged++;
  }
  stages[stage]++;
  const key=JSON.stringify([item.vote.session,item.vote.vote_kind,stage]);
  const g=grouped.get(key)??{session:item.vote.session,
   vote_kind:item.vote.vote_kind,stage,count:0};
  g.count++;grouped.set(key,g);
 }
 if(Object.values(stages).reduce((n,v)=>n+v,0)!==372||
  stages.original_document_unverified_or_duplicated!==43||
  stages.original_question_ballot_repeated!==80||
  stages.original_question_span_unproven!==12)
  throw Error('Original 372-case structural audit failed source population conservation');
 return{
  schemaVersion:SENATE_NULL_BILL_PARENT_AUDIT,
  wholeUnassignedOriginalJournalVotes:372,
  exactPrintedQuestionWithoutBill:237,
  otherSourceEvidenceHolds:135,
  sourceMotionParentCandidates:parent,
  fullyUniqueSessionBillParentCandidates:cataloged,
  stages,
  grouped:[...grouped.values()].sort((a,b)=>b.count-a.count||
   a.session.localeCompare(b.session)),
  officialBillAssociationsChanged:false,sourceBodiesChanged:false,
  previousActionsChanged:false,exactLinksCreated:0,
  completeAmendedStatesCertified:0,servingModelsChanged:false
 };
}
/** Bounded original exact-source re-read, one protected readonly transaction.
 * All new candidate bill identifiers are looked up by unique session catalog
 * within the transaction; never assign bill_id or publish original context.
 */
export async function readNullBillParentStructureAudit(
 db:PoolClient,gap:VoteTextGapAudit
):Promise<SourceParentReport>{
 const items:UnresolvedOriginalReview[]=[];
 const audited=await readOrphanJournalOriginalAudit(db,gap,undefined,
  p=>items.push(p));
 if(items.length!==372)throw Error('Original null-bill Journal reader did not cover whole population');
 const candidates=[...new Set(items.flatMap(item=>{
  const p=classifyOriginalParentReview(item);
  return p.bill?[p.bill]:[];
 }))];
 if(candidates.length>600)throw Error('Original parent bill identifiers exceeded query bound');
 const rows:SessionBill[]=candidates.length?(await db.query<SessionBill>([
  'SELECT b.id::text AS id,s.slug AS session,b.identifier',
  'FROM bills b JOIN legislative_sessions s ON s.id=b.session_id',
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
  "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')",
  'AND b.identifier=ANY($1::text[]) ORDER BY s.slug,b.identifier,b.id LIMIT 8001'
 ].join(' '),[candidates])).rows:[];
 if(rows.length>=8001)throw Error('Original parent catalog query truncated');
 return summarizeOriginalParentOwnership(items,gap,audited,rows);
}
