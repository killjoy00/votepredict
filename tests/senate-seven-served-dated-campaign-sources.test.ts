import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import archived from '../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import archivedIndex from '../data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json' with {type:'json'};
import carla from '../data/evaluation/senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json' with {type:'json'};
import nicole from '../data/evaluation/senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json' with {type:'json'};
import {
 SEVEN_SERVED_SENATORS_DATED_CAMPAIGN_LEDGER_VERSION,
 verifyThreeActuallyServed2024to25ArchivedPages,
 combineSevenActuallyServedDatedCampaignIssueSources,
} from '../src/evidence/senate-seven-served-person-dated-campaign-coverage.js';
import type {AuditedOfficialSenateDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';

const url='https://www.lrl.mn.gov/legdb/senate_dir' as const;
function directory():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:300000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Nicole Mitchell',officialNameRaw:'Mitchell, Nicole',
    officialSourceUrl:url,senateServiceTerms:[{district:'47',startsYear:2023,endsYear:2025}]},
  ],
 };
}

test('version and four independent original source manifests imply 20 historically attested excerpts, not 24 archival claims',()=>{
 assert.match(SEVEN_SERVED_SENATORS_DATED_CAMPAIGN_LEDGER_VERSION,/seven-ever-served/);
 assert.equal(carla.issues.length,6);
 assert.equal(nicole.shortIssues.length,4);
 const served=archived.candidates.filter(c=>
  ['snapshot-01','snapshot-05','snapshot-09'].includes(c.originalHtmlSource.pinnedWaybackReplayId));
 assert.equal(served.length,3);
 assert.equal(served.reduce((n,c)=>n+c.excerpts.length,0),10);
 for(const c of served){
  const index=archivedIndex.targets.find(p=>p.id===c.originalHtmlSource.pinnedWaybackReplayId);
  assert.ok(index);
  assert.equal(index.candidateName,c.candidateName);
  assert.equal(index.originalUrl.startsWith('https://'),true);
  assert.equal(index.capturedAt,c.originalHtmlSource.sourceArchiveCaptureAt);
  assert.equal(index.cdxDigest.length,32);
  assert.match(c.originalHtmlSource.originalHtmlResponseSha256,/^[0-9a-f]{64}$/);
  assert.ok(c.excerpts.every(ex=>
   ex.attestedSnippetPublicByNoLaterThan===index.capturedAt
   &&ex.immediatelyEligibleForForecast===false));
 }
 assert.equal(nicole.originals.length,2);
 assert.equal(carla.verifiedOriginals.length,2);
 assert.ok(nicole.originals.every(s=>s.fetchedUtc.startsWith('2026-10-11')
   &&s.archivedOriginalCapturedAtUtc.startsWith('2022-')));
});
test('every 2024/25 original must be present, even when its archived index date is supplied',()=>{
 assert.throws(()=>verifyThreeActuallyServed2024to25ArchivedPages({}),
  /Three authentic original 2024\/25 served-Senator pages are required/);
 assert.throws(()=>verifyThreeActuallyServed2024to25ArchivedPages({
  'snapshot-01':new Uint8Array(100),
 }),/Original historical campaign HTML SHA-256 mismatch|Three authentic original/);
});
test('unreviewed archived URLs cannot join the served-Senator source set',()=>{
 const invalid=Object.assign({},{
  'snapshot-01':Buffer.alloc(150,97),
  'snapshot-05':Buffer.alloc(150,98),
  'snapshot-09':Buffer.alloc(150,99),
 },{'snapshot-06':Buffer.alloc(150,100)});
 assert.throws(()=>verifyThreeActuallyServed2024to25ArchivedPages(invalid),
  /Only the three previously independently served campaign originals/);
});
test('synthetic plausible senator-page text cannot replace original SHA and CDX proof',()=>{
 const html=Buffer.from('<html>Candidate for Minnesota Senate '+('Education taxes public safety '.repeat(10))+'</html>');
 assert.throws(()=>verifyThreeActuallyServed2024to25ArchivedPages({
  'snapshot-01':html,'snapshot-05':html,'snapshot-09':html,
 }),/Original historical campaign HTML SHA-256 mismatch/);
});
test('not a Senate member means Nicole original campaign quotes never enter the report',()=>{
 const official=directory();official.senators=[];
 assert.throws(()=>combineSevenActuallyServedDatedCampaignIssueSources(official,{
  carla:{},nicole:{
   'nicole2022-priorities-feb01':Buffer.alloc(101),
   'nicole2022-priorities-nov05':Buffer.alloc(101),
  },archived2024to25:{},
 }),/Senator-only source lead count changed/);
});
test('the source-only CLI cannot pass without all eleven distinct original input and destination paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-seven-source-proof-'));
 try{
  const out=join(dir,'ledger.json');
  const cmd=['--import','tsx','scripts/audit-senate-seven-served-dated-campaign-sources-offline.ts'];
  assert.throws(()=>execFileSync('node',[...cmd,'--output',out],
   {stdio:'pipe',timeout:15000}),/Must supply|Command failed/);
  assert.equal(existsSync(out),false);
  const fake=join(dir,'fake.html');writeFileSync(fake,'not a real original');
  const flags=[
   '--official-lrl-original','--official-lrl-metadata','--official-lrl-swearing',
   '--carla-2022-original-a','--carla-2022-original-b',
   '--nicole-2022-feb-original','--nicole-2022-nov-original',
   '--archive-2024-ann-original','--archive-2025-keri-original',
   '--archive-2025-holmstrom-original',
  ];
  const args=flags.flatMap(x=>[x,fake]);
  assert.throws(()=>execFileSync('node',[...cmd,...args,'--output',out],
   {stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
