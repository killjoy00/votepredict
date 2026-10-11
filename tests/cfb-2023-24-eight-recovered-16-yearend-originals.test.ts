/** #864 original 2023/24 finance source PDF proof for 8 actual 2022 senators. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  selectEightRecoveredSenators16OriginalYearends,
  classifyEightRecovered16OriginalSourceRuns,
} from '../src/evidence/cfb-2023-24-eight-recovered-16-yearend-originals.js';
import {
  served2023to24YearEndRef,auditServed2023to24OriginalYearEnd,
  summarize28YearEndSource,
} from '../src/evidence/cfb-2023-24-served-28-yearend-originals.js';

const P='docs/evaluation/source-proof/';
const input={
  firstCePsv:readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8'),
  secondCePsv:readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
  previousViewerPsv:readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
  sourceSnapshotPsv:readFileSync(P+'cfb-2024-eight-verified-senators-original-viewer-responses.psv','utf8'),
  source27VersionPsv:readFileSync(P+'cfb-2023-24-eight-more-senators-27-source-report-reference-targets.psv','utf8'),
  sourceCheckpointJson:readFileSync(P+'cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json','utf8'),
};
const targets=selectEightRecoveredSenators16OriginalYearends(input);
function firstPage(t:typeof targets[number]){
  return 'Report of Receipts and Expenditures for Principal Campaign Committee\n'+
    'Registration Number: '+t.reg+'\nSenate District: '+t.district2022+'\n'+
    'Period Covered: 1/1/'+t.reportYear+' through 12/31/'+t.reportYear+'\n'+
    'Received by the Board February 1, '+(t.reportYear+1);
}
test('16 precise original CFB PDF identities derive from 8 real 2022 senators, never from an invented committee',()=>{
  assert.equal(targets.length,16);
  assert.equal(new Set(targets.map(x=>x.id)).size,16);
  assert.equal(new Set(targets.map(x=>x.reg)).size,8);
  assert.equal(targets.filter(x=>x.reportYear===2023).length,8);
  assert.equal(targets.filter(x=>x.reportYear===2024).length,8);
  assert.deepEqual([...new Set(targets.map(x=>x.district2022))].sort((a,b)=>a-b),
    [16,18,19,21,22,27,30,35]);
  assert.ok(targets.every(x=>x.id===x.reg+':'+String(x.reportYear).slice(2)+':pcc:YE:0:0'
    &&x.actualSenator.length>=6&&/^[a-f0-9]{64}$/.test(x.originalViewerApiSha256)
    &&x.originalViewerSegment===2024));
  for(const t of targets){const ref=served2023to24YearEndRef(t);
    assert.equal(ref.period,'YE');assert.equal(ref.amendment,0);
    assert.equal(ref.registrationNumber,t.reg);
  }
});
test('source tampering, forged serving senator, missing independent recheck or changed viewer receipt is rejected',()=>{
  assert.throws(()=>selectEightRecoveredSenators16OriginalYearends({...input,
    source27VersionPsv:input.source27VersionPsv.replace('Andrew R. Lang','Never Served')}),/source|blob|pinned|reverified/i);
  assert.throws(()=>selectEightRecoveredSenators16OriginalYearends({...input,
    sourceSnapshotPsv:input.sourceSnapshotPsv.replace('868366a064','000000000000')}),/source|blob|pinned|reverified/i);
  assert.throws(()=>selectEightRecoveredSenators16OriginalYearends({...input,
    firstCePsv:input.firstCePsv.replace('Andrew R. Lang','Never Served')}),/changed/);
  assert.throws(()=>selectEightRecoveredSenators16OriginalYearends({...input,
    sourceCheckpointJson:input.sourceCheckpointJson.replace(
      '"allEightOriginalCfbApiBodySha256Identical": true',
      '"allEightOriginalCfbApiBodySha256Identical": false')}),/not pinned|reverified/);
});
test('synthetic first page holds committee registration, district, reporting period and Board receipt fail closed',()=>{
 const t=targets.find(x=>x.reportYear===2023)!;
 const good=firstPage(t);
 const base=(parse:string)=>auditServed2023to24OriginalYearEnd(t,{
   sourceUrl:'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=23&type=pcc&period=YE&se=0&regnum='+t.reg+'&amend=0',
   sha256:'a'.repeat(64),bytes:15000,observedAt:'2026-10-11T17:30:00.000Z',text:parse},null);
 assert.equal(base(good).status,'original_pdf_first_page_authenticated');
 assert.equal(base(good.replace('Registration Number: '+t.reg,'Registration Number: 99999')).status,
   'original_pdf_first_page_identity_coverage_or_receipt_hold');
 assert.equal(base(good.replace('Senate District: '+t.district2022,'Senate District: 50')).status,
   'original_pdf_first_page_identity_coverage_or_receipt_hold');
 assert.equal(base(good.replace('12/31/2023','12/30/2023')).status,
   'original_pdf_first_page_identity_coverage_or_receipt_hold');
 assert.equal(base(good.replace('for Principal Campaign Committee','for PAC')).status,
   'original_pdf_first_page_identity_coverage_or_receipt_hold');
 assert.equal(base(good.replace('February 1, 2024','December 1, 2023')).status,
   'original_pdf_first_page_identity_coverage_or_receipt_hold');
});
test('never confuse 16 official source reference keys with sixteen unique PDF bodies absent evidence',()=>{
 const holds=targets.map(t=>auditServed2023to24OriginalYearEnd(t,null,'original_official_source_timeout'));
 assert.equal(summarize28YearEndSource(holds).authenticatedReportReferences,0);
 const a=targets.map((t,i)=>auditServed2023to24OriginalYearEnd(t,{
   sourceUrl:'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+
     String(t.reportYear).slice(2)+'&type=pcc&period=YE&se=0&regnum='+t.reg+'&amend=0',
   sha256:(i+1).toString(16).padStart(64,'0'),bytes:16000,
   observedAt:'2026-10-11T17:30:00.000Z',text:firstPage(t)},null));
 const original=summarize28YearEndSource(a);
 assert.equal(original.authenticatedReportReferences,16);
 assert.equal(original.independentlyUniqueOriginalPdfBinaries,16);
 const alias=a.map((x,i)=>i===15?{...x,sourcePdfSha256:a[0]!.sourcePdfSha256}:x);
 assert.equal(summarize28YearEndSource(alias).independentlyUniqueOriginalPdfBinaries,15);
 assert.ok(a.every(x=>x.statutoryDueOn===null&&x.actualHistoricalPublicByOn===null
   &&x.legallyOwed2023Or2024ReportCount===null&&!x.historicalPredictionEligible));
});

test('Lang 2023 viewer source PDF is an exact source-identity HOLD, not an authenticated financial report',()=>{
  const all=targets.map((t,i)=>{
    const held=t.id==='17994:23:pcc:YE:0:0';
    const pdf=held
      ?{sourceUrl:'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=23&type=pcc&period=YE&se=0&regnum=17994&amend=0',
        sha256:'34022e5691aca08f318436ecbc30a1b3e2d5a32c2ad11a19ee0d64fb77443aba',
        bytes:381617,observedAt:'2026-10-11T17:30:39.048Z',
        text:'Report of Receipts and Expenditures for Principal Campaign Committee\n'+
          'Period Covered: 1/1/2023 through 12/31/2023\n'+
          'Received by the Board December 29, 2023'}
      :{sourceUrl:'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+
          String(t.reportYear).slice(2)+'&type=pcc&period=YE&se=0&regnum='+t.reg+'&amend=0',
        sha256:(i+1).toString(16).padStart(64,'0'),bytes:15500,
        observedAt:'2026-10-11T17:30:39.048Z',text:firstPage(t)};
    return auditServed2023to24OriginalYearEnd(t,pdf,null);
  });
  const result=classifyEightRecovered16OriginalSourceRuns(all);
  assert.equal(result.acceptedFifteenOriginalsOneStrictSourceIdentityHold,true);
  assert.equal(result.authenticatedAsSixteenOriginalPdfs,false);
  assert.equal(result.verifiedOriginalPdfBinaries,15);
  assert.equal(result.heldOfficialSourceDocuments,1);
  assert.equal(result.reviewedHeldReportId,'17994:23:pcc:YE:0:0');
  const mutated=all.map(r=>r.originalReportId==='17994:23:pcc:YE:0:0'
    ?{...r,sourcePdfByteCount:381618}:r);
  assert.equal(classifyEightRecovered16OriginalSourceRuns(mutated)
    .acceptedFifteenOriginalsOneStrictSourceIdentityHold,false);
});

test('permanent 16-row ledger preserves independent CFB PDF sha and 15 + 1 source HOLD',()=>{
 const cp=JSON.parse(readFileSync(P+'cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json','utf8'));
 const body=readFileSync(cp.ledger.path,'utf8');
 const git=createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0')
   .update(body).digest('hex');
 assert.equal(git,cp.ledger.gitBlobSha);
 assert.equal(cp.independentOfficialSourceAcquisitions.length,2);
 assert.equal(cp.crossRunReconciliation.all16OfficialPdfSha256,true);
 assert.equal(cp.crossRunReconciliation.all16PdfByteLengths,true);
 assert.equal(cp.results.authenticDistinctOriginalPdfForms,15);
 const rows=body.trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(rows.length,16);
 assert.equal(new Set(rows.map(x=>x[0])).size,16);
 const targetsById=new Map(targets.map(x=>[x.id,x]));
 let verified=0,holds=0;
 for(const row of rows){
   assert.equal(row.length,12);
   const t=targetsById.get(row[0]!);
   assert.ok(t);
   assert.equal(row[1],t.actualSenator);
   assert.equal(row[2],String(t.district2022));
   assert.equal(row[3],t.reg);
   assert.equal(row[4],t.originalViewerApiSha256);
   assert.match(row[5]!,/^[a-f0-9]{64}$/);
   assert.ok(Number(row[6])>=300);
   assert.equal(row[7],t.reportYear+'-01-01');
   assert.equal(row[8],t.reportYear+'-12-31');
   if(row[10]==='authentic_pdf_report_first_page'){verified++;assert.equal(row[11],'verified');}
   else{holds++;assert.equal(row[0],'17994:23:pcc:YE:0:0');
     assert.equal(row[10],'HOLD_source_pdf_not_authenticated');
     assert.equal(row[5],cp.sourceHold.originalPdfSourceSha256);
     assert.equal(Number(row[6]),cp.sourceHold.pdfBytes);
     assert.equal(row[9],cp.sourceHold.boardReceived);
   }
 }
 assert.equal(verified,15);assert.equal(holds,1);
 assert.equal(cp.scope.filingsLegallyOwedDenominator,null);
 assert.equal(cp.safeguards.noProductionDatabaseReadsOrWrites,true);
});
