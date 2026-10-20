import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNestedSenateSourcePapers,NESTED_PAPER_PARSER_VERSION} from '../src/operations/senate-vote-paper-nested.js';
import {parseJournalPaperActions} from '../src/operations/senate-vote-paper-parser.js';

const roll=(yea:string,nay:string)=>[
 'The question was taken on the adoption of the amendment to the amendment.',
 'The roll was called, and there were yeas 1 and nays 1, as follows:',
 'Those who voted in the affirmative were:',yea,
 'Those who voted in the negative were:',nay,
].join('\n');

test('nested Senate amendments retain exact parent description but never amend bill directly',()=>{
 const source=[
  'Senator Maye Quade moved to amend the first Lucero amendment to H.F. No. 1 as follows:',
  'Page 1, line 3, delete "PROHIBITION".',
  roll('Abeler','Boldon'),
  'The motion did not prevail. So the amendment to the amendment was not adopted.',
  'Senator Lucero moved to amend the first Lucero amendment to H.F. No. 1 as follows:',
  'Page 1, line 6, delete "22" and insert "36".',
  roll('Abeler','Boldon'),
  'The motion prevailed. So the amendment to the amendment was adopted.'
 ].join('\n');
 const papers=parseNestedSenateSourcePapers(source,['Abeler','Boldon']);
 assert.equal(NESTED_PAPER_PARSER_VERSION,'senate-nested-source-paper-v2');
 assert.equal(papers.length,2);
 assert.deepEqual(papers.map(p=>p.disposition),['rejected','adopted_to_parent']);
 assert.deepEqual(papers.map(p=>p.parentMover),['Lucero','Lucero']);
 assert.ok(papers.every(p=>p.billIdentifier==='HF1'&&p.parentOrdinal==='first'));
 assert.ok(papers.every(p=>p.appliesDirectlyToBill===false&&p.fullBillTextAssembled===false
   &&p.exactNumberedParentProven===false&&p.acceptedVoteEventLinked===false));
 assert.ok(papers.every(p=>p.literalText.includes('Page 1')&&!p.literalText.includes('The roll was called')));
 assert.equal(new Set(papers.map(p=>p.literalSha256)).size,2);
 assert.ok(papers.every(p=>p.yeas===1&&p.nays===1));
 // Repeated ballots do not collapse distinct source motions or become accepted vote links.
 assert.equal(papers[0]!.ballotSha256,papers[1]!.ballotSha256);
 assert.equal(parseJournalPaperActions(source,['Abeler','Boldon']).length,0);
});

test('unnumbered parent remains unresolved; vague bill or interrupted motion is held',()=>{
 const base='Senator Maye Quade moved to amend the first Lucero amendment to H.F. No. 1 as follows:\n';
 const tail='Page 1, line 3, delete "word".\nThe question was taken on the adoption of the amendment to the amendment.\n';
 assert.equal(parseNestedSenateSourcePapers(base+tail).length,1);
 const [unnumbered]=parseNestedSenateSourcePapers(base.replace('the first Lucero','the Lucero')+tail);
 assert.ok(unnumbered);assert.equal(unnumbered.parentOrdinal,null);
 assert.equal(unnumbered.exactNumberedParentProven,false);
 assert.equal(parseNestedSenateSourcePapers(base.replace('H.F. No. 1','an unknown bill')+tail).length,0);
 assert.equal(parseNestedSenateSourcePapers(base+'Page 1, line 1, insert "a".\nSenator Test moved that the bill be laid on the table.\n'+tail).length,0);
 assert.equal(parseNestedSenateSourcePapers(base+'The question was taken.').length,0);
 assert.throws(()=>parseNestedSenateSourcePapers('z'.repeat(8_000_001)),/outside audit bounds/);
});

test('nested source context without a complete named ballot remains unlinked',()=>{
 const body=[
  'Senator Maye Quade moved to amend the first Lucero amendment to H.F. No. 1 as follows:',
  'Page 1, line 3, insert "a".',
  'The question was taken on adoption of the amendment to the amendment.',
  'The roll was called, and there were yeas 33 and nays 34, as follows:',
  'Those who voted in the affirmative were: Abeler',
  'Those who voted in the negative were: Boldon',
  'The motion did not prevail. So the amendment to the amendment was not adopted.'
 ].join('\n');
 const [a]=parseNestedSenateSourcePapers(body,['Abeler','Boldon']);
 assert.ok(a);
 assert.equal(a?.ballotSha256,null,'one name from each side cannot authenticate a 33-34 roster');
 assert.equal(a?.yeas,33);assert.equal(a?.nays,34);
 assert.equal(a?.disposition,'rejected');
});


