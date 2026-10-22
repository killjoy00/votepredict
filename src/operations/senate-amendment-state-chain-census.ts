/**
 * #1498 step 3: SOURCE-LOCAL prerequisite census for reconstructing the
 * bill wording put before the Senate. This is NOT reconstructed text.
 *
 * The exact vote question, source proposal capture, explicitly sourced base
 * bill edition, adopted/rejected disposition, and complete cumulative adopted
 * source action key chain are separate proof steps. No program may promote a
 * same-bill text, same-day edition, rejected amendment or a list of intended
 * edits as a verified assembled or historically available at-vote bill state.
 *
 * Safe only inside an already authenticated REPEATABLE READ READ ONLY Neon
 * transaction. JSON output is numeric aggregates; source IDs, text, names,
 * ballots, source URLs and confidential database values never leave the job.
 */
import type {PoolClient} from 'pg';

export const SENATE_STATE_CHAIN_CENSUS='senate-1498-source-local-amendment-state-readiness-v1' as const;
export type ChainStage=
 'original_journal_not_verified'|
 'proposal_literal_absent'|
 'proposal_capture_not_source_attested'|
 'explicit_base_edition_absent'|
 'base_capture_absent'|
 'base_capture_ambiguous'|
 'adoption_outcome_unknown'|
 'source_local_predecessor_chain_unproved'|
 'adopted_ready_for_instruction_replay'|
 'rejected_excluded_from_current_state';
const STAGES:readonly ChainStage[]=[
 'original_journal_not_verified','proposal_literal_absent',
 'proposal_capture_not_source_attested','explicit_base_edition_absent',
 'base_capture_absent','base_capture_ambiguous','adoption_outcome_unknown',
 'source_local_predecessor_chain_unproved',
 'adopted_ready_for_instruction_replay',
 'rejected_excluded_from_current_state'
];
const VALID_SESSIONS=['2021-2022','2023-2024','2025-2026'] as const;
const KEY=/^[0-9a-f]{64}$/;
export interface SourceChainAction{
 id:string;session:string;sourceDocumentId:string;billId:string;
 day:string;sequence:number;actionKey:string;kind:string;outcome:string;
 originalSourceVerified:boolean;hasProposedText:boolean;
 proposalCapturedExactly:boolean;explicitBaseLocator:string|null;
 baseComponentCount:number;priorAdoptedKeys:string[];
}
export interface ChainStageGroup{
 session:string;stage:ChainStage;count:number;
}
export interface StateChainCensus{
 schemaVersion:typeof SENATE_STATE_CHAIN_CENSUS;
 allSourceLocalPaperActions:number;
 amendmentActions:number;
 originalVerifiedAmendments:number;
 exactLiteralProposalCaptures:number;
 proposalWithOneExplicitBase:number;
 adoptedSourceOnlyReplayCandidates:number;
 rejectedAmendmentsExcluded:number;
 priorSourceActionChainsChecked:number;
 stages:Record<ChainStage,number>;
 groups:ChainStageGroup[];
 /** All source-local actions are still not cumulative literal text edits. */
 completeAssembledStatesCertified:0;
 earlierThanVotePublicationCertified:0;
 proposalBodiesChanged:false;
 sourceDocumentsChanged:false;
 acceptedOfficialVotesChanged:false;
 billVersionsOrBaseBodiesChanged:false;
 originalMemberChoicesChanged:false;
 addedEventLinks:0;
 servingModelChanged:false;
}
function scoped(x:SourceChainAction):string{
 return JSON.stringify([x.sourceDocumentId,x.billId,x.day]);
}
/** Every source-day predecessor chain is evaluated from the complete
 * source-local action population, never only selected accepted roll votes.
 * The current parser's chronology is evidence of ORDER, not a text edit.
 */
