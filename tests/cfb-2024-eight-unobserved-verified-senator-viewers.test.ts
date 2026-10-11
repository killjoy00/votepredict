/** #864. Old scoped viewer omission is UNKNOWN, not absence of a report. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  selectEightPreviouslyUnobservedActualSenators,
  auditPreviouslyUnobserved2024CfbViewer,
  CFB_EIGHT_2024_TARGETS,
} from '../src/evidence/cfb-2024-eight-unobserved-verified-senator-viewers.js';
const P='docs/evaluation/source-proof/';
const fixture={
  firstCfbOriginalCePsv:readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8'),
  secondCfbOriginalCePsv:readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
  priorSampledViewerPsv:readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
};
const selected=selectEightPreviouslyUnobservedActualSenators(fixture);
test('exactly eight verified 2022 senators and registrations were missing 2024 sampled API response',()=>{
 assert.equal(selected.length,8);
 assert.deepEqual(selected.map(x=>x.reg),[...CFB_EIGHT_2024_TARGETS].map(x=>x.reg));
 assert.equal(new Set(selected.map(x=>x.reg)).size,8);
 assert.deepEqual(selected.map(x=>x.district),[16,18,19,21,22,27,30,35]);
 assert.ok(selected.every(x=>x.senator.length>5));
});
test('original 2022 CFB actual-senator parent sources cannot be changed and missing-sample condition must hold',()=>{
 assert.throws(()=>selectEightPreviouslyUnobservedActualSenators({...fixture,
   firstCfbOriginalCePsv:fixture.firstCfbOriginalCePsv.replace('Andrew R. Lang','Invented Candidate')}),/changed/);
 assert.throws(()=>selectEightPreviouslyUnobservedActualSenators({...fixture,
   secondCfbOriginalCePsv:fixture.secondCfbOriginalCePsv.replace('Jim Abeler','Invented Candidate')}),/changed/);
 assert.throws(()=>selectEightPreviouslyUnobservedActualSenators({...fixture,
   priorSampledViewerPsv:fixture.priorSampledViewerPsv.replace('2022|17994','2024|17994')}),/changed/);
});
test('source failure, legitimate empty CFB source and genuine original version refs stay separate',()=>{
 const target=selected[0]!,src={
   responseSha256:'a'.repeat(64),
   sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+target.reg+'/2024/',
   fetchedAt:'2026-10-11T18:10:30.000Z',
   references:[],
 };
 const failure=auditPreviouslyUnobserved2024CfbViewer(target,null,'original_cfb_api_http_error');
 assert.equal(failure.status,'original_cfb_viewer_fetch_failed');
 assert.equal(failure.observed2023OriginalRefs,null);
 const empty=auditPreviouslyUnobserved2024CfbViewer(target,src);
 assert.equal(empty.status,'official_viewer_response_received_with_no_2023_24_pcc_report_refs');
 assert.equal(empty.observed2023OriginalRefs,0);
 const versions=auditPreviouslyUnobserved2024CfbViewer(target,{...src,
   references:[{year:'23',filingYear:2023,registrationNumber:target.reg,
     type:'pcc',period:'YE',se:'0',amendment:0,reportName:'Yearend'},
     {year:'24',filingYear:2024,registrationNumber:target.reg,
       type:'pcc',period:'YE',se:'0',amendment:1,reportName:'Amendment'}]});
 assert.equal(versions.status,'original_source_viewer_references_discovered');
 assert.equal(versions.observed2023OriginalRefs,1);
 assert.equal(versions.observed2024AmendedRefs,1);
 assert.equal(versions.reportPdfBinariesAuthenticatedHere,0);
 assert.equal(versions.anyLegallyOwedFilingCount,null);
 assert.equal(versions.missingFromEarlierViewerSampleDoesNotProveNonfiling,true);
 const foreign=auditPreviouslyUnobserved2024CfbViewer(target,{...src,
   references:[{year:'23',filingYear:2023,registrationNumber:'99999',
     type:'pcc',period:'YE',se:'0',amendment:0,reportName:'Yearend'}]});
 assert.equal(foreign.status,'original_cfb_viewer_report_identity_conflict');
 const duplicated=auditPreviouslyUnobserved2024CfbViewer(target,{...src,
   references:[{year:'23',filingYear:2023,registrationNumber:target.reg,
     type:'pcc',period:'YE',se:'0',amendment:0,reportName:'A'},
     {year:'23',filingYear:2023,registrationNumber:target.reg,
       type:'pcc',period:'YE',se:'0',amendment:0,reportName:'Duplicate'}]});
 assert.equal(duplicated.status,'original_cfb_viewer_report_identity_conflict');
});
