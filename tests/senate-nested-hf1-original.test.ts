import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSenateJournal} from '../src/sources/minnesota/senate-journals.js';
import {parseNestedSenateSourcePapers} from '../src/operations/senate-vote-paper-nested.js';

/**
 * A keyless primary-source proof in ordinary PR CI, not a protected production
 * action. It outputs only the government PDF digest and safe aggregate counts.
 * Offline development runs skip this canary; production original verification
 * independently pins the same bytes.
 */
test('HF1 nested papers are present in independently downloaded 2023 official Senate Journal',
 {skip:process.env.GITHUB_ACTIONS!=='true',timeout:150_000},async()=>{
  const journal=await fetchSenateJournal('https://www.senate.mn/journals/2023-2024/20230127014.pdf');
  const nested=parseNestedSenateSourcePapers(journal.text).filter(p=>p.billIdentifier==='HF1');
  console.log('SENATE_HF1_NESTED_ORIGINAL_KEYLESS='+JSON.stringify({
   source:'2023-2024/20230127014.pdf',pdfSha256:journal.pdfSha256,
   pdfBytes:journal.byteLength,nestedPapers:nested.length,
   rejected:nested.filter(p=>p.disposition==='rejected').length,
   adoptedToParent:nested.filter(p=>p.disposition==='adopted_to_parent').length,
   unresolved:nested.filter(p=>p.disposition==='unknown').length,
   acceptedEventLinks:0,assembledBillStates:0
  }));
  assert.ok(journal.byteLength>1000&&nested.length>=3,
   'Original Journal must contain at least three complete nested proposals');
  assert.ok(nested.some(p=>p.parentMover==='Lucero'&&p.parentOrdinal==='first'));
  assert.ok(nested.every(p=>!p.appliesDirectlyToBill&&!p.acceptedVoteEventLinked&&!p.fullBillTextAssembled));
  assert.match(journal.pdfSha256,/^[a-f0-9]{64}$/);
});
