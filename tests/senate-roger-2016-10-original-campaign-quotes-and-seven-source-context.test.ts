import assert from 'node:assert/strict';
import test from 'node:test';
import review from '../data/evaluation/senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1.json' with {type:'json'};

test('#864 2016 Roger candidate-owned original vs 2019 unrelated reused Tomassoni domain copy',()=>{
 assert.equal(review.scope.issue,864);
 assert.equal(review.scope.originalAuthenticFullHtmlPageBodiesCrosschecked,7);
 assert.equal(review.scope.fullOriginalIndependentHistoricalCdxJsonSourcesCrosschecked,5);
 assert.equal(review.scope.distinctExactShortIssueStatements,10);
 assert.equal(review.scope.yearOfOriginalArchiveCapture,2016);
 assert.equal(review.scope.originalArchivalPublicByUtc,'2016-02-27T08:24:48.000Z');
 assert.equal(review.scope.firstAuthoredDateIndependentlyProven,false);
 assert.equal(review.scope.claimOfBeingReissuedAs2020Platform,false);
 assert.equal(review.scope.Tomassoni2019WordPressReceiptsAreHisPoliticStatements,false);
 assert.equal(review.scope.CarrieRuud2016RepeatOf2013IssueCopyNotRecounted,true);
 assert.equal(review.scope.Roger2020SenatorPodcastSiteNotElectionPlatform,true);
 assert.equal(review.scope.olderPastVotesIn2016SiteNotOfficialVerifiedVotes,true);
 assert.equal(review.scope.productionDatabaseEvidenceModelForecastSchedulerChanges,0);
 assert.equal(review.scope.statewideCampaignCoverageCertified,false);
 assert.equal(review.source.originalFullIndependentCDXFile,'chamberlain_org_2014_2018-entire-original-cdx.json');
 assert.equal(review.source.firstPartyArchivedCampaignURL,'http://www.rogerchamberlain.org:80/issues.html');
 assert.equal(review.source.originalArchivedCaptureUtc,'2016-02-27T08:24:48.000Z');
 assert.equal(review.source.attributionProofText,'Prepared and paid for by Chamberlain for Senate');
 assert.equal(review.reviewOfAllSevenOriginalHtml.length,7);
 assert.equal(review.reviewOfAllSevenOriginalHtml.filter(x=>x.personDomainLead==='David Tomassoni'
   &&x.candidateOwnedPoliticalAttributionAllowed===false&&x.selectedNewExcerpts===0).length,2);
 assert.equal(review.reviewOfAllSevenOriginalHtml.filter(x=>x.sourceClass.includes('2020_senator_owned')
   &&x.candidateOwnedPoliticalAttributionAllowed===false).length,2);
 assert.equal(review.reviewOfAllSevenOriginalHtml.filter(x=>x.personDomainLead==='Carrie Ruud'
   &&x.selectedNewExcerpts===0).length,2);
 const original = review.reviewOfAllSevenOriginalHtml.filter(x=>x.selectedNewExcerpts>0);
 assert.equal(original.length,1);
 assert.equal(original[0].personDomainLead,'Roger Chamberlain');
 const ids=new Set<string>(),texts=new Set<string>();
 for(const quote of review.tenCandidateSiteExactStatements){
  assert.ok(quote.exactExcerpt.length>=8&&quote.exactExcerpt.length<=130);
  assert.ok(quote.issueFamily&&quote.conservativeMeaning);
  assert.ok(!ids.has(quote.id)&&!texts.has(quote.exactExcerpt));
  assert.equal(quote.attributedTo,'Roger Chamberlain');
  assert.equal(quote.historic2016CaptureOnlyNot2020Authorship,true);
  assert.equal(quote.automaticEvidenceForecastAdmission,false);
  ids.add(quote.id);texts.add(quote.exactExcerpt);
 }
 assert.equal(texts.size,10);
});
