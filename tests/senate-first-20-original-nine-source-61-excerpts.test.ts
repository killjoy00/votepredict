import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-first-20-original-nine-actual-senators-61-short-excerpts-v1.json' with {type:'json'};

test('first 20-senator cohort: nine actually served and 61 different short source leads',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.originalSourceAcquisitionRun,38175993447);
 assert.equal(ledger.scope.originalAcquisitionArtifact,11716126718);
 assert.equal(ledger.scope.trueServiceSenators2021To2025,95);
 assert.equal(ledger.scope.newActualSenatorsWithFirstPartyIssueQuotes,9);
 assert.equal(ledger.scope.shortDistinctLiteralQuoteLeads,61);
 assert.equal(ledger.pages.length,11);
 assert.equal(ledger.excerpts.length,61);
 assert.equal(new Set(ledger.pages.map(p=>p.person)).size,9);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,61);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,61);
});

test('every archived original and CDX page has a pinned independent digest and plausible pre-election capture',()=>{
 const cutoffs:Record<number,string>={2020:'2020-11-03T00:00:00.000Z',2022:'2022-11-08T00:00:00.000Z'};
 for(const p of ledger.pages){
  assert.match(p.originalHtmlSha256,/^[0-9a-f]{64}$/);
  assert.match(p.sourceWindowCdxSha256,/^[0-9a-f]{64}$/);
  assert.match(p.archiveOriginalCdxDigestSha1Base32,/^[A-Z2-7]{32}$/);
  assert.ok(p.archiveCaptureUtc<cutoffs[p.electionYear]);
  assert.ok(p.archivedOriginalSiteUrl.startsWith('http'));
  assert.ok(p.originalHtmlFilename.endsWith('.html'));
  assert.equal(p.websiteStatementsFirstAuthoredDateKnown,false);
  assert.equal(p.verifiedOfficialVotes,false);
  assert.equal(p.forecastsAutoEligible,false);
 }
});

test('older House pages, older Senate elections, original committee paid-for attribution, and self-reports are not erased',()=>{
 const house=ledger.pages.filter(p=>p.person==='Steve Drazkowski');
 assert.equal(house.length,2);
 assert.ok(house.every(p=>p.historicalPageAttribution.includes('house')));
 assert.equal(ledger.pages.find(p=>p.person==='Jeremy Miller')?.historicalPageAttribution.includes('older_senate_sd28'),true);
 assert.ok(ledger.pages.filter(p=>p.person==='Jason Isaacson').every(p=>p.historicalPageAttribution.includes('2016')));
 assert.equal(ledger.pages.find(p=>p.person==='Bill Weber')?.historicalPageAttribution.includes('2012'),true);
 assert.equal(ledger.pages.find(p=>p.person==='Jeff Howe')?.historicalPageAttribution.includes('2018'),true);
 assert.ok(ledger.pages.every(p=>typeof p.committeeAttributionText==='string'&&p.committeeAttributionText.length>=12));
 assert.equal(ledger.scope.oldHouseSiteNeverClaimed2022SenatePlatform,true);
 assert.equal(ledger.scope.pastLegislationSelfReportsNeverOfficialVotes,true);
});

test('all exact passages stay short, historical, non-production and non-forecast',()=>{
 const pages=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.excerpts.every(q=>pages.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateKnown===false));
 assert.ok(ledger.excerpts.every(q=>q.officialLegislativeActionVerified===false));
 assert.ok(ledger.excerpts.every(q=>q.automaticallyEligibleForForecast===false));
 assert.ok(ledger.excerpts.some(q=>q.attributionClass==='candidate_self_reported_prior_legislation_unverified'));
 assert.ok(ledger.excerpts.some(q=>q.attributionClass==='candidate_listed_bill_not_officially_verified'));
 assert.equal(ledger.scope.productionDBWrites,0);
 assert.equal(ledger.scope.forecastTrainingChanges,0);
});

test('originally unconfirmed, capped, repurposed and error-page archives stay unresolved',()=>{
 assert.equal(ledger.excludedUnreliableOriginalSourceCandidates.length,11);
 assert.equal(new Set(ledger.excludedUnreliableOriginalSourceCandidates.map(e=>e.person)).size,11);
 const excluded=new Set(ledger.excludedUnreliableOriginalSourceCandidates.map(e=>e.person));
 assert.ok(excluded.has('Eric Lucero'));
 assert.ok(excluded.has('Mary Kiffmeyer'));
 assert.ok(excluded.has('David Tomassoni'));
 assert.ok(excluded.has('Robert Kupec'));
 assert.ok(excluded.has('Bruce Anderson'));
 assert.ok(ledger.pages.every(p=>!excluded.has(p.person)));
 assert.equal(ledger.scope.noCompleteArchiveCensusClaim,true);
 assert.equal(ledger.scope.archiveErrorsAndRepurposedSitesNeverNoPolicy,true);
});
