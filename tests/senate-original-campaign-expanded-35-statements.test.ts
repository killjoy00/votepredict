import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import additions from '../data/evaluation/senate-original-campaign-additional-35-statement-excerpts-v1.json' with {type:'json'};
import index from '../data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {
 DEEPER_2022_TO_2025_SERVED_SENATOR_CAMPAIGN_STATEMENTS,
 verifyTwoLaterAnn2024OriginalPageVersions,
 deepenActualSenatorHistoricalCampaignStatementLedger,
} from '../src/evidence/senate-served-2022-25-original-campaign-statement-expansion.js';
import {ISSUE_POSITION_FAMILIES} from '../src/evidence/issue-position-extractor.js';

test('35 additional historically attributable campaign text snippets are all named verified-Senator persons and have explicit non-vote semantics',()=>{
 assert.match(DEEPER_2022_TO_2025_SERVED_SENATOR_CAMPAIGN_STATEMENTS,/59-dated/);
 assert.equal(additions.schema,'mn-senate-additional-original-campaign-issue-short-excerpts-v1');
 assert.equal(additions.scope.newSourceTextExcerptCount,35);
 assert.equal(additions.rows.length,35);
 const counts=Object.fromEntries(
  ['Carla Nelson','Nicole Mitchell','Ann Johnson Stewart','Keri Heintzeman','Michael Holmstrom Jr']
   .map(n=>[n,additions.rows.filter(q=>q.person===n).length]));
 assert.deepEqual(counts,{
  'Carla Nelson':6,'Nicole Mitchell':2,'Ann Johnson Stewart':14,
  'Keri Heintzeman':4,'Michael Holmstrom Jr':9,
 });
 assert.equal(new Set(additions.rows.map(x=>x.id)).size,35);
 assert.ok(additions.rows.every(x=>
  ISSUE_POSITION_FAMILIES.includes(x.family as typeof ISSUE_POSITION_FAMILIES[number])
  &&x.exactShortExcerpt.length>=9&&x.exactShortExcerpt.length<=130
  &&x.exactShortExcerpt===x.exactShortExcerpt.replace(/\s+/g,' ').trim()
  &&x.autoForecastEligible===false&&x.billVoteIndependentlyProven===false
  &&x.originalAuthorFirstPublicationTimeKnown===false
  &&x.sourceAttributionType==='candidate_owned_campaign_platform_copy_not_necessarily_spoken_verbatim'));
});
test('campaign prior-accomplishment copy is NEVER promoted to independently verified senator vote or new legislative pledge',()=>{
 const alleged=additions.rows.filter(x=>x.statementCharacter==='claimed_past_action');
 assert.ok(alleged.length>=4);
 assert.ok(alleged.every(x=>x.person==='Carla Nelson'
  &&x.conservativeInterpretation.includes('not ')));
 assert.ok(additions.rows.some(x=>x.id==='ajs24-ivf-protections'
  &&x.family==='health'));
 assert.ok(additions.rows.some(x=>x.id==='mh25-lesson-plan-transparency'
  &&x.family==='education'));
});
test('second and third Ann 2024 original archived pages are distinctly date indexed before the general election',()=>{
 const expected=[
  ['snapshot-02','2024-10-10T02:14:35.000Z','PYSWN7TK5UMHYD2D7MPXRDJ4MCXF2K6Y'],
  ['snapshot-03','2024-11-03T07:19:05.000Z','DUWLEMDJ27HQ5LD4D2AA7GEZXDMLZDOL'],
 ];
 for(const [id,date,digest] of expected){
  const p=index.targets.find(x=>x.id===id);
  assert.equal(p?.capturedAt,date);
  assert.equal(p?.cdxDigest,digest);
  assert.equal(p?.candidateName,'Ann Johnson Stewart');
  assert.ok(p!.capturedAt<'2024-11-05T00:00:00.000Z');
 }
});
test('mock and missing later campaign HTML must fail the original SHA-256 and historical CDX proof',()=>{
 const mock=Buffer.from('<html><body>Ann Johnson Stewart priorities IVF'+
  (' healthcare budget '.repeat(20))+'</body></html>');
 assert.throws(()=>verifyTwoLaterAnn2024OriginalPageVersions({
  ann2024OctOriginal:mock,ann2024NovOriginal:mock,
 },'Create legal protections for families seeking IVF treatment'),
 /Original historical campaign HTML SHA-256 mismatch/);
 assert.throws(()=>verifyTwoLaterAnn2024OriginalPageVersions({
  ann2024OctOriginal:Buffer.alloc(0),ann2024NovOriginal:mock,
 },'Create legal protections for families seeking IVF treatment'),
 /Both real later 2024 Ann campaign page HTML versions are required/);
});
test('synthetic service and invented campaign copies never create historical source rows',()=>{
 const sourceUrl='https://www.lrl.mn.gov/legdb/senate_dir';
 const official:AuditedOfficialSenateDirectory={
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:sourceUrl,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:360000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[],
 };
 assert.throws(()=>deepenActualSenatorHistoricalCampaignStatementLedger(
  official,{
   carla:{},nicole:{
    'nicole2022-priorities-feb01':Buffer.alloc(110),
    'nicole2022-priorities-nov05':Buffer.alloc(110),
   },
   archived2024to25:{},
   ann2024OctOriginal:Buffer.alloc(100),
   ann2024NovOriginal:Buffer.alloc(100),
  }),/Senator-only source lead count changed/);
});
test('new offline CLI requires all 13 distinct path options and cannot overwrite old outputs or originals',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-campaign-original-35-'));
 try{
  const out=join(dir,'report.json');
  const run=['--import','tsx','scripts/audit-senate-expanded-historical-campaign-statements-offline.ts'];
  assert.throws(()=>execFileSync('node',[...run,'--output',out],
   {stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(out),false);
  const fake=join(dir,'fake.html');writeFileSync(fake,'fake');
  const keys=[
   '--official-lrl-original','--official-lrl-metadata','--official-lrl-swearing',
   '--carla-2022-original-a','--carla-2022-original-b',
   '--nicole-2022-feb-original','--nicole-2022-nov-original',
   '--ann-2024-sep-original','--ann-2024-oct-original','--ann-2024-nov-original',
   '--keri-2025-original','--holmstrom-2025-original',
  ];
  assert.throws(()=>execFileSync('node',[...run,...keys.flatMap(k=>[k,fake]),'--output',out],
   {stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
