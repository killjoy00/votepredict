/** Protected, read-only nested source-paper to accepted-vote candidate audit.
 * NEVER emit original PDF text, printed member ballots, member names, private
 * event IDs or candidate signature digests in CI readback. No DB writes.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,compact} from './senate-vote-paper-parser.js';
import {questionCore} from './senate-vote-paper-case-audit.js';
import {parseNestedSenateSourcePapers,NESTED_PAPER_PARSER_VERSION,type NestedSenateSourcePaper} from './senate-vote-paper-nested.js';

export const NESTED_ACCEPTED_AUDIT_VERSION='senate-nested-accepted-candidates-v1' as const;
const CASES=[
 {bill:'HF1',day:'2023-01-27',sourceUrl:'https://www.senate.mn/journals/2023-2024/20230127014.pdf',
  originalSha:'0604a308854471523dcd282769cfadb45ed403d1ad39383a3d20438393e3fd52',papers:18},
 {bill:'HF7',day:'2023-02-02',sourceUrl:'https://www.senate.mn/journals/2023-2024/20230202017.pdf',
  originalSha:'e60b103c2a0ad32dc13b6bb1480fa5197810ce7ecdc2b9480edf97d63ee7060c',papers:17},
] as const;

export type NestedCandidateStage =
 'source_ballot_unavailable'|'accepted_ballot_absent'|'repeated_accepted_ballot'|
 'accepted_bill_unresolved'|'different_bill'|'non_amendment_event'|
 'accepted_already_exact'|'different_question'|'repeated_source_question'|
 'unique_question_and_full_ballot_candidate';
export const STAGES:readonly NestedCandidateStage[]=[
 'source_ballot_unavailable','accepted_ballot_absent','repeated_accepted_ballot',
 'accepted_bill_unresolved','different_bill','non_amendment_event',
 'accepted_already_exact','different_question','repeated_source_question',
 'unique_question_and_full_ballot_candidate',
];
export interface AcceptedSourceVote {
 /** Internal join identity; never serialize this value to the report. */
 eventId:string;
 sourceUrl:string;day:string;billIdentifier:string|null;voteKind:string;motionText:string;
 yeas:number;nays:number;
 votes:Array<{name:string;choice:string}>;
 existingExact:boolean;
}
export interface NestedCandidateSummary {
 bill:string;day:string;
 proposedSourceActions:number;sourceNamedBallots:number;distinctPrintedQuestions:number;
 acceptedBillVotes:number;acceptedUnknownBillVotes:number;acceptedAlreadyExact:number;
 stages:Record<NestedCandidateStage,number>;
 uniqueCandidateVotes:number;
}
export interface NestedAcceptedAudit {
 schemaVersion:typeof NESTED_ACCEPTED_AUDIT_VERSION;
 sourceProofRequired:true;
 cases:NestedCandidateSummary[];
 acceptedEventsChanged:false;
 rawVotesChanged:false;
 sourceBodiesChanged:false;
 linksCreated:0;
}

/**
 * A candidate is NOT an accepted link. Uniqueness must hold in both the
 * accepted-event population and the printed-source population. A repeated
 * ballot is a hold, even when one nearby wording looks plausible.
 */
