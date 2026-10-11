/**
 * #946 public-only seed URL shadow analysis, with no network/SQL/ingestion.
 * URLs and publication days are leads and never historical quote evidence.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  diagnoseMediaPublicDiscoveryPaths,
} from '../src/evidence/senate-media-public-discovery-gaps.js';
import {LOCAL_TRADE_NEWS_SEEDS} from '../src/evidence/local-trade-news-history.js';

type LedgedLead={
  id:string;seedId:string;livePageUrl:string;
  publicationDayDisplayedOnPublicPage:string;urlInsideCurrentSeedPrefix:boolean;
};
const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8',
)) as {selectedNonExhaustiveArticleLeads:LedgedLead[]};

const brief=(id:string,slug:string,day='2025-05-01')=>({
  id,seedId:'minnesota-reformer-article-archive',
  livePageUrl:'https://minnesotareformer.com/briefs/'+slug+'/',
  publicationDayDisplayedOnPublicPage:day,
});
const dated=(id:string,slug:string,day='2025-05-01')=>({
  id,seedId:'minnesota-reformer-article-archive',
  livePageUrl:'https://minnesotareformer.com/'+day.replaceAll('-','/')+'/'+slug+'/',
  publicationDayDisplayedOnPublicPage:day,
});

test('shadowed public leads expose configured prefix and secondary topical-path blind spots',()=>{
  const results=diagnoseMediaPublicDiscoveryPaths(ledger.selectedNonExhaustiveArticleLeads);
  assert.equal(results.version,'senate-media-public-url-path-diagnostic-v1');
  assert.equal(results.totalCuratedPublicUrlLeads,25);
  assert.equal(results.leads.length,25);
  assert.equal(results.urlLeadsOutsideConfiguredSeedPrefix,11);
  assert.ok(results.urlLeadsFilteredByTopicalPathPriority>=1);
  assert.ok(results.urlLeadsExcludedByEitherGate>=11);
  assert.ok(results.urlLeadsExcludedByBothGates<=results.urlLeadsOutsideConfiguredSeedPrefix);
  for(const lead of results.leads) {
    const original=ledger.selectedNonExhaustiveArticleLeads.find(x=>x.id===lead.id)!;
    const seed=LOCAL_TRADE_NEWS_SEEDS.find(s=>s.id===original.seedId)!;
    assert.equal(lead.currentSeedPrefixWouldIncludeUrl,original.urlInsideCurrentSeedPrefix);
    assert.equal(lead.currentSeedPrefixWouldIncludeUrl,lead.originalUrl.startsWith(seed.url));
    assert.equal(lead.currentTwoGateDiscoveryWouldSelectUrl,
      lead.currentSeedPrefixWouldIncludeUrl && lead.currentPathPriorityWouldSelectUrl);
    assert.equal(lead.measuredAgainst,'current_seed_prefix_and_path_rules_only');
    assert.equal(lead.originalWaybackCaptureVerified,false);
    assert.equal(lead.matchedDatabaseSourceDocument,false);
    assert.equal(lead.exactSenatorQuoteVerified,false);
    assert.equal(lead.forecastEligibilityVerified,false);
    assert.equal(Object.hasOwn(lead,'sourceDocumentId'),false);
  }
  assert.equal(results.isPublisherPublicationCensus,false);
  assert.equal(results.sourceBytesOrDatabaseAccessed,false);
  assert.equal(results.quotesHumanVerified,0);
  assert.equal(results.statewideDenominatorEstablished,false);
});


test('a real first-party MPR /episode/ audio transcript is excluded by the story-only seed',()=>{
  const input=ledger.selectedNonExhaustiveArticleLeads.find(x=>x.id===
    'mpr-2024-hauschild-north-star-on-air-interview');
  assert.ok(input);
  const r=diagnoseMediaPublicDiscoveryPaths([input]);
  assert.equal(r.totalCuratedPublicUrlLeads,1);
  assert.equal(r.urlLeadsOutsideConfiguredSeedPrefix,1);
  assert.equal(r.urlLeadsExcludedByEitherGate,1);
  assert.equal(r.possibleAliasPairs.length,0);
  const x=r.leads[0]!;
  assert.equal(x.originalUrl,'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south');
  assert.equal(x.configuredSeedPrefix,'https://www.mprnews.org/story/202');
  assert.equal(x.currentSeedPrefixWouldIncludeUrl,false);
  assert.equal(x.currentTwoGateDiscoveryWouldSelectUrl,false);
  assert.equal(x.originalWaybackCaptureVerified,false);
  assert.equal(x.matchedDatabaseSourceDocument,false);
  assert.equal(x.exactSenatorQuoteVerified,false);
  assert.equal(x.forecastEligibilityVerified,false);
  assert.equal(r.sourceBytesOrDatabaseAccessed,false);
  assert.equal(r.statewideDenominatorEstablished,false);
});

test('public /briefs/ and dated paths yield four research alias candidates, not deduplicated articles',()=>{
  const result=diagnoseMediaPublicDiscoveryPaths(ledger.selectedNonExhaustiveArticleLeads);
  assert.equal(result.possibleAliasPairs.length,4);
  assert.deepEqual(result.possibleAliasPairs.map(p=>[
    p.firstLeadId,p.secondLeadId,p.commonDisplayedPublicationDay,
  ]),[
    ['mn-reformer-2022-dfl-public-safety-brief','mn-reformer-2022-dfl-public-safety-dated','2022-03-22'],
    ['mn-reformer-2023-driver-licenses','mn-reformer-2023-driver-licenses-dated','2023-02-21'],
    ['mn-reformer-2024-sanctuary-brief','mn-reformer-2024-sanctuary-dated','2024-02-12'],
    ['mn-reformer-2025-road-signs-brief','mn-reformer-2025-road-signs-dated','2025-05-01'],
  ]);
  assert.ok(result.possibleAliasPairs.every(p=>
    p.status==='candidate_alias_not_verified_same_article'
    && p.originalArchivedBytesCompared===false
    && p.publishedMediaDenominatorDeduplicated===false));
  assert.equal(result.sourceBytesOrDatabaseAccessed,false);
});

test('2022, 2024 and 2025 current publisher /briefs/ links are represented in the bounded prefix-gap audit',()=>{
  const r=diagnoseMediaPublicDiscoveryPaths(ledger.selectedNonExhaustiveArticleLeads);
  for(const year of [2021,2022,2023,2024,2025]) {
    assert.ok(r.leads.some(x=>x.displayedPublicationDay.startsWith(String(year))
      && x.originalUrl.startsWith('https://minnesotareformer.com/briefs/')
      && !x.currentSeedPrefixWouldIncludeUrl));
  }
  // These are public URL observations, not database or archived article census rows.
  assert.equal(r.statewideDenominatorEstablished,false);
  assert.equal(r.quotesHumanVerified,0);
});

test('prefix alone is not evidence of capture if URL path scoring rejects an otherwise eligible story',()=>{
  const r=diagnoseMediaPublicDiscoveryPaths([{
    id:'mpr-2021-synthetic-school-choice',
    seedId:'mpr-news-story-archive',
    livePageUrl:'https://www.mprnews.org/story/2021/06/10/gop-wants-private-school-option-walz-dfl-push-back',
    publicationDayDisplayedOnPublicPage:'2021-06-10',
  }]);
  assert.equal(r.urlLeadsOutsideConfiguredSeedPrefix,0);
  assert.equal(r.urlLeadsFilteredByTopicalPathPriority,1);
  assert.equal(r.urlLeadsExcludedByEitherGate,1);
  assert.equal(r.leads[0].currentTwoGateDiscoveryWouldSelectUrl,false);
  // Article may still exist under a different URL or corpus: no missing count.
  assert.equal(r.sourceBytesOrDatabaseAccessed,false);
});

test('matched brief and dated slug/day are alias CANDIDATES, not authenticated duplicate article proof',()=>{
  const leads=[
    brief('brief-senate-education','senate-education-bill'),
    dated('dated-senate-education','senate-education-bill'),
    dated('dated-other-slug','senate-budget-bill'),
    dated('different-year-same-slug','senate-education-bill','2024-05-01'),
  ];
  const result=diagnoseMediaPublicDiscoveryPaths(leads);
  assert.equal(result.possibleAliasPairs.length,1);
  assert.deepEqual(result.possibleAliasPairs[0],{
    firstLeadId:'brief-senate-education',
    secondLeadId:'dated-senate-education',
    commonDisplayedPublicationDay:'2025-05-01',
    reason:'same_reformer_host_day_and_slug_brief_vs_dated_path',
    status:'candidate_alias_not_verified_same_article',
    originalArchivedBytesCompared:false,
    publishedMediaDenominatorDeduplicated:false,
  });
  assert.equal(result.totalCuratedPublicUrlLeads,4);
});

test('rejects fake dates, duplicates, cross-publisher URLs and unsafe URL syntax',()=>{
  const valid=brief('brief-senate-example','senate-example');
  const invalid=[
    [{...valid,id:'x'}],
    [valid,valid],
    [valid,{...valid,id:'other-lead-id'}],
    [{...valid,publicationDayDisplayedOnPublicPage:'2025-02-30'}],
    [{...valid,publicationDayDisplayedOnPublicPage:'2026-01-01'}],
    [{...valid,seedId:'not-a-seed'}],
    [{...valid,livePageUrl:'https://malicious.example.com/briefs/senate-example/'}],
    [{...valid,livePageUrl:'http://minnesotareformer.com/briefs/senate-example/'}],
    [{...valid,livePageUrl:'https://untrusted@minnesotareformer.com/briefs/senate-example/'}],
    [{...valid,livePageUrl:valid.livePageUrl+'?tracking=1'}],
    [{...valid,livePageUrl:valid.livePageUrl+'#fragment'}],
  ];
  for(const rows of invalid)
    assert.throws(()=>diagnoseMediaPublicDiscoveryPaths(rows));
  assert.throws(()=>diagnoseMediaPublicDiscoveryPaths(Array.from({length:501},(_,i)=>({
    ...valid,id:'brief-senate-'+i,livePageUrl:valid.livePageUrl+i,
  }))),/at most 500/);
});