export function summarizeSourceStateChain(
 actions:readonly SourceChainAction[],expectedTotal:number
):StateChainCensus{
 if(!Number.isSafeInteger(expectedTotal)||expectedTotal<1||expectedTotal>6500||
  actions.length!==expectedTotal||
  new Set(actions.map(a=>a.id)).size!==actions.length)
  throw Error('Source state chain audited action denominator or identities changed');
 const scopes=new Map<string,SourceChainAction[]>();
 for(const a of actions){
  if(!VALID_SESSIONS.includes(a.session as typeof VALID_SESSIONS[number])
   ||!KEY.test(a.actionKey)||!Number.isSafeInteger(a.sequence)
   ||a.sequence<0||a.sequence>2147483647
   ||!/^\d{4}-\d\d-\d\d$/.test(a.day)
   ||!Array.isArray(a.priorAdoptedKeys)
   ||a.priorAdoptedKeys.some(x=>typeof x!=='string'||!KEY.test(x))
   ||!Number.isSafeInteger(a.baseComponentCount)||a.baseComponentCount<0
   ||a.baseComponentCount>1000)
   throw Error('Source state chain received invalid source key/sequence/evidence row');
  const k=scoped(a),v=scopes.get(k)??[];v.push(a);scopes.set(k,v);
 }
 const stage=Object.fromEntries(STAGES.map(s=>[s,0])) as Record<ChainStage,number>;
 const group=new Map<string,ChainStageGroup>();
 let amended=0,original=0,proposals=0,bases=0,replay=0,rejected=0,checked=0;
 for(const source of scopes.values()){
  source.sort((a,b)=>a.sequence-b.sequence);
  const keys=new Set(source.map(x=>x.actionKey));
  if(keys.size!==source.length||
    source.some((a,i)=>i>0&&a.sequence===source[i-1]!.sequence))
   throw Error('Same-source action keys/sequence reused; cannot prove state order');
  const adoptedBefore:string[]=[];
  // If ANY earlier adopted operation lacks a source-attested proposal/base,
  // every following text-state candidate must hold even if its own edit
  // is well evidenced. A proposed patch is not the amended base state.
  let previousSourceEditsReady=true;
  for(const a of source){
   const expected=adoptedBefore;
   const chainMatched=JSON.stringify(a.priorAdoptedKeys)===JSON.stringify(expected);
   if(a.kind==='amendment'){
    amended++;
    if(a.originalSourceVerified)original++;
    if(a.proposalCapturedExactly)proposals++;
    if(a.baseComponentCount===1)bases++;
    if(chainMatched)checked++;
    let reason:ChainStage;
    if(!a.originalSourceVerified)reason='original_journal_not_verified';
    else if(!a.hasProposedText)reason='proposal_literal_absent';
    else if(!a.proposalCapturedExactly)reason='proposal_capture_not_source_attested';
    else if(!a.explicitBaseLocator)reason='explicit_base_edition_absent';
    else if(a.baseComponentCount===0)reason='base_capture_absent';
    else if(a.baseComponentCount!==1)reason='base_capture_ambiguous';
    else if(a.outcome!=='adopted'&&a.outcome!=='rejected')
     reason='adoption_outcome_unknown';
    else if(!chainMatched||!previousSourceEditsReady)reason='source_local_predecessor_chain_unproved';
    else if(a.outcome==='rejected'){
     reason='rejected_excluded_from_current_state';rejected++;
    }else{
     reason='adopted_ready_for_instruction_replay';replay++;
    }
    stage[reason]++;
    if(a.outcome==='adopted'&&reason!=='adopted_ready_for_instruction_replay')
     previousSourceEditsReady=false;
    if(a.outcome==='unknown')previousSourceEditsReady=false;
    const gk=a.session+'|'+reason,prev=group.get(gk)??{session:a.session,stage:reason,count:0};
    prev.count++;group.set(gk,prev);
   }
   // Rejected/unknown amendments are NEVER carried into the current
   // state. This guards following actions even if their text captured.
   if(a.kind==='amendment'&&a.outcome==='adopted')
    adoptedBefore.push(a.actionKey);
   // Conference/other textual substitutes may replace a bill body but
   // are not represented as a bounded literal amendment patch here.
   // Later source-local replay readiness must HOLD after such an action.
   if(a.kind==='conference')previousSourceEditsReady=false;
  }
 }
 if(amended!==Object.values(stage).reduce((n,x)=>n+x,0)
  ||amended>expectedTotal||replay+rejected>amended||checked>amended)
  throw Error('Source-only bill state readiness did not conserve amendment actions');
 return{
  schemaVersion:SENATE_STATE_CHAIN_CENSUS,
  allSourceLocalPaperActions:expectedTotal,amendmentActions:amended,
  originalVerifiedAmendments:original,exactLiteralProposalCaptures:proposals,
  proposalWithOneExplicitBase:bases,
  adoptedSourceOnlyReplayCandidates:replay,rejectedAmendmentsExcluded:rejected,
  priorSourceActionChainsChecked:checked,stages:stage,
  groups:[...group.values()].sort((a,b)=>
   a.session.localeCompare(b.session)||a.stage.localeCompare(b.stage)),
  completeAssembledStatesCertified:0,earlierThanVotePublicationCertified:0,
  proposalBodiesChanged:false,sourceDocumentsChanged:false,
  acceptedOfficialVotesChanged:false,billVersionsOrBaseBodiesChanged:false,
  originalMemberChoicesChanged:false,addedEventLinks:0,
  servingModelChanged:false
 };
}
/** All source-local current paper actions, even those without an accepted
 * event edge, are needed to conserve chronological adopted/voice actions.
 * The SQL returns boolean receipts and private keys ONLY into the protected
 * transaction. Neither full proposal text nor original bill text is queried.
 */
