/**
 * #864: pure validation of OLD (2013-17) Common Crawl original candidate site
 * leads. Neither an indexed hit nor a correctly hashed HTML page independently
 * proves candidate ownership, Senate-office attribution, or issue positions.
 * No network, persistence, database, model, or UI operations.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

export function sha256(buffer) {
 return createHash('sha256').update(buffer).digest('hex');
}
export function sha1Base32(buffer) {
 const bytes=createHash('sha1').update(buffer).digest();
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 let bits=0,acc=0,result='';
 for(const b of bytes) {
  acc=(acc<<8)|b;bits+=8;
  while(bits>=5) {bits-=5;result+=alphabet[(acc>>>bits)&31];}
 }
 if(bits>0)result+=alphabet[(acc<<(5-bits))&31];
 assert.equal(result.length,32);
 return result;
}
const sameHost=(a,b)=>{
 try {
  const x=new URL(a),y=new URL(b);
  return ['http:','https:'].includes(x.protocol)
   &&!x.username&&!x.password&&!x.port
   &&x.hostname.toLowerCase().replace(/^www\./,'')===
     y.hostname.toLowerCase().replace(/^www\./,'');
 }catch{return false;}
};
const safeRow=(r,collection,expectedHost)=>{
 if(!r||typeof r!=='object'||r.status!=='200'||!['text/html','application/xhtml+xml'].includes(r.mime))return false;
 if(!/^20\d{12}$/.test(String(r.timestamp)))return false;
 if(r.timestamp<'20130101000000'||r.timestamp>='20180101000000')return false;
 if(!sameHost(String(r.url||''),expectedHost))return false;
 if(!/^[A-Z2-7]{32}$/.test(String(r.digest||'')))return false;
 if(!/^\d{1,12}$/.test(String(r.offset||''))||!/^\d{1,8}$/.test(String(r.length||'')))return false;
 if(Number(r.length)<150||Number(r.length)>3_000_000)return false;
 const file=String(r.filename||'');
 if(file.includes('..')||file.includes('\\'))return false;
 const prefix='crawl-data/'+collection+'/';
 return (file.startsWith(prefix)||file.startsWith('common-crawl/'+prefix))&&file.endsWith('.warc.gz');
};
export function parseOriginalIndex(body,{collection,expectedHost}) {
 assert.match(collection,/^CC-MAIN-201[3-7]-\d\d$/);
 assert.ok(['http:','https:'].includes(new URL(expectedHost).protocol));
 const raw=Buffer.isBuffer(body)?body:Buffer.from(String(body||''));
 if(raw.length>1_400_000)return {status:'index_oversize_unknown',entries:[]};
 const s=raw.toString('utf8').trim();
 if(!s||!s.startsWith('{'))return {status:'non_jsonl_or_provider_error_unknown',entries:[]};
 const lines=s.split(/\r?\n/);
 if(lines.length>150)return {status:'index_too_many_rows_unknown',entries:[]};
 let parsed;
 try{
  parsed=lines.map(x=>JSON.parse(x));
  if(!parsed.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&'url'in x&&'timestamp'in x&&'digest'in x))
   throw Error('Invalid index shape');
 }catch{return {status:'invalid_jsonl_unknown',entries:[]};}
 const entries=parsed.filter(x=>safeRow(x,collection,expectedHost)).slice(0,20).map(x=>({
  url:x.url,timestamp:x.timestamp,digest:x.digest,collection,
  filename:x.filename.replace(/^common-crawl\//,''),
  offset:Number(x.offset),length:Number(x.length)
 }));
 return {status:'valid_original_index_rows',rows:parsed.length,eligibleRows:entries.length,
  capped:parsed.length>20,entries};
}
export function verifyOriginalWarc(compressed,indexRow) {
 try{
  assert.ok(Buffer.isBuffer(compressed)&&compressed.length>=100&&compressed.length<=3_000_000);
  assert.ok(Number.isInteger(indexRow.length)&&compressed.length===indexRow.length);
  const whole=gunzipSync(compressed,{maxOutputLength:10_000_000});
  const sep=Buffer.from('\r\n\r\n');
  const warcEnd=whole.indexOf(sep);
  assert.ok(warcEnd>40&&warcEnd<15000,'WARC header missing');
  const header=whole.subarray(0,warcEnd).toString('latin1');
  assert.match(header,/^WARC\/1\.[01]\r\n/);
  const h=name=>header.match(new RegExp('(?:^|\\r\\n)'+name+':\\s*([^\\r\\n]+)','i'))?.[1]?.trim()||null;
  assert.equal(h('WARC-Type'),'response');
  assert.equal(h('WARC-Target-URI'),indexRow.url);
  const t=indexRow.timestamp;
  const utc=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14);
  assert.ok(h('WARC-Date')?.startsWith(utc));
  assert.equal(h('WARC-Payload-Digest')?.toUpperCase(),'SHA1:'+indexRow.digest);
  const declaredLength=Number(h('Content-Length'));
  assert.ok(Number.isSafeInteger(declaredLength)&&declaredLength>=100&&declaredLength<=9_000_000);
  const sourceStart=warcEnd+sep.length, sourceEnd=sourceStart+declaredLength;
  assert.ok(sourceEnd<=whole.length);
  assert.match(whole.subarray(sourceEnd).toString('latin1'),/^(?:\r\n){0,4}$/);
  const httpEnd=whole.indexOf(sep,sourceStart);
  assert.ok(httpEnd>sourceStart&&httpEnd-sourceStart<30000&&httpEnd+4<sourceEnd);
  const http=whole.subarray(sourceStart,httpEnd).toString('latin1');
  assert.match(http,/^HTTP\/\d(?:\.\d)? 200(?:\s|\r)/);
  assert.match(http,/content-type:\s*(?:text\/html|application\/xhtml\+xml)/i);
  const html=whole.subarray(httpEnd+sep.length,sourceEnd);
  assert.ok(html.length>=100&&html.length<=5_000_000);
  assert.equal(sha1Base32(html),indexRow.digest,'Indexed full original payload SHA1 mismatch');
  const text=html.toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').toLowerCase();
  return {status:'authenticated_original_html',originalUrl:indexRow.url,
   observationUTC:utc+'Z',indexedSha1Base32:indexRow.digest,
   originalHtmlSha256:sha256(html),originalHtmlBytes:html.length,
   compressedOriginalWarcSha256:sha256(compressed),
   potentialSenateOfficeCue:/\b(?:state |mn |minnesota )?senat(?:e|or)\b/.test(text),
   originalGovernorCue:/\bgovernor\b/.test(text),
   repurposedTemplateCue:/\breceipt templates?\b|\bprintable receipts?\b/.test(text),
   originalCandidateOwnershipIndependentlyProven:false,
   exactIssueStatementIndependentlyAuthenticated:false,
   automaticallyAdmittedSenateSite:false,
   automaticallyAdmittedCandidateStatement:false};
 }catch(e){return {status:'invalid_original_or_digest_unmatched',reason:String(e.message||e).slice(0,180)};}
}
