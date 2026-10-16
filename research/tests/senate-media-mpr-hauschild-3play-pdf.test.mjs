import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {
 PDF,EPISODE,ORIGINAL_PAGE_PINS,COLLECTIONS,
 inspectPdfBytes,inspectPublisherHtml,parsePdfCdx,parsePdfCommonCrawl,
 extractOriginalWarcPdf,probeCurrentPdf,probePdfWayback,probePdfCommonCrawl
} from '../../scripts/probe-senate-media-mpr-hauschild-3play-pdf.mjs';
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(x){let n=0,b=0,s='';for(const k of x){n=n<<8|k;b+=8;while(b>=5){b-=5;s+=ALPH[n>>>b&31];}n&=(1<<b)-1;}if(b)s+=ALPH[n<<(5-b)&31];return s;}
const pdf=Buffer.from("%PDF-1.7\n1 0 obj\n<< /CreationDate (D:20240221045612-06'00') /ModDate (D:20250724000000Z) >>\nendobj\n%%EOF\n",'latin1');
const hash=b32(createHash('sha1').update(pdf).digest()),hex=createHash('sha256').update(pdf).digest('hex');
const st='20240222050000',utc='2024-02-22T05:00:00Z';
const cols=['timestamp','original','mimetype','statuscode','digest','length'];
const c=COLLECTIONS[0];
function warc(){
 const h=Buffer.from('HTTP/1.1 200 OK\r\ncontent-type: application/octet-stream\r\n\r\n');
 const msg=Buffer.concat([h,pdf]);
 const w=Buffer.from('WARC/1.0\r\nWARC-Type: response\r\nWARC-Target-URI: '+PDF+'\r\nWARC-Payload-Digest: sha1:'+hash+'\r\nWARC-Date: '+utc+'\r\nContent-Length: '+msg.length+'\r\n\r\n');
 return gzipSync(Buffer.concat([w,msg,Buffer.from('\r\n\r\n')]));
}
const gz=warc(),offset=100000;
const crawlRow={url:PDF,mime:'application/octet-stream',status:'200',digest:hash,timestamp:st,
 filename:'crawl-data/'+c+'/segments/17234.11/warc/CC-MAIN-20240222-00001.warc.gz',offset:String(offset),length:String(gz.length)};
