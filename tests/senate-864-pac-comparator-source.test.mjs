import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileHeldPacComparators,originalComparatorRowsetSha,clarifyUnclassifiedOriginalRows} from '../src/evidence/senate-864-pac-comparator-source.mjs';
test('clarify exact raw blanks and receipt categories without exposing names or assigning a class',()=>{
 const r=clarifyUnclassifiedOriginalRows([{contributor:'Unknown',contributorType:null,raw:{contributor:'','contrib type':'','contrib reg num':'','receipt type':'Contribution'}},
 {contributor:'Private comparator name',contributorType:'Other',raw:{contributor:'Private comparator name','contrib type':'Other','contrib reg num':'','receipt type':'Loan'}}]);
 assert.equal(r.blankOriginalContributor,1);assert.equal(r.blankOriginalType,1);assert.equal(r.rawTypeAgreesWithParser,2);
 assert.equal(r.receiptClass.loan,1);assert.ok(!JSON.stringify(r).includes('Private comparator name'));
});
function fixture(){
 const cohort=Array.from({length:116},(_,i)=>({filerReg:String(10000+i),year:2024,rowKey:String(i).padStart(64,'0'),contributorReg:'90000',transactionDate:'2024-01-02',contributor:'Synthetic PAC',amount:'100.00'}));
 const broken=cohort.slice(2,25).map((r,i)=>({...r,rowKey:String(i+200).padStart(64,'0'),contributorReg:'',contributor:'Synthetic Individual'}));
 const allRows=[...cohort,...broken],outcomes=[{privateBlockCandidates:cohort.slice(0,25).map(r=>({key:[r.filerReg,r.year,r.rowKey].join('|')}))}];
 const originalRows=broken.map(r=>({kind:'contribution',filerRegistrationNumber:r.filerReg,year:r.year,rowKey:r.rowKey,transactionDate:r.transactionDate,amount:100,contributor:r.contributor,contributorRegistrationNumber:null,contributorType:'Individual'}));
 originalRows.push(...cohort.map(r=>({kind:'contribution',filerRegistrationNumber:r.filerReg,year:r.year,rowKey:r.rowKey,transactionDate:r.transactionDate,amount:100,contributor:r.contributor,contributorRegistrationNumber:r.contributorReg,contributorType:'Political Committee/Fund'})));
 return {cohort,allRows,outcomes,originalRows};
}
test('original individual rows with no registration explain the 23 holds without relaxing or promoting',()=>{
 const x=fixture(),r=reconcileHeldPacComparators(x);assert.equal(r.heldTargetTransactions,23);assert.equal(r.exactCurrentRegulatorCanonicalKeyMatches,23);
 assert.equal(r.originalEntityTypes.Individual,23);assert.equal(r.originalRowsStillWithoutRegistration,23);assert.equal(r.unchangedStrictComparatorHolds,23);assert.equal(r.transactionsPromoted,0);
});
test('source absence and differing fields are distinct; names never supply a registration',()=>{
 const x=fixture();x.originalRows.splice(22,1);x.originalRows[0].contributorRegistrationNumber='90000';
 const r=reconcileHeldPacComparators(x);assert.equal(r.currentOriginalRowNotUniquelyObserved,1);assert.equal(r.currentOriginalFieldMismatches,1);assert.equal(r.originalRowsWithRegistration,0);assert.equal(r.transactionsPromoted,0);
});
test('identical source copies remain separate from canonical keys; contradictory copies hold',()=>{
 const x=fixture();x.originalRows.push({...x.originalRows[0]});const r=reconcileHeldPacComparators(x);
 assert.equal(r.exactCurrentRegulatorCanonicalKeyMatches,23);assert.equal(r.matchingCurrentRegulatorRowCopies,24);
 x.originalRows.at(-1).contributorType='Party Unit';assert.equal(reconcileHeldPacComparators(x).currentOriginalFieldMismatches,1);
});
test('independent full rowset commitment ignores only row order and CSV serialization',()=>{
 const rows=fixture().originalRows,sha=originalComparatorRowsetSha(rows);
 assert.equal(originalComparatorRowsetSha([...rows].reverse()),sha);
 assert.notEqual(originalComparatorRowsetSha([...rows,rows[0]]),sha);
 const changed=structuredClone(rows);changed[0].contributorType='Other';assert.notEqual(originalComparatorRowsetSha(changed),sha);
 changed[0].raw={newColumn:'literal original data'};assert.notEqual(originalComparatorRowsetSha(changed),sha);
});

test('entity-typed lane requires EVERY original comparator and leaves all old strict gates unchanged',()=>{
 const x=fixture();let r=reconcileHeldPacComparators(x);
 assert.equal(r.independentEntityTypedComparator.completeTargets,23);assert.equal(r.unchangedStrictComparatorHolds,23);assert.equal(r.transactionsPromoted,0);
 x.originalRows[0].contributorType='Other';r=reconcileHeldPacComparators(x);
 assert.equal(r.independentEntityTypedComparator.completeTargets,22);assert.equal(r.independentEntityTypedComparator.heldForUnclassifiedEntity,1);
 x.originalRows[1].contributorType='Political Committee/Fund';r=reconcileHeldPacComparators(x);
 assert.equal(r.independentEntityTypedComparator.heldForRegisteredEntityWithoutRegistration,1);
 x.originalRows=x.originalRows.filter(s=>s.rowKey!==x.cohort[4].rowKey);
 assert.equal(reconcileHeldPacComparators(x).independentEntityTypedComparator.heldForOriginalMismatch,1);
});
test('same registered PAC/date/amount collisions, source conflicts and unknown names remain held',()=>{
 const x=fixture(),t=x.cohort[2],other={...t,rowKey:'f'.repeat(64)};
 x.allRows.push(other);x.originalRows.push({...x.originalRows.find(s=>s.rowKey===t.rowKey),rowKey:other.rowKey});
 assert.equal(reconcileHeldPacComparators(x).independentEntityTypedComparator.heldForTargetIdentityOrSignature,1);
 x.allRows[3].sourceConflict=true;assert.ok(reconcileHeldPacComparators(x).independentEntityTypedComparator.heldTargets>=2);
});

test('a contradictory raw column in an original duplicate cannot disappear behind a canonical key',()=>{
 const x=fixture();x.originalRows.push({...x.originalRows[0],raw:{'Contrib zip':'different source value'}});
 assert.equal(reconcileHeldPacComparators(x).independentEntityTypedComparator.heldForOriginalMismatch,1);
});
