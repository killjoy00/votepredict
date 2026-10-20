/** Source-pinned, READ-ONLY HF100 original amendment chain readiness audit.
 * This is an evidence inventory, NOT an assembled amended bill or a
 * pre-vote public-availability finding. Never log literal source bodies,
 * member ballots, private UUIDs or source/action identifiers.
 */
import type {PoolClient} from 'pg';

export const HF100_CHAIN_READINESS_VERSION='senate-hf100-chain-readiness-v1' as const;
const ORIGINAL='https://www.senate.mn/journals/2023-2024/20230428059.pdf';
const DAY='2023-04-28';
const EXPLICIT_BASE='versions/ue/1/';

export interface Hf100ChainEvidenceRow{
 sequence:number;actionKey:string;kind:string;outcome:string;
 proposedText:string|null;explicitBaseLocator:string|null;
 priorAdoptedKeys:string[];originalSourceVerified:boolean;
 captureVerified:boolean;baseComponents:number;
}
export interface Hf100TextChainReadiness{
 schemaVersion:typeof HF100_CHAIN_READINESS_VERSION;
 case:'HF100';proceedingOn:typeof DAY;
 originalPaperActions:8;proposedAmendments:5;adoptedAmendments:4;rejectedAmendments:1;
 explicitBase:'first_unofficial_engrossment';
 verifiedLiteralProposalCaptures:number;
 proposalsWithOneUnambiguousBaseCapture:number;proposalsWithAmbiguousBase:number;
 proposalsWithoutVerifiedCapture:number;
 proposalsWithoutUnambiguousBase:number;
 passageCarriesFourSourceAdoptions:true;
 rejectedAmendmentExcludedFromPassage:true;
 completeAssembledBillText:false;
 preVotePublicationProven:false;
 addedEventLinks:0;
}

/** Verify original amendment sequencing without ever promoting raw text to bill state. */
export function summarizeHf100TextChain(rows:readonly Hf100ChainEvidenceRow[]):Hf100TextChainReadiness{
 if(rows.length!==8||rows.some((r,i)=>r.sequence!==i+2)||rows.some(r=>!r.originalSourceVerified))
  throw Error('HF100 original journal chain count, sequence or provenance changed');
 const proposals=rows.filter(r=>r.kind==='amendment'&&r.proposedText!==null);
 const adopted=proposals.filter(p=>p.outcome==='adopted');
 const rejected=proposals.filter(p=>p.outcome==='rejected');
 const passage=rows.at(-1);
 if(proposals.length!==5||adopted.length!==4||rejected.length!==1
  ||proposals.some(p=>!p.proposedText?.trim()||p.explicitBaseLocator!==EXPLICIT_BASE)
  ||rows.some(r=>!Number.isInteger(r.baseComponents)||r.baseComponents<0||r.baseComponents>100)
  ||!passage||passage.kind!=='passage'||passage.proposedText!==null
  ||!Array.isArray(passage.priorAdoptedKeys))
  throw Error('HF100 proposal, base locator, passage or evidence-count contract drift');
 const expected=adopted.map(p=>p.actionKey);
 if(new Set(expected).size!==4||JSON.stringify(passage.priorAdoptedKeys)!==JSON.stringify(expected)
  ||passage.priorAdoptedKeys.includes(rejected[0]!.actionKey))
  throw Error('HF100 rejected or out-of-order amendment may not enter passage text chain');
 const verified=proposals.filter(p=>p.captureVerified).length;
 const exact=proposals.filter(p=>p.baseComponents===1).length;
 const ambiguous=proposals.filter(p=>p.baseComponents>1).length;
 return {schemaVersion:HF100_CHAIN_READINESS_VERSION,case:'HF100',proceedingOn:DAY,
  originalPaperActions:8,proposedAmendments:5,adoptedAmendments:4,rejectedAmendments:1,
  explicitBase:'first_unofficial_engrossment',
  verifiedLiteralProposalCaptures:verified,proposalsWithOneUnambiguousBaseCapture:exact,proposalsWithAmbiguousBase:ambiguous,
  proposalsWithoutVerifiedCapture:5-verified,proposalsWithoutUnambiguousBase:5-exact,
  passageCarriesFourSourceAdoptions:true,rejectedAmendmentExcludedFromPassage:true,
  completeAssembledBillText:false,preVotePublicationProven:false,addedEventLinks:0};
}

const SQL=[
 'SELECT a.sequence,a.action_key AS "actionKey",a.kind,a.outcome,',
 'a.proposed_text AS "proposedText",a.explicit_base_locator AS "explicitBaseLocator",',
 'a.prior_adopted_action_keys AS "priorAdoptedKeys",',
 'a.original_source_verified AS "originalSourceVerified",',
 'EXISTS(SELECT 1 FROM senate_official_bill_text_captures captured',
 ' JOIN source_documents original ON original.id=a.source_document_id',
 " WHERE captured.id=a.proposal_capture_id AND captured.family='amendment'",
 ' AND captured.bill_id=a.bill_id AND captured.source_document_id=a.source_document_id',
 ' AND captured.source_url=a.source_url AND captured.original_body_sha256=original.content_sha256',
 " AND captured.body_hash_provenance='existing_source_document_fingerprint'",
 " AND captured.extracted_text_sha256=encode(sha256(convert_to(a.proposed_text,'UTF8')),'hex')",
 ') AS "captureVerified",',
 '(SELECT count(*)::int FROM senate_vote_paper_components_current_v component',
 ' JOIN senate_official_bill_text_captures base ON base.id=component.capture_id',
 " WHERE component.action_id=a.id AND component.relation='explicit_base_locator'",
 " AND base.family='unofficial_engrossment'",
 ' AND base.bill_id=a.bill_id AND base.source_locator=a.explicit_base_locator',
 ') AS "baseComponents"',
 'FROM senate_vote_paper_current_v a JOIN bills bill ON bill.id=a.bill_id',
 'JOIN legislative_sessions s ON s.id=bill.session_id',
 "WHERE s.slug='2023-2024' AND bill.identifier='HF100'",
 "AND a.occurred_on=DATE '2023-04-28' AND a.source_url=$1",
 'ORDER BY a.sequence LIMIT 9',
].join(' ');

/** Caller guarantees verified REPEATABLE READ READ ONLY with explicit ROLLBACK. */
export async function readHf100TextChainReadiness(db:PoolClient):Promise<Hf100TextChainReadiness>{
 const rows=(await db.query<Hf100ChainEvidenceRow>(SQL,[ORIGINAL])).rows;
 return summarizeHf100TextChain(rows);
}
