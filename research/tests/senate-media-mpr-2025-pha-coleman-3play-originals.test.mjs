import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {
 VERSION,LEADS,validateLeads,inspectParentHtml,probeCurrentPublisher,
 parseExactPdfCdx,probeWaybackPdf,parseExactCrawlPdf,extractOriginalWarcPdf,
 probeCommonCrawlPdf,runPhaColemanTranscriptPdfProbe
} from '../../scripts/probe-senate-media-mpr-2025-pha-coleman-3play-pdfs.mjs';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(bytes){let v=0,n=0,out='';for(const x of createHash('sha1').update(bytes).digest()){
 v=v<<8|x;n+=8;while(n>=5){n-=5;out+=B32[(v>>>n)&31];}v&=(1<<n)-1;}if(n)out+=B32[(v<<(5-n))&31];return out;}
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /CreationDate (D:20250425011213Z) /Producer (3Play Media) >>\nendobj\ntrailer\n<< >>\n%%EOF\n','latin1');
const hash=createHash('sha256').update(pdf).digest('hex');
const sha1=b32(pdf),lead=LEADS[0],day='20250501123040',utc='2025-05-01T12:30:40Z';
const columns=['timestamp','original','mimetype','statuscode','digest','length'];
const index=[columns,[day,lead.pdf,'application/octet-stream','200',sha1,String(pdf.length)]];
const html='<html><head><script>SUSAN PHA: only hidden transcript</script></head><body>'
 +'<a href="'+lead.pdf+'">Download transcript (PDF)</a><p>SUSAN PHA: '
 +"We negotiated a veterans designation on driver's license for those who served."
 +'</p></body></html>';
const offset=760000;
function warc(sha=sha1,target=lead.pdf,body=pdf){
 const head=Buffer.from('HTTP/1.1 200 OK\r\ncontent-type: application/pdf\r\n\r\n');
 const msg=Buffer.concat([head,body]);
 const wh=Buffer.from('WARC/1.0\r\nWARC-Type: response\r\nWARC-Target-URI: '+target
 +'\r\nWARC-Payload-Digest: sha1:'+sha+'\r\nWARC-Date: '+utc
 +'\r\nContent-Length: '+msg.length+'\r\n\r\n');
 return gzipSync(Buffer.concat([wh,msg,Buffer.from('\r\n\r\n')]));
}
const compressed=warc(),collection=lead.collections[0];
const ccRow={url:lead.pdf,mime:'application/pdf',status:'200',digest:sha1,timestamp:day,
 filename:'crawl-data/'+collection+'/segments/1745500000000.1/warc/CC-MAIN-20250501-00011.warc.gz',
 offset:String(offset),length:String(compressed.length)};
const parsedWarc={...ccRow,collection,captureUtc:utc,indexedSha1Base32:sha1,compressedLength:compressed.length,
 offset,filename:ccRow.filename};
