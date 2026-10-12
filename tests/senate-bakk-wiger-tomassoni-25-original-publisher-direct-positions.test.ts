import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-bakk-tomassoni-wiger-25-original-publisher-direct-positions-v1.json' with {type:'json'};

test('exactly 25 independent original publisher senator speaker excerpts and three complete source HTML pages',()=>{
 assert.equal(ledger.schema,'mn-bakk-tomassoni-wiger-25-original-firstperson-publisher-fragments-v1');
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.officialActual2021to2025ServingSenators,95);
 assert.equal(ledger.scope.sourceAcquisitionRun,38199484424);
 assert.equal(ledger.pages.length,3);
 assert.equal(ledger.excerpts.length,25);
 assert.equal(new Set(ledger.excerpts.map(x=>x.exactShortSpeakerExcerpt)).size,25);
 assert.equal(new Set(ledger.excerpts.map(x=>x.id)).size,25);
 assert.deepEqual(ledger.pages.map(p=>p.person),['Thomas Bakk','David Tomassoni','Charles Wiger']);
 assert.deepEqual(ledger.pages.map(p=>p.officialSenateDistrict),['3','6','43']);
 assert.deepEqual(ledger.pages.map(p=>ledger.excerpts.filter(q=>q.pageId===p.id).length),[15,4,6]);
});

test('original public-by times precede 2020 election and older 2015 Wiger remarks retain their original election-cycle distinction',()=>{
 assert.ok(ledger.pages.every(p=>p.originalPublicByUtc<'2020-11-03T00:00:00.000Z'));
 assert.deepEqual(ledger.pages.map(p=>p.claimedArticlePublicationDate),['2020-10-08','2020-01-31','2015-05-19']);
 assert.equal(ledger.scope.wigerOlder2015SenateStatementNotSameElectionCyclePlatform,true);
 assert.equal(ledger.scope.bakkCampaignInterviewExact2020Original,true);
 assert.equal(ledger.scope.tomassoniPipelineQuoteJanuary2020Original,true);
 assert.ok(ledger.pages.every(p=>p.originalAuthorshipTimeBeyondCaptureNotIndependentlyEstablished===true));
 assert.ok(ledger.pages.every(p=>p.originalTextResearchOnly&&p.eligibleForProductionForecast===false));
});

test('all original byte digests and indexed SHA1 proofs are pinned; only short original speaker literals accepted',()=>{
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalHtmlSha256)));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalCdxSha256)));
 assert.ok(ledger.pages.every(p=>/^[A-Z2-7]{32}$/.test(p.originalIndexedSha1Base32)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortSpeakerExcerpt.length>=8&&q.exactShortSpeakerExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.attribution==='named_actual_serving_senator_original_firstperson_speech_on_independent_publisher'));
 assert.ok(ledger.excerpts.every(q=>q.historicalPublicationDateNotFirstAuthored&&q.legislativeVoteSelfReportNotOfficialVoteProof));
 const ids=new Set(ledger.pages.map(x=>x.id));
 assert.ok(ledger.excerpts.every(q=>ids.has(q.pageId)));
});

test('research remains outside owned campaign-site coverage and outside any live prediction or legislative voting evidence',()=>{
 assert.equal(ledger.scope.baselineAuthenticatedCandidateOwnedWebsitePeople,92);
 assert.equal(ledger.scope.baselineShortAuthenticatedCandidateOwnedSiteExcerpts,1194);
 assert.equal(ledger.scope.publisherNotCandidateOwnedWebsite,true);
 assert.equal(ledger.scope.originalSiteCoverageIncrement,0);
 assert.equal(ledger.scope.originalSiteResearchExcerptIncrement,0);
 assert.equal(ledger.scope.allClaimsOfVotesBillsAchievementUnverifiedWithoutOfficialSources,true);
 assert.equal(ledger.scope.noAutomaticPredictionEligibility,true);
 assert.equal(ledger.scope.productionDatabaseReadsWrites,0);
 assert.equal(ledger.scope.forecastModelTrainingScheduler2027Changes,0);
 assert.ok(ledger.pages.every(p=>p.candidateOwnedWebsite===false));
 assert.ok(ledger.excerpts.every(q=>q.eligibleForProductionForecast===false));
});
