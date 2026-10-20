/** Idempotent, append-only research proof for HF100's seventh original named roll.
 * This adds ONE source-only supplemental action. It intentionally does not
 * replace v1 actions, become visible through senate_vote_paper_current_v, or
 * insert accepted-event links, member votes, bill text, models or eligibility.
 */
import type {Pool,PoolClient} from 'pg';
import {parseJournalPaperActions,type PaperAction} from './senate-vote-paper-parser.js';

export const HF100_ORIGINAL_SHADOW_VERSION='senate-hf100-original-supplement-v2' as const;
const JOURNAL='https://www.senate.mn/journals/2023-2024/20230428059.pdf';
const ORIGINAL_PDF_SHA='9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3';

export function identifyPrattSourceAction(source:string,knownNames:readonly string[]):PaperAction {
 if(typeof source!=='string'||source.length>8_000_000||source.length<1000
  ||knownNames.length<30||knownNames.length>250)throw Error('HF100 original source outside verified bounds');
 const actions=parseJournalPaperActions(source,knownNames).filter(a=>a.billIdentifier==='HF100');
 if(actions.length!==8||actions.filter(a=>a.proposedText!==null).length!==5
  ||actions.filter(a=>a.ballotSignature!==null).length!==7
  ||actions.at(-1)?.kind!=='passage'||actions.at(-1)?.priorAdoptedKeys.length!==4)
  throw Error('HF100 full original source order or ballots diverged');
 const procedural=actions.filter(a=>a.kind==='procedural'&&a.yeas===33&&a.nays===34);
 if(procedural.length!==2||procedural.some(a=>!a.ballotSignature))
  throw Error('HF100 requires two distinct complete 33-34 procedural ballots');
 const missing=actions.find(a=>a.sequence===8);
 if(!missing||missing.kind!=='procedural'||missing.yeas!==33||missing.nays!==34
  ||!missing.ballotSignature||!/^[a-f0-9]{64}$/.test(missing.ballotSignature)
  ||missing.proposedText!==null||missing.priorAdoptedKeys.length!==4)
  throw Error('HF100 seventh original ballot is not a strict source-authenticated procedural motion');
 return missing;
}

interface SourceRow {
 sourceId:string;billId:string;sourceUrl:string;sourceDate:string;body:string;
 payloadSha:string;originalVerified:boolean;
}
const ORIGINAL_SQL=[
 "SELECT d.id::text AS \"sourceId\",b.id::text AS \"billId\",",
 "d.source_url AS \"sourceUrl\",d.metadata#>>'{rawPrepassageVotes,sourceDate}' AS \"sourceDate\",",
 "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
 "encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex') AS \"payloadSha\",",
 "EXISTS(SELECT 1 FROM senate_paper_source_verifications proof",
 " WHERE proof.source_document_id=d.id AND proof.source_url=d.source_url",
 " AND proof.original_body_sha256::text=$2",
 " AND proof.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex')) AS \"originalVerified\"",
 "FROM source_documents d JOIN legislative_sessions s ON s.id=d.session_id",
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "JOIN bills b ON b.session_id=s.id AND b.identifier='HF100'",
 "WHERE s.slug='2023-2024' AND d.source_url=$1",
 "AND d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'",
 "ORDER BY d.id LIMIT 3",
].join(' ');

interface StoredRow {
 id:string;actionKey:string;billId:string;sequence:number;
 start:number;end:number;kind:string;questionText:string;motionText:string;
 yeas:number|null;nays:number|null;ballotSha:string|null;
 prior:string[];
}
const STORED_SQL=[
 "SELECT id::text AS id,action_key AS \"actionKey\",bill_id::text AS \"billId\",",
 "sequence,source_start AS start,source_end AS \"end\",kind,",
 "question_text AS \"questionText\",motion_text AS \"motionText\",",
 "yea_count AS yeas,nay_count AS nays,ballot_sha256::text AS \"ballotSha\",",
 "prior_adopted_action_keys AS prior FROM senate_vote_paper_actions",
 "WHERE source_document_id=$1 AND source_payload_sha256=$2 AND parser_version=$3",
 "ORDER BY sequence LIMIT 12",
].join(' ');

export interface Hf100ShadowProofResult {
 status:'append_only_source_proof_verified';
 inserted:number;sourceActions:number;completeNamedBallots:number;
 twoProceduralBallots:true;shadowRows:1;linkedAcceptedEvents:0;
 servingCurrentViewRows:0;originalPdfSha256:string;
}
function guardStoredReference(reference:StoredRow,proof:PaperAction,billId:string){
 if(reference.billId!==billId||reference.actionKey!==proof.key
  ||reference.sequence!==proof.sequence||reference.start!==proof.start
  ||reference.end!==proof.end||reference.kind!==proof.kind
  ||reference.questionText!==proof.questionText||reference.motionText!==proof.motionText
  ||reference.yeas!==proof.yeas||reference.nays!==proof.nays
  ||JSON.stringify(reference.prior)!==JSON.stringify(proof.priorAdoptedKeys))
  throw Error('HF100 original source question identity disagrees with original v1 paper');
}
function guardStoredShadow(row:StoredRow,proof:PaperAction,billId:string){
 guardStoredReference(row,proof,billId);
 if(row.ballotSha!==proof.ballotSignature)
  throw Error('HF100 shadow row conflicts with original complete named ballot proof');
}

