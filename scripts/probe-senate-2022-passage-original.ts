/**
 * Experimental, keyless and source-only diagnostic for 2022 Senate Journals.
 * Never touches production or logs member ballots, names or full question text.
 * Receipts must be pinned before any parser improvement is enabled.
 */
import assert from 'node:assert/strict';
import {fetchSenateJournal,parseSenateJournalText} from '../src/sources/minnesota/senate-journals.js';
import {ballotSignature,parseJournalPaperActions} from '../src/operations/senate-vote-paper-parser.js';
import {independentlyPrintedAttendanceNames} from '../src/operations/senate-2022-passage-roster-shadow.js';

const sourceCases=[
 {day:'2022-05-10',url:'https://www.senate.mn/journals/2021-2022/20220510106.pdf',bills:['SF1391','SF2922'],sha256:'160dee14bf8d824d4d332f87aa3154fbd96593197f639dc0398c13f11d139a5f',bytes:3_402_568},
 {day:'2022-05-11',url:'https://www.senate.mn/journals/2021-2022/20220511107.pdf',bills:['HF3845'],sha256:'d32e223bccbe2a3dc3892a84a12d4821a12609a65b90448cde9d2061967d4ff6',bytes:1_210_956},
 {day:'2022-05-20',url:'https://www.senate.mn/journals/2021-2022/20220520113.pdf',bills:['HF2665'],sha256:'bcdffbb63d711ba36b6613103f2daef2610ca3eabd0bb44aa916bbb06383a591',bytes:669_374}
] as const;

async function main(){
 for(const item of sourceCases){
  const got=await fetchSenateJournal(item.url);
  assert.ok(got.byteLength>20_000&&/The roll was called/i.test(got.text));
  assert.equal(got.pdfSha256,item.sha256,'Original Minnesota Senate May 2022 Journal SHA drift');
  assert.equal(got.byteLength,item.bytes,'Original Minnesota Senate May 2022 Journal byte length drift');
  const names=independentlyPrintedAttendanceNames(got.text);
  assert.ok(names.length>=55&&names.length<=67,
   'Original Minnesota Senate PDF attendance quorum must yield verified complete names');
  const actions=parseJournalPaperActions(got.text,names);
  const raw=parseSenateJournalText({text:got.text,sourceUrl:item.url,sessionKey:'source-only',
   occurredOn:item.day,knownMemberNames:names,allowRosterMismatch:true});
  const rawWithoutRoster=parseSenateJournalText({text:got.text,sourceUrl:item.url,sessionKey:'source-only',
   occurredOn:item.day,allowRosterMismatch:true});
  const cases=item.bills.map(bill=>{
   const a=actions.filter(x=>x.billIdentifier===bill&&x.kind==='passage');
   const v=raw.filter(x=>x.billIdentifier===bill&&x.voteKind==='passage');
   const vr=rawWithoutRoster.filter(x=>x.billIdentifier===bill&&x.voteKind==='passage');
   return {
    bill,passageActions:a.length,
    sourceTallies:a.map(x=>[x.yeas,x.nays]),
    signedActions:a.filter(x=>x.ballotSignature).length,
    rawVoteRecords:v.length,
    rawFullBallots:v.filter(x=>ballotSignature(
     x.memberVotes.map(m=>({name:m.sourceName,choice:m.choice})),x.yeaCount,x.nayCount)).length,
    rawWithoutRosterCount:vr.length,
    rawWithoutRosterFull:vr.filter(x=>ballotSignature(
     x.memberVotes.map(m=>({name:m.sourceName,choice:m.choice})),x.yeaCount,x.nayCount)).length,
    rawParsedTotals:v.map(x=>({
      yeas:x.yeaCount,nays:x.nayCount,
      parsedYes:x.memberVotes.filter(m=>m.choice==='yea').length,
      parsedNo:x.memberVotes.filter(m=>m.choice==='nay').length
    }))
   };
  });
  console.log('SENATE_2022_SOURCE_ROLL_PROBE='+JSON.stringify({
   day:item.day,sourcePdfSha256:got.pdfSha256,sourcePdfBytes:got.byteLength,
   journalTextChars:got.text.length,rosterNames:names.length,
   allRolls:(got.text.match(/The roll was called,\s*and there were yeas/gi)??[]).length,
   paperActions:actions.length,signedPaperActions:actions.filter(a=>a.ballotSignature).length,
   cases
  }));
  assert.equal(cases.length,item.bills.length);
  assert.ok(cases.every(x=>x.passageActions===x.signedActions&&x.signedActions>0),
   'Every reviewed original 2022 passage must retain its complete named source ballot');
  if(item.day==='2022-05-11')assert.deepEqual(cases[0]?.sourceTallies,[[60,6],[57,9]],
   'HF3845 passage and repassage must stay separate and retain original tallies');
  if(item.day==='2022-05-20')assert.deepEqual(cases[0]?.sourceTallies,[[65,0],[66,0]],
   'HF2665 passage and repassage must stay separate and retain original tallies');
 }
}
void main().catch(error=>{
 console.error('SENATE_2022_SOURCE_ROLL_PROBE_HELD='+JSON.stringify({
  kind:error instanceof Error?error.name:'unknown'
 }));
 process.exitCode=1;
});
