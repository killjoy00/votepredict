import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-wiger-tomassoni-bakk-2020-original-publisher-20-excerpts-v1.json' with {type:'json'};

test('2020 original 20 historical senator direct quotes remain independently publisher sourced and not campaign sites',()=>{
 assert.equal(ledger.schema,'mn-three-2020-preelection-publisher-original-20-senator-quoted-excerpts-v1');
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.officialTrueServingSenatorPopulation,95);
 assert.equal(ledger.scope.priorOriginalCandidateOwnedSiteCoveragePeople,90);
 assert.equal(ledger.scope.originalCandidateSiteCoverageIncrease,0);
 assert.equal(ledger.scope.originalCandidateSiteResearchExcerptIncrease,0);
 assert.equal(ledger.pages.length,3);
 assert.equal(ledger.excerpts.length,20);
 assert.deepEqual(ledger.pages.map(p=>p.person),['Charles Wiger','David Tomassoni','Thomas Bakk']);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortSpeakerExcerpt)).size,20);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,20);
 assert.ok(ledger.pages.every(p=>p.notCandidateOwnedCampaignSite===true));
});

test('2020 archive public-by predates general election; election-causation and original authorship unknown',()=>{
 assert.ok(ledger.pages.every(p=>p.originalPublicByUtc<'2020-11-03T00:00:00.000Z'));
 assert.ok(ledger.pages.every(p=>p.historicalElectionYear===2020&&p.originalPostDateUnknown===true));
 assert.ok(ledger.pages.every(p=>p.officialRollcallVoteNotVerified===true&&p.forecastAutoEligible===false));
 assert.deepEqual(ledger.pages.map(p=>p.official2020District),['43','6','3']);
 assert.equal(ledger.scope.originalBeforeNov32020General,true);
 assert.equal(ledger.scope.originalCapturedDateNotFirstAuthoredDate,true);
 assert.equal(ledger.scope.TomBakk2008GovernorUnderConstructionSiteNot2020SenatePlatform,true);
 assert.equal(ledger.scope.TomassoniOldCandidateDomainRepurposedSpamExcluded,true);
});

test('historical named direct speaker quote fragments are brief literal source leads only, with raw source and CDX SHA pinned',()=>{
 const ids=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.excerpts.every(q=>ids.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortSpeakerExcerpt.length>=8&&q.exactShortSpeakerExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.originalFirstAuthoredDateUnproven===true));
 assert.ok(ledger.excerpts.every(q=>q.officialVoteOrLegislativeActionUnconfirmed===true));
 assert.ok(ledger.excerpts.every(q=>q.eligibleForProductionForecast===false));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalHtmlSha256)));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalCdxSha256)));
 assert.ok(ledger.pages.every(p=>/^[A-Z2-7]{32}$/.test(p.originalIndexedSha1Base32)));
 assert.deepEqual(ledger.pages.map(p=>ledger.excerpts.filter(q=>q.pageId===p.id).length),[9,7,4]);
});

test('all originals are research-only and direct publisher statements do not add official votes or forecasts',()=>{
 assert.equal(ledger.scope.sourceAcquisitionWorkflowRun,38196317659);
 assert.equal(ledger.scope.fullOriginalPublisherHTMLPages,3);
 assert.equal(ledger.scope.independentWholeOriginalCdxIndexes,3);
 assert.equal(ledger.scope.originalDirectSpeakerFragments,20);
 assert.equal(ledger.scope.authenticSourcePublisherNotSenatorOwnedWebsite,true);
 assert.equal(ledger.scope.allOfficialVotesAndBillsNeedSeparateOfficialVerification,true);
 assert.equal(ledger.scope.automaticForecastIngestion,0);
 assert.equal(ledger.scope.productionDbReadsWrites,0);
 assert.equal(ledger.scope.modelTrainingScheduler2027Changes,0);
});
