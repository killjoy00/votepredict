import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessHf100PortInstructionCoverage,HF100_PORT_COVERAGE_VERSION
} from '../src/operations/senate-hf100-port-instruction-coverage.js';
import type {PaperAction} from '../src/operations/senate-vote-paper-parser.js';

const marker=[
 'Page 56, line 7, before the second "eight" insert "more than"',
 'Page 56, line 8, before "100" insert "more than"',
 'Page 71, line 23, before "eight" insert "up to"',
 'Page 71, line 26, before "800" insert "up to"',
 'Page 144, line 22, delete everything after "(a)" and insert "The CanGrow revolving loan account',
 'Page 144, delete line 23',
 'Page 146, line 10, before "revolving" insert "CanGrow"',
 'Page 148, line 12, delete "2024" and insert "2025"',
 'Page 175, line 7, delete everything after "(a)" and insert "The CanStartup revolving loan account',
 'Page 175, delete line 8',
 'Page 177, line 8, before "revolving" insert "CanStartup"',
 'Page 251, line 21, delete "2024" and insert "2025"',
 'Page 291, line 26, delete "grants issued" and insert "deposit in the CanGrow revolving loan',
 'Page 291, line 27, delete everything after the second comma, and insert "subdivision 4."',
 'Page 291, delete lines 28 to 32',
 'Page 292, line 1, after "percent" insert "of this appropriation"',
 'Page 292, line 26, after "for" insert "deposit in"',
 'Page 292, line 27, delete "program" and insert "revolving loan account"',
 'Page 292, line 28, before the period, insert ", subdivision 3"'
];
const hoffman='Page 296, line 19, delete "$4,000,000" and insert "$5,500,000" and delete "$4,000,000" and insert "$5,500,000"';
const printed=[
 'HF100 FIRST UNOFFICIAL REVISOR UEH0100-1',
 '56.7 may not contain more than eight grams of usable flower, eight grams of a cannabis',
 '56.8 concentrate, or an edible cannabis product infused with 100 milligrams of',
 '71.23 hemp products consisting primarily of hemp plant parts, eight grams',
 '71.26 and lower-potency hemp edibles infused with 800 milligrams',
 '144.22 Subd. 4. Loan financing grants. (a) The office shall establish a revolving loan account',
 '144.23 to make loan financing grants under the CanGrow program.',
 '146.10 (b) Loan repayment of principal must be paid to the office for deposit in the revolving',
 '148.12 EFFECTIVE DATE. This section is effective March 1, 2024.',
 '175.7 Subd. 3. Grants. (a) The commissioner shall establish a revolving loan account to make',
 '175.8 grants under the CanStartup program.',
 '177.8 revolving loan account. Loan interest payments must be deposited in a revolving loan',
 '251.21 effective March 1, 2024.',
 '291.26 $1,000,000 each year is for grants issued under',
 '291.27 Minnesota Statutes, section 342.69, to eligible',
 '291.28 organizations to help farmers navigate the',
 '291.29 regulatory structure of the legal cannabis',
 '291.30 industry and to nonprofit corporations to',
 '291.31 provide loans to farmers for expansion into',
 '291.32 the legal cannabis industry. Of these amounts,',
 '292.1 up to three percent may be used for',
 '292.26 (b) $2,000,000 each year is for the CanStartup',
 '292.27 program established under Minnesota Statutes,',
 '292.28 section 116J.659.',
 '296.19 (b) $4,000,000 in fiscal year 2024 and $4,000,000 in fiscal year 2025 are'
].join('\n');

