import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sha1Base32,validCdxEntries,decodeVisibleOriginal,attributedShortCue,boundedNamedSpeakerQuote,probe}
 from '../scripts/probe-senate-864-substantive-new-originals.mjs';
const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-substantive-firstparty-current-original-leads-v1.json','utf8'));
const q=manifest.leads.find(x=>x.id==='lead-2023-kreun-sf551');
const byteString='<html><body><p>Senator Michael Kreun said the following statement:</p><p>“'+q.exactCurrentlyVisibleShortQuote+'” said Kreun.</p></body></html>';
const body=Buffer.from(byteString.repeat(24),'utf8');
const idx=['20230420000000',q.originalPublisherUrl,'text/html','200',sha1Base32(body),String(body.length)];
const data=[['timestamp','original','mimetype','statuscode','digest','length'],idx];
const mocking=(archivedBody=body,code=200,index=data)=>async url=>String(url).includes('/cdx/')||String(url).includes('/cdx?')?
 new Response(JSON.stringify(index),{status:code,headers:{'content-type':'application/json'}}):
 new Response(archivedBody,{status:200,headers:{'content-type':'text/html'}});

test('whole-content original SHA1/Base32 matches indexed SHA1 (32 chars)',()=>{
 assert.equal(sha1Base32(Buffer.alloc(0)), '3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ');
 assert.equal(sha1Base32(body),idx[4]);
});
test('same exact url, original MIME, status and timestamp required in raw CDX index',()=>{
 const r=validCdxEntries(data,q.originalPublisherUrl,q.publisherDisplayedDay);
 assert.equal(r.length,1);assert.equal(r[0].indexedSha1Base32,idx[4]);
 assert.equal(validCdxEntries([data[0],[...idx.slice(0,3),'302',...idx.slice(4)]],q.originalPublisherUrl,q.publisherDisplayedDay).length,0);
 assert.equal(validCdxEntries([data[0],[...idx.slice(0,2),'application/pdf',...idx.slice(3)]],q.originalPublisherUrl,q.publisherDisplayedDay).length,0);
 assert.equal(validCdxEntries([data[0],['20260420000000',...idx.slice(1)]],q.originalPublisherUrl,q.publisherDisplayedDay).length,0);
 assert.equal(validCdxEntries([data[0],['20230420000000','https://phishing.example/same',...idx.slice(2)]],q.originalPublisherUrl,q.publisherDisplayedDay).length,0);
});
test('HTTP body validated against independently indexed CDX digest and verbatim source cue',async()=>{
 const r=await probe(q,mocking());
 assert.equal(r.archiveState,'ARCHIVED_ORIGINAL_BODY_AND_EXACT_SHORT_CUE_VERIFIED');
 assert.equal(r.originalIndexedArchivePublicByUtc,'2023-04-20T00:00:00Z');
 assert.equal(r.quoteProof.literalShortPublisherCueFound,true);
 assert.equal(r.quoteProof.speakerBoundaryRequiresHumanReview,true);
 assert.equal(r.approvedHistoricalPredictionEvidence,false);
 assert.equal(r.sourceBodyAndCdxIndexIndependentlyReverified,true);
});
test('digest failure cannot become original HTML certified',async()=>{
 const r=await probe(q,mocking(Buffer.from(byteString+' poisoned body','utf8')));
 assert.equal(r.sourceBodyAndCdxIndexIndependentlyReverified,false);
 assert.equal(r.archiveState,'INDEX_AVAILABLE_REPLAY_OR_SHA_FAILED_UNKNOWN');
});
test('archive provider 504 is UNKNOWN, not absent statement or zero vote',async()=>{
 const r=await probe(q,mocking(body,504));
 assert.equal(r.archiveState,'CDX_HTTP_504_UNKNOWN');
 assert.equal(r.approvedHistoricalPredictionEvidence,false);
 assert.equal(r.originalIndexedArchivePublicByUtc,null);
});
test('unexpected raw CDX schema is unknown, not an empty authoritative source universe',async()=>{
 const r=await probe(q,mocking(body,200,[['timestamp','original'],['20230420000000',q.originalPublisherUrl]]));
 assert.equal(r.archiveState,'CDX_INVALID_UNKNOWN');
 assert.equal(r.sourceBodyAndCdxIndexIndependentlyReverified,false);
});
test('duplicate publisher fragment remains one named quote event independent of bill crosswalk',()=>{
 assert.ok(decodeVisibleOriginal(byteString).includes(decodeVisibleOriginal(q.exactCurrentlyVisibleShortQuote)));
 const proof=attributedShortCue(body,q);
 assert.equal(proof.literalShortPublisherCueFound,true);
 assert.ok(proof.selectedCueOccurrenceCount>1);
 assert.equal(proof.wholeHumanApprovedVerbatimQuote,false);
});

test('bound historic original short claim to closing quote with Senator FIRST LAST attribution',()=>{
 const html=Buffer.from('<p>“'+q.exactCurrentlyVisibleShortQuote+' Unfortunately, additional limits apply,” said Senator Michael Kreun (R-Blaine).</p>');
 const p=boundedNamedSpeakerQuote(html,q);
 assert.equal(p.boundedNamedSpeakerQuote,true);
 assert.equal(p.selectedCueInsideClosedQuotedRegion,true);
 assert.equal(p.completeHumanApprovedWholeSpeech,false);
});
test('bound "said Kreun" only with preceding same-turn full senator name',()=>{
 const html=Buffer.from('<p>Senator Michael Kreun (R-Blaine) presented two pieces of Highway 65 legislation.</p><p>“'+q.exactCurrentlyVisibleShortQuote+'” said Kreun.</p>');
 assert.equal(boundedNamedSpeakerQuote(html,q).boundedNamedSpeakerQuote,true);
});
test('different senator quote or missing curly closure never becomes attributed speech',()=>{
 const a=Buffer.from('<p>“'+q.exactCurrentlyVisibleShortQuote+'” said Senator Mark Koran.</p>');
 const b=Buffer.from('<p>Senator Michael Kreun responded. “'+q.exactCurrentlyVisibleShortQuote+' said Kreun.</p>');
 assert.equal(boundedNamedSpeakerQuote(a,q).boundedNamedSpeakerQuote,false);
 assert.equal(boundedNamedSpeakerQuote(b,q).boundedNamedSpeakerQuote,false);
});
test('repeated short quote not promoted to one uniquely bounded speech',()=>{
 const html=Buffer.from(('<p>“'+q.exactCurrentlyVisibleShortQuote+'” said Senator Michael Kreun.</p>').repeat(2));
 assert.equal(boundedNamedSpeakerQuote(html,q).boundedNamedSpeakerQuote,false);
});
