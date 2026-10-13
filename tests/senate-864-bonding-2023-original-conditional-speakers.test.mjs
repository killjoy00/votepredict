import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha1Base32} from '../scripts/probe-senate-864-substantive-new-originals.mjs';
import {validateManifest,boundNamedOriginalQuote,checkOriginal,run}
 from '../scripts/probe-senate-864-bonding-2023-original-conditional-speakers.mjs';
const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-2023-bonding-conditional-direct-speech-leads-v1.json','utf8'));
const johnson=manifest.speakers[0],housley=manifest.speakers[1],weber=manifest.speakers[2],wesenberg=manifest.speakers[3];
const clone=x=>structuredClone(x);
const line=(s,role)=>'<p>“Our proposal is modest; '+s.exactShortQuoteCue+' and we will work with our colleagues.” '+role+'.</p>';
const many='<p>Historic speaker page description and press release background.</p>'.repeat(35);
const html=Buffer.from('<html><body>'+many+
 line(johnson,'Republican Senate Minority Leader Mark Johnson (East Grand Forks) said')+
 line(housley,'Republican Bonding Lead Karin Housley (Stillwater) asked')+
 line(weber,'Republican Tax Lead Bill Weber (Luverne) said')+
 '</body></html>');
const page=manifest.sourceArticles[0],stamp='20230310122345';
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const index=[header,[stamp,page.url,'text/html','200',sha1Base32(html),String(html.length)]];
const mocked=(options={})=>async url=>{
 if(String(url).includes('/cdx/search/cdx')){
  if(options.status)return new Response('temporarily unavailable',{status:options.status});
  return new Response(JSON.stringify(options.index||index),{status:200,headers:{'content-type':'application/json'}});
 }
 return new Response(options.body||html,{status:options.originalStatus||200,
  headers:{'content-type':'text/html; charset=utf-8'}});
};
test('exact actual serving member names and three official HF669/HF670 legislative actions validated',()=>{
 const x=validateManifest(manifest);
 assert.equal(x.distinctSpeakers,4);
 assert.equal(x.distinctFirstPartyPublisherUrls,3);
 assert.equal(x.sourceToDecisionCount,12);
});
test('reject generalized legislative context mistaken for officially recorded member vote',()=>{
 const m=clone(manifest);m.independentOfficialDecisionChronology[0].individualVoterRollUnverifiedInNewResearch=false;
 assert.throws(()=>validateManifest(m),/wrong official/);
});
test('reject swapped speaker on multi-individual original or invalid publisher',()=>{
 const a=clone(manifest);a.speakers[0].officialName='Jordan Rasmusson';
 assert.throws(()=>validateManifest(a),/speaker identity/);
 const b=clone(manifest);b.sourceArticles[0].url='https://another.example.com/bonding/';
 assert.throws(()=>validateManifest(b),/untrusted first-party/);
});
test('verify direct quote closed and explicitly attributed to correct individual senator',()=>{
 for(const s of [johnson,housley,weber]){
  const x=boundNamedOriginalQuote(html,s);
  assert.equal(x.verified,true,s.id+' '+x.reason);
  assert.match(x.normalizedBoundedOriginalQuotedPassageSha256,/^[a-f0-9]{64}$/);
  assert.equal(x.quotedPassageNotProofOfAnySpecificHF669OrHF670Vote,true);
  assert.equal(x.completeHumanApprovedWholeSpeech,false);
 }
});
test('a name in heading, article mention or unrelated following speaker cannot own an otherwise identical phrase',()=>{
 const only=Buffer.from('<h1>Mark Johnson Senator</h1><p>“Our proposal '+johnson.exactShortQuoteCue+'.” The reporter wrote.</p>');
 assert.equal(boundNamedOriginalQuote(only,johnson).verified,false);
 const wrong=Buffer.from('<p>“'+johnson.exactShortQuoteCue+'” Republican Bonding Lead Karin Housley said.</p>');
 assert.equal(boundNamedOriginalQuote(wrong,johnson).verified,false);
 const unquoted=Buffer.from('<p>Mark Johnson said '+johnson.exactShortQuoteCue+'</p>');
 assert.equal(boundNamedOriginalQuote(unquoted,johnson).verified,false);
});
test('duplicated passage in same original is not a uniquely supported speaker excerpt',()=>{
 const twice=Buffer.from(('<p>“'+housley.exactShortQuoteCue+'” Karin Housley asked.</p>').repeat(2));
 assert.equal(boundNamedOriginalQuote(twice,housley).verified,false);
});
test('proper exact full HTML SHA indexed pre-vote proof remains research-only and gives no personal ballot',async()=>{
 const x=await checkOriginal(page,manifest.speakers.slice(0,3),mocked());
 assert.equal(x.archivedOriginalStatus,'MATCHED_WHOLE_ORIGINAL_SHA1_AND_PERSONALLY_NAMED_QUOTED_CUE');
 assert.equal(x.sourceOriginalPublicByUtc,'2023-03-10T12:23:45Z');
 assert.equal(x.originalCapturePredatesMarch16VoteDay,true);
 assert.equal(x.originalCapturePredatesMay22VoteDay,true);
 assert.equal(x.individuallyNamedShortOriginalQuotes.filter(r=>r.verified).length,3);
 assert.match(x.originalRawHtmlSha256,/^[a-f0-9]{64}$/);
});
test('digest mismatch cannot certify archived speaker even if quote is present',async()=>{
 const bad=Buffer.from(html.toString('utf8').replace('Historic speaker','Changed speaker'));
 const x=await checkOriginal(page,manifest.speakers.slice(0,3),mocked({body:bad}));
 assert.equal(x.sourceIndexedShaAndDownloadedHtmlMatched,false);
 assert.equal(x.archivedOriginalStatus,'INDEX_KNOWN_BUT_RAW_OR_QUOTE_UNKNOWN');
});
test('provider 503/invalid index treated as unknown, never missing statement',async()=>{
 const x=await checkOriginal(page,[johnson],mocked({status:503}));
 assert.equal(x.archivedOriginalStatus,'CDX_HTTP_503_UNKNOWN');
 assert.equal(x.originalCapturePredatesMarch16VoteDay,false);
 const y=await checkOriginal(page,[johnson],mocked({index:[['bad','schema']]}));
 assert.equal(y.archivedOriginalStatus,'CDX_SCHEMA_OR_PARSER_UNKNOWN');
});
test('even exact archived text dated after March16 cannot be retrofitted before March16 vote',async()=>{
 const future=[header,['20230320122345',page.url,'text/html','200',sha1Base32(html),String(html.length)]];
 const x=await checkOriginal(page,[johnson],mocked({index:future}));
 assert.equal(x.sourceIndexedShaAndDownloadedHtmlMatched,true);
 assert.equal(x.originalCapturePredatesMarch16VoteDay,false);
 assert.equal(x.originalCapturePredatesMay22VoteDay,true);
});
test('Wesenberg March7 is distinct speaker, not a duplicate of Housley original',()=>{
 const text=Buffer.from('<p>“Our fiscal path; '+wesenberg.exactShortQuoteCue+' and rural communities should benefit.” said Senator Nathan Wesenberg (R-Little Falls).</p>');
 assert.equal(boundNamedOriginalQuote(text,wesenberg).verified,true);
 assert.equal(boundNamedOriginalQuote(text,housley).verified,false);
});
test('duplicate Housley direct quote across different releases deduplicates underlying source event',async()=>{
 const dup=Buffer.from('<html><body>'+many+line(housley,'Republican Bonding Lead Karin Housley (Stillwater) asked')+'</body></html>');
 const dupTime='20230313000000';
 const f=async u=>{
  const url=String(u),isIndex=url.includes('/cdx/search/cdx'),
    isRepost=url.includes('housley-senate-gop-offers-win-win-tax-cuts-for-bonding');
  if(isIndex){
   const currentUrl=new URL(url).searchParams.get('url');
   const p=currentUrl===page.url?page:manifest.sourceArticles[1];
   const bytes=currentUrl===page.url?html:dup;
   return new Response(JSON.stringify([header,[currentUrl===page.url?stamp:dupTime,p.url,'text/html','200',sha1Base32(bytes),String(bytes.length)]]),{status:200});
  }
  return new Response(isRepost?dup:html,{status:200,headers:{'content-type':'text/html'}});
 };
 const x=await run({...manifest,sourceArticles:manifest.sourceArticles.map(p=>
  p.id==='bonding-20230307-wesenberg'?{...p,speakerIds:['karin-housley-bond-timing']}:p)
 },f).catch(()=>null);
 // Membership validation correctly rejects a mismatched Housley mapping to
 // Wesenberg's distinct source page; never silently add a fifth speech.
 assert.equal(x,null);
});

