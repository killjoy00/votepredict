import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {base32Sha1Archive} from '../scripts/acquire-senate-2022-ever-served-campaign-originals.js';
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {
 kupecExactIssueCdxQuery,kupecExact2022IssueCandidates,acquireKupec2022OriginalIssuePages,
} from '../scripts/acquire-senate-kupec-2022-original-issues.js';
const original='https://www.kupec4mnsenate.com/issues';
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const html=Buffer.from('<html><body><h1>Only a synthetic 2022 Senator Kupec platform test page</h1></body></html>');
const row=(stamp:string,url=original,bytes=html)=>[
 stamp,url,'text/html','200',base32Sha1Archive(bytes),String(bytes.length),
];
function served():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:'https://www.lrl.mn.gov/legdb/senate_dir',
   observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'d'.repeat(64),sourceBytesLength:1601232,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true},
  senators:[{
   officialName:'Robert Kupec',officialNameRaw:'Kupec, Robert - "Rob"',
   officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
   senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'4'}],
  }],
 };
}
test('allow three exact archived 2022 original issues URL variants only for the served senator',()=>{
 const urls=[
  original,'http://www.kupec4mnsenate.com/issues',
  'https://www.kupec4mnsenate.com/issues/',
 ];
 for(const url of urls){
  const q=kupecExactIssueCdxQuery(url),parameters=new URL(q).searchParams;
  assert.equal(parameters.get('url'),url);
  assert.equal(parameters.get('from'),'20220101');
  assert.equal(parameters.get('to'),'20221107');
  assert.equal(parameters.get('limit'),'100');
  assert.equal(parameters.get('filter'),'statuscode:200');
 }
 assert.throws(()=>kupecExactIssueCdxQuery('https://localhost/private'),/only old|Only old/);
 assert.throws(()=>kupecExactIssueCdxQuery('https://www.kupec4mnsenate.com/event-details/America/issues'),/only old|Only old/);
});
test('actual 2022 senator issues index rows are date-limited and never cross candidate/domain or Wix pseudopage',()=>{
 const payload=[header,
  row('20221005200000',original),
  row('20221108200000',original),
  row('20221007151111','https://opponent.example/issues'),
  row('20221008151111','https://www.kupec4mnsenate.com/event-details/America/issues'),
  row('20211229151111',original),
 ];
 const accepted=kupecExact2022IssueCandidates(payload);
 assert.equal(accepted.exactIssueRows,1);
 assert.equal(accepted.historicalRows[0].capturedAt,'2022-10-05T20:00:00.000Z');
 assert.equal(accepted.indexAtCapacity,false);
 assert.equal(accepted.rawIndexRows,5);
});
test('empty official archive index [] means bounded 0 recovered captures, not issue position absent',()=>{
 const r=kupecExact2022IssueCandidates([]);
 assert.equal(r.rawIndexRows,0);
 assert.equal(r.exactIssueRows,0);
 assert.equal(r.indexAtCapacity,false);
});
test('positive historical original archived issue body requires exact CDX index digest; response different bytes must not be certified',async()=>{
 const parent=mkdtempSync(join(tmpdir(),'kupec-senator-exact-original-'));
 try{
  const capture='20221005200000';
  const q=kupecExactIssueCdxQuery(original);
  const url='https://web.archive.org/web/'+capture+'id_/'+original;
  const fake=async(target:string|URL|Request):Promise<Response>=>{
    if(String(target).startsWith('https://web.archive.org/cdx/search/cdx?')){
      const path=new URL(String(target)).searchParams.get('url');
      return new Response(JSON.stringify(path===original?[header,row(capture)]:[]),
        {status:200,headers:{'content-type':'application/json'}});
    }
    if(String(target)===url)
      return new Response(html,{status:200,headers:{'content-type':'text/html'}});
    throw Error('Unexpected public archive GET '+target);
  };
  const results=await acquireKupec2022OriginalIssuePages(join(parent,'out'),served(),fake as typeof fetch);
  assert.equal(results.stats.memberPeopleVerified,1);
  assert.equal(results.stats.exactPathIndexQueries,3);
  assert.equal(results.stats.sourceIndexesHttp200,3);
  assert.equal(results.stats.bounded2022IssueOriginalIndexRows,1);
  assert.equal(results.stats.originalArchivedIssuePagesActuallyFetched,1);
  assert.equal(results.stats.independentOriginalIssueHTMLMatchedHistoricalIndex,1);
  assert.equal(results.stats.evidenceOrForecastMutations,0);
  const proof=results.archivedReplayAttempts[0];
  assert.equal(proof.originalCaptureAtUtc,'2022-10-05T20:00:00.000Z');
  assert.ok(proof.sourceActuallyFetchedAtUtc.startsWith('2026-'));
  assert.equal(proof.originalSiteAuthorPostedAt,null);
  assert.equal(proof.senatorPositionPublicByCertifiedForSpecificExcerpt,false);
  assert.ok(readFileSync(join(parent,'out','kupec-2022-authenticated-issues-'+capture+'-0.html')).equals(html));
  assert.equal(statSync(join(parent,'out','acquisition-manifest.json')).mode&0o777,0o600);
  assert.ok(readdirSync(join(parent,'out')).length>=3);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
test('mismatched archive HTML never certifies source original date even when Wayback replay reports HTTP 200',async()=>{
 const parent=mkdtempSync(join(tmpdir(),'kupec-senator-mismatched-'));
 try{
  const fake=async(target:string|URL|Request):Promise<Response>=>{
   if(String(target).startsWith('https://web.archive.org/cdx/search/cdx?')){
    const path=new URL(String(target)).searchParams.get('url');
    return new Response(JSON.stringify(path===original?[header,row('20221005200000')]:[]),
     {status:200,headers:{'content-type':'application/json'}});
   }
   return new Response('<html><p>edited later content, unverified</p></html>',{
    status:200,headers:{'content-type':'text/html'},
   });
  };
  const r=await acquireKupec2022OriginalIssuePages(join(parent,'out'),served(),fake as typeof fetch);
  assert.equal(r.stats.independentOriginalIssueHTMLMatchedHistoricalIndex,0);
  assert.equal(r.archivedReplayAttempts[0].originalHtmlSha256,null);
  assert.equal(r.archivedReplayAttempts[0].savedOriginalHtmlFile,null);
  assert.equal(r.archivedReplayAttempts[0].candidateAuthoredIssuePassageReviewed,false);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
test('without independent official actual 2023 Senate service there are NO attempted source network requests',async()=>{
 const parent=mkdtempSync(join(tmpdir(),'kupec-senator-scope-'));
 try{
  const input=served();input.senators=[];
  let requests=0;
  const fake=async()=>{requests++;throw Error('Should not fetch');};
  await assert.rejects(()=>acquireKupec2022OriginalIssuePages(join(parent,'out'),
   input,fake as typeof fetch),/Original 2022 Senate identity/);
  assert.equal(requests,0);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
