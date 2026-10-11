import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import metadata from '../data/evaluation/senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {auditNicoleMitchell2022OriginalCampaignQuotes}
 from '../src/evidence/senate-nicole-mitchell-2022-original-issue-proof.js';
const DATE='2026-10-11T00:15:00.000Z';
function service():AuditedOfficialSenateDirectory {
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',observedAt:DATE,
   sourceBytesSha256:'f'.repeat(64),sourceBytesLength:350000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Nicole L. Mitchell',officialNameRaw:'Mitchell, Nicole L.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2025,district:'47'}]},
  ],
 };
}
const fake=Buffer.from('<html><body>Nicole Mitchell for Minnesota State Senate'
 +' Priorities Focusing on What Matters. Paid for by Nicole Mitchell for State Senate'
 +' fully fund our public schools and address climate change and '
 +'strong supporter of Early Childhood Family Education (ECFE)'
 +' free and fair elections in Minnesota.</body></html>');
test('real acquired Feb/Nov 2022 originals source and research retrieval timestamps remain distinct',()=>{
 assert.equal(metadata.scope.person,'Nicole Mitchell');
 assert.equal(metadata.scope.senateDistrict,'47');
 assert.equal(metadata.scope.personNeverServedSenate,false);
 assert.equal(metadata.scope.originalAuthorFirstPostedAt,null);
 assert.equal(metadata.scope.issueExcerptCount,4);
 assert.equal(metadata.scope.forecastAutomaticallyEligible,false);
 assert.equal(metadata.provenance.originalCurrentAcquisitionGitHubRunId,38100551887);
 assert.equal(metadata.originals.length,2);
 assert.ok(metadata.originals.every(x=>
  x.archivedOriginalCapturedAtUtc<'2022-11-08T00:00:00Z'
  &&x.actualHttpStatus===200
  &&x.independentlyConfirmedOriginalByMatchingCdxDigest===true
  &&x.fetchedUtc.startsWith('2026-10-11')
  &&/^[0-9a-f]{64}$/.test(x.actualOriginalBodySha256)
  &&/^[A-Z2-7]{32}$/.test(x.originalHistoricalCdxIndexBase32Sha1)));
 assert.equal(metadata.originals[0].archivedOriginalCapturedAtUtc,'2022-02-01T00:55:54.000Z');
 assert.equal(metadata.originals[1].archivedOriginalCapturedAtUtc,'2022-11-05T16:03:01.000Z');
});
test('four short attributable senator platform excerpts each have an attested original 2022 public-by capture and unknown first author post date',()=>{
 assert.deepEqual(metadata.shortIssues.map(x=>x.family),
  ['education','education','environment_natural_resources','elections']);
 assert.equal(new Set(metadata.shortIssues.map(x=>x.id)).size,4);
 assert.ok(metadata.shortIssues.every(x=>
  x.sourceFirstAttestedPublicByNoLaterThanUtc===metadata.originals[0].archivedOriginalCapturedAtUtc
  &&x.secondIndependentlyAttestedSiteCaptureUtc===metadata.originals[1].archivedOriginalCapturedAtUtc
  &&x.authorFirstPublishedAt===null
  &&x.linkedSenateMembershipId===null
  &&x.historicalForecastFeatureAutomaticallyEligible===false));
});
test('missing actual independent official LRL Senate service cannot qualify source even with other correct archive metadata',()=>{
 const no=service();no.senators=[];
 assert.throws(()=>auditNicoleMitchell2022OriginalCampaignQuotes(no,{
  'nicole2022-priorities-feb01':fake,'nicole2022-priorities-nov05':fake,
 }),/actual Senate service/);
 const bad=service();bad.senators[0].senateServiceTerms[0].district='33';
 assert.throws(()=>auditNicoleMitchell2022OriginalCampaignQuotes(bad,{
  'nicole2022-priorities-feb01':fake,'nicole2022-priorities-nov05':fake,
 }),/actual Senate service/);
});
test('even a plausible later or tampered mock HTML cannot impersonate original CDX authenticated 2022 source bytes',()=>{
 const bytes={'nicole2022-priorities-feb01':fake,'nicole2022-priorities-nov05':fake};
 assert.throws(()=>auditNicoleMitchell2022OriginalCampaignQuotes(service(),bytes),
  /original historical campaign HTML SHA-256 mismatch/);
 const absent={'nicole2022-priorities-feb01':new Uint8Array(),
  'nicole2022-priorities-nov05':fake};
 assert.throws(()=>auditNicoleMitchell2022OriginalCampaignQuotes(service(),absent),
  /Both original 2022 campaign pages/);
});
test('CLI needs four original input files and refuses to overwrite originals',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-nicole-2022-real-source-gate-'));
 try{
  const out=join(dir,'audit.json');
  const args=['--import','tsx','scripts/audit-senate-nicole-2022-original-policy-offline.ts'];
  assert.throws(()=>execFileSync('node',[...args,'--output',out],
   {timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
  const fakeFile=join(dir,'body.html');
  writeFileSync(fakeFile,fake);
  assert.throws(()=>execFileSync('node',[...args,
   '--lrl-original',fakeFile,'--lrl-metadata',fakeFile,
   '--feb-original',fakeFile,'--nov-original',fakeFile,
   '--output',out],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