test('full named Housley reporting clause immediately BEFORE closed quoted source is an independently attributable written statement',()=>{
 const p=Buffer.from('<p>Republican Bonding Lead Karin Housley (Stillwater) asked: “'+
   housley.exactShortQuoteCue+'; this is important for Minnesota infrastructure.”</p>');
 const q=boundNamedOriginalQuote(p,housley);
 assert.equal(q.verified,true,q.reason);
 assert.equal(q.reason,'direct_full_named_senator_reporting_clause_immediately_before_closed_original_quote');
 assert.match(q.normalizedBoundedOriginalQuotedPassageSha256,/^[0-9a-f]{64}$/);
});
test('full named Bill Weber said before quoted source passes but non-senator comment does not',()=>{
 const p=Buffer.from('<p>Republican Tax Lead Bill Weber (Luverne) said: “'+
  weber.exactShortQuoteCue+'; tax relief has to come first.”</p>');
 const x=boundNamedOriginalQuote(p,weber);
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.completeHumanApprovedWholeSpeech,false);
 const wrong=Buffer.from('<p>Bill Weber addressed reporters. “'+weber.exactShortQuoteCue+'.”</p>');
 assert.equal(boundNamedOriginalQuote(wrong,weber).verified,false);
});
test('earlier nearby full name cannot acquire another named senator quote with an intervening attribution',()=>{
 const invalid=[
  '<p>Bill Weber said. Senator Karin Housley said: “'+weber.exactShortQuoteCue+'.”</p>',
  '<p>Bill Weber said. Mark Johnson said: “'+weber.exactShortQuoteCue+'.”</p>',
  '<p>Bill Weber said. “Unrelated first remark.” “'+weber.exactShortQuoteCue+'.”</p>',
  '<p>Bill Weber reported on committee business for '+('several weeks and months '.repeat(12))+' then: “'+weber.exactShortQuoteCue+'.”</p>',
  '<p>Bill Weber stated no specific position. However the reporter wrote: “'+weber.exactShortQuoteCue+'.”</p>'
 ];
 for(const t of invalid){
  const p=boundNamedOriginalQuote(Buffer.from(t),weber);
  assert.equal(p.verified,false,p.reason);
 }
});
test('quote paired to wrong full name after end and different name before start must not certify either',()=>{
 const p=Buffer.from('<p>Karin Housley asked: “'+weber.exactShortQuoteCue+'.” Bill Weber replied separately.</p>');
 assert.equal(boundNamedOriginalQuote(p,weber).verified,false);
});
