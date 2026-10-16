/** #987/#946 bounded public Reformer dated path vs historical brief original alias source tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {BRIEF_GAP_VERSION,validateThreePublisherBriefCandidates,researchThreeMissingHistoricallyOriginalBriefs,
 type BriefQueue,type OriginalLead,
} from '../../src/evidence/senate-media-three-missing-newsroom-brief-original-audit.js';
const read=(s:string)=>JSON.parse(readFileSync('docs/evaluation/'+s,'utf8')) as any;
const q=read('senate-media-three-unverified-reformer-brief-original-archive-hypotheses-20261011.json') as BriefQueue;
const d=read('senate-media-2021-25-further-independent-reporting-15-leads.json');
const leads=d.independentOriginalReporterArticleLeads as OriginalLead[];
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(bytes:Uint8Array){
 let val=0,bits=0,out='';
 for(const k of bytes){val=(val<<8)|k;bits+=8;while(bits>=5){bits-=5;out+=B32[(val>>>bits)&31];}val&=(1<<bits)-1;}
 if(bits)out+=B32[(val<<(5-bits))&31];return out;
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
function htmlFor(original:string){
 const x=q.sourcePairs.find(y=>y.proposedAlternativeOriginalBriefUrl===original
  ||y.indexedPreviouslyUnavailableDatedUrl===original)!;
 return '<html><head><link rel="canonical" href="'+x.proposedAlternativeOriginalBriefUrl+'"></head>'+
 '<body><article>'+x.memberQuoteShortCues.map(c=>
  '<p>Senator '+c.memberName+' said: “'+c.shortCurrentPublisherReporterCue+'”; this is original web text not audio or a roll call.</p>').join('')+'</article></body></html>';
}
const stub=(f:(u:string,i:RequestInit)=>Response|Promise<Response>):typeof fetch=>
 (async(u:string|URL|Request,i?:RequestInit)=>f(String(u),i??{})) as typeof fetch;
function fake(mode:'briefs_only'|'all_unavailable'|'empty'|'changed_body'|'both'):typeof fetch{
 return stub((url,init)=>{
  assert.equal(init.method,'GET');
  assert.equal(init.redirect,'manual');assert.ok(init.signal);
  const u=new URL(url);
  if(u.pathname==='/cdx/search/cdx'){
   assert.equal(u.searchParams.get('matchType'),'exact');
   assert.equal(u.searchParams.get('from'),'2021');assert.equal(u.searchParams.get('to'),'2025');
   assert.equal(u.searchParams.get('limit'),'20');
   assert.equal(u.searchParams.get('filter'),'statuscode:200');
   const original=u.searchParams.get('url')!;
   assert.ok(q.sourcePairs.some(x=>
    x.proposedAlternativeOriginalBriefUrl===original||x.indexedPreviouslyUnavailableDatedUrl===original));
   if(mode==='all_unavailable'||(mode!=='both'&&!original.includes('/briefs/')))
    return new Response('CDX unavailable',{status:503,headers:{'content-type':'text/plain'}});
   if(mode==='empty')return new Response(JSON.stringify([header]),{headers:{'content-type':'application/json'}});
   const body=htmlFor(original),digest=b32(createHash('sha1').update(body).digest());
   const t=original.includes('commissioners')?'20210703120000':
    original.includes('no-special')?'20220618120000':'20250507120000';
   const s=t.slice(0,-2)+'01';
   return new Response(JSON.stringify([header,
    [t,original,'text/html','200',digest,String(Buffer.byteLength(body))],
    [s,original,'text/html','200',digest,String(Buffer.byteLength(body))]]),
    {headers:{'content-type':'application/json'}});
  }
  assert.match(url,/^https:\/\/web\.archive\.org\/web\/20\d{12}id_\/https:\/\/minnesotareformer\.com\//);
  const original=url.split('id_/')[1]!;
  const html=htmlFor(original);
  return new Response(mode==='changed_body'?html.replace('original web text','changed counterfeit text'):html,
   {headers:{'content-type':'text/html'}});
 });
}
test('three exact original previously unverified dated news URLs plus separate publisher /briefs/ path hypotheses',()=>{
 const pairs=validateThreePublisherBriefCandidates(q,leads);
 assert.equal(pairs.length,3);
 assert.deepEqual(pairs.map(x=>x.originalReporterArticleLeadId),[
  'new-reporter-2021-commissioners','new-reporter-2022-special-session','new-reporter-2025-sick-leave']);
 assert.deepEqual(pairs.map(x=>x.memberQuoteShortCues.map(s=>s.memberName)),[
  ['Michelle Benson','Susan Kent'],['Jeremy Miller'],['Grant Hauschild','Judy Seeberger','Jen McEwen']]);
 assert.equal(new Set(pairs.flatMap(x=>
  [x.indexedPreviouslyUnavailableDatedUrl,x.proposedAlternativeOriginalBriefUrl])).size,6);
 assert.equal(pairs[2]?.publisherSiblingArticleThatCrossLinksToBriefsUrl,
  'https://minnesotareformer.com/2025/05/09/labor-fights-to-preserve-recent-gains-at-minnesota-legislature-and-other-labor-news/');
 assert.equal(q.originalArticleExactAliasNotAssumedFromMatchingSlug,true);
 assert.equal(q.originalReporterTextOnlyNotOfficialRollCall,true);
});
test('synthetic historically indexed two original briefs captures per URL SHA1-authenticate but current dated paths remain UNKNOWN and never auto-merge',async()=>{
 const result=await researchThreeMissingHistoricallyOriginalBriefs(q,leads,fake('briefs_only'));
 assert.equal(result.version,BRIEF_GAP_VERSION);
 assert.equal(result.originallyUnknownJournalistArticleUrlLeads,3);
 assert.equal(result.separatelyNamedCurrentPublisherServingSenatorSpeechCandidates,6);
 assert.equal(result.originalPublisherUrlVariantsIndividuallyIndexed,6);
 assert.equal(result.sourceUrlVariantsWithCdxOriginalCandidates,3);
 assert.equal(result.cdxIndexUnknownOriginalUrlVariants,3);
 assert.equal(result.originalRawHttpReplaysAttempted,6);
 assert.equal(result.originalIndexedSha1ConsistentHtmlBodiesFound,6);
 assert.equal(result.originalPublisherUrlVariantsWithAtLeastOneVerifiedHistoricOriginal,3);
 assert.equal(result.briefCandidatesWithSomeAuthenticatedOriginalPublisherBody,3);
 assert.equal(result.briefCandidatesWithAllShortNamedSenatorTextCuesInAnAuthenticBody,3);
 assert.equal(result.datedSourceAndBriefBothAuthenticatedHistoricalPaths,0);
 assert.equal(result.headlineOrSlugOnlyAutomaticAliasesApproved,0);
 for(const row of result.sourcePairResults){
  assert.equal(row.historicallyUnverifiedDatedUrl.cdxStatus,'index_unavailable_unknown');
  assert.equal(row.publisherBriefsOriginalPathHypothesis.cdxStatus,'indexed_candidates');
  assert.equal(row.publisherBriefsOriginalPathHypothesis.originalHttpSha1MatchedVersionCount,2);
  assert.equal(row.sameOriginalArticleIdentityProvenAcrossBothHistoricalPaths,false);
  assert.equal(row.automaticNewsArticleDeduplications,0);
  assert.ok(row.publisherBriefsOriginalPathHypothesis.allHistoricalOriginalBodyVersions.every(x=>
   x.replayStatus==='actual_original_indexed_sha1_verified'
   &&x.originalObservedRawSha256?.length===64
   &&x.observedHistoricalCanonicalUrlIfAllowedPair===row.publisherBriefsOriginalPathHypothesis.originalPublisherUrl
   &&x.historicalOriginalContainsAllNamedReporterFragments===true
   &&x.fragmentProofs.every(p=>
    p.currentReporterShortCuePresentInHistoricalOriginal
    &&p.nameFoundSameHistoricParagraph
    &&p.originalSpokenAudioNotAuthenticated
    &&p.individualRecordedVoteNotProven
    &&p.entireQuotedSentenceNotHumanApproved)));
 }
 assert.equal(result.noActualRecordedSenateMemberVotesAuthenticated,true);
 assert.equal(result.noFullVerbatimIndividualSenatorQuotesHumanApproved,true);
 assert.equal(JSON.stringify(result).includes('<article>'),false);
});
test('CDX unavailable or valid CDX empty is UNKNOWN historic article coverage and zero duplicates',async()=>{
 const unavailable=await researchThreeMissingHistoricallyOriginalBriefs(q,leads,fake('all_unavailable'));
 assert.equal(unavailable.cdxIndexUnknownOriginalUrlVariants,6);
 assert.equal(unavailable.originalRawHttpReplaysAttempted,0);
 assert.equal(unavailable.originalIndexedSha1ConsistentHtmlBodiesFound,0);
 assert.equal(unavailable.headlineOrSlugOnlyAutomaticAliasesApproved,0);
 const empty=await researchThreeMissingHistoricallyOriginalBriefs(q,leads,stub((url,init)=>{
  assert.equal(init.method,'GET');
  assert.ok(url.includes('/cdx/search/cdx?'));
  return new Response(JSON.stringify([header]),{headers:{'content-type':'application/json'}});
 }));
 assert.equal(empty.cdxIndexEmptyOriginalUrlVariants,6);
 assert.equal(empty.originalRawHttpReplaysAttempted,0);
});
test('bad historical original raw body rejects all quote snippets and never manufactures alias identity',async()=>{
 const output=await researchThreeMissingHistoricallyOriginalBriefs(q,leads,fake('changed_body'));
 assert.equal(output.sourceUrlVariantsWithCdxOriginalCandidates,3);
 assert.equal(output.originalIndexedSha1ConsistentHtmlBodiesFound,0);
 assert.equal(output.briefCandidatesWithSomeAuthenticatedOriginalPublisherBody,0);
 assert.equal(output.headlineOrSlugOnlyAutomaticAliasesApproved,0);
 for(const row of output.sourcePairResults){
  assert.ok(row.publisherBriefsOriginalPathHypothesis.allHistoricalOriginalBodyVersions.every(x=>
   x.replayStatus==='archive_raw_sha1_mismatch_unknown'
   &&x.originalObservedRawSha256===null
   &&x.fragmentProofs.every(p=>p.currentReporterShortCuePresentInHistoricalOriginal===null)));
 }
});
test('even if both original URL variants have identical authenticated HTML, historic alias identity remains unapproved',async()=>{
 const output=await researchThreeMissingHistoricallyOriginalBriefs(q,leads,fake('both'));
 assert.equal(output.datedSourceAndBriefBothAuthenticatedHistoricalPaths,3);
 assert.equal(output.originalPublisherUrlVariantsWithAtLeastOneVerifiedHistoricOriginal,6);
 assert.equal(output.originalIndexedSha1ConsistentHtmlBodiesFound,12);
 assert.equal(output.headlineOrSlugOnlyAutomaticAliasesApproved,0);
 assert.ok(output.sourcePairResults.every(x=>!x.sameOriginalArticleIdentityProvenAcrossBothHistoricalPaths));
});
test('forged speaker, wrong historical brief path, approved quote flag and fake publisher linked proof fail BEFORE network',async()=>{
 const bad=[
  {...q,sourcePairs:q.sourcePairs.map((p,i)=>i===0?{...p,memberQuoteShortCues:[
   {...p.memberQuoteShortCues[0]!,memberName:'Paul Gazelka'},p.memberQuoteShortCues[1]!]}:p)},
  {...q,sourcePairs:q.sourcePairs.map((p,i)=>i===1?{...p,
   proposedAlternativeOriginalBriefUrl:'https://minnesotareformer.com/briefs/different-story/'}:p)},
  {...q,sourcePairs:q.sourcePairs.map((p,i)=>i===2?{...p,
   memberQuoteShortCues:p.memberQuoteShortCues.map((c,k)=>k===0?{...c,recordedVoteProven:true as false}:c)}:p)},
  {...q,sourcePairs:q.sourcePairs.map((p,i)=>i===2?{...p,publisherSiblingArticleThatCrossLinksToBriefsUrl:
   'https://example.org/malicious'}:p)},
 ];
 for(const x of bad){
  let network=0;
  await assert.rejects(researchThreeMissingHistoricallyOriginalBriefs(x,leads,stub(()=>{
   network++;throw Error('unsafe');})));
  assert.equal(network,0);
 }
});