const SQL=[
 'SELECT a.id::text AS id,s.slug AS session,',
 'a.source_document_id::text AS "sourceDocumentId",',
 'a.bill_id::text AS "billId",a.occurred_on::text AS day,',
 'a.sequence,a.action_key AS "actionKey",a.kind,a.outcome,',
 'a.original_source_verified AS "originalSourceVerified",',
 'a.proposed_text IS NOT NULL AS "hasProposedText",',
 'a.explicit_base_locator AS "explicitBaseLocator",',
 'a.prior_adopted_action_keys AS "priorAdoptedKeys",',
 'EXISTS(SELECT 1 FROM senate_official_bill_text_captures t',
 ' JOIN source_documents d ON d.id=a.source_document_id',
 ' WHERE t.id=a.proposal_capture_id',
 " AND t.family='amendment' AND t.source_document_id=d.id",
 ' AND t.bill_id=a.bill_id AND t.source_url=a.source_url',
 ' AND t.original_body_sha256=d.content_sha256',
 " AND t.extracted_text_sha256=encode(sha256(convert_to(a.proposed_text,'UTF8')),'hex')",
 ") AS \"proposalCapturedExactly\",",
 '(SELECT count(*)::int FROM senate_vote_paper_components_current_v c',
 ' WHERE c.action_id=a.id AND c.relation=$1) AS "baseComponentCount"',
 'FROM senate_vote_paper_current_v a',
 'JOIN bills b ON b.id=a.bill_id',
 'JOIN legislative_sessions s ON s.id=b.session_id',
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')",
 'ORDER BY a.source_document_id,a.bill_id,a.occurred_on,a.sequence,a.id',
 'LIMIT 6501'
].join(' ');
/** Caller holds independently authenticated REPEATABLE READ READ ONLY. */
export async function readSourceStateChainCensus(db:PoolClient):Promise<StateChainCensus>{
 const rows=(await db.query<SourceChainAction>(SQL,['explicit_base_locator'])).rows;
 if(rows.length>=6501)throw Error('Source-only state evidence population truncated');
 const actual=(await db.query<{n:number}>([
 'SELECT count(*)::int AS n FROM senate_vote_paper_current_v a',
 'JOIN bills b ON b.id=a.bill_id JOIN legislative_sessions s ON s.id=b.session_id',
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')"
 ].join(' '))).rows[0]?.n;
 if(actual===undefined)throw Error('Source-only state evidence independent denominator unavailable');
 return summarizeSourceStateChain(rows,actual);
}
