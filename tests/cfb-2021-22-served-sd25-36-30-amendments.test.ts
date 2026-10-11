import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  selectServedSd25to36AmendmentVersions,
  auditActualSenatorAmendmentPdf,amendmentViewerReference,
  checkAuthenticatedAmendmentChains,
  classifySd25to36AmendmentReferences,
  REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS,
  verifyServedSd25to36AmendmentSourceOutcome,
  type CfbHistoricalAmendedPdfSource,
} from '../src/evidence/cfb-2021-22-served-sd25-36-30-amendments.js';
import {cfbReportViewerUrl}
  from '../src/evidence/cfb-current-report-acquisition.js';
import {createHash} from 'node:crypto';

const PATH='docs/evaluation/source-proof/';
const input=()=>({
  originalCePsv:readFileSync(PATH+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
  originalYePsv:readFileSync(PATH+'cfb-2021-22-served-d25-36-18-original-yearend-pdfs.psv','utf8'),
  originalViewerPsv:readFileSync(PATH+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
  ceCheckpoint:JSON.parse(readFileSync(PATH+'cfb-2022-served-d25-36-original-ce-source-checkpoint.json','utf8')),
  yeCheckpoint:JSON.parse(readFileSync(PATH+'cfb-2021-22-served-d25-36-18-original-yearend-source-checkpoint.json','utf8')),
});
const chosen=()=>selectServedSd25to36AmendmentVersions(input());
type Target=ReturnType<typeof chosen>['targets'][number];
const hash=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const mdy=(s:string)=>{const [y,m,d]=s.split('-');return Number(m)+'/'+Number(d)+'/'+y;};
function sample(t:Target,opts:{sha?:string;registration?:string;printedDistrict?:number;
  coverageEnd?:string;date?:string;text?:string;bytes?:number}={}):CfbHistoricalAmendedPdfSource{
  const printed=opts.printedDistrict??t.original.printedOriginalDistrict;
  const body=opts.text??(
    'Report of Receipts and Expenditures for Principal Campaign Committee '+
    'Senate District '+printed+' Registration Number: '+
    (opts.registration??t.registrationNumber)+
    ' Period Covered: '+mdy(t.original.coveredFrom)+' through '+
      mdy(opts.coverageEnd??t.original.coveredThrough)+
    ' Received by the Board '+(opts.date??'April 11, 2023')+
    ' Thank you for filing with the Minnesota CFB');
  return {sourceUrl:cfbReportViewerUrl(amendmentViewerReference(t)),
    sha256:opts.sha??'f'.repeat(64),bytes:opts.bytes??430005,
    observedAt:'2026-10-11T16:02:00.000Z',text:body};
}

test('original SHA-pinned 22+18 originals, 11 actual senators, 30 exact source amendments and 396-response viewer',()=>{
  const s=chosen();
  assert.equal(s.originals.length,40);
  assert.equal(s.selectedActualSenators,11);
  assert.equal(s.registrationsWithAmendments,10);
  assert.equal(s.pinnedViewerOriginalResponses,270);
  assert.equal(s.targets.length,30);
  assert.deepEqual(s.amendmentReferenceCounts,
    {'21:YE':3,'22:C':7,'22:E':7,'22:YE':13});
  assert.equal(new Set(s.targets.map(t=>t.id)).size,30);
  assert.equal(new Set(s.targets.map(t=>t.originalId)).size,19);
  assert.equal(new Set(s.targets.map(t=>t.actualSenator)).size,10);
  assert.equal(s.legallyOwedReportDenominator,null);
  const parents=new Set(s.originals.map(o=>o.id));
  for(const t of s.targets){
    assert.ok(parents.has(t.originalId),'Every amendment has a genuinely authenticated original');
    assert.equal(t.id,t.originalId.slice(0,-1)+t.amendmentIndex);
    assert.match(t.original.pdfSha256,/^[0-9a-f]{64}$/);
    assert.match(t.originalReportsViewerBodySha256,/^[0-9a-f]{64}$/);
    assert.match(t.originalCfbDistrictRosterSha256,/^[0-9a-f]{64}$/);
    assert.equal(t.original.person,t.actualSenator);
    assert.equal(t.original.registrationNumber,t.registrationNumber);
    assert.equal(amendmentViewerReference(t).amendment,t.amendmentIndex);
    assert.ok(!parents.has(t.id));
  }
});
test('every original PDF fingerprint/registration and immutable official viewer body is fail-closed',()=>{
  const s=input();
  assert.throws(()=>selectServedSd25to36AmendmentVersions({
    ...s,originalCePsv:s.originalCePsv.replace('18901:22:','00000:22:')}),
  /ledger SHA\/count mismatch/);
  assert.throws(()=>selectServedSd25to36AmendmentVersions({
    ...s,originalYePsv:s.originalYePsv+'x'}),/ledger SHA\/count mismatch/);
  assert.throws(()=>selectServedSd25to36AmendmentVersions({
    ...s,originalViewerPsv:s.originalViewerPsv+'corruption'}),
  /hash mismatch/);
  assert.throws(()=>selectServedSd25to36AmendmentVersions({
    ...s,ceCheckpoint:{...s.ceCheckpoint,actualServedSenators:
      s.ceCheckpoint.actualServedSenators.slice(1)}}),
  /eleven Senate-member registration/);
  assert.throws(()=>selectServedSd25to36AmendmentVersions({
    ...s,yeCheckpoint:{...s.yeCheckpoint,permanentSourceLedger:
      {...s.yeCheckpoint.permanentSourceLedger,sha256:'0'.repeat(64)}}}),
  /ledger SHA\/count mismatch/);
});
test('original annual and pre-election amendment PDF first pages prove real committee, original reporting year, receipt and separate availability floor',()=>{
  for(const period of ['YE','C','E'] as const){
    const t=chosen().targets.find(x=>x.period===period)!;assert.ok(t);
    const r=auditActualSenatorAmendmentPdf(t,sample(t));
    assert.equal(r.status,'amendment_pdf_and_original_identity_authenticated');
    assert.equal(r.amendedBoardReceivedOn,'2023-04-11');
    assert.equal(r.conservativeAmendedVersionNotBeforeOn,'2023-04-12');
    assert.equal(r.originalReportId,t.originalId);
    assert.equal(r.originalReportSha256,t.original.pdfSha256);
    assert.equal(r.amendedCoverageStartOn,t.original.coveredFrom);
    assert.equal(r.amendedCoverageEndOn,t.original.coveredThrough);
    assert.equal(r.paperFormAmendedCheckboxIndependentlyVerified,null);
    assert.equal(r.actualHistoricalPublicByIndependentlyEstablished,null);
    assert.equal(r.legallyRequiredFilingDenominator,null);
    assert.equal(r.historicalForecastEligible,false);
  }
});
test('wrong committee, printed district, original report window or original binary never authenticates as an amendment',()=>{
  const t=chosen().targets[0]!;
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{registration:'99999'}))
    .status,'amended_pdf_first_page_identity_or_period_mismatch');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{printedDistrict:51}))
    .status,'amended_pdf_printed_district_unmatched');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{coverageEnd:'2022-11-30'}))
    .status,'amended_pdf_first_page_identity_or_period_mismatch');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{sha:t.original.pdfSha256}))
    .status,'amendment_pdf_identical_to_original');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{date:'January 1, 2020'}))
    .status,'amended_pdf_first_page_identity_or_period_mismatch');
  assert.equal(auditActualSenatorAmendmentPdf(t,null,'official_source_http_failure')
    .status,'source_http_or_pdf_failure');
});
test('historical former Senate district must be same authenticated member, not a nearby district',()=>{
  const t=chosen().targets.find(x=>x.original.printedOriginalDistrict!==x.original.electionDistrict)!;
  assert.ok(t);
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{
    printedDistrict:t.original.printedOriginalDistrict}))
    .status,'amendment_pdf_and_original_identity_authenticated');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{
    printedDistrict:t.original.electionDistrict}))
    .status,'amendment_pdf_and_original_identity_authenticated');
  assert.equal(auditActualSenatorAmendmentPdf(t,sample(t,{
    printedDistrict:57}))
    .status,'amended_pdf_printed_district_unmatched');
});
function syntheticReconfirmedCohort(){
  const pin=REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS;
  const selected=chosen();
  const raw=selected.targets.map(t=>{
    const hoffman=t.id===pin.canonicalReferenceId||t.id===pin.aliasedReferenceId;
    return auditActualSenatorAmendmentPdf(t,sample(t,{
      sha:hoffman?pin.binarySha256:hash(t.id),
      bytes:hoffman?pin.byteLength:430005,
      date:hoffman?'May 28, 2023'
        :t.id==='17319:22:pcc:YE:0:3'?'July 21, 2023'
        :'April '+(11+t.amendmentIndex)+', 2023',
    }));
  });
  assert.equal(raw.every(r=>r.status==='amendment_pdf_and_original_identity_authenticated'),true);
  return raw;
}
test('30 official viewer indices preserve the pinned Hoffman duplicate as ONE alias, with 29 distinct verified PDF binaries',()=>{
  const pin=REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS;
  const classified=classifySd25to36AmendmentReferences(syntheticReconfirmedCohort());
  const outcome=verifyServedSd25to36AmendmentSourceOutcome(classified);
  assert.equal(outcome.complete,true,JSON.stringify(outcome.chainViolations));
  assert.equal(outcome.verified,30);
  assert.equal(outcome.sourceVersionReferencesAuthenticated,30);
  assert.equal(outcome.holds,0);
  assert.equal(outcome.distinctAmendmentPdfBinaries,29);
  assert.equal(outcome.distinctAuthenticatedAmendedPdfForms,29);
  assert.equal(outcome.documentedDuplicateReferenceAliases,1);
  assert.equal(outcome.fullOriginalToAmendmentChainsVerified,true);
  assert.equal(outcome.fullDistinctBinaryRevisionChainsVerified,false);
  assert.equal(outcome.status,'29_distinct_amended_pdfs_1_documented_official_viewer_alias');
  assert.equal(checkAuthenticatedAmendmentChains(classified).valid,true);
  const first=classified.find(x=>x.id===pin.canonicalReferenceId)!;
  const second=classified.find(x=>x.id===pin.aliasedReferenceId)!;
  assert.equal(first.referenceClassification,'distinct_authenticated_amended_pdf');
  assert.equal(first.distinctAmendedPdfBinary,true);
  assert.equal(second.referenceClassification,'official_amendment_version_reference_alias_of_identical_pdf');
  assert.equal(second.distinctAmendedPdfBinary,false);
  assert.equal(second.aliasOfAmendmentVersionId,first.id);
  assert.equal(second.amendedPdfSha256,first.amendedPdfSha256);
  assert.equal(second.amendedPdfByteLength,first.amendedPdfByteLength);
  assert.equal(second.amendedBoardReceivedOn,first.amendedBoardReceivedOn);
  assert.equal(second.paperFormAmendedCheckboxIndependentlyVerified,null);
  assert.equal(second.actualHistoricalPublicByIndependentlyEstablished,null);
  assert.equal(second.historicalForecastEligible,false);
  assert.deepEqual(outcome.documentedBinaryAliases,[{
    canonicalReferenceId:pin.canonicalReferenceId,
    aliasedReferenceId:pin.aliasedReferenceId,
    originalReportId:pin.originalReportId,
    pdfSha256:pin.binarySha256,
    bytes:pin.byteLength,
    boardReceivedOn:pin.boardReceivedOn,
    sourceReasonIndependentlyEstablished:false,
  }]);
});
test('unexpected binary alias anywhere else in this 30-reference cohort remains a hard failure',()=>{
  const raw=syntheticReconfirmedCohort();
  raw[1]={...raw[1]!,amendedPdfSha256:raw[0]!.amendedPdfSha256};
  const audited=classifySd25to36AmendmentReferences(raw);
  const outcome=verifyServedSd25to36AmendmentSourceOutcome(audited);
  assert.equal(outcome.complete,false);
  assert.ok(outcome.chainViolations.some(v=>
    v.reason==='unexpected_amendment_pdf_binary_duplicate_across_cohort'));
});
test('unexpected duplicate within another committee parent chain is never legitimized by the Hoffman exemption',()=>{
  const raw=syntheticReconfirmedCohort();
  const earlier=raw.find(r=>r.id==='17868:22:pcc:YE:0:1')!;
  const later=raw.findIndex(r=>r.id==='17868:22:pcc:YE:0:2');
  assert.ok(later>=0);
  raw[later]={...raw[later]!,amendedPdfSha256:earlier.amendedPdfSha256};
  const outcome=verifyServedSd25to36AmendmentSourceOutcome(
    classifySd25to36AmendmentReferences(raw));
  assert.equal(outcome.complete,false);
  assert.ok(outcome.chainViolations.some(v=>v.id==='17868:22:pcc:YE:0:2'
    &&v.reason==='amendment_binary_duplicate_of_earlier_revision'));
});
test('if either Hoffman reference changes bytes, length or date, preserve discrepancy as an unresolved source, never force old alias',()=>{
  const raw=syntheticReconfirmedCohort();
  const pin=REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS;
  const idx=raw.findIndex(r=>r.id===pin.aliasedReferenceId);
  for(const modification of [
    {amendedPdfSha256:hash('changed')},
    {amendedPdfByteLength:pin.byteLength+1},
    {amendedBoardReceivedOn:'2023-05-29'},
  ]){
    const changed=raw.slice();
    changed[idx]={...changed[idx]!,...modification};
    const classified=classifySd25to36AmendmentReferences(changed);
    const outcome=verifyServedSd25to36AmendmentSourceOutcome(classified);
    assert.equal(outcome.complete,false);
    assert.ok(outcome.chainViolations.some(v=>
      v.reason==='reviewed_2022_hoffman_alias_original_source_changed_or_unconfirmed'));
    assert.notEqual(classified[idx]!.referenceClassification,
      'official_amendment_version_reference_alias_of_identical_pdf');
  }
});
test('held identity, failed fetch and truncated viewer references never pass the complete source run',()=>{
  const raw=syntheticReconfirmedCohort();
  const held=raw.slice();
  held[0]={...held[0]!,status:'amended_pdf_printed_district_unmatched'};
  const classified=classifySd25to36AmendmentReferences(held);
  assert.equal(classified[0]!.referenceClassification,'unverified_report_pdf_identity');
  assert.equal(verifyServedSd25to36AmendmentSourceOutcome(classified).complete,false);
  const failed=raw.slice();
  failed[0]={...failed[0]!,status:'source_http_or_pdf_failure'};
  assert.equal(classifySd25to36AmendmentReferences(failed)[0]!.referenceClassification,'source_fetch_failure');
  assert.equal(verifyServedSd25to36AmendmentSourceOutcome(
    classifySd25to36AmendmentReferences(raw.slice(1))).complete,false);
});