function actions(source=marker.join('\n')):PaperAction[]{
 const entries:Array<[number,PaperAction['kind'],PaperAction['outcome'],string|null]>=[
  [2,'amendment','adopted','Senator Port moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+source],
  [3,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 37, line 7, after "may" insert "authority"'],
  [4,'amendment','rejected','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 155, line 26, delete "ten" and insert "12"'],
  [5,'procedural','unknown',null],
  [6,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 294, line 32, delete a number'],
  [7,'amendment','adopted','Senator Hoffman moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+hoffman],
  [8,'procedural','unknown',null],
  [9,'passage','unknown',null]
 ];
 return entries.map(([sequence,kind,outcome,proposedText])=>({
  key:'source-'+sequence,sequence,start:sequence*200,end:sequence*200+100,
  billIdentifier:'HF100',kind,motionText:proposedText
    ?proposedText.split('as follows:')[0]!:kind,
  questionText:'question '+sequence,proposedText,
  baseLocator:kind==='amendment'?'versions/ue/1/':null,outcome,
  priorAdoptedKeys:sequence===9?[2,3,6,7].map(n=>'source-'+n):[],
  yeas:null,nays:null,ballotSignature:null,rollStart:null
 }));
}

test('all Port source headings are recognized; repeated unqualified anchors remain held',()=>{
 const result=assessHf100PortInstructionCoverage(actions(),printed);
 assert.equal(result.schemaVersion,HF100_PORT_COVERAGE_VERSION);
 assert.equal(result.sourceInstructionsIdentified,19);
 assert.equal(result.printedCoordinatesResolved,23);
 assert.equal(result.previouslyVerifiedLocalEdits,4);
 assert.equal(result.additionalLocalEditsVerified,8);
 assert.equal(result.structuralInstructionsHeld,6);
 assert.equal(result.localEditsHeld,1);
 assert.equal(result.instructionsStillHeld,7);
 assert.deepEqual(result.outcomes.filter(o=>o.result==='held').map(o=>o.ordinal),[5,6,9,10,11,14,15]);
 assert.equal(result.portFullyApplied,false);
 assert.equal(result.anyAdoptedAmendmentIntegratedIntoComposite,false);
 assert.equal(result.completeAssembledBillText,false);
 assert.equal(result.preVotePublicationProven,false);
 assert.equal(result.eventLinksAdded,0);
});

test('the originally ambiguous revolving line becomes checkable only if there is exactly one literal anchor',()=>{
 const one=printed.replace('in a revolving loan','in a separate loan');
 const r=assessHf100PortInstructionCoverage(actions(),one);
 assert.equal(r.additionalLocalEditsVerified,9);
 assert.equal(r.localEditsHeld,0);
 assert.deepEqual(r.outcomes.filter(x=>x.reason==='structural_unimplemented').map(x=>x.ordinal),[5,6,9,10,14,15]);
 assert.equal(r.portFullyApplied,false);
});

test('text-layer fusion cannot be repaired by guessing words or adjacent lines',()=>{
 const fused=printed.replace('grants issued','grantsissued')
  .replace('is for the CanStartup','isfor the CanStartup');
 const result=assessHf100PortInstructionCoverage(actions(),fused);
 assert.equal(result.additionalLocalEditsVerified,6);
 assert.equal(result.localEditsHeld,3);
 assert.equal(result.instructionsStillHeld,9);
 assert.deepEqual(result.outcomes.filter(o=>o.reason==='anchor_unresolved').map(o=>o.ordinal),[13,17]);
 assert.equal(result.completeAssembledBillText,false);
});

test('unreadable and duplicate original coordinates are counted as holds, never inferred from nearby lines',()=>{
 const missing=printed.replace('148.12 EFFECTIVE','148.13 EFFECTIVE');
 const held=assessHf100PortInstructionCoverage(actions(),missing);
 assert.equal(held.printedCoordinatesResolved,22);
 assert.equal(held.additionalLocalEditsVerified,7);
 assert.equal(held.outcomes[7]!.reason,'coordinate_unavailable');
 const duplicate=assessHf100PortInstructionCoverage(actions(),printed+'\n292.27 program established under Minnesota Statutes,');
 assert.equal(duplicate.outcomes[17]!.reason,'coordinate_unavailable');
 assert.equal(duplicate.additionalLocalEditsVerified,7);
});

test('instruction count, order, literal wording, first UE and adopted chain are immutable gates',()=>{
 assert.throws(()=>assessHf100PortInstructionCoverage(actions(marker.slice(0,-1).join('\n')),printed),
  /instruction count/);
 assert.throws(()=>assessHf100PortInstructionCoverage(actions([...marker,'Page 300, line 1, delete something'].join('\n')),printed),
  /instruction count/);
 const swapped=[...marker];[swapped[10],swapped[11]]=[swapped[11]!,swapped[10]!];
 assert.throws(()=>assessHf100PortInstructionCoverage(actions(swapped.join('\n')),printed),/wording\/order/);
 assert.throws(()=>assessHf100PortInstructionCoverage(actions(marker.join('\n').replace('CanStartup"','Other"')),printed),
  /wording\/order/);
 assert.throws(()=>assessHf100PortInstructionCoverage(actions(),printed.replace('UEH0100-1','UEH0100-2')),
  /identity changed/);
 const withRejected=actions();withRejected[2]!.outcome='adopted';
 assert.throws(()=>assessHf100PortInstructionCoverage(withRejected,printed),/adopted\/rejected/);
});
