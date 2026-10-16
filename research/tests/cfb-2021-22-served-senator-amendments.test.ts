import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  select2021to22ActualSenatorAmendmentVersions,
  auditActualSenatorAmendmentPdf,amendmentViewerReference,
  checkAuthenticatedAmendmentChains,classifySourceVerified2021to22AmendmentBatch,
  REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD,type CfbHistoricalAmendedPdfSource,
} from '../../src/evidence/cfb-2021-22-served-senator-amendments.js';
import {cfbReportViewerUrl} from '../../src/evidence/cfb-current-report-acquisition.js';

const PREFIX='docs/evaluation/source-proof/';
const input=()=>{
  return {originalCePsv:readFileSync(PREFIX+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8'),
    originalYePsv:readFileSync(PREFIX+'cfb-2021-22-served-11-20-original-ye-pdf-proof.psv','utf8'),
    originalViewerPsv:readFileSync(PREFIX+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
    ceCheckpoint:JSON.parse(readFileSync(PREFIX+'cfb-2022-served-d13-24-original-ce-source-checkpoint.json','utf8')),
    yeCheckpoint:JSON.parse(readFileSync(PREFIX+'cfb-2021-22-served-11-20-original-ye-source-checkpoint.json','utf8'))};
};
const selected=()=>select2021to22ActualSenatorAmendmentVersions(input());
type Target=ReturnType<typeof selected>['targets'][number];
function sample(t:Target,change:{district?:number;reg?:string;
    receipt?:string;coveredEnd?:string;coveredStart?:string;sha?:string}={}):CfbHistoricalAmendedPdfSource {
  const day=change.receipt??'April 11, 2023';
  const printed=change.district??t.original.printedOriginalDistrict;
  const reg=change.reg??t.registrationNumber;
  const [start,end]=[change.coveredStart??t.original.coveredFrom,
    change.coveredEnd??t.original.coveredThrough];
  function mdy(date:string){
    const [y,m,d]=date.split('-');
    return Number(m)+'/'+Number(d)+'/'+y;
  }
  const text='Report of Receipts and Expenditures for Principal Campaign Committee '+
    'Senate District '+printed+' Registration Number: '+reg+' '+
    'Period Covered: '+mdy(start)+' through '+mdy(end)+' '+
    'Received by the Board '+day+' Thank you for reporting to the Minnesota CFB.';
  return {sourceUrl:cfbReportViewerUrl(amendmentViewerReference(t)),
    sha256:change.sha??('c'.repeat(63)+'1'),bytes:400000,
    observedAt:'2026-10-11T05:00:00.000Z',text};
}

test('real original source ledgers cover precisely 42 unique original PDF parent IDs and 26 amendments',()=>{
  const proof=selected();
  assert.equal(proof.selectedRegistrations,11);
  assert.equal(proof.sourceResponseViewerCount,270);
  assert.equal(proof.originals.length,42);
  assert.equal(proof.targets.length,26);
  assert.deepEqual(proof.amendmentRefsByReportPeriod,
    {'21:YE':10,'22:C':2,'22:E':2,'22:YE':12});
  assert.equal(new Set(proof.targets.map(t=>t.id)).size,26);
  assert.equal(new Set(proof.targets.map(t=>t.actualSenator)).size,11);
  const parentIds=new Set(proof.originals.map(o=>o.id));
  for(const target of proof.targets){
    assert.ok(parentIds.has(target.originalId));
    assert.equal(target.originalId,target.id.slice(0,-1)+'0');
    assert.match(target.original.pdfSha256,/^[a-f0-9]{64}$/);
    assert.ok(target.amendmentIndex>0&&target.amendmentIndex<=2);
    assert.match(target.originalReportsViewerBodySha256,/^[a-f0-9]{64}$/);
    assert.match(target.originalCfbDistrictRosterSha256,/^[a-f0-9]{64}$/);
    assert.equal(amendmentViewerReference(target).amendment,target.amendmentIndex);
    assert.ok(!parentIds.has(target.id));
  }
});
test('tampered original PDF source, wrong ledger scope or changed 396-response API proof fails closed',()=>{
  const x=input();
  assert.throws(()=>select2021to22ActualSenatorAmendmentVersions({
    ...x,originalCePsv:x.originalCePsv.replace('18430:22:','99999:22:')}),
    /ledger hash/);
  assert.throws(()=>select2021to22ActualSenatorAmendmentVersions({
    ...x,originalYePsv:x.originalYePsv.slice(0,-1)}),
    /ledger hash/);
  assert.throws(()=>select2021to22ActualSenatorAmendmentVersions({
    ...x,originalViewerPsv:x.originalViewerPsv+'!'}),/hash mismatch/);
  assert.throws(()=>select2021to22ActualSenatorAmendmentVersions({
    ...x,ceCheckpoint:{...x.ceCheckpoint,pinnedOriginalRegistrationApiAndDistrictSources:
      x.ceCheckpoint.pinnedOriginalRegistrationApiAndDistrictSources.slice(1)}}),
    /registration cohort mismatch/);
});
test('actual amended PDF first-page independently proves same principal committee, covered period, district and later Board receipt',()=>{
  for(const period of ['YE','C','E'] as const){
    const t=selected().targets.find(x=>x.period===period)!;
    assert.ok(t);
    const result=auditActualSenatorAmendmentPdf(t,sample(t));
    assert.equal(result.status,'amendment_pdf_and_original_identity_authenticated');
    assert.equal(result.amendmentViewerIndex,t.amendmentIndex);
    assert.equal(result.originalReportId,t.originalId);
    assert.equal(result.amendmentFirstPageIdentityOfficeDatesVerified,true);
    assert.equal(result.amendedCoverageEndOn,t.original.coveredThrough);
    assert.equal(result.amendedBoardReceivedOn,'2023-04-11');
    assert.equal(result.conservativeAmendedVersionNotBeforeOn,'2023-04-12');
    assert.equal(result.paperFormAmendedCheckboxIndependentlyVerified,null);
    assert.equal(result.actualHistoricalPublicByIndependentlyEstablished,null);
    assert.equal(result.historicalForecastEligible,false);
    assert.equal(result.legallyRequiredFilingDenominator,null);
    assert.notEqual(result.amendedPdfSha256,t.original.pdfSha256);
  }
});
test('wrong committee, unsupported printed district, period, direct source URL or identical original binary fails',()=>{
  const t=selected().targets[0]!;
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{reg:'99999'}))
    .status,'amended_pdf_first_page_identity_or_period_mismatch');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{district:67}))
    .status,'amended_pdf_printed_district_unmatched');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{coveredEnd:'2022-10-23'}))
    .status,'amended_pdf_first_page_identity_or_period_mismatch');
  assert.equal(auditActualSenatorAmendmentPdf(t,{...sample(t),
    sourceUrl:'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&amend=0'})
    .status,'source_pdf_missing_or_invalid');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{sha:t.original.pdfSha256}))
    .status,'amendment_pdf_identical_to_original');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{receipt:'January 1, 2021'}))
    .status,'amended_pdf_first_page_identity_or_period_mismatch');
  assert.equal(auditActualSenatorAmendmentPdf(t,null,'cfb_pdf_http_429')
    .status,'source_http_or_pdf_failure');
});
test('actual old official district on original remains acceptable, but arbitrary third or contradictory district does not',()=>{
  const t=selected().targets.find(x=>x.original.printedOriginalDistrict!==x.original.electionDistrict)!;
  assert.ok(t);
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{district:t.original.printedOriginalDistrict}))
    .status,'amendment_pdf_and_original_identity_authenticated');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{district:t.original.electionDistrict}))
    .status,'amendment_pdf_and_original_identity_authenticated');
  const both={...sample(t),text:sample(t).text+' Senate District 67'};
  assert.equal(auditActualSenatorAmendmentPdf(t,both)
    .status,'amended_pdf_printed_district_unmatched');
});
test('different amendments must be distinct binaries and their Board receipts must not reverse revision order',()=>{
  const t=selected().targets.find(x=>x.amendmentIndex===2)!;
  assert.ok(t);
  const prior=selected().targets.find(x=>x.originalId===t.originalId&&x.amendmentIndex===1)!;
  const one=auditActualSenatorAmendmentPdf(prior,sample(prior,{sha:'a'.repeat(64),receipt:'April 1, 2023'}));
  const two=auditActualSenatorAmendmentPdf(t,sample(t,{sha:'b'.repeat(64),receipt:'May 2, 2023'}));
  assert.equal(checkAuthenticatedAmendmentChains([two,one]).valid,true);
  assert.deepEqual(checkAuthenticatedAmendmentChains([one,{...two,amendedPdfSha256:one.amendedPdfSha256}]).violations.map(x=>x.reason),
    ['amendment_binary_duplicate_of_earlier_revision']);
  assert.deepEqual(checkAuthenticatedAmendmentChains([one,{
    ...two,amendedBoardReceivedOn:'2023-03-01'}]).violations.map(x=>x.reason),
    ['amendment_revision_receipt_out_of_order']);
  assert.equal(checkAuthenticatedAmendmentChains([two]).valid,false);
});


