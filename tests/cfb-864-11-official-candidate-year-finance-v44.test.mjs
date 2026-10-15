import test from 'node:test';
import assert from 'node:assert/strict';
import {selectV44ExactSources,parseOfficialCandidateAnnualFinancialSummary}
 from '../scripts/acquire-cfb-864-eleven-public-board-financial-years-v44.mjs';
test('V44 picks exactly 11 source-authenticated official CFB registration/segments and 13 unique year rollups from 9+5 V43',()=>{
 const targets=selectV44ExactSources();
 assert.equal(targets.length,11);
 assert.equal(targets.reduce((n,x)=>n+x.years.length,0),13);
 assert.equal(targets.reduce((n,x)=>n+x.versionIds.length,0),14);
 assert.ok(targets.some(x=>x.reg==='17929'&&x.years.join(',')==='2021,2022'));
});
test('Board financial summary parser never treats partial categories or absent year as zero',()=>{
 const vals=[
 ['2022 - Election year',''],['Most recent report through','12/31/2022'],
 ['Individuals contributions','$25.00'],['Lobbyist contributions','$100.00'],
 ['Committee/fund contributions','$900.00'],['Party unit contributions','$0.00'],
 ['Other contributions','$0.00'],['Public subsidy payments','$0.00'],
 ['Loans payable income','$0.00'],['Miscellaneous income','$0.00'],['Total receipts','$1,025.00']
 ];
 const table=vals.map(([a,b])=>'<tr><th>'+a+'</th><td>'+b+'</td></tr>').join('');
 const parsed=parseOfficialCandidateAnnualFinancialSummary(table);
 assert.equal(parsed.get(2022).boardAnnualReportedReceiptsCents,102500);
 assert.equal(parsed.get(2022).aggregateArithmeticVerified,true);
 assert.equal(parsed.has(2021),false);
 const wrong=parseOfficialCandidateAnnualFinancialSummary(table.replace('$1,025.00','$4,025.00'));
 assert.equal(wrong.get(2022).boardAnnualReportedReceiptsCents,null);
 assert.equal(wrong.get(2022).aggregateArithmeticVerified,false);
});
