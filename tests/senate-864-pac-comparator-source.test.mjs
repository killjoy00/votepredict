import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileHeldPacComparators} from '../src/evidence/senate-864-pac-comparator-source.mjs';
function fixture(){
 const cohort=Array.from({length:116},(_,i)=>({filerReg:String(10000+i),year:2024,rowKey:String(i).padStart(64,'0'),contributorReg:'90000',transactionDate:'2024-01-02',contributor:'Synthetic PAC',amount:'100.00'}));
 const broken=cohort.slice(2,25).map((r,i)=>({...r,rowKey:String(i+200).padStart(64,'0'),contributorReg:'',contributor:'Synthetic Individual'}));
 const allRows=[...cohort,...broken],outcomes=[{privateBlockCandidates:cohort.slice(0,25).map(r=>({key:[r.filerReg,r.year,r.rowKey].join('|')}))}];
 const originalRows=broken.map(r=>({filerRegistrationNumber:r.filerReg,year:r.year,rowKey:r.rowKey,transactionDate:r.transactionDate,amount:100,contributor:r.contributor,contributorRegistrationNumber:null,contributorType:'Individual'}));
 return {cohort,allRows,outcomes,originalRows};
}
test('original individual rows with no registration explain the 23 holds without relaxing or promoting',()=>{
 const x=fixture(),r=reconcileHeldPacComparators(x);assert.equal(r.heldTargetTransactions,23);assert.equal(r.exactCurrentRegulatorCanonicalKeyMatches,23);
 assert.equal(r.originalEntityTypes.Individual,23);assert.equal(r.originalRowsStillWithoutRegistration,23);assert.equal(r.unchangedStrictComparatorHolds,23);assert.equal(r.transactionsPromoted,0);
});
test('source absence and differing fields are distinct; names never supply a registration',()=>{
 const x=fixture();x.originalRows.pop();x.originalRows[0].contributorRegistrationNumber='90000';
 const r=reconcileHeldPacComparators(x);assert.equal(r.currentOriginalRowNotUniquelyObserved,1);assert.equal(r.currentOriginalFieldMismatches,1);assert.equal(r.originalRowsWithRegistration,0);assert.equal(r.transactionsPromoted,0);
});
test('identical source copies remain separate from canonical keys; contradictory copies hold',()=>{
 const x=fixture();x.originalRows.push({...x.originalRows[0]});const r=reconcileHeldPacComparators(x);
 assert.equal(r.exactCurrentRegulatorCanonicalKeyMatches,23);assert.equal(r.matchingCurrentRegulatorRowCopies,24);
 x.originalRows.at(-1).contributorType='Party Unit';assert.equal(reconcileHeldPacComparators(x).currentOriginalFieldMismatches,1);
});
