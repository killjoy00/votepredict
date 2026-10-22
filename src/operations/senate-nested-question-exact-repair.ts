/**
 * Append-only, original-government-source question links for the 31 unique
 * Senate nested-amendment roll calls missing from paper-v1.
 *
 * A nested amendment-to-amendment is NOT necessarily a bill amendment:
 * proposed_text remains NULL and no amended bill state is certified.
 * Only source-anchored QUESTION and FULL NAMED BALLOT can be linked.
 *
 * The guarded caller is main-only and authenticates the production Neon
 * primary, migration ledger, existing original government source receipts,
 * and exact merge marker. This module never modifies accepted votes,
 * member_votes, old paper actions, source documents or serving models.
 */
import type {Pool,PoolClient} from 'pg';
import {hash,compact,ballotSignature,rollMatches} from './senate-vote-paper-parser.js';
import type {AcceptedVote,ParsedAction} from './senate-same-source-question-census.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures}
 from './senate-same-source-question-census.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit}
 from './senate-vote-text-gap-audit.js';
import {
 readNoTallyOriginalCensus,
 type StrongNestedSourceQuestion,type NoTallyOriginalCensus
} from './senate-no-tally-original-census.js';

export const SENATE_NESTED_EXACT_REPAIR='senate-original-nested-question-link-v1' as const;
const SHA=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface StrictNestedQuestionLink {
 originalSourceId:string;originalSourceUrl:string;
 acceptedId:string;billId:string;bill:string;day:string;
 questionStart:number;questionEnd:number;sequence:number;actionKey:string;
 questionText:string;yeas:number;nays:number;ballot:string;
 acceptedMotion:string;
}
export interface NestedQuestionRepairResult {
 schemaVersion:typeof SENATE_NESTED_EXACT_REPAIR;
 result:'linked_verified_originals'|'already_applied';
 originalsInspected:number;candidateNestedQuestions:number;
 exactQuestionActionsCreated:number;exactVoteLinksCreated:number;
 exactLinksBefore:number;exactLinksAfter:number;
 unmatchedSourceDayBefore:number;unmatchedSourceDayAfter:number;
 missingTallyBefore:number;missingTallyAfter:number;
 unresolvedNestedRepeatedAccepted:number;
 unresolvedNestedDifferentQuestion:number;
 originalVoteEventsChanged:false;sourceDocumentsChanged:false;
 oldPaperActionsChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
function candidateActionKey(p:StrongNestedSourceQuestion['paper']):string {
 return hash(JSON.stringify(['original-nested-amendment-question-v1',p.sourceOnlyKey,
  p.questionStart,p.questionEnd,hash(p.questionText)]));
}
/** Original UTF-16 offsets are validated against the exact independently
 * authenticated source text in memory BEFORE any SQL write. Do not infer
 * any name, tally, accepted identity or parent amendment from proximity.
 */
export function strictNestedQuestionLinks(
 candidates:readonly StrongNestedSourceQuestion[]
):StrictNestedQuestionLink[]{
 const result:StrictNestedQuestionLink[]=[];
 for(const {vote:v,paper:p,originalDocument:d} of candidates){
  const text=d.body;
  if(!d.original_verified||d.source_type!=='mn_senate_journal'
   ||d.id!==v.source_id&&d.source_url!==v.source_url
   ||d.source_url!==v.source_url
   ||!UUID.test(d.id)||!UUID.test(v.id)||!UUID.test(v.bill_id)
   ||typeof text!=='string'||text.length<2000||text.length>8_000_000
   ||v.session==='2021-2022'&&v.day>='2023-01-01'
   ||!['2021-2022','2023-2024','2025-2026'].includes(v.session)
   ||!/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/.test(d.source_url)
   ||!SHA.test(p.sourceOnlyKey)||!SHA.test(p.literalSha256)
   ||!SHA.test(p.ballotSha256??'')
   ||p.billIdentifier!==v.bill||v.vote_kind!=='amendment'
   ||v.exact_linked||v.stored_link
   ||p.appliesDirectlyToBill!==false||p.fullBillTextAssembled!==false
   ||p.acceptedVoteEventLinked!==false||p.exactNumberedParentProven!==false
   ||!Number.isInteger(p.sourceStart)||!Number.isInteger(p.sourceEnd)
   ||!Number.isInteger(p.questionStart)||!Number.isInteger(p.questionEnd)
   ||p.sourceStart<0||p.sourceEnd<=p.sourceStart
   ||p.questionStart<p.sourceEnd||p.questionEnd<=p.questionStart
   ||p.questionEnd>text.length||p.literalText.length>150_000
   ||text.slice(p.sourceStart,p.sourceEnd)!==p.literalText
   ||hash(p.literalText)!==p.literalSha256
   ||hash(JSON.stringify([p.sourceStart,p.sourceEnd,p.literalSha256]))!==p.sourceOnlyKey
   ||text.slice(p.questionStart,p.questionEnd).trim()!==text.slice(p.questionStart,p.questionEnd)
   ||compact(text.slice(p.questionStart,p.questionEnd))!==p.questionText
   ||p.yeas!==v.yea_count||p.nays!==v.nay_count
   ||p.yeas===null||p.nays===null
   ||ballotSignature(v.votes,v.yea_count,v.nay_count)!==p.ballotSha256
   ||!rollMatches({billIdentifier:p.billIdentifier,questionText:p.questionText,
    yeas:p.yeas,nays:p.nays,ballotSignature:p.ballotSha256} as Parameters<typeof rollMatches>[0],
    {billIdentifier:v.bill,motionText:v.motion_text,
     yeas:v.yea_count,nays:v.nay_count,ballotSignature:p.ballotSha256})
   )
   throw Error('Original nested paper failed immutable question, ballot, source or accepted-vote proof');
  const sequence=100_000+p.questionStart;
  if(sequence>2147483647)throw Error('Original nested question sequence outside SQL bounds');
  result.push({originalSourceId:d.id,originalSourceUrl:d.source_url,
   acceptedId:v.id,billId:v.bill_id,bill:v.bill,day:v.day,
   questionStart:p.questionStart,questionEnd:p.questionEnd,
   sequence,actionKey:candidateActionKey(p),questionText:p.questionText,
   yeas:p.yeas,nays:p.nays,ballot:p.ballotSha256!,acceptedMotion:v.motion_text});
 }
 if(new Set(result.map(x=>x.acceptedId)).size!==result.length
  ||new Set(result.map(x=>JSON.stringify([
   x.originalSourceId,x.actionKey,x.questionStart,x.questionEnd
  ]))).size!==result.length)
  throw Error('Original nested source or accepted vote attempted repeated question promotion');
 return result;
}
async function oneExactLink(db:PoolClient,p:StrictNestedQuestionLink):Promise<void>{
 const accepted=(await db.query<{
  fingerprint:string; votes:Array<{name:string;choice:string}>;
 }>([
  'SELECT senate_vote_paper_event_fingerprint(v.id) AS fingerprint,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',mv.source_member_name,",
  "'choice',mv.choice)) FROM member_votes mv WHERE mv.vote_event_id=v.id),'[]'::jsonb) AS votes",
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  'JOIN bills b ON b.id=v.bill_id',
  'WHERE v.id=$1::uuid AND v.bill_id=$2::uuid AND v.occurred_on=$3::date',
  "AND v.vote_kind='amendment' AND v.yea_count=$4 AND v.nay_count=$5",
  'AND v.motion_text=$6 AND b.identifier=$7 AND d.source_url=$8',
  'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links l',
  'WHERE l.vote_event_id=v.id)',
  'FOR UPDATE OF v'
 ].join(' '),[p.acceptedId,p.billId,p.day,p.yeas,p.nays,
  p.acceptedMotion,p.bill,p.originalSourceUrl])).rows;
 if(accepted.length!==1||!SHA.test(accepted[0]!.fingerprint)
  ||ballotSignature(accepted[0]!.votes,p.yeas,p.nays)!==p.ballot)
  throw Error('Accepted nested amendment original identity or full named roll changed');
 const inserted=await db.query<{id:string}>([
  'INSERT INTO senate_vote_paper_actions(',
  'source_document_id,source_payload_sha256,parser_version,action_key,',
  'sequence,source_start,source_end,bill_id,occurred_on,kind,motion_text,',
  'question_text,proposed_text,proposal_capture_id,explicit_base_locator,',
  'outcome,prior_adopted_action_keys,yea_count,nay_count,ballot_sha256)',
  'SELECT d.id,',
  "encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex'),",
  "'senate-journal-paper-v1',$1,$2,$3,$4,$5::uuid,$6::date,'amendment',$7,$7,",
  "NULL,NULL,NULL,'unknown','[]'::jsonb,$8,$9,$10",
  'FROM source_documents d',
  'WHERE d.id=$11::uuid AND d.source_url=$12',
  "AND d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'",
  'AND EXISTS(SELECT 1 FROM senate_paper_source_verifications proof',
  'WHERE proof.source_document_id=d.id AND proof.source_url=d.source_url',
  "AND proof.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
  'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_actions a',
  'WHERE a.source_document_id=d.id AND a.action_key=$1)',
  'RETURNING id::text'
 ].join(' '),[
  p.actionKey,p.sequence,p.questionStart,p.questionEnd,
  p.billId,p.day,p.questionText,p.yeas,p.nays,p.ballot,
  p.originalSourceId,p.originalSourceUrl
 ]);
 if(inserted.rowCount!==1||!UUID.test(inserted.rows[0]?.id??''))
  throw Error('Authenticated original nested question was not append-only inserted');
 const link=await db.query([
  'INSERT INTO senate_vote_paper_event_links',
  '(action_id,vote_event_id,vote_identity_sha256,method)',
  "SELECT $1::uuid,$2::uuid,$3,'unique_question_full_ballot'",
  'WHERE NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links e',
  'WHERE e.action_id=$1::uuid OR e.vote_event_id=$2::uuid)',
  'RETURNING action_id'
 ].join(' '),[inserted.rows[0]!.id,p.acceptedId,accepted[0]!.fingerprint]);
 if(link.rowCount!==1)throw Error('Original nested question accepted-vote collision; rollback all');
}
async function countExact(db:PoolClient):Promise<number>{
 return (await db.query<{n:number}>(
  'SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v'
 )).rows[0]?.n??-1;
}
/** Either promote exactly the 31 independently source-verified missing
 * nested questions or perform a strict no-op after their promotion. The
 * entire batch is SERIALIZABLE and atomic.
 */
export async function repairNestedSenateExactLinks(pool:Pool):Promise<NestedQuestionRepairResult>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-2023-2024-nested-question-link'))");
   const beforeEvents=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const beforeGap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(beforeGap,beforeEvents);
   const rows=await readSameSourceQuestionRows(db);
   const before=summarizeSameSourceFailures(rows.votes,rows.actions,beforeGap);
   const originalMissing=before.totals.no_matching_tally;
   const exactBefore=await countExact(db);
   // Both authenticated post-raw and post-repeated-original-question states
   // are accepted as strict idempotent no-ops for this 31-link cohort.
   const afterRaw=((exactBefore===1111&&before.sameSourceUnlinked===476)
    ||(exactBefore===1175&&before.sameSourceUnlinked===412)
    ||(exactBefore===1200&&before.sameSourceUnlinked===387))
    &&originalMissing>=0&&originalMissing<=61;
   if(!((exactBefore===991&&before.sameSourceUnlinked===596&&originalMissing===181)
    ||(exactBefore===1022&&before.sameSourceUnlinked===565&&originalMissing===150)
    ||afterRaw))
    throw Error('Protected nested question exact-link baseline differs from authenticated 181-tally receipt');
   const eligible:StrongNestedSourceQuestion[]=[];
   const census:NoTallyOriginalCensus=await readNoTallyOriginalCensus(
    db,rows.votes,rows.actions,before,c=>eligible.push(c));
   const pairs=strictNestedQuestionLinks(eligible);
   if(census.originalSameSourceUnlinked!==before.sameSourceUnlinked
    ||pairs.length!==census.nestedStrongSourceUniqueCandidates
    ||census.nestedSourceBallotRepeated!==0
    ||census.nestedConflictingV1PaperBallot!==0
    ||census.nestedOriginalPrintedSpanInvalid!==0
    ||(afterRaw
      ?census.stages.nested_repeated_accepted_ballot>15||census.stages.nested_different_question>9
      :census.stages.nested_repeated_accepted_ballot!==15||census.stages.nested_different_question!==9)
    ||!((exactBefore===991&&pairs.length===31
      &&census.nestedUniqueQuestionBallotCandidates===31
      &&census.sourceDocumentsInspected===68)
      ||((exactBefore===1022||afterRaw)&&pairs.length===0
      &&census.nestedUniqueQuestionBallotCandidates===0)))
    throw Error('Original SOURCE-SIDE unique nested full-ballot/canonical question proof failed');
   for(const p of pairs)await oneExactLink(db,p);
   const exactAfter=await countExact(db);
   if(exactAfter!==exactBefore+pairs.length)
    throw Error('Original nested question accepted-link count did not equal exactly promoted proof count');
   const afterEvents=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const afterGap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(afterGap,afterEvents);
   const fresh=await readSameSourceQuestionRows(db);
   const after=summarizeSameSourceFailures(fresh.votes,fresh.actions,afterGap);
   if(after.sameSourceUnlinked!==before.sameSourceUnlinked-pairs.length
    ||after.totals.no_matching_tally!==originalMissing-pairs.length
    ||after.candidateQuestionRechecks!==0
    ||after.unlinkedWithExistingStoredLink!==0)
    throw Error('Independent post-write entire source-question population reconciliation failed');
   await db.query('COMMIT');
   return {
    schemaVersion:SENATE_NESTED_EXACT_REPAIR,
    result:pairs.length?'linked_verified_originals':'already_applied',
    originalsInspected:census.sourceDocumentsInspected,
    candidateNestedQuestions:pairs.length,
    exactQuestionActionsCreated:pairs.length,
    exactVoteLinksCreated:pairs.length,
    exactLinksBefore:exactBefore,exactLinksAfter:exactAfter,
    unmatchedSourceDayBefore:before.sameSourceUnlinked,
    unmatchedSourceDayAfter:after.sameSourceUnlinked,
    missingTallyBefore:originalMissing,missingTallyAfter:after.totals.no_matching_tally,
    unresolvedNestedRepeatedAccepted:census.stages.nested_repeated_accepted_ballot,
    unresolvedNestedDifferentQuestion:census.stages.nested_different_question,
    originalVoteEventsChanged:false,sourceDocumentsChanged:false,
    oldPaperActionsChanged:false,servingModelsChanged:false,
    completeAmendedBillStatesCertified:0
   };
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
