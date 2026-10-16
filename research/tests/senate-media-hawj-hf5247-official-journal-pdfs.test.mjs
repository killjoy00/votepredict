import test from 'node:test';
import assert from 'node:assert/strict';
import previous from '../../docs/evaluation/senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.json' with {type:'json'};
import {VERSION,JOURNALS,officialJournalAllowlist,originalHawjSource,pageRange,inspectNamedRolls,probeJournal,run}
 from '../../scripts/probe-senate-media-hawj-hf5247-official-journal-pdfs.mjs';
const yes=(n)=>'The roll was called, and there were yeas '+n+' and nays 10, as follows:\nThose who voted in the affirmative were:\n Boldon  Hawj  Rest  Murphy\nThose who voted in the negative were:\nBahr Drazkowski\nSo the bill passed.\n';
const may7='H.F. No. 5247 was read the third time, as amended, and placed on its final passage.\nThe question was taken on the passage of the bill.\n'+yes(55);
const may19='H.F. No. 5247 conference report was taken up for repassage.\nThe roll was called, and there were yeas 34 and nays 12, as follows:\nThose who voted in the affirmative were:\nBoldon Hawj Murphy\nThose who voted in the negative were:\nBahr Weber\nSo the motion prevailed.\nH.F. No. 5247 was read the third time as amended.\nThe roll was called, and there were yeas 34 and nays 14, as follows:\nThose who voted in the affirmative were:\nMurphy Hawj Pha\nThose who voted in the negative were:\nBahr Weber\nSo the bill was repassed.\n';
function fakePdf(){const x=Buffer.from('%PDF-1.7\n'+' '.repeat(20000)+'\n%%EOF\n');return x;}
test('exact Minnesota Senate 93rd session May 7 and May 19 official journal source allowlist and prior true Hawj statement SHA',()=>{
 assert.equal(VERSION,'track-d-hawj-hf5247-2024-primary-senate-journal-individual-rollcall-v1');
 assert.equal(officialJournalAllowlist(),true);
 assert.deepEqual(JOURNALS.map(x=>x.day),[113,119]);
 assert.deepEqual(JOURNALS.map(x=>x.date),['2024-05-07','2024-05-19']);
 assert.ok(JOURNALS.every(x=>x.url.includes('/journals/2023-2024/')&&x.url.startsWith('https://www.senate.mn/')));
 assert.deepEqual(JOURNALS.map(x=>x.expected.map(v=>String(v.yeas)+'-'+String(v.nays))),[['55-10'],['34-12','34-14']]);
 const hawj=originalHawjSource();
 assert.equal(hawj.name,'Foung Hawj');
 assert.equal(hawj.originalUtc,'2024-03-24T19:01:09Z');
 assert.equal(hawj.originalSha256,'aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743');
 assert.equal(hawj.officialSenateMember,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15380');
});
test('wrong original proof and a pre-certified historical Hawj vote both fail closed',()=>{
 for(const flip of [
  d=>d.historicSenatorStatement.senator='Other Senator',
  d=>d.historicSenatorStatement.originalRawSha256='a'.repeat(64),
  d=>d.historicSenatorStatement.originalCapturedUtc='2024-03-15T00:00:00Z',
  d=>d.totals.senateJournalOriginalHawjIndividualBallotsVerified=1
 ]){
  const d=structuredClone(previous);flip(d);assert.throws(()=>originalHawjSource(d));
 }
 assert.throws(()=>officialJournalAllowlist(JOURNALS.slice().reverse()));
});
test('extract May 7 exactly named HF5247 YES from its own roll-call affirmative section, not attendance or amendment motion',()=>{
 const testText='Initial roll call: Hawj was present.\n'+may7+'\f\nNot another vote.';
 const x=inspectNamedRolls(testText,JOURNALS[0]);
 assert.equal(x.expectedSeparatelyIdentifiedMemberRolls,true);
 assert.equal(x.rollCallsMatchingExpectedAggregateTally.length,1);
 const y=x.rollCallsMatchingExpectedAggregateTally[0];
 assert.equal(y.aggregateYeas,55);assert.equal(y.aggregateNays,10);
 assert.equal(y.hf5247IsNearestExactBillContext,true);
 assert.equal(y.primaryIndividualMemberVote,'yea');
 assert.equal(y.personallyListedInAffirmativeRoll,true);
 assert.equal(y.personallyListedInNegativeRoll,false);
 assert.equal(y.event,'third_reading_passage');
 assert.equal(y.noRule40ProxyInferred,true);
 assert.equal(y.noSectionSpecificSFProposalVoteInferred,true);
});
test('May 19 conference and third reading are separate individually attributed roll calls, not one YES total',()=>{
 const x=inspectNamedRolls(may19,JOURNALS[1]);
 assert.equal(x.expectedSeparatelyIdentifiedMemberRolls,true);
 assert.deepEqual(x.rollCallsMatchingExpectedAggregateTally.map(y=>y.primaryIndividualMemberVote),['yea','yea']);
 assert.deepEqual(x.rollCallsMatchingExpectedAggregateTally.map(y=>y.event),['conference_report','third_reading_amended']);
});
test('negative vote correctly distinguished from affirmative; unrelated bill 55-10 cannot be called Hawj HF5247 vote',()=>{
 const neg='H.F. No. 5247 was read the third time.\nThe roll was called, and there were yeas 55 and nays 10, as follows:\nThose who voted in the affirmative were:\nRest Murphy\nThose who voted in the negative were:\nHawj Bahr\nSo the bill passed.';
 const result=inspectNamedRolls(neg,JOURNALS[0]).rollCallsMatchingExpectedAggregateTally[0];
 assert.equal(result.primaryIndividualMemberVote,'nay');
 assert.equal(result.personallyListedInNegativeRoll,true);
 const wrong=inspectNamedRolls('H.F. No. 5247 debated.\nSPECIAL ORDER H.F. No. 9999.\n'+yes(55),JOURNALS[0]).rollCallsMatchingExpectedAggregateTally[0];
 assert.equal(wrong.hf5247IsNearestExactBillContext,false);
 assert.equal(wrong.primaryIndividualMemberVote,'UNKNOWN');
});
test('Hawj name in attendance, proxy note, reporter remarks or both voting columns is NEVER attributed automatically',()=>{
 const cases=[
  'H.F. No. 5247. Hawj was here.\nThe roll was called, and there were yeas 55 and nays 10, as follows:\nThose who voted in the affirmative were:\nRest Murphy\nThose who voted in the negative were:\nBahr\nPursuant to Rule 40, Hawj voted on behalf of Rest.',
  'H.F. No. 5247.\nThe roll was called, and there were yeas 55 and nays 10, as follows:\nThose who voted in the affirmative were:\nHawj Rest\nThose who voted in the negative were:\nHawj Bahr',
  'H.F. No. 5247.\nThe roll was called, and there were yeas 55 and nays 10, as follows:\nSome senators voted; Hawj was present but no YEAS section.'
 ];
 for(const x of cases){
  const result=inspectNamedRolls(x,JOURNALS[0]).rollCallsMatchingExpectedAggregateTally[0];
  assert.equal(result.primaryIndividualMemberVote,'UNKNOWN');
 }
});
test('time/size constraints on bounded PDF pages cannot be bypassed or turn all journal unavailability into no votes',()=>{
 assert.deepEqual(pageRange(86,JOURNALS[0]),{first:42,last:86,inspected:45});
 assert.deepEqual(pageRange(2023,JOURNALS[1]),{first:1984,last:2023,inspected:40});
 assert.throws(()=>pageRange(2301,JOURNALS[1]));
 const bad=inspectNamedRolls('H.F. No. 5247 was discussed but not voted on',JOURNALS[1]);
 assert.equal(bad.expectedSeparatelyIdentifiedMemberRolls,false);
 assert.equal(bad.rollCallsMatchingExpectedAggregateTally.length,0);
});
test('a non-PDF, modified, redirect or unavailable source cannot certify an official member ballot',async()=>{
 for(const [f,status] of [
  [async()=>new Response('unavailable',{status:503}),'official_original_pdf_unavailable_or_unparsed_unknown'],
  [async()=>new Response('',{status:302,headers:{location:'https://other.example/'}}),'official_original_pdf_unavailable_or_unparsed_unknown'],
  [async()=>new Response('not pdf'.repeat(5000),{headers:{'content-type':'text/html'}}),'official_original_pdf_unavailable_or_unparsed_unknown']
 ]){
  const x=await probeJournal(JOURNALS[0],f,async()=>{throw Error('must not extract');});
  assert.equal(x.status,status);
  assert.equal(x.results,null);
  assert.equal(x.pdfTextPersisted,false);
 }
});
test('full simulated two-source original PDF run carries only votes attached to exact source; no private data or prediction promotion',async()=>{
 const pdf=fakePdf();let fetched=0,extracted=0;
 const data=await run(async (_url,options)=>{
  fetched++;assert.equal(options.redirect,'manual');
  return new Response(pdf,{headers:{'content-type':'application/pdf'}});
 },async (_pdf,source)=>{
  extracted++;
  return source.day===113?{pdfPages:86,range:pageRange(86,source),text:may7}:
   {pdfPages:2023,range:pageRange(2023,source),text:may19};
 });
 assert.equal(fetched,2);assert.equal(extracted,2);
 assert.equal(data.successfullyInspectedOriginalOfficialSenateJournalPdfs,2);
 assert.equal(data.hawjMay7ThirdReadingIndividualVote,'yea');
 assert.equal(data.hawjMay19ConferenceIndividualVote,'yea');
 assert.equal(data.hawjMay19ThirdReadingIndividualVote,'yea');
 assert.equal(data.noStandaloneSFPolicyVoteAssumed,true);
 assert.equal(data.noOmnibusYESAsIssueSpecificPosition,true);
 assert.equal(data.noContemporaneousByVoteTextVersionOrExactSectionCrosswalk,true);
 assert.equal(data.noProductionForecastOrTrainingLabelApproved,true);
 assert.equal(data.noPrivateVotePredictSourceRecordsAccessed,true);
 assert.equal(data.noJournalPdfOrExtractedFullTextPersisted,true);
 assert.ok(data.journals.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)&&x.pdfTextPersisted===false));
});
