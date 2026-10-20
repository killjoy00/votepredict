import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSenateJournal} from '../src/sources/minnesota/senate-journals.js';
import {parseNestedSenateSourcePapers} from '../src/operations/senate-vote-paper-nested.js';

/** Original-government PDF calibration: source-only actions, not accepted vote matches. */
test('HF7 nested amendment papers derive from independent February 2 Senate Journal PDF',
 {skip:process.env.GITHUB_ACTIONS!=='true',timeout:150_000},async()=>{
  const original=await fetchSenateJournal('https://www.senate.mn/journals/2023-2024/20230202017.pdf');
  const knownSenators=original.text.slice(0,original.text.indexOf('The President declared')).split('\n')
   .map(x=>x.trim()).filter(x=>/^[A-Z][A-Za-z ]+$/.test(x));
  const papers=parseNestedSenateSourcePapers(original.text,knownSenators).filter(p=>p.billIdentifier==='HF7');
  console.log('SENATE_HF7_NESTED_ORIGINAL_KEYLESS='+JSON.stringify({
   source:'2023-2024/20230202017.pdf',pdfSha256:original.pdfSha256,
   pdfBytes:original.byteLength,sourceOnlyNestedProposals:papers.length,
   availableRosterNames:knownSenators.length,
   completeNamedBallots:papers.filter(p=>p.ballotSha256!==null).length,
   uniquePrintedQuestions:new Set(papers.map(p=>p.questionText)).size,
   unnumberedParent:papers.filter(p=>p.parentOrdinal===null).length,
   numberedParent:papers.filter(p=>p.parentOrdinal!==null).length,
   rejected:papers.filter(p=>p.disposition==='rejected').length,
   adoptedToParent:papers.filter(p=>p.disposition==='adopted_to_parent').length,
   unresolved:papers.filter(p=>p.disposition==='unknown').length,
   acceptedEventLinks:0,assembledBillStates:0
  }));
  assert.ok(original.byteLength>1000&&papers.length>=4);
  assert.ok(papers.some(p=>p.parentMover==='Rarick'&&p.parentOrdinal===null));
  assert.ok(papers.some(p=>p.parentMover==='Lucero'&&p.parentOrdinal==='third'));
  assert.ok(papers.every(p=>!p.exactNumberedParentProven
   &&!p.appliesDirectlyToBill&&!p.acceptedVoteEventLinked&&!p.fullBillTextAssembled));
  assert.equal(original.pdfSha256,'e60b103c2a0ad32dc13b6bb1480fa5197810ce7ecdc2b9480edf97d63ee7060c',
   'HF7 original government PDF body changed from independently verified keyless receipt');
  assert.equal(original.byteLength,1_152_045);
  assert.equal(papers.length,17);
  assert.equal(papers.filter(p=>p.parentOrdinal===null).length,8);
  assert.equal(papers.filter(p=>p.parentOrdinal!==null).length,9);
  assert.equal(papers.filter(p=>p.disposition==='rejected').length,17);
  assert.equal(papers.filter(p=>p.disposition==='adopted_to_parent').length,0);
});
