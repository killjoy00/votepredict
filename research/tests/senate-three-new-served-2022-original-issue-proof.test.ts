import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import research from '../../data/evaluation/senate-three-2022-original-sites-25-short-excerpt-proofs-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {auditThreeMoreActuallyServedSenator2022OriginalIssueExcerpts}
 from '../../src/evidence/senate-three-new-served-2022-original-campaign-issue-proof.js';
const fileHash=(x:string)=>/^[0-9a-f]{64}$/.test(x);
const cdxHash=(x:string)=>/^[A-Z2-7]{32}$/.test(x);
function service():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir' as const;
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'f'.repeat(64),sourceBytesLength:300000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Judy Seeberger',officialNameRaw:'Seeberger, Judy',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'41'}]},
   {officialName:'Bonnie Westlin',officialNameRaw:'Westlin, Bonnie',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'42'}]},
   {officialName:'Steve A. Cwodzinski',officialNameRaw:'Cwodzinski, Steve A.',
    officialSourceUrl:url,senateServiceTerms:[
     {startsYear:2017,endsYear:2022,district:'48'},
     {startsYear:2023,endsYear:null,district:'49'},
    ]},
  ],
 };
}
test('research excerpts are source-specific quotes only, independently 2022 archived and not auto eligible',()=>{
 assert.equal(research.scope.actualSenatePeople,3);
 assert.equal(research.scope.shortExcerpts,25);
 assert.equal(research.scope.archivedOlderCampaignCyclePages,1);
 assert.deepEqual(research.pages.map(p=>p.person),
  ['Judy Seeberger','Bonnie Westlin','Steve Cwodzinski']);
 assert.deepEqual(research.pages.map(p=>p.shortStatementCount),[7,8,10]);
 assert.equal(new Set(research.statements.map(x=>x.id)).size,25);
 assert.ok(research.pages.every(p=>p.capture.startsWith('2022-')
  &&p.capture<'2022-11-08T00:00:00.000Z'
  &&p.observed.startsWith('2026-10-11T')
  &&fileHash(p.sha)&&cdxHash(p.digest)));
 assert.ok(research.statements.every(q=>
  ISSUE_POSITION_FAMILIES.includes(q.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
  &&q.exactExcerpt.length>=9&&q.exactExcerpt.length<=130
  &&q.sourceIsCandidateOwnedSiteContent===true
  &&q.personallySpokenVerbatimNotProven===true
  &&q.actualLegislativeVoteProven===false
  &&q.eligibleForAutomaticHistoricalForecast===false
 ));
});
test('Jan 2022 Bonnie source is older SD34 campaign copy, NOT automatically a newly authored 2022 SD42 platform',()=>{
 const bonnie=research.pages.find(x=>x.id==='bonnie22');
 assert.ok(bonnie);
 assert.equal(bonnie.historicalClass,
  '2022_archived_older_sd34_campaign_copy_not_certified_2022_sd42_website');
 assert.equal(bonnie.district,'42');
 assert.equal(bonnie.shortStatementCount,8);
 assert.ok(bonnie.campaignContext.includes('NOT independently certified'));
 assert.ok(research.statements.filter(q=>q.person==='Bonnie Westlin').every(q=>
  q.sourceStatementCharacter==='platform_support_older_cycle'));
 const steve=service().senators.find(x=>x.officialName==='Steve A. Cwodzinski');
 assert.equal(steve?.senateServiceTerms[0].district,'48');
 assert.equal(steve?.senateServiceTerms[1].district,'49');
});
test('missing person service fails before any original quote can be invented',()=>{
 const x=service();x.senators=[];
 assert.throws(()=>auditThreeMoreActuallyServedSenator2022OriginalIssueExcerpts(x,{
  acquisition:{},originalHtml:{
   judy22:Buffer.alloc(120),bonnie22:Buffer.alloc(120),steve22:Buffer.alloc(120),
  },
 }),/Original archive acquisition manifest missing/);
});
test('source CLI needs all distinct real government, archive manifest and exact campaign original paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-three-real2022-'));
 try{
  const out=join(dir,'report.json');
  const cmd=['--import','tsx','scripts/audit-senate-three-new-served-2022-original-site-excerpts-offline.ts'];
  assert.throws(()=>execFileSync('node',[...cmd,'--output',out],
   {timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
  const fake=join(dir,'test-source');writeFileSync(fake,'not the LRL or original');
  const flags=[
   '--official-lrl-original','--official-lrl-metadata','--official-special-swearing',
   '--archive-acquisition-manifest','--judy-2022-priorities-original',
   '--bonnie-2022-legacy-issues-original','--steve-2022-vision-original',
  ];
  assert.throws(()=>execFileSync('node',[
   ...cmd,...flags.flatMap(k=>[k,fake]),'--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
