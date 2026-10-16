/** #864. Old scoped viewer omission is UNKNOWN, not absence of a report. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  selectEightPreviouslyUnobservedActualSenators,
  auditPreviouslyUnobserved2024CfbViewer,
  CFB_EIGHT_2024_TARGETS,
} from '../../src/evidence/cfb-2024-eight-unobserved-verified-senator-viewers.js';
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

test('all eight genuine CFB viewer responses and all 27 newly observed version IDs are permanently source pinned',()=>{
 const P='docs/evaluation/source-proof/';
 const ckpt=JSON.parse(readFileSync(P+
   'cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json','utf8'));
 const snapshots=readFileSync(ckpt.viewerSnapshotsLedger.path,'utf8');
 const records=readFileSync(ckpt.exactNewViewerReferences.path,'utf8');
 const blob=(s:string)=>createHash('sha1').update('blob '+Buffer.byteLength(s,'utf8')+'\0')
   .update(s).digest('hex');
 assert.equal(blob(snapshots),ckpt.viewerSnapshotsLedger.gitBlobSha);
 assert.equal(blob(records),ckpt.exactNewViewerReferences.gitBlobSha);
 const people=snapshots.trimEnd().split('\n').map(x=>x.split('|'));
 const refs=records.trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(people.length,8);assert.equal(refs.length,27);
 const byReg=new Map(people.map(x=>[x[0]!,x]));
 const originalViewer=fixture.priorSampledViewerPsv.trimEnd().split('\n')
   .map(x=>x.split('|')).filter(x=>x[0]==='2022');
 const originalSha=new Map(originalViewer.map(x=>[x[1]!,x[2]!]));
 let originals=0,amendments=0;
 for(const senator of selected){
   const row=byReg.get(senator.reg);
   assert.ok(row,'Missing actually serving senator original source');
   assert.equal(row.length,10);assert.equal(row[1],senator.senator);
   assert.equal(row[2],String(senator.district));
   assert.equal(row[3],originalSha.get(senator.reg));
   assert.ok(Number.isFinite(Date.parse(row[4]!)));
   assert.equal(row[5],'1');assert.equal(row[7],'1');
   const sourceIds=row[9]!.split(',');
   assert.equal(sourceIds.length,Number(row[5])+Number(row[6])+Number(row[7])+Number(row[8]));
   assert.deepEqual(refs.filter(x=>x[3]===senator.reg).map(x=>x[0]).sort(),sourceIds.sort());
 }
 for(const ref of refs){
   assert.equal(ref.length,7);
   assert.ok(byReg.has(ref[3]!));
   const source=byReg.get(ref[3]!)!;
   assert.equal(ref[1],source[1]);assert.equal(ref[2],source[2]);
   assert.equal(ref[4],source[3]);assert.equal(ref[5],source[4]);
   assert.match(ref[0]!,/^\d+:2[34]:pcc:YE:0:\d+$/);
   if(ref[0]!.endsWith(':0')){
     assert.equal(ref[6],'original_viewer_reference_not_yet_pdf_authenticated');
     originals++;
   }else{
     assert.equal(ref[6],'amendment_viewer_reference_not_yet_pdf_authenticated');
     amendments++;
   }
 }
 assert.equal(originals,16);assert.equal(amendments,11);
 assert.equal(ckpt.results.originalPdfBinariesNewlyAuthenticated,0);
 assert.equal(ckpt.results.sourceFailures,0);
 assert.equal(ckpt.safeguards.legallyOwedFilingDenominator,null);
 assert.equal(ckpt.safeguards.noPreviouslyUnsampledIsNonfilerInference,true);
});
