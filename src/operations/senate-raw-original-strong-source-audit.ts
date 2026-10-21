/**
 * Independent source-SIDE research audit of the 105 preliminary raw Senate
 * Journal exact-question/full-named-ballot candidates. Never writes links.
 *
 * The original raw ingester has no persisted printed question span. Before
 * allowing any such link, independently bind each parsed roll to an actual
 * printed source roll header, the immediately preceding printed question,
 * and the original source bill and page context. Require the complete
 * named ballot to be UNIQUE ACROSS THE ENTIRE ORIGINAL JOURNAL, not merely
 * the accepted event population or bill/day. This is a conservative hold.
 */
import {ballotSignature,billIdentifier,compact,parseJournalPaperActions}
 from './senate-vote-paper-parser.js';
import {parseNestedSenateSourcePapers}
 from './senate-vote-paper-nested.js';
import {parseSenateJournalText}
 from '../sources/minnesota/senate-journals.js';
import {independentlyPrintedAttendanceNames}
 from './senate-2022-passage-roster-shadow.js';
import {questionCore} from './senate-vote-paper-case-audit.js';
import type {PreliminaryRawOriginalCandidate,OriginalJournal}
 from './senate-no-tally-original-census.js';

export const SENATE_RAW_STRONG_SOURCE_AUDIT='senate-original-raw-question-span-audit-v1' as const;
export type RawSourceStage=
 'original_document_or_roster_unverified'|'raw_header_parser_misaligned'|
 'raw_exact_source_roll_absent_or_repeated'|
 'ballot_repeated_in_original_source'|'separate_nested_question_same_ballot'|
 'separate_direct_paper_question_same_ballot'|
 'printed_question_span_or_bill_unproven'|
 'unique_original_source_question_and_ballot';

export interface RawOriginalQuestionProof {
 voteId:string;sourceDocumentId:string;
 sourceUrl:string;billId:string;bill:string;day:string;
 voteKind:string;printedQuestion:string;acceptedMotion:string;
 questionStart:number;rollStart:number;sourceRollOrdinal:number;
 yeas:number;nays:number;ballotSha256:string;
}
export interface RawStrongSourceAudit {
 schemaVersion:typeof SENATE_RAW_STRONG_SOURCE_AUDIT;
 preliminaryOriginalRawCandidates:number;
 authenticatedSourceDocuments:number;
 strictlyPrintedAndSourceUnique:number;
 stages:Record<RawSourceStage,number>;
 examples:Array<{session:string;bill:string;day:string;stage:RawSourceStage;votes:number}>;
 newLinksCreated:0;sourceBodiesChanged:false;acceptedVotesChanged:false;
 completeAmendedBillStatesCertified:0;
}

const STAGES:readonly RawSourceStage[]=[
 'original_document_or_roster_unverified','raw_header_parser_misaligned',
 'raw_exact_source_roll_absent_or_repeated',
 'ballot_repeated_in_original_source','separate_nested_question_same_ballot',
 'separate_direct_paper_question_same_ballot',
 'printed_question_span_or_bill_unproven',
 'unique_original_source_question_and_ballot'
];
/** EXACT matching sequence from the public Senate Journal original-roll
 * ingestion parser, for independent original character offset tracking.
 * Counts must reconcile one-to-one with its complete raw parsed rolls.
 */
