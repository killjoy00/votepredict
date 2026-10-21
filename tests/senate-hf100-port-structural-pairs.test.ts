import assert from 'node:assert/strict';
import test from 'node:test';
import {assessHf100PortStructuralPairs,HF100_PORT_STRUCTURAL_PAIRS_VERSION}
 from '../src/operations/senate-hf100-port-structural-pairs.js';
import type {PaperAction} from '../src/operations/senate-vote-paper-parser.js';

const cangrow='The CanGrow revolving loan account is established in the special revenue fund. Money in the account, including interest, is appropriated to the commissioner to make loan financing grants under the CanGrow program.';
const canstartup='The CanStartup revolving loan account is established in the special revenue fund. Money in the account, including interest, is appropriated to the commissioner to make grants under the CanStartup program.';
const markers=[
 'Page 56, line 7, before the second "eight" insert "more than"',
 'Page 56, line 8, before "100" insert "more than"',
 'Page 71, line 23, before "eight" insert "up to"',
 'Page 71, line 26, before "800" insert "up to"',
 'Page 144, line 22, delete everything after "(a)" and insert "'+cangrow+'"',
 'Page 144, delete line 23',
 'Page 146, line 10, before "revolving" insert "CanGrow"',
 'Page 148, line 12, delete "2024" and insert "2025"',
 'Page 175, line 7, delete everything after "(a)" and insert "'+canstartup+'"',
 'Page 175, delete line 8',
 'Page 177, line 8, before "revolving" insert "CanStartup"',
 'Page 251, line 21, delete "2024" and insert "2025"',
 'Page 291, line 26, delete "grants issued" and insert "deposit in the CanGrow revolving loan account established"',
 'Page 291, line 27, delete everything after the second comma, and insert "subdivision 4."',
 'Page 291, delete lines 28 to 32',
 'Page 292, line 1, after "percent" insert "of this appropriation"',
 'Page 292, line 26, after "for" insert "deposit in"',
 'Page 292, line 27, delete "program" and insert "revolving loan account"',
 'Page 292, line 28, before the period, insert ", subdivision 3"'
];
const pdf=[
 'HF100 FIRST UNOFFICIAL REVISOR UEH0100-1',
 '56.7 may not contain more than eight grams of usable flower, eight grams of a cannabis',
 '56.8 concentrate, or an edible cannabis product infused with 100 milligrams of',
 '71.23 hemp products consisting primarily of hemp plant parts, eight grams',
 '71.26 and lower-potency hemp edibles infused with 800 milligrams',
 '144.22 Subd. 4. Loan financing grants. (a) The office shall establish a revolving loan account',
 '144.23 to make loan financing grants under the CanGrow program.',
 '144.24 (b) The office must award grants to nonprofit corporations through a competitive grant',
 '146.10 (b) Loan repayment of principal must be paid to the office for deposit in the revolving',
 '148.12 EFFECTIVE DATE. This section is effective March 1, 2024.',
 '175.7 Subd. 3. Grants. (a) The commissionershall establish a revolving loan account to make',
 '175.8 grants under the CanStartup program.',
 '175.9 (b) The commissioner must award grantsto nonprofit corporationsthrough a competitive',
 '177.8 revolving loan account. Loan interest payments must be deposited in a revolving loan',
 '251.21 effective March 1, 2024.',
 '291.26 $1,000,000 each year is for grants issued under',
 '291.27 Minnesota Statutes,section 342.69, to eligible',
 '291.28 organizations to help farmers navigate the',
 '291.29 regulatory structure of the legal cannabis',
 '291.30 industry and to nonprofit corporations to',
 '291.31 provide loans to farmers for expansion into',
 '291.32 the legal cannabisindustry. Of these amounts,',
 '292.1 up to three percent may be used for',
 '292.26 (b) $2,000,000 each year is for the CanStartup',
 '292.27 program established under Minnesota Statutes,',
 '292.28 section 116J.659.',
 '296.19 (b) $4,000,000 in fiscal year 2024 and $4,000,000 in fiscal year 2025 are'
].join('\n');