async function recordShadow(db:PoolClient):Promise<Hf100ShadowProofResult>{
 await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-hf100-original-proof-v2'))");
 const documents=(await db.query<SourceRow>(ORIGINAL_SQL,[JOURNAL,ORIGINAL_PDF_SHA])).rows;
 if(documents.length!==1||!documents[0]?.originalVerified||documents[0].sourceDate!=='2023-04-28')
  throw Error('HF100 original PDF provenance or source identity cannot be independently verified');
 const doc=documents[0];
 if(!/^[a-f0-9]{64}$/.test(doc.payloadSha))
  throw Error('HF100 original source payload hash invalid');
 const rosterEnd=doc.body?.indexOf('The President declared')??-1;
 if(rosterEnd<0)throw Error('HF100 original printed member roster is unavailable');
 const roster=[...new Set(doc.body.slice(0,rosterEnd).split('\n')
  .map(x=>x.trim()).filter(x=>/^[A-Z][A-Za-z ]+$/.test(x)))];
 const source=identifyPrattSourceAction(doc.body,roster);
 // Existing accepted v1 paper MUST be a single corresponding action with no
 // named ballot. This is the precise independently audited source gap.
 const v1=(await db.query<StoredRow>(STORED_SQL,[doc.sourceId,doc.payloadSha,'senate-journal-paper-v1'])).rows
  .filter(r=>r.sequence===8);
 if(v1.length!==1||v1[0].ballotSha!==null)
  throw Error('Expected exact original v1 Pratt source-only hold not found');
 guardStoredReference(v1[0],source,doc.billId);
 const insert=await db.query([
  'INSERT INTO senate_vote_paper_actions(source_document_id,source_payload_sha256,',
  'parser_version,action_key,sequence,source_start,source_end,bill_id,occurred_on,kind,',
  'motion_text,question_text,proposed_text,proposal_capture_id,explicit_base_locator,',
  'outcome,prior_adopted_action_keys,yea_count,nay_count,ballot_sha256)',
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,NULL,NULL,$13,$14::jsonb,$15,$16,$17)',
  'ON CONFLICT(source_document_id,source_payload_sha256,parser_version,action_key) DO NOTHING',
 ].join(' '),[
  doc.sourceId,doc.payloadSha,HF100_ORIGINAL_SHADOW_VERSION,source.key,
  source.sequence,source.start,source.end,doc.billId,doc.sourceDate,source.kind,
  source.motionText,source.questionText,source.outcome,JSON.stringify(source.priorAdoptedKeys),
  source.yeas,source.nays,source.ballotSignature
 ]);
 const shadow=(await db.query<StoredRow>(STORED_SQL,[doc.sourceId,doc.payloadSha,HF100_ORIGINAL_SHADOW_VERSION])).rows;
 if(shadow.length!==1)throw Error('HF100 original supplementary proof has invalid cardinality');
 guardStoredShadow(shadow[0],source,doc.billId);
 const usage=(await db.query<{eventLinks:number;currentRows:number}>([
  'SELECT (SELECT count(*)::int FROM senate_vote_paper_event_links',
  ' WHERE action_id=$1) AS "eventLinks",',
  '(SELECT count(*)::int FROM senate_vote_paper_current_v WHERE id=$1) AS "currentRows"',
 ].join(' '),[shadow[0].id])).rows[0];
 if(!usage||usage.eventLinks!==0||usage.currentRows!==0)
  throw Error('Non-serving original ballot proof was promoted to accepted current identity');
 return {status:'append_only_source_proof_verified',
  inserted:insert.rowCount??0,sourceActions:8,completeNamedBallots:7,
  twoProceduralBallots:true,shadowRows:1,linkedAcceptedEvents:0,
  servingCurrentViewRows:0,originalPdfSha256:ORIGINAL_PDF_SHA};
}

/** Main-only guarded protected deployment; never run from PR CI. */
export async function appendHf100OriginalPrattProof(pool:Pool):Promise<Hf100ShadowProofResult>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{const proof=await recordShadow(db);await db.query('COMMIT');return proof}
  catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}


/** Separately committed/read-only verification, not the writer's own snapshot. */
export async function readCommittedHf100PrattShadow(db:PoolClient){
 const sql=[
  'SELECT count(*)::int AS "shadowRows",',
  'count(*) FILTER (WHERE a.ballot_sha256 IS NOT NULL)::int AS "namedBallots",',
  'count(l.vote_event_id)::int AS "acceptedLinks",',
  'count(current.id)::int AS "currentRows"',
  'FROM senate_vote_paper_actions a',
  'JOIN source_documents d ON d.id=a.source_document_id',
  'LEFT JOIN senate_vote_paper_event_links l ON l.action_id=a.id',
  'LEFT JOIN senate_vote_paper_current_v current ON current.id=a.id',
  'WHERE a.parser_version=$1 AND d.source_url=$2',
  "AND a.occurred_on=DATE '2023-04-28'",
  "AND a.source_payload_sha256=encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex')",
  'AND EXISTS(SELECT 1 FROM senate_paper_source_verifications proof',
  ' WHERE proof.source_document_id=d.id AND proof.source_url=d.source_url',
  ' AND proof.original_body_sha256::text=$3',
  " AND proof.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
 ].join(' ');
 const row=(await db.query<{shadowRows:number;namedBallots:number;acceptedLinks:number;currentRows:number}>(
  sql,[HF100_ORIGINAL_SHADOW_VERSION,JOURNAL,ORIGINAL_PDF_SHA])).rows[0];
 if(!row||row.shadowRows!==1||row.namedBallots!==1
  ||row.acceptedLinks!==0||row.currentRows!==0)
  throw Error('Committed HF100 original supplemental ballot proof failed independent read-only verification');
 return row;
}