const sourceRoll= /The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:\s*Those who voted in the affirmative were:\s*([\s\S]*?)(?=Those who voted in the negative were:|The motion|So(?:\s|,)|The amendment|RECONSIDERATION|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS|MEMBERS EXCUSED|ADJOURNMENT)/gi;
interface SourceRoll {
 bill:string|null;yeas:number;nays:number;ballot:string|null;
 question:string;
 sourceStart:number;
 printedQuestionStart:number|null;
 printedQuestionText:string|null;
}
interface VerifiedSource {
 sourceId:string;
 sourceValid:boolean;aligned:boolean;
 rolls:SourceRoll[];
 direct:Array<{ballot:string|null;yeas:number|null;nays:number|null}>;
 nested:Array<{ballot:string|null;yeas:number|null;nays:number|null}>;
}
function sourceSummary(d:OriginalJournal):VerifiedSource {
 const missing:VerifiedSource={sourceId:d.id,sourceValid:false,aligned:false,
  rolls:[],direct:[],nested:[]};
 const text=d.body;
 if(!d.original_verified||d.source_type!=='mn_senate_journal'
  ||typeof text!=='string'||text.length<2000||text.length>8_000_000
  ||text.includes('\r')
  ||!/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/.test(d.source_url))
  return missing;
 const roster=independentlyPrintedAttendanceNames(text);
 if(roster.length<55||roster.length>67)return missing;
 let parsed:ReturnType<typeof parseSenateJournalText>,
  direct:ReturnType<typeof parseJournalPaperActions>,
  nested:ReturnType<typeof parseNestedSenateSourcePapers>;
 try{
  parsed=parseSenateJournalText({text,sessionKey:'source-only',
   sourceUrl:d.source_url,knownMemberNames:roster,allowRosterMismatch:true});
  direct=parseJournalPaperActions(text,roster);
  nested=parseNestedSenateSourcePapers(text,roster);
 }catch{return {...missing,sourceValid:true}}
 const originalHeaders=[...text.matchAll(sourceRoll)];
 if(originalHeaders.length!==parsed.length||originalHeaders.length>600)
  return {...missing,sourceValid:true};
 const rolls:SourceRoll[]=[];
 for(let i=0;i<parsed.length;i++){
  const r=parsed[i]!,h=originalHeaders[i]!,start=h.index;
  if(start===undefined||Number(h[1])!==r.yeaCount||Number(h[2])!==r.nayCount)
   return {...missing,sourceValid:true};
  const from=Math.max(0,start-2600);
  const context=text.slice(from,start);
  const markers=[...context.matchAll(/The question (?:was taken on|recurred on|was taken:)/gi)];
  const at=markers.length?from+markers.at(-1)!.index!:null;
  const printed=at===null?null:compact(text.slice(at,start));
  const lastBill=[...context.matchAll(/(?:S\.?F\.?|H\.?F\.?)\s*(?:No\.?)?\s*\d+/gi)].at(-1);
  rolls.push({
   bill:r.billIdentifier??null,yeas:r.yeaCount,nays:r.nayCount,
   ballot:ballotSignature(r.memberVotes.map(m=>({
    name:m.sourceName,choice:m.choice
   })),r.yeaCount,r.nayCount),
   question:questionCore(r.motionText),sourceStart:start,
   printedQuestionStart:at,
   printedQuestionText:lastBill&&billIdentifier(lastBill[0])===r.billIdentifier
    ?printed:null
  });
 }
 return{
  sourceId:d.id,sourceValid:true,aligned:true,rolls,
  direct:direct.map(p=>({ballot:p.ballotSignature,yeas:p.yeas,nays:p.nays})),
  nested:nested.map(p=>({ballot:p.ballotSha256,yeas:p.yeas,nays:p.nays}))
 };
}
/** No part of this proof permits source/accepted matching by tally,
 * chronology or shared bill alone. Source roll reuse is a hard hold.
 * Callback carries private IDs only inside the protected transaction.
 */