export function classifyNestedCandidate(
 paper:NestedSenateSourcePaper,
 peers:readonly NestedSenateSourcePaper[],
 accepted:readonly AcceptedSourceVote[],
 sourceUrl:string,day:string
):NestedCandidateStage {
 if(paper.ballotSha256===null||paper.yeas===null||paper.nays===null)return 'source_ballot_unavailable';
 const sameBallot=accepted.filter(e=>e.sourceUrl===sourceUrl&&e.day===day
  &&e.yeas===paper.yeas&&e.nays===paper.nays
  &&ballotSignature(e.votes,e.yeas,e.nays)===paper.ballotSha256);
 if(sameBallot.length===0)return 'accepted_ballot_absent';
 if(sameBallot.length!==1)return 'repeated_accepted_ballot';
 const target=sameBallot[0]!;
 if(target.billIdentifier===null)return 'accepted_bill_unresolved';
 if(target.billIdentifier!==paper.billIdentifier)return 'different_bill';
 if(target.voteKind!=='amendment')return 'non_amendment_event';
 if(target.existingExact)return 'accepted_already_exact';
 if(questionCore(target.motionText)!==questionCore(paper.questionText))return 'different_question';
 const sameSourcePaper=peers.filter(p=>p.ballotSha256!==null
  &&p.ballotSha256===paper.ballotSha256&&p.yeas===paper.yeas&&p.nays===paper.nays
  &&questionCore(p.questionText)===questionCore(paper.questionText));
 if(sameSourcePaper.length!==1)return 'repeated_source_question';
 return 'unique_question_and_full_ballot_candidate';
}

export function summarizeNestedCandidates(
 bill:string,day:string,sourceUrl:string,
 papers:readonly NestedSenateSourcePaper[],events:readonly AcceptedSourceVote[]
):NestedCandidateSummary {
 const scoped=papers.filter(p=>p.billIdentifier===bill);
 const votes=events.filter(v=>v.sourceUrl===sourceUrl&&v.day===day);
 const stages=Object.fromEntries(STAGES.map(k=>[k,0])) as Record<NestedCandidateStage,number>;
 const uniqueVotes=new Set<string>();
 for(const p of scoped){
  const stage=classifyNestedCandidate(p,scoped,votes,sourceUrl,day);
  stages[stage]++;
  if(stage==='unique_question_and_full_ballot_candidate'){
   const matches=votes.filter(e=>e.yeas===p.yeas&&e.nays===p.nays&&
    ballotSignature(e.votes,e.yeas,e.nays)===p.ballotSha256);
   if(matches.length!==1)throw Error('Nested candidate one-to-one check failed');
   if(uniqueVotes.has(matches[0]!.eventId))throw Error('Two nested source papers matched one accepted event');
   uniqueVotes.add(matches[0]!.eventId);
  }
 }
 if(Object.values(stages).reduce((a,b)=>a+b,0)!==scoped.length)
  throw Error('Nested candidate coverage failed conservation');
 return {bill,day,proposedSourceActions:scoped.length,
  sourceNamedBallots:scoped.filter(p=>p.ballotSha256!==null).length,
  distinctPrintedQuestions:new Set(scoped.map(p=>questionCore(p.questionText))).size,
  acceptedBillVotes:votes.filter(v=>v.billIdentifier===bill).length,
  acceptedUnknownBillVotes:votes.filter(v=>v.billIdentifier===null).length,
  acceptedAlreadyExact:votes.filter(v=>v.billIdentifier===bill&&v.existingExact).length,
  stages,uniqueCandidateVotes:uniqueVotes.size};
}

interface SourceRow{
 sourceId:string;sourceUrl:string;sourceDate:string;body:string;
 originalVerified:boolean;
}
const SOURCES_SQL=[
 "SELECT d.id::text AS \"sourceId\",d.source_url AS \"sourceUrl\",",
 "d.metadata#>>'{rawPrepassageVotes,sourceDate}' AS \"sourceDate\",",
 "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
 "EXISTS(SELECT 1 FROM senate_paper_source_verifications proof",
 " WHERE proof.source_document_id=d.id AND proof.source_url=d.source_url",
 " AND proof.original_body_sha256::text=(CASE WHEN d.source_url=$1 THEN $3 ELSE $4 END)",
 " AND proof.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex')) AS \"originalVerified\"",
 "FROM source_documents d JOIN legislative_sessions s ON s.id=d.session_id",
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "WHERE s.slug='2023-2024' AND d.source_url IN ($1,$2)",
 "AND d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'",
 "ORDER BY d.source_url,d.id LIMIT 4",
].join(' ');

