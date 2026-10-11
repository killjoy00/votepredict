/** Finance #864: only archive source captured exact PDF SHA may prove dated version public access. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 FOUR_EXACT_ARCHIVE_PILOT_IDS,
 selectFourRealOriginalArchiveAuditTargets,
 strictCdxReportVersionCaptures,
 classifyExactArchivePdfBinaryProof,
} from '../src/evidence/cfb-2023-24-archived-pdf-publicby-proof.js';
const SOURCE='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const ledger=readFileSync(SOURCE,'utf8');
const actual=selectFourRealOriginalArchiveAuditTargets(ledger);
function capture(id:string,timestamp='20240201141500'){
 const target=actual.find(x=>x.versionId===id)!;
 return {target,capture:{
  timestamp,archivedOriginalUrl:target.sourceSnapshotCfbReportUrl,
  archiveCaptureUtc:timestamp.slice(0,4)+'-'+timestamp.slice(4,6)+'-'+timestamp.slice(6,8)+
  'T'+timestamp.slice(8,10)+':'+timestamp.slice(10,12)+':'+timestamp.slice(12,14)+'.000Z',
  digest:'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGH',
 }};
}
test('real four exact IDs are source SHA-pinned, include Putnam held #1 and accurate later amendment release lower bound',()=>{
 assert.equal(actual.length,4);
 assert.deepEqual(actual.map(x=>x.versionId),[...FOUR_EXACT_ARCHIVE_PILOT_IDS]);
 assert.equal(actual[0]!.authenticOriginalPDF,true);
 assert.equal(actual[1]!.sourceStatus,'HOLD_first_page_registration_unverified');
 assert.equal(actual[1]!.authenticOriginalPDF,false);
 assert.equal(actual[0]!.expectedEarliestPublicByUtc,'2024-02-01T14:00:00.000Z');
 assert.equal(actual[2]!.expectedEarliestPublicByUtc,'2024-02-01T14:00:00.000Z');
 assert.equal(actual[3]!.expectedEarliestPublicByUtc,'2025-10-08T00:00:00.000Z');
 assert.equal(new Set(actual.map(x=>x.originalCfbPdfSha256)).size,4);
 assert.throws(()=>selectFourRealOriginalArchiveAuditTargets(
  ledger.replace('18430:23:pcc:YE:0:1','18430:23:pcc:YE:0:2')),/source changed/);
});
test('Wayback CDX original URL and version must match exact CFB report, not candidate page, other reg, or other amendment',()=>{
 const x=actual[0]!;
 const good=['timestamp','original','statuscode','mimetype','digest'];
 const row=(ts:string,url:string,code='200',mime='application/pdf')=>
  [ts,url,code,mime,'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGH'];
 const candidatePage='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/18430/2024/';
 const records=[good,row('20240201100000',x.sourceSnapshotCfbReportUrl),
  row('20240201141500',candidatePage),
  row('20240201143000',x.sourceSnapshotCfbReportUrl.replace('amend=0','amend=1')),
  row('20240201144000',x.sourceSnapshotCfbReportUrl,'404'),
  row('20240201144500',x.sourceSnapshotCfbReportUrl,'200','text/html'),
  row('20240201150000',x.sourceSnapshotCfbReportUrl)];
 const result=strictCdxReportVersionCaptures({target:x,rawCdxJson:records});
 assert.equal(result.length,1);
 assert.equal(result[0]!.timestamp,'20240201150000');
 assert.throws(()=>strictCdxReportVersionCaptures({target:x,
  rawCdxJson:[['original','timestamp','statuscode','mimetype','digest']] }),/columns/);
 assert.throws(()=>strictCdxReportVersionCaptures({target:x,rawCdxJson:{message:'not found'}}),/rows absent/);
});
test('exact archived ORIGINAL PDF full body SHA is required, not CDX digest or same URL',()=>{
 const x=capture('17919:23:pcc:YE:0:0');
 const buf=new TextEncoder().encode('%PDF-'+'.'.repeat(1500));
 const sourceHash=createHash('sha256').update(buf).digest('hex');
 const original={...x.target,originalCfbPdfSha256:sourceHash};
 const positive=classifyExactArchivePdfBinaryProof({
  target:original,capture:x.capture,archiveHttpStatus:200,archivePdfBytes:buf});
 assert.equal(positive.originalHistoricalVersionPublicBy,'2024-02-01T14:15:00.000Z');
 assert.equal(positive.identicalSourceAuthenticatedVersionBinarySha256,true);
 const mismatched=classifyExactArchivePdfBinaryProof({
  target:x.target,capture:x.capture,archiveHttpStatus:200,archivePdfBytes:buf});
 assert.equal(mismatched.originalHistoricalVersionPublicBy,null);
 assert.equal(mismatched.identicalSourceAuthenticatedVersionBinarySha256,false);
 const badStatus=classifyExactArchivePdfBinaryProof({
  target:original,capture:x.capture,archiveHttpStatus:404,archivePdfBytes:buf});
 assert.equal(badStatus.originalHistoricalVersionPublicBy,null);
 const html=classifyExactArchivePdfBinaryProof({
  target:original,capture:x.capture,archiveHttpStatus:200,
  archivePdfBytes:new TextEncoder().encode('<html>'+'a'.repeat(1600))});
 assert.equal(html.originalHistoricalVersionPublicBy,null);
});
test('held source PDF NEVER gains historical status even if archive binary matches its data; original Board receipt clock enforced',()=>{
 const x=capture('18430:23:pcc:YE:0:1','20240501120000');
 const buf=new TextEncoder().encode('%PDF-'+'.'.repeat(1400));
 const h=createHash('sha256').update(buf).digest('hex');
 const hold=classifyExactArchivePdfBinaryProof({
  target:{...x.target,originalCfbPdfSha256:h},
  capture:x.capture,archiveHttpStatus:200,archivePdfBytes:buf});
 assert.equal(hold.originalCfBVersionWasAlreadyAuthenticated,false);
 assert.equal(hold.originalHistoricalVersionPublicBy,null);
 const violation=capture('17919:23:pcc:YE:0:0','20240201120000');
 const v=classifyExactArchivePdfBinaryProof({
   target:{...violation.target,originalCfbPdfSha256:h},
   capture:violation.capture,archiveHttpStatus:200,archivePdfBytes:buf});
 assert.equal(v.originalHistoricalVersionPublicBy,null,
  '2024-02-01 noon UTC is before 8am Minnesota statutory legal release');
 const late=capture('16964:24:pcc:YE:0:3','20251006200000');
 const l=classifyExactArchivePdfBinaryProof({
  target:{...late.target,originalCfbPdfSha256:h},
  capture:late.capture,archiveHttpStatus:200,archivePdfBytes:buf});
 assert.equal(l.originalHistoricalVersionPublicBy,null,
  'capture on PDF Board receipt date cannot prove observed receipt time');
});
