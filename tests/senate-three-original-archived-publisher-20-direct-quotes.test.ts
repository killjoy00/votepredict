import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-three-original-publisher-direct-speech-20-excerpts-v1.json' with {type:'json'};

test('twenty exact attributed archived originals are publisher-hosted, never campaign website count',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.actualServingStateSenators2021To2025,95);
 assert.equal(ledger.scope.originalCandidateOwnedWebsiteSourceCoverageUnaffected,true);
 assert.equal(ledger.scope.firstPartySiteCoverageIncrementFromThisIndependentPublisherLedger,0);
 assert.equal(ledger.scope.sourceIsPublisherHostedNotCandidateWebsite,true);
 assert.equal(ledger.pages.length,3);
 assert.equal(ledger.excerpts.length,20);
 assert.deepEqual(ledger.pages.map(p=>p.person),['Doron Clark','Susan Pha','David Tomassoni']);
 assert.ok(ledger.pages.every(p=>p.candidateCampaignWebsiteOriginal===false));
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactOriginalSpeakerExcerpt)).size,20);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,20);
});

test('Doron interview is Jan 14 before Jan 28 2025; Pha and Tomassoni are after earlier elections',()=>{
 const doron=ledger.pages[0],pha=ledger.pages[1],tom=ledger.pages[2];
 assert.ok(doron.publicByUTC<'2025-01-28T00:00:00.000Z');
 assert.ok(pha.publicByUTC>'2022-11-08T00:00:00.000Z');
 assert.ok(tom.publicByUTC>'2020-11-03T00:00:00.000Z');
 assert.equal(ledger.scope.doronPublicByBeforeJanuary282025SpecialElection,true);
 assert.equal(ledger.scope.phaOriginalNov2022AfterNov8Election,true);
 assert.equal(ledger.scope.tomassoniOriginalNov2020AfterNov3Election,true);
 assert.equal(doron.originalPublisher,'Minnesota Public Radio / MPR News');
 assert.equal(pha.originalPublisher,'Sahan Journal');
 assert.equal(tom.originalPublisher,'Minnesota Senate DFL caucus');
 assert.equal(ledger.scope.historicPublisherClaimDateNotOriginalFirstAuthoredDate,true);
});

test('quotes are brief literal fragments in source page, no official votes or forecasts inferred',()=>{
 const pages=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.excerpts.every(q=>pages.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactOriginalSpeakerExcerpt.length>=8&&q.exactOriginalSpeakerExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.originalSpeakerQuotedRegionVerified===true));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateProven===false));
 assert.ok(ledger.excerpts.every(q=>q.officialSenateActionVerified===false&&q.automaticallyEligibleForForecast===false));
 assert.equal(ledger.scope.noAutomaticOfficialVoteProof,true);
 assert.equal(ledger.scope.noAutomaticForecastVoteEligibility,true);
 assert.equal(ledger.scope.productionDatabaseReadsWrites,0);
 assert.equal(ledger.scope.modelForecastTrainingScheduler2027Changes,0);
});

test('complete publisher archive original receipts remain available and pinned, with no duplicate Pha versions counted',()=>{
 assert.equal(ledger.scope.independentOriginalPublisherAcquisitionRun,38193981012);
 assert.equal(ledger.scope.originalPublisherRecentArtifactId,11722957357);
 assert.equal(ledger.scope.originalPublisherOlderArtifactId,11722646920);
 assert.equal(ledger.scope.entirePublisherHTMLOriginalsIndependentlyCrosschecked,3);
 assert.equal(ledger.scope.separatePublisherOriginalCDXIndexes,3);
 assert.equal(ledger.scope.original2022PhaDuplicateHTMLVersionsNotDoubleCounted,true);
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalRawHtmlSha256)));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalWholeCdxSha256)));
 assert.ok(ledger.pages.every(p=>/^[A-Z2-7]{32}$/.test(p.originalCdxSha1Base32)));
 assert.deepEqual(ledger.pages.map(p=>ledger.excerpts.filter(q=>q.pageId===p.id).length),[7,7,6]);
});
