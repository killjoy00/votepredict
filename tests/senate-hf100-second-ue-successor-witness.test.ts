import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHf100SecondUnofficialSuccessor,HF100_SUCCESSOR_WITNESS_TERMS}
 from '../src/operations/senate-hf100-second-ue-successor-witness.js';
import type {PaperAction} from '../src/operations/senate-vote-paper-parser.js';

const firstPdf=[
 'HF100 FIRST UNOFFICIAL REVISOR BD UEH0100-1',
 '56.7 may not contain more than eight grams of usable flower, eight grams of a cannabis',
 '56.8 concentrate, or an edible cannabis product infused with 100 milligrams of',
 '71.23 hemp products consisting primarily of hemp plant parts, eight grams',
 '71.26 and lower-potency hemp edibles infused with 800 milligrams',
 '296.19 (b) $4,000,000 in fiscal year 2024 and $4,000,000 in fiscal year 2025 are'
].join('\n');
const secondPdf=['HF100 SECOND UNOFFICIAL REVISOR BD UEH0100-2',
 ...HF100_SUCCESSOR_WITNESS_TERMS.map((x,i)=>String(i+1)+'.1 '+x.wording)].join('\n');
const portPrefix=[
 'Page 56, line 7, before the second "eight" insert "more than"',
 'Page 56, line 8, before "100" insert "more than"',
 'Page 71, line 23, before "eight" insert "up to"',
 'Page 71, line 26, before "800" insert "up to"',
 'Page 144, line 22, delete everything after "(a)" and insert "The CanGrow revolving loan account is established"'
].join('\n');
function actions():PaperAction[]{
 const entries:Array<[number,PaperAction['kind'],PaperAction['outcome'],string|null]>=[
  [2,'amendment','adopted','Senator Port moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+portPrefix],
  [3,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 37, line 7, after "may" insert "utilize any granted regulatory authority to"'],
  [4,'amendment','rejected','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 155, line 26, delete "ten" and insert "12"'],
  [5,'procedural','unknown',null],
  [6,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 294, line 32, delete "13,987,000" and insert "23,987,000"'],
  [7,'amendment','adopted','Senator Hoffman moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 296, line 19, delete "$4,000,000" and insert "$5,500,000" and delete "$4,000,000" and insert "$5,500,000"'],
  [8,'procedural','unknown',null],
  [9,'passage','unknown',null]
 ];
 return entries.map(([sequence,kind,outcome,proposedText])=>({
  key:'source-'+sequence,sequence,start:sequence*100,end:sequence*100+50,
  billIdentifier:'HF100',kind,motionText:proposedText?.split('as follows:')[0]??kind,
  questionText:'source question '+sequence,proposedText,
  baseLocator:kind==='amendment'?'versions/ue/1/':null,outcome,
  priorAdoptedKeys:sequence===9?[2,3,6,7].map(n=>'source-'+n):[],
  yeas:null,nays:null,ballotSignature:null,rollStart:null
 }));
}
test('nine uniquely new successor excerpts corroborate all four adopted amendments, never vote-time state',()=>{
 const result=assessHf100SecondUnofficialSuccessor(actions(),firstPdf,secondPdf);
 assert.equal(result.sourceWordingWitnesses,HF100_SUCCESSOR_WITNESS_TERMS.length);
 assert.equal(result.strictUniqueNewWitnesses,9);
 assert.equal(result.heldWitnesses,0);
 assert.equal(result.amendmentsWithAtLeastOneSuccessorWitness,4);
 assert.equal(result.port1778FirstOccurrenceSuggestedBySuccessor,true);
 assert.equal(result.fullEditionDiffProven,false);
 assert.equal(result.exactCompositeAtVoteCertified,false);
 assert.equal(result.successorPreVotePublicAvailabilityCertified,false);
 assert.equal(result.completeAssembledBillText,false);
 assert.equal(result.eventLinksAdded,0);
});
test('changed/repeated successor text or already present in the base cannot be a unique new witness',()=>{
 const changed=assessHf100SecondUnofficialSuccessor(actions(),firstPdf,
  secondPdf.replace('CanStartup revolving loan account is established','CanStartup reserve loan account is established'));
 assert.equal(changed.heldWitnesses,1);
 const doubled=assessHf100SecondUnofficialSuccessor(actions(),firstPdf,
  secondPdf+'\n455.4 '+HF100_SUCCESSOR_WITNESS_TERMS[0]!.wording);
 assert.equal(doubled.heldWitnesses,1);
 const old=assessHf100SecondUnofficialSuccessor(actions(),
  firstPdf+'\n332.10 '+HF100_SUCCESSOR_WITNESS_TERMS[0]!.wording,secondPdf);
 assert.equal(old.heldWitnesses,1);
 assert.equal(old.completeAssembledBillText,false);
});
test('distinct 2nd unofficial identity and original source adoption sequence remain immutable',()=>{
 assert.throws(()=>assessHf100SecondUnofficialSuccessor(actions(),firstPdf,
  secondPdf.replaceAll('SECOND UNOFFICIAL','FIRST UNOFFICIAL')),/second unofficial/);
 assert.throws(()=>assessHf100SecondUnofficialSuccessor(actions(),firstPdf,
  secondPdf.replace('UEH0100-2','UEH0100-3')),/second unofficial/);
 const wrong=actions();wrong[2]!.outcome='adopted';
 assert.throws(()=>assessHf100SecondUnofficialSuccessor(wrong,firstPdf,secondPdf),/adopted\/rejected/);
 const altered=actions();altered[7]!.priorAdoptedKeys.reverse();
 assert.throws(()=>assessHf100SecondUnofficialSuccessor(altered,firstPdf,secondPdf),/passage chain/);
});
