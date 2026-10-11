/** #864 finance original-source verification for 11 formerly unacquired CFB amendments. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  selectElevenIndependentlyParentAuthenticatedAmendments,
  auditElevenAmendedPdfs,
} from '../src/evidence/cfb-2023-24-eight-served-eleven-amendments.js';
import {
  sourceYeAmendmentReference,
  type CfbAmendedPdfSource,
} from '../src/evidence/cfb-2023-24-sixteen-parent-authenticated-amendments.js';
import {cfbReportViewerUrl} from '../src/evidence/cfb-current-report-acquisition.js';
const P='docs/evaluation/source-proof/';
const evidence={
  firstCePsv:readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8'),
  secondCePsv:readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
  previousViewerPsv:readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
  sourceSnapshotPsv:readFileSync(P+'cfb-2024-eight-verified-senators-original-viewer-responses.psv','utf8'),
  source27VersionPsv:readFileSync(P+'cfb-2023-24-eight-more-senators-27-source-report-reference-targets.psv','utf8'),
  sourceCheckpointJson:readFileSync(P+'cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json','utf8'),
  original16SourcePsv:readFileSync(P+'cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv','utf8'),
  original16CheckpointJson:readFileSync(P+'cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json','utf8'),
};
const selected=selectElevenIndependentlyParentAuthenticatedAmendments(evidence);
type Target=typeof selected[number];
function fakeFirstPage(t:Target,received='October 11, 2026'){
 return 'Report of Receipts and Expenditures for Principal Campaign Committee\n'+
   'Registration Number: '+t.registrationNumber+'\n'+
   'Senate District: '+t.senateDistrict2022+'\n'+
   'Period Covered: 1/1/'+t.year+' through 12/31/'+t.year+'\n'+
   'Received by the Board '+received;
}
function fabricatedSource(t:Target,sha:string,text=fakeFirstPage(t)):CfbAmendedPdfSource{
 return {sourceUrl:cfbReportViewerUrl(sourceYeAmendmentReference(t)),
   sha256:sha,bytes:20000,observedAt:'2026-10-11T20:45:00.000Z',text};
}
test('11 authenticated-parent official source version IDs are exactly real 2022-serving senators',()=>{
 assert.equal(selected.length,11);
 assert.equal(new Set(selected.map(x=>x.id)).size,11);
 assert.equal(new Set(selected.map(x=>x.registrationNumber)).size,6);
 assert.equal(new Set(selected.map(x=>x.parentOriginalId)).size,8);
 assert.equal(selected.filter(x=>x.year===2023).length,4);
 assert.equal(selected.filter(x=>x.year===2024).length,7);
 assert.deepEqual([...new Set(selected.map(x=>x.senatorVerifiedServedIn2022))].sort(),
   ['Andrew R. Lang','Nick A. Frentz','John R. Jasinski','Rich Draheim','Eric Lucero','Jim Abeler'].sort());
 assert.ok(!selected.some(x=>x.id.startsWith('17994:23:')));
 for(const t of selected){
   assert.equal(t.parentOriginalId,t.id.slice(0,t.id.lastIndexOf(':'))+':0');
   assert.ok(t.amendmentIndex>0);
   assert.match(t.originalPdfSha256,/^[0-9a-f]{64}$/);
   assert.ok(t.originalPdfBytes>300);
   assert.ok(t.originalBoardReceipt>=t.originalPeriodEnd);
   const ref=sourceYeAmendmentReference(t);
   assert.equal(ref.registrationNumber,t.registrationNumber);
   assert.equal(ref.amendment,t.amendmentIndex);
 }
});
test('source ledger tampering, held parent promotion and invented senator identity fail closed',()=>{
 assert.throws(()=>selectElevenIndependentlyParentAuthenticatedAmendments({...evidence,
   original16SourcePsv:evidence.original16SourcePsv.replace('34022e5691ac','ffffffffffff')}),/changed/);
 assert.throws(()=>selectElevenIndependentlyParentAuthenticatedAmendments({...evidence,
   source27VersionPsv:evidence.source27VersionPsv.replace('Nick A. Frentz','Never Served')}),/pinned|reverified/);
 assert.throws(()=>selectElevenIndependentlyParentAuthenticatedAmendments({...evidence,
   original16CheckpointJson:evidence.original16CheckpointJson.replace(
     '"authenticDistinctOriginalPdfForms": 15','"authenticDistinctOriginalPdfForms": 16')}),/changed/);
 assert.throws(()=>selectElevenIndependentlyParentAuthenticatedAmendments({...evidence,
   firstCePsv:evidence.firstCePsv.replace('Andrew R. Lang','Never Served')}),/changed/);
 const forged=evidence.source27VersionPsv+'\n17994:23:pcc:YE:0:1|Andrew R. Lang|16|17994|'+
    '868366a0649900b205b1b4248bbfaeaae7b8aae8fb8db321d7de6c3854fe2073|2026-10-11T17:05:52.636Z|amendment_viewer_reference_not_yet_pdf_authenticated\n';
 assert.throws(()=>selectElevenIndependentlyParentAuthenticatedAmendments({...evidence,
   source27VersionPsv:forged}),/pinned|reverified/);
});
test('synthetic amended PDF must exactly match parent original registration, office, dates, official receipt',()=>{
 const t=selected[0]!;
 const base=fabricatedSource(t,'a'.repeat(64));
 assert.equal(auditElevenAmendedPdfs([t],new Map([[t.id,base]]),new Map())
   .reports[0]!.status,'amended_pdf_and_parent_identity_authenticated');
 const changed=fabricatedSource(t,'b'.repeat(64),fakeFirstPage(t).replace(
   'Registration Number: '+t.registrationNumber,'Registration Number: 99999'));
 assert.equal(auditElevenAmendedPdfs([t],new Map([[t.id,changed]]),new Map())
   .reports[0]!.status,'source_first_page_committee_or_dates_unverified');
 const district=fabricatedSource(t,'b'.repeat(64),fakeFirstPage(t).replace(
   'Senate District: '+t.senateDistrict2022,'Senate District: 50'));
 assert.equal(auditElevenAmendedPdfs([t],new Map([[t.id,district]]),new Map())
   .reports[0]!.status,'source_first_page_committee_or_dates_unverified');
 const tooEarly=fabricatedSource(t,'b'.repeat(64),fakeFirstPage(t,'January 1, 2023'));
 assert.equal(auditElevenAmendedPdfs([t],new Map([[t.id,tooEarly]]),new Map())
   .reports[0]!.status,'source_first_page_committee_or_dates_unverified');
 const original=fabricatedSource(t,t.originalPdfSha256);
 assert.equal(auditElevenAmendedPdfs([t],new Map([[t.id,original]]),new Map())
   .reports[0]!.status,'official_version_binary_identical_to_original_parent');
 const wrong={...base,sourceUrl:'https://untrusted.example/amended-pdf'};
 assert.equal(auditElevenAmendedPdfs([t],new Map([[t.id,wrong]]),new Map())
   .reports[0]!.status,'source_pdf_missing_or_provenance_failed');
});
test('eleven viewer indexes cannot inflate binary counts when hashes duplicate or one source is held',()=>{
 const downloads=new Map(selected.map((t,i)=>[t.id,fabricatedSource(t,
   (i+1000).toString(16).padStart(64,'0'))]));
 const ok=auditElevenAmendedPdfs(selected,downloads,new Map());
 assert.equal(ok.summary.allElevenPdfsDistinctAndAuthenticated,true);
 assert.equal(ok.summary.uniqueAuthenticatedAmendedPdfs,11);
 assert.equal(ok.summary.authenticFirstPageAmendmentVersionReferences,11);
 assert.equal(ok.summary.statutoryFilingDutyDenominator,null);
 const cloned=new Map(downloads);
 cloned.set(selected[10]!.id,{...cloned.get(selected[10]!.id)!,
   sha256:cloned.get(selected[0]!.id)!.sha256});
 const alias=auditElevenAmendedPdfs(selected,cloned,new Map());
 assert.equal(alias.summary.allElevenPdfsDistinctAndAuthenticated,false);
 assert.equal(alias.summary.uniqueAuthenticatedAmendedPdfs,10);
 assert.equal(alias.summary.documentedOrUnexpectedDuplicateVersionAliases.length,1);
 const fail=auditElevenAmendedPdfs(selected,new Map(),new Map());
 assert.equal(fail.summary.uniqueAuthenticatedAmendedPdfs,0);
 assert.equal(fail.summary.unverifiedSourceReferences.length,11);
 assert.ok(ok.reports.every(x=>x.eligibleForHistoricalForecast===false
   &&x.historicallyActuallyPublicByOn===null
   &&x.legallyOwedReportCount===null));
});