function actions(port=markers.join('\n')):PaperAction[]{
 const entries:Array<[number,PaperAction['kind'],PaperAction['outcome'],string|null]>=[
 [2,'amendment','adopted','Senator Port moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\n'+port],
 [3,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 37, line 7, after "may" insert "authority"'],
 [4,'amendment','rejected','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 155, line 26, delete "ten" and insert "12"'],
 [5,'procedural','unknown',null],
 [6,'amendment','adopted','Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 294, line 32, delete a number'],
 [7,'amendment','adopted','Senator Hoffman moved to amend H.F. No. 100, the first unofficial engrossment, as follows:\nPage 296, line 19, delete "$4,000,000" and insert "$5,500,000" and delete "$4,000,000" and insert "$5,500,000"'],
 [8,'procedural','unknown',null],
 [9,'passage','unknown',null]
 ];
 return entries.map(([sequence,kind,outcome,proposedText])=>({
  key:'source-'+sequence,sequence,start:sequence*200,end:sequence*200+100,
  billIdentifier:'HF100',kind,motionText:proposedText
    ?proposedText.split('as follows:')[0]!:kind,
  questionText:'question '+sequence,proposedText,
  baseLocator:kind==='amendment'?'versions/ue/1/':null,
  outcome,priorAdoptedKeys:sequence===9?[2,3,6,7].map(n=>'source-'+n):[],
  yeas:null,nays:null,ballotSignature:null,rollStart:null
 }));
}

test('original full quotes and complete next-line deletes prove three isolated structural pairs, never Port assembly',()=>{
 const result=assessHf100PortStructuralPairs(actions(),pdf);
 assert.equal(result.schemaVersion,HF100_PORT_STRUCTURAL_PAIRS_VERSION);
 assert.equal(result.journalStructuralInstructions,6);
 assert.equal(result.structuralPairsConsidered,3);
 assert.equal(result.structuralPairsVerified,3);
 assert.equal(result.structurallyPairedInstructionsVerified,6);
 assert.equal(result.structuralPairsHeld,0);
 assert.equal(result.priorIsolatedLocalInstructionsVerified,12);
 assert.equal(result.totalIsolatedPortInstructionsVerified,18);
 assert.equal(result.portInstructionsStillHeld,1);
 assert.deepEqual(result.outcomes.map(o=>o.instructions),[[5,6],[9,10],[14,15]]);
 assert.deepEqual(result.outcomes.map(o=>o.status),Array(3).fill('preview_checked'));
 assert.equal(result.portFullyApplied,false);
 assert.equal(result.completeAssembledBillText,false);
 assert.equal(result.exactFinalTextWhitespaceCertified,false);
 assert.equal(result.preVotePublicationProven,false);
 assert.equal(result.eventLinksAdded,0);
});

test('complete original journal quoted replacements and adjacent deletion instructions are mandatory',()=>{
 assert.throws(()=>assessHf100PortStructuralPairs(actions(markers.join('\n').replace('including interest','including dividends')),pdf),
  /complete structural quoted instruction/);
 const changed=[...markers];changed[9]='Page 175, delete line 9';
 assert.throws(()=>assessHf100PortStructuralPairs(actions(changed.join('\n')),pdf),/wording\/order|source-exact/);
 const changed2=[...markers];changed2[13]='Page 291, line 27, delete everything after the first comma, and insert "subdivision 4."';
 assert.throws(()=>assessHf100PortStructuralPairs(actions(changed2.join('\n')),pdf),/wording\/order|source-exact/);
});

test('changed printed content, missing line, or duplicate coordinate remains held; never searches nearby text',()=>{
 for(const mutated of [
  pdf.replace('144.23 to make','144.25 to make'),
  pdf.replace('175.8 grants under','175.8 permits under'),
  pdf+'\n291.30 industry and to nonprofit corporations to'
 ]){
  const result=assessHf100PortStructuralPairs(actions(),mutated);
  assert.equal(result.structuralPairsVerified,2);
  assert.equal(result.structuralPairsHeld,1);
  assert.equal(result.structurallyPairedInstructionsVerified,4);
  assert.equal(result.totalIsolatedPortInstructionsVerified,16);
  assert.equal(result.portInstructionsStillHeld,3);
  assert.equal(result.completeAssembledBillText,false);
 }
});

test('same-content typographic fusions in PDF extraction do not authorize a new word or altered punctuation',()=>{
 const fused=pdf.replace('grantsto','grants to')
  .replace('corporationsthrough','corporations through')
  .replace('commissionershall','commissioner shall')
  .replace('cannabisindustry','cannabis industry');
 const result=assessHf100PortStructuralPairs(actions(),fused);
 assert.equal(result.structuralPairsVerified,3);
 assert.equal(result.exactFinalTextWhitespaceCertified,false);
 const wrongComma=pdf.replace('342.69, to eligible','342.69; to eligible');
 assert.equal(assessHf100PortStructuralPairs(actions(),wrongComma).outcomes[2]?.status,'held');
});

test('unproven 291.26 literal target holds dependent 291.27-32 cross-line edit',()=>{
 const fused=pdf.replace('for grants issued under','for grantsissued under');
 const result=assessHf100PortStructuralPairs(actions(),fused);
 assert.equal(result.priorIsolatedLocalInstructionsVerified,11);
 assert.equal(result.structuralPairsVerified,2);
 assert.equal(result.outcomes[2]?.reason,'prior_related_edit_held');
 assert.equal(result.portInstructionsStillHeld,4);
});

test('rejected amendment and adopted-source passage chain drift fail before structural previews',()=>{
 const bad=actions();bad[2]!.outcome='adopted';
 assert.throws(()=>assessHf100PortStructuralPairs(bad,pdf),/adopted\/rejected/);
 const reordered=actions();reordered[7]!.priorAdoptedKeys.reverse();
 assert.throws(()=>assessHf100PortStructuralPairs(reordered,pdf),/passage chain/);
});
