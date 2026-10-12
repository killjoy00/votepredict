import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-dornink-35-2019-2022-original-firstparty-excerpts-v1.json' with {type:'json'};

test('one genuine serving state senator gains 35 distinct literal archived candidate-owned source excerpts',()=>{
 const s=ledger.scope;
 assert.equal(s.issue,864);
 assert.equal(s.totalDistinctActuallyServingSenators2021to2025,95);
 assert.equal(s.previousAuthenticatedOriginalSiteCoveredSenators,86);
 assert.equal(s.previousAuthenticatedShortOriginalIssueQuotes,1105);
 assert.equal(s.newServingSenatorsWithAuthenticPreElectionSitePolicies,1);
 assert.equal(s.actualVerifiedCompleteOriginalCandidateSiteHtmlPages,3);
 assert.equal(s.shortExactNonduplicateOriginalCandidateExcerpts,35);
 assert.equal(ledger.pages.length,3);
 assert.equal(ledger.excerpts.length,35);
 assert.equal(new Set(ledger.pages.map(p=>p.id)).size,3);
 assert.deepEqual([...new Set(ledger.pages.map(p=>p.person))],['Gene Dornink']);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,35);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,35);
});

test('cross-redistricting election cycle provenance is anchored not invented',()=>{
 assert.deepEqual(ledger.pages.map(p=>[p.historicalElectionYear,p.officialSenateDistrict]),[
  [2020,'27'],[2022,'23'],[2022,'23']]);
 assert.equal(ledger.scope.original2020District,'27');
 assert.equal(ledger.scope.original2022District,'23');
 assert.equal(ledger.scope.oldDistrictStatementsRemainAttributedToOldElection,true);
 assert.equal(ledger.scope.archivedSiteCaptureNotFirstAuthoredDate,true);
 assert.ok(ledger.pages.every(p=>p.originalPostDateIndependentlyEstablished===false));
 assert.ok(ledger.pages.every(p=>p.previousLegislativeVotesOrBillAuthorshipOfficiallyVerified===false));
 assert.ok(ledger.pages.every(p=>p.eligibleForProductionForecasts===false));
 assert.ok(ledger.pages.every(p=>p.archiveCaptureUTC<
  (p.historicalElectionYear===2020?'2020-11-03T00:00:00.000Z':'2022-11-08T00:00:00.000Z')));
});

test('archived site statements are literal short historical research leads only, with original hashes pinned',()=>{
 const sources=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalHtmlSha256)));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.independentOriginalCdxSha256)));
 assert.ok(ledger.pages.every(p=>/^[A-Z2-7]{32}$/.test(p.originalCdxIndexedSha1Base32)));
 assert.ok(ledger.excerpts.every(q=>sources.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.sourceStatementKind==='original_candidate_campaign_policy_priority'));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateKnown===false&&q.officialSenateVoteVerified===false&&q.eligibleForForecast===false));
 const byPage=Object.fromEntries(ledger.pages.map(p=>[p.id,ledger.excerpts.filter(q=>q.pageId===p.id).length]));
 assert.deepEqual(byPage,{
  'dornink-sd27-home-before-2020':12,'dornink-sd23-2022-platform':16,'dornink-sd23-2022-home':7});
});

test('differently branded candidate archive domain discovery never proves missing positions on old candidate domain',()=>{
 assert.equal(ledger.scope.originalAcquisitionWorkflowRun,38192154846);
 assert.equal(ledger.scope.originalAcquisitionArtifact,11720994420);
 assert.equal(ledger.scope.sourceAcquisitionDocumentedOriginalDomain,'dorninkforsenate.com');
 assert.equal(ledger.scope.olderPreviouslyProbedDistinctDomain,'genedorninkforsenate.com');
 assert.equal(ledger.scope.candidateSiteSelfReportsNotAuthenticatedOfficialVotes,true);
 assert.equal(ledger.scope.notASiteWideCompleteIssueCensus,true);
 assert.equal(ledger.scope.archiveFailuresAndCappedCDXUnknownNotPolicyAbsence,true);
 assert.equal(ledger.scope.productionDatabaseReadsWrites,0);
 assert.equal(ledger.scope.officialSenateRollCallVerificationsFromCandidateQuotes,0);
 assert.equal(ledger.scope.forecastTrainingScheduler2027Changes,0);
});
