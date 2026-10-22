/**
 * Promote only the independently proven ORIGINAL full-question + named-ballot
 * Senate rolls from #1498's 210 duplicated-paper cohort.
 *
 * The original PDF-extract roster, every physical roll and BOTH sides of
 * source-day question+ballot uniqueness are independently replayed inside
 * the same SERIALIZABLE transaction before any append-only source question
 * action or accepted-event link. Existing v1 papers, votes, source bodies,
 * forecasts, roles, amendment outcomes and bill states are NEVER modified.
 */
import type {Pool,PoolClient} from 'pg';
import {ballotSignature,billIdentifier,compact,hash} from './senate-vote-paper-parser.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit} from './senate-vote-text-gap-audit.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures}
 from './senate-same-source-question-census.js';
import {readRepeatedOriginalRollAudit,type UniqueOriginalRoll}
 from './senate-repeated-paper-original-roll-audit.js';

export const SENATE_REPEATED_ORIGINAL_EXACT_REPAIR='senate-original-duplicate-ballot-distinct-question-link-v1' as const;
const SHA=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface StrictRepeatedOriginalLink {
 originalSourceId:string;sourceUrl:string;originalTextSha:string;
 acceptedId:string;billId:string;bill:string;day:string;voteKind:string;
 actionKind:'amendment'|'passage'|'procedural';
 questionStart:number;rollStart:number;rollOrdinal:number;sequence:number;
 actionKey:string;printedQuestion:string;acceptedMotion:string;
 yeas:number;nays:number;ballot:string;
}
export interface RepeatedOriginalRepairResult {
 schemaVersion:typeof SENATE_REPEATED_ORIGINAL_EXACT_REPAIR;
 result:'linked_verified_originals'|'already_applied';
 sourceDocumentsInspected:number;duplicatePaperVotesInspected:number;
 uniqueOriginalQuestions:number;sourceQuestionActionsCreated:number;
 exactVoteLinksCreated:number;exactBefore:number;exactAfter:number;
 sameJournalUnlinkedBefore:number;sameJournalUnlinkedAfter:number;
 repeatedPapersBefore:number;repeatedPapersAfter:number;
 repeatedOriginalQuestionHolds:number;unprovenOriginalQuestionHolds:number;
 originalVoteEventsChanged:false;sourceDocumentsChanged:false;
 oldPaperActionsChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
function kind(v:string):StrictRepeatedOriginalLink['actionKind']{
 if(v==='amendment')return 'amendment';
 if(v==='passage')return 'passage';
 if(v==='motion'||v==='other')return 'procedural';
 throw Error('Unsupported original Senate question vote kind');
}
function fullQuestion(text:string):string {
 const ms=[...text.matchAll(/The question (?:was taken|recurred)/gi)];
 return compact(ms.length?text.slice(ms.at(-1)!.index):text);
}
/**
 * Re-bind independently replayed unique original physical roll to immutable
 * UTF-16 question/header positions, the exact original extracted body and
 * accepted full named ballot. Do not collapse to the old first-800-character
 * questionCore or treat source/accepted duplicate ballots as the same event.
 */
export function strictRepeatedOriginalQuestionLinks(
 proofs:readonly UniqueOriginalRoll[]
):StrictRepeatedOriginalLink[]{
 const result:StrictRepeatedOriginalLink[]=[];
 for(const p of proofs){
  const v=p.vote,d=p.source,body=d.body;
  const printed=typeof body==='string'
   &&Number.isSafeInteger(p.questionStart)&&Number.isSafeInteger(p.rollStart)
   &&p.questionStart>=0&&p.rollStart>p.questionStart&&p.rollStart<=body.length
   ?compact(body.slice(p.questionStart,p.rollStart)):null;
  const header=typeof body==='string'&&p.rollStart>=0
   ?body.slice(p.rollStart,p.rollStart+160):'';
  const h=/^The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:/i.exec(header);
  const context=typeof body==='string'&&p.rollStart>=0
   ?body.slice(Math.max(0,p.rollStart-2600),p.rollStart):'';
  const sourceBill=[...context.matchAll(/(?:S\.?F\.?|H\.?F\.?)\s*(?:No\.?)?\s*\d+/gi)].at(-1);
  const sig=ballotSignature(v.votes,v.yea_count,v.nay_count);
  if(!d.original_verified||d.source_type!=='mn_senate_journal'
   ||!/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/.test(d.source_url)
   ||d.source_url!==v.source_url
   ||!UUID.test(d.id)||!UUID.test(v.id)||!UUID.test(v.bill_id)
   ||!['2021-2022','2023-2024','2025-2026'].includes(v.session)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day)
   ||!(d.source_url.split('/').at(-1)??'').startsWith(v.day.replace(/-/g,''))
   ||!/^([HS]F)[1-9]\d{0,5}$/.test(v.bill)
   ||!body||typeof body!=='string'||body.length<2000||body.length>8_000_000
   ||body.includes('\r')||!SHA.test(p.originalTextSha)
   ||hash(body)!==p.originalTextSha
   ||!Number.isInteger(p.rollOrdinal)||p.rollOrdinal<1||p.rollOrdinal>600
   ||!Number.isInteger(p.questionStart)||!Number.isInteger(p.rollStart)
   ||p.questionStart<0||p.rollStart<=p.questionStart||p.rollStart>body.length
   ||p.rollStart-p.questionStart>2600||!h
   ||Number(h[1])!==v.yea_count||Number(h[2])!==v.nay_count
   ||printed===null||printed!==p.printedQuestion
   ||printed.length<40||printed.length>2600
   ||!/^The question (?:was taken|recurred)\b/i.test(printed)
   ||printed.includes('The roll was called,')
   ||/JOURNAL OF THE SENATE|\d{1,3}(?:ST|ND|RD|TH) DAY\]/i.test(printed)
   ||fullQuestion(printed)!==fullQuestion(v.motion_text)
   ||billIdentifier(sourceBill?.[0]??'')!==v.bill
   ||v.exact_linked||v.stored_link
   ||sig===null||!SHA.test(sig)||sig!==p.ballot
   )throw Error('Original repeated paper source question, printed bill/header or accepted identity proof failed');
  const sequence=300_000+p.questionStart;
  if(sequence>2147483647)throw Error('Original repeated-paper question SQL sequence overflow');
  result.push({
   originalSourceId:d.id,sourceUrl:d.source_url,originalTextSha:p.originalTextSha,
   acceptedId:v.id,billId:v.bill_id,bill:v.bill,day:v.day,voteKind:v.vote_kind,
   actionKind:kind(v.vote_kind),questionStart:p.questionStart,rollStart:p.rollStart,
   rollOrdinal:p.rollOrdinal,sequence,
   actionKey:hash(JSON.stringify(['duplicate-ballot-original-distinct-question-v1',
    d.id,p.rollOrdinal,p.questionStart,p.rollStart,hash(printed),sig])),
   printedQuestion:printed,acceptedMotion:v.motion_text,
   yeas:v.yea_count,nays:v.nay_count,ballot:sig
  });
 }
 if(new Set(result.map(x=>x.acceptedId)).size!==result.length
  ||new Set(result.map(x=>JSON.stringify([x.originalSourceId,x.rollOrdinal,x.rollStart]))).size!==result.length
  ||new Set(result.map(x=>JSON.stringify([x.originalSourceId,x.questionStart,x.printedQuestion,x.ballot]))).size!==result.length
  ||new Set(result.map(x=>JSON.stringify([x.sourceUrl,x.day,x.printedQuestion,x.ballot]))).size!==result.length
  ||new Set(result.map(x=>x.actionKey)).size!==result.length)
  throw Error('Repeated original question/source roll or accepted event promoted twice');
 return result;
}
export async function insertOne(db:PoolClient,p:StrictRepeatedOriginalLink):Promise<void>{
 const accepted=(await db.query<{
  fingerprint:string;votes:Array<{name:string;choice:string}>;
 }>([
  'SELECT senate_vote_paper_event_fingerprint(v.id) AS fingerprint,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',mv.source_member_name,",
  "'choice',mv.choice)) FROM member_votes mv WHERE mv.vote_event_id=v.id),'[]'::jsonb) AS votes",
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  'JOIN bills b ON b.id=v.bill_id',
  'WHERE v.id=$1::uuid AND v.bill_id=$2::uuid AND v.occurred_on=$3::date',
  'AND v.vote_kind=$4 AND v.yea_count=$5 AND v.nay_count=$6',
  'AND v.motion_text=$7 AND b.identifier=$8 AND d.source_url=$9',
  'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links l WHERE l.vote_event_id=v.id)',
  'FOR UPDATE OF v'
 ].join(' '),[
  p.acceptedId,p.billId,p.day,p.voteKind,p.yeas,p.nays,
  p.acceptedMotion,p.bill,p.sourceUrl
 ])).rows;
 if(accepted.length!==1||!SHA.test(accepted[0]!.fingerprint)
  ||ballotSignature(accepted[0]!.votes,p.yeas,p.nays)!==p.ballot)
  throw Error('Official accepted identity or complete member choices changed');
 // Confirm that the original question is not already attached to an
 // accepted event via another legacy paper under this source/day. The
 // underlying duplicate named ballots alone are *not* a collision.
 const conflicting=(await db.query<{count:number}>([
  'SELECT count(*)::int AS count FROM senate_vote_paper_event_links e',
  'JOIN senate_vote_paper_actions a ON a.id=e.action_id',
  'JOIN source_documents s ON s.id=a.source_document_id',
  'WHERE s.source_url=$1 AND a.occurred_on=$2::date',
  'AND a.yea_count=$3 AND a.nay_count=$4 AND a.ballot_sha256=$5',
  'AND a.question_text=$6 AND e.vote_event_id<>$7::uuid'
 ].join(' '),[
  p.sourceUrl,p.day,p.yeas,p.nays,p.ballot,p.printedQuestion,p.acceptedId
 ])).rows[0]?.count??-1;
 if(conflicting!==0)throw Error('Legacy linked original question conflicts with proven source roll');
 const inserted=await db.query<{id:string}>([
  'INSERT INTO senate_vote_paper_actions(',
  'source_document_id,source_payload_sha256,parser_version,action_key,',
  'sequence,source_start,source_end,bill_id,occurred_on,kind,motion_text,',
  'question_text,proposed_text,proposal_capture_id,explicit_base_locator,',
  'outcome,prior_adopted_action_keys,yea_count,nay_count,ballot_sha256)',
  'SELECT d.id,',
  "encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex'),",
  "'senate-journal-paper-v1',$1,$2,$3,$4,$5::uuid,$6::date,$7,$8,$8,",
  "NULL,NULL,NULL,'unknown','[]'::jsonb,$9,$10,$11",
  'FROM source_documents d WHERE d.id=$12::uuid AND d.source_url=$13',
  "AND d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'",
  "AND encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex')=$14",
  'AND EXISTS(SELECT 1 FROM senate_paper_source_verifications proof',
  'WHERE proof.source_document_id=d.id AND proof.source_url=d.source_url',
  'AND proof.extracted_text_sha256=$14)',
  'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_actions a',
  'WHERE a.source_document_id=d.id AND a.action_key=$1)',
  'RETURNING id::text'
 ].join(' '),[
  p.actionKey,p.sequence,p.questionStart,p.rollStart,p.billId,p.day,
  p.actionKind,p.printedQuestion,p.yeas,p.nays,p.ballot,
  p.originalSourceId,p.sourceUrl,p.originalTextSha
 ]);
 if(inserted.rowCount!==1||!UUID.test(inserted.rows[0]?.id??''))
  throw Error('Verified original distinct-question append-only action insert failed');
 const linked=await db.query([
  'INSERT INTO senate_vote_paper_event_links',
  '(action_id,vote_event_id,vote_identity_sha256,method)',
  "SELECT $1::uuid,$2::uuid,$3,'unique_question_full_ballot'",
  'WHERE NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links e',
  'WHERE e.action_id=$1::uuid OR e.vote_event_id=$2::uuid)',
  'RETURNING action_id'
 ].join(' '),[inserted.rows[0]!.id,p.acceptedId,accepted[0]!.fingerprint]);
 if(linked.rowCount!==1)throw Error('Original repeated question exact-event one-to-one CAS failed');
}
async function exactCount(db:PoolClient):Promise<number>{
 return (await db.query<{n:number}>(
  'SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v'
 )).rows[0]?.n??-1;
}
export async function repairRepeatedOriginalSenateQuestions(pool:Pool):Promise<RepeatedOriginalRepairResult>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-original-question-links'))");
   const events=(await db.query('SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind')).rows;
   const gap=await readVoteTextGapAudit(db);verifyVoteTextGapAudit(gap,events);
   const rows=await readSameSourceQuestionRows(db);
   const census=summarizeSameSourceFailures(rows.votes,rows.actions,gap);
   const before=await exactCount(db);
   const initial=before===1111&&census.sameSourceUnlinked===476
    &&census.totals.ballot_repeated_across_papers===210;
   const already=before===1175&&census.sameSourceUnlinked===412
    &&census.totals.ballot_repeated_across_papers===146;
   // The subsequent accepted-ballot-only writer can add paper actions for
   // uniquely printed questions, moving some HELD sibling votes from the
   // repeated-accepted to repeated-paper *first failure*. This is a strict
   // no-op state: exact=1200, unmatched=387 and no newly unique source roll.
   const postAccepted=before===1200&&census.sameSourceUnlinked===387
    &&census.totals.ballot_repeated_across_papers>=146
    &&census.totals.ballot_repeated_across_papers<=206
    &&census.totals.ballot_repeated_across_votes<=60
    &&census.totals.no_matching_tally<=61;
   // SOURCE-CERTIFIED 55 named-ballot mismatch promotion is a distinct
   // no-op poststate for this earlier 64-link repair, never a new vote link.
   const postNamed=before===1255&&census.sameSourceUnlinked===332
    &&census.totals.no_matching_tally<=61
    &&census.totals.paper_ballot_absent<=56;
   // Exactly 99 certified source questions may reclassify only the other
   // 51 paperless accepted votes; this old 64-link writer remains a no-op.
   const postOrphan=before===1354&&census.sameSourceUnlinked>=332
    &&census.sameSourceUnlinked<=383
    &&census.totals.no_matching_tally<=112;
   if(!initial&&!already&&!postAccepted&&!postNamed&&!postOrphan)
    throw Error('Original repeated paper exact-link protected population baseline drifted');
   const uniques:UniqueOriginalRoll[]=[];
   const original=await readRepeatedOriginalRollAudit(
    db,rows.votes,rows.actions,census,p=>uniques.push(p));
   const pairs=strictRepeatedOriginalQuestionLinks(uniques);
   if(original.repeatedPaperVoteCohort!==census.totals.ballot_repeated_across_papers
    ||original.sourceUniqueQuestionBallotCandidates!==uniques.length
    ||pairs.length!==uniques.length
    ||(!postOrphan&&original.stages.original_source_not_unique_verified!==0)
    ||(!postOrphan&&original.stages.original_roster_or_raw_header_unreadable!==0)
    ||(!postAccepted&&!postNamed&&!postOrphan&&original.stages.original_printed_question_and_ballot_absent!==0)
    ||(!postNamed&&!postOrphan&&original.stages.accepted_day_question_and_ballot_repeated!==0)
    ||!((initial&&original.originalDocumentsInspected===40&&pairs.length===64
      &&original.stages.original_printed_question_and_ballot_repeated===143
      &&original.stages.original_question_span_or_bill_unproven===3)
     ||(already&&pairs.length===0
      &&original.stages.original_printed_question_and_ballot_repeated<=143
      &&original.stages.original_question_span_or_bill_unproven<=3)
     ||(postAccepted&&pairs.length===0
      &&original.originalDocumentsInspected<=75
      &&original.stages.original_printed_question_and_ballot_absent<=55
      &&original.stages.original_printed_question_and_ballot_repeated<=145
      &&original.stages.original_question_span_or_bill_unproven<=6)
     ||(postNamed&&pairs.length===0
      &&original.originalDocumentsInspected<=220
      &&original.repeatedPaperVoteCohort<=332)
     ||(postOrphan&&pairs.length===0
      &&original.originalDocumentsInspected<=220
      &&original.repeatedPaperVoteCohort<=383)))
    throw Error('Independent entire ORIGINAL Journal repeated question roll or 64-candidate proof drifted');
   for(const p of pairs)await insertOne(db,p);
   const after=await exactCount(db);
   if(after!==before+pairs.length)throw Error('Repeated original question links did not exactly match source proofs');
   const afterEvents=(await db.query('SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind')).rows;
   const afterGap=await readVoteTextGapAudit(db);verifyVoteTextGapAudit(afterGap,afterEvents);
   const next=await readSameSourceQuestionRows(db);
   const nextCensus=summarizeSameSourceFailures(next.votes,next.actions,afterGap);
   if(nextCensus.sameSourceUnlinked!==census.sameSourceUnlinked-pairs.length
    ||nextCensus.totals.ballot_repeated_across_papers!==census.totals.ballot_repeated_across_papers-pairs.length
    ||nextCensus.totals.no_matching_tally!==census.totals.no_matching_tally
    ||nextCensus.candidateQuestionRechecks!==0
    ||nextCensus.unlinkedWithExistingStoredLink!==0)
    throw Error('Original repeated question post-write full accepted-population reconciliation failed');
   await db.query('COMMIT');
   return{
    schemaVersion:SENATE_REPEATED_ORIGINAL_EXACT_REPAIR,
    result:pairs.length?'linked_verified_originals':'already_applied',
    sourceDocumentsInspected:original.originalDocumentsInspected,
    duplicatePaperVotesInspected:original.repeatedPaperVoteCohort,
    uniqueOriginalQuestions:pairs.length,sourceQuestionActionsCreated:pairs.length,
    exactVoteLinksCreated:pairs.length,exactBefore:before,exactAfter:after,
    sameJournalUnlinkedBefore:census.sameSourceUnlinked,
    sameJournalUnlinkedAfter:nextCensus.sameSourceUnlinked,
    repeatedPapersBefore:census.totals.ballot_repeated_across_papers,
    repeatedPapersAfter:nextCensus.totals.ballot_repeated_across_papers,
    repeatedOriginalQuestionHolds:original.stages.original_printed_question_and_ballot_repeated,
    unprovenOriginalQuestionHolds:original.stages.original_question_span_or_bill_unproven,
    originalVoteEventsChanged:false,sourceDocumentsChanged:false,
    oldPaperActionsChanged:false,servingModelsChanged:false,
    completeAmendedBillStatesCertified:0
   };
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
