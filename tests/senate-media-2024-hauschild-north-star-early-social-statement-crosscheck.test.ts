/**
 * Track D #987, selected Feb 2024 current-publisher/social-original lead.
 *
 * No X API, Internet Archive, private VotePredict source rows, archived raw
 * article/audio bytes or privileged credentials. These tests validate the
 * conservative provenance constraints and ID timestamp math ONLY.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const cross=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2024-hauschild-north-star-early-social-statement-crosscheck.json',
  'utf8',
)) as {
  version:string; issue:number; researchCheckedOn:string; person:{
    name:string;serviceVerifiedFrom:string;activeOnAllDisplayedFebruary2024ResearchDays:boolean;
    reference:string;quoteFromOriginalSocialPostAuthenticated:boolean;
  };
  legislation:{
    bill:string;introducedFirstRead:string;officialSource:string;
    listedSenateAuthors:string[];grantHauschildIsListedSenateBillAuthor:boolean;
    floorVoteForThisBillProven:boolean;noVoteInferredFromSenatorPublicOpposition:boolean;
  };
  linkedFirstPartySocialPost:{
    canonicalResearchUrl:string;statusId:string;derivedSnowflakeClockUtc:string;
    originalPostRawBytesRetrieved:boolean;originalPostTextIndependentlyFetched:boolean;
    historicalVisibilityFromTweetIdProven:boolean;
    originalFirstPublicByFromArchiveProven:boolean;
    referencedByCurrentMedia:string[];
  };
  sourceChronology:Array<{
    id:string;type:string;currentPublisherUrl:string;
    displayedPublisherDay:string;publisher:string;
    originalXStatusIdFromLinkedPage?:string;
    linkedXStatusId?:string;
    sourceStatementShortQuotation?:string;
    senatorLabel?:string;hostLabel?:string;currentTranscriptShortUtterance?:string;
    separateQuoteSpeaker?:string;separateQuoteShortExcerpt?:string;
    separateQuoteSpeakerOfficialSenateHistory?:string;
    separateQuoteSpeakerServiceOnPublisherDisplayedDayVerified?:boolean;
    separateQuoteSpeakerSenateMajorityLeadershipStart?:string;
    separateQuoteSpeakerMajorityLeadershipOnDisplayedDayVerified?:boolean;
    houseSpeakerMelissaHortmanIsNotMinnesotaSenator?:boolean;
    chiefSponsorOmarFatehWasNotQuotedAsSpeakerInThisSource?:boolean;
    grantHauschildWordsPresentedAsReporterParaphraseNotVerbatim?:boolean;
    directQuotedReporterTextEqualsFirstPartyOriginalProven?:boolean;
    anyNamedQuoteFromOriginalArchivedBytesHumanReviewed?:boolean;
    originalPublishedArticleBytesSha256Verified?:boolean;
    exactOriginalArchivedHttpBodyVerified?:boolean;
    exactOriginalArchivedHtmlBytesVerified?:boolean;
    originalFirstPublicByFromArchiveProven?:boolean;
    historicalForecastEligibilityVerified:boolean;
  }>;
  custodyLimitations:Record<string,unknown>;
  provenanceDriftWatch:{
    priorSearchResultRepresentedCampaignAdvocacyDomain:string;
    liveSiteAccessOn2026_10_10:string;
    historicalCampaignPageBytesAuthenticated:boolean;
    campaignSiteAllowedAsOriginalSenatorStatement:boolean;
  };
};

const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json',
  'utf8',
)) as {selectedNonExhaustiveArticleLeads:Array<{
  id:string;livePageUrl:string;originalArchivedHttpBytesHashVerified:boolean;
  directQuoteHumanVerified:boolean;historicalForecastEligibilityProven:boolean;
}>};

function snowflakeIdClockUtc(id:string):string {
  // DO NOT cast a 19-digit ID to Number; use exact BigInt, X 2010 epoch.
  if(!/^[1-9]\d{14,18}$/.test(id))throw Error('Malformed X status ID');
  const num=BigInt(id);
  if(num<=0n || num>=(1n<<63n))throw Error('Out-of-range X status ID');
  const unixMs=(num>>22n)+1288834974657n;
  if(unixMs>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Unsafe timestamp');
  return new Date(Number(unixMs)).toISOString();
}
const order=['2024-02-11','2024-02-12','2024-02-19'];

test('one serving state senator, correct official bill authors, and no inferred floor vote or content proof',()=>{
  assert.equal(cross.version,'senate-media-2024-hauschild-north-star-first-person-statement-crosscheck-v1');
  assert.equal(cross.issue,987);
  assert.equal(cross.person.name,'Grant Hauschild');
  assert.equal(cross.person.reference,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15577');
  assert.equal(cross.person.serviceVerifiedFrom,'2023-01-02');
  assert.equal(cross.person.activeOnAllDisplayedFebruary2024ResearchDays,true);
  assert.equal(cross.person.quoteFromOriginalSocialPostAuthenticated,false);
  assert.equal(cross.legislation.bill,'SF2724');
  assert.equal(cross.legislation.introducedFirstRead,'2023-03-08');
  assert.equal(cross.legislation.officialSource,
    'https://www.revisor.mn.gov/bills/93/2023/0/SF/2724/');
  assert.deepEqual(cross.legislation.listedSenateAuthors,['Omar Fateh','Susan Pha']);
  assert.equal(cross.legislation.grantHauschildIsListedSenateBillAuthor,false);
  assert.equal(cross.legislation.floorVoteForThisBillProven,false);
  assert.equal(cross.legislation.noVoteInferredFromSenatorPublicOpposition,true);
});

test('one reporter-linked canonical X status ID encodes Feb 10 clock without proving original authorship or visibility',()=>{
  const s=cross.linkedFirstPartySocialPost;
  assert.equal(s.canonicalResearchUrl,
    'https://twitter.com/grant_hauschild/status/'+s.statusId);
  assert.equal(s.statusId,'1756375725714571676');
  assert.equal(snowflakeIdClockUtc(s.statusId),'2024-02-10T17:52:59.550Z');
  assert.equal(s.derivedSnowflakeClockUtc,snowflakeIdClockUtc(s.statusId));
  assert.ok(Date.parse(s.derivedSnowflakeClockUtc)<Date.parse('2024-02-11T00:00:00Z'));
  assert.equal(s.originalPostRawBytesRetrieved,false);
  assert.equal(s.originalPostTextIndependentlyFetched,false);
  assert.equal(s.historicalVisibilityFromTweetIdProven,false);
  assert.equal(s.originalFirstPublicByFromArchiveProven,false);
  assert.throws(()=>snowflakeIdClockUtc('1756375725714571676.0'),/Malformed/);
  assert.throws(()=>snowflakeIdClockUtc('9999999999999999999'),/Out-of-range/);
});

test('two distinct currently readable newsroom pages cite same X post; source-date labels remain unarchived',()=>{
  const [alpha,reformer,mpr]=cross.sourceChronology;
  assert.ok(alpha&&reformer&&mpr);
  assert.deepEqual(cross.sourceChronology.map(x=>x.displayedPublisherDay),order);
  assert.equal(alpha.publisher,'Alpha News');
  assert.equal(reformer.publisher,'Minnesota Reformer');
  assert.equal(mpr.publisher,'MPR News');
  assert.notEqual(alpha.currentPublisherUrl,reformer.currentPublisherUrl);
  assert.equal(alpha.originalXStatusIdFromLinkedPage,
    cross.linkedFirstPartySocialPost.statusId);
  assert.equal(reformer.linkedXStatusId,cross.linkedFirstPartySocialPost.statusId);
  assert.deepEqual([...cross.linkedFirstPartySocialPost.referencedByCurrentMedia].sort(),
    [alpha.currentPublisherUrl,reformer.currentPublisherUrl].sort());
  assert.ok((alpha.sourceStatementShortQuotation??'').startsWith(
    'I will not be supporting this legislation'));
  assert.equal(alpha.directQuotedReporterTextEqualsFirstPartyOriginalProven,false);
  assert.equal(alpha.originalPublishedArticleBytesSha256Verified,false);
  assert.equal(reformer.grantHauschildWordsPresentedAsReporterParaphraseNotVerbatim,true);
  assert.equal(reformer.separateQuoteSpeaker,'Erin Murphy');
  assert.equal(reformer.separateQuoteSpeakerOfficialSenateHistory,
    'https://www.lrl.mn.gov/legdb/fulldetail?id=15284');
  assert.equal(reformer.separateQuoteSpeakerSenateMajorityLeadershipStart,'2024-02-06');
  assert.equal(reformer.separateQuoteSpeakerServiceOnPublisherDisplayedDayVerified,true);
  assert.equal(reformer.separateQuoteSpeakerMajorityLeadershipOnDisplayedDayVerified,true);
  assert.ok(reformer.separateQuoteSpeakerSenateMajorityLeadershipStart!<
    reformer.displayedPublisherDay);
  assert.ok(reformer.separateQuoteShortExcerpt?.includes('committee process'));
  assert.equal(reformer.houseSpeakerMelissaHortmanIsNotMinnesotaSenator,true);
  assert.equal(reformer.chiefSponsorOmarFatehWasNotQuotedAsSpeakerInThisSource,true);
  assert.equal(reformer.anyNamedQuoteFromOriginalArchivedBytesHumanReviewed,false);
  assert.equal(mpr.hostLabel,'CATHY WURZER:');
  assert.equal(mpr.senatorLabel,'GRANT HAUSCHILD:');
  assert.equal(mpr.currentTranscriptShortUtterance,
    'I feel that immigration is a federal issue.');
  for(const source of cross.sourceChronology) {
    assert.equal(source.historicalForecastEligibilityVerified,false);
    assert.equal(source.originalFirstPublicByFromArchiveProven??false,false);
  }
});

test('the 2024 Reformer brief/dated paths and MPR episode are already sampled; no duplicated archive denominator',()=>{
  assert.equal(ledger.selectedNonExhaustiveArticleLeads.length,31);
  const expected=[
    'https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/',
    'https://minnesotareformer.com/2024/02/12/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/',
    'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
  ];
  for(const url of expected){
    const matches=ledger.selectedNonExhaustiveArticleLeads.filter(x=>x.livePageUrl===url);
    assert.equal(matches.length,1,url);
    assert.equal(matches[0]?.originalArchivedHttpBytesHashVerified,false);
    assert.equal(matches[0]?.directQuoteHumanVerified,false);
    assert.equal(matches[0]?.historicalForecastEligibilityProven,false);
  }
  assert.ok(!ledger.selectedNonExhaustiveArticleLeads.some(x=>
    x.livePageUrl===cross.linkedFirstPartySocialPost.canonicalResearchUrl));
  assert.ok(!ledger.selectedNonExhaustiveArticleLeads.some(x=>
    x.livePageUrl===cross.sourceChronology[0]?.currentPublisherUrl));
});

test('all context sources remain research only, and repurposed advocacy domain is disqualified',()=>{
  const limits=cross.custodyLimitations;
  assert.equal(limits.originalXPostOrHistoricalArchivedReplayAccessible,false);
  assert.equal(limits.alphaOriginal2024ArticleCapturedAndHashed,false);
  assert.equal(limits.reformerOriginal2024ArticleCapturedAndHashed,false);
  assert.equal(limits.mprOriginal2024AudioTranscriptCapturedAndHashed,false);
  assert.equal(limits.independentSpeakerReviewOfExactOriginalBytesPerformed,false);
  assert.equal(limits.matchedPrivateVotePredictSourceDocument,false);
  assert.equal(limits.quoteAndStanceEvidencePromotedToProduction,false);
  assert.equal(limits.uniqueHistoricallyVerifiedSenatorStatements,0);
  assert.equal(limits.statewideSenatorMediaCoverageDenominatorKnown,false);
  assert.equal(cross.provenanceDriftWatch.priorSearchResultRepresentedCampaignAdvocacyDomain,
    'northstaract.org');
  assert.equal(cross.provenanceDriftWatch.liveSiteAccessOn2026_10_10,
    'redirected_to_unrelated_gambling_site');
  assert.equal(cross.provenanceDriftWatch.historicalCampaignPageBytesAuthenticated,false);
  assert.equal(cross.provenanceDriftWatch.campaignSiteAllowedAsOriginalSenatorStatement,false);
});
