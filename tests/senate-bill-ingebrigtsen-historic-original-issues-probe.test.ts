import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import lead from '../data/evaluation/senate-bill-ingebrigtsen-historic-issue-page-2010-2020-original-archive-target-v1.json' with {type:'json'};
import {
 BILL_INGEBRIGTSEN_2010_2020_ORIGINAL_ISSUE_PAGE_ARCHIVE_PROBE_VERSION,
 verifyActualSenatorAnd2020CampaignHomeBeforeArchiveNetwork,
 buildBillIngebrigtsenHistoricalIssueIndexURLs,
 parseBillHistoricalExactIssuesCDX,
 selectBillIssueOriginalReplays,
 recoverBillIngebrigtsenHistoricExactIssuesPage,
} from '../scripts/acquire-bill-ingebrigtsen-historic-issues-page-original.js';
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir', SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function actualServing():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[{
   officialName:'Bill G. Ingebrigtsen',
   officialNameRaw:'Ingebrigtsen, Bill G.',
   officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2007,endsYear:2022,district:'8'}],
  }],
 };
}
const hdr=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(ts:string,url:string)=>[ts,url,'text/html','200','A'.repeat(32),'4500'];
test('candidate issues.php is literally linked in previously hash-authenticated actual 2020 original campaign homepage',()=>{
 assert.match(BILL_INGEBRIGTSEN_2010_2020_ORIGINAL_ISSUE_PAGE_ARCHIVE_PROBE_VERSION,/2010-through-2020/);
 assert.equal(lead.target.actuallyServedSenator,'Bill Ingebrigtsen');
 assert.equal(lead.target.exactCandidateOwnedIssuesPath,'/issues.php');
 assert.equal(lead.provenance.original2020CandidateHomeHTMLLiteralIssueLink,'href="issues.php"');
 assert.equal(lead.provenance.original2020CandidateHomeSha256,'263c155d0560953d418ad84506ef68b9dfe51a1172336da14abb4e5fc93e8a85');
 assert.equal(lead.provenance.original2020CandidateHomeCdxSha1Base32,'PAS6JCDM4S2BDVKVYADI4OVHX7QM7WRU');
 assert.equal(lead.scope.originalCDXIndexQueries,4);
 assert.equal(lead.scope.maxFullOriginalIssueHTMLReplays,6);
 assert.equal(lead.scope.productionDatabaseEvidenceModelForecastSchedulerChanges,0);
});
test('only four exact first-party issues.php Wayback CDX URLs, bounded 2010–2020',()=>{
 const urls=buildBillIngebrigtsenHistoricalIssueIndexURLs();
 assert.equal(urls.length,4);
 for(const [i,x] of urls.entries()){
  const u=new URL(x);
  assert.equal(u.origin,'https://web.archive.org');
  assert.equal(u.pathname,'/cdx/search/cdx');
  assert.equal(u.searchParams.get('url'),lead.target.indexQueryOriginals[i]);
  assert.equal(u.searchParams.get('matchType'),'exact');
  assert.equal(u.searchParams.get('from'),'20100101');
  assert.equal(u.searchParams.get('to'),'20201102');
  assert.equal(u.searchParams.get('limit'),'180');
 }
});
test('only original HTML CDX records with exact candidate-owned domain and issues.php path qualify',()=>{
 const r=parseBillHistoricalExactIssuesCDX([hdr,
  row('20161202030405','http://billforsenate.org/issues.php'),
  row('20201020121212','https://www.billforsenate.org/issues.php'),
  row('20201105123456','http://billforsenate.org/issues.php'),
  row('20090102030405','http://billforsenate.org/issues.php'),
  row('20161202030405','http://billforsenate.org/about.php'),
  row('20161202030405','http://billforsenate.org/issues.php?q=3'),
  row('20161202030405','http://malicious.example/issues.php'),
 ]);
 assert.equal(r.eligible.length,2);
 assert.equal(r.indexRawRows,7);
 assert.equal(selectBillIssueOriginalReplays(r.eligible).length,2);
 assert.deepEqual(parseBillHistoricalExactIssuesCDX([]),{
  eligible:[],indexRawRows:0,indexAtCap:false,
 });
 assert.throws(()=>parseBillHistoricalExactIssuesCDX([['invalid']]),/Missing\/unbounded/);
 assert.throws(()=>parseBillHistoricalExactIssuesCDX([
  hdr,...Array.from({length:181},()=>row('20160102030405','http://billforsenate.org/issues.php')),
 ]),/Missing\/unbounded/);
});
test('not actually served in 2021 or fake candidate home BLOCKS all archive network calls',async()=>{
 const d=mkdtempSync(join(tmpdir(),'bill-original-issues-negative-'));
 try{
  const out=join(d,'protected-source');
  const unqualified=actualServing();unqualified.senators.length=0;
  let calls=0;
  const net=(async()=>{calls++;throw Error('No requests allowed');}) as typeof fetch;
  await assert.rejects(()=>recoverBillIngebrigtsenHistoricExactIssuesPage(
   out,unqualified,new Uint8Array(6234),net),/not independently established ACTUALLY SERVING/);
  assert.equal(calls,0);
  assert.equal(existsSync(out),false);
  assert.throws(()=>verifyActualSenatorAnd2020CampaignHomeBeforeArchiveNetwork(
   actualServing(),new Uint8Array(6234)),/genuine original August 2020 first-party homepage/);
  assert.equal(calls,0);
 }finally{rmSync(d,{recursive:true,force:true});}
});
test('standalone source-only runner refuses missing full original government/campaign data',()=>{
 const d=mkdtempSync(join(tmpdir(),'bill-original-issues-no-phantom-'));
 try{
  const out=join(d,'unverified-output');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/run-bill-ingebrigtsen-historic-issues-page-original.ts',
   '--output-original-source-dir',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(d,{recursive:true,force:true});}
});
