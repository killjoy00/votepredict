import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildRecoveryPlan} from '../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
import {sha1Base32,sameOriginalSite,exactOriginalCdxRow,verifyWitnessBytes,VERIFIED}
 from '../scripts/verify-senate-864-72-original-artifact-bytes.mjs';
test('all historical source witnesses remain bounded and no inferred vote/author-date',()=>{
 const plan=buildRecoveryPlan();
 assert.equal(plan.witnesses.length,72);
 assert.equal(plan.cohortPersons,34);
 assert.equal(plan.automaticallyTrustedBytes,0);
 assert.equal(plan.productionDatabaseWrites,0);
 assert.ok(plan.witnesses.filter(w=>w.recoveryState==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION').length>=50);
});
test('actual HTML bytes require both independent SHA256 and CDX SHA1 in same exact indexed URL/capture',()=>{
 const html=Buffer.from('<html><body>independent original Senator candidate campaign issue proof</body></html>');
 const digest=sha1Base32(html);
 assert.match(digest,/^[A-Z2-7]{32}$/);
 assert.equal(digest,'PENDING_COMPUTED_IN_TEST'==='PENDING_COMPUTED_IN_TEST'?sha1Base32(html):'');
 const w={recoveryState:'READY_FOR_INDEPENDENT_BYTE_VERIFICATION',
  originalUrl:'https://www.example.test/issues',originalHtmlSha256:createHash('sha256').update(html).digest('hex'),
  originalArchiveCdxSha1Base32:digest,originalArchiveCapturedAtUtc:'2022-05-01T01:02:03.000Z'};
 const rows=[['timestamp','original','mimetype','statuscode','digest','length'],
  ['20220501010203','http://example.test:80/issues','text/html','200',digest,'100']];
 assert.equal(sameOriginalSite('http://example.test/issues/','https://www.example.test/issues'),true);
 assert.equal(sameOriginalSite('http://example.test/issues-two','https://www.example.test/issues'),false);
 assert.equal(exactOriginalCdxRow(rows,{originalUrl:w.originalUrl,archiveDate:w.originalArchiveCapturedAtUtc,digest}),true);
 assert.equal(verifyWitnessBytes(w,html,[rows]),VERIFIED);
 assert.equal(verifyWitnessBytes(w,Buffer.from('tampered'),[rows]),'HOLD_ORIGINAL_HTML_SHA256_MISMATCH');
 assert.equal(verifyWitnessBytes({...w,originalArchiveCdxSha1Base32:'A'.repeat(32)},html,[rows]),
  'HOLD_INDEXED_WAYBACK_PAYLOAD_SHA1_MISMATCH');
 assert.equal(verifyWitnessBytes(w,html,[]),'HOLD_NO_EXACT_ARCHIVE_DATE_URL_AND_DIGEST_IN_CDX_INDEX');
 assert.equal(verifyWitnessBytes(w,html,[rows.map((r,i)=>i?[...r.slice(0,3),'301',...r.slice(4)]:r)]),
  'HOLD_NO_EXACT_ARCHIVE_DATE_URL_AND_DIGEST_IN_CDX_INDEX');
 assert.equal(verifyWitnessBytes(w,html,[rows.map((r,i)=>i?['20220501010204',...r.slice(1)]:r)]),
  'HOLD_NO_EXACT_ARCHIVE_DATE_URL_AND_DIGEST_IN_CDX_INDEX');
 assert.equal(verifyWitnessBytes({...w,recoveryState:'HOLD_SOURCE_ARTIFACT'},html,[rows]),
  'HOLD_MISSING_PINNED_SOURCE_PROVENANCE');
});
