/**
 * #1498: whole-population original Senate Journal recovery for accepted votes
 * with known bills but no parsed paper, and for missing bill associations.
 * Keep release blocked until a separate protected READ ONLY original audit
 * certifies exact counts. Never reconstruct a bill by roll order or tally.
 */
import type {Pool,PoolClient} from 'pg';
import {billIdentifier,ballotSignature,hash} from './senate-vote-paper-parser.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit}
 from './senate-vote-text-gap-audit.js';
import {readOrphanJournalOriginalAudit,type OrphanProof,type OrphanReport}
 from './senate-orphan-journal-original-audit.js';
import {strictRepeatedOriginalQuestionLinks,insertOne,
 type StrictRepeatedOriginalLink} from './senate-repeated-paper-exact-repair.js';
import type {AcceptedVote} from './senate-same-source-question-census.js';
import type {UniqueOriginalRoll}
 from './senate-repeated-paper-original-roll-audit.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures}
 from './senate-same-source-question-census.js';

export const SENATE_ORPHAN_QUESTION_REPAIR='senate-1498-missing-paper-and-printed-bill-recovery-v1' as const;
/** BLOCKING until independently verified run from PR #1544 returns counts.
 * A zero or omitted held-stage record never authorizes production mutation.
 */
const CERTIFIED_KNOWN_BILL_PAPERS=0;
const CERTIFIED_PRINTED_BILL_ASSOCIATIONS=0;
const CERTIFIED_AUTHENTICATED_ORIGINALS=0;
const CERTIFIED_SOURCE_STAGE_COUNTS:Readonly<Record<string,number>>={};
const SHA=/^[0-9a-f]{64}$/;
export interface OrphanRepairResult{
 schemaVersion:typeof SENATE_ORPHAN_QUESTION_REPAIR;
 result:'linked_original_question_ballots'|'already_applied';
 auditedSourceVotes:number;authenticatedOriginals:number;
 linkedMissingPaperQuestions:number;correctedExplicitPrintedBillAssociations:number;
 originalQuestionActionsCreated:number;exactAcceptedLinksCreated:number;
 exactBefore:number;exactAfter:number;
 sameJournalUnlinkedBefore:number;sameJournalUnlinkedAfter:number;
 missingBillWithoutPaperBefore:number;missingBillWithoutPaperAfter:number;
 unresolvedBillBefore:number;unresolvedBillAfter:number;
 originalNamedVotesChanged:false;originalMotionTextChanged:false;
 originalSourceBodiesChanged:false;oldPaperActionsChanged:false;
 servingModelsChanged:false;completeAmendedStatesCertified:0;
}
export interface BoundOrphanSourceLink{
 link:StrictRepeatedOriginalLink;
 original:OrphanProof;
}
/** Original binder is intentionally independent of DB promotion.
 * A missing bill_id may be filled in memory ONLY if the full original
 * question itself contains one unambiguous bill and physical source agrees.
 */
