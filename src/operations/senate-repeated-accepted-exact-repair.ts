/**
 * #1498: serializable, append-only Senate exact question links when TWO
 * accepted events have the same full named ballot but different uniquely
 * printed ORIGINAL Journal questions. No tally, chronology, proximity, old
 * v1 paper motion or ballot alone is used to choose an event.
 *
 * No modification to accepted vote/member choices, preexisting paper actions,
 * original source bodies, bill text states, forecasts or serving models.
 */
import type {Pool,PoolClient} from 'pg';
import {readVoteTextGapAudit,verifyVoteTextGapAudit} from './senate-vote-text-gap-audit.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures}
 from './senate-same-source-question-census.js';
import {readRepeatedAcceptedOriginalAudit,type UniqueAcceptedOriginalRoll}
 from './senate-repeated-accepted-original-audit.js';
import {readRepeatedOriginalRollAudit}
 from './senate-repeated-paper-original-roll-audit.js';
import {strictRepeatedOriginalQuestionLinks,insertOne}
 from './senate-repeated-paper-exact-repair.js';

export const SENATE_REPEATED_ACCEPTED_REPAIR=
 'senate-original-repeated-accepted-question-link-v1' as const;
// Fill from independently protected READ ONLY 85-case audit before merge.
// ZERO is never authorized for a production new-link release.
const REVIEWED_SOURCE_UNIQUE_CANDIDATES=0;
const REVIEWED_ORIGINAL_DOCUMENTS=0;
export interface RepeatedAcceptedRepairResult {
 schemaVersion:typeof SENATE_REPEATED_ACCEPTED_REPAIR;
 result:'linked_verified_originals'|'already_applied';
 originalSourcesInspected:number;reviewedAcceptedCollisionVotes:number;
 sourceUniqueQuestionMatches:number;sourceQuestionActionsCreated:number;
 exactVoteLinksCreated:number;
 exactBefore:number;exactAfter:number;
 sameJournalUnlinkedBefore:number;sameJournalUnlinkedAfter:number;
 acceptedRepeatBefore:number;acceptedRepeatAfter:number;
 paperRepeatBefore:number;paperRepeatAfter:number;
 originalVoteEventsChanged:false;sourceDocumentsChanged:false;
 oldPaperActionsChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
async function countExact(db:PoolClient):Promise<number>{
 return (await db.query<{n:number}>(
  'SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v'
 )).rows[0]?.n??-1;
}
/** Fail shut against a different primary/source population; the entire batch
 * rolls back if any original physical question or accepted event changes.
 */
export async function repairRepeatedAcceptedSenateQuestions(pool:Pool):Promise<RepeatedAcceptedRepairResult>{
 if(REVIEWED_SOURCE_UNIQUE_CANDIDATES<=0||REVIEWED_SOURCE_UNIQUE_CANDIDATES>85
  ||REVIEWED_ORIGINAL_DOCUMENTS<=0||REVIEWED_ORIGINAL_DOCUMENTS>220)
  throw Error('Original source-unique repeated accepted question repair has no independently certified cohort');
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
   const first=exactBefore===1175&&before.sameSourceUnlinked===412
    &&before.totals.ballot_repeated_across_votes===85
    &&before.totals.ballot_repeated_across_papers===146
    &&before.totals.no_matching_tally===61;
   const repeat=exactBefore===1175+REVIEWED_SOURCE_UNIQUE_CANDIDATES
    &&before.sameSourceUnlinked===412-REVIEWED_SOURCE_UNIQUE_CANDIDATES
    &&before.totals.no_matching_tally===61;
   if(!first&&!repeat)throw Error('Repeated accepted source question protected baseline drifted');
   const proofs:UniqueAcceptedOriginalRoll[]=[];
   const audit=await readRepeatedAcceptedOriginalAudit(
    db,rows.votes,rows.actions,before,p=>proofs.push(p));
   const pairs=strictRepeatedOriginalQuestionLinks(proofs);
   if(audit.repeatedAcceptedBallotVotes!==before.totals.ballot_repeated_across_votes
    ||audit.sourceAndAcceptedUniqueCandidates!==proofs.length
    ||pairs.length!==proofs.length
    ||!((first&&audit.originalsInspected===REVIEWED_ORIGINAL_DOCUMENTS
      &&audit.repeatedAcceptedBallotVotes===85
      &&pairs.length===REVIEWED_SOURCE_UNIQUE_CANDIDATES)
     ||(repeat&&pairs.length===0)))
    throw Error('Independent original source+accepted unique printed-question proof drifted');
   for(const p of pairs)await insertOne(db,p);
   const exactAfter=await countExact(db);
   if(exactAfter!==exactBefore+pairs.length)
    throw Error('New accepted-side exact question links differ from original source proofs');
   const afterEvents=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const afterGap=await readVoteTextGapAudit(db);verifyVoteTextGapAudit(afterGap,afterEvents);
   const next=await readSameSourceQuestionRows(db);
   const nextCensus=summarizeSameSourceFailures(next.votes,next.actions,afterGap);
   if(nextCensus.sameSourceUnlinked!==before.sameSourceUnlinked-pairs.length
    ||nextCensus.totals.no_matching_tally!==before.totals.no_matching_tally
    ||nextCensus.candidateQuestionRechecks!==0
    ||nextCensus.unlinkedWithExistingStoredLink!==0)
    throw Error('Accepted-side question full-population post-write parity drifted');
   const postAudit=await readRepeatedAcceptedOriginalAudit(
    db,next.votes,next.actions,nextCensus);
   if(postAudit.sourceAndAcceptedUniqueCandidates!==0)
    throw Error('Remaining accepted-side question recovery not idempotently exhausted');
   // Newly appended question-only papers can reclassify sibling votes from
   // repeated-accepted to repeated-paper. Verify no newly source-unique
   // repeated-paper question remains, or roll the ENTIRE 85-side batch back.
   const existingPaperAudit=await readRepeatedOriginalRollAudit(
    db,next.votes,next.actions,nextCensus);
   if(existingPaperAudit.sourceUniqueQuestionBallotCandidates!==0)
    throw Error('Accepted-side additions exposed an unpromoted original paper question');
   await db.query('COMMIT');
   return {
    schemaVersion:SENATE_REPEATED_ACCEPTED_REPAIR,
    result:pairs.length?'linked_verified_originals':'already_applied',
    originalSourcesInspected:audit.originalsInspected,
    reviewedAcceptedCollisionVotes:audit.repeatedAcceptedBallotVotes,
    sourceUniqueQuestionMatches:pairs.length,
    sourceQuestionActionsCreated:pairs.length,exactVoteLinksCreated:pairs.length,
    exactBefore,exactAfter,
    sameJournalUnlinkedBefore:before.sameSourceUnlinked,
    sameJournalUnlinkedAfter:nextCensus.sameSourceUnlinked,
    acceptedRepeatBefore:before.totals.ballot_repeated_across_votes,
    acceptedRepeatAfter:nextCensus.totals.ballot_repeated_across_votes,
    paperRepeatBefore:before.totals.ballot_repeated_across_papers,
    paperRepeatAfter:nextCensus.totals.ballot_repeated_across_papers,
    originalVoteEventsChanged:false,sourceDocumentsChanged:false,
    oldPaperActionsChanged:false,servingModelsChanged:false,
    completeAmendedBillStatesCertified:0
   };
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
