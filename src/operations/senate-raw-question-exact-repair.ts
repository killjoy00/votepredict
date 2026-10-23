/**
 * Atomic, append-only exact QUESTION links for uniquely source-anchored raw
 * Minnesota Senate Journal rolls missed by the v1 paper-action parser.
 *
 * Requires independent original-source roll/header alignment, precise printed
 * question offsets and uniqueness across every original roll, nested action,
 * v1 action and all accepted source-day events. No implied amendment text.
 */
import type {Pool,PoolClient} from 'pg';
import {ballotSignature,billIdentifier,compact,hash} from './senate-vote-paper-parser.js';
import {questionCore} from './senate-vote-paper-case-audit.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit} from './senate-vote-text-gap-audit.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures}
 from './senate-same-source-question-census.js';
import {readNoTallyOriginalCensus,type PreliminaryRawOriginalCandidate}
 from './senate-no-tally-original-census.js';
import {summarizeRawOriginalStrongSource,type RawOriginalQuestionProof}
 from './senate-raw-original-strong-source-audit.js';

export const SENATE_RAW_EXACT_REPAIR='senate-original-raw-roll-question-link-v1' as const;
const SHA=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface StrictRawQuestionLink {
 originalSourceId:string;sourceUrl:string;originalTextSha:string;
 acceptedId:string;billId:string;bill:string;day:string;voteKind:string;
 actionKind:'amendment'|'passage'|'procedural';
 questionStart:number;rollStart:number;rollOrdinal:number;sequence:number;
 actionKey:string;printedQuestion:string;acceptedMotion:string;
 yeas:number;nays:number;ballot:string;
}
export interface RawQuestionRepairResult {
 schemaVersion:typeof SENATE_RAW_EXACT_REPAIR;
 result:'linked_verified_originals'|'already_applied';
 sourceDocumentsInspected:number;preliminaryRawRolls:number;
 sourceUniqueOriginalRolls:number;originalQuestionActionsCreated:number;
 exactVoteLinksCreated:number;exactBefore:number;exactAfter:number;
 sameJournalUnlinkedBefore:number;sameJournalUnlinkedAfter:number;
 missingTallyBefore:number;missingTallyAfter:number;
 unprovenPrintedQuestions:number;conflictingExistingPaperBallots:number;
 originalVoteEventsChanged:false;sourceDocumentsChanged:false;
 oldPaperActionsChanged:false;servingModelsChanged:false;
 completeAmendedBillStatesCertified:0;
}
function entireQuestion(t:string):string{
 const markers=[...t.matchAll(/The question (?:was taken|recurred)/gi)];
 return compact(markers.length?t.slice(markers.at(-1)!.index):t);
}
function kind(v:string):StrictRawQuestionLink['actionKind']{
 if(v==='amendment')return 'amendment';
 if(v==='passage')return 'passage';
 if(v==='motion'||v==='other')return 'procedural';
 throw Error('Unrecognized raw original accepted question kind');
}
/** The source-side audit separately proved the entire original source corpus
 * unique. Rebind its witness to EXACT original bytes and accepted identity
 * before authorizing any SQL insert. Never create a candidate from a tally.
 */