export function summarizeRawOriginalStrongSource(
 preliminary:readonly PreliminaryRawOriginalCandidate[],
 expected:number,
 onUnique?: (proof:RawOriginalQuestionProof)=>void
):RawStrongSourceAudit {
 if(!Number.isSafeInteger(expected)||expected<0||expected>300
  ||preliminary.length!==expected
  ||new Set(preliminary.map(x=>x.vote.id)).size!==preliminary.length)
  throw Error('Original raw source span proof candidate denominator/identity mismatch');
 const docs=new Map<string,OriginalJournal>();
 for(const c of preliminary){
  const previous=docs.get(c.originalDocument.id);
  if(previous&&previous!==c.originalDocument)
   throw Error('Original raw source has duplicate changing body identity');
  docs.set(c.originalDocument.id,c.originalDocument);
 }
 if(docs.size>220)throw Error('Original raw source corpus exceeds read-only bounds');
 const parsed=new Map([...docs.values()].map(x=>[x.id,sourceSummary(x)]));
 const stages=Object.fromEntries(STAGES.map(x=>[x,0])) as Record<RawSourceStage,number>;
 const examples=new Map<string,{session:string;bill:string;day:string;stage:RawSourceStage;votes:number}>();
 for(const c of preliminary){
  const v=c.vote,d=c.originalDocument,view=parsed.get(d.id)!;
  if(!/^(HF|SF)[1-9]\d{0,5}$/.test(v.bill)
   ||!/^202[1-6]-\d\d-\d\d$/.test(v.day)
   ||!['2021-2022','2023-2024','2025-2026'].includes(v.session))
   throw Error('Untrusted public bill/session/day identifier in original raw audit');
  const signature=ballotSignature(v.votes,v.yea_count,v.nay_count);
  let stage:RawSourceStage;
  if(!view.sourceValid||d.source_url!==v.source_url||!signature)
   stage='original_document_or_roster_unverified';
  else if(!view.aligned)stage='raw_header_parser_misaligned';
  else{
   const complete=view.rolls.filter(p=>p.bill===v.bill
    &&p.yeas===v.yea_count&&p.nays===v.nay_count
    &&p.ballot===signature&&p.ballot!==null
    &&p.question===questionCore(v.motion_text));
   const sameBallot=view.rolls.filter(p=>p.yeas===v.yea_count
    &&p.nays===v.nay_count&&p.ballot===signature);
   const older=view.direct.filter(p=>p.yeas===v.yea_count
    &&p.nays===v.nay_count&&p.ballot===signature);
   const nested=view.nested.filter(p=>p.yeas===v.yea_count
    &&p.nays===v.nay_count&&p.ballot===signature);
   if(complete.length!==1)stage='raw_exact_source_roll_absent_or_repeated';
   else if(sameBallot.length!==1)stage='ballot_repeated_in_original_source';
   else if(nested.length)stage='separate_nested_question_same_ballot';
   else if(older.length)stage='separate_direct_paper_question_same_ballot';
   else{
    const p=complete[0]!,at=p.printedQuestionStart,question=p.printedQuestionText;
    if(at===null||question===null||at<0||at>=p.sourceStart
     ||question.length<40||question.length>800
     ||questionCore(question)!==questionCore(v.motion_text)
     ||questionCore(question)!==p.question
     ||question.includes('The roll was called,'))
     stage='printed_question_span_or_bill_unproven';
    else{
     stage='unique_original_source_question_and_ballot';
     if(onUnique)onUnique({
      voteId:v.id,sourceDocumentId:d.id,sourceUrl:d.source_url,
      billId:v.bill_id,bill:v.bill,day:v.day,voteKind:v.vote_kind,
      printedQuestion:question,acceptedMotion:v.motion_text,
      questionStart:at,rollStart:p.sourceStart,
      sourceRollOrdinal:view.rolls.indexOf(p)+1,
      yeas:v.yea_count,nays:v.nay_count,ballotSha256:signature
     });
    }
   }
  }
  stages[stage]++;
  const key=JSON.stringify([v.session,v.bill,v.day,stage]);
  const x=examples.get(key)??{session:v.session,bill:v.bill,day:v.day,stage,votes:0};
  x.votes++;examples.set(key,x);
 }
 if(Object.values(stages).reduce((a,b)=>a+b,0)!==expected)
  throw Error('Original source-side complete roll audit failed 105-vote conservation');
 return{
  schemaVersion:SENATE_RAW_STRONG_SOURCE_AUDIT,
  preliminaryOriginalRawCandidates:expected,
  authenticatedSourceDocuments:[...parsed.values()].filter(x=>x.sourceValid&&x.aligned).length,
  strictlyPrintedAndSourceUnique:stages.unique_original_source_question_and_ballot,
  stages,
  examples:[...examples.values()].sort((a,b)=>b.votes-a.votes||
   a.session.localeCompare(b.session)||a.bill.localeCompare(b.bill)).slice(0,20),
  newLinksCreated:0,sourceBodiesChanged:false,acceptedVotesChanged:false,
  completeAmendedBillStatesCertified:0
 };
}
