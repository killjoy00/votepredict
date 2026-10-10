/**
 * #912 Track D: publisher-page discoveries are publicly researched leads,
 * NEVER VotePredict evidence, authenticated Wayback bytes or human-verified
 * senator quotations. Detect article URL paths unreachable by the current
 * bounded Wayback seed prefix without assuming statewide incompleteness counts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LOCAL_TRADE_NEWS_SEEDS } from '../src/evidence/local-trade-news-history.js';

type PublicLead = {
  id:string;
  publisher:string;
  seedId:string;
  livePageUrl:string;
  publicationDayDisplayedOnPublicPage:string;
  searchTopicOnly:string;
  namedSenatorLeadsForManualReview:string[];
  evidenceDisposition:string;
  sourceSeenInVotePredictExport:string;
  originalArchivedHttpBytesHashVerified:boolean;
  archiveCapturePublicByVerified:boolean;
  historicalForecastEligibilityProven:boolean;
  membershipOnPublicationDateVerified:boolean;
  directQuoteHumanVerified:boolean;
  issueStanceInferred:boolean;
  urlInsideCurrentSeedPrefix:boolean;
};
type Ledger = {
  version:string;
  studyYears:number[];
  selectedNonExhaustiveArticleLeads:PublicLead[];
  sourceUniverseCompletenessKnown:boolean;
  stateSenateOnly:boolean;
  publisherYearSlotsInOriginal44SeedReview:number;
  seedPrefixDiscoveryComparison:{
    publisherSeedsChecked:string[];
    calculatedAgainstCheckedInSeedUrls:boolean;
    outsideSeedPrefixLeadCount:number;
    criticalLimitation:string;
  };
};
const data=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8',
)) as Ledger;

test('curated publicly observed leads cover all five study years, two publishers and distinct URLs',()=>{
  assert.equal(data.version,'senate-media-public-discovery-leads-v1');
  assert.deepEqual(data.studyYears,[2021,2022,2023,2024,2025]);
  assert.equal(data.stateSenateOnly,true);
  assert.equal(data.sourceUniverseCompletenessKnown,false);
  assert.equal(data.publisherYearSlotsInOriginal44SeedReview,220);
  const leads=data.selectedNonExhaustiveArticleLeads;
  assert.ok(leads.length>=14);
  assert.equal(new Set(leads.map(x=>x.id)).size,leads.length);
  assert.equal(new Set(leads.map(x=>x.livePageUrl)).size,leads.length);
  assert.deepEqual([...new Set(leads.map(x=>x.publisher))].sort(),[
    'MPR News','Minnesota Reformer',
  ]);
  for(const year of data.studyYears)
    assert.ok(leads.filter(x=>x.publicationDayDisplayedOnPublicPage.startsWith(String(year))).length>=2);
});

test('the live publication day and senator-name leads never imply archived evidence, stance or forecast eligibility',()=>{
  const seeds=new Map(LOCAL_TRADE_NEWS_SEEDS.map(seed=>[seed.id,seed]));
  const expectedNames=new Set(['MPR News','Minnesota Reformer']);
  for(const item of data.selectedNonExhaustiveArticleLeads){
    const day=item.publicationDayDisplayedOnPublicPage;
    assert.match(day,/^20(?:21|22|23|24|25)-\d{2}-\d{2}$/);
    assert.equal(new Date(day+'T00:00:00Z').toISOString().slice(0,10),day);
    assert.ok(item.id.length>=10);
    assert.ok(item.searchTopicOnly.length>2);
    assert.ok(item.namedSenatorLeadsForManualReview.length>0);
    assert.ok(item.namedSenatorLeadsForManualReview.every(name=>
      /^[A-Z][A-Za-z .'-]* [A-Z][A-Za-z .'-]*$/.test(name)));
    assert.ok(expectedNames.has(item.publisher));
    const seed=seeds.get(item.seedId);
    assert.ok(seed && seed.publisher===item.publisher && seed.prefix===true);
    const u=new URL(item.livePageUrl);
    const seedUrl=new URL(seed.url);
    assert.equal(u.protocol,'https:');
    assert.equal(u.username,'');
    assert.equal(u.password,'');
    assert.equal(u.hash,'');
    assert.equal(u.search,'');
    assert.equal(u.hostname,seedUrl.hostname);
    assert.equal(item.urlInsideCurrentSeedPrefix,item.livePageUrl.startsWith(seed.url));
    assert.equal(item.evidenceDisposition,'public_article_discovery_only');
    assert.equal(item.sourceSeenInVotePredictExport,'unknown_not_reconciled');
    assert.equal(item.originalArchivedHttpBytesHashVerified,false);
    assert.equal(item.archiveCapturePublicByVerified,false);
    assert.equal(item.historicalForecastEligibilityProven,false);
    assert.equal(item.membershipOnPublicationDateVerified,false);
    assert.equal(item.directQuoteHumanVerified,false);
    assert.equal(item.issueStanceInferred,false);
    assert.equal(Object.hasOwn(item,'exactQuote'),false);
    assert.equal(Object.hasOwn(item,'sourceDocumentId'),false);
    assert.equal(Object.hasOwn(item,'sourceSha256'),false);
  }
});

test('article-level Reformer /briefs/ links expose a deterministic archive seed-prefix gap',()=>{
  const source=data.selectedNonExhaustiveArticleLeads;
  const outside=source.filter(x=>!x.urlInsideCurrentSeedPrefix);
  assert.equal(outside.length,4);
  assert.equal(data.seedPrefixDiscoveryComparison.outsideSeedPrefixLeadCount,outside.length);
  assert.deepEqual(data.seedPrefixDiscoveryComparison.publisherSeedsChecked,[
    'minnesota-reformer-article-archive','mpr-news-story-archive',
  ]);
  assert.equal(data.seedPrefixDiscoveryComparison.calculatedAgainstCheckedInSeedUrls,true);
  for(const item of outside){
    assert.equal(item.publisher,'Minnesota Reformer');
    assert.ok(new URL(item.livePageUrl).pathname.startsWith('/briefs/'));
    assert.equal(item.livePageUrl.startsWith('https://minnesotareformer.com/202'),false);
  }
  assert.ok(new Set(outside.map(x=>Number(x.publicationDayDisplayedOnPublicPage.slice(0,4)))).size>=2);
  assert.ok(data.seedPrefixDiscoveryComparison.criticalLimitation.includes('unknown'));
  // This audit DOES NOT change production ingestion seeds or make an all-media census.
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed=>
    seed.id==='minnesota-reformer-article-archive'
    && seed.url==='https://minnesotareformer.com/202'));
});
