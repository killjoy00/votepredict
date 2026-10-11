/** #864 finance: do not conflate CFB viewer refs with independently authenticated PDF versions. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  selectServed2023to24OriginalYearEnds,served2023to24YearEndRef,
  parseServed2023to24YearEndHeader,auditServed2023to24OriginalYearEnd,
  summarize28YearEndSource,
} from '../src/evidence/cfb-2023-24-served-28-yearend-originals.js';
const P='docs/evaluation/source-proof/';
const data={
 queuePsv:readFileSync(P+'cfb-2021-25-served-senator-next-source-pdf-targets.psv','utf8'),
 viewerPsv:readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
 priorCeFirstPsv:readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8'),
 priorCeSecondPsv:readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
};
const targets=selectServed2023to24OriginalYearEnds(data);
function sample(t:typeof targets[number],receipt='February 28, 2025'){
  return 'Report of Receipts and Expenditures for Principal Campaign Committee\n'+
    'Registration Number: '+t.reg+'\nSenate District: '+t.district2022+'\n'+
    'Period Covered: 1/1/'+t.reportYear+' through 12/31/'+t.reportYear+'\n'+
    'Received by the Board '+receipt+'\n';
}
test('strict 28 exact original yearend versions, 14 real verified 2022 senators, two years each',()=>{
 assert.equal(targets.length,28);
 const personYear=new Set(targets.map(t=>t.reg+':'+t.reportYear));
 assert.equal(personYear.size,28);
 assert.equal(new Set(targets.map(t=>t.reg)).size,14);
 assert.equal(targets.filter(t=>t.reportYear===2023).length,14);
 assert.equal(targets.filter(t=>t.reportYear===2024).length,14);
 assert.ok(targets.every(t=>t.id===t.reg+':'+String(t.reportYear).slice(2)+':pcc:YE:0:0'
   &&t.district2022>=14&&t.district2022<=36&&t.district2022!==31
   &&t.actualSenator.length>5&&/^[a-f0-9]{64}$/.test(t.originalViewerApiSha256)));
 assert.ok(!targets.some(x=>x.actualSenator==='Unknown'));
 for(const t of targets){
   const r=served2023to24YearEndRef(t);
   assert.equal(r.amendment,0);assert.equal(r.period,'YE');assert.equal(r.se,'0');
   assert.equal(r.registrationNumber,t.reg);
 }
});
test('changes to source queue/viewer/API, historical serving senators or original ledger fail closed',()=>{
 assert.throws(()=>selectServed2023to24OriginalYearEnds({...data,
   viewerPsv:data.viewerPsv.replace('2024|18430','2024|99999')}),/changed/);
 assert.throws(()=>selectServed2023to24OriginalYearEnds({...data,
   queuePsv:data.queuePsv.replace('P2_AUTHENTICATE_ORIGINAL_FIRST','P9_FAKE')}),/changed/);
 assert.throws(()=>selectServed2023to24OriginalYearEnds({...data,
   priorCeSecondPsv:data.priorCeSecondPsv.replace('Liz Boldon','Never Served')}),/changed/);
});
test('exact first page registration, old/new district, reporting period and source Board receipt are essential',()=>{
 const year2023=targets.find(t=>t.reportYear===2023)!;
 const year2024=targets.find(t=>t.reportYear===2024)!;
 const parsed=parseServed2023to24YearEndHeader(year2023,sample(year2023));
 assert.equal(parsed.verified,true);
 assert.equal(parseServed2023to24YearEndHeader(year2024,sample(year2024)).verified,true);
 assert.equal(parseServed2023to24YearEndHeader(year2024,
   sample(year2024).replace('Registration Number: '+year2024.reg,'Registration Number: 99999')).verified,false);
 assert.equal(parseServed2023to24YearEndHeader(year2023,
   sample(year2023).replace('Senate District: '+year2023.district2022,'Senate District: 50')).verified,false);
 assert.equal(parseServed2023to24YearEndHeader(year2023,
   sample(year2023).replace('12/31/2023','12/30/2023')).verified,false);
 assert.equal(parseServed2023to24YearEndHeader(year2024,
   sample(year2024).replace('for Principal Campaign Committee','for Lobbyists')).verified,false);
 assert.equal(parseServed2023to24YearEndHeader(year2024,sample(year2024,'February 1, 2024')).verified,false);
});
test('only original CFB PDF binaries may be counted; duplicate PDF hashes never counted twice',()=>{
 const reports=targets.map((t,i)=>{
   const ref=served2023to24YearEndRef(t);
   const url='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+
     ref.year+'&type=pcc&period=YE&se=0&regnum='+ref.registrationNumber+'&amend=0';
   return auditServed2023to24OriginalYearEnd(t,{
     sourceUrl:url,sha256:(i+1).toString(16).padStart(64,'0'),bytes:8999,
     observedAt:'2026-10-11T15:15:00.000Z',text:sample(t)},null);
 });
 assert.ok(reports.every(r=>r.status==='original_pdf_first_page_authenticated'));
 assert.equal(summarize28YearEndSource(reports).all28OriginalsIndependentlyAuthenticated,true);
 const aliasReports=reports.map((r,i)=>i===27?{...r,sourcePdfSha256:reports[0]!.sourcePdfSha256}:r);
 const alias=summarize28YearEndSource(aliasReports);
 assert.equal(alias.all28OriginalsIndependentlyAuthenticated,false);
 assert.equal(alias.independentlyUniqueOriginalPdfBinaries,27);
 const wrong=auditServed2023to24OriginalYearEnd(targets[0]!,null,'official_source_http_failure');
 assert.equal(wrong.status,'official_source_fetch_failed');
 assert.ok(reports.every(r=>r.statutoryDueOn===null));
});

test('permanent source ledger has 28 PDF byte hashes from two independent original runs',()=>{
 const P='docs/evaluation/source-proof/';
 const checkpoint=JSON.parse(readFileSync(P+
   'cfb-2023-24-verified-served-28-original-yearend-source-checkpoint.json','utf8'));
 const ledger=readFileSync(checkpoint.permanentPdfLedger.path,'utf8');
 const rows=ledger.trimEnd().split('\n').map((l:string)=>l.split('|'));
 const {createHash}=require('node:crypto') as typeof import('node:crypto');
 const blobSha=createHash('sha1').update('blob '+Buffer.byteLength(ledger,'utf8')+'\0')
   .update(ledger).digest('hex');
 assert.equal(blobSha,checkpoint.permanentPdfLedger.gitBlobSha);
 assert.equal(Buffer.byteLength(ledger,'utf8'),7494);
 assert.equal(rows.length,28);
 assert.equal(checkpoint.independentOriginalSourceRuns.length,2);
 assert.equal(checkpoint.sourceResult.uniqueOriginalPdfSha256,28);
 assert.equal(checkpoint.identicalMetadataAcrossTwoOfficialSourceRuns.originalPdfBinarySha256,true);
 assert.equal(checkpoint.identicalMetadataAcrossTwoOfficialSourceRuns.coveredPeriodAndBoardReceipt,true);
 assert.equal(checkpoint.remaining.legalDueCalendarIndependentFor2023And2024NotYetAuthenticated,true);
 const byId=new Map(rows.map((r:string[])=>[r[0],r]));
 assert.equal(byId.size,28);
 assert.deepEqual([...byId.keys()].sort(),targets.map(t=>t.id).sort());
 const sigs=new Set<string>();
 for(const t of targets){
   const r=byId.get(t.id)!;
   assert.equal(r.length,12);
   assert.equal(r[1],t.actualSenator);
   assert.equal(r[2],String(t.district2022));
   assert.equal(r[3],t.reg);
   assert.equal(r[4],t.originalViewerApiSha256);
   assert.match(r[5]!,/^[0-9a-f]{64}$/);
   assert.ok(Number.isInteger(Number(r[6]))&&Number(r[6])>=300);
   assert.equal(r[7],t.reportYear+'-01-01');
   assert.equal(r[8],t.reportYear+'-12-31');
   assert.ok(r[9]!>=r[8]!);
   assert.equal(r[10],'independently_authenticated_original_pdf_first_page');
   assert.equal(r[11],'-');
   sigs.add(r[5]!);
 }
 assert.equal(sigs.size,28);
 assert.equal(checkpoint.scope.statutoryOwedDenominator,null);
 assert.equal(checkpoint.safeguards.noRawPdfBodiesOrCandidateDonorText,true);
 assert.equal(checkpoint.safeguards.keepIssue864Open,true);
});
