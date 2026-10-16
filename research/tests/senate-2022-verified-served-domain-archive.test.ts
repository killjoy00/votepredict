import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
import {base32Sha1Archive} from '../../scripts/acquire-senate-2022-ever-served-campaign-originals.js';
import {
 senatorOnlyDomain2022Targets,
 historicalSenatorDomainCdxUrl,
 senatorDomainPreGeneral2022Cdx,
} from '../../src/evidence/senate-2022-verified-served-domain-archive.js';
import {acquire2022ServedSenatorDomainHistoricalPages}
 from '../../scripts/acquire-senate-2022-served-domain-wide-pages.js';

const OBSERVED='2026-10-11T00:15:00.000Z';
function official():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',observedAt:OBSERVED,
   sourceBytesSha256:'e'.repeat(64),sourceBytesLength:300001,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Nicole L. Mitchell',officialNameRaw:'Mitchell, Nicole L.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2025,district:'47'}]},
   {officialName:'Robert Kupec',officialNameRaw:'Kupec, Robert - "Rob"',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'4'}]},
   {officialName:'Michael E. Kreun',officialNameRaw:'Kreun, Michael E.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'32'}]},
  ],
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const pageA=Buffer.from('<html><body><main>ONLY A SYNTHETIC 2022 SENATE CAMPAIGN PAGE FIXTURE</main></body></html>');
const pageB=Buffer.from('<html><body><main>ANOTHER SYNTHETIC 2022 SENATE CAMPAIGN PAGE FIXTURE</main></body></html>');
function row(t:string,url:string,body=pageA,code='200'){
 return[t,url,'text/html',code,base32Sha1Archive(body),String(body.byteLength)];
}
test('all three 2022 domain-based archive targets must have separately documented actual MN Senate service',()=>{
 const members=senatorOnlyDomain2022Targets(official());
 assert.equal(members.length,3);
 assert.deepEqual(members.map(x=>x.candidateName),['Nicole Mitchell','Rob Kupec','Michael Kreun']);
 assert.ok(members.every(x=>x.officialIdentityProvenFromOriginalLRLBytes));
 assert.ok(members.every(x=>x.officialLRLServiceTerm?.includes('SD')));
 const absent=official();absent.senators=absent.senators.slice(0,2);
 assert.throws(()=>senatorOnlyDomain2022Targets(absent),/actually-serving Senator/);
 const wrong=official();wrong.senators[1].senateServiceTerms[0].district='9';
 assert.throws(()=>senatorOnlyDomain2022Targets(wrong),/actually-serving Senator/);
});
test('host-wide Wayback query is bounded to pre-general 2022 and only approved served-senator domains',()=>{
 const url=historicalSenatorDomainCdxUrl('nicolemitchell.org');
 const params=new URL(url).searchParams;
 assert.equal(new URL(url).hostname,'web.archive.org');
 assert.equal(params.get('matchType'),'domain');
 assert.equal(params.get('from'),'20220101');
 assert.equal(params.get('to'),'20221107');
 assert.equal(params.get('limit'),'300');
 assert.equal(params.get('filter'),'statuscode:200');
 assert.throws(()=>historicalSenatorDomainCdxUrl('unapproved.example'),/Unknown/);
});
test('domain-wide filter cannot smuggle other hosts, admin, cross-election, querystring, or unverified digest as Senator evidence',()=>{
 const input=[header,
  row('20221005131415','http://www.nicolemitchell.org/issues/'),
  row('20221006131415','https://nicolemitchell.org/platform/',pageB),
  row('20221007131415','https://other-person.example/issues/'),
  row('20221108131415','https://nicolemitchell.org/issues/'),
  row('20211231131415','https://nicolemitchell.org/issues/'),
  row('20221008131415','https://nicolemitchell.org/wp-admin/'),
  row('20221009131415','https://nicolemitchell.org/issues/?secret=123'),
  row('20221010131415','https://nicolemitchell.org/style.css'),
 ];
 const r=senatorDomainPreGeneral2022Cdx('nicolemitchell.org',input);
 assert.equal(r.rankedCandidateRows.length,2);
 assert.equal(r.selectedOriginalReplays.length,2);
 assert.equal(r.rawCdxResultRows,8);
 assert.ok(r.rankedCandidateRows.every(x=>x.candidateName==='Nicole Mitchell'
  &&x.senateDistrict==='47'&&!x.historicCandidateIssueStanceCertified));
 assert.equal(r.returnedIndexAtCapacity,false);
});
test('two versions of one URL and an issue-specific alternative are prioritized, but capped to three pages per senator',()=>{
 const url='http://kupec4mnsenate.com/issues/';
 const input=[header,
  row('20220901000000','http://kupec4mnsenate.com/random/'),
  row('20221001000000',url),
  row('20221005000000',url,pageB),
  row('20221006000000','http://kupec4mnsenate.com/about/'),
  row('20221007000000','http://kupec4mnsenate.com/'),
 ];
 const result=senatorDomainPreGeneral2022Cdx('kupec4mnsenate.com',input);
 assert.equal(result.rankedCandidateRows.length,5);
 assert.equal(result.selectedOriginalReplays.length,3);
 assert.equal(result.selectedOriginalReplays[0].capturedAt,'2022-10-01T00:00:00.000Z');
 assert.equal(result.selectedOriginalReplays[1].capturedAt,'2022-10-05T00:00:00.000Z');
 assert.equal(result.selectedOriginalReplays[2].capturedAt,'2022-10-07T00:00:00.000Z');
});
test('actual historic top-level campaign homepage outranks malformed nested Wix event 404 path with misleading /issues suffix',()=>{
 const data=[header,
  row('20221031012735','https://www.kupec4mnsenate.com/event-details/America/issues'),
  row('20221101012735','https://www.kupec4mnsenate.com/event-details/America/America/issues',pageB),
  row('20220703215005','https://www.kupec4mnsenate.com/'),
  row('20220805050816','https://www.kupec4mnsenate.com/about'),
 ];
 const r=senatorDomainPreGeneral2022Cdx('kupec4mnsenate.com',data);
 assert.equal(r.selectedOriginalReplays[0].original,'https://www.kupec4mnsenate.com/');
 assert.equal(r.selectedOriginalReplays[1].original,'https://www.kupec4mnsenate.com/about');
 assert.ok(r.selectedOriginalReplays.every(x=>!x.original.includes('/America/')));
});
test('a real HTTP 200 Wayback domain index [] is a bounded zero, not a parse failure or website-absence finding',()=>{
 const r=senatorDomainPreGeneral2022Cdx('michaelformnsenate.com',[]);
 assert.equal(r.rawCdxResultRows,0);
 assert.equal(r.rankedCandidateRows.length,0);
 assert.equal(r.selectedOriginalReplays.length,0);
 assert.equal(r.returnedIndexAtCapacity,false);
});
test('hard bound on broad index results records completeness gap; cannot treat index 503 or truncated pages as absence',()=>{
 const cap=[header,...Array.from({length:300},(_,i)=>row(
  '20221001120203','https://michaelformnsenate.com/page'+i))];
 const x=senatorDomainPreGeneral2022Cdx('michaelformnsenate.com',cap);
 assert.equal(x.returnedIndexAtCapacity,true);
 assert.equal(x.rankedCandidateRows.length,300);
 assert.equal(x.selectedOriginalReplays.length,3);
 assert.throws(()=>senatorDomainPreGeneral2022Cdx('michaelformnsenate.com',
  [...cap,row('20221001140203','https://michaelformnsenate.com/extra/')]),
  /exceeded 300-row/);
});
test('real candidate-site original HTML is dated 2022 ONLY when HTTP 200 bytes SHA-1 match independently acquired CDX digest',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-2022-broad-archive-'));
 try{
  const url1='https://nicolemitchell.org/issues/';
  const url2='http://www.kupec4mnsenate.com/platform/';
  const a1='20221005131415',a2='20221006131415';
  let requests=0;
  const mock=async(url:string|URL|Request):Promise<Response>=>{
   requests++;
   const u=String(url);
   if(u.startsWith('https://web.archive.org/cdx/search/cdx?')){
    const domain=new URL(u).searchParams.get('url');
    if(domain==='nicolemitchell.org')return new Response(
      JSON.stringify([header,row(a1,url1,pageA)]),{status:200,headers:{'content-type':'application/json'}});
    if(domain==='kupec4mnsenate.com')return new Response(
      JSON.stringify([header,row(a2,url2,pageB)]),{status:200,headers:{'content-type':'application/json'}});
    return new Response('temporarily unavailable',{status:503});
   }
   if(u==='https://web.archive.org/web/'+a1+'id_/'+url1)return new Response(pageA,
     {status:200,headers:{'content-type':'text/html'}});
   if(u==='https://web.archive.org/web/'+a2+'id_/'+url2)return new Response(
     '<html><body>This is a later redacted page, not 2022 source</body></html>',
     {status:200,headers:{'content-type':'text/html'}});
   throw Error('Unapproved mock URL '+u);
  };
  const acquired=await acquire2022ServedSenatorDomainHistoricalPages(join(dir,'archive'),
   official(),mock as typeof fetch);
  assert.equal(requests,5);
  assert.equal(acquired.totals.verifiedServedSenatorsWithQueriedDomains,3);
  assert.equal(acquired.totals.indexQueriesHttp200,2);
  assert.equal(acquired.totals.parsed2022DomainIndexCandidateRows,2);
  assert.equal(acquired.totals.attemptedOriginalWaybackReplays,2);
  assert.equal(acquired.totals.originalHistoricalPageBodiesIndependentlyDigestVerified,1);
  assert.equal(acquired.totals.distinctSenatorsWithVerifiedOriginal2022Page,1);
  assert.equal(acquired.totals.candidateOwnedPolicyExcerptsHistoricallyVerifiedByHuman,0);
  assert.equal(acquired.totals.nonSenatorsPublishedInSenatorCoverage,0);
  assert.equal(acquired.totals.productionEvidenceOrForecastAdmissions,0);
  const nicole=acquired.persons[0],rob=acquired.persons[1],kreun=acquired.persons[2];
  assert.equal(nicole.earliestHistoricalOriginalPageAttestedByUtc,'2022-10-05T13:14:15.000Z');
  assert.equal(rob.earliestHistoricalOriginalPageAttestedByUtc,null);
  assert.equal(kreun.historicalDomainIndexRequest.status,503);
  assert.equal(kreun.acceptedSameDomain2022OriginalIndexCandidateRows,null);
  assert.equal(rob.originalPageBodiesWithDigestVerified,0);
  assert.equal(rob.selectedUpToThreeOriginalPageReplays[0].originalPageBytesSaved,null);
  assert.equal(nicole.selectedUpToThreeOriginalPageReplays[0].authorFirstPublishedOn,null);
  assert.equal(nicole.selectedUpToThreeOriginalPageReplays[0].humanCheckedCampaignIssuePolicyText,false);
  assert.ok(nicole.historicalDomainIndexRequest.observedAtUtc.startsWith('2026-'));
  assert.ok(readFileSync(join(dir,'archive','mitchell-historical-'+a1+'-0.html')).equals(pageA));
  assert.equal(statSync(join(dir,'archive','acquisition-manifest.json')).mode&0o777,0o600);
  assert.ok(readdirSync(join(dir,'archive')).length>=4);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('no confirmed service means no network calls, no archive directory and no public mention of never-served candidate',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-2022-service-gated-'));
 try{
  const bad=official();bad.senators.pop();
  let calls=0;
  const mock=async()=>{calls++;throw Error('Should never contact public sites');};
  const out=join(dir,'archive');
  await assert.rejects(()=>acquire2022ServedSenatorDomainHistoricalPages(out,bad,mock as typeof fetch),
    /actually-serving Senator/);
  assert.equal(calls,0);
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
