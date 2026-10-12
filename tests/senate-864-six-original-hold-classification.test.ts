import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_ONLY_HOLD_CODES,classifySafeOriginalPdfHold,safeOriginalRetryPermitted,
 safeReparseCountComparison} from '../scripts/audit-senate-864-original-1452-parser-v3.js';

test('#864 original PDF errors produce only reviewed static category codes, never raw diagnostics',()=>{
 const cases=[
  ['Original PDF SHA mismatch https://hidden.invalid/member.pdf','pdf_integrity_or_bounds',false],
  ['Original PDF page cap failed','pdf_page_cap',false],
  ['Command failed: pdfinfo /tmp/example.pdf','pdfinfo_failure',true],
  ['Minnesota Senate committee minutes OCR failed -- member_name','ocr_or_render_failure',true],
  ['Invalid PDF structure: /tmp/test.pdf','pdf_parser_failure',true],
  ['Original embedded text digest drift','source_text_drift',false],
  ['Verified Education original six-action pin failed','semantic_original_mismatch',false],
  ['fetch failed AbortError','network_or_timeout',true],
  ['Minnesota Senate committee minutes PDF had too little extractable text','insufficient_text',true],
  ['some weird path with original page text','unclassified',false],
 ] as const;
 for(const [raw,expected,retry] of cases){
  const code=classifySafeOriginalPdfHold(new Error(raw));
  assert.equal(code,expected);
  assert.equal(safeOriginalRetryPermitted(code),retry);
  assert.equal(SOURCE_ONLY_HOLD_CODES.includes(code),true);
  assert.doesNotMatch(code,/https?|member|tmp\/|\.pdf|name/);
 }
 assert.equal(classifySafeOriginalPdfHold('malformed'), 'unclassified');
});
test('parser comparison still counts changes for one document without exposing its details',()=>{
 const old={document:{sourceUrl:'DO_NOT_EXPORT_PRIVATE_URL',meetingDate:'2024-02-14',
  committeeName:'Mock',originalRawPdfSha256:'a'.repeat(64)},
  voteObservations:[{individualVotesAvailable:true,namedMemberChoicesInPdf:10}]};
 const report=safeReparseCountComparison(old,2,0);
 assert.deepEqual(report,{beforeNamed:1,afterNamed:2,beforeCountOnly:0,afterCountOnly:0,
  addedNamed:1,addedCountOnly:0,namedDecreased:false,countsDecreased:false});
 assert.doesNotMatch(JSON.stringify(report),/DO_NOT_EXPORT|Mock|2024-02-14/);
});
