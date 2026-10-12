import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha1Base32} from '../scripts/probe-senate-864-substantive-new-originals.mjs';
import {validate,originalSignedJointEvidence,probe,run}
 from '../scripts/probe-senate-864-bakk-tomassoni-2021-line3-joint-originals.mjs';
const m=JSON.parse(readFileSync('data/evaluation/senate-864-bakk-tomassoni-2021-line3-signed-original-joint-leads-v1.json','utf8'));
const a=m.sourceHtmlUrls[0],time='20210905000000';
const pre='<html><body>'+'<p>Original legislative joint source background and full release metadata.</p>'.repeat(30);
const body=Buffer.from(pre+
'<p>Today more than 60 Minnesota legislators released the following joint statement:</p>'+
'<p>“Line 3 will provide economic benefits and jobs, the permits are issued, the lawsuits are settled, it is time to complete the work.</p>'+
'<p>“We encourage everyone to allow the project to keep moving forward without interruption until it is finished.”</p>'+
'<p>Acting Majority Leader Mark Johnson</p><p>Senator Tom Bakk</p><p>Senator David Tomassoni</p>'+
'<p>Senator Michelle Benson</p></body></html>');
const hd=['timestamp','original','mimetype','statuscode','digest','length'];
const index=[hd,[time,a.url,'text/html','200',sha1Base32(body),String(body.length)]];
const mock=(opts={})=>async url=>String(url).includes('/cdx/search/cdx')?
 new Response(opts.badIndex?'invalid archive':JSON.stringify(opts.index||index),{status:opts.status||200,headers:{'content-type':'application/json'}}):
 new Response(opts.bytes||body,{status:200,headers:{'content-type':'text/html'}});
test('actual Bakk and Tomassoni serving senator identities, distinct publisher copies, joint NOT solo quote',()=>{
 assert.equal(validate(m),true);
 assert.equal(m.bothSignatoriesNotTwoIndependentStatementEvents,true);
 assert.equal(m.cannotInferBillVersionOrPersonalSenateVote,true);
});
test('signature bound to actual 2021 Line3 original with both senators directly signed, but never solo speech',()=>{
 const q=originalSignedJointEvidence(body);
 assert.equal(q.authenticatedSignedJointDocumentForTwoNamedSenators,true);
 assert.deepEqual(q.signaturesAfterTheQuotedJointStatement,[true,true]);
 assert.equal(q.senatorSpeakerMode,'joint_signatory_NOT_solo_personal_quote');
 assert.equal(q.candidateOwnedCampaignWebsiteCensusIncrement,0);
});
test('one signatory absent never becomes quote from that senator',()=>{
 const altered=Buffer.from(body.toString().replace('Senator David Tomassoni','Another senator'));
 const q=originalSignedJointEvidence(altered);
 assert.equal(q.authenticatedSignedJointDocumentForTwoNamedSenators,false);
 assert.deepEqual(q.signaturesAfterTheQuotedJointStatement,[true,false]);
});
test('names elsewhere on page before quote cannot imply they signed joint statement',()=>{
 const original=body.toString();
 const altered=Buffer.from('<h2>Senator Tom Bakk and Senator David Tomassoni attended meeting</h2>'+
  original.replace('Senator Tom Bakk</p><p>Senator David Tomassoni','Two legislators'));
 assert.equal(originalSignedJointEvidence(altered).authenticatedSignedJointDocumentForTwoNamedSenators,false);
});
test('verified original CDX SHA1 plus raw SHA256 names/quoted joint cues, latest by 2021 capture',async()=>{
 const q=await probe(a,mock());
 assert.equal(q.status,'SHA1_SHA256_ORIGINAL_AND_BOTH_NAMED_JOINT_SIGNERS_MATCH');
 assert.equal(q.originalPublicByUtc,'2021-09-05T00:00:00Z');
 assert.equal(q.verifiedWholeOriginalSha,true);
 assert.equal(q.verifiedJointSigners,true);
 assert.match(q.originalRawSha256,/^[0-9a-f]{64}$/);
 assert.equal(q.doesNotPromoteToIndividualPolicyQuoteOrVote,true);
});
test('archive digest mismatch or provider error remains UNKNOWN',async()=>{
 const a1=await probe(a,mock({bytes:Buffer.from(body.toString().replace('economic benefits','other outcomes'))}));
 assert.equal(a1.verifiedJointSigners,false);
 assert.equal(a1.status,'INDEX_EXISTS_ORIGINAL_BODY_MISMATCH_OR_MISSING_UNKNOWN');
 const a2=await probe(a,mock({status:503}));
 assert.equal(a2.status,'CDX_HTTP_503_UNKNOWN');
 const a3=await probe(a,mock({badIndex:true}));
 assert.equal(a3.status,'CDX_INDEX_INVALID_UNKNOWN');
});
test('repeated copied URL never credited as TWO distinct separately uttered senator stances',async()=>{
 const m2=structuredClone(m);
 m2.sourceHtmlUrls=[m2.sourceHtmlUrls[0]];
 assert.throws(()=>validate(m2));
 const results=await run(m,async()=>new Response('unavailable',{status:503}));
 assert.equal(results.originalUnderlyingJointPolicyStatementCount,0);
 assert.equal(results.signedServingSenatorNames.length,0);
});
