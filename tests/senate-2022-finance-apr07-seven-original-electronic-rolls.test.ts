import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FINANCE_APR07_2022,inspect2022FinanceApr07OriginalMinutes,
 FINANCE_APR07_FIRST_FULL_ORIGINAL_SOURCE,requireExactFirstFinanceOriginalPdfSource} from
 '../src/evidence/senate-2022-finance-apr07-original-seven-roll-verify.js';

const names=['FictionalAlpha','FictionalBravo','FictionalCharlie','FictionalDelta',
 'FictionalEcho','FictionalFoxtrot','FictionalGolf','FictionalHotel',
 'FictionalIndia','FictionalJuliet','FictionalKilo','FictionalLima'];
const vote=(yea:number,nay:number,absent:number|null,i:number,oral=false)=>{
 const shuffled=[...names.slice(i,i+10),...names.slice(0,i)];
 const yes=shuffled.slice(0,yea),no=shuffled.slice(yea,yea+nay);
 const others=absent===null?[]:shuffled.slice(yea+nay,yea+nay+absent);
 return 'A roll call '+(i===5?'':'vote ')+'was requested. The results were as follows: '+
  'AYES: '+yes.join(', ')+' NAYS: '+no.join(', ')+
  (absent===null?'':(absent===0?' ABSENT: -':' ABSENT: '+others.join(', ')))+
  ' On a vote of '+yea+' AYES'+(i%2?' and ':', ')+nay+' NAYS, '+
  (i===6?'THE MOTION PREVAILED.':((i>=1&&i<=4?'the motion does not prevail and the ':'the motion did not prevail and the ')+
   (oral?'A16':i===0?'A17':i===1?'A16':i===2?'A15':i===3?'A15':'A17')+
   ' Amendment was not adopted.'))+' ';
};
function mock(){
 return 'Minnesota State Senate Finance Committee Thursday, April 7, 2022 '+ 
  '8:30 AMLivestream YouTube Minutes Present: No Members Absent. '+
  'Senator Julie A. Rosen called the meeting to order at 8:44 A.M., on April 7, 2022 in Room 1200. A quorum was present. '+
  ('Testimony was submitted and the committee heard background from fiscal analysts. ').repeat(24)+
  'S.F. 3510: Senator Tomassoni: Higher education supplemental appropriations. '+
  'Senator Pratt withdrew the A21 Amendment. Senator Ingebrigtsen moved the A22 Amendment. On a voice vote, the motion prevailed. '+
  'Senator Marty moved the A17 Amendment. '+vote(3,6,1,0)+
  'Senator Lopez Franzen moved the A16 Amendment. '+vote(4,6,0,1)+
  'Senator Kent moved the A15 Amendment. '+vote(4,6,0,2)+
  'S.F. 4025: Senator Rosen presented a different bill and recommended pass without a roll. '+
  'S.F. 4269: Senator Senjem: Public Utilities Commission reports. '+
  'Senator Marty moved the A15 Amendment. '+vote(4,6,0,3)+
  'Senator Marty moved the A16 Amendment. Senator Marty moved an oral amendment to the A16 Amendment as follows: '+
  'Line 2.19 strike 2023, insert 2024. '+vote(4,6,0,4,true)+
  'The committee recessed and reconvened in the afternoon. Senator Kent moved the A17 Amendment. '+vote(4,6,null,5)+
  'H.F. 2746: Senator Howe: Hometown Heroes Act. '+
  'S.F. 4091: Senator Pratt: supplemental appropriations. '+
  'Senator Pratt moved that S.F. 4091, as amended, be recommended to pass. '+vote(5,3,2,6)+
  'The meeting adjourned. ';
}
const fixture=mock();
test('synthetic minute with seven distinct roll contexts resolves bill, motion, counts and digest-only choices',()=>{
 const a=inspect2022FinanceApr07OriginalMinutes(fixture);
 assert.equal(a.electronicallyPrintedNamedRollParagraphCount,7);
 assert.equal(a.electronicallyPrintedNamedYeaNayCount,67);
 assert.equal(a.electronicallyExplicitlyNamedAbsentCount,3);
 assert.deepEqual(a.originalRollSourceProofs.map(x=>[x.bill,x.mover,x.label]),[
  ['SF3510','Marty','A17'],['SF3510','Lopez Franzen','A16'],['SF3510','Kent','A15'],
  ['SF4269','Marty','A15'],['SF4269','Marty','ORAL_TO_A16'],
  ['SF4269','Kent','A17'],['SF4091','Pratt','COMMITTEE_RECOMMENDATION']
 ]);
 assert.deepEqual(a.originalRollSourceProofs.map(x=>[x.officialPrintedYea,x.officialPrintedNay,x.officialPrintedAbsent]),[
  [3,6,1],[4,6,0],[4,6,0],[4,6,0],[4,6,0],[4,6,null],[5,3,2]
 ]);
 assert.equal(a.originalRollSourceProofs.filter(x=>x.oralA16VsClosingBaseA16OnHold).length,1);
 assert.equal(a.originalRollSourceProofs.filter(x=>x.officialPrintedAbsent===null).length,1);
 assert.equal(a.withdrawnAmendmentNotARecordedVote,true);
 assert.equal(a.voiceVotesDoNotCreateNamedMemberChoices,true);
 assert.equal(a.separatelyCollected2022PrintMinutesReviewed,false);
 assert.equal(a.original2021PrintDenominator,null);
 assert.equal(a.issue864MustStayOpen,true);
 const serialized=JSON.stringify(a);
 assert.doesNotMatch(serialized,/Fictional(?:Alpha|Juliet|Lima)/);
 for(const r of a.originalRollSourceProofs){
  assert.match(r.originalNamesSHA256Only.yea,/^[a-f0-9]{64}$/);
  assert.match(r.originalNamesSHA256Only.nay,/^[a-f0-9]{64}$/);
  assert.equal(r.sameDayForecastEligible,false);
  assert.equal(r.individualNamedVoteImported,false);
  assert.equal(r.noSeparatePrintMinuteParityCertificate,true);
 }
});
test('real original electronic minutes mix \"did not prevail\" and \"does not prevail\"; both are failed amendments',()=>{
 const cases=inspect2022FinanceApr07OriginalMinutes(fixture).originalRollSourceProofs;
 assert.equal(cases[0].reportedOutcome,'FAILED');
 assert.equal(cases[1].reportedOutcome,'FAILED');
 assert.equal(cases[4].reportedOutcome,'FAILED');
 assert.equal(cases[5].reportedOutcome,'FAILED');
 assert.equal(cases[6].reportedOutcome,'PREVAILED');
});
test('refuse count drift or extra/missing roll without silently dropping an amendment',()=>{
 assert.throws(()=>inspect2022FinanceApr07OriginalMinutes(fixture.replace(
  'On a vote of 3 AYES, 6 NAYS','On a vote of 4 AYES, 6 NAYS'
 )),/original printed roll tally/);
 assert.throws(()=>inspect2022FinanceApr07OriginalMinutes(fixture.replace(
  'A roll call vote was requested. The results were as follows:','A voice vote was requested. The results were as follows:'
 )),/different distinct roll-call introductions/);
});
test('no false absent inferred from hearing-opening attendance; explicitly missing absent row stays null',()=>{
 const a=inspect2022FinanceApr07OriginalMinutes(fixture);
 const result=a.originalRollSourceProofs[5];
 assert.equal(result.officialPrintedAbsent,null);
 assert.equal(result.openingAttendanceNotTransposedIntoVoteAbsentList,true);
 const modified=fixture.replace('Senator Kent moved the A17 Amendment. '+vote(4,6,null,5),
  'Senator Kent moved the A17 Amendment. '+vote(4,6,0,5));
 assert.throws(()=>inspect2022FinanceApr07OriginalMinutes(modified),
  /original printed roll tally/);
});
test('oral-to-A16 closure conflict is held: cannot silently equate modification and A16 vote',()=>{
 const original=inspect2022FinanceApr07OriginalMinutes(fixture).originalRollSourceProofs[4];
 assert.equal(original.label,'ORAL_TO_A16');
 assert.equal(original.oralA16VsClosingBaseA16OnHold,true);
 assert.throws(()=>inspect2022FinanceApr07OriginalMinutes(fixture.replace(
  'the A16 Amendment was not adopted. The committee recessed',
  'the A49 Amendment was not adopted. The committee recessed'
  )),/original oral A16 and base A16 closing-label conflict/);
});
test('previous seven-roll lead explicitly remains UNVERIFIED until actual independent raw original source action',()=>{
 const lead=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json','utf8'
 ));
 assert.equal(lead.sourceRetrieval.sourceOriginalPdfOrTextSHA256IndependentlyVerified,false);
 assert.equal(lead.sourceRetrieval.sourceOriginalPdfSHA256,null);
 assert.equal(lead.namedOriginalTextRollParagraphs.length,7);
 assert.equal(FINANCE_APR07_2022.expectedNamedRollPassages,7);
 assert.equal(FINANCE_APR07_2022.expectedNamedYeaNayTokens,67);
 assert.equal(lead.holds.SF4269A16OralVsBaseAmendmentNeedsIndependentCorroboration,true);
 assert.equal(lead.holds.noPrintCollectionComparisonPerformed,true);
 assert.equal(FINANCE_APR07_2022.officialUrl,lead.originalMinutesPdfUrl);
});

