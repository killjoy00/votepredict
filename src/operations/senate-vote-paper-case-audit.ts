/** Bounded source-pinned read-only case audit: never print text, IDs, member names, or ballots. */
import type {PoolClient} from 'pg';
import {ballotSignature,compact,rollMatches} from './senate-vote-paper-parser.js';
export const CASE_AUDIT_VERSION='senate-source-case-audit-v1' as const;
interface ActionRow {
 id:string;source_id:string;source_url:string;bill:string;day:string;kind:string;sequence:number;
 yea_count:number|null;nay_count:number|null;ballot_sha256:string|null;
 question_text:string;motion_text:string;original_source_verified:boolean;
}
interface VoteRow {
 id:string;source_id:string;source_url:string;bill:string|null;day:string;vote_kind:string;
 motion_text:string;yea_count:number;nay_count:number;
 votes:Array<{name:string;choice:string}>;exact_linked:boolean;
}
export type CandidateStage='no_action_ballot'|'no_accepted_ballot'|
 'unique_ballot_question_mismatch'|'unique_ballot_unknown_bill'|
 'ambiguous_ballot'|'exactly_matched_question';
const auditCases=[
 {bill:'HF100',day:'2023-04-28'},
 {bill:'HF1',day:'2023-01-27'},
 {bill:'HF7',day:'2023-02-02'},
] as const;
export interface CaseSummary {
 bill:string;day:string;parsedActions:number;namedRollActions:number;
 acceptedBillVotes:number;acceptedUnknownBillVotes:number;exactBillLinks:number;
 verifiedOriginalActions:number;stages:Record<CandidateStage,number>;
 unlinkedAcceptedVotes:number;unlinkedVotesWithOneActionSameBallot:number;
 unlinkedVotesWithManyActionsSameBallot:number;
}
export interface Hf100ActionSummary {
 sequence:number;kind:string;division:string|null;
 candidateStage:CandidateStage;candidateCount:number;unknownBillCandidates:number;
}
export interface SenateSourceCaseAudit {
 schemaVersion:typeof CASE_AUDIT_VERSION;cases:CaseSummary[];hf100Actions:Hf100ActionSummary[];
}
export function questionCore(t:string):string {
 const markers=[...t.matchAll(/The question (?:was taken|recurred)/gi)];
 return compact(markers.length?t.slice(markers.at(-1)!.index):t).slice(0,800);
}
function signature(v:VoteRow):string|null {
 return ballotSignature(v.votes,v.yea_count,v.nay_count);
}
function matchingBallots(a:ActionRow,votes:VoteRow[]):VoteRow[]{
 return votes.filter(v=>v.source_url===a.source_url&&v.day===a.day
  &&(v.source_id===a.source_id||a.original_source_verified)
  &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count
  &&a.ballot_sha256!==null&&a.ballot_sha256===signature(v));
}
/** Same-ballot candidates are NOT proof of exact question identity. */
export function candidateStage(a:ActionRow,votes:VoteRow[]):CandidateStage {
 if(a.yea_count===null||a.nay_count===null||!a.ballot_sha256)return 'no_action_ballot';
 const candidates=matchingBallots(a,votes);
 if(!candidates.length)return 'no_accepted_ballot';
 if(candidates.length!==1)return 'ambiguous_ballot';
 const v=candidates[0];
 if(v.bill===null)return 'unique_ballot_unknown_bill';
 if(v.bill!==a.bill)return 'no_accepted_ballot';
 const paper=({billIdentifier:a.bill,yeas:a.yea_count,nays:a.nay_count,
  ballotSignature:a.ballot_sha256,questionText:a.question_text} as unknown) as Parameters<typeof rollMatches>[0];
 return rollMatches(paper,{billIdentifier:v.bill,yeas:v.yea_count,nays:v.nay_count,
  ballotSignature:signature(v),motionText:v.motion_text})
  ?'exactly_matched_question':'unique_ballot_question_mismatch';
}
export function summarizeCase(bill:string,day:string,actions:ActionRow[],votes:VoteRow[]):CaseSummary{
 const scoped=actions.filter(a=>a.bill===bill&&a.day===day);
 const selected=votes.filter(v=>v.day===day&&scoped.some(a=>a.source_url===v.source_url
  &&(a.source_id===v.source_id||a.original_source_verified)));
 const same=selected.filter(v=>v.bill===bill);
 const anonymous=selected.filter(v=>v.bill===null);
 const stages:Record<CandidateStage,number>={
  no_action_ballot:0,no_accepted_ballot:0,unique_ballot_question_mismatch:0,
  unique_ballot_unknown_bill:0,ambiguous_ballot:0,exactly_matched_question:0,
 };
 for(const a of scoped)stages[candidateStage(a,selected)]++;
 const unlinked=same.filter(v=>!v.exact_linked);
 const actionCounts=unlinked.map(v=>scoped.filter(a=>a.source_url===v.source_url
  &&(a.source_id===v.source_id||a.original_source_verified)
  &&a.yea_count===v.yea_count&&a.nay_count===v.nay_count
  &&a.ballot_sha256!==null&&a.ballot_sha256===signature(v)).length);
 return {bill,day,parsedActions:scoped.length,
  namedRollActions:scoped.filter(a=>a.ballot_sha256!==null).length,
  acceptedBillVotes:same.length,acceptedUnknownBillVotes:anonymous.length,
  exactBillLinks:same.filter(v=>v.exact_linked).length,
  verifiedOriginalActions:scoped.filter(a=>a.original_source_verified).length,stages,
  unlinkedAcceptedVotes:unlinked.length,
  unlinkedVotesWithOneActionSameBallot:actionCounts.filter(n=>n===1).length,
  unlinkedVotesWithManyActionsSameBallot:actionCounts.filter(n=>n>1).length};
}
/** Caller holds verified REPEATABLE READ READ ONLY transaction with rollback. */
export async function readSenateSourceCaseAudit(db:PoolClient):Promise<SenateSourceCaseAudit>{
 const where=[
  "(b.identifier='HF100' AND a.occurred_on=DATE '2023-04-28')",
  "(b.identifier='HF1' AND a.occurred_on=DATE '2023-01-27')",
  "(b.identifier='HF7' AND a.occurred_on=DATE '2023-02-02')",
 ].join(' OR ');
 const actions=(await db.query<ActionRow>([
  'SELECT a.id::text AS id,a.source_document_id::text AS source_id,a.source_url,',
  'b.identifier AS bill,a.occurred_on::text AS day,a.kind,a.sequence,',
  'a.yea_count,a.nay_count,a.ballot_sha256,a.question_text,a.motion_text,',
  'a.original_source_verified FROM senate_vote_paper_current_v a',
  'JOIN bills b ON b.id=a.bill_id JOIN legislative_sessions s ON s.id=b.session_id',
  "WHERE s.slug='2023-2024' AND ("+where+')',
  'ORDER BY b.identifier,a.occurred_on,a.sequence LIMIT 301'
 ].join(' '))).rows;
 if(!actions.length||actions.length>=301)throw Error('Case action bound or missing data');
 const votes=(await db.query<VoteRow>([
  'WITH scoped AS MATERIALIZED (SELECT DISTINCT a.source_url,a.occurred_on',
  'FROM senate_vote_paper_current_v a JOIN bills b ON b.id=a.bill_id',
  'JOIN legislative_sessions s ON s.id=b.session_id',
  "WHERE s.slug='2023-2024' AND ("+where+'))',
  'SELECT v.id::text AS id,v.source_document_id::text AS source_id,d.source_url,',
  'b.identifier AS bill,v.occurred_on::text AS day,v.vote_kind,',
  'v.motion_text,v.yea_count,v.nay_count,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',m.source_member_name,",
  "'choice',m.choice)) FROM member_votes m WHERE m.vote_event_id=v.id),'[]'::jsonb) AS votes,",
  'EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v x',
  'WHERE x.vote_event_id=v.id) AS exact_linked',
  'FROM scoped scoped_source JOIN source_documents d ON d.source_url=scoped_source.source_url',
  'JOIN vote_events v ON v.source_document_id=d.id',
  'AND v.occurred_on=scoped_source.occurred_on LEFT JOIN bills b ON b.id=v.bill_id',
  'ORDER BY v.occurred_on,v.id LIMIT 1201'
 ].join(' '))).rows;
 if(votes.length>=1201)throw Error('Case vote bound exceeded');
 const cases=auditCases.map(c=>summarizeCase(c.bill,c.day,actions,votes));
 const hf100Actions=actions.filter(a=>a.bill==='HF100'&&a.day==='2023-04-28')
  .map(a=>{const matches=matchingBallots(a,votes);return{
   sequence:a.sequence,kind:a.kind,
   division:a.yea_count===null||a.nay_count===null?null:a.yea_count+'-'+a.nay_count,
   candidateStage:candidateStage(a,votes),candidateCount:matches.length,
   unknownBillCandidates:matches.filter(v=>v.bill===null).length,
  };});
 if(cases.some(c=>c.parsedActions===0)||cases.length!==3)throw Error('Case audit missing original paper');
 return {schemaVersion:CASE_AUDIT_VERSION,cases,hf100Actions};
}
