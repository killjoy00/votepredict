/**
 * #1498: whole-population original Senate Journal recovery for accepted votes
 * with known bills but no parsed paper, and for missing bill associations.
 * Independent protected original audit #39846423630 certified 99
 * missing-paper questions and zero safe null-bill assignments. Never reconstruct a bill by roll order or tally.
 */
import type {Pool,PoolClient} from 'pg';
import {billIdentifier,ballotSignature,hash} from './senate-vote-paper-parser.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit,type VoteTextGapAudit}
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
/** Static keys and numeric aggregates ONLY. No ballots, member names, URLs,
 * source offsets, UUIDs, question text, SQL, or exception text in logs.
 */
function safeProgress(step:string,counts:Record<string,number>={}):void{
 console.log('SENATE_ORPHAN_SAFE_PROGRESS='+JSON.stringify({step,counts}));
}
function safeProofFailures(proofs:readonly OrphanProof[]):void{
 const failures=new Map<string,number>();
 for(const p of proofs){
  try{bindOrphanSourceProofs([p])}catch(error){
   const message=error instanceof Error?error.message:'unknown';
   const key=message==='Original repeated paper source question, printed bill/header or accepted identity proof failed'
    ?'physical_source_identity'
    :message==='Repeated original question/source roll or accepted event promoted twice'
     ?'duplicate_proof'
     :message==='Original known bill vote identity contradicted retained bill'
      ?'existing_bill_mismatch'
      :message==='Bill ID must occur distinctly INSIDE same printed question'
       ?'bill_not_explicit'
       :'other_binding_guard';
   failures.set(key,(failures.get(key)??0)+1);
  }
 }
 if(failures.size){
  safeProgress('individual_proofs_held',{
   physical_source_identity:failures.get('physical_source_identity')??0,
   duplicate_proof:failures.get('duplicate_proof')??0,
   existing_bill_mismatch:failures.get('existing_bill_mismatch')??0,
   bill_not_explicit:failures.get('bill_not_explicit')??0,
   other_binding_guard:failures.get('other_binding_guard')??0
  });
  throw Error('Original orphan source proof binder found held candidate(s)');
 }
}
/** Independently protected original source run #39846423630 certified
 * 99 known-bill source questions and ZERO eligible bill-ID assignments.
 * Hold all other 423 events; a candidate count alone is not link proof.
 */
const CERTIFIED_KNOWN_BILL_PAPERS=99;
const CERTIFIED_PRINTED_BILL_ASSOCIATIONS=0;
const CERTIFIED_AUTHENTICATED_ORIGINALS=107;
/** Independently verified source-family population from the whole 2,318
 * accepted-event protected #1498 original source audit: 2,135 *Senate Journal*
 * accepted votes. Separate authenticated #864 committee source recoveries
 * subsequently added 14 + 1 events outside that same-Journal population.
 *
 * Hard-coding ALL accepted events races unrelated ingestion. Freeze instead
 * the complete *at-risk* source-family count and full 150/372 candidate/held
 * stage census, together with 240 originals, 107 independently verified
 * journals, 1,619 all-source-day accepted peers, exact links and original
 * question/ballot proof. Every official event still reconciles to the full
 * denominator through verifyVoteTextGapAudit().
 */
const CERTIFIED_SENATE_JOURNAL_EVENTS=2135;
const MINIMUM_ALREADY_AUDITED_ACCEPTED_EVENTS=2318;
export function officialOrphanJournalPopulationCertified(
 audit:VoteTextGapAudit
):boolean{
 if(!Number.isSafeInteger(audit.auditedEvents)||
  audit.auditedEvents<MINIMUM_ALREADY_AUDITED_ACCEPTED_EVENTS||
  !Array.isArray(audit.groups)||audit.groups.some(g=>
   !Number.isSafeInteger(g.event_count)||g.event_count<1))
  return false;
 const all=audit.groups.reduce((sum,g)=>sum+g.event_count,0);
 const journal=audit.groups.filter(g=>g.source_family==='senate_journal')
  .reduce((sum,g)=>sum+g.event_count,0);
 return all===audit.auditedEvents&&journal===CERTIFIED_SENATE_JOURNAL_EVENTS;
}
const CERTIFIED_SOURCE_STAGE_COUNTS:Readonly<Record<string,number>>={
 'missing_paper.original_unverified_or_duplicated':3,
 'missing_paper.original_question_ballot_repeated':42,
 'missing_paper.original_question_span_unproven':6,
 'missing_paper.unique_missing_paper_question':99,
 'unresolved_bill.original_unverified_or_duplicated':43,
 'unresolved_bill.original_question_ballot_repeated':80,
 'unresolved_bill.original_question_span_unproven':12,
 'unresolved_bill.bill_not_printed_in_question':237
};
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

