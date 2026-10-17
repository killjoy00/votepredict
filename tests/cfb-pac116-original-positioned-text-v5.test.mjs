import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
 POSITIONED_A1_PAC_VERSION,reconcilePositionedOriginalA1Page,
 safePositionedOriginalSummary
} from '../src/evidence/cfb-pac116-original-positioned-text-v5.mjs';

const SHA='c'.repeat(64),PAC='Education Minn PAC';
const regNames=new Map([['30558',PAC],['70001','MN Chamber Leadership Fund']]);
const report=(o={})=>({
 reportVersionId:'18888:24:pcc:YE:0:0',pdfSha:SHA,
 committeeReg:'18888',reportYear:2024,pageNumber:3,...o
});
const receipt=(i=0,o={})=>({
 filerReg:'18888',year:2024,rowKey:(i+1).toString(16).padStart(64,'0'),
 contributorReg:'30558',contributor:PAC,
 transactionDate:'2024-04-10',amount:String(300+i)+'.00',...o
});
const cohort=Array.from({length:116},(_,i)=>receipt(i));
const pageText='SCHEDULE A1 Contributions from Political Committees and Funds 30558';
function item(str,x,y,size=10){
 return {str,width:str.length*5.5,transform:[size,0,0,size,x,y]};
}
const header=[
 item('Date received',40,710),item('Registration number',145,710),
 item('Name and full address of contributor',265,710),
 item('Col. 3 Total',525,710)
];
const source=[
 item('04/10/2024',40,670),item('30558',145,670),
 item('Education Minn PAC',265,670),item('$300.00',525,670)
];
function check(o={}){
 return reconcilePositionedOriginalA1Page({
  items:[...header,...source],cachedPageText:pageText,
  report:report(),allRows:cohort,registeredNames:regNames,
  sourceHashVerified:true,...o
 });
}
function score(outcomes,opts={}){
 return safePositionedOriginalSummary({
  cohort,allRows:cohort,reports:[report()],
  pageOutcomes:outcomes,originalBodiesRehashed:1,
  selectedUniquePages:1,sourcePagesDeferred:0,parseErrors:0,...opts
 });
}

