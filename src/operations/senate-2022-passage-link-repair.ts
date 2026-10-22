/**
 * Strict one-time, source-authenticated completion of missing DERIVED paper
 * ballot fingerprints for independently proved 2021-22 passage questions.
 *
 * Never alter accepted votes, member choices, original source text, proposal
 * captures or motion text. Reparse only verified original Senate Journals,
 * refuse source/action/accepted collisions and commit action SHA + exact
 * event edge together or roll back everything.
 */
import type {Pool,PoolClient} from 'pg';
import {readSameSourceQuestionRows,summarizeSameSourceFailures,
 type ParsedAction,type AcceptedVote} from './senate-same-source-question-census.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit} from './senate-vote-text-gap-audit.js';
import {read2022PassageRosterSourceDocs,summarize2022PassageRosterShadow,
 type StrictSourcePassageMatch,type StoredJournal,type RosterShadowProof}
 from './senate-2022-passage-roster-shadow.js';

export const SENATE_2022_PASSAGE_REPAIR='senate-2022-passage-safe-link-repair-v1' as const;
export interface RepairPair {
 actionId:string;voteId:string;sourceId:string;sourceUrl:string;
 sourcePayload:string;actionKey:string;start:number;end:number;
 sequence:number;billId:string;bill:string;day:string;
 question:string;acceptedMotion:string;yeas:number;nays:number;ballot:string;
}
export interface PassageRepairReport {
 schemaVersion:typeof SENATE_2022_PASSAGE_REPAIR;
 result:'linked_verified_originals'|'already_applied';
 sourceDocuments:number;
 initialMissingPaperRolls:number;
 originalShadowUniqueCandidates:number;
 actionIdentityVerified:number;
 recoveredDerivedBallots:number;
 exactQuestionLinksCreated:number;
 heldRepeatedAcceptedBallots:number;
 heldIncompletePrintedBallots:number;
 exactLinksBefore:number;exactLinksAfter:number;
 sameSourceUnlinkedBefore:number;sameSourceUnlinkedAfter:number;
 originalVotesChanged:false;originalSourceBodiesChanged:false;
 servingModelsChanged:false;completeBillTextsCertified:0;
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;

/**
 * The paper action already exists. Its printed offsets, source key,
 * sequence, original question and tallies must ALL be identical to
 * the independently replayed source action. No near/ordinal matching.
 */
export function strictStored2022PassageRepairPairs(
 sourceMatches:readonly StrictSourcePassageMatch[],
 actions:readonly ParsedAction[],docs:readonly StoredJournal[]
):RepairPair[]{
 const byId=new Map(docs.map(d=>[d.id,d]));
 const repairs:RepairPair[]=[];
 for(const m of sourceMatches){
  const v=m.acceptedVote,p=m.sourceAction,id=m.sourceDocumentId;
  const source=byId.get(id);
  if(!source||source.source_url!==v.source_url
   ||source.source_type!=='mn_senate_journal'
   ||!SHA.test(source.content_sha256??'')
   ||!UUID.test(v.id)||!UUID.test(id)||!UUID.test(v.bill_id)
   ||p.kind!=='passage'||!SHA.test(p.key)||!SHA.test(p.ballotSignature??'')
   ||p.billIdentifier!==v.bill||p.yeas!==v.yea_count||p.nays!==v.nay_count
   ||v.vote_kind!=='passage'||v.exact_linked||v.stored_link)
   throw Error('Source-only 2022 accepted vote/original paper identity failed');
  const found=actions.filter(a=>a.source_id===id
   &&a.source_url===v.source_url&&a.bill_id===v.bill_id&&a.day===v.day
   &&a.kind==='passage'&&a.ballot_sha256===null&&a.original_source_verified
   &&a.action_key===p.key&&a.sequence===p.sequence
   &&a.source_start===p.start&&a.source_end===p.end
   &&a.yea_count===p.yeas&&a.nay_count===p.nays
   &&a.question_text===p.questionText
   &&SHA.test(a.source_payload_sha256??'')&&UUID.test(a.id));
  if(found.length!==1)throw Error('Previously persisted paper action lacks exact original printed-key identity');
  const a=found[0]!;
  if(!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.start<0||p.end<=p.start
   ||p.end>(source.raw_text?.length??0)
   ||!Number.isInteger(p.sequence)||p.sequence<1)
   throw Error('Replayed paper source span/sequence outside original bounds');
  repairs.push({
   actionId:a.id,voteId:v.id,sourceId:id,sourceUrl:v.source_url,
   sourcePayload:a.source_payload_sha256!,actionKey:p.key,start:p.start,end:p.end,
   sequence:p.sequence,billId:v.bill_id,bill:v.bill,day:v.day,
   question:p.questionText,acceptedMotion:v.motion_text,
   yeas:v.yea_count,nays:v.nay_count,ballot:p.ballotSignature!
  });
 }
 if(new Set(repairs.map(x=>x.actionId)).size!==repairs.length
  ||new Set(repairs.map(x=>x.voteId)).size!==repairs.length)
  throw Error('Repeated persisted action or accepted vote in 2022 source-ballot promotion');
 return repairs;
}

/** Every SQL update is conditional on the unchanged original-source payload,
 * a matching authenticated source receipt, the exact persisted v1 question,
 * and the UNSET derived ballot. A changed ballot remains unlinked.
 */
async function completeOnePair(db:PoolClient,p:RepairPair):Promise<void>{
 const event=(await db.query<{id:string;fingerprint:string}>([
  'SELECT v.id::text,senate_vote_paper_event_fingerprint(v.id) AS fingerprint',
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  'JOIN bills b ON b.id=v.bill_id',
  'WHERE v.id=$1::uuid AND v.bill_id=$2::uuid AND v.occurred_on=$3::date',
  "AND v.vote_kind='passage' AND v.yea_count=$4 AND v.nay_count=$5",
  'AND v.motion_text=$6 AND b.identifier=$7 AND d.source_url=$8',
  'AND NOT EXISTS (SELECT 1 FROM senate_vote_paper_event_links l WHERE l.vote_event_id=v.id)',
  'FOR UPDATE OF v'
 ].join(' '),[p.voteId,p.billId,p.day,p.yeas,p.nays,p.acceptedMotion,p.bill,p.sourceUrl])).rows;
 if(event.length!==1||!SHA.test(event[0]!.fingerprint))
  throw Error('Accepted official vote identity/fingerprint changed since proven source replay');
 const changed=await db.query([
  'UPDATE senate_vote_paper_actions a SET ballot_sha256=$1',
  'WHERE a.id=$2::uuid AND a.source_document_id=$3::uuid',
  'AND a.source_payload_sha256=$4 AND a.action_key=$5',
  "AND a.parser_version='senate-journal-paper-v1' AND a.ballot_sha256 IS NULL",
  "AND a.kind='passage' AND a.bill_id=$6::uuid AND a.occurred_on=$7::date",
  'AND a.sequence=$8 AND a.source_start=$9 AND a.source_end=$10',
  'AND a.question_text=$11 AND a.yea_count=$12 AND a.nay_count=$13',
  'AND NOT EXISTS (SELECT 1 FROM senate_vote_paper_event_links l',
  'WHERE l.action_id=a.id OR l.vote_event_id=$14::uuid)',
  'AND EXISTS (SELECT 1 FROM source_documents d',
  'JOIN senate_paper_source_verifications proof ON proof.source_document_id=d.id',
  'AND proof.source_url=d.source_url',
  "AND proof.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex')",
  'WHERE d.id=a.source_document_id AND d.source_url=$15',
  "AND d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'",
  "AND encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex')=a.source_payload_sha256)",
  'RETURNING a.id'
 ].join(' '),[
  p.ballot,p.actionId,p.sourceId,p.sourcePayload,p.actionKey,p.billId,p.day,
  p.sequence,p.start,p.end,p.question,p.yeas,p.nays,p.voteId,p.sourceUrl
 ]);
 if(changed.rowCount!==1)
  throw Error('Original paper derived-ballot CAS or government-source verification failed');
 const link=await db.query([
  'INSERT INTO senate_vote_paper_event_links(action_id,vote_event_id,vote_identity_sha256,method)',
  "SELECT $1::uuid,$2::uuid,$3,'unique_question_full_ballot'",
  'WHERE NOT EXISTS (SELECT 1 FROM senate_vote_paper_event_links l',
  'WHERE l.action_id=$1::uuid OR l.vote_event_id=$2::uuid)',
  'RETURNING action_id'
 ].join(' '),[p.actionId,p.voteId,event[0]!.fingerprint]);
 if(link.rowCount!==1)throw Error('Previously unseen action/vote identity collision; rollback whole repair batch');
}
async function exactCount(db:PoolClient):Promise<number>{
 const row=(await db.query<{n:number}>('SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v')).rows[0];
 return row?.n??-1;
}
/** Only source-verified subsequent EXACT question cohorts can expand the
 * accepted coverage baseline for a previously completed 2022 passage
 * repair. Refuse all unspecified head counts and source-day drifts.
 */
export function recognized2022PassageCoverageState(
 missingOriginalPassageRolls:number,exactLinks:number,sameSourceUnlinked:number
):boolean{
 return (missingOriginalPassageRolls===132&&exactLinks===890&&sameSourceUnlinked===697)
  ||(missingOriginalPassageRolls===31&&exactLinks===991&&sameSourceUnlinked===596)
  ||(missingOriginalPassageRolls===31&&exactLinks===1022&&sameSourceUnlinked===565)
  ||(missingOriginalPassageRolls===31&&exactLinks===1111&&sameSourceUnlinked===476)
  ||(missingOriginalPassageRolls===31&&exactLinks===1175&&sameSourceUnlinked===412)
  ||(missingOriginalPassageRolls===31&&exactLinks===1200&&sameSourceUnlinked===387);
}
/** The guarded deployment runner owns the primary identity check, migration
 * checksum parity and main-branch marker before calling this operation.
 * Repeatable-run safety: either one tightly frozen 101-link cohort, or a
 * clean no-op on the independently verified post-repair 31 held votes.
 */
export async function repair2022UniquePassageLinks(pool:Pool):Promise<PassageRepairReport>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-2022-passage-exact-roll-repair'))");
   const events=(await db.query('SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind')).rows;
   const gap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(gap,events);
   const {votes,actions}=await readSameSourceQuestionRows(db);
   const census=summarizeSameSourceFailures(votes,actions,gap);
   const expected=census.focused2021Passage.passageActionWithTallyButNoBallot;
   const previous=await exactCount(db);
   if(!recognized2022PassageCoverageState(
    expected,previous,census.sameSourceUnlinked))
    throw Error('Production official/paper exact-link baseline differs from reviewed original source receipts');
   const docs=await read2022PassageRosterSourceDocs(db,votes,actions);
   const pairs:StrictSourcePassageMatch[]=[];
   const shadow:RosterShadowProof=summarize2022PassageRosterShadow(
    votes,actions,docs,expected,pair=>pairs.push(pair));
   const repaired=strictStored2022PassageRepairPairs(pairs,actions,docs);
   if(repaired.length!==shadow.strictlyUniqueQuestionAndFullBallotCandidates
    ||shadow.sourceDocumentsLoaded<1||shadow.sourceDocumentsLoaded>37
    ||shadow.sourceAttendanceRosters!==shadow.sourceDocumentsLoaded
    ||shadow.stages.repeated_accepted_ballot!==30
    ||shadow.stages.named_ballot_still_missing!==1
    ||!((expected===132&&shadow.sourceDocumentsLoaded===37
      &&repaired.length===101)
      ||(expected===31&&repaired.length===0)))
    throw Error('Original 37-Journal/132-vote strict repair source proof failed independent parity');
   for(const p of repaired)await completeOnePair(db,p);
   const following=await exactCount(db);
   if(following!==previous+repaired.length)
    throw Error('2022 passage exact-link readback did not increase by verified unique paper pairs');
   const afterEvents=(await db.query('SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind')).rows;
   const afterGap=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(afterGap,afterEvents);
   const afterRows=await readSameSourceQuestionRows(db);
   const afterCensus=summarizeSameSourceFailures(afterRows.votes,afterRows.actions,afterGap);
   if(afterCensus.sameSourceUnlinked!==census.sameSourceUnlinked-repaired.length
    ||afterCensus.focused2021Passage.passageActionWithTallyButNoBallot!==expected-repaired.length
    ||afterCensus.candidateQuestionRechecks!==0
    ||afterCensus.unlinkedWithExistingStoredLink!==0)
    throw Error('Independent source-question census changed outside exact proven 2022 passage cohort');
   await db.query('COMMIT');
   return{
    schemaVersion:SENATE_2022_PASSAGE_REPAIR,
    result:repaired.length?'linked_verified_originals':'already_applied',
    sourceDocuments:docs.length,
    initialMissingPaperRolls:expected,
    originalShadowUniqueCandidates:shadow.strictlyUniqueQuestionAndFullBallotCandidates,
    actionIdentityVerified:repaired.length,
    recoveredDerivedBallots:repaired.length,
    exactQuestionLinksCreated:repaired.length,
    heldRepeatedAcceptedBallots:shadow.stages.repeated_accepted_ballot,
    heldIncompletePrintedBallots:shadow.stages.named_ballot_still_missing,
    exactLinksBefore:previous,exactLinksAfter:following,
    sameSourceUnlinkedBefore:census.sameSourceUnlinked,
    sameSourceUnlinkedAfter:afterCensus.sameSourceUnlinked,
    originalVotesChanged:false,originalSourceBodiesChanged:false,
    servingModelsChanged:false,completeBillTextsCertified:0
   };
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
