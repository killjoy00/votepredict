import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 SCHEMA,MARKER,loadV13Targets,originalLegacyPdfUrl,parseLegacyCdx,
 probeLegacyPdfExactTarget,auditLegacyReportPublicationV13,
} from '../scripts/audit-cfb-864-legacy-pdf-publicby-v13.mjs';

const host={id:'contemporaneous_cfb_mn_gov',domain:'cfb.mn.gov'};
const otherHost={id:'legacy_cfbreport_state_mn_us',domain:'cfbreport.state.mn.us'};
const target=loadV13Targets()[0];
const H=['timestamp','original','statuscode','mimetype','digest','length'];
const DIGEST='ABCDEFGHIJKLMNOPQRSTUVWX234567AB';
const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(1200,65)]);
const sha256=createHash('sha256').update(pdf).digest('hex');
const fake={...target,officialPdfSha256:sha256,originalPdfBytes:pdf.length};
const original=originalLegacyPdfUrl(fake,host);
const stamp='20220301093004';
const row=[stamp,original,'200','application/pdf',DIGEST,String(pdf.length)];
function served(body,url,status=200,headers={}){
 const res=new Response(body,{status,headers});
 Object.defineProperty(res,'url',{value:url});
 return res;
}
test('nine authentic exact source versions explicitly include original and amended years 2021–25',()=>{
 assert.equal(SCHEMA,'cfb-864-exact-report-pdf-alternate-legacy-url-historical-cdx-v13');
 assert.equal(MARKER,
  'SENATE_864_OFFICIAL_LEGACY_RPTVIEWER_PDF_HISTORICAL_PROOF_V13_20261012');
 const r=loadV13Targets();
 assert.equal(r.length,9);
 assert.deepEqual(new Set(r.map(t=>t.reportYear)),new Set([2021,2022,2023,2024,2025]));
 assert.ok(r.some(t=>t.amendmentIndex==='2'));
 assert.ok(r.every(t=>t.legalDateFloor&&/^[a-f0-9]{64}$/.test(t.officialPdfSha256)));
 const changed=readFileSync(
  'docs/evaluation/source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv','utf8');
 assert.throws(()=>loadV13Targets(changed.replace(
  'c8ae220986e7e61913c19c7eb6e7028f781ab4450da226a52843c7b7820d19e8',
  'not-original-sha')));
});
test('historical Board-style GET link has no downloadpdf and no amend=0',()=>{
 const first=originalLegacyPdfUrl(target,host);
 assert.equal(first,'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=21&type=pcc&period=YE&se=0&regnum=18430');
 const last=loadV13Targets().find(x=>x.id==='18430:23:pcc:YE:0:2');
 assert.ok(originalLegacyPdfUrl(last,otherHost).endsWith(
  '&se=0&regnum=18430&amend=2'));
 assert.doesNotMatch(originalLegacyPdfUrl(last,host),/downloadpdf=false/);
 assert.throws(()=>originalLegacyPdfUrl(target,{
  id:'unapproved',domain:'evil.example'}));
});
test('CDX 200 PDF metadata is an unverified lead without replay SHA proof',()=>{
 assert.deepEqual(parseLegacyCdx('[]',original),[]);
 assert.deepEqual(parseLegacyCdx(JSON.stringify([H]),original),[]);
 assert.deepEqual(parseLegacyCdx(JSON.stringify([H,row]),original),[
  {timestamp:stamp,original,status:'200',mime:'application/pdf',
   digest:DIGEST,networkLength:pdf.length},
 ]);
 assert.deepEqual(parseLegacyCdx(JSON.stringify([H,
  [stamp,original,'200','text/html',DIGEST,String(pdf.length)]]),original),[]);
 for(const mismatch of [
  [stamp,original.replace('cfb.mn.gov','evil.example'),'200','application/pdf',DIGEST,String(pdf.length)],
  [stamp,original.replace('period=YE','period=E'),'200','application/pdf',DIGEST,String(pdf.length)],
  [stamp,original+'&amend=0','200','application/pdf',DIGEST,String(pdf.length)],
  ['20270201000000',original,'200','application/pdf',DIGEST,String(pdf.length)],
  [stamp,original,'302','application/pdf',DIGEST,String(pdf.length)],
  [stamp,original,'200','application/pdf','INVALID',String(pdf.length)],
 ]){
  assert.throws(()=>parseLegacyCdx(JSON.stringify([H,mismatch]),original));
 }
 assert.throws(()=>parseLegacyCdx(JSON.stringify([H,
  ...Array.from({length:9},()=>row)]),original));
});
test('full historically archived PDF entity SHA and date are required for one positive',async()=>{
 const seen=[];
 const mock=async(url,opts)=>{
  const current=String(url);seen.push([current,opts.method,opts.redirect]);
  if(current.startsWith('https://web.archive.org/cdx/search/cdx?')){
   const u=new URL(current);
   assert.equal(u.searchParams.get('url'),original);
   assert.equal(u.searchParams.get('limit'),'8');
   return served(JSON.stringify([H,row]),current);
  }
  const replay='https://web.archive.org/web/'+stamp+'id_/'+original;
  assert.equal(current,replay);
  return served(pdf,current,200,{'content-length':String(pdf.length),
   'content-type':'application/pdf'});
 };
 const r=await probeLegacyPdfExactTarget(fake,host,mock);
 assert.equal(seen.length,2);
 assert.equal(r.status,'historically_public_exact_pdf_source_binary_proven');
 assert.equal(r.independentlyProvenCaptureOn,'2022-03-01');
 assert.equal(r.archiveTimestampUtc,stamp);
 assert.equal(r.exactCfbPdfSha256Verified,true);
 assert.equal(r.archivePdfBytesVerified,true);
 assert.doesNotMatch(JSON.stringify(r),/rptViewer|cfb\.mn\.gov|web\.archive\.org|%PDF-/);
});
test('mismatched archived bytes NEVER establish exact PDF historical public-by',async()=>{
 const badPdf=Buffer.from(pdf);badPdf[badPdf.length-1]^=1;
 const mock=async(url)=>String(url).includes('/cdx/search/cdx?')
  ?served(JSON.stringify([H,row]),String(url))
  :served(badPdf,String(url));
 const r=await probeLegacyPdfExactTarget(fake,host,mock);
 assert.equal(r.status,'archive_original_exact_pdf_sha256_mismatch_hold');
 assert.equal(r.independentlyProvenCaptureOn,null);
 assert.equal(r.exactCfbPdfSha256Verified,false);
});
test('CDX capture before legal floor is HELD even if full bytes might otherwise match',async()=>{
 const old=[...row];old[0]='20220101010101';
 let calls=0;
 const mock=async(url)=>{calls++;return served(JSON.stringify([H,old]),String(url))};
 const r=await probeLegacyPdfExactTarget(fake,host,mock);
 assert.equal(r.status,'indexed_capture_before_legal_or_receipt_floor_hold');
 assert.equal(calls,1);
 assert.equal(r.attempts,0);
 assert.equal(r.independentlyProvenCaptureOn,null);
});
test('invalid archive, network/HTTP failures do not become proof of non-publication',async()=>{
 const calls=[];
 const r=await auditLegacyReportPublicationV13(async(url)=>{
  calls.push(String(url));return served('',String(url),404);
 });
 assert.equal(r.results.length,18);
 assert.equal(calls.length,18);
 assert.ok(r.results.every(x=>x.status==='cdx_404_this_url_only'));
 assert.equal(r.verifiedExactPdfCaptures,0);
 assert.equal(r.standaloneFirstPublicationDatesProven,false);
 assert.equal(r.excludesBulkCsvAndLegacyV6AndLegalDutyDenominator,true);
 assert.equal(r.zeroDatabaseReadsWrites,true);
 assert.equal(r.noDonorOrTransactionOrRawPdfExports,true);
 const fail=await probeLegacyPdfExactTarget(target,host,
  async()=>{throw Error('Synthetic archive unavailable')});
 assert.equal(fail.status,'cdx_invalid_or_network_hold');
 assert.equal(fail.independentlyProvenCaptureOn,null);
});
test('workflow is offline in the sense of no secret/DB; only public archive reads',()=>{
 const y=readFileSync('.github/workflows/senate-864-cfb-legacy-pdf-publicby-v13.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/node --test tests\/cfb-864-legacy-pdf-publicby-v13\.test\.mjs/);
 assert.match(y,/node scripts\/audit-cfb-864-legacy-pdf-publicby-v13\.mjs/);
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(y,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