test('out-of-order nested proposal and appeal are not mislabeled as an amendment ballot',()=>{
 const journal=[
  'Senator Lucero moved to amend the first Lucero amendment to H.F. No. 1 as follows:',
  'Page 1, line 6, delete "22" and insert "39".',
  'Senator Maye Quade questioned whether the proposal was in order.',
  'The President ruled the third Lucero amendment out of order.',
  'Senator Pratt appealed the decision of the President.',
  'The question was taken on "Shall the decision of the President be the judgment of the Senate?"',
  'The roll was called, and there were yeas 38 and nays 28, as follows:',
  'So the decision of the President was sustained.'
 ].join('\n');
 assert.equal(parseNestedSenateSourcePapers(journal).length,0,
  'The 38-28 appellate division is not a vote adopting Lucero amendment text');
});

test('a divided amendment cannot be assigned the ballot of its first portion',()=>{
 const initial=[
  'Senator Murphy moved to amend the first Abeler amendment to H.F. No. 1 as follows:',
  'Page 1, delete line 2 and insert: "some different wording".',
  'Senator Rasmusson requested division of the Murphy amendment to the first Abeler amendment.',
  'First portion:',
  'The question was taken on the adoption of the first portion of the Murphy amendment to the first Abeler amendment.',
  'The roll was called, and there were yeas 34 and nays 33, as follows:',
  'The motion prevailed. So the amendment to the amendment was adopted.'
 ].join('\n');
 assert.equal(parseNestedSenateSourcePapers(initial).length,0);
 const noRequest=initial.replace('Senator Rasmusson requested division of the Murphy amendment to the first Abeler amendment.\n','');
 assert.equal(parseNestedSenateSourcePapers(noRequest).length,0,
  'Explicit portion-only adoption does not authenticate an undivided proposal');
});

test('unrelated parent-bill passage question does not become nested amendment identity',()=>{
 const journal=[
  'Senator Maye Quade moved to amend the first Lucero amendment to H.F. No. 1 as follows:',
  'Page 1, line 3, delete "word".',
  'The question was taken on the final passage of H.F. No. 1.',
  'The roll was called, and there were yeas 34 and nays 33, as follows:'
 ].join('\n');
 assert.equal(parseNestedSenateSourcePapers(journal).length,0);
});


test('HF7 official question extraction preserves unnumbered and third parents separately',()=>{
 const paper=[
  'Senator Rarick moved to amend the Rarick amendment to H.F. No. 7 as follows:',
  'Page 1, line 2, delete "19" and insert "31".',
  'The question was taken on the adoption of the Rarick amendment to the Rarick amendment.',
  'The roll was called, and there were yeas 33 and nays 34, as follows:',
  'The motion did not prevail. So the amendment to the amendment was not adopted.',
  'Senator Lucero moved to amend the third Lucero amendment to H.F. No. 7 asfollows:',
  'Page 1, after line 8, insert: "(d) The commission may not count carbon dioxide".',
  'The question wastaken on the adoption of the Lucero amendment to the third Lucero amendment.',
  'The roll was called, and there were yeas 33 and nays 34, as follows:',
  'The motion did not prevail. So the amendment to the amendment was not adopted.'
 ].join('\n');
 const found=parseNestedSenateSourcePapers(paper);
 assert.equal(found.length,2);
 assert.deepEqual(found.map(p=>p.parentOrdinal),[null,'third']);
 assert.deepEqual(found.map(p=>p.parentMover),['Rarick','Lucero']);
 assert.ok(found.every(p=>p.billIdentifier==='HF7'&&p.disposition==='rejected'));
 assert.ok(found.every(p=>p.ballotSha256===null),
  'Tally-only journal excerpt cannot supply full ballot signature');
 assert.notEqual(found[0]?.sourceOnlyKey,found[1]?.sourceOnlyKey);
 assert.ok(found[1]?.literalText.startsWith('Senator Lucero'));
 assert.ok(found.every(p=>p.questionText.startsWith('The question')));
 assert.ok(found.every(p=>paper.slice(p.questionStart,p.questionEnd).replace(/\\s+/g,' ').trim()===p.questionText));
 assert.ok(found.every(p=>p.questionStart>=p.sourceEnd));
});

test('omitted parent ordinal never assigns a numbered parent or adopted bill text',()=>{
 const source=[
  'Senator Mathews moved to amend the Mathews amendment to H.F. No. 7 as follows:',
  'Page 1, delete line 2 and insert "different text".',
  'The question wastaken on the adoption of the Mathews amendment to the Mathews amendment.',
  'The motion prevailed. So the amendment to the amendment was adopted.'
 ].join('\n');
 const [p]=parseNestedSenateSourcePapers(source);
 assert.ok(p);assert.equal(p.parentMover,'Mathews');assert.equal(p.parentOrdinal,null);
 assert.equal(p.disposition,'adopted_to_parent');
 assert.equal(p.exactNumberedParentProven,false);
 assert.equal(p.appliesDirectlyToBill,false);
 assert.equal(p.acceptedVoteEventLinked,false);
 assert.equal(p.fullBillTextAssembled,false);
});
