import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-second20-15-original-serving-senators-issue-excerpts-v1.json' with {type:'json'};

test('15 of second 20 actually served senators gain 137 historical first-party original short source excerpts',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.trueActualSenators2021To2025,95);
 assert.equal(ledger.scope.sourceAcquisitionProved20PreviouslyUncoveredActualServingSenators,true);
 assert.equal(ledger.scope.newActuallyServingSenatorsWithOriginalFirstPartyIssueLead,15);
 assert.equal(ledger.scope.exactDistinctCandidateSiteSourceExcerpts,137);
 assert.equal(ledger.pages.length,18);
 assert.equal(ledger.excerpts.length,137);
 assert.equal(new Set(ledger.pages.map(p=>p.person)).size,15);
 assert.equal(new Set(ledger.pages.map(p=>p.id)).size,18);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,137);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,137);
});

test('all selected pre-election original site captures are signed by original source archive hashes',()=>{
 for(const p of ledger.pages){
  assert.match(p.originalHtmlSha256,/^[0-9a-f]{64}$/);
  assert.match(p.sourceIndexSha256,/^[0-9a-f]{64}$/);
  assert.match(p.originalArchiveCdxSha1Base32,/^[A-Z2-7]{32}$/);
  assert.equal(p.firstAuthoredDateEstablished,false);
  assert.equal(p.verifiedLegislativeVoteClaim,false);
  assert.equal(p.automaticallyEligibleForForecast,false);
  const cutoff=p.electionYear===2020?'2020-11-03T00:00:00.000Z':
   p.electionYear===2022?'2022-11-08T00:00:00.000Z':'2025-11-04T00:00:00.000Z';
  assert.ok(p.archivePublicByUtc<cutoff);
 }
 assert.equal(ledger.scope.originalSourceAcquisitionRun,38177884783);
 assert.equal(ledger.scope.originalSourceArtifactId,11717125740);
});

test('historic source provenance cannot be flattened into 2020/22/25 Senate promises',()=>{
 const only=(person:string)=>ledger.pages.filter(p=>p.person===person);
 assert.ok(only('Ann Rest').every(p=>p.pageKind.includes('pre_redistricting_sd45')));
 assert.ok(only('Tou Xiong').every(p=>p.pageKind.includes('house_53a')));
 assert.ok(only('Patricia Torres Ray').every(p=>p.pageKind.includes('2018_us_congress')));
 assert.ok(only('Steve Green').every(p=>p.pageKind.includes('legacy_house_2b')));
 assert.ok(only('Kari Dziedzic').every(p=>p.pageKind.includes('older_2012')));
 assert.equal(only('Amanda Hemmingsen-Jaeger').length,1);
 assert.equal(only('Melisa Franzen').length,1);
 assert.equal(ledger.scope.olderHouseAndCongressSourcesNot2020Or2022SenatePlatforms,true);
 assert.equal(ledger.scope.candidateStatementsAboutPassedLegislationDoNotVerifyOfficialVotes,true);
});

test('every short excerpt retains exact source page attribution and cannot enter production forecasts automatically',()=>{
 const pages=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.excerpts.every(q=>pages.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateKnown===false));
 assert.ok(ledger.excerpts.every(q=>q.officialLegislativeActionVerified===false));
 assert.ok(ledger.excerpts.every(q=>q.automaticallyEligibleForForecast===false));
 assert.ok(ledger.excerpts.some(q=>q.attributionClass==='candidate_self_reported_prior_legislation_unverified'));
 assert.equal(ledger.scope.productionDatabaseWrites,0);
 assert.equal(ledger.scope.forecastOrModelChanges,0);
});

test('incorrect candidate identities, broken archive indexes, and repurposed sources remain excluded rather than claims of no policies',()=>{
 assert.equal(ledger.scope.noSourceAbsenceInferenceFromFailedOrCappedArchives,true);
 const missing=new Set(ledger.unresolvedOrDisqualifiedSourceLeads.map(x=>x.person));
 for(const p of ['Doron Clark','Kelly Morrison','Scott Newman','Charles Wiger','Thomas Bakk'])
  assert.ok(missing.has(p),p);
 assert.ok(ledger.unresolvedOrDisqualifiedSourceLeads.some(x=>x.reason.includes('california_josh_newman')));
 assert.ok(ledger.unresolvedOrDisqualifiedSourceLeads.some(x=>x.reason.includes('2019_repurposed_explicit_spam')));
 assert.ok(ledger.unresolvedOrDisqualifiedSourceLeads.some(x=>x.reason.includes('2019_q7_subdomain_warehouse_spam')));
 assert.ok(ledger.pages.every(p=>!['Doron Clark','Kelly Morrison','Scott Newman','Charles Wiger','Thomas Bakk'].includes(p.person)));
});
