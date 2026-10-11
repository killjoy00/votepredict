import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {
  SENATE_138_CAPTION_SOURCE_SCHEMA,PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS,
  inspectMediaPageCaptionSurface,classifyOriginalCaptionPayload,
  readExactPriorMediaHtmlProof,
} from '../src/evidence/senate-committee-138-caption-surface.js';

const page='https://www.lrl.mn.gov/media/file?mtgid=1047437';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('all 138 previously successful original HTML source artifacts are immutable independently dated cohorts',()=>{
 assert.equal(SENATE_138_CAPTION_SOURCE_SCHEMA,
  'senate-2022-25-138-original-media-record-caption-surface-proof-v1');
 assert.deepEqual(Object.entries(PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS).map(([y,x])=>[+y,x.count]),[
  [2022,11],[2023,64],[2024,41],[2025,22]]);
 assert.equal(Object.values(PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS).reduce((n,x)=>n+x.count,0),138);
 assert.ok(Object.values(PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS).every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
 assert.deepEqual(Object.values(PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS).map(x=>x.artifactId),
  [11680881578,11679809828,11680254175,11680606990]);
});
test('original media metadata cannot be substituted, fabricated or tampered with',()=>{
 const fake=JSON.stringify({schemaVersion:'senate-138-source-hashed-official-media-html-visibility-v1',
   year:2023,htmlRecordPagesFetched:64,exactRecordUrlsExpected:64,
   failedRecords:0,records:[]});
 assert.throws(()=>readExactPriorMediaHtmlProof(2023,fake),/SHA changed/);
 assert.throws(()=>readExactPriorMediaHtmlProof(2022,'{}'),/SHA changed/);
});
test('only explicit same-host original video caption request may be probed',()=>{
 const html='<html><head><title>Senate</title></head><body>'+
   '<a class="showcaptions" data-num="0" data-id="2023TaxesMeeting.mp4">Show captions</a>'+
   '<a class="showcaptions" data-id="https://evil.invalid/file.mp4" data-num="1">Reject</a>'+
   '<a class="showcaptions" data-id="../../x.mp4" data-num="2">Reject</a>'+
   '<a href="/media/captions">generic caption nav</a></body></html>';
 const r=inspectMediaPageCaptionSurface(html,page);
 assert.equal(r.totalRequestCandidates,3);
 assert.equal(r.safeRequestCandidates.length,1);
 assert.equal(r.rejectedRequestCandidates,2);
 assert.equal(r.safeRequestCandidates[0].mp4,'2023TaxesMeeting.mp4');
 const u=new URL(r.safeRequestCandidates[0].endpointUrl);
 assert.equal(u.origin,'https://www.lrl.mn.gov');
 assert.equal(u.pathname,'/media/media_functions');
 assert.equal(u.searchParams.get('type'),'getCaption');
 assert.equal(r.pageOriginalHtmlSha256,sha(html));
 assert.equal(r.noCapturedCaptionWordsOrMediaBodies,true);
});
test('static generic video/audio HTML markup is not caption availability',()=>{
 const html='<html><body><video controls></video><audio controls></audio>'+
   '<a href="/media/captions">Captions</a></body></html>';
 const r=inspectMediaPageCaptionSurface(html,page);
 assert.equal(r.totalRequestCandidates,0);
 assert.equal(r.safeRequestCandidates.length,0);
});
test('off-origin and extra-query media record pages are refused',()=>{
 const html='<html><body><a class="showcaptions" data-id="a.mp4">test</a></body></html>';
 for(const u of [
  'http://www.lrl.mn.gov/media/file?mtgid=1047437',
  'https://evil.invalid/media/file?mtgid=1047437',
  page+'&download=true',
  'https://www.lrl.mn.gov/media/file?mtgid=../../x',
 ])assert.throws(()=>inspectMediaPageCaptionSurface(html,u),/Not a pinned official/);
});
test('caption HTML with actual timed rows is metadata evidence, not a vote',()=>{
 const bytes=new TextEncoder().encode('<html><table><tr data-time="74.22"><td>unreviewed auto caption</td></tr></table></html>');
 const ok=classifyOriginalCaptionPayload(200,'text/html; charset=utf-8',bytes);
 assert.equal(ok.status,'caption_timed_rows_observed');
 assert.equal(ok.timedCaptionRows,1);
 assert.equal(ok.originalPayloadBytes,bytes.length);
 assert.equal(ok.originalPayloadSha256,sha(new TextDecoder().decode(bytes)));
 assert.ok(ok.sourceTextCharacterCount>0);
 const empty=classifyOriginalCaptionPayload(200,'text/html',new TextEncoder().encode('<html></html>'));
 assert.equal(empty.status,'caption_payload_no_timed_rows');
 assert.equal(empty.timedCaptionRows,0);
});
test('HTML errors, login page and oversize responses never become recovered timed-caption evidence',()=>{
 const x=new TextEncoder().encode('<tr data-time="10"><td>quote</td></tr>');
 assert.equal(classifyOriginalCaptionPayload(404,'text/html',x).status,'caption_endpoint_http_unavailable');
 assert.equal(classifyOriginalCaptionPayload(200,'application/pdf',x).status,'caption_endpoint_invalid_payload');
 assert.equal(classifyOriginalCaptionPayload(200,'text/html',new Uint8Array(1_500_001)).status,'caption_endpoint_oversize');
 assert.equal(classifyOriginalCaptionPayload(302,'text/html',x).timedCaptionRows,0);
});