test('source coordinates require registered PAC number, date, legal name and total on one line',()=>{
 const a=check();
 assert.equal(a.a1SourcePositioned,true);
 assert.equal(a.pacIdLines,1);
 assert.equal(a.regAndDateLines,1);
 assert.equal(a.regAndMoneyLines,1);
 assert.equal(a.regDateMoneyNameLines,1);
 assert.equal(a.source4FieldCandidates,1);
 assert.equal(a.candidateRowsWith4ColumnHeader,1);
 assert.equal(a.positionedGeometryOriginalHitPairs,1);
 const s=score([a]);
 assert.equal(s.schema,POSITIONED_A1_PAC_VERSION);
 assert.equal(s.distinctPACContributionsWithPositionedCandidate,1);
 assert.equal(s.sameBaselinePairsWithExplicitColumnsAndComparator,1);
 assert.equal(s.distinctPACContributionsWithPositionedVerifiedOriginalRow,1);
 assert.equal(s.historicalEligibleIssueFinanceFeaturesActivated,0);
 assert.equal(s.historicalEligibilityOrServingChanged,false);
 assert.ok(!JSON.stringify(s).includes('18888'));
 assert.ok(!JSON.stringify(s).includes('30558'));
 assert.ok(!JSON.stringify(s).includes('Education'));
 assert.ok(!JSON.stringify(s).includes('300.00'));
});
test('PAC number on unrelated header or nearby separate baseline is not transaction',()=>{
 const a=check({items:[
  ...header,item('30558',145,670),
  item('04/10/2024',40,656),item('Education Minn PAC',265,656),
  item('$300.00',525,656)
 ]});
 assert.equal(a.source4FieldCandidates,0);
 assert.equal(a.privateQualifiedHits.length,0);
 assert.equal(score([a]).distinctPACContributionsWithPositionedVerifiedOriginalRow,0);
});
test('source four-field same-line candidate without column headers remains unverified',()=>{
 const a=check({items:source});
 assert.equal(a.source4FieldCandidates,1);
 assert.equal(a.positionedGeometryOriginalHitPairs,0);
 assert.equal(score([a]).distinctPACContributionsWithPositionedCandidate,1);
 assert.equal(score([a]).distinctPACContributionsWithPositionedVerifiedOriginalRow,0);
});
test('PAC number in legal name or amount column does not satisfy registration geometry',()=>{
 const a=check({items:[
  ...header,item('04/10/2024',40,670),
  item('Education Minn PAC 30558',265,670),
  item('$300.00',525,670)
 ]});
 assert.equal(a.source4FieldCandidates,1);
 assert.equal(a.positionedGeometryOriginalHitPairs,0);
});
test('wrong date, money or legal counterparty cannot create verified row',()=>{
 for(const altered of [
  [item('04/11/2024',40,670),...source.slice(1)],
  [...source.slice(0,3),item('$999.00',525,670)],
  [source[0],source[1],item('Completely Different Fund',265,670),source[3]]
 ]){
  const a=check({items:[...header,...altered]});
  assert.equal(a.source4FieldCandidates,0);
  assert.equal(a.positionedGeometryOriginalHitPairs,0);
 }
});
test('unknown source hash, wrong financial schedule or foreign receiving committee are held',()=>{
 assert.throws(()=>check({sourceHashVerified:false}),/Unverified original PDF/);
 assert.equal(check({cachedPageText:'Schedule B1 - PAC 30558'}).source4FieldCandidates,0);
 assert.equal(check({report:report({committeeReg:'77777'})}).source4FieldCandidates,0);
});
test('each amended version is separate but does not establish public availability',()=>{
 const a=check(),b=check({report:report({reportVersionId:'18888:24:pcc:YE:0:1'})});
 const s=score([a,b],{reports:[report(),report({reportVersionId:'18888:24:pcc:YE:0:1'})]});
 assert.equal(s.distinctPACContributionsWithPositionedVerifiedOriginalRow,1);
 assert.equal(s.sameBaselinePairsWithExplicitColumnsAndComparator,2);
 assert.equal(s.independentlyProvenHistoricalExactVersionPublicBy,0);
});
test('unknown full comparator and competing same-signature contribution both hold',()=>{
 const a=check(),b=score([a],{allRows:[...cohort,receipt(900,{contributorReg:''})]});
 assert.equal(b.distinctPACContributionsWithPositionedVerifiedOriginalRow,0);
 assert.equal(b.receivingCommitteeYearGroupsWithIncompleteComparator,1);
 const duplicate=score([a],{allRows:[...cohort,receipt(900,{amount:'300.00'})]});
 assert.equal(duplicate.distinctPACContributionsWithPositionedVerifiedOriginalRow,0);
 assert.equal(duplicate.canonicalCompetitionOrIncompleteRecipientRowsHeld,1);
});
test('fused PDF item cannot fabricate separate physically aligned columns',()=>{
 const a=check({items:[
  ...header,item('04/10/2024 30558 Education Minn PAC $300.00',40,670)
 ]});
 assert.equal(a.source4FieldCandidates,1);
 assert.equal(a.positionedGeometryOriginalHitPairs,0);
});
function literal(s){
 return '('+s.replaceAll('\\','\\\\').replaceAll('(','\\(')
  .replaceAll(')','\\)')+')';
}
function buildSmallPositionedPdf(){
 const content=[
  ['SCHEDULE A1 - Contributions from Political Committees',45,750],
  ['Date received',40,710],['Registration number',145,710],
  ['Name and full address of contributor',265,710],
  ['Col. 3 Total',525,710],
  ['04/10/2024',40,670],['30558',145,670],
  ['Education Minn PAC',265,670],['$300.00',525,670]
 ].map(([s,x,y])=>'BT /F1 10 Tf 1 0 0 1 '+x+' '+y+
  ' Tm '+literal(s)+' Tj ET').join('\n');
 let pdf='%PDF-1.4\n',offsets=[0];
 const add=s=>{
  offsets.push(Buffer.byteLength(pdf));
  pdf+=String(offsets.length-1)+' 0 obj\n'+s+'\nendobj\n';
 };
 add('<< /Type /Catalog /Pages 2 0 R >>');
 add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
 add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 add('<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'\nendstream');
 const pos=Buffer.byteLength(pdf);
 pdf+='xref\n0 6\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))
  pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+pos+'\n%%EOF\n';
 return new Uint8Array(Buffer.from(pdf));
}
test('locked PDF.js returns real x/y items from a miniature original-PDF fixture',async()=>{
 const task=getDocument({data:buildSmallPositionedPdf(),verbosity:0,
  useSystemFonts:false,disableFontFace:true});
 let doc=null;
 try{
  doc=await task.promise;
  assert.equal(doc.numPages,1);
  const page=await doc.getPage(1);
  const text=await page.getTextContent({disableCombineTextItems:true});
  const s=reconcilePositionedOriginalA1Page({
   items:text.items,cachedPageText:pageText,report:report({pageNumber:1}),
   allRows:cohort,registeredNames:regNames,sourceHashVerified:true
  });
  assert.equal(s.source4FieldCandidates,1);
  assert.equal(s.positionedGeometryOriginalHitPairs,1);
 }finally{
  if(doc)await doc.destroy();
  else await task.destroy();
 }
});
