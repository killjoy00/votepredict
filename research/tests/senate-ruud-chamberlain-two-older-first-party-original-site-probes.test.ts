import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import led from '../../data/evaluation/senate-ruud-chamberlain-2012-2022-alt-original-domain-probes-v1.json' with {type:'json'};
import {
 RUUD_CHAMBERLAIN_HISTORICAL_FIRST_PARTY_ARCHIVE_VERSION,
 validateRuudChamberlain2021ActualServiceBeforeOriginalNetwork,
 buildOriginalTwoSenatorHistoricalWaybackIndexes,
 parseBoundedRuudChamberlainOriginalCDXIndex,
 selectWholeRuudChamberlainOriginalHtmlReplays,
 acquireTwoHistoricalOriginalCandidateDomainSources,
} from '../scripts/acquire-ruud-chamberlain-two-historical-first-party-originals.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir',
 SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function actual():AuditedOfficialSenateDirectory{
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
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(stamp:string,url:string)=>[stamp,url,'text/html','200','A'.repeat(32),'5932'];
test('2013 Carrie Ruud archived candidate bio and 2022 Roger Chamberlain distinct domain only research leads until original full HTML',()=>{
 assert.match(RUUD_CHAMBERLAIN_HISTORICAL_FIRST_PARTY_ARCHIVE_VERSION,/2012-2022/);
 assert.equal(led.issue,864);
 assert.equal(led.scope.senatorsActuallyServing2021,2);
 assert.equal(led.scope.archiveIndexRequests,6);
 assert.equal(led.scope.maxTotalReplays,10);
 assert.equal(led.scope.verifiedExactIssueStatementsAtThisDiscoveryStage,0);
 assert.equal(led.scope.productionDatabaseEvidenceForecastModelSchedulerChanges,0);
 assert.equal(led.people[0].specificHistoricalOriginal,'http://www.carrieruud.com/index.cfm/pageid/18');
 assert.ok(led.people[0].documentedWaybackHistoricalURL?.includes('20130922051655'));
 assert.equal(led.people[1].specificHistoricalOriginal,'https://rogerchamberlainmn.com/');
 assert.equal(led.people[1].independentExpenditureIsNotCandidateAuthorized,true);
 assert.equal(led.people[1].domainOwnershipCurrent2026UntrustedBecauseMayHaveExpired,true);
});
test('two verified actually serving 2021 Senate people required before networking, not unseated 2022 Chamberlain winner fiction',async()=>{
 const verified=validateRuudChamberlain2021ActualServiceBeforeOriginalNetwork(actual());
 assert.deepEqual(verified.map(x=>x.name),['Carrie Ruud','Roger Chamberlain']);
 const tmp=mkdtempSync(join(tmpdir(),'two-historic-first-party-senate-'));
 try{
  const modified=actual();modified.senators.pop();
  let calls=0;const fake=(async()=>{calls++;throw Error('Unexpected archive call');}) as typeof fetch;
  const output=join(tmp,'should-not-exist');
  await assert.rejects(()=>acquireTwoHistoricalOriginalCandidateDomainSources(
   output,modified,fake),/not independently proven actual Minnesota 2021-serving Senator/);
  assert.equal(calls,0);
  assert.equal(existsSync(output),false);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('all six historically scoped Wayback indexes are exact person/policy source references and bounded',()=>{
 const qs=buildOriginalTwoSenatorHistoricalWaybackIndexes();
 assert.equal(qs.length,6);
 for(const [i,s] of qs.entries()){
  const url=new URL(s),t=led.archiveQueries[i];
  assert.equal(url.origin,'https://web.archive.org');
  assert.equal(url.pathname,'/cdx/search/cdx');
  assert.equal(url.searchParams.get('url'),t.url);
  assert.equal(url.searchParams.get('matchType'),t.kind);
  assert.equal(url.searchParams.get('from'),t.from);
  assert.equal(url.searchParams.get('to'),t.to);
  assert.equal(url.searchParams.get('limit'),'300');
 }
 assert.equal(qs[0].includes('20120101'),true);
 assert.equal(qs[5].includes('20221107'),true);
});
test('historical index parses actual candidate visible HTML only and excludes unrelated person, media, modern captures',()=>{
 const found=parseBoundedRuudChamberlainOriginalCDXIndex([header,
  row('20130922051655','http://www.carrieruud.com/index.cfm/pageid/18'),
  row('20160922051655','https://www.carrieruud.com/index.cfm/pageid/18'),
  row('20190105151515','http://www.carrieruud.com/index.cfm/pageid/18'),
  row('20130922051655','http://www.carrieruud.com/index.cfm/pageid/19'),
  row('20130922051655','http://wrong.example/index.cfm/pageid/18'),
  row('20130922051655','http://www.carrieruud.com/images/portrait.jpg'),
 ],'ruud-2013-exact');
 assert.equal(found.eligible.length,2);
 assert.equal(found.rawRows,6);
 assert.equal(selectWholeRuudChamberlainOriginalHtmlReplays(found.eligible,'Carrie Ruud').length,1);
 assert.deepEqual(parseBoundedRuudChamberlainOriginalCDXIndex([],'ruud-2013-exact'),{
  eligible:[],rawRows:0,atCap:false,
 });
 assert.throws(()=>parseBoundedRuudChamberlainOriginalCDXIndex([['bad']], 'ruud-2013-exact'),/incomplete/);
 const huge=[header,...Array.from({length:301},()=>row('20130922051655','http://www.carrieruud.com/index.cfm/pageid/18'))];
 assert.throws(()=>parseBoundedRuudChamberlainOriginalCDXIndex(huge,'ruud-2013-exact'),/exceeds bounded/);
});
test('Roger Chamberlain 2022 independently linked site rows do not become original candidate endorsements or 2020 statements by inference',()=>{
 const found=parseBoundedRuudChamberlainOriginalCDXIndex([header,
  row('20220702214234','https://rogerchamberlainmn.com/'),
  row('20221002214234','https://www.rogerchamberlainmn.com/issues'),
  row('20230102214234','https://rogerchamberlainmn.com/'),
  row('20220702214234','https://www.notrogermn.com/'),
 ],'chamberlain-2022-domain');
 assert.equal(found.eligible.length,2);
 assert.equal(selectWholeRuudChamberlainOriginalHtmlReplays(found.eligible,'Roger Chamberlain').length,2);
 assert.equal(led.scope.unknownOrMissingArchivalSourcesNotProofOfNoPolicies,true);
});
test('standalone runner cannot make fabricated original historical Senate-site report without whole original LRL HTML and receipt',()=>{
 const temp=mkdtempSync(join(tmpdir(),'ruud-chamberlain-original-no-phantom-'));
 try{
  const outfile=join(temp,'absent-source-output');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx',
   'scripts/acquire-ruud-chamberlain-two-historical-first-party-originals.ts',
   '--output-dir',outfile,
  ],{stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(outfile),false);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
