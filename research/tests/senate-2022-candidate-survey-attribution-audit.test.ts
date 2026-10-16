import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,statSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import leadData from '../../data/evaluation/senate-2022-candidate-survey-original-quote-leads-v1.json' with {type:'json'};
import {
 auditSenate2022SurveyAttribution,
 originalRespondentSectionText,exactPolicySpanInSpeakerSection,
} from '../../src/evidence/senate-2022-candidate-survey-attribution-audit.js';
const sd4=leadData.sources[0],sd32=leadData.sources[1];
const mock4=Buffer.from(
  '<html><body><script>Kupec: fake</script><p>Here are excerpts from the candidates.</p>'+
  '<h2>Kupec:</h2><blockquote>Ensure that all children have access to quality education from pre-K to college.</blockquote>'+
  '<blockquote>Increase access to quality health care in rural communities.</blockquote>'+
  '<h2>Bohmer:</h2><p>We must address the high taxes we face.</p><p>Public safety is critical</p>'+
  '<p>Click on the candidates profiles</p></body></html>');
const mock32=Buffer.from(
  '<html><body><p>Here are excerpts from the candidates.</p>'+
  '<h2>Luthner:</h2><p>Public education funding is my top priority.</p>'+
  '<p>Reproductive rights need to be protected in our state</p>'+
  '<h2>Kreun:</h2><p>I will secure funding to improve Highway 65.</p>'+
  '<p>I support the elimination of the state tax on social security.</p>'+
  '<p>Click on the candidates profiles</p></body></html>');
test('8 bounded 2022 policy leads belong to exactly two winners and two defeated opponents',()=>{
 const r=auditSenate2022SurveyAttribution();
 assert.equal(r.totals.publisherArticles,2);
 assert.equal(r.totals.candidateSpeakers,4);
 assert.equal(r.totals.senatorElectionWinnersWithCandidateWrittenSurvey,2);
 assert.equal(r.totals.nonwinningOpponentsWithCandidateWrittenSurvey,2);
 assert.equal(r.totals.winningCandidateIssueExcerptLeads,4);
 assert.equal(r.totals.excludedLosingOpponentIssueExcerptLeads,4);
 assert.equal(r.totals.verifiedPublisherHTMLSourceFiles,0);
 assert.equal(r.totals.verifiedNamedSpeakerQuoteSpans,0);
 assert.equal(r.totals.quoteSpansIndependentlyProvenPublicBefore2022General,0);
 assert.ok(r.excerpts.every(x=>x.historicalForecastEligible===false
   &&x.independent2022PublicBy===null
   &&x.candidateOwnCampaignSiteStatement===false
   &&x.existingEvidenceItemId===null));
});
test('Rob Kupec / Michael Kreun winner excerpts never become losing opponent attributed quotes',()=>{
 const r=auditSenate2022SurveyAttribution();
 assert.deepEqual([...new Set(r.excerpts.filter(x=>x.postElectionOutcome==='winner')
  .map(x=>x.candidateName))].sort(),['Michael Kreun','Rob Kupec']);
 assert.deepEqual([...new Set(r.excerpts.filter(x=>x.postElectionOutcome==='loser')
  .map(x=>x.candidateName))].sort(),['Dan Bohmer','Kate Luthner']);
 assert.ok(r.excerpts.filter(x=>x.candidateName==='Dan Bohmer')
  .every(x=>x.isLoserExcerptNotAssignableToSenator));
 assert.ok(r.excerpts.filter(x=>x.candidateName==='Kate Luthner')
  .every(x=>x.isLoserExcerptNotAssignableToSenator));
});
test('short candidate spans are verified only INSIDE original respondent section',()=>{
 assert.equal(exactPolicySpanInSpeakerSection(mock4,sd4,'Rob Kupec','quality education from pre-K to college'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock4,sd4,'Rob Kupec','quality health care in rural communities'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock4,sd4,'Dan Bohmer','high taxes we face'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock4,sd4,'Dan Bohmer','Public safety is critical'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock32,sd32,'Kate Luthner','Public education funding is my top priority'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock32,sd32,'Michael Kreun','improve Highway 65'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock32,sd32,'Michael Kreun','elimination of the state tax on social security'),true);
 assert.equal(exactPolicySpanInSpeakerSection(mock4,sd4,'Rob Kupec','Public safety is critical'),false);
 assert.equal(exactPolicySpanInSpeakerSection(mock32,sd32,'Kate Luthner','improve Highway 65'),false);
});
test('missing, doubled and swapped source speaker headings are errors rather than attribution',()=>{
 assert.throws(()=>originalRespondentSectionText(Buffer.from('<html>Kupec: Not the subject.</html>'),sd4,'Rob Kupec'),
  /Missing, duplicated/);
 assert.throws(()=>originalRespondentSectionText(Buffer.from('Kupec: one Kupec: two Bohmer: three Click on the candidates'),sd4,'Rob Kupec'),
  /Missing, duplicated/);
 assert.throws(()=>originalRespondentSectionText(mock4,sd4,'Michael Kreun'),
  /explicitly attributed speaker/);
});
test('damaged or 2026-mutated source bodies never masquerade as the pinned original source',()=>{
 assert.throws(()=>auditSenate2022SurveyAttribution({
  sd4Html:mock4,sd32Html:mock32,
 }),/SHA-256 mismatch/);
 assert.throws(()=>auditSenate2022SurveyAttribution({
  sd4Html:mock4,
 }),/Both candidate 2022 publisher original responses/);
 assert.throws(()=>originalRespondentSectionText(
  Buffer.alloc(600001,65),sd4,'Rob Kupec'),/600KiB/);
});
test('offline CLI always reports no historical 2022 as-of proof and creates private non-overwriting report',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-2022-candidate-quotes-'));
 try {
  const output=join(dir,'audit.json');
  execFileSync('node',['--import','tsx','scripts/audit-senate-2022-candidate-surveys-offline.ts',
   '--output',output],{timeout:10000,stdio:'pipe'});
  const r=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(r.totals.winningCandidateIssueExcerptLeads,4);
  assert.equal(r.totals.verifiedNamedSpeakerQuoteSpans,0);
  assert.equal(r.scope.independentlyPublicBeforeElectionCertified,false);
  assert.equal(statSync(output).mode&0o777,0o600);
  assert.throws(()=>execFileSync('node',['--import','tsx','scripts/audit-senate-2022-candidate-surveys-offline.ts',
   '--output',output],{timeout:10000,stdio:'pipe'}));
  writeFileSync(join(dir,'sd4.html'),mock4);
  assert.throws(()=>execFileSync('node',['--import','tsx','scripts/audit-senate-2022-candidate-surveys-offline.ts',
   '--sd4',join(dir,'sd4.html'),'--output',join(dir,'report2.json')],{timeout:10000,stdio:'pipe'}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
