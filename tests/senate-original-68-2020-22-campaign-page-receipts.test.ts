import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import source from '../data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json' with {type:'json'};
import {
 SENATE_68_ORIGINAL_CAMPAIGN_RECEIPT_AUDIT_VERSION,
 auditPinned68SenateOriginalCampaignPageReceipts,
} from '../scripts/audit-senate-original-68-campaign-page-receipts-offline.js';

test('68 individually pinned independently SHA-256/CDX-digested original webpages from only true senators',()=>{
 assert.match(SENATE_68_ORIGINAL_CAMPAIGN_RECEIPT_AUDIT_VERSION,/68-reopened/);
 assert.equal(source.schema,
  'mn-senate-2020-and-2022-authenticated-original-campaign-page-provenance-v1');
 assert.equal(source.pages.length,68);
 assert.equal(source.pages.filter(p=>p.electionYear===2022).length,44);
 assert.equal(source.pages.filter(p=>p.electionYear===2020).length,24);
 assert.equal(new Set(source.pages.map(p=>p.sourceFile)).size,68);
 assert.equal(new Set(source.pages.filter(p=>p.electionYear===2022).map(p=>p.senator)).size,12);
 assert.equal(new Set(source.pages.filter(p=>p.electionYear===2020).map(p=>p.senator)).size,6);
 assert.ok(source.pages.every(p=>
  /^[0-9a-f]{64}$/.test(p.originalHtmlSha256)
  &&/^[A-Z2-7]{32}$/.test(p.independentHistoricalCdxPayloadSha1Base32)
  &&p.historicalCaptureAtUtc<(p.electionYear===2022?
    '2022-11-08T00:00:00.000Z':'2020-11-03T00:00:00.000Z')
  &&p.publicByCutoffIsOriginalCaptureOnly===true
  &&p.originalPostedByAuthorAtUtc===null
  &&p.campaignCycleForQuoteReviewed===false
  &&p.sourceEvidenceInProduction===false
  &&p.originalUrl.startsWith('http')));
 assert.deepEqual(source.archiveArtifacts.source2022, {
  runId:38107693123,artifactId:11689989592,
  archiveZipSha256:'610ba6c678fd93ce38a5c120e7c29fb57d99f3d998276b26cae8e5c276e7dc47',
  originalSourceManifest:'source-acquisition-manifest.json',
  originalPageReplaysAttempted:48,authenticated:44,
 });
});
test('specific critical new original issue pages are preserved with independent byte identities',()=>{
 const selects=[
  ['Zaynab Mohamed','https://zaynabmohamed.org/platform/','2022-01-31T21:52:45.000Z'],
  ['Grant Hauschild','https://grantformn.com/priorities/','2022-08-05T03:49:20.000Z'],
  ['Jen McEwen','https://www.votemcewen.com/issues','2022-08-05T08:01:26.000Z'],
  ['Nathan Wesenberg','https://www.wesenbergforsenate.com/issues','2022-08-05T05:46:02.000Z'],
  ['Clare Oumou Verbeten','https://www.clareverbeten.com/issues','2022-08-05T04:22:31.000Z'],
  ['Mary Kunesh','http://marykunesh.com/vision/','2020-08-04T23:27:35.000Z'],
  ['Gary Dahms','http://dahmsforsenate.com/issues/','2019-07-20T10:16:47.000Z'],
 ];
 for(const [person,url,date] of selects)
  assert.equal(source.pages.filter(p=>
   p.senator===person&&p.originalUrl===url
   &&p.historicalCaptureAtUtc===date).length,1);
 assert.equal(source.scope.originalHistoricSOSFiledWebsiteFieldsCertified,false);
 assert.equal(source.scope.campaignPositionQuotesFromThisPageSetIndividuallyReviewed,false);
});
test('synthetic claimed source cannot pass original government byte and digest verification',()=>{
 const bogus=Buffer.from('<html><body>Original political campaign text</body></html>');
 const lrl={
  source:{url:'https://www.lrl.mn.gov/legdb/senate_dir',
   observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'},
 };
 assert.throws(()=>auditPinned68SenateOriginalCampaignPageReceipts({
  lrlHtml:bogus,lrlReceipt:lrl,
  original2020:{},original2022:{},html2020:{},html2022:{},
 }),/Real original LRL Senate-service directory HTML/);
});
test('offline raw-original verifier requires every external source path and rejects absent input',()=>{
 const d=mkdtempSync(join(tmpdir(),'senate-campaign-68-source-proof-'));
 try{
  const target=join(d,'audit.json');
  const script='scripts/audit-senate-original-68-campaign-page-receipts-offline.ts';
  assert.throws(()=>execFileSync('node',['--import','tsx',script,'--output',target],
   {timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(target),false);
 }finally{rmSync(d,{recursive:true,force:true});}
});