export function strictRawOriginalQuestionLinks(
 preliminary:readonly PreliminaryRawOriginalCandidate[],
 sourceProofs:readonly RawOriginalQuestionProof[]
):StrictRawQuestionLink[]{
 const byVote=new Map(preliminary.map(x=>[x.vote.id,x]));
 if(byVote.size!==preliminary.length)throw Error('Duplicate preliminary accepted raw vote');
 const results:StrictRawQuestionLink[]=[];
 for(const p of sourceProofs){
  const item=byVote.get(p.voteId);
  if(!item)throw Error('Source unique raw question not in preliminary original cohort');
  const v=item.vote,d=item.originalDocument,text=d.body;
  const signature=ballotSignature(v.votes,v.yea_count,v.nay_count);
  const printed=typeof text==='string'
   &&Number.isInteger(p.questionStart)&&Number.isInteger(p.rollStart)
   &&p.questionStart>=0&&p.rollStart>p.questionStart&&p.rollStart<=text.length
    ?compact(text.slice(p.questionStart,p.rollStart)):null;
  const header=typeof text==='string'&&p.rollStart>=0
   ?text.slice(p.rollStart,p.rollStart+160):'';
  const headerMatch=/^The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:/i.exec(header);
  if(!d.original_verified||d.source_type!=='mn_senate_journal'
   ||!/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/.test(d.source_url)
   ||d.source_url!==p.sourceUrl||d.source_url!==v.source_url
   ||!UUID.test(d.id)||!UUID.test(v.id)||!UUID.test(v.bill_id)
   ||d.id!==p.sourceDocumentId||v.id!==p.voteId||v.bill_id!==p.billId
   ||v.bill!==p.bill||v.day!==p.day||v.vote_kind!==p.voteKind
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day)
   ||!(d.source_url.split('/').at(-1)??'').startsWith(v.day.replace(/-/g,''))
   ||!['2021-2022','2023-2024','2025-2026'].includes(v.session)
   ||v.exact_linked||v.stored_link||!/^([HS]F)[1-9]\d{0,5}$/.test(v.bill)
   ||typeof text!=='string'||text.length<2000||text.length>8_000_000
   ||text.includes('\r')
   ||!Number.isInteger(p.sourceRollOrdinal)||p.sourceRollOrdinal<1||p.sourceRollOrdinal>600
   ||!Number.isInteger(p.questionStart)||!Number.isInteger(p.rollStart)
   ||p.questionStart<0||p.rollStart<=p.questionStart
   ||p.rollStart>text.length||p.rollStart-p.questionStart>2600
   ||!headerMatch||Number(headerMatch[1])!==p.yeas||Number(headerMatch[2])!==p.nays
   ||printed!==p.printedQuestion||printed===null||printed.length<40||printed.length>800
   ||questionCore(printed)!==questionCore(v.motion_text)
   ||entireQuestion(printed)!==entireQuestion(v.motion_text)
   ||entireQuestion(printed)!==entireQuestion(p.acceptedMotion)
   ||p.acceptedMotion!==v.motion_text
   ||p.yeas!==v.yea_count||p.nays!==v.nay_count
   ||signature===null||signature!==p.ballotSha256||!SHA.test(p.ballotSha256)
   )throw Error('Original raw question, printed header, source ballot or accepted identity proof failed');
  const sequence=200_000+p.questionStart;
  if(sequence>2147483647)throw Error('Original raw source offset outside SQL sequence bounds');
  results.push({
   originalSourceId:d.id,sourceUrl:d.source_url,originalTextSha:hash(text),
   acceptedId:v.id,billId:v.bill_id,bill:v.bill,day:v.day,voteKind:v.vote_kind,
   actionKind:kind(v.vote_kind),questionStart:p.questionStart,
   rollStart:p.rollStart,rollOrdinal:p.sourceRollOrdinal,sequence,
   actionKey:hash(JSON.stringify(['original-raw-roll-question-v1',d.id,
    p.sourceRollOrdinal,p.questionStart,p.rollStart,hash(printed),signature])),
   printedQuestion:printed,acceptedMotion:v.motion_text,
   yeas:v.yea_count,nays:v.nay_count,ballot:signature
  });
 }
 if(new Set(results.map(x=>x.acceptedId)).size!==results.length
  ||new Set(results.map(x=>JSON.stringify([x.originalSourceId,x.rollOrdinal,x.rollStart]))).size!==results.length
  ||new Set(results.map(x=>JSON.stringify([x.originalSourceId,x.ballot]))).size!==results.length
  ||new Set(results.map(x=>JSON.stringify([x.originalSourceId,x.actionKey]))).size!==results.length)
  throw Error('Original raw source roll, named ballot or accepted vote repeated');
 return results;
}
async function oneRawExactLink(db:PoolClient,p:StrictRawQuestionLink):Promise<void>{
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
 ].join(' '),[p.acceptedId,p.billId,p.day,p.voteKind,p.yeas,p.nays,
  p.acceptedMotion,p.bill,p.sourceUrl])).rows;
 if(accepted.length!==1||!SHA.test(accepted[0]!.fingerprint)
  ||ballotSignature(accepted[0]!.votes,p.yeas,p.nays)!==p.ballot)
  throw Error('Accepted full named roll or official event identity changed');
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
  throw Error('Source-verified raw question action insert failed; rollback');
 const link=await db.query([
  'INSERT INTO senate_vote_paper_event_links',
  '(action_id,vote_event_id,vote_identity_sha256,method)',
  "SELECT $1::uuid,$2::uuid,$3,'unique_question_full_ballot'",
  'WHERE NOT EXISTS(SELECT 1 FROM senate_vote_paper_event_links e',
  'WHERE e.action_id=$1::uuid OR e.vote_event_id=$2::uuid)',
  'RETURNING action_id'
 ].join(' '),[inserted.rows[0]!.id,p.acceptedId,accepted[0]!.fingerprint]);
 if(link.rowCount!==1)throw Error('Competing original raw question accepted-event link');
}
async function countExact(db:PoolClient):Promise<number>{
 return (await db.query<{n:number}>(
  'SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v'
 )).rows[0]?.n??-1;
}
/** Source-original corpus and fingerprints are checked again INSIDE the
 * serializable writer. Exact target baseline is not an estimated yield.
 * Every source/accepted conflict rolls the entire operation back.
 */
