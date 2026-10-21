import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHf100PublicSafetyAmounts,HF100_PUBLIC_SAFETY_AMOUNT_AUDIT_VERSION}
 from '../src/operations/senate-hf100-public-safety-amount-audit.js';
import {HF100_SUCCESSOR_WITNESS_TERMS}
 from '../src/operations/senate-hf100-second-ue-successor-witness.js';
import type {PaperAction} from '../src/operations/senate-vote-paper-parser.js';

const first=[
 'HF100 FIRST UNOFFICIAL REVISOR UEH0100-1',
 '56.7 may not contain more than eight grams of usable flower, eight grams of a cannabis',
 '56.8 concentrate, or an edible cannabis product infused with 100 milligrams of',
 '71.23 hemp products consisting primarily of hemp plant parts, eight grams',
 '71.26 and lower-potency hemp edibles infused with 800 milligrams',
 '294.2 Sec. 16. PUBLIC SAFETY',
 '294.10 Subdivision 1. Total Appropriation',
 '294.32 13,987,000 5,654,000',
 '295.4 Subd. 5. State Patrol',
 '295.5 6,157,000 2,218,000',
 '296.2 Sec. 17. REVENUE',
 '296.19 (b) $4,000,000 in fiscal year 2024 and $4,000,000 in fiscal year 2025 are'
].join('\n');
const second=[
 'HF100 SECOND UNOFFICIAL REVISOR UEH0100-2',
 '294.2 Sec. 16. PUBLIC SAFETY',
 '294.10 Subdivision 1. Total Appropriation',
 '294.32 23,987,000 10,654,000',
 '295.4 Subd. 5. State Patrol',
 '295.5 16,157,000 7,718,000',
 '296.2 Sec. 17. REVENUE',
 ...HF100_SUCCESSOR_WITNESS_TERMS.map((t,i)=>String(i+301)+'.1 '+t.wording)
].join('\n');
function actions(h2?:string):PaperAction[]{
 const port=[
  'Page 56, line 7, before the second "eight" insert "more than"',
  'Page 56, line 8, before "100" insert "more than"',
  'Page 71, line 23, before "eight" insert "up to"',
  'Page 71, line 26, before "800" insert "up to"',
  'Page 144, line 22, delete everything after "(a)" and insert "The CanGrow revolving loan account is established"'
 ].join('\n');
 const hauschild=h2??[
  'Page 294, line 32, delete "13,987,000" and insert "23,987,000" and delete "5,654,000" and insert "10,654,000"',
  'Page 295, delete lines 12 and 13, and insert:',
  '"$10,000,000 the first year and $5,000,000 the second year are from the general fund for drug recognition evaluator training.',
  '$6,157,000 the first year and $2,218,000 the second year are from the trunk highway fund."',
  'Adjust amounts accordingly'
 ].join('\n');
 const entries:Array<[number,PaperAction['kind'],PaperAction['outcome'],string|null]>=[
  [2,'amendment','adopted','Senator Port moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+port],
  [3,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 37, line 7, after "may" insert "authority"'],
  [4,'amendment','rejected','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 155, line 26, delete "ten" and insert "12"'],
  [5,'procedural','unknown',null],
  [6,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+hauschild],
  [7,'amendment','adopted','Senator Hoffman moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 296, line 19, delete "$4,000,000" and insert "$5,500,000" and delete "$4,000,000" and insert "$5,500,000"'],
  [8,'procedural','unknown',null],
  [9,'passage','unknown',null]
 ];
 return entries.map(([sequence,kind,outcome,proposedText])=>({
  key:'source-'+sequence,sequence,start:sequence*100,end:sequence*100+50,
  billIdentifier:'HF100',kind,motionText:proposedText?.split('as follows:')[0]??kind,
  questionText:'question '+sequence,proposedText,
  baseLocator:kind==='amendment'?'versions/ue/1/':null,outcome,
  priorAdoptedKeys:sequence===9?[2,3,6,7].map(n=>'source-'+n):[],
  yeas:null,nays:null,ballotSignature:null,rollStart:null
 }));
}
test('first-to-second public safety delta is internally unreconciled by $500k; never correct totals',()=>{
 const r=assessHf100PublicSafetyAmounts(actions(),first,second);
 assert.equal(r.schemaVersion,HF100_PUBLIC_SAFETY_AMOUNT_AUDIT_VERSION);
 assert.equal(r.status,'numeric_delta_hold_verified');
 assert.equal(r.editionTablePairsRead,2);
 assert.deepEqual(r.totalDelta,{first:10_000_000,second:5_000_000});
 assert.deepEqual(r.statePatrolDelta,{first:10_000_000,second:5_500_000});
 assert.equal(r.secondYearDeltaDisagreement,500_000);
 assert.equal(r.adjustmentReconciled,false);
 assert.equal(r.completeAmendedTextCertified,false);
 assert.equal(r.preVotePublicationCertified,false);
 assert.equal(r.eventLinksAdded,0);
});
test('changed, missing and repeated Revisor section witness amounts stay held, not approximate',()=>{
 for(const changed of [
  second.replace('7,718,000','7,218,000'),
  second.replace('10,654,000','10,654,001'),
  second.replace('Sec. 16. PUBLIC SAFETY','Sec. 15. PUBLIC SAFETY'),
  second.replace('Sec. 17. REVENUE','Sec. 17. ARITHMETIC'),
  second.replace('16,157,000 7,718,000','16,157,000 7,718,000 7,718,000')
 ]){
  const r=assessHf100PublicSafetyAmounts(actions(),first,changed);
  assert.equal(r.status,'source_table_layout_held');
  assert.equal(r.adjustmentReconciled,false);
  assert.equal(r.completeAmendedTextCertified,false);
 }
});
test('source Journal must contain both year replacement amounts and the literal open-ended adjustment',()=>{
 const text=[
  'Page 294, line 32, delete "13,987,000" and insert "23,987,000" and delete "5,654,000" and insert "10,654,000"',
  'Page 295, delete lines 12 and 13, and insert:',
  '$10,000,000 the first year and $5,000,000 the second year are from the general fund.',
  '$6,157,000 the first year and $2,218,000 the second year are from the trunk highway fund.',
  'Adjust amounts accordingly'
 ].join('\n');
 assert.throws(()=>assessHf100PublicSafetyAmounts(actions(text.replace('Adjust amounts accordingly','Adjust records accordingly')),first,second),/public safety amount instructions/);
 assert.throws(()=>assessHf100PublicSafetyAmounts(actions(text.replace('5,000,000','5,500,000')),first,second),/public safety amount instructions/);
 const rejected=actions();rejected[2]!.outcome='adopted';
 assert.throws(()=>assessHf100PublicSafetyAmounts(rejected,first,second),/adopted\/rejected/);
});