const archive={collection:c,captureUtc:utc,indexedSha1Base32:hash,compressedLength:gz.length};
test('APM PDF URL is literal publisher transcript link and original 2024/25 MPR HTML SHA pins preserved',()=>{
 assert.equal(PDF,'https://codytranscripts.apmcdn.org/production/70fb369cef19a16a739671110457b6b9.pdf');
 assert.match(EPISODE,/mprnews.org\/episode\/2024\/02\/19\//);
 assert.equal(ORIGINAL_PAGE_PINS.length,3);
 assert.equal(ORIGINAL_PAGE_PINS[0].sha1,'DHKJFEB7VR76PWGE7EY2ZOUDZKLYKV5X');
 assert.equal(ORIGINAL_PAGE_PINS[1].sha256,'da848c28bb3c3e1335076de4606ec472d8695a4c2533add45812614df3fc9536');
 assert.equal(ORIGINAL_PAGE_PINS[2].sha256,'9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725');
});
test('PDF info dates are observed as internal fields, not claimed transcript first posting',()=>{
 const m=inspectPdfBytes(pdf);
 assert.equal(m.pdfVersion,'1.7');
 assert.equal(m.selectedEmbeddedDateFields.embeddedPdfCreationDate,"D:20240221045612-06'00'");
 assert.equal(m.selectedEmbeddedDateFields.embeddedPdfModificationDate,'D:20250724000000Z');
 assert.equal(m.metadataDatesDoNotProvePublicFirstAvailability,true);
 assert.throws(()=>inspectPdfBytes(Buffer.from('<html>Fake transcript PDF</html>')));
});
test('current publisher PDF bytes under application/octet-stream are accepted only with valid magic and full SHA',async()=>{
 const f=async (url,opts)=>{assert.equal(url,PDF);assert.equal(opts.redirect,'manual');return new Response(pdf,{headers:{'content-type':'application/octet-stream','last-modified':'Thu, 24 Jul 2025 12:00:00 GMT'}});};
 const r=await probeCurrentPdf(f);
 assert.equal(r.status,'current_publisher_pdf_bytes_sha256_verified');
 assert.equal(r.rawSha256,hex);assert.equal(r.bytes,pdf.length);
 assert.equal(r.httpLastModified,'Thu, 24 Jul 2025 12:00:00 GMT');assert.equal(r.firstPublishedAtNotCertified,true);
});
test('current and historic MPR HTML link presence is distinct from transcript words and from PDF bytes',()=>{
 const sample='<html><body><a href="'+PDF+'">Download transcript</a> GRANT HAUSCHILD: I feel that immigration is a federal issue.</body></html>';
 const r=inspectPublisherHtml(sample);
 assert.equal(r.exact3PlayCdnPdfUrlStringFound,true);
 assert.equal(r.selectedSpeakerLabelLiteralFound,true);
 assert.equal(r.selectedHistoricalTranscriptPhraseLiteralFound,true);
 const old=inspectPublisherHtml('<html><body>Listen to Minnesota Now</body></html>');
 assert.equal(old.exact3PlayCdnPdfUrlStringFound,false);
 assert.equal(old.negativeExactLiteralIsNotProofNoOtherTranscriptReferences,true);
});
test('Wayback CDX rejects wrong original PDF URL, bad SHA and pre-2024 capture',()=>{
 assert.equal(parsePdfCdx([cols,[st,PDF,'application/octet-stream','200',hash,''+pdf.length]]).length,1);
 assert.throws(()=>parsePdfCdx([cols,[st,'https://evil.example/pdf','application/pdf','200',hash,'100']]));
 assert.throws(()=>parsePdfCdx([cols,[st,PDF,'text/html','200',hash,'100']]));
 assert.throws(()=>parsePdfCdx([cols,['20230222050000',PDF,'application/pdf','200',hash,'100']]));
 assert.throws(()=>parsePdfCdx([cols,[st,PDF,'application/pdf','200','invalid','100']]));
});
test('exact Wayback original PDF SHA1-replay authenticates a historical PDF without approving senator recorded voice',async()=>{
 const f=async url=>{
  if(url.includes('/cdx/search/cdx?')){const u=new URL(url);assert.equal(u.searchParams.get('url'),PDF);return new Response(JSON.stringify([cols,[st,PDF,'application/octet-stream','200',hash,''+pdf.length]]),{headers:{'content-type':'application/json'}});}
  assert.equal(url,'https://web.archive.org/web/'+st+'id_/'+PDF);
  return new Response(pdf,{headers:{'content-type':'application/octet-stream'}});
 };
 const x=await probePdfWayback(f);
 assert.equal(x.indexStatus,'indexed_original_pdf_candidates');
 assert.equal(x.firstTwoArchivePdfReplayAttempts[0].status,'historically_authenticated_original_pdf_sha1');
 assert.equal(x.firstTwoArchivePdfReplayAttempts[0].rawOriginalSha256,hex);
 assert.equal(x.firstTwoArchivePdfReplayAttempts[0].originalPdfSpeakerWordsNotHumanReviewed,true);
});
test('exact Common Crawl indexed URL and WARC source collection/status must agree before original PDF attempt',()=>{
 assert.equal(parsePdfCommonCrawl(JSON.stringify(crawlRow),c)[0].indexedSha1Base32,hash);
 assert.throws(()=>parsePdfCommonCrawl(JSON.stringify({...crawlRow,url:'https://evil.example/pdf'}),c));
 assert.throws(()=>parsePdfCommonCrawl(JSON.stringify({...crawlRow,mime:'text/html'}),c));
 assert.throws(()=>parsePdfCommonCrawl(JSON.stringify({...crawlRow,filename:'crawl-data/'+c+'/../../x.warc.gz'}),c));
 assert.throws(()=>parsePdfCommonCrawl(JSON.stringify({...crawlRow,timestamp:'20230101000000'}),c));
 assert.throws(()=>parsePdfCommonCrawl(JSON.stringify(crawlRow),'CC-MAIN-2020-01'));
});
test('WARC original PDF envelope, source URL, HTTP 200, MIME and original indexed SHA1 all required',()=>{
 const v=extractOriginalWarcPdf(gz,archive);
 assert.equal(v.originalSha256,hex);assert.equal(v.originalBytes,pdf.length);
 assert.equal(v.pdf.metadataDatesDoNotProvePublicFirstAvailability,true);
 assert.throws(()=>extractOriginalWarcPdf(Buffer.concat([gz,Buffer.from('junk')]),archive));
 assert.throws(()=>extractOriginalWarcPdf(gz,{...archive,indexedSha1Base32:'A'.repeat(32)}));
 assert.throws(()=>extractOriginalWarcPdf(gz,{...archive,compressedLength:gz.length+1}));
});
test('Common Crawl exact verified WARC byte range returns original PDF; a full server response is rejected',async()=>{
 const f=async (url,opts)=>{
  if(url.includes('-index?'))return new Response(JSON.stringify(crawlRow),{headers:{'content-type':'application/x-ndjson'}});
  assert.equal(opts.headers.Range,'bytes='+offset+'-'+(offset+gz.length-1));
  return new Response(gz,{status:206,headers:{'content-range':'bytes '+offset+'-'+(offset+gz.length-1)+'/9999999'}});
 };
 const r=await probePdfCommonCrawl(f);
 const x=r.collections[0].firstWarcReplayAttempts[0];
 assert.equal(x.status,'historically_authenticated_original_commoncrawl_pdf_sha1');
 assert.equal(x.rawOriginalSha256,hex);
 const missing=await probePdfCommonCrawl(async(url)=>url.includes('-index?')?new Response(JSON.stringify(crawlRow)):new Response(gz,{status:200}));
 assert.equal(missing.collections[0].firstWarcReplayAttempts[0].status,'not_verified_exact_warc_range_unknown');
});
test('unknown first-party source response does not become invented historical PDF or transcript clock',async()=>{
 const unavailable=async()=>new Response('service down',{status:503});
 const wb=await probePdfWayback(unavailable),cc=await probePdfCommonCrawl(unavailable),p=await probeCurrentPdf(unavailable);
 assert.equal(wb.indexStatus,'index_unavailable_unknown');
 assert.ok(cc.collections.every(x=>x.indexStatus==='index_unavailable_unknown'));
 assert.equal(p.status,'publisher_pdf_http_unknown');assert.equal(p.firstPublishedAtNotCertified,true);
});
