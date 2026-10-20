import test from 'node:test';
import assert from 'node:assert/strict';
import {
 assessHf100PrintedLinePilot,exactPrintedBillLine,insertBeforeNthPrintedAnchor,
 replaceAllExactlyPrinted,literalAnchorPositions
} from '../src/operations/senate-hf100-printed-line-pilot.js';
import type {PaperAction} from '../src/operations/senate-vote-paper-parser.js';

const portPrefix=[
 'Page 56, line 7, before the second "eight" insert "more than"',
 'Page 56, line 8, before "100" insert "more than"',
 'Page 71, line 23, before "eight" insert "up to"',
 'Page 71, line 26, before "800" insert "up to"',
].join('\n');
const hoffman='Page 296, line 19, delete "$4,000,000" and insert "$5,500,000" and delete "$4,000,000" and insert "$5,500,000"';
const pdf=[
 'HF100 FIRST UNOFFICIAL REVISOR UEH0100-1',
 '56.7 may not contain more than eight grams of usable flower, eight grams of a cannabis',
 '56.8 concentrate, or an edible cannabis product infused with 100 milligrams of',
 '71.23 hemp products consisting primarily of hemp plant parts, eight grams',
 '71.26 and lower-potency hemp edibles infused with 800 milligrams',
 '296.19 (b) $4,000,000 in fiscal year 2024 and $4,000,000 in fiscal year 2025 are'
].join('\n');

function actions():PaperAction[]{
 const entries:Array<[number,PaperAction['kind'],PaperAction['outcome'],string|null]>=[
  [2,'amendment','adopted','Senator Port moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+portPrefix+'\nPage 144, line 20, delete something else'],
  [3,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 50, line 1, delete section'],
  [4,'amendment','rejected','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 60, line 1, delete section'],
  [5,'procedural','unknown',null],
  [6,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 70, line 1, delete section'],
  [7,'amendment','adopted','Senator Hoffman moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+hoffman],
  [8,'procedural','unknown',null],
  [9,'passage','unknown',null]
 ];
 return entries.map(([sequence,kind,outcome,proposedText])=>({
  key:'source-'+sequence,sequence,start:sequence*200,end:sequence*200+100,
  billIdentifier:'HF100',kind,motionText:kind==='amendment'?(proposedText??'').split('as follows:')[0]!:kind,
  questionText:'source question '+sequence,proposedText,
  baseLocator:kind==='amendment'?'versions/ue/1/':null,outcome,
  priorAdoptedKeys:sequence===9?[2,3,6,7].map(n=>'source-'+n):[],
  yeas:null,nays:null,ballotSignature:null,rollStart:null
 }));
}

test('source-only HF100 pilot checks strict printed anchors but never assembles four amendments',()=>{
 const proof=assessHf100PrintedLinePilot(actions(),pdf);
 assert.equal(proof.printedBaseLinesVerified,5);
 assert.equal(proof.partialPortInsertionsVerified,4);
 assert.equal(proof.completeHoffmanLineReplacementsVerified,2);
 assert.equal(proof.fullyCheckedAdoptedAmendments,1);
 assert.equal(proof.adoptedAmendmentsWithoutCompleteInstructionProof,3);
 assert.equal(proof.adoptedAmendmentsStillHeldForCompositeApplication,4);
 assert.equal(proof.allFourAdoptedAmendmentsApplied,false);
 assert.equal(proof.completeAssembledBillText,false);
 assert.equal(proof.preVotePublicationProven,false);
 assert.equal(proof.eventLinksAdded,0);
});

test('insertion second occurrence is literal, cardinality bounded and does not guess nearby words',()=>{
 const line=exactPrintedBillLine(pdf,56,7);
 assert.equal(literalAnchorPositions(line,'eight').length,2);
 const changed=insertBeforeNthPrintedAnchor(line,'eight','more than',2,2);
 assert.equal(changed,'may not contain more than eight grams of usable flower, more than eight grams of a cannabis');
 assert.throws(()=>insertBeforeNthPrintedAnchor(line,'eight','more than',1,1),/count or ordinal/);
 assert.throws(()=>insertBeforeNthPrintedAnchor(line,'eight','more than',3,2),/count or ordinal/);
 assert.deepEqual(literalAnchorPositions('1800 8000 800','800'),[10]);
});

test('replacement must exhaust exactly two old printed amounts',()=>{
 const line=exactPrintedBillLine(pdf,296,19);
 const changed=replaceAllExactlyPrinted(line,'$4,000,000','$5,500,000',2);
 assert.equal(literalAnchorPositions(changed,'$4,000,000').length,0);
 assert.equal(literalAnchorPositions(changed,'$5,500,000').length,2);
 assert.throws(()=>replaceAllExactlyPrinted(line,'$4,000,000','$5,500,000',1),/cardinality/);
 assert.throws(()=>replaceAllExactlyPrinted(line,'$4,000,000','$4,000,000',2),/cardinality/);
});

test('printed-line coordinates and source-pinned chain fail closed without any source fallback',()=>{
 assert.throws(()=>exactPrintedBillLine(pdf,296,20),/missing or repeated/);
 assert.throws(()=>exactPrintedBillLine(pdf+'\n296.19 duplicate',296,19),/missing or repeated/);
 assert.throws(()=>assessHf100PrintedLinePilot(actions(),pdf.replace('UEH0100-1','UEH0100-2')),/identity changed/);
 const wrongSequence=actions();wrongSequence[0]!.sequence=1;
 assert.throws(()=>assessHf100PrintedLinePilot(wrongSequence,pdf),/source order/);
 const reordered=actions();reordered.at(-1)!.priorAdoptedKeys.reverse();
 assert.throws(()=>assessHf100PrintedLinePilot(reordered,pdf),/passage chain/);
 const promoted=actions();promoted[2]!.outcome='adopted';
 assert.throws(()=>assessHf100PrintedLinePilot(promoted,pdf),/adopted\/rejected/);
 const missingBase=actions();missingBase[0]!.baseLocator='versions/ue/2/';
 assert.throws(()=>assessHf100PrintedLinePilot(missingBase,pdf),/base drift/);
});

test('unsupported composite amendments and Hoffman extra instructions remain held',()=>{
 const extraHoffman=actions();
 extraHoffman[5]!.proposedText+=' Page 296, line 20, delete something else';
 assert.throws(()=>assessHf100PrintedLinePilot(extraHoffman,pdf),/not complete/);
 const missingPort=actions();
 missingPort[0]!.proposedText=missingPort[0]!.proposedText!.replace('before the second','before the first');
 assert.throws(()=>assessHf100PrintedLinePilot(missingPort,pdf),/no longer source-exact/);
 const onlyOneAmount=pdf.replace('and $4,000,000','and $3,000,000');
 assert.throws(()=>assessHf100PrintedLinePilot(actions(),onlyOneAmount),/cardinality/);
 const onlyOneEight=pdf.replace('flower, eight','flower, seven');
 assert.throws(()=>assessHf100PrintedLinePilot(actions(),onlyOneEight),/count or ordinal/);
});
