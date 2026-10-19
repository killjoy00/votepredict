import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {selectTwoComparatorCompleteOriginalPages,inspectPrintedOriginalCells,printedCellBorders} from '../src/evidence/senate-864-pac-two-original-pages.mjs';
const row={filerReg:'12345',year:2022,rowKey:'a'.repeat(64),contributorReg:'54321',transactionDate:'2022-01-10',contributor:'Synthetic Source PAC',amount:'25.00'};
const word=(str,x,y,width=40)=>({str,transform:[10,0,0,10,x,y],width});
function fixture(){
 const lines=[];for(const y of [100,150,200])lines.push(0,0,y,1,600,y);
 for(const x of [0,100,200,400,600])lines.push(0,x,100,1,x,200);
 return {items:[word('Date',10,170),word('Registration',110,170,70),word('Contributor Name',220,170,100),word('Total',480,170),
  word('01/10/2022',10,120,70),word('54321',110,120),word('Synthetic Source PAC',220,120,110),word('25.00',480,120)],
  operators:{fnArray:[OPS.constructPath],argsArray:[[OPS.stroke,[new Float32Array(lines)],[0,100,600,200]]]},
  row,registeredName:row.contributor,firstPageText:'Committee number 12345 Report 2022',report:{committeeReg:'12345',reportYear:2022}};
}
test('physical source cell boundaries, four literal fields, labelled columns and report identity are independent gates',()=>{
 const f=fixture(),good=inspectPrintedOriginalCells(f);assert.equal(good.labelledSinglePrintedRowContained,true);
 assert.equal(inspectPrintedOriginalCells({...f,operators:{fnArray:[],argsArray:[]}}).labelledSinglePrintedRowContained,false,
  'proximity without source borders cannot qualify');
 assert.equal(inspectPrintedOriginalCells({...f,firstPageText:'Different report 99999 2024'}).labelledSinglePrintedRowContained,false);
 const cross=fixture();cross.items.find(x=>x.str==='25.00').transform[5]=160;
 assert.equal(inspectPrintedOriginalCells(cross).labelledSinglePrintedRowContained,false,'adjacent printed row amount rejected');
 const label=fixture();label.items.find(x=>x.str==='Total').str='Cash';
 assert.equal(inspectPrintedOriginalCells(label).labelledSinglePrintedRowContained,false,'cash cannot become total');
});
test('two-case selector preserves whole recipient/year comparator and candidate-version uniqueness',()=>{
 const b={...row,rowKey:'b'.repeat(64),filerReg:'12346'};const cohort=[row,b];
 const outcomes=cohort.map((r,i)=>({privateBlockCandidates:[{key:[r.filerReg,r.year,r.rowKey].join('|'),reportVersionId:'v'+i,pageNumber:2,anchorLine:1}]}));
 assert.equal(selectTwoComparatorCompleteOriginalPages(cohort,cohort,outcomes).length,2);
 assert.throws(()=>selectTwoComparatorCompleteOriginalPages(cohort,[...cohort,{...row,rowKey:'c'.repeat(64),contributorReg:''}],outcomes),/scope changed/);
 outcomes[0].privateBlockCandidates.push({...outcomes[0].privateBlockCandidates[0],reportVersionId:'another'});
 assert.throws(()=>selectTwoComparatorCompleteOriginalPages(cohort,cohort,outcomes),/one original-version/);
});
test('source graphics transforms and unsupported path encodings fail safely',()=>{
 const x=printedCellBorders({fnArray:[OPS.save,OPS.transform,OPS.constructPath,OPS.restore],argsArray:[[],[2,0,0,2,10,20],[OPS.stroke,[new Float32Array([0,0,10,1,100,10])],[0,10,100,10]],[]]});
 assert.deepEqual(x.horizontal,[{x1:10,x2:210,y:40}]);
 assert.throws(()=>printedCellBorders({fnArray:[OPS.constructPath],argsArray:[[OPS.stroke,[new Float32Array([99])],[]]]}),/Unsupported/);
});