test('first source acquired the COMPLETE actual government PDF but failed to parse does-not-prevail phrasing; strict second acquisition cannot drift',()=>{
 const proof=FINANCE_APR07_FIRST_FULL_ORIGINAL_SOURCE;
 assert.equal(proof.runId,38196825837);
 assert.equal(proof.artifactId,11723219510);
 assert.equal(proof.originalPDFBytes,140671);
 assert.equal(proof.originalFullPDFSHA256,
  '213fbba6aa942cadc6a97fc70fb5e259790cdfadc91d4a645047da67e0dc0a6f');
 assert.equal(proof.originalEmbeddedTextSHA256,
  '804daf007ca99c7dd1d501b09199592d3509d203972054fec6511d30140760a8');
 assert.equal(proof.initialParserPassFailedOnWording,'original motion disposition');
 assert.equal(proof.firstPassDidNotCertifySevenOriginalWrittenRolls,true);
 const same={pdfBytes:proof.originalPDFBytes,
  fullSHA256:proof.originalFullPDFSHA256,
  embeddedTextSHA256:proof.originalEmbeddedTextSHA256};
 assert.equal(requireExactFirstFinanceOriginalPdfSource(same).independentlySameSourceReverified,true);
 assert.throws(()=>requireExactFirstFinanceOriginalPdfSource({...same,pdfBytes:same.pdfBytes-1}),
  /strict_original_source_sha_mismatch/);
 assert.throws(()=>requireExactFirstFinanceOriginalPdfSource({...same,fullSHA256:'a'.repeat(64)}),
  /strict_original_source_sha_mismatch/);
 assert.throws(()=>requireExactFirstFinanceOriginalPdfSource({...same,embeddedTextSHA256:'b'.repeat(64)}),
  /strict_original_source_sha_mismatch/);
});