test('two exact serving 2025 MPR interview URLs and publisher-linked APM PDFs, no unrelated domain or modified sample',()=>{
 assert.equal(VERSION,'mpr-2025-pha-coleman-3play-original-pdf-history-v1');
 assert.deepEqual(validateLeads().map(l=>l.senator),['Susan Pha','Julia Coleman']);
 assert.equal(LEADS[0].pdf,'https://codytranscripts.apmcdn.org/production/f6c5cb374510772be01fbc20ea88d2d0.pdf');
 assert.equal(LEADS[1].pdf,'https://codytranscripts.apmcdn.org/production/2d9064e094aab7627c6e05a3c2aad608.pdf');
 assert.throws(()=>validateLeads([{...LEADS[0],pdf:'https://malicious.example/senator.pdf'},LEADS[1]]));
 assert.throws(()=>validateLeads([LEADS[0],LEADS[0]]));
});
test('MPR visible speaker label and exact linked PDF are independent source observations',()=>{
 const r=inspectParentHtml(html,lead);
 assert.equal(r.literalExactApmCdnPdfUrlReferenced,true);
 assert.equal(r.selectedSenatorLabelVisible,true);
 assert.equal(r.shortSelectedUtteranceVisible,true);
 assert.equal(r.currentSpeakerCueNotHistoricalPdfOrAudioProof,true);
 const hidden=inspectParentHtml('<html><head><script>SUSAN PHA: '+lead.shortTranscriptCue+'</script></head><body>other reporter news</body></html>',lead);
 assert.equal(hidden.selectedSenatorLabelVisible,false);
 assert.equal(hidden.shortSelectedUtteranceVisible,false);
});
test('current original publisher PDF bytes are read independently and embedded dates do not prove publication clocks',async()=>{
 const get=async url=>{
  if(url===lead.episode)return new Response(html,{status:200,headers:{'content-type':'text/html'}});
  assert.equal(url,lead.pdf);
  return new Response(pdf,{status:200,headers:{'content-type':'application/octet-stream',
   'last-modified':'Fri, 25 Apr 2025 01:12:18 GMT'}});
 };
 const r=await probeCurrentPublisher(lead,get);
 assert.equal(r.pdfStatus,'current_apm_original_pdf_bytes_sha256_verified');
 assert.equal(r.htmlStatus,'current_first_party_html_sha256_verified');
 assert.equal(r.pdfSha256,hash);assert.equal(r.pdfSha1Base32,sha1);assert.equal(r.pdfBytes,pdf.length);
 assert.equal(r.embeddedPdfDates.embeddedPdfCreationDate,'D:20250425011213Z');
 assert.equal(r.currentPdfShaDoesNotProveHistoricalAvailability,true);
 assert.equal(r.currentPublisherHtmlCues.selectedSenatorLabelVisible,true);
});
test('an HTML response that claims a PDF mimetype cannot authenticate PDF bytes',async()=>{
 const f=async url=>url===lead.pdf?
  new Response('<html>fake PDF</html>'+' '.repeat(75),{headers:{'content-type':'application/pdf'}}):
  new Response(html,{headers:{'content-type':'text/html'}});
 const r=await probeCurrentPublisher(lead,f);
 assert.equal(r.pdfStatus,'current_first_party_pdf_fetch_or_magic_unknown');
 assert.equal(r.pdfSha256,null);
});
test('strict Wayback CDX accepts exact valid indexed original in 2025 only',()=>{
 assert.equal(parseExactPdfCdx(index,lead).length,1);
 assert.throws(()=>parseExactPdfCdx([columns,['20250401000000',lead.pdf,'application/pdf','200',sha1,'100']],lead));
 assert.throws(()=>parseExactPdfCdx([columns,['20260101000000',lead.pdf,'application/pdf','200',sha1,'100']],lead));
 assert.throws(()=>parseExactPdfCdx([columns,[day,'https://evil.test/a.pdf','application/pdf','200',sha1,'100']],lead));
 assert.throws(()=>parseExactPdfCdx([columns,[day,lead.pdf,'text/html','200',sha1,'100']],lead));
 assert.throws(()=>parseExactPdfCdx([columns,[day,lead.pdf,'application/pdf','200','BAD','100']],lead));
});
test('Wayback index original PDF must be exact SHA1-index matched before it is authenticated',async()=>{
 const f=async(url,opts)=>{
  assert.equal(opts.redirect,'manual');
  if(url.includes('/cdx/search/cdx?')){const q=new URL(url).searchParams;
   assert.equal(q.get('url'),lead.pdf);assert.equal(q.get('to'),'2025');
   return new Response(JSON.stringify(index),{headers:{'content-type':'application/json'}});}
  assert.equal(url,'https://web.archive.org/web/'+day+'id_/'+lead.pdf);
  return new Response(pdf,{headers:{'content-type':'application/octet-stream'}});
 };
 const r=await probeWaybackPdf(lead,f);
 assert.equal(r.status,'historical_index_candidates');
 assert.equal(r.historicalPdfReplays[0].status,'sha1_authenticated_historical_original_apm_pdf');
 assert.equal(r.historicalPdfReplays[0].rawSha256,hash);
 assert.equal(r.historicalPdfReplays[0].bytes,pdf.length);
 assert.equal(r.historicalPdfReplays[0].historicQuoteAndAudioNotCertified,true);
});
test('the same indexed original PDF with changed bytes must fail closed, never source authenticate',async()=>{
 const f=async url=>url.includes('/cdx/search/cdx?')?
  new Response(JSON.stringify(index),{headers:{'content-type':'application/json'}}):
  new Response(Buffer.concat([pdf,Buffer.from(' extra')]),{headers:{'content-type':'application/octet-stream'}});
 const r=await probeWaybackPdf(lead,f);
 assert.equal(r.historicalPdfReplays[0].status,'original_pdf_cdx_payload_digest_mismatch_unknown');
 assert.equal(r.historicalPdfReplays[0].rawSha256,null);
});
test('a failed original 2025 PDF index remains UNKNOWN, not proof PDF did not exist',async()=>{
 const unavailable=async()=>new Response('temporarily unavailable',{status:503});
 const r=await probeWaybackPdf(lead,unavailable);
 assert.equal(r.status,'historical_index_unavailable_unknown');
 assert.equal(r.emptyOrFailedIndexNotProofNo2025Pdf,true);
});
test('indexed Common Crawl original PDF URL/status/collection/digest/byte-range bounds strictly checked',()=>{
 const a=parseExactCrawlPdf(JSON.stringify(ccRow),lead,collection);
 assert.equal(a.length,1);assert.equal(a[0].indexedSha1Base32,sha1);
 assert.throws(()=>parseExactCrawlPdf(JSON.stringify({...ccRow,url:'https://malicious.example/a.pdf'}),lead,collection));
 assert.throws(()=>parseExactCrawlPdf(JSON.stringify({...ccRow,mime:'text/html'}),lead,collection));
 assert.throws(()=>parseExactCrawlPdf(JSON.stringify({...ccRow,filename:'crawl-data/'+collection+'/../../x.warc.gz'}),lead,collection));
 assert.throws(()=>parseExactCrawlPdf(JSON.stringify({...ccRow,timestamp:'20260101000000'}),lead,collection));
 assert.throws(()=>parseExactCrawlPdf(JSON.stringify(ccRow),lead,'CC-MAIN-2024-10'));
});
test('Common Crawl source WARC envelope, archived HTTP response, and original PDF indexed digest authenticate together',()=>{
 const r=extractOriginalWarcPdf(compressed,parsedWarc,lead.pdf);
 assert.equal(r.rawSha256,hash);assert.equal(r.bytes,pdf.length);
 assert.equal(r.embeddedPdfDates.embeddedPdfCreationDate,'D:20250425011213Z');
 assert.throws(()=>extractOriginalWarcPdf(warc(sha1,'https://evil.test/a.pdf'),parsedWarc,lead.pdf));
 assert.throws(()=>extractOriginalWarcPdf(warc('A'.repeat(32)),parsedWarc,lead.pdf));
 assert.throws(()=>extractOriginalWarcPdf(compressed,{...parsedWarc,compressedLength:compressed.length+1},lead.pdf));
});
test('an exact 206 byte-range Common Crawl WARC original PDF is verified but 200 full response is rejected',async()=>{
 const mock=async(url,opts)=>{
  if(url.includes('-index?'))return new Response(JSON.stringify(ccRow),{headers:{'content-type':'application/x-ndjson'}});
  assert.equal(opts.headers.Range,'bytes='+offset+'-'+(offset+compressed.length-1));
  return new Response(compressed,{status:206,headers:{'content-range':'bytes '+offset+'-'+(offset+compressed.length-1)+'/10000000'}});
 };
 const r=await probeCommonCrawlPdf(lead,mock);
 assert.equal(r.collections[0].originalAttempts[0].status,'sha1_authenticated_original_commoncrawl_pdf');
 assert.equal(r.collections[0].originalAttempts[0].rawSha256,hash);
 const fail=await probeCommonCrawlPdf(lead,async url=>
  url.includes('-index?')?new Response(JSON.stringify(ccRow)):new Response(compressed,{status:200}));
 assert.equal(fail.collections[0].originalAttempts[0].status,'non_exact_commoncrawl_byte_range_unknown');
});
test('when no first-party or archive endpoint is reachable, report bounded UNKNOWN without historical claims',async()=>{
 const f=async url=>url.includes('commoncrawl.org')?
  new Response('missing selected index',{status:404}):new Response('upstream unavailable',{status:503});
 const r=await runPhaColemanTranscriptPdfProbe(f);
 assert.equal(r.namedServingSenators,2);assert.equal(r.verified2025OriginalApMTranscriptPdfCaptures,0);
 assert.ok(r.reports.every(x=>x.earliestVerifiedPublicArchiveCaptureUtc===null));
 assert.ok(r.reports.every(x=>x.wayback.emptyOrFailedIndexNotProofNo2025Pdf));
 assert.equal(r.noArticlePdfAudioWarcBytesSaved,true);
 assert.equal(r.noPrivateExportOrDbTouched,true);
 assert.equal(r.noProductionSeedCollectorOrIngestionOrForecastOrModelChanges,true);
});