export async function repairRawSenateExactLinks(pool:Pool):Promise<RawQuestionRepairResult>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-original-question-links'))");
   const beforeEvents=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const gap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(gap,beforeEvents);
   const rows=await readSameSourceQuestionRows(db);
   const before=summarizeSameSourceFailures(rows.votes,rows.actions,gap);
   const exactBefore=await countExact(db);
   const noTallyBefore=before.totals.no_matching_tally;
   const initial=exactBefore===1022&&before.sameSourceUnlinked===565&&noTallyBefore===150;
   const repeated=((exactBefore===1111&&before.sameSourceUnlinked===476)
    ||(exactBefore===1175&&before.sameSourceUnlinked===412)
    ||(exactBefore===1200&&before.sameSourceUnlinked===387)
    ||(exactBefore===1255&&before.sameSourceUnlinked===332)
    ||(exactBefore===1354&&before.sameSourceUnlinked>=332
      &&before.sameSourceUnlinked<=383))
    &&noTallyBefore>=0&&noTallyBefore<=112;
   if(!initial&&!repeated)throw Error('Original raw-question repair baseline drifted');
   const preliminary:PreliminaryRawOriginalCandidate[]=[];
   const census=await readNoTallyOriginalCensus(
    db,rows.votes,rows.actions,before,undefined,c=>preliminary.push(c));
   const strong:RawOriginalQuestionProof[]=[];
   const original=summarizeRawOriginalStrongSource(preliminary,
    census.rawRollUniqueQuestionBallotCandidates,p=>strong.push(p));
   const pairs=strictRawOriginalQuestionLinks(preliminary,strong);
   // Post-99 source-only questions can reclassify the other 51 known-bill
   // paperless holds into no-tally first failures. Diagnose solely with
   // whole-cohort integer counts; do not emit source text, IDs, or ballots.
   if(repeated&&exactBefore===1354)console.log(
    'SENATE_RAW_REPLAY_COUNTS='+JSON.stringify({
     exact:exactBefore,unlinked:before.sameSourceUnlinked,
     noTally:noTallyBefore,preliminary:preliminary.length,
     strong:original.strictlyPrintedAndSourceUnique,pairs:pairs.length,
     sourceDocs:original.authenticatedSourceDocuments,
     stages:original.stages
    }));
   if(census.originalSameSourceUnlinked!==before.sameSourceUnlinked
    ||original.preliminaryOriginalRawCandidates!==preliminary.length
    ||pairs.length!==original.strictlyPrintedAndSourceUnique
    ||original.stages.original_document_or_roster_unverified!==0
    ||original.stages.raw_header_parser_misaligned!==0
    ||original.stages.raw_exact_source_roll_absent_or_repeated!==0
    ||original.stages.ballot_repeated_in_original_source!==0
    ||original.stages.separate_nested_question_same_ballot!==0
    ||!((initial&&preliminary.length===105&&pairs.length===89
      &&original.stages.separate_direct_paper_question_same_ballot===4
      &&original.stages.printed_question_span_or_bill_unproven===12
      &&original.authenticatedSourceDocuments===57)
     ||(repeated&&exactBefore===1354&&before.sameSourceUnlinked===373
       &&noTallyBefore===99&&pairs.length===0
       &&preliminary.length===17&&original.authenticatedSourceDocuments===12
       &&original.stages.separate_direct_paper_question_same_ballot===5
       &&original.stages.printed_question_span_or_bill_unproven===12)
     ||(repeated&&exactBefore!==1354&&pairs.length===0
       &&preliminary.length<=16)))
    throw Error('Independent 105 original source question/ballot proof drifted');
   for(const p of pairs)await oneRawExactLink(db,p);
   const exactAfter=await countExact(db);
   if(exactAfter!==exactBefore+pairs.length)
    throw Error('Exact accepted raw question link count does not equal source proof');
   const afterEvents=(await db.query(
    'SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind'
   )).rows;
   const afterGap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(afterGap,afterEvents);
   const fresh=await readSameSourceQuestionRows(db);
   const after=summarizeSameSourceFailures(fresh.votes,fresh.actions,afterGap);
   if(after.sameSourceUnlinked!==before.sameSourceUnlinked-pairs.length
    ||after.totals.no_matching_tally>noTallyBefore-pairs.length
    ||after.candidateQuestionRechecks!==0
    ||after.unlinkedWithExistingStoredLink!==0)
    throw Error('Independent full-population raw-question post-write invariant failed');
   await db.query('COMMIT');
   return {
    schemaVersion:SENATE_RAW_EXACT_REPAIR,
    result:pairs.length?'linked_verified_originals':'already_applied',
    sourceDocumentsInspected:original.authenticatedSourceDocuments,
    preliminaryRawRolls:preliminary.length,
    sourceUniqueOriginalRolls:pairs.length,
    originalQuestionActionsCreated:pairs.length,exactVoteLinksCreated:pairs.length,
    exactBefore,exactAfter,
    sameJournalUnlinkedBefore:before.sameSourceUnlinked,
    sameJournalUnlinkedAfter:after.sameSourceUnlinked,
    missingTallyBefore:noTallyBefore,missingTallyAfter:after.totals.no_matching_tally,
    unprovenPrintedQuestions:original.stages.printed_question_span_or_bill_unproven,
    conflictingExistingPaperBallots:original.stages.separate_direct_paper_question_same_ballot,
    originalVoteEventsChanged:false,sourceDocumentsChanged:false,
    oldPaperActionsChanged:false,servingModelsChanged:false,
    completeAmendedBillStatesCertified:0
   };
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
