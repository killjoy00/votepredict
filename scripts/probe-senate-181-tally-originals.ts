/**
 * Public-only original Senate Journal diagnostic for the two largest
 * population-wide no-matching-tally cohorts: 2023 HF4 and 2024 HF4124.
 * Keyless, no database access, no automatic source/accepted links.
 */
import assert from 'node:assert/strict';
import {fetchSenateJournal,parseSenateJournalText} from '../src/sources/minnesota/senate-journals.js';
import {parseNestedSenateSourcePapers} from '../src/operations/senate-vote-paper-nested.js';
import {parseJournalPaperActions,ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {independentlyPrintedAttendanceNames} from '../src/operations/senate-2022-passage-roster-shadow.js';

const originals=[
 {bill:'HF4',day:'2023-02-21',
  url:'https://www.senate.mn/journals/2023-2024/20230221025.pdf'},
 {bill:'HF4124',day:'2024-05-03',
  url:'https://www.senate.mn/journals/2023-2024/20240503111.pdf'}
] as const;
async function main(){
 for(const item of originals){
  const pdf=await fetchSenateJournal(item.url);
  assert.ok(pdf.text.length>2000&&pdf.byteLength>1000);
  const names=independentlyPrintedAttendanceNames(pdf.text);
  const papers=parseJournalPaperActions(pdf.text,names).filter(p=>p.billIdentifier===item.bill);
  const nested=parseNestedSenateSourcePapers(pdf.text,names).filter(p=>p.billIdentifier===item.bill);
  const raw=parseSenateJournalText({text:pdf.text,sessionKey:'source-only',sourceUrl:item.url,
   occurredOn:item.day,knownMemberNames:names,allowRosterMismatch:true})
   .filter(v=>v.billIdentifier===item.bill);
  const tally=Array.from(pdf.text.matchAll(/The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+)/gi));
  const report={
   bill:item.bill,day:item.day,url:item.url,
   originalPdfSha256:pdf.pdfSha256,originalPdfBytes:pdf.byteLength,
   originalTextCharacters:pdf.text.length,
   independentlyPrintedAttendanceNames:names.length,
   originalRollTalliesAllBills:tally.length,
   v1BillActions:papers.length,
   v1BillPaperWithNamedBallot:papers.filter(p=>p.ballotSignature!==null).length,
   v1BillPrintedTallies:papers.filter(p=>p.yeas!==null).length,
   nestedBillAmendments:nested.length,
   nestedBillPrintedTallies:nested.filter(p=>p.yeas!==null).length,
   nestedBillCompleteNamedBallots:nested.filter(p=>p.ballotSha256!==null).length,
   nestedBillQuestionKinds:[...new Set(nested.map(p=>p.parentOrdinal?'numbered_parent':'unnumbered_parent'))],
   rawBillRolls:raw.length,
   rawBillCompleteNamedBallots:raw.filter(v=>ballotSignature(v.memberVotes.map(m=>({
    name:m.sourceName,choice:m.choice
   })),v.yeaCount,v.nayCount)!==null).length,
   rawBillAmendments:raw.filter(v=>v.voteKind==='amendment').length
  };
  console.log('SENATE_MISSING_TALLY_PUBLIC_ORIGINAL='+JSON.stringify(report));
  assert.ok(names.length>=55&&names.length<=67,'Printed quorum roster is required');
  assert.ok(tally.length>15&&papers.length>0,'Original Journal source missing question evidence');
  assert.ok(nested.length>0,'No nested source amendments in this high-impact original');
 }
}
void main().catch(err=>{
 console.error('SENATE_MISSING_TALLY_PUBLIC_ORIGINAL_HELD='+JSON.stringify({
  kind:err instanceof Error?err.name:'unknown'
 }));process.exitCode=1;
});