function stageCountAudit(s:OrphanReport):boolean{
 if(Object.keys(CERTIFIED_SOURCE_STAGE_COUNTS).length<2)return false;
 const actual=new Map<string,number>();
 for(const [cohort,group] of Object.entries(s.stages))
  for(const [stage,n] of Object.entries(group))actual.set(cohort+'.'+stage,n);
 // Entire official ledger sums to 522; the reviewed nonzero stages alone
 // also sum to 522, hence EVERY unspecified stage must remain zero.
 return Object.values(CERTIFIED_SOURCE_STAGE_COUNTS).reduce((n,v)=>n+v,0)===s.targeted
  &&[...actual.values()].reduce((n,v)=>n+v,0)===s.targeted
  &&Object.entries(CERTIFIED_SOURCE_STAGE_COUNTS)
    .every(([stage,n])=>actual.get(stage)===n);
}
export async function repairOrphanJournalOriginalQuestions(
 pool:Pool
):Promise<OrphanRepairResult>{
 const expectedNew=CERTIFIED_KNOWN_BILL_PAPERS+CERTIFIED_PRINTED_BILL_ASSOCIATIONS;
 if(expectedNew<1||expectedNew>522||
  CERTIFIED_KNOWN_BILL_PAPERS<0||CERTIFIED_KNOWN_BILL_PAPERS>150||
  CERTIFIED_PRINTED_BILL_ASSOCIATIONS<0||
  CERTIFIED_PRINTED_BILL_ASSOCIATIONS>372||
  CERTIFIED_AUTHENTICATED_ORIGINALS<1||
  CERTIFIED_AUTHENTICATED_ORIGINALS>650||
  Object.keys(CERTIFIED_SOURCE_STAGE_COUNTS).length===0)
  throw Error('No independently certified original 150/372 Senate orphan question repair; refusing database access');
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-original-question-links'))");
   const coverage=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const previous=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(previous,coverage);
   const exactBefore=await count(db);
   safeProgress('official_exact_prestate',{exact:exactBefore,events:previous.auditedEvents,
    senateJournalEvents:previous.groups.filter(g=>g.source_family==='senate_journal').reduce((n,g)=>n+g.event_count,0)});
   const originalBefore=await readSameSourceQuestionRows(db);
   const sameBefore=summarizeSameSourceFailures(
    originalBefore.votes,originalBefore.actions,previous);
   const first=exactBefore===1255&&officialOrphanJournalPopulationCertified(previous)
    &&sameBefore.sameSourceUnlinked===332;
   const replay=exactBefore===1255+expectedNew
    &&officialOrphanJournalPopulationCertified(previous);
   safeProgress('original_population_guard',{known:previous.groups.filter(g=>g.evidence_stage==='no_parsed_paper_for_bill'&&g.source_family==='senate_journal').reduce((n,g)=>n+g.event_count,0),unresolved:previous.groups.filter(g=>g.evidence_stage==='no_resolved_bill'&&g.source_family==='senate_journal').reduce((n,g)=>n+g.event_count,0)});
   if(!first&&!replay)
    throw Error('Source-original orphan vote denominator drifted; no bill/paper mutations');
   const proofs:OrphanProof[]=[];
   const initial=await readOrphanJournalOriginalAudit(db,previous,
    p=>proofs.push(p));
   safeProgress('original_full_source_audit',{targeted:initial.targeted,missingPaper:initial.missingPaper,unresolved:initial.unresolvedBill,candidates:proofs.length,documents:initial.retrievedOriginalDocuments,authenticated:initial.authenticatedOriginalDocuments,dayPeers:initial.acceptedSourceDayPeers});
   safeProofFailures(proofs);
   const prepared=bindOrphanSourceProofs(proofs);
   safeProgress('whole_batch_bound',{prepared:prepared.length});
   const papers=prepared.filter(p=>p.original.resolution==='existing_bill');
   const newBill=prepared.filter(p=>p.original.resolution==='printed_bill');
   if(initial.eligibleKnownBillQuestions!==papers.length||
    initial.eligiblePrintedBillAssociations!==newBill.length||
    initial.eligibleKnownBillQuestions+initial.eligiblePrintedBillAssociations!==prepared.length||
    !(first&&initial.missingPaper===150&&initial.unresolvedBill===372
      &&initial.authenticatedOriginalDocuments===CERTIFIED_AUTHENTICATED_ORIGINALS
      &&initial.retrievedOriginalDocuments===240
      &&initial.acceptedSourceDayPeers===1619
      &&papers.length===CERTIFIED_KNOWN_BILL_PAPERS
      &&newBill.length===CERTIFIED_PRINTED_BILL_ASSOCIATIONS
      &&stageCountAudit(initial)
     ||replay&&prepared.length===0))
    throw Error('Entire original 150/372 original question and printed bill source proof drifted');
   // The printed bill correction is a scoped mutation of bill_id ONLY; the
   // source question/ballot action and exact link are atomically inserted
   // in the same SERIALIZABLE transaction. One failure rolls all back.
   safeProgress('certified_stage_distribution',{authorized:prepared.length});
   let completed=0;
   for(const p of prepared){
    try{
     if(p.original.resolution==='printed_bill')
      await attachStrictPrintedBill(db,p);
     await insertOne(db,p.link);
     completed++;
    }catch(error){
     const msg=error instanceof Error?error.message:'unknown';
     safeProgress('source_action_failed',{
      actionsCompleted:completed,
      acceptedFingerprintOrFullBallotDrift:Number(msg==='Official accepted identity or complete member choices changed'),
      conflictingLegacyQuestion:Number(msg==='Legacy linked original question conflicts with proven source roll'),
      originalSourceReceiptOrActionConflict:Number(msg==='Verified original distinct-question append-only action insert failed'),
      oneToOneEdgeConflict:Number(msg==='Original repeated question exact-event one-to-one CAS failed'),
      otherKnownGuard:Number(![
       'Official accepted identity or complete member choices changed',
       'Legacy linked original question conflicts with proven source roll',
       'Verified original distinct-question append-only action insert failed',
       'Original repeated question exact-event one-to-one CAS failed'
      ].includes(msg))
     });
     throw error;
    }
   }
   safeProgress('source_link_actions_prepared',{actions:prepared.length});
   const exactAfter=await count(db);
   if(exactAfter!==exactBefore+prepared.length)
    throw Error('Source-original orphan exact question links did not reconcile atomically');
   const postRows=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const postGap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(postGap,postRows);
   if(postGap.auditedEvents!==previous.auditedEvents||
    !officialOrphanJournalPopulationCertified(postGap))
    throw Error('Original orphan repair changed original Journal accepted population');
   safeProgress('official_exact_poststate',{exact:exactAfter,events:postGap.auditedEvents});
   const again=await readOrphanJournalOriginalAudit(db,postGap);
   if(again.eligibleKnownBillQuestions!==0||
    again.eligiblePrintedBillAssociations!==0)
    throw Error('Original orphan promoted question remains independently recoverable after atomic write');
   const postSource=await readSameSourceQuestionRows(db);
   const postSame=summarizeSameSourceFailures(postSource.votes,postSource.actions,postGap);
   if(postSame.candidateQuestionRechecks!==0||
    postSame.unlinkedWithExistingStoredLink!==0||
    postSame.sameSourceUnlinked>previous.auditedEvents)
    throw Error('Original orphan source actions exposed speculative exact question claims');
   safeProgress('all_source_checks_passed',{exactBefore,exactAfter});
   await db.query('COMMIT');
   return{
    schemaVersion:SENATE_ORPHAN_QUESTION_REPAIR,
    result:prepared.length?'linked_original_question_ballots':'already_applied',
    auditedSourceVotes:initial.targeted,
    authenticatedOriginals:initial.authenticatedOriginalDocuments,
    linkedMissingPaperQuestions:papers.length,
    correctedExplicitPrintedBillAssociations:newBill.length,
    originalQuestionActionsCreated:prepared.length,
    exactAcceptedLinksCreated:prepared.length,
    exactBefore,exactAfter,
    sameJournalUnlinkedBefore:sameBefore.sameSourceUnlinked,
    sameJournalUnlinkedAfter:postSame.sameSourceUnlinked,
    missingBillWithoutPaperBefore:initial.missingPaper,
    missingBillWithoutPaperAfter:again.missingPaper,
    unresolvedBillBefore:initial.unresolvedBill,
    unresolvedBillAfter:again.unresolvedBill,
    originalNamedVotesChanged:false,originalMotionTextChanged:false,
    originalSourceBodiesChanged:false,oldPaperActionsChanged:false,
    servingModelsChanged:false,completeAmendedStatesCertified:0
   };
  }catch(e){await db.query('ROLLBACK');throw e}
 }finally{db.release(true)}
}