const ACCEPTED_SQL=[
 "SELECT v.id::text AS \"eventId\",d.source_url AS \"sourceUrl\",",
 "v.occurred_on::text AS day,b.identifier AS \"billIdentifier\",",
 "v.vote_kind AS \"voteKind\",v.motion_text AS \"motionText\",",
 "v.yea_count AS yeas,v.nay_count AS nays,",
 "coalesce((SELECT jsonb_agg(jsonb_build_object('name',mv.source_member_name,'choice',mv.choice))",
 "FROM member_votes mv WHERE mv.vote_event_id=v.id),'[]'::jsonb) AS votes,",
 "EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v exact",
 "WHERE exact.vote_event_id=v.id) AS \"existingExact\"",
 "FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id",
 "JOIN legislative_sessions s ON s.id=v.session_id",
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 "JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'",
 "LEFT JOIN bills b ON b.id=v.bill_id",
 "WHERE s.slug='2023-2024' AND d.source_url IN ($1,$2)",
 "AND v.occurred_on IN (DATE '2023-01-27',DATE '2023-02-02')",
 "ORDER BY d.source_url,v.id LIMIT 1201",
].join(' ');

/** Caller holds independently verified REPEATABLE READ READ ONLY + rollback. */
export async function readNestedAcceptedAudit(db:PoolClient):Promise<NestedAcceptedAudit> {
 if(NESTED_PAPER_PARSER_VERSION!=='senate-nested-source-paper-v2')
  throw Error('Nested source candidate audit requires reviewed v2 extractor');
 const origins=(await db.query<SourceRow>(SOURCES_SQL,[
  CASES[0].sourceUrl,CASES[1].sourceUrl,CASES[0].originalSha,CASES[1].originalSha
 ])).rows;
 if(origins.length!==2||new Set(origins.map(r=>r.sourceUrl)).size!==2)
  throw Error('Nested official source originals absent or duplicated');
 const rows=(await db.query<AcceptedSourceVote>(ACCEPTED_SQL,[CASES[0].sourceUrl,CASES[1].sourceUrl])).rows;
 if(rows.length>=1201)throw Error('Nested accepted-event audit bound exceeded');
 const cases:NestedCandidateSummary[]=[];
 for(const c of CASES){
  const source=origins.find(x=>x.sourceUrl===c.sourceUrl);
  if(!source||!source.originalVerified||source.sourceDate!==c.day
   ||typeof source.body!=='string'||source.body.length>8_000_000||source.body.length<1000)
   throw Error('Nested accepted audit requires pinned authenticated original source text');
  const rosterEnd=source.body.indexOf('The President declared');
  if(rosterEnd<0)throw Error('Nested accepted audit missing original government roster context');
  const names=[...new Set(source.body.slice(0,rosterEnd).split('\n').map(x=>x.trim())
   .filter(x=>/^[A-Z][A-Za-z ]+$/.test(x)))];
  if(names.length<30||names.length>250)throw Error('Nested original roster count outside authenticated bounds');
  const papers=parseNestedSenateSourcePapers(source.body,names).filter(p=>p.billIdentifier===c.bill);
  if(papers.length!==c.papers||papers.some(p=>p.appliesDirectlyToBill||p.acceptedVoteEventLinked||p.fullBillTextAssembled))
   throw Error('Nested paper source-only conservation or fail-closed contract changed');
  const summary=summarizeNestedCandidates(c.bill,c.day,c.sourceUrl,papers,rows);
  if(summary.proposedSourceActions!==c.papers)throw Error('Nested proposal source count drift');
  cases.push(summary);
 }
 return {schemaVersion:NESTED_ACCEPTED_AUDIT_VERSION,sourceProofRequired:true,
  cases,acceptedEventsChanged:false,rawVotesChanged:false,sourceBodiesChanged:false,linksCreated:0};
}
