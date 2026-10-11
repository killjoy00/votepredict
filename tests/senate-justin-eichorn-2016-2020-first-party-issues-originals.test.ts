import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import lead from '../data/evaluation/senate-justin-eichorn-2016-2020-original-issues-historical-archive-target-v1.json' with {type:'json'};
import {
 EICHORN_HISTORICAL_FIRST_PARTY_ISSUES_ARCHIVE_VERSION,
 verifyEichornFullOriginalSourcesBeforeArchiveNetwork,
 exactEichornOriginalIssuesCDXRequests,
 parseExactEichornIssuesArchiveIndex,
 selectEichornOriginalIssuesPages,
 acquireAuthenticEichornHistoricalOriginalIssuesPages,
} from '../scripts/acquire-justin-eichorn-2016-2020-first-party-issues-originals.js';
import type {AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function actual():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',sourceBytesSha256:SHA,
   sourceBytesLength:1601232,directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[{officialName:'Justin D. Eichorn',officialNameRaw:'Eichorn, Justin D.',
   officialSourceUrl:GOV,senateServiceTerms:[{startsYear:2017,endsYear:2025,district:'5'}]}],
 };
}
const hdr=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(ts:string,url:string)=>[ts,url,'text/html','200','A'.repeat(32),'4000'];
test('a dated October 20 2020 publisher links the candidate site, but this never proves first-party original HTML text',()=>{
 assert.match(EICHORN_HISTORICAL_FIRST_PARTY_ISSUES_ARCHIVE_VERSION,/2016-through-2020/);
 assert.equal(lead.source.datedPublisher,'Minnesota Reformer');
 assert.equal(lead.source.datedPublisherPublication,'2020-10-20');
 assert.equal(lead.source.datedPublisherLinkedFirstPartyIssues,'https://www.justinformnsenate.com/issues');
 assert.equal(lead.scope.publisher2020QuotationNotIdenticalWithOriginalSiteHTML,true);
 assert.equal(lead.scope.archivedJavascriptShellContainsNoPolicyText,true);
 assert.equal(lead.scope.sourceAcquisitionAddsPolicyStatements,0);
 assert.equal(lead.scope.productionDatabaseEvidenceModelForecastSchedulerChanges,0);
 assert.equal(lead.source.original2020HomeSHA256,'e1cf0bad13e365607f802de2e881ad8f45773aea308b368fc3e1878e641b3424');
 assert.equal(lead.source.original2020HomeCDXSHA1,'O5XRMF3E73RCZZMMUGUEMEVGLACMJJY4');
});
test('exact eight historical first-party /issues and /issues/ URL variants 2016 through Nov 2 2020 only',()=>{
 const qs=exactEichornOriginalIssuesCDXRequests();
 assert.equal(qs.length,8);
 assert.equal(new Set(qs).size,8);
 for(const [i,x] of qs.entries()){
  const url=new URL(x);
  assert.equal(url.hostname,'web.archive.org');
  assert.equal(url.protocol,'https:');
  assert.equal(url.pathname,'/cdx/search/cdx');
  assert.equal(url.searchParams.get('url'),lead.exactIssuesOriginalURLTargets[i]);
  assert.equal(url.searchParams.get('matchType'),'exact');
  assert.equal(url.searchParams.get('from'),'20160101');
  assert.equal(url.searchParams.get('to'),'20201102');
  assert.equal(url.searchParams.get('limit'),'220');
 }
});
test('original index rows must match historical 2020-or-earlier authenticated first-party issue route and full CDX bounds',()=>{
 const parsed=parseExactEichornIssuesArchiveIndex([hdr,
  row('20160813091522','https://www.justinformnsenate.com/issues'),
  row('20200905171522','http://justinformnsenate.com/issues/'),
  row('20201109091522','https://www.justinformnsenate.com/issues'),
  row('20150713091522','https://www.justinformnsenate.com/issues'),
  row('20200905171522','https://www.justinformnsenate.com/issues?q=x'),
  row('20160813091522','https://eichorn.example/issues'),
  row('20160813091522','https://justinformnsenate.com/'),
 ]);
 assert.equal(parsed.eligible.length,2);
 assert.equal(parsed.indexRows,7);
 assert.equal(selectEichornOriginalIssuesPages(parsed.eligible).length,2);
 assert.deepEqual(parseExactEichornIssuesArchiveIndex([]),{
  eligible:[],indexRows:0,reachedCap:false,
 });
 assert.throws(()=>parseExactEichornIssuesArchiveIndex([['foo']]),/Original bounded/);
 const overflow=[hdr,...Array.from({length:221},()=>row('20160813091522','https://www.justinformnsenate.com/issues'))];
 assert.throws(()=>parseExactEichornIssuesArchiveIndex(overflow),/Original bounded/);
});
test('actual Senate 2021 service or genuine original 2020 candidate home must be proven before any archived network queries',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'eichorn-original-issues-negative-'));
 try{
  let count=0;
  const fail=(async()=>{count++;throw Error('No network permitted');}) as typeof fetch;
  const fake=actual();fake.senators.length=0;
  const dest=join(temp,'untrusted');
  await assert.rejects(()=>acquireAuthenticEichornHistoricalOriginalIssuesPages(
   dest,fake,new Uint8Array(3578),fail),/not independently documented actually-serving/);
  assert.equal(count,0);
  assert.equal(existsSync(dest),false);
  assert.throws(()=>verifyEichornFullOriginalSourcesBeforeArchiveNetwork(
   actual(),new Uint8Array(3578)),/Original 2020 Justin Eichorn first-party website complete SHA\/CDX/);
  assert.equal(count,0);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('standalone 2016–2020 source-only runner cannot fabricate findings without complete original independent government+2020 candidate site bytes',()=>{
 const temp=mkdtempSync(join(tmpdir(),'eichorn-2020-refuse-'));
 try{
  const dst=join(temp,'no-fake-proof');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/run-justin-eichorn-2016-2020-first-party-issues-originals.ts',
   '--output-dir',dst,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(dst),false);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
