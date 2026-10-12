import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-last16-five-new-original-site-policy-excerpts-v1.json' with {type:'json'};

test('five newly original-site quote-covered actual Minnesota senate service people',()=>{
 const s=ledger.scope;
 assert.equal(s.issue,864);
 assert.equal(s.officialTrueServingSenators,95);
 assert.equal(s.priorServingSenatorsWithAuthenticOriginalSiteExcerpts,79);
 assert.equal(s.priorOriginalSiteShortResearchRows,1006);
 assert.equal(s.newActualServingSenatorsWithSiteQuotes,5);
 assert.equal(s.completeOriginalSiteSourcePages,12);
 assert.equal(s.exactHistoricallyAttributedShortExcerpts,73);
 assert.equal(ledger.pages.length,12);
 assert.equal(ledger.excerpts.length,73);
 assert.deepEqual([...new Set(ledger.pages.map(p=>p.person))].sort(),[
  'Eric Lucero','Jason Rarick','Kelly Morrison','Matt Klein','Robert Kupec']);
 assert.equal(new Set(ledger.pages.map(p=>p.id)).size,12);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,73);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,73);
});

test('all literal short quotes are bound to a source and cannot be automatically used for prediction',()=>{
 const pageIds=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.excerpts.every(q=>pageIds.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateKnown===false));
 assert.ok(ledger.excerpts.every(q=>q.officialLegislativeActionVerified===false));
 assert.ok(ledger.excerpts.every(q=>q.automaticallyEligibleForForecast===false));
 assert.ok(ledger.pages.every(p=>p.originalFirstPublishedDateProven===false&&
  p.officialSenateLegislativeActionsProven===false&&p.automaticallyEligibleForForecast===false));
 assert.equal(ledger.scope.productionReadsWritesOrForecasts,0);
 assert.equal(ledger.unobservedAreUnknownNotNoPolicy,true);
});

test('campaign office and capture date are never misrepresented',()=>{
 const pageCounts=(person:string)=>ledger.pages.filter(p=>p.person===person);
 assert.equal(pageCounts('Jason Rarick').length,7);
 assert.ok(pageCounts('Jason Rarick').every(p=>p.sourceGroup==='rarick'));
 assert.ok(pageCounts('Jason Rarick').every(p=>p.originalCampaignScope==='2021_senate_site_retains_earlier_house_era_claims'));
 assert.equal(pageCounts('Eric Lucero').length,1);
 assert.equal(pageCounts('Eric Lucero')[0].originalCampaignScope,'2016_house_campaign_not_2022_senate_platform');
 assert.equal(pageCounts('Kelly Morrison').length,2);
 assert.ok(pageCounts('Kelly Morrison').every(p=>p.originalCampaignScope.startsWith('2022_senate_')));
 assert.equal(pageCounts('Robert Kupec').length,1);
 assert.equal(pageCounts('Matt Klein').length,1);
 assert.equal(ledger.scope.earlierHouseCampaignPositionsNeverCalled2022SenatePledges,true);
 assert.equal(ledger.scope.candidatePriorVoteClaimsNotOfficialSenateVotes,true);
 assert.equal(ledger.scope.archivalUTCNotFirstPublishedDate,true);
 assert.ok(ledger.pages.every(p=>p.serviceElectionYear===2022));
});

test('individual historical source evidence retains original distinct acquisition IDs',()=>{
 assert.equal(ledger.scope.last16SourceAcquisitionRun,38186753218);
 assert.equal(ledger.scope.last16SourceArtifact,11719882698);
 assert.equal(ledger.scope.rarickSevenSourceAcquisitionRun,38186897084);
 assert.equal(ledger.scope.rarickSevenSourceArtifact,11719617752);
 assert.equal(ledger.scope.rarickOriginalCompleteCdxAcquisitionRun,38175993447);
 assert.equal(ledger.scope.rarickOriginalCompleteCdxArtifact,11716126718);
 const values=ledger.excerpts.map(q=>q.attributionClass);
 assert.ok(values.includes('older_2016_minnesota_house_campaign_issue_priority'));
 assert.ok(values.includes('candidate_self_reported_prior_house_vote_unverified'));
 assert.ok(values.includes('candidate_self_reported_prior_house_legislation_unverified'));
 assert.equal(ledger.scope.notAnExhaustiveOriginalSiteCensus,true);
});