test('source-only 26-version retrieval may preserve exactly 25 proven forms plus source-identical 2021 document HOLD',()=>{
  const audits=selected().targets.map((t,i)=>{
    const receipt=t.amendmentIndex===2?'April 12, 2023':'April 11, 2023';
    return auditActualSenatorAmendmentPdf(t,sample(t,{
      sha:(i+1).toString(16).padStart(64,'0'),receipt,
    }));
  });
  const full=classifySourceVerified2021to22AmendmentBatch(audits);
  assert.equal(full.status,'all_26_amendment_pdfs_authenticated');
  assert.equal(full.sourceAcquisitionCanBePreserved,true);
  assert.equal(full.authenticated,26);
  const held=selected().targets.find(t=>t.id===REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD.id)!;
  assert.ok(held);
  const knownPdf={...sample(held),sha256:REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD.binarySha256,
    bytes:REVIEWED_2021_CFB_AMENDMENT_SOURCE_HOLD.bytes,text:'A'.repeat(1836)};
  const heldAudit=auditActualSenatorAmendmentPdf(held,knownPdf);
  assert.equal(heldAudit.status,'amended_pdf_printed_district_unmatched');
  assert.equal(heldAudit.originalReportId,'18430:21:pcc:YE:0:0');
  assert.equal(heldAudit.amendedBoardReceivedOn,null);
  assert.equal(heldAudit.actualHistoricalPublicByIndependentlyEstablished,null);
  const reviewed=audits.map(a=>a.id===heldAudit.id?heldAudit:a);
  const result=classifySourceVerified2021to22AmendmentBatch(reviewed);
  assert.equal(result.status,'25_authenticated_1_official_source_document_hold');
  assert.equal(result.sourceAcquisitionCanBePreserved,true);
  assert.equal(result.authenticated,25);
  assert.equal(result.documentedSourceHolds,1);
  assert.equal(result.chainValid,false);
  const forged=reviewed.map(a=>a.id!==heldAudit.id?a:{
    ...a,amendedPdfSha256:'f'.repeat(64)});
  assert.equal(classifySourceVerified2021to22AmendmentBatch(forged)
    .sourceAcquisitionCanBePreserved,false);
  const unknown=reviewed.map(a=>a.id!==heldAudit.id?a:{
    ...a,structuralDistrictDiagnostics:{...a.structuralDistrictDiagnostics,
      registrationLabelPresent:true}});
  assert.equal(classifySourceVerified2021to22AmendmentBatch(unknown)
    .sourceAcquisitionCanBePreserved,false);
  assert.equal(classifySourceVerified2021to22AmendmentBatch(reviewed.slice(1))
    .sourceAcquisitionCanBePreserved,false);
});
