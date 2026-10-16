import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {
 FILED_FEB06_A2_SOURCE as S,checkExactFiledA2OriginalPdf
} from '../../src/evidence/senate-2025-elections-feb06-filed-a2-original-source.js';

const fake=()=>Buffer.from('%PDF-1.7\n'+'Synthetic PDF for guard testing only. '.repeat(18)+'\n%%EOF\n');
const request=(b:Uint8Array=fake())=>({
 requestedUrl:S.originalPdfUrl,finalResponseUrl:S.originalPdfUrl,
 status:200,contentType:'application/pdf',byteArray:b
});
test('original official indexed A2 source has fixed historical location and provenance',()=>{
 assert.equal(S.schemaVersion,'senate-2025-elections-feb06-sf0529-original-filed-a2-binary-v1');
 assert.equal(S.hearingDate,'2025-02-06');
 assert.equal(S.bill,'SF0529');
 assert.equal(S.originalDocumentLabel,'sf0529-a2-amendment');
 assert.equal(S.originalPdfUrl,
  'https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_SF0529-A2-Amendment.pdf');
 assert.equal(S.originalMinutesPdfSHA256,
  '054c81c01271e8ef6513f57c29e95cbdb4f3984a8b0676effe6a83f0f812469d');
 assert.equal(S.originalMinutesExtractedTextSHA256,
  '99301546122e3bdb2013302b384e4dd3c2bb15d66056efb1888c66c541758750');
 assert.deepEqual([S.originalLuceroA2OralMotionTextOffset,
  S.originalMathewsA2MotionTextOffset],[1991,2250]);
});
test('synthetic original PDF binary has independent SHA hash, but certifies no historical vote',()=>{
 const body=fake();
 const p=checkExactFiledA2OriginalPdf(request(body));
 assert.equal(p.originalPdfSha256,createHash('sha256').update(body).digest('hex'));
 assert.equal(p.originalPdfBytes,body.length);
 assert.equal(p.originalPdfHeaderVerified,true);
 assert.equal(p.originalPdfEofMarkerVerified,true);
 assert.equal(p.storedHistoricalAvailabilityNotInferred,true);
 assert.equal(p.filedAmendmentDoesNotProveDistinctCommitteeVote,true);
 assert.equal(p.noIndividualYeaNayChoiceEstablished,true);
});
test('reject unauthorized domain, URL, redirect, response code, or MIME',()=>{
 const a=request();
 for(const change of [
  {...a,requestedUrl:'https://other.example/file.pdf'},
  {...a,finalResponseUrl:'https://redirect.example/file.pdf'},
  {...a,status:302},
  {...a,status:404},
  {...a,contentType:'text/html'}
 ])assert.throws(()=>checkExactFiledA2OriginalPdf(change));
});
test('reject fake PDF magic, missing EOF, undersize and oversize',()=>{
 const bad=[
  Buffer.from('HTML!'+ 'x'.repeat(400)+'\n%%EOF'),
  Buffer.from('%PDF-1.7\n'+'x'.repeat(420)),
  Buffer.from('%PDF-1.7\n%%EOF'),
  Buffer.concat([Buffer.from('%PDF-1.7\n'),
   Buffer.alloc(S.maxPdfBytes+1),Buffer.from('\n%%EOF')])
 ];
 for(const b of bad)assert.throws(()=>checkExactFiledA2OriginalPdf(request(b)));
});