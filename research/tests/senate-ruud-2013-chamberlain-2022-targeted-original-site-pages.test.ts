import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-targeted-first-party-original-replays-v1.json' with {type:'json'};
import {
 RUUD_2013_CHAMBERLAIN_2022_PINNED_HISTORIC_SOURCES_VERSION,
 authenticateFixed2013And2022OriginalRowsBeforeNetwork,
 replayPinned2013And2022OriginalCandidateSources,
} from '../scripts/acquire-ruud-2013-chamberlain-2022-targeted-cdx-originals.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir',
 SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function official():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,sourceBytesSha256:SHA,sourceBytesLength:1601232,
   observedAt:'2026-10-10T23:26:10.121Z',
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[
   {officialName:'Carrie L. Ruud',officialNameRaw:'Ruud, Carrie L.',
    officialSourceUrl:GOV,senateServiceTerms:[{startsYear:2013,endsYear:2022,district:'10'}]},
   {officialName:'Roger C. Chamberlain',officialNameRaw:'Chamberlain, Roger C.',
    officialSourceUrl:GOV,senateServiceTerms:[{startsYear:2013,endsYear:2022,district:'38'}]},
  ],
 };
}
test('all 10 original CDX indexed candidate-site HTML captures explicitly dated to 2013 Ruud or 2022 Chamberlain',()=>{
 assert.match(RUUD_2013_CHAMBERLAIN_2022_PINNED_HISTORIC_SOURCES_VERSION,/2013-chamberlain-2022/);
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.peopleIndependentlyProvenActual2021MNStateSenators,2);
 assert.equal(ledger.scope.preciselyOriginalCDXIndexedTargets,10);
 assert.equal(ledger.scope.ruudOriginal2013Pages,5);
 assert.equal(ledger.scope.chamberlainOriginal2022Pages,5);
 assert.equal(ledger.scope.original2012RuudStatePartyChairNotSenatePlatform,true);
 assert.equal(ledger.scope.original2020ChamberlainPersonalPodcastNotCampaign,true);
 assert.equal(ledger.scope.thirdParty2022IndependentExpenditureNotCandidateStatement,true);
 assert.equal(ledger.scope.realCandidateIssuePolicyQuotesAutomaticallyAdmitted,0);
 assert.equal(ledger.scope.productionDatabaseEvidenceModelForecastSchedulerChanges,0);
 const keys=new Set<string>();
 for(const t of ledger.targets){
  const key=t.person+'|'+t.originalUrl+'|'+t.timestamp;
  assert.ok(!keys.has(key));
  keys.add(key);
  assert.match(t.timestamp,/^\d{14}$/);
  assert.match(t.cdxSha1,/^[A-Z2-7]{32}$/);
  assert.equal(t.prejudgedCampaignPolicyCopy,false);
  assert.equal(new Date(t.archiveCapturedUTC).toISOString(),t.archiveCapturedUTC);
  assert.equal(t.person==='Carrie Ruud'
   ?t.archiveCapturedUTC.startsWith('2013-09-22')
   :t.archiveCapturedUTC.startsWith('2022-'),true);
 }
});
test('whole exact historical original source index files and source-acquisition manifest are SHA pinned independently',()=>{
 assert.equal(ledger.priorSource.acquisitionPR,1100);
 assert.equal(ledger.priorSource.fullOriginalWaybackIndexRun,38162916977);
 assert.equal(ledger.priorSource.originalWaybackIndexArtifact,11711190862);
 assert.equal(ledger.priorSource.sourceManifestSha256,'1df07f5392238ad5954983ab6263f57f27dbf9653e27cb459143fc6b8c2cd1df');
 assert.deepEqual(ledger.priorSource.indexFiles.map(x=>x.file),[
  'ruudchamberlain-02-original-cdx-index.json',
  'ruudchamberlain-05-original-cdx-index.json',
 ]);
 assert.equal(ledger.priorSource.indexFiles.length,2);
 assert.equal(ledger.priorSource.indexFiles.every(x=>/^[0-9a-f]{64}$/.test(x.sha256)),true);
});
test('tweaked government Senate service or missing exact original previously indexed bytes deny any new network',async()=>{
 const fake=official();
 fake.senators.length=1;
 assert.throws(()=>authenticateFixed2013And2022OriginalRowsBeforeNetwork(
  fake,new Uint8Array(345),{}),/State Senate ACTUAL 2021 serving member/);
 let hits=0;
 const net=(async()=>{hits++;throw Error('Archive network should not be called');}) as typeof fetch;
 const tmp=mkdtempSync(join(tmpdir(),'ruud-chamberlain-targeted-no-input-'));
 try{
  const target=join(tmp,'should-not-exist');
  await assert.rejects(()=>replayPinned2013And2022OriginalCandidateSources(
   target,official(),new Uint8Array(341),{},net),/manifest bytes differ/);
  assert.equal(hits,0);
  assert.equal(existsSync(target),false);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('standalone source-only runner refuses absent original government and two full index sources',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'ruud-chamberlain-targeted-runner-'));
 try{
  const out=join(tmp,'never-admit.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/acquire-ruud-2013-chamberlain-2022-targeted-cdx-originals.ts',
   '--output-dir',out,
  ],{stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