export function bindOrphanSourceProofs(
 proofs:readonly OrphanProof[]
):BoundOrphanSourceLink[]{
 const prepared:BoundOrphanSourceLink[]=[];
 for(const proof of proofs){
  const v=proof.vote;
  if(proof.resolution==='existing_bill'){
   if(v.bill_id!==proof.resolvedBillId||v.bill!==proof.printedBill)
    throw Error('Original known bill vote identity contradicted retained bill');
  }else{
   if(v.bill_id!==null||v.bill!==null)
    throw Error('Printed bill repair cannot overwrite known accepted bill');
   const matches=[...proof.printedQuestion.matchAll(
    /\b[HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6}\b/gi)]
    .map(x=>billIdentifier(x[0])).filter((x):x is string=>x!==null);
   if(new Set(matches).size!==1||matches[0]!==proof.printedBill)
    throw Error('Bill ID must occur distinctly INSIDE same printed question');
  }
  const virtual:AcceptedVote={
   ...v,bill_id:proof.resolvedBillId,bill:proof.printedBill
  };
  const material:UniqueOriginalRoll={
   vote:virtual,source:proof.source,
   printedQuestion:proof.printedQuestion,questionStart:proof.questionStart,
   rollStart:proof.rollStart,rollOrdinal:proof.rollOrdinal,
   ballot:proof.ballot,originalTextSha:proof.originalTextSha
  };
  const link=strictRepeatedOriginalQuestionLinks([material])[0]!;
  if(link.bill!==proof.printedBill||link.billId!==proof.resolvedBillId
   ||link.acceptedId!==v.id||link.ballot!==proof.ballot)
   throw Error('Original source question or bill binding drift');
  prepared.push({link,original:proof});
 }
 // The source and accepted population is checked as a SINGLE corpus, not
 // one at a time. Never allow a physical roll or accepted vote to be reused.
 strictRepeatedOriginalQuestionLinks(prepared.map(x=>({
  vote:{...x.original.vote,bill_id:x.original.resolvedBillId,
   bill:x.original.printedBill},
  source:x.original.source,
  printedQuestion:x.original.printedQuestion,
  questionStart:x.original.questionStart,rollStart:x.original.rollStart,
  rollOrdinal:x.original.rollOrdinal,ballot:x.original.ballot,
  originalTextSha:x.original.originalTextSha
 })));
 return prepared;
}
async function count(db:PoolClient):Promise<number>{
 return (await db.query<{n:number}>(
  'SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v'
 )).rows[0]?.n??-1;
}
/** Change ONLY bill_id for a source-printed, uniquely identified preexisting
 * null-bill event. Full ballot, outcome, motion, original document, member
 * rows and vote kind remain untouched. A failed append/link rolls back bill_id.
 */
export async function attachStrictPrintedBill(
 db:PoolClient,p:BoundOrphanSourceLink
):Promise<void>{
 if(p.original.resolution!=='printed_bill')throw Error('Not a missing-bill source proof');
 const v=p.original.vote,link=p.link;
 if(v.bill_id!==null||v.bill!==null||v.id!==link.acceptedId
  ||!SHA.test(link.originalTextSha)||v.source_url!==link.sourceUrl)
  throw Error('Printed bill proof accepted identity is incomplete');
 const accepted=(await db.query<{
  fingerprint:string;votes:Array<{name:string;choice:string}>;
 }>([
  'SELECT senate_vote_paper_event_fingerprint(v.id) AS fingerprint,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',m.source_member_name,",
  "'choice',m.choice)) FROM member_votes m WHERE m.vote_event_id=v.id),'[]'::jsonb) AS votes",
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  'WHERE v.id=$1::uuid AND v.source_document_id=$2::uuid AND d.source_url=$3',
  'AND v.bill_id IS NULL AND v.occurred_on=$4::date AND v.vote_kind=$5',
  'AND v.motion_text=$6 AND v.yea_count=$7 AND v.nay_count=$8',
  'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links e WHERE e.vote_event_id=v.id)',
  'FOR UPDATE OF v'
 ].join(' '),[
  v.id,v.source_id,v.source_url,v.day,v.vote_kind,v.motion_text,
  v.yea_count,v.nay_count
 ])).rows;
 if(accepted.length!==1||!SHA.test(accepted[0]!.fingerprint)
  ||ballotSignature(accepted[0]!.votes,v.yea_count,v.nay_count)!==link.ballot)
  throw Error('Pre-promotion printed-bill accepted full named ballot or original identity drifted');
 const written=await db.query([
  'UPDATE vote_events v SET bill_id=b.id FROM bills b',
  'WHERE v.id=$1::uuid AND v.source_document_id=$2::uuid',
  'AND v.bill_id IS NULL AND b.id=$3::uuid AND b.identifier=$4',
  'AND b.session_id=v.session_id',
  'AND v.occurred_on=$5::date AND v.vote_kind=$6',
  'AND v.motion_text=$7 AND v.yea_count=$8 AND v.nay_count=$9',
  'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links e WHERE e.vote_event_id=v.id)',
  'RETURNING v.id'
 ].join(' '),[
  v.id,v.source_id,p.original.resolvedBillId,p.original.printedBill,
  v.day,v.vote_kind,v.motion_text,v.yea_count,v.nay_count
 ]);
 if(written.rowCount!==1)throw Error('Original printed Senate question did not produce one unchanged null-bill assignment');
}
