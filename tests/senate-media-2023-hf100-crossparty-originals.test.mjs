import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LEADS} from '../scripts/probe-senate-media-2023-hf100-crossparty-candidates.mjs';
import {VERSION,JOURNAL,ORIGINALS,sha1Base32,validateOriginals,boundNamedOriginalTurn,rollFromOriginalJournal,
 replayPinnedSource,inspectCrossPartyJournal,deduplicateByMemberQuote,run}
 from '../scripts/probe-senate-media-2023-hf100-crossparty-originals.mjs';

const port='Minnesotans have made it clear that they are ready to move forward with the legalization of adult-use cannabis in our state, and we will get it done this year';
const herald='Prohibition of cannabis is a failed system that has not achieved the desired goals and has had incredible costs for our communities, especially for communities of color';
const articles=[
 '<p>"'+port+'," Sen. Lindsey Port (DFL-Burnsville), the Senate bill author, added.</p>',
 '<p>"'+port+'," said Senator Lindsey Port, DFL.</p>',
 '<p>First-term Sen. Clare Oumou Verbeten, DFL-Roseville, was more upbeat about the prospects. "We are going to get this done in 2023," she said. "We are going to make sure that it includes expungement."</p>',
 '<p>"'+herald+'," said Senator Lindsey Port at today\'s hearing.</p>'
];
function officialRoll(){
 return 'A motion to re-refer H.F. No. 100 was lost by yeas 33 and nays 34. Port Oumou Verbeten and Dahms.\n'+
 'The question was taken on the final passage of H.F. No. 100, as amended.\n'+
 'The roll was called, and there were yeas 34 and nays 33, as follows:\n'+
 'Those who voted in the affirmative were:\nBoldon Carlson Champion Port Oumou Verbeten\n'+
 'Pursuant to Rule 40, Senator Morrison cast a vote on behalf of Senator Kunesh.\n'+
 'Those who voted in the negative were:\nAbeler Anderson Bahr Dahms Gruenhagen\n'+
 'Pursuant to Rule 40, Senator Rasmusson cast a vote for Senator Howe.\n'+
 'So the bill, as amended, was passed and its title was agreed to.\n';
}
test('four disjoint pinned original article URLs with authenticated pre-Apr28 capture stamps',()=>{
 assert.equal(validateOriginals(),true);
 assert.equal(ORIGINALS.length,4);
 assert.equal(new Set(LEADS.map(x=>x.url)).size,4);
 assert.ok(ORIGINALS.every(x=>x.captureUtc<'2023-04-28T00:00:00Z'));
 assert.equal(VERSION,'track-d-hf100-2023-two-democratic-yes-two-republican-no-original-primary-v1');
 assert.equal(JOURNAL.url,'https://www.senate.mn/journals/2023-2024/20230428059.pdf');
 assert.equal(JOURNAL.page,290);
});
test('raw archive indexed SHA1 base32 is computed over original bytes',()=>{
 const b=Buffer.from('abc');
 assert.equal(sha1Base32(b),'VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5');
 assert.match(createHash('sha256').update(b).digest('hex'),/^[a-f0-9]{64}$/);
});
test('every archive paragraph needs exact adjacent PERSON attribution',()=>{
 for(let i=0;i<4;i++){
  const v=boundNamedOriginalTurn(articles[i],LEADS[i]);
  assert.equal(v.verified,true,'expected named original '+LEADS[i].id);
  assert.match(v.normalizedBoundedSegmentSha256,/^[a-f0-9]{64}$/);
  assert.ok(v.normalizedBoundedSegmentCharacters>20);
 }
});
test('individual Port quote cannot be silently assigned to another senator',()=>{
 assert.equal(boundNamedOriginalTurn(articles[0].replace('Lindsey Port','Gary Dahms'),LEADS[0]).verified,false);
 assert.equal(boundNamedOriginalTurn(articles[1].replace('said Senator Lindsey Port','said a spokesperson'),LEADS[1]).verified,false);
 assert.equal(boundNamedOriginalTurn(articles[3].replace('said Senator Lindsey Port','according to Senator Lindsey Port'),LEADS[3]).verified,false);
});
test('MPR story quote needs full named prior speaker and explicit she said, not reporter audio transcript',()=>{
 assert.equal(boundNamedOriginalTurn(articles[2].replace('Clare Oumou Verbeten','Another senator'),LEADS[2]).verified,false);
 assert.equal(boundNamedOriginalTurn(articles[2].replace('she said','the narrator said'),LEADS[2]).verified,false);
 assert.equal(boundNamedOriginalTurn(articles[2].replace('We are going to get this done in 2023','We might get this done someday'),LEADS[2]).verified,false);
});
test('duplicate matching senator speech turns are rejected, and same quote across two publishers deduplicates',()=>{
 assert.equal(boundNamedOriginalTurn(articles[0]+articles[0],LEADS[0]).verified,false);
 const p0=boundNamedOriginalTurn(articles[0],LEADS[0]),p1=boundNamedOriginalTurn(articles[1],LEADS[1]);
 assert.equal(p0.normalizedBoundedSegmentSha256,p1.normalizedBoundedSegmentSha256);
 const meta=deduplicateByMemberQuote([
  {id:LEADS[0].id,senator:'Lindsey Port',authenticatedOriginal:true,speaker:p0},
  {id:LEADS[1].id,senator:'Lindsey Port',authenticatedOriginal:true,speaker:p1},
  {id:LEADS[2].id,senator:'Clare Oumou Verbeten',authenticatedOriginal:true,speaker:boundNamedOriginalTurn(articles[2],LEADS[2])},
  {id:LEADS[3].id,senator:'Lindsey Port',authenticatedOriginal:true,speaker:boundNamedOriginalTurn(articles[3],LEADS[3])}
 ]);
 assert.equal(meta.originalVersions,4);
 assert.equal(meta.uniqueSenatorSpeakerPassages,3);
 assert.equal(meta.uniqueSenators,2);
 assert.equal(meta.redlakeAndKstpAreSamePortQuotedStatement,true);
});
test('named final Senate HF100 34-33 vote proves two YES vs two NO despite opposite earlier motion',()=>{
 const r=rollFromOriginalJournal(officialRoll());
 assert.equal(r.qualified,true);
 assert.equal(r.bill,'HF100');
 assert.equal(r.companionNotDirectBallot,'SF73');
 assert.deepEqual(r.individualVotes.map(x=>[x.senator,x.vote]),[
  ['Lindsey Port','yea'],['Clare Oumou Verbeten','yea'],['Gary Dahms','nay'],['Glenn Gruenhagen','nay']]);
});
test('wrong final chamber vote, final bill number, tally, ballot context fail closed',()=>{
 const r=officialRoll();
 for(const altered of [
  r.replace('final passage of H.F. No. 100','final passage of H.F. No. 101'),
  r.replace('final passage of H.F. No. 100','final passage of S.F. No. 73'),
  r.replace('yeas 34 and nays 33','yeas 33 and nays 34'),
  r.replace('final passage of H.F. No. 100','re-referral motion on H.F. No. 100'),
  r.replace('So the bill, as amended, was passed and its title was agreed to.','The motion prevailed.')
 ]) assert.equal(rollFromOriginalJournal(altered).qualified,false);
 assert.equal(rollFromOriginalJournal(r+r).qualified,false);
});
test('missing affirmative or negative individually listed member cannot be inferred from party or aggregate',()=>{
 const r=officialRoll();
 for(const altered of [
  r.replace('Boldon Carlson Champion Port Oumou Verbeten','Boldon Carlson Champion'),
  r.replace('Abeler Anderson Bahr Dahms Gruenhagen','Abeler Anderson Bahr'),
  r.replace('Port Oumou Verbeten','Dahms Gruenhagen'),
  r.replace('Dahms Gruenhagen','Port Oumou Verbeten'),
 ])assert.equal(rollFromOriginalJournal(altered).qualified,false);
});
test('Rule 40 proxy and adjacent procedural motion names cannot replace the affirmative final roster',()=>{
 const r=officialRoll();
 const altered=r.replace('Boldon Carlson Champion Port Oumou Verbeten',
  'Boldon Carlson Champion').replace('Senator Morrison cast','Senators Port and Oumou Verbeten were mentioned; Senator Morrison cast');
 assert.equal(rollFromOriginalJournal(altered).qualified,false);
});
test('a changed pinned Wayback full body returns explicit digest FAILURE not approval',async()=>{
 const f=async()=>new Response('A '.repeat(2000),{status:200,headers:{'content-type':'text/html'}});
 const r=await replayPinnedSource(LEADS[0],ORIGINALS[0],f);
 assert.equal(r.status,'PINNED_ORIGINAL_DIGEST_MISMATCH_FAIL_CLOSED');
 assert.equal(r.authenticatedOriginal,false);
});
test('Wayback outage and official PDF outage are UNKNOWN and never treated as absence or proof',async()=>{
 const f=async()=>new Response('Temporarily unavailable',{status:503,headers:{'content-type':'text/plain'}});
 const j=await inspectCrossPartyJournal(f);
 assert.equal(j.roll,null);
 assert.equal(j.status,'official_original_http_mime_unknown');
 const result=await run(f);
 assert.equal(result.authenticatedDemocraticYesPersonToRepublicanNoMemberPairs,0);
 assert.equal(result.dedup.originalVersions,0);
 assert.equal(result.crossPartyHistoricalStatementPairApprovedForProduction,false);
 assert.equal(result.retrospectivePredictionBacktestPerformed,false);
 assert.equal(result.noProductionDBIngestionFeatureModelOrDeploymentChanges,true);
});
