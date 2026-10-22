/**
 * #1498: unique ORIGINAL full-question + complete named ballot exact links
 * for the 62 same-Journal/day/bill v1 PAPER named-ballot mismatch cohort.
 *
 * The stored v1 named ballot is NOT rewritten. The original full PDF-extract
 * source question/header/member roll must independently agree with the
 * accepted complete named ballot uniquely across the entire physical Journal
 * and ALL accepted events on the original source/day, other bills included.
 *
 * Fail-closed atomic append-only transaction: never infer from a count,
 * approximate spelling, roll order, historic motion outcome or amended text.
 */
import type {Pool,PoolClient} from 'pg';
import {readVoteTextGapAudit,verifyVoteTextGapAudit} from './senate-vote-text-gap-audit.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures}
 from './senate-same-source-question-census.js';
import {readNamedMismatchOriginalAudit}
 from './senate-named-mismatch-original-audit.js';
import {strictRepeatedOriginalQuestionLinks,insertOne}
 from './senate-repeated-paper-exact-repair.js';
import type {UniqueOriginalRoll}
 from './senate-repeated-paper-original-roll-audit.js';

export const SENATE_NAMED_MISMATCH_EXACT_REPAIR=
 'senate-original-full-named-ballot-mismatch-exact-links-v1' as const;
/** These values are deliberately BLOCKING until independently certified by
 * protected READ ONLY original-source run #39835363900. Not a release plan.
 */
const PROVEN_MATCHES=0;
const PROVEN_ORIGINAL_DOCUMENTS=0;
const REVIEWED_HELD_STAGE_COUNTS:Readonly<Record<string,number>>={};
export interface NamedMismatchExactRepairResult{
 schemaVersion:typeof SENATE_NAMED_MISMATCH_EXACT_REPAIR;
 result:'linked_verified_originals'|'already_applied';
 authenticatedOriginalSources:number;
 originalNamedMismatchVotesInspected:number;
 sourceUniqueOriginalQuestions:number;
 appendedOriginalQuestionActions:number;
 appendedExactVoteLinks:number;
 exactBefore:number;exactAfter:number;
 sameJournalUnlinkedBefore:number;sameJournalUnlinkedAfter:number;
 namedMismatchBefore:number;namedMismatchAfter:number;
 originalOfficialVotesChanged:false;
 originalSourceDocumentsChanged:false;
 olderPaperActionsChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
async function countExact(db:PoolClient):Promise<number>{
 return (await db.query<{n:number}>(
  'SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v'
 )).rows[0]?.n??-1;
}
export async function repairNamedMismatchOriginalSenateQuestions(
 pool:Pool
):Promise<NamedMismatchExactRepairResult>{
 if(PROVEN_MATCHES<1||PROVEN_MATCHES>62||PROVEN_ORIGINAL_DOCUMENTS<1
  ||PROVEN_ORIGINAL_DOCUMENTS>220
  ||Object.keys(REVIEWED_HELD_STAGE_COUNTS).length===0)
  throw Error('Protected original 62-case named-ballot repair has no reviewed source proof');
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-original-question-links'))");
   const events=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const gap=await readVoteTextGapAudit(db);verifyVoteTextGapAudit(gap,events);
   const rows=await readSameSourceQuestionRows(db);
   const before=summarizeSameSourceFailures(rows.votes,rows.actions,gap);
   const exactBefore=await countExact(db);
   const first=exactBefore===1200&&before.sameSourceUnlinked===387
    &&before.totals.full_named_ballot_mismatch===62
    &&before.totals.paper_ballot_absent===56
    &&before.totals.no_matching_tally===61
    &&before.totals.ballot_repeated_across_papers===151
    &&before.totals.ballot_repeated_across_votes===55;
   const replay=exactBefore===1200+PROVEN_MATCHES
    &&before.sameSourceUnlinked===387-PROVEN_MATCHES
    &&before.totals.no_matching_tally<=61
    &&before.totals.paper_ballot_absent<=56
    &&before.totals.full_named_ballot_mismatch<=62;
   if(!first&&!replay)
    throw Error('Original named-ballot mismatch repair official population baseline drifted');
   const proofs:UniqueOriginalRoll[]=[];
   const original=await readNamedMismatchOriginalAudit(
    db,rows.votes,rows.actions,before,p=>proofs.push(p));
   const candidates=strictRepeatedOriginalQuestionLinks(proofs);
   if(original.mismatchAcceptedVotes!==before.totals.full_named_ballot_mismatch
    ||original.sourceUniqueNamedBallotCandidates!==proofs.length
    ||proofs.length!==candidates.length
    ||(first&&(original.authenticatedOriginalDocuments!==PROVEN_ORIGINAL_DOCUMENTS
      ||original.mismatchAcceptedVotes!==62
      ||original.sourceUniqueNamedBallotCandidates!==PROVEN_MATCHES
      ||Object.entries(REVIEWED_HELD_STAGE_COUNTS).some(([key,expected])=>
       original.stages[key as keyof typeof original.stages]!==expected)))
    ||(replay&&candidates.length!==0))
    throw Error('Authenticated original 62-case complete named-ballot mismatch source proof drifted');
   for(const p of candidates)await insertOne(db,p);
   const exactAfter=await countExact(db);
   if(exactAfter!==exactBefore+candidates.length)
    throw Error('Original named-ballot exact link count differs from authenticated proofs');
   const afterEvents=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const afterGap=await readVoteTextGapAudit(db);verifyVoteTextGapAudit(afterGap,afterEvents);
   const next=await readSameSourceQuestionRows(db);
   const post=summarizeSameSourceFailures(next.votes,next.actions,afterGap);
   if(post.sameSourceUnlinked!==before.sameSourceUnlinked-candidates.length
    ||post.candidateQuestionRechecks!==0
    ||post.unlinkedWithExistingStoredLink!==0)
    throw Error('Original named-ballot repair entire Senate accepted vote denominator drifted');
   const postOriginal=await readNamedMismatchOriginalAudit(
    db,next.votes,next.actions,post);
   if(postOriginal.sourceUniqueNamedBallotCandidates!==0)
    throw Error('Post-commit original named-ballot candidate remains unpromoted');
   await db.query('COMMIT');
   return{
    schemaVersion:SENATE_NAMED_MISMATCH_EXACT_REPAIR,
    result:candidates.length?'linked_verified_originals':'already_applied',
    authenticatedOriginalSources:original.authenticatedOriginalDocuments,
    originalNamedMismatchVotesInspected:original.mismatchAcceptedVotes,
    sourceUniqueOriginalQuestions:candidates.length,
    appendedOriginalQuestionActions:candidates.length,
    appendedExactVoteLinks:candidates.length,
    exactBefore,exactAfter,
    sameJournalUnlinkedBefore:before.sameSourceUnlinked,
    sameJournalUnlinkedAfter:post.sameSourceUnlinked,
    namedMismatchBefore:before.totals.full_named_ballot_mismatch,
    namedMismatchAfter:post.totals.full_named_ballot_mismatch,
    originalOfficialVotesChanged:false,originalSourceDocumentsChanged:false,
    olderPaperActionsChanged:false,servingModelsChanged:false,
    completeAmendedBillStatesCertified:0
   };
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
