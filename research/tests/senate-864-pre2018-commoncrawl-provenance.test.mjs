import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {parseOriginalIndex,verifyOriginalWarc,sha1Base32} from '../../src/evidence/senate-864-pre2018-commoncrawl-provenance.mjs';
const collection='CC-MAIN-2015-11';
const url='http://www.tomassoni4senate.com/';
const html=Buffer.from('<html><body><h1>Historical test candidate Senate archive</h1><p>Only synthetic words here; no candidate position is asserted.</p><p>'.padEnd(300,'x')+'</p></body></html>');
const digest=sha1Base32(html);
const base={url,timestamp:'20150302032705',status:'200',mime:'text/html',digest,
 filename:'common-crawl/crawl-data/CC-MAIN-2015-11/segments/fake/warc/a.warc.gz',offset:'12345',length:'500'};
function warc(data=html,opts={}){
 const http=Buffer.concat([Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n'),data]);
 const headers=[
 'WARC/1.0','WARC-Type: response',
 'WARC-Target-URI: '+(opts.target||url),
 'WARC-Date: 2015-03-02T03:27:05Z',
 'WARC-Payload-Digest: sha1:'+(opts.digest||digest),
 'Content-Length: '+http.length,'',''];
 return gzipSync(Buffer.concat([Buffer.from(headers.join('\r\n')),http,Buffer.from('\r\n\r\n')]));
}
test('old index accepts pinned original-host 2015 source but never asserts policy',()=>{
 const x=parseOriginalIndex(JSON.stringify(base),{collection,expectedHost:url});
 assert.equal(x.status,'valid_original_index_rows');
 assert.equal(x.eligibleRows,1);
 assert.equal(x.entries[0].filename.startsWith('crawl-data/CC-MAIN-2015-11/'),true);
});
test('HTTP 200 provider error and invalid original JSONL must remain unknown',()=>{
 assert.equal(parseOriginalIndex('<html>404</html>',{collection,expectedHost:url}).entries.length,0);
 assert.equal(parseOriginalIndex('<html>404</html>',{collection,expectedHost:url}).status,'non_jsonl_or_provider_error_unknown');
 assert.equal(parseOriginalIndex('{"status":"200"}',{collection,expectedHost:url}).status,'invalid_jsonl_unknown');
});
test('index rejects wrong host, later election, non-html, and archive path traversal',()=>{
 const candidates=[{...base,url:'http://different-committee.com/'},
  {...base,timestamp:'20200101000000'},
  {...base,mime:'application/pdf'},
  {...base,filename:'crawl-data/CC-MAIN-2015-11/../secrets.warc.gz'}];
 const x=parseOriginalIndex(candidates.map(a=>JSON.stringify(a)).join('\n'),{collection,expectedHost:url});
 assert.equal(x.rows,4);assert.equal(x.eligibleRows,0);
});
test('original WARC uses Content-Length to exclude record separator, validates full indexed SHA1',()=>{
 const compressed=warc(),row={...base,length:compressed.length,offset:12345};
 const x=verifyOriginalWarc(compressed,row);
 assert.equal(x.status,'authenticated_original_html');
 assert.equal(x.indexedSha1Base32,digest);
 assert.equal(x.originalHtmlBytes,html.length);
 assert.equal(x.originalCandidateOwnershipIndependentlyProven,false);
 assert.equal(x.exactIssueStatementIndependentlyAuthenticated,false);
 assert.equal(x.automaticallyAdmittedSenateSite,false);
 assert.equal(x.automaticallyAdmittedCandidateStatement,false);
});
test('rejects tampered original payload and incorrect WARC identity',()=>{
 const compressed=warc(Buffer.from(html.toString('utf8').replace('Historical','Different')));
 const row={...base,length:compressed.length};
 assert.equal(verifyOriginalWarc(compressed,row).status,'invalid_original_or_digest_unmatched');
 const wrong=warc(html,{target:'http://other.org/'});
 assert.equal(verifyOriginalWarc(wrong,{...row,length:wrong.length}).status,'invalid_original_or_digest_unmatched');
});
test('rejects index digest mismatch and conflicting byte length',()=>{
 const compressed=warc();
 assert.equal(verifyOriginalWarc(compressed,{...base,length:compressed.length,digest:'A'.repeat(32)}).status,'invalid_original_or_digest_unmatched');
 assert.equal(verifyOriginalWarc(compressed,{...base,length:compressed.length+10}).status,'invalid_original_or_digest_unmatched');
});
test('repurposed commercial HTML does not become attributed Senate campaign text',()=>{
 const repurposed=Buffer.from('<html><body>Free printable receipt templates and accounting templates for your business. '.padEnd(240,'y')+'</body></html>');
 const bytes=warc(repurposed,{digest:sha1Base32(repurposed)});
 const output=verifyOriginalWarc(bytes,{...base,digest:sha1Base32(repurposed),length:bytes.length});
 assert.equal(output.status,'authenticated_original_html');
 assert.equal(output.repurposedTemplateCue,true);
 assert.equal(output.automaticallyAdmittedCandidateStatement,false);
});
